import os
import subprocess
import tempfile
from types import SimpleNamespace

import numpy as np
from django.contrib.gis.gdal import GDALRaster
from django.contrib.gis.geos import Polygon
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from rasterio.fill import fillnodata

from analitik.models import RasterOseanografi

BATAS = (94.0, -11.0, 142.0, 7.0)
PETAK = 6.0
KOSONG = -9999.0


def warp(sumber, tujuan, resolusi, metode='average', tambahan=()):
    subprocess.run(
        ['gdalwarp', '-q', '-overwrite', '-t_srs', 'EPSG:4326', '-te', *map(str, BATAS), '-tr', str(resolusi),
         str(resolusi), '-r', metode, '-ot', 'Float32', '-dstnodata', str(KOSONG), '-co', 'COMPRESS=DEFLATE',
         *tambahan, sumber, tujuan],
        check=True,
    )


def warp_baca(sumber, resolusi, metode='average', isi_kosong=0, tambahan=(), hanya_laut=False):
    with tempfile.TemporaryDirectory() as d:
        tif = os.path.join(d, 'raster.tif')
        warp(sumber, tif, resolusi, metode, tambahan)
        data = baca_grid(tif)
    if isi_kosong:
        acuan = SimpleNamespace(origin=(BATAS[0], BATAS[3]), scale=(resolusi, -resolusi))
        data = isi_celah(data, acuan, isi_kosong, hanya_laut)
    return data


def isi_celah(data, acuan, jarak_piksel, hanya_laut=False):
    ada = ~np.isnan(data)
    terisi = fillnodata(np.where(ada, data, KOSONG).astype('float32'), mask=ada.astype('uint8'),
                        max_search_distance=jarak_piksel)
    hasil = np.where(ada, data, np.where(terisi == KOSONG, np.nan, terisi))
    if hanya_laut:
        hasil[~ada & ~perairan(acuan, data.shape)] = np.nan
    return hasil


def perairan(acuan, bentuk):
    laut = np.zeros(bentuk, dtype=bool)
    for r in RasterOseanografi.objects.filter(parameter='KEDALAMAN').only('rast'):
        g, pita = r.rast, r.rast.bands[0]
        baris, kolom = np.nonzero(pita.data().reshape(g.height, g.width) != pita.nodata_value)
        i = np.floor((g.origin.y + (baris + 0.5) * g.scale.y - acuan.origin[1]) / acuan.scale[1]).astype(int)
        j = np.floor((g.origin.x + (kolom + 0.5) * g.scale.x - acuan.origin[0]) / acuan.scale[0]).astype(int)
        di = (i >= 0) & (i < bentuk[0]) & (j >= 0) & (j < bentuk[1])
        laut[i[di], j[di]] = True
    if not laut.any():
        raise CommandError('Raster KEDALAMAN belum dimuat; jalankan tarik_data_publik --sumber BATIMETRI lebih dulu.')
    return laut


def catatan_isi(jarak_piksel, resolusi):
    return f'; perairan dekat pantai tanpa data diisi dari sel terdekat sejauh ±{jarak_piksel * resolusi * 111:.0f} km'


def simpan_grid(kode, data, resolusi, satuan, sumber, periode=''):
    data = np.where(np.isnan(data), KOSONG, data).astype('float32')
    tinggi, lebar = data.shape
    n = round(PETAK / resolusi)
    jumlah = 0
    with transaction.atomic():
        RasterOseanografi.objects.filter(parameter=kode).delete()
        for r0 in range(0, tinggi, n):
            for k0 in range(0, lebar, n):
                petak = data[r0:r0 + n, k0:k0 + n]
                if (petak == KOSONG).all():
                    continue
                kiri, atas = BATAS[0] + k0 * resolusi, BATAS[3] - r0 * resolusi
                rast = GDALRaster({
                    'srid': 4326, 'width': petak.shape[1], 'height': petak.shape[0], 'origin': [kiri, atas],
                    'scale': [resolusi, -resolusi], 'datatype': 6,
                    'bands': [{'data': petak.ravel(), 'nodata_value': KOSONG}],
                })
                cakupan = Polygon.from_bbox((kiri, atas - petak.shape[0] * resolusi, kiri + petak.shape[1] * resolusi, atas))
                cakupan.srid = 4326
                RasterOseanografi.objects.create(parameter=kode, rast=rast, cakupan=cakupan, satuan=satuan,
                                                 periode=periode, sumber=sumber)
                jumlah += 1
    cache.delete_many(['raster-tersedia', 'kriteria:sumber'])
    return jumlah


def baca_grid(berkas):
    r = GDALRaster(berkas)
    pita = r.bands[0]
    data = pita.data().reshape(r.height, r.width).astype('float64')
    if pita.nodata_value is not None:
        data[data == pita.nodata_value] = np.nan
    return data


class Command(BaseCommand):
    help = ('Muat raster dari sumber apa pun yang dapat dibaca GDAL (berkas, /vsicurl/ URL, VRT, netCDF) ke basis data '
            'sebagai petak 6° di wilayah Indonesia.')

    def add_arguments(self, parser):
        parser.add_argument('--kode', required=True, choices=[k for k, _ in RasterOseanografi.PARAMETER_CHOICES])
        parser.add_argument('--sumber', required=True, help='Jalur atau URL GDAL')
        parser.add_argument('--resolusi', type=float, required=True, help='Derajat per piksel')
        parser.add_argument('--satuan', required=True)
        parser.add_argument('--keterangan', required=True, help='Teks sumber data untuk laporan')
        parser.add_argument('--periode', default='')
        parser.add_argument('--metode', default='average', help='Metode resampling gdalwarp')
        parser.add_argument('--skala', type=float, default=1.0)
        parser.add_argument('--tambah', type=float, default=0.0)
        parser.add_argument('--isi-kosong', type=int, default=0,
                            help='Isi piksel kosong dari tetangga terdekat sejauh N piksel (mis. salinitas ke darat)')

    def handle(self, *args, **o):
        data = warp_baca(o['sumber'], o['resolusi'], o['metode'], o['isi_kosong']) * o['skala'] + o['tambah']
        jumlah = simpan_grid(o['kode'], data, o['resolusi'], o['satuan'], o['keterangan'], o['periode'])
        terisi = np.count_nonzero(~np.isnan(data))
        self.stdout.write(self.style.SUCCESS(
            f"{o['kode']}: {jumlah} petak, {terisi} piksel berisi, rentang {np.nanmin(data):.3f}–{np.nanmax(data):.3f}"))
