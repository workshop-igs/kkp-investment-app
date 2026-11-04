import json
import os
import subprocess
import tempfile

import httpx
import numpy as np
from django.contrib.gis.gdal import GDALRaster
from django.core.management.base import BaseCommand, CommandError

from analitik.management.commands.muat_raster import KOSONG, simpan_grid, warp_baca

URL_OKSIGEN = ('https://www.ncei.noaa.gov/thredds-ocean/fileServer/woa23/DATA/oxygen/netcdf/all/1.00/'
               'woa23_all_o00_01.nc')
URL_PH = 'https://www.ncei.noaa.gov/data/oceans/ncei/ocads/data/0220059/OceanSODA_ETHZ-v2025.OCADS.01-1982-2024.nc'
UMOL_PER_KG_KE_MG_PER_L = 0.032 * 1.025
RESOLUSI = 0.25
ISI_PIKSEL = 12
BULAN_RATA = 60


def unduh(url, tujuan):
    with httpx.stream('GET', url, timeout=600, follow_redirects=True) as r:
        r.raise_for_status()
        with open(tujuan, 'wb') as f:
            for potong in r.iter_bytes(1 << 20):
                f.write(potong)


def rata_bulan_akhir(sumber, variabel, folder):
    tif = os.path.join(folder, f'{variabel}.tif')
    subprocess.run(['gdal_translate', '-q', '-of', 'GTiff', '-a_srs', 'EPSG:4326', f'NETCDF:"{sumber}":{variabel}', tif],
                   check=True)
    r = GDALRaster(tif)
    pita = [r.bands[i] for i in range(max(0, len(r.bands) - BULAN_RATA), len(r.bands))]
    tumpuk = []
    for p in pita:
        d = p.data().reshape(r.height, r.width).astype('float64')
        if p.nodata_value is not None:
            d[d == p.nodata_value] = np.nan
        d[(d < 0) | (d > 14)] = np.nan
        tumpuk.append(d)
    rata = np.nanmean(np.stack(tumpuk), axis=0)
    tujuan = os.path.join(folder, 'ph_rata.tif')
    GDALRaster({
        'driver': 'GTiff', 'name': tujuan, 'srid': 4326, 'width': r.width, 'height': r.height,
        'origin': list(r.origin), 'scale': list(r.scale), 'datatype': 6,
        'bands': [{'data': np.where(np.isnan(rata), KOSONG, rata).astype('float32').ravel(), 'nodata_value': KOSONG}],
    })
    return tujuan


class Command(BaseCommand):
    help = 'Tarik oksigen terlarut (NOAA WOA23) dan pH (OceanSODA-ETHZ) permukaan laut sebagai raster kondisi tetap.'

    def add_arguments(self, parser):
        parser.add_argument('--oksigen', help='Berkas woa23_all_o00_01.nc yang sudah diunduh')
        parser.add_argument('--ph', help='Berkas OceanSODA-ETHZ .nc yang sudah diunduh')

    def handle(self, *args, **o):
        hasil = {}
        with tempfile.TemporaryDirectory() as folder:
            oksigen = o['oksigen'] or os.path.join(folder, 'oksigen.nc')
            ph = o['ph'] or os.path.join(folder, 'ph.nc')
            try:
                if not o['oksigen']:
                    unduh(URL_OKSIGEN, oksigen)
                if not o['ph']:
                    unduh(URL_PH, ph)
            except httpx.HTTPError as e:
                raise CommandError(f'Unduhan gagal: {e}') from None

            data = warp_baca(f'NETCDF:"{oksigen}":o_an', RESOLUSI, 'bilinear', ISI_PIKSEL,
                             ('-s_srs', 'EPSG:4326', '-b', '1'), hanya_laut=True) * UMOL_PER_KG_KE_MG_PER_L
            hasil['OKSIGEN'] = simpan_grid(
                'OKSIGEN', data, RESOLUSI, 'mg/L',
                'NOAA World Ocean Atlas 2023 (1°): oksigen terlarut permukaan, rata-rata tahunan klimatologi, '
                'dikonversi dari µmol/kg; perairan dekat pantai diisi dari sel terdekat', 'klimatologi WOA23')

            data = warp_baca(rata_bulan_akhir(ph, 'ph_total', folder), RESOLUSI, 'bilinear', ISI_PIKSEL,
                             hanya_laut=True)
            hasil['PH'] = simpan_grid(
                'PH', data, RESOLUSI, '',
                'OceanSODA-ETHZ v2025 (NOAA NCEI 0220059, 1°): pH total permukaan, rata-rata 60 bulan terakhir; '
                'perairan dekat pantai diisi dari sel terdekat', '2020-2024')
        self.stdout.write(self.style.SUCCESS(f'Oksigen {hasil["OKSIGEN"]} petak, pH {hasil["PH"]} petak'))
        return json.dumps({'dimuat': True})
