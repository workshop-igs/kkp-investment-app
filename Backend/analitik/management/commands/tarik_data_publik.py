import json
import os
import subprocess
import tempfile
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import numpy as np
import rasterio
from affine import Affine
from django.contrib.gis.gdal import GDALRaster
from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from rasterio.features import rasterize, shapes
from rasterio.warp import Resampling, reproject

from analitik.management.commands.muat_raster import BATAS, simpan_grid, warp_baca
from inventarisasi.models import InfrastrukturPendukung

KEPALA = {'User-Agent': 'kkp-investasi-ruang-laut/1.0'}
SIMPANAN = '/tmp/kkp-data-publik'
KONEKSI = 16
BAGIAN = 16 << 20
PERCOBAAN = 10
POWER = 'https://power.larc.nasa.gov/api/temporal/climatology/regional'
GWA = 'https://globalwindatlas.info/api/gis/country/IDN/wind-speed/100'
SOILGRIDS = '/vsicurl/https://files.isric.org/soilgrids/latest/data/clay/clay_0-5cm_mean.vrt'
WOA = ('https://www.ncei.noaa.gov/data/oceans/woa/WOA23/DATA/temperature/netcdf/decav91C0/0.25/'
       'woa23_decav91C0_t00_04.nc')
HYCOM = 'https://ncss.hycom.org/thredds/ncss/GLBy0.08/expt_93.0/{d}'
AKHIR_HYCOM = datetime(2024, 9, 1, tzinfo=timezone.utc)
LANGKAH_HYCOM = 40
WW3 = 'https://upwell.pfeg.noaa.gov/erddap/griddap/NWW3_Global_Best.nc'
TAHUN_AWAL_WW3 = 2018
PERIODE_ULANG_TAHUN = 50
EOT20 = 'https://www.seanoe.org/data/00683/79489/data/85762.zip'
KONSTITUEN_PASUT = ('M2', 'S2', 'K1', 'O1')
HYDRORIVERS = 'https://data.hydrosheds.org/file/HydroRIVERS/HydroRIVERS_v10_{w}_shp.zip'
DAS_MINIMAL_KM2 = 1000
JRC_PANTAI = ('https://jeodpp.jrc.ec.europa.eu/ftp/public/JRC-OpenData/LISCOAST/globalShorelineChange/LATEST/'
              'globalCoastalMorphodynamicsDb.nc')
RESOLUSI_ABRASI = 0.01
OBIS = 'https://api.obis.org/v3/checklist'
RESOLUSI_SHANNON = 0.5
MINIMAL_SPESIES_SHANNON = 30
GMW = 'https://zenodo.org/api/records/6894273/files/gmw_v3_f1996_t2020_gtiff.zip/content'
NILAI_HILANG_GMW = 1
RESOLUSI_MANGROVE = 0.005
FRAKSI_EKS_MANGROVE = 0.25
SRTM = 'https://upwell.pfeg.noaa.gov/erddap/griddap/srtm15plus.nc'
RESOLUSI_BATIMETRI = 1 / 120
COPERNICUS = 'https://copernicus-dem-90m.s3.amazonaws.com'
GEM = ('/vsizip/vsicurl/https://zenodo.org/records/8409647/files/GEM-GSHM_PGA-475y-rock_v2023.zip/'
       'v2023_1_pga_475_rock_3min.tif')


def _tarik(url, berkas, params=None, rentang=None):
    kepala = {**KEPALA, 'Range': f'bytes={rentang[0]}-{rentang[1]}'} if rentang else KEPALA
    for coba in range(PERCOBAAN):
        try:
            with httpx.stream('GET', url, params=params, headers=kepala, timeout=600, follow_redirects=True) as r:
                r.raise_for_status()
                if rentang and r.status_code != 206:
                    raise CommandError(f'Server tidak melayani unduhan sebagian ({r.status_code})')
                with open(berkas, 'r+b' if rentang else 'wb') as f:
                    f.seek(rentang[0] if rentang else 0)
                    for potong in r.iter_bytes(1 << 20):
                        f.write(potong)
            return
        except Exception as e:
            if coba == PERCOBAAN - 1:
                raise CommandError(f'Gagal mengunduh {url}: {e}') from e
            time.sleep(15 * (coba + 1))


def unduh(url, tujuan, params=None, ulang=False):
    if os.path.exists(tujuan) and not ulang:
        return tujuan
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    sementara = tujuan + '.sebagian'
    info = httpx.head(url, headers=KEPALA, timeout=60, follow_redirects=True) if params is None else None
    ukuran = int(info.headers.get('content-length', 0)) if info is not None and info.status_code == 200 else 0
    if ukuran > 64 << 20 and info.headers.get('accept-ranges') == 'bytes':
        catatan = sementara + '.bagian'
        selesai = set()
        if os.path.exists(sementara) and os.path.exists(catatan):
            with open(catatan) as f:
                selesai = set(f.read().split())
        else:
            with open(sementara, 'wb') as f:
                f.truncate(ukuran)

        def bagian(a):
            if str(a) in selesai:
                return
            _tarik(url, sementara, rentang=(a, min(a + BAGIAN, ukuran) - 1))
            with open(catatan, 'a') as f:
                f.write(f'{a}\n')

        with ThreadPoolExecutor(KONEKSI) as kerja:
            list(kerja.map(bagian, range(0, ukuran, BAGIAN)))
        os.remove(catatan)
    else:
        _tarik(url, sementara, params)
    os.replace(sementara, tujuan)
    return tujuan


def paralel(tugas, koneksi=4):
    with ThreadPoolExecutor(koneksi) as kerja:
        return list(kerja.map(lambda t: unduh(*t), tugas))


def larik(berkas, nama):
    keluar = subprocess.run(['gdalmdiminfo', '-detailed', '-array', nama, berkas], capture_output=True, text=True,
                            check=True).stdout
    return np.array(json.loads(keluar)['values'], dtype=float)


def pita(berkas, subdataset):
    with tempfile.TemporaryDirectory() as d:
        tif = os.path.join(d, 'pita.tif')
        subprocess.run(['gdal_translate', '-q', '-unscale', '-ot', 'Float32', f'NETCDF:"{berkas}":{subdataset}', tif],
                       check=True)
        r = GDALRaster(tif)
        lapis = []
        for b in r.bands:
            data = b.data().reshape(r.height, r.width).astype('float64')
            if b.nodata_value is not None:
                data[data == b.nodata_value] = np.nan
            lapis.append(data)
        return np.array(lapis), r


def grid_wilayah(resolusi):
    return SimpleNamespace(width=round((BATAS[2] - BATAS[0]) / resolusi), height=round((BATAS[3] - BATAS[1]) / resolusi),
                           origin=(BATAS[0], BATAS[3]), scale=(resolusi, -resolusi))


def grid_dari(data, acuan, resolusi, metode='average', isi_kosong=0):
    with tempfile.TemporaryDirectory() as d:
        asal = os.path.join(d, 'asal.tif')
        GDALRaster({
            'name': asal, 'driver': 'GTiff', 'srid': 4326, 'width': acuan.width, 'height': acuan.height,
            'origin': list(acuan.origin), 'scale': list(acuan.scale), 'datatype': 6,
            'bands': [{'data': np.where(np.isnan(data), -9999.0, data).astype('float32').ravel(), 'nodata_value': -9999.0}],
        })
        return warp_baca(asal, resolusi, metode, isi_kosong)


class Command(BaseCommand):
    help = ('Tarik data publik untuk kriteria kesesuaian per jenis: batimetri dan kemiringan dasar laut (SRTM15+), '
            'kemiringan lahan (Copernicus DEM), PGA gempa (GEM), iradiasi surya (NASA POWER), angin 100 m (Global Wind '
            'Atlas), tanah liat (SoilGrids), beda suhu permukaan dan 1.000 m (WOA23), serta arus permukaan dan '
            'salinitas (HYCOM GOFS 3.1).')

    SUMBER = ('BATIMETRI', 'KEMIRINGAN', 'PGA', 'GHI', 'ANGIN_100M', 'TANAH_LIAT', 'BEDA_SUHU_1000M', 'ARUS_SALINITAS',
              'ARUS_DASAR', 'GELOMBANG_EKSTREM', 'PASUT', 'MUARA', 'ABRASI', 'SHANNON', 'MANGROVE')

    def add_arguments(self, parser):
        parser.add_argument('--sumber', choices=self.SUMBER, action='append')

    def handle(self, *args, **opsi):
        for nama in opsi['sumber'] or self.SUMBER:
            mulai = time.time()
            for kode, jumlah in getattr(self, f'_{nama.lower()}')():
                self.stdout.write(self.style.SUCCESS(f'{kode}: {jumlah} petak ({time.time() - mulai:.0f} dtk)'))

    def _batimetri(self):
        petak = paralel([
            (f'{SRTM}?z[({y}):({y + 6})][({x}):({x + 6})]', os.path.join(SIMPANAN, 'srtm15', f'{x}_{y}.nc'))
            for x in range(int(BATAS[0]), int(BATAS[2]), 6) for y in range(int(BATAS[1]), int(BATAS[3]), 6)
        ])
        with tempfile.TemporaryDirectory() as d:
            vrt, lereng = os.path.join(d, 'srtm.vrt'), os.path.join(d, 'lereng.tif')
            subprocess.run(['gdalbuildvrt', '-q', vrt, *petak], check=True)
            subprocess.run(['gdaldem', 'slope', '-q', '-s', '111120', '-compute_edges', vrt, lereng], check=True)
            tinggi = warp_baca(vrt, RESOLUSI_BATIMETRI)
            miring = warp_baca(lereng, RESOLUSI_BATIMETRI)
        laut = np.nan_to_num(tinggi, nan=0) < 0
        yield 'KEDALAMAN', simpan_grid('KEDALAMAN', np.where(laut, np.round(tinggi), np.nan), RESOLUSI_BATIMETRI, 'm',
                                       'SRTM15+ v2.6 (Scripps, 15 detik busur) via NOAA ERDDAP, dirata-rata ke 30 detik '
                                       'busur (±0,9 km)')
        yield 'KEMIRINGAN_DASAR', simpan_grid('KEMIRINGAN_DASAR', np.where(laut, miring, np.nan), RESOLUSI_BATIMETRI, '°',
                                              'Dihitung dari batimetri SRTM15+ v2.6 (15 detik busur), dirata-rata ke 30 '
                                              'detik busur')

    def _kemiringan(self):
        folder = os.path.join(SIMPANAN, 'lereng')
        os.makedirs(folder, exist_ok=True)
        lereng = []
        for nama in httpx.get(f'{COPERNICUS}/tileList.txt', headers=KEPALA, timeout=300).text.split():
            b = nama.split('_')
            y = int(b[4][1:]) * (1 if b[4][0] == 'N' else -1)
            x = int(b[6][1:]) * (1 if b[6][0] == 'E' else -1)
            if not (BATAS[0] <= x < BATAS[2] and BATAS[1] <= y < BATAS[3]):
                continue
            tujuan = os.path.join(folder, f'{nama}.tif')
            if not os.path.exists(tujuan):
                subprocess.run(['gdaldem', 'slope', '-q', '-p', '-s', '111120', '-compute_edges', '-co', 'COMPRESS=DEFLATE',
                                f'/vsicurl/{COPERNICUS}/{nama}/{nama}.tif', tujuan + '.sebagian.tif'], check=True)
                os.replace(tujuan + '.sebagian.tif', tujuan)
            lereng.append(tujuan)
        vrt = os.path.join(folder, 'lereng.vrt')
        subprocess.run(['gdalbuildvrt', '-q', '-overwrite', vrt, *lereng], check=True)
        yield 'KEMIRINGAN', simpan_grid('KEMIRINGAN', warp_baca(vrt, 0.005), 0.005, '%',
                                        'Dihitung dari Copernicus DEM GLO-90 (ESA, 90 m), kemiringan rata-rata per 0,005° '
                                        '(±550 m)')

    def _pga(self):
        yield 'PGA', simpan_grid('PGA', warp_baca(GEM, 0.05, isi_kosong=20), 0.05, 'g',
                                 'GEM Global Seismic Hazard Map v2023.1, PGA batuan dasar peluang terlampaui 10% dalam '
                                 '50 tahun (periode ulang 475 tahun); perairan diisi dari daratan terdekat sejauh ±100 km')

    def _ghi(self):
        titik = []
        for x in range(int(BATAS[0]), int(BATAS[2]), 10):
            for y in range(int(BATAS[1]), int(BATAS[3]), 9):
                r = httpx.get(POWER, params={
                    'parameters': 'ALLSKY_SFC_SW_DWN', 'community': 'RE', 'format': 'json',
                    'longitude-min': x, 'longitude-max': min(x + 10, BATAS[2]),
                    'latitude-min': y, 'latitude-max': min(y + 9, BATAS[3]),
                }, headers=KEPALA, timeout=300)
                r.raise_for_status()
                for f in r.json()['features']:
                    nilai = f['properties']['parameter']['ALLSKY_SFC_SW_DWN']['ANN']
                    if nilai is not None and nilai > -900:
                        titik.append((*f['geometry']['coordinates'][:2], nilai))
        titik = np.array(titik)
        resolusi = 0.125
        bx = BATAS[0] + resolusi / 2 + np.arange(round((BATAS[2] - BATAS[0]) / resolusi)) * resolusi
        by = BATAS[3] - resolusi / 2 - np.arange(round((BATAS[3] - BATAS[1]) / resolusi)) * resolusi
        gx, gy = np.meshgrid(bx, by)
        grid = np.empty(gx.shape)
        for i in range(gx.shape[0]):
            jarak = (gx[i][:, None] - titik[:, 0]) ** 2 + (gy[i][:, None] - titik[:, 1]) ** 2
            grid[i] = titik[jarak.argmin(axis=1), 2]
        yield 'GHI', simpan_grid('GHI', grid, resolusi, 'kWh/m²/hari',
                                 'NASA POWER (CERES), iradiasi surya global horizontal rata-rata tahunan, klimatologi')

    def _angin_100m(self):
        asal = unduh(GWA, os.path.join(SIMPANAN, 'gwa_idn_100m.tif'), ulang=True)
        yield 'ANGIN_100M', simpan_grid('ANGIN_100M', warp_baca(asal, 0.01), 0.01, 'm/s',
                                        'Global Wind Atlas 3 (DTU, Bank Dunia), kecepatan angin rata-rata 10 tahun pada '
                                        'ketinggian 100 m, resolusi 250 m dirata-rata ke 0,01°')

    def _tanah_liat(self):
        data = warp_baca(SOILGRIDS, 0.005, tambahan=('-wo', 'NUM_THREADS=ALL_CPUS', '-multi')) / 10
        yield 'TANAH_LIAT', simpan_grid('TANAH_LIAT', data, 0.005, '%',
                                        'ISRIC SoilGrids 2.0, kandungan liat lapisan 0-5 cm, resolusi 250 m dirata-rata ke '
                                        '0,005°')

    def _beda_suhu_1000m(self):
        berkas = unduh(WOA, os.path.join(SIMPANAN, 'woa23_t00_04.nc'))
        lapis, acuan = pita(berkas, 't_an')
        info = subprocess.run(['gdalinfo', f'NETCDF:"{berkas}":t_an'], capture_output=True, text=True, check=True).stdout
        kedalaman = [float(v) for v in info.split('NETCDF_DIM_depth_VALUES={')[1].split('}')[0].split(',')]
        beda = lapis[kedalaman.index(0.0)] - lapis[kedalaman.index(1000.0)]
        data = grid_dari(beda, acuan, 0.25, 'near')
        yield 'BEDA_SUHU_1000M', simpan_grid('BEDA_SUHU_1000M', data, 0.25, '°C',
                                             'NOAA World Ocean Atlas 2023, klimatologi suhu 1991-2020 (0,25°): selisih '
                                             'suhu permukaan dan kedalaman 1.000 m')

    def _hycom(self, dataset, variabel, nama, langkah, **tambahan):
        batas = [AKHIR_HYCOM - timedelta(days=366) + timedelta(days=366 * i / 12) for i in range(13)]
        berkas = paralel([
            (HYCOM.format(d=dataset), os.path.join(SIMPANAN, f'hycom_{nama}_{i}.nc'), {
                'north': BATAS[3], 'south': BATAS[1], 'west': BATAS[0], 'east': BATAS[2], 'horizStride': 1,
                'time_start': f'{a:%Y-%m-%dT%H:%M:%SZ}', 'time_end': f'{b - timedelta(hours=3):%Y-%m-%dT%H:%M:%SZ}',
                'timeStride': langkah, 'var': variabel, 'accept': 'netcdf4', **tambahan,
            }, True)
            for i, (a, b) in enumerate(zip(batas, batas[1:]))
        ])
        return berkas, f'{batas[0]:%d-%m-%Y} sampai {AKHIR_HYCOM - timedelta(days=1):%d-%m-%Y}'

    def _arus_salinitas(self):
        berkas, periode = self._hycom('uv3z', ['water_u', 'water_v'], 'uv', LANGKAH_HYCOM, vertCoord=0)
        kecepatan, acuan = [], None
        for b in berkas:
            u, acuan = pita(b, 'water_u')
            kecepatan.append(np.hypot(u, pita(b, 'water_v')[0]))
        data = grid_dari(np.nanmean(np.concatenate(kecepatan), axis=0), acuan, 0.08)
        yield 'ARUS', simpan_grid('ARUS', data, 0.08, 'm/s',
                                  'HYCOM GOFS 3.1 GLBy0.08 (1/12°), rata-rata kecepatan arus permukaan 12 bulan terakhir arsip',
                                  f'{periode}, sampel tiap 5 hari')
        berkas, periode = self._hycom('ts3z', 'salinity', 's', LANGKAH_HYCOM, vertCoord=0)
        lapis = [pita(b, 'salinity') for b in berkas]
        data = grid_dari(np.nanmean(np.concatenate([x for x, _ in lapis]), axis=0), lapis[0][1], 0.08, isi_kosong=6)
        yield 'SALINITAS', simpan_grid('SALINITAS', data, 0.08, 'ppt',
                                       'HYCOM GOFS 3.1 GLBy0.08 (1/12°), rata-rata salinitas permukaan 12 bulan terakhir arsip; '
                                       'darat pesisir diisi dari perairan terdekat', f'{periode}, sampel tiap 5 hari')

    def _arus_dasar(self):
        berkas, periode = self._hycom('uv3z', ['water_u', 'water_v'], 'uv_dasar', 240)
        kecepatan, acuan = [], None
        for b in berkas:
            u, acuan = pita(b, 'water_u')
            v = pita(b, 'water_v')[0]
            ada = ~np.isnan(u)
            dasar = u.shape[0] - 1 - np.argmax(ada[::-1], axis=0)
            baris, kolom = np.indices(dasar.shape)
            nilai = np.hypot(u[dasar, baris, kolom], v[dasar, baris, kolom])
            kecepatan.append(np.where(ada.any(axis=0), nilai, np.nan))
        data = grid_dari(np.nanmean(kecepatan, axis=0), acuan, 0.08)
        yield 'ARUS_DASAR', simpan_grid('ARUS_DASAR', data, 0.08, 'm/s',
                                        'HYCOM GOFS 3.1 GLBy0.08 (1/12°, 40 lapis kedalaman), rata-rata kecepatan arus pada lapis '
                                        'terdalam yang berair, satu sampel per bulan', f'{periode}, 12 sampel bulanan')

    def _gelombang_ekstrem(self):
        tahun = range(TAHUN_AWAL_WW3, datetime.now(timezone.utc).year)
        bulan = [(t, b) for t in tahun for b in range(1, 13)]
        berkas = paralel([
            (f'{WW3}?Thgt[({t}-{b:02d}-01T00:00:00Z):3:({t + b // 12}-{b % 12 + 1:02d}-01T00:00:00Z)][(0.0)]'
             f'[({BATAS[1]}):({BATAS[3]})][({BATAS[0]}):({BATAS[2]})]', os.path.join(SIMPANAN, 'ww3', f'{t}_{b:02d}.nc'))
            for t, b in bulan
        ], 2)
        per_tahun, acuan = {}, None
        for (t, _), b in zip(bulan, berkas):
            h, acuan = pita(b, 'Thgt')
            per_tahun[t] = np.fmax(per_tahun.get(t, np.full(h.shape[1:], np.nan)), np.nanmax(h, axis=0))
        maksimum = np.array(list(per_tahun.values()))
        reduksi = -np.log(-np.log(1 - 1 / PERIODE_ULANG_TAHUN))
        ekstrem = np.nanmean(maksimum, axis=0) + np.nanstd(maksimum, axis=0, ddof=1) * np.sqrt(6) / np.pi * (
            reduksi - 0.5772)
        data = grid_dari(ekstrem, acuan, 0.5, 'near')
        yield 'GELOMBANG_EKSTREM', simpan_grid(
            'GELOMBANG_EKSTREM', data, 0.5, 'm',
            f'NOAA WaveWatch III (0,5°): tinggi gelombang signifikan periode ulang {PERIODE_ULANG_TAHUN} tahun, distribusi '
            f'Gumbel dari maksimum tahunan {tahun[0]}-{tahun[-1]} (sampel tiap 3 jam)')

    def _pasut(self):
        arsip = unduh(EOT20, os.path.join(SIMPANAN, 'eot20.zip'))
        folder = os.path.join(SIMPANAN, 'eot20')
        with zipfile.ZipFile(arsip) as luar:
            dalam = luar.extract(next(n for n in luar.namelist() if n.endswith('ocean_tides.zip')), folder)
        with zipfile.ZipFile(dalam) as z:
            nama = [n for n in z.namelist() if n.endswith('.nc') and os.path.basename(n).split('_')[0] in KONSTITUEN_PASUT]
            z.extractall(folder, nama)
        lapis = [pita(os.path.join(folder, n), 'amplitude') for n in nama]
        tunggang = 2 * sum(x[0] for x, _ in lapis) / 100
        data = grid_dari(tunggang, lapis[0][1], 0.125, 'near', isi_kosong=4)
        yield 'PASUT', simpan_grid('PASUT', data, 0.125, 'm',
                                   'EOT20 (DGFI-TUM, 1/8°): tunggang pasang surut maksimum, dua kali jumlah amplitudo M2, '
                                   'S2, K1, dan O1; perairan pesisir yang kosong diisi dari sel terdekat')

    def _muara(self):
        objek = []
        with tempfile.TemporaryDirectory() as d:
            for wilayah in ('au', 'as'):
                arsip = unduh(HYDRORIVERS.format(w=wilayah), os.path.join(SIMPANAN, f'hydrorivers_{wilayah}.zip'))
                hasil = os.path.join(d, f'{wilayah}.geojson')
                subprocess.run([
                    'ogr2ogr', '-f', 'GeoJSON', hasil,
                    f'/vsizip/{arsip}/HydroRIVERS_v10_{wilayah}_shp/HydroRIVERS_v10_{wilayah}.shp', '-spat', *map(str, BATAS), '-sql',
                    f'SELECT HYRIV_ID, UPLAND_SKM, DIS_AV_CMS FROM HydroRIVERS_v10_{wilayah} '
                    f'WHERE NEXT_DOWN = 0 AND ENDORHEIC = 0 AND UPLAND_SKM >= {DAS_MINIMAL_KM2}',
                ], check=True)
                with open(hasil, encoding='utf-8') as f:
                    for fitur in json.load(f)['features']:
                        x, y = fitur['geometry']['coordinates'][-1][:2]
                        a = fitur['properties']
                        objek.append(InfrastrukturPendukung(
                            kategori='MUARA_SUNGAI', kode_lapisan='hydrorivers', geometry=Point(x, y, srid=4326),
                            nama=f"Muara sungai (DAS {a['UPLAND_SKM']:,.0f} km²)".replace(',', '.'),
                            kelas=f"{a['DIS_AV_CMS']:.0f} m³/s", sumber_data='HydroRIVERS',
                            keterangan=f"HydroRIVERS v1.0 #{a['HYRIV_ID']}, debit rata-rata {a['DIS_AV_CMS']:.0f} m³/s",
                        ))
        with transaction.atomic():
            InfrastrukturPendukung.objects.filter(kategori='MUARA_SUNGAI', sumber_data='HydroRIVERS').delete()
            InfrastrukturPendukung.objects.bulk_create(objek, batch_size=500)
        with connection.cursor() as c:
            c.execute(
                'UPDATE inventarisasi_infrastruktur_pendukung i SET provinsi_id = (SELECT p.id FROM inti_provinsi p '
                'WHERE p.geometry IS NOT NULL ORDER BY p.geometry <-> i.geometry LIMIT 1) '
                "WHERE i.sumber_data = 'HydroRIVERS' AND i.provinsi_id IS NULL"
            )
        cache.delete_many(['kriteria:sumber', 'asal-data:terbaru'])
        yield 'MUARA_SUNGAI', len(objek)

    def _abrasi(self):
        berkas = unduh(JRC_PANTAI, os.path.join(SIMPANAN, 'jrc_pantai.nc'))
        d = {n: larik(berkas, n) for n in ('lat', 'lon', 'landtosea', 'seatoland', 'qualityflag', 'firstYear', 'lastYear')}
        acuan = grid_wilayah(RESOLUSI_ABRASI)
        pilih = ((d['qualityflag'] == 1) & (d['lon'] >= BATAS[0]) & (d['lon'] < BATAS[2]) & (d['lat'] > BATAS[1])
                 & (d['lat'] <= BATAS[3]))
        laju = np.maximum(0, d['landtosea'] - d['seatoland']) / np.maximum(1, d['lastYear'] - d['firstYear'])
        indeks = (((BATAS[3] - d['lat'][pilih]) / RESOLUSI_ABRASI).astype(int),
                  ((d['lon'][pilih] - BATAS[0]) / RESOLUSI_ABRASI).astype(int))
        jumlah, banyak = np.zeros((acuan.height, acuan.width)), np.zeros((acuan.height, acuan.width))
        np.add.at(jumlah, indeks, laju[pilih])
        np.add.at(banyak, indeks, 1)
        rerata = np.where(banyak > 0, jumlah / np.maximum(banyak, 1), np.nan)
        tahun = f"{int(np.nanmin(d['firstYear'][pilih]))}-{int(np.nanmax(d['lastYear'][pilih]))}"
        yield 'ABRASI_PANTAI', simpan_grid(
            'ABRASI_PANTAI', grid_dari(rerata, acuan, RESOLUSI_ABRASI, 'near', isi_kosong=3), RESOLUSI_ABRASI, 'm/tahun',
            f'JRC Global Coastal Morphodynamics (Mentaschi dkk., 2018), transek citra Landsat {tahun}: panjang daratan '
            'yang berubah menjadi laut dibagi lama pengamatan, rata-rata per 0,01° (±1,1 km)', tahun)

    def _shannon(self):
        acuan = grid_wilayah(RESOLUSI_SHANNON)
        r = RESOLUSI_SHANNON

        def indeks(sel):
            x, y = BATAS[0] + sel[1] * r, BATAS[3] - (sel[0] + 1) * r
            wkt = f'POLYGON(({x} {y},{x + r} {y},{x + r} {y + r},{x} {y + r},{x} {y}))'
            catatan, total = [], None
            while total is None or len(catatan) < total:
                for coba in range(5):
                    try:
                        j = httpx.get(OBIS, params={'geometry': wkt, 'size': 5000, 'skip': len(catatan)},
                                      headers=KEPALA, timeout=300)
                        j.raise_for_status()
                        j = j.json()
                        break
                    except Exception:
                        if coba == 4:
                            raise
                        time.sleep(10 * (coba + 1))
                total = j['total']
                catatan += j['results']
                if not j['results']:
                    break
            n = np.array([t['records'] for t in catatan if t.get('taxonRank') == 'Species'], dtype=float)
            if len(n) < MINIMAL_SPESIES_SHANNON:
                return np.nan
            p = n / n.sum()
            return float(-(p * np.log(p)).sum())

        sel = [(i, k) for i in range(acuan.height) for k in range(acuan.width)]
        with ThreadPoolExecutor(4) as kerja:
            nilai = list(kerja.map(indeks, sel))
        data = np.array(nilai).reshape(acuan.height, acuan.width)
        yield 'SHANNON', simpan_grid(
            'SHANNON', data, RESOLUSI_SHANNON, '',
            f'OBIS (Ocean Biodiversity Information System): indeks Shannon-Wiener dari jumlah catatan per spesies dalam sel '
            f'0,5°; sel dengan kurang dari {MINIMAL_SPESIES_SHANNON} spesies tercatat dikosongkan')

    def _mangrove(self):
        arsip = unduh(GMW, os.path.join(SIMPANAN, 'gmw_v3_f1996_t2020.zip'))
        acuan = grid_wilayah(RESOLUSI_MANGROVE)
        transform = Affine(RESOLUSI_MANGROVE, 0, BATAS[0], 0, -RESOLUSI_MANGROVE, BATAS[3])
        fraksi = np.zeros((acuan.height, acuan.width), dtype='float32')
        with zipfile.ZipFile(arsip) as z:
            for nama in z.namelist():
                if not nama.endswith('.tif'):
                    continue
                with rasterio.open(f'/vsizip/{arsip}/{nama}') as r:
                    kiri, bawah, kanan, atas = r.bounds
                    if kanan <= BATAS[0] or kiri >= BATAS[2] or atas <= BATAS[1] or bawah >= BATAS[3]:
                        continue
                    sebagian = np.zeros_like(fraksi)
                    reproject((r.read(1) == NILAI_HILANG_GMW).astype('float32'), sebagian, src_transform=r.transform,
                              src_crs=r.crs, dst_transform=transform, dst_crs='EPSG:4326', resampling=Resampling.average)
                    fraksi = np.maximum(fraksi, sebagian)
        eks = (fraksi >= FRAKSI_EKS_MANGROVE).astype('uint8')
        lintang = BATAS[3] - (np.arange(acuan.height) + 0.5) * RESOLUSI_MANGROVE
        luas_sel_ha = (RESOLUSI_MANGROVE * 111320) ** 2 * np.cos(np.radians(lintang))[:, None] / 1e4 * fraksi
        label = rasterize(((g, i) for i, (g, _) in enumerate(shapes(eks, mask=eks.astype(bool), transform=transform), 1)),
                          out_shape=eks.shape, transform=transform, fill=0, dtype='int32')
        luas = np.bincount(label.ravel(), weights=luas_sel_ha.ravel())
        luas[0] = 0
        sumber = ('Global Mangrove Watch v3.0 (Bunting dkk., 2022), perubahan 1996-2020: mangrove yang hilang, '
                  f'sel 0,005° dihitung eks-mangrove bila sedikitnya {FRAKSI_EKS_MANGROVE:.0%} luasnya hilang')
        yield 'EKS_MANGROVE', simpan_grid('EKS_MANGROVE', eks.astype('float32'), RESOLUSI_MANGROVE, 'ada/tidak', sumber)
        yield 'LUAS_EKS_MANGROVE', simpan_grid('LUAS_EKS_MANGROVE', luas[label].astype('float32'), RESOLUSI_MANGROVE, 'ha',
                                               sumber + '; nilai = luas hamparan kontigu tempat sel berada')
