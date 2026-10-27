import csv
import io
import re
import time
import zipfile
from datetime import date

import httpx
import numpy as np
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from analitik.management.commands.muat_raster import BATAS, simpan_grid
from analitik.services.konstanta import BULAN

API = 'https://gateway.api.globalfishingwatch.org/v3/4wings'
DATASET = 'public-global-fishing-effort:latest'
RESOLUSI = 0.1
TUNGGU_DETIK = 30
TUNGGU_MAKS = 40
JAM = re.compile(r'[T ](\d{1,2})')
WILAYAH = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {}, 'geometry': {
    'type': 'Polygon', 'coordinates': [[[BATAS[0], BATAS[1]], [BATAS[2], BATAS[1]], [BATAS[2], BATAS[3]],
                                        [BATAS[0], BATAS[3]], [BATAS[0], BATAS[1]]]]}}]}
SUMBER = ('Global Fishing Watch, AIS apparent fishing effort ({versi}), jam penangkapan per sel 0,1° selama 12 bulan, '
          'dipisah siang (06.00–18.00) dan malam menurut waktu matahari setempat; kapal tanpa AIS tidak terlihat. '
          'Powered by Global Fishing Watch')


def bulan_terakhir(hari_ini, jumlah=12):
    tahun, bulan = hari_ini.year, hari_ini.month
    hasil = []
    for _ in range(jumlah):
        akhir = date(tahun, bulan, 1)
        tahun, bulan = (tahun - 1, 12) if bulan == 1 else (tahun, bulan - 1)
        hasil.append((date(tahun, bulan, 1), akhir))
    return hasil[::-1]


def _berjalan(r):
    return r.headers.get('content-type', '').startswith('application/json') and r.json().get('status') == 'running'


def _laporan(klien, awal, akhir):
    params = {'datasets[0]': DATASET, 'format': 'CSV', 'spatial-resolution': 'LOW',
              'temporal-resolution': 'HOURLY', 'date-range': f'{awal},{akhir}'}
    for _ in range(TUNGGU_MAKS):
        r = klien.post(f'{API}/report', params=params, json={'geojson': WILAYAH})
        if r.status_code != 429:
            break
        time.sleep(TUNGGU_DETIK)
    for _ in range(TUNGGU_MAKS):
        if r.status_code != 524 and not _berjalan(r):
            break
        time.sleep(TUNGGU_DETIK)
        r = klien.get(f'{API}/last-report')
    if r.status_code != 200 or _berjalan(r):
        raise CommandError(f'GFW {awal}: status {r.status_code} {r.text[:200]}')
    return r


def _baris(isi):
    with zipfile.ZipFile(io.BytesIO(isi)) as z:
        nama = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        with z.open(nama) as f:
            yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8'))


def tambah_jam(grid, baris):
    _, tinggi, lebar = grid.shape
    for b in baris:
        lat, lon, jam = float(b['lat']), float(b['lon']), float(b['hours'])
        r = round((BATAS[3] - lat) / RESOLUSI) - 1
        k = round((lon - BATAS[0]) / RESOLUSI)
        if 0 <= r < tinggi and 0 <= k < lebar:
            lokal = (int(JAM.search(b['date']).group(1)) + 0.5 + (lon + RESOLUSI / 2) / 15) % 24
            grid[0 if 6 <= lokal < 18 else 1, r, k] += jam


def tarik(klien, hari_ini):
    bulan = bulan_terakhir(hari_ini)
    grid = np.zeros((2, round((BATAS[3] - BATAS[1]) / RESOLUSI), round((BATAS[2] - BATAS[0]) / RESOLUSI)))
    versi = DATASET
    for awal, akhir in bulan:
        r = _laporan(klien, awal, akhir)
        versi = r.headers.get('x-datasets') or versi
        tambah_jam(grid, _baris(r.content))
    if not grid.any():
        raise CommandError('GFW tidak mengembalikan jam penangkapan; raster lama dipertahankan.')
    grid[grid <= 0] = np.nan
    (a, _), (b, _) = bulan[0], bulan[-1]
    periode = f'{BULAN[a.month - 1]} {a.year} – {BULAN[b.month - 1]} {b.year} (12 bulan)'
    sumber = SUMBER.format(versi=versi)
    with transaction.atomic():
        return {kode: simpan_grid(kode, data, RESOLUSI, 'jam/tahun', sumber, periode)
                for kode, data in (('TANGKAP_SIANG', grid[0]), ('TANGKAP_MALAM', grid[1]))}


class Command(BaseCommand):
    help = ('Tarik jam penangkapan ikan kapal berpelacak AIS 12 bulan terakhir dari Global Fishing Watch, dipisah '
            'siang dan malam waktu setempat, ke raster lokal. Butuh GFW_TOKEN di .env.')

    def handle(self, *args, **opsi):
        if not settings.GFW_TOKEN:
            raise CommandError('GFW_TOKEN belum diisi di .env (token gratis: globalfishingwatch.org/our-apis/tokens).')
        mulai = time.time()
        with httpx.Client(headers={'Authorization': f'Bearer {settings.GFW_TOKEN}'}, timeout=180) as klien:
            petak = tarik(klien, date.today())
        self.stdout.write(self.style.SUCCESS(f'{petak} ({time.time() - mulai:.0f} dtk)'))
