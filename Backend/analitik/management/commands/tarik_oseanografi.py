import csv
import io
import math
import time
from datetime import datetime, timedelta, timezone

import httpx
import numpy as np
from django.contrib.gis.gdal import GDALRaster
from django.contrib.gis.geos import Polygon
from django.core.management.base import BaseCommand
from django.db import transaction

from analitik.models import RasterOseanografi
from analitik.services.konstanta import BULAN

ERDDAP = 'https://upwell.pfeg.noaa.gov/erddap/griddap'
COASTWATCH = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap'
BATAS = (94.0, -11.0, 142.0, 7.0)
KOSONG = -9999.0


def _rentang_tahun(langkah):
    akhir = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    awal = akhir - timedelta(days=365)
    return f'[({awal:%Y-%m-%dT%H:%M:%SZ}):{langkah}:({akhir:%Y-%m-%dT%H:%M:%SZ})]'


def _tanggal(iso):
    t = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    return f'{t.day} {BULAN[t.month - 1]} {t.year}'


PARAMETER = {
    'KEDALAMAN': {
        'dataset': 'etopo180', 'variabel': 'altitude', 'satuan': 'm', 'petak': 6.0, 'resolusi': 1 / 60,
        'sumber': 'NOAA ETOPO1 (1 menit busur, rilis 2009) via ERDDAP',
    },
    'SUHU': {
        'server': COASTWATCH, 'dataset': 'NOAA_DHW_monthly', 'variabel': 'sea_surface_temperature', 'satuan': '°C',
        'waktu': '[last-11:1:last]', 'resolusi': 0.05, 'langkah': 2, 'lintang_turun': True,
        'sumber': 'NOAA Coral Reef Watch bulanan (dataset yang ditayangkan Sidako KKP), 12 bulan terakhir, grid 0,1°',
    },
    'ANOMALI_SUHU': {
        'server': COASTWATCH, 'dataset': 'NOAA_DHW_monthly', 'variabel': 'sea_surface_temperature_anomaly', 'satuan': '°C',
        'waktu': '[last-11:1:last]', 'resolusi': 0.05, 'langkah': 2, 'lintang_turun': True,
        'sumber': 'NOAA Coral Reef Watch bulanan (dataset yang ditayangkan Sidako KKP), selisih dari rata-rata jangka panjang, '
                  '12 bulan terakhir, grid 0,1°',
    },
    'KLOROFIL': {
        'dataset': 'erdMH1chlamday', 'variabel': 'chlorophyll', 'satuan': 'mg/m³', 'waktu': '[last-11:1:last]',
        'resolusi': 1 / 24, 'langkah': 3,
        'sumber': 'NASA MODIS-Aqua klorofil-a bulanan via NOAA ERDDAP, 12 bulan terakhir yang tersedia',
    },
    'GELOMBANG': {
        'dataset': 'NWW3_Global_Best', 'variabel': 'Thgt', 'satuan': 'm', 'waktu_tahunan': 40,
        'tambahan': '[(0.0)]', 'resolusi': 0.5,
        'sumber': 'NOAA WaveWatch III (0,5°), tinggi gelombang signifikan, sampel tiap 40 jam selama 12 bulan',
    },
}


def _unduh(url, percobaan=6):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(url, timeout=300.0, follow_redirects=True)
            if r.status_code == 404 and 'start' in r.text.lower():
                return None
            r.raise_for_status()
            return r.text
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    raise galat


def _grid(teks, variabel):
    baca = csv.reader(io.StringIO(teks))
    kepala = next(baca)
    next(baca)
    i_lat, i_lon, i_nilai = kepala.index('latitude'), kepala.index('longitude'), kepala.index(variabel)
    i_waktu = kepala.index('time') if 'time' in kepala else None
    sel, waktu = {}, set()
    for b in baca:
        if i_waktu is not None:
            waktu.add(b[i_waktu])
        try:
            v = float(b[i_nilai])
        except ValueError:
            continue
        if math.isnan(v):
            continue
        sel.setdefault((float(b[i_lat]), float(b[i_lon])), []).append(v)
    periode = f'{_tanggal(min(waktu))} - {_tanggal(max(waktu))} ({len(waktu)} sampel)' if waktu else ''
    return sel, periode


def _raster(sel, resolusi, pita, kosong_bila=None):
    lintang = sorted({k[0] for k in sel}, reverse=True)
    bujur = sorted({k[1] for k in sel})
    if not lintang:
        return None, None
    y0, x0 = lintang[0], bujur[0]
    tinggi = round((lintang[0] - lintang[-1]) / resolusi) + 1
    lebar = round((bujur[-1] - bujur[0]) / resolusi) + 1
    data = np.full((len(pita), tinggi, lebar), KOSONG, dtype='float32')
    for (lat, lon), nilai in sel.items():
        if kosong_bila and kosong_bila(nilai):
            continue
        r, k = round((y0 - lat) / resolusi), round((lon - x0) / resolusi)
        arr = np.asarray(nilai)
        for i, fungsi in enumerate(pita):
            data[i, r, k] = fungsi(arr)
    kiri, atas = x0 - resolusi / 2, y0 + resolusi / 2
    rast = GDALRaster({
        'srid': 4326, 'width': lebar, 'height': tinggi, 'origin': [kiri, atas], 'scale': [resolusi, -resolusi],
        'datatype': 6, 'bands': [{'data': data[i].ravel(), 'nodata_value': KOSONG} for i in range(len(pita))],
    })
    cakupan = Polygon.from_bbox((kiri, atas - tinggi * resolusi, kiri + lebar * resolusi, atas))
    cakupan.srid = 4326
    return rast, cakupan


class Command(BaseCommand):
    help = ('Tarik kondisi oseanografi (kedalaman, suhu permukaan dan anomalinya, klorofil-a, gelombang) dari NOAA '
            'ERDDAP ke raster lokal.')

    def add_arguments(self, parser):
        parser.add_argument('--parameter', choices=list(PARAMETER), action='append',
                            help='Hanya parameter ini (boleh berulang). Bawaan: semua.')

    def handle(self, *args, **opsi):
        for kode in opsi['parameter'] or list(PARAMETER):
            p = PARAMETER[kode]
            mulai = time.time()
            jumlah = self._kedalaman(p) if kode == 'KEDALAMAN' else self._deret(kode, p)
            self.stdout.write(self.style.SUCCESS(f'{kode}: {jumlah} petak raster ({time.time() - mulai:.0f} dtk)'))

    def _simpan(self, kode, p, rast, cakupan, periode):
        RasterOseanografi.objects.update_or_create(
            parameter=kode, cakupan=cakupan,
            defaults={'rast': rast, 'satuan': p['satuan'], 'periode': periode, 'sumber': p['sumber']},
        )

    def _kedalaman(self, p):
        res = p['resolusi']
        jumlah = 0
        x = BATAS[0]
        while x < BATAS[2]:
            y = BATAS[1]
            while y < BATAS[3]:
                url = (f"{ERDDAP}/{p['dataset']}.csv?{p['variabel']}[({y}):({y + p['petak'] - res})]"
                       f"[({x}):({x + p['petak'] - res})]")
                rast, cakupan = _raster(_grid(_unduh(url), p['variabel'])[0], res, [np.mean], kosong_bila=lambda v: v[0] >= 0)
                if rast is not None:
                    self._simpan('KEDALAMAN', p, rast, cakupan, '')
                    jumlah += 1
                self.stdout.write(f'  petak {x:.0f}°BT {y:.0f}°LU')
                y += p['petak']
            x += p['petak']
        return jumlah

    def _deret(self, kode, p):
        waktu = _rentang_tahun(p['waktu_tahunan']) if 'waktu_tahunan' in p else p['waktu']
        langkah = p.get('langkah', 1)
        x0, y0, x1, y1 = BATAS
        teks = None
        urutan = [f'[({y0}):{langkah}:({y1})]', f'[({y1}):{langkah}:({y0})]']
        for lat in reversed(urutan) if p.get('lintang_turun') else urutan:
            url = (f"{p.get('server', ERDDAP)}/{p['dataset']}.csv?{p['variabel']}{waktu}{p.get('tambahan', '')}{lat}"
                   f"[({x0}):{langkah}:({x1})]")
            teks = _unduh(url)
            if teks:
                break
        sel, periode = _grid(teks, p['variabel'])
        rast, cakupan = _raster(sel, p['resolusi'] * langkah, [np.mean, np.min, np.max])
        with transaction.atomic():
            RasterOseanografi.objects.filter(parameter=kode).delete()
            self._simpan(kode, p, rast, cakupan, periode)
        return 1
