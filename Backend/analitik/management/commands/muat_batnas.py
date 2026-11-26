import glob
import json
import math
import os

import numpy as np
import rasterio
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from rasterio.transform import from_origin
from rasterio.warp import Resampling, reproject, transform_bounds

from analitik.management.commands.muat_berkas_raster import gdal_raster, poligon
from analitik.management.commands.muat_raster import BATAS
from analitik.models import RasterOseanografi

RESOLUSI = 1 / 600
PETAK = 0.5
CAKUPAN_MINIMUM = 0.9
SUMBER = 'BATNAS (Batimetri Nasional) Badan Informasi Geospasial, 6 detik busur (±180 m), datum MSL'


def kemiringan(dalam, lintang_atas):
    lintang = lintang_atas - (np.arange(dalam.shape[0]) + 0.5) * RESOLUSI
    dx = RESOLUSI * 111320 * np.cos(np.radians(lintang))[:, None]
    gy, gx = np.gradient(np.nan_to_num(dalam, nan=0.0))
    miring = np.degrees(np.arctan(np.hypot(gx / dx, gy / (RESOLUSI * 110574))))
    return np.where(np.isnan(dalam), np.nan, miring)


def sel_lama(batas):
    with connection.cursor() as c:
        c.execute(
            """
            SELECT COALESCE(SUM(ST_Count(ST_Clip(rast, g, true)) * (ST_ScaleX(rast) / %s) ^ 2), 0)
            FROM analitik_raster_oseanografi, (SELECT ST_MakeEnvelope(%s, %s, %s, %s, 4326) AS g) t
            WHERE parameter = 'KEDALAMAN' AND cakupan && g
            """,
            [RESOLUSI, *batas],
        )
        return float(c.fetchone()[0])


def baca_kotak(sumber, kotak):
    dalam = np.full((round(PETAK / RESOLUSI),) * 2, np.nan)
    for berkas, crs, (x0, y0, x1, y1) in sumber:
        if x0 < kotak[2] and x1 > kotak[0] and y0 < kotak[3] and y1 > kotak[1]:
            baru = np.full(dalam.shape, np.nan, dtype='float32')
            with rasterio.open(berkas) as r:
                reproject(rasterio.band(r, 1), baru, src_crs=crs, dst_crs='EPSG:4326', dst_nodata=np.nan,
                          dst_transform=from_origin(kotak[0], kotak[3], RESOLUSI, RESOLUSI), resampling=Resampling.average)
            dalam = np.where(np.isnan(dalam), baru, dalam)
    return np.where(dalam < 0, np.round(dalam), np.nan)


def sistem_koordinat(r):
    if r.crs is not None:
        return r.crs
    b = r.bounds
    if -180 <= b.left < b.right <= 180 and -90 <= b.bottom < b.top <= 90 and abs(r.res[0] - RESOLUSI) < 1e-9:
        return 'EPSG:4326'
    return None


def muat(berkas, batas=BATAS):
    sumber = []
    for b in berkas:
        with rasterio.open(b) as r:
            crs = sistem_koordinat(r)
            if crs is None:
                raise CommandError(f'{os.path.basename(b)} tidak memiliki sistem koordinat.')
            sumber.append((b, crs, transform_bounds(crs, 'EPSG:4326', *r.bounds)))
    harapan = sel_lama(batas)
    petak = terbaca = 0
    with transaction.atomic():
        RasterOseanografi.objects.filter(parameter__in=['KEDALAMAN', 'KEMIRINGAN_DASAR']).delete()
        for i in range(math.floor((batas[2] - batas[0]) / PETAK)):
            for j in range(math.floor((batas[3] - batas[1]) / PETAK)):
                kotak = (batas[0] + i * PETAK, batas[1] + j * PETAK, batas[0] + (i + 1) * PETAK, batas[1] + (j + 1) * PETAK)
                dalam = baca_kotak(sumber, kotak)
                n = int((~np.isnan(dalam)).sum())
                if not n:
                    continue
                petak += 1
                terbaca += n
                for kode, data, satuan, asal in (
                        ('KEDALAMAN', dalam, 'm', SUMBER),
                        ('KEMIRINGAN_DASAR', kemiringan(dalam, kotak[3]), '°', f'Dihitung dari {SUMBER}')):
                    RasterOseanografi.objects.create(parameter=kode, rast=gdal_raster(kotak, data, RESOLUSI),
                                                     cakupan=poligon(kotak), satuan=satuan, sumber=asal)
        if harapan and terbaca < CAKUPAN_MINIMUM * harapan:
            raise CommandError(f'BATNAS baru mencakup {terbaca / harapan:.0%} perairan yang ada sekarang; unduh semua '
                               'petak BATNAS lebih dulu agar kedalaman di wilayah lain tidak hilang.')
    cache.delete_many(['raster-tersedia', 'kriteria:sumber'])
    return petak, terbaca, harapan


class Command(BaseCommand):
    help = 'Ganti kedalaman dan kemiringan dasar laut dengan BATNAS BIG dari folder berisi petak GeoTIFF.'

    def add_arguments(self, parser):
        parser.add_argument('--folder', required=True)

    def handle(self, *args, **o):
        from analitik.tasks import jadwalkan_hitung_ulang

        berkas = sorted(glob.glob(os.path.join(o['folder'], '**', '*.tif'), recursive=True))
        if not berkas:
            raise CommandError('Folder tidak berisi petak BATNAS (.tif).')
        n, terbaca, harapan = muat(berkas)
        jadwalkan_hitung_ulang(lokasi=[], skor=True)
        self.stdout.write(self.style.SUCCESS(
            f'BATNAS dimuat: {len(berkas)} berkas, {n} petak, {terbaca:,} sel laut'
            + (f' ({terbaca / harapan:.0%} dari cakupan lama)' if harapan else '') + '; hitung ulang dijadwalkan'))
        return json.dumps({'dimuat': True})
