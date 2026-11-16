import csv
import gzip
import io
import json
import sys
import time
import urllib.request

import numpy as np
import shapely
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone
from psycopg2.extras import execute_values
from shapely import STRtree, wkb

INDEKS = 'https://openbuildings-public-dot-gweb-research.uw.r.appspot.com/public/tiles.geojson'
SUMBER = 'Google Open Buildings'
KELOMPOK = 100_000
SISIP = '''
INSERT INTO inventarisasi_bangunan_eksisting (kode, jenis, nama, sumber_data, geometry, updated_at)
SELECT v.kode, 'BANGUNAN', '', 'Google Open Buildings', ST_Multi(ST_GeomFromText(v.wkt, 4326)), now()
FROM (VALUES %s) AS v(kode, wkt)
ON CONFLICT (kode) DO UPDATE SET geometry = EXCLUDED.geometry, sumber_data = EXCLUDED.sumber_data, updated_at = now()
'''

csv.field_size_limit(sys.maxsize)


class Command(BaseCommand):
    help = ('Tarik jejak bangunan Google Open Buildings v3 (CC BY-4.0) yang berada di zona darat pesisir Pola Ruang RTRW, '
            'sebagai pelengkap data bangunan OpenStreetMap untuk saringan lokasi potensial dan analisis area.')

    def add_arguments(self, parser):
        parser.add_argument('--kepercayaan', type=float, default=0.75, help='Ambang confidence deteksi bangunan')
        parser.add_argument('--petak', help='Kode petak S2 dipisah koma; bawaan semua petak yang menyentuh zona darat')

    def handle(self, *args, **opsi):
        mulai = timezone.now()
        zona = self._zona_darat()
        pohon = STRtree(zona)
        semua = shapely.union_all(shapely.envelope(zona))
        with urllib.request.urlopen(INDEKS, timeout=120) as r:
            indeks = json.load(r)['features']
        petak = [f['properties'] for f in indeks if shapely.from_geojson(json.dumps(f['geometry'])).intersects(semua)]
        if opsi['petak']:
            pilih = set(opsi['petak'].split(','))
            petak = [p for p in petak if p['tile_id'] in pilih]
        self.stdout.write(f'{len(zona)} zona darat, {len(petak)} petak ({sum(float(p["size_mb"]) for p in petak):.0f} MB)')
        total, lengkap = 0, True
        for p in sorted(petak, key=lambda p: float(p['size_mb'])):
            for coba in range(1, 4):
                try:
                    total += self._petak(p, pohon, opsi['kepercayaan'])
                    break
                except OSError as e:
                    self.stdout.write(self.style.WARNING(f'  petak {p["tile_id"]} gagal ({e}), percobaan {coba}'))
                    time.sleep(30)
            else:
                lengkap = False
        if lengkap and not opsi['petak']:
            with connection.cursor() as c:
                c.execute('DELETE FROM inventarisasi_bangunan_eksisting WHERE sumber_data = %s AND updated_at < %s',
                          [SUMBER, mulai])
                self.stdout.write(f'Data lama dihapus: {c.rowcount}')
        self.stdout.write(self.style.SUCCESS(f'Tersimpan {total} bangunan dari {len(petak)} petak'
                                             f'{"" if lengkap else " (ada petak gagal, data lama dipertahankan)"}'))

    def _zona_darat(self):
        with connection.cursor() as c:
            c.execute("SELECT ST_AsBinary(geometry) FROM inventarisasi_zonasi_ruang_laut WHERE ranah = 'DARAT'")
            return np.array([wkb.loads(bytes(r[0])) for r in c.fetchall()])

    def _petak(self, p, pohon, ambang):
        awal = time.monotonic()
        dibaca = disimpan = 0
        kumpulan = []
        with urllib.request.urlopen(p['tile_url'], timeout=300) as r:
            baris = csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=r), encoding='utf-8'))
            for b in baris:
                dibaca += 1
                if float(b['confidence']) >= ambang:
                    kumpulan.append(b)
                if len(kumpulan) >= KELOMPOK:
                    disimpan += self._simpan(kumpulan, pohon)
                    kumpulan = []
            disimpan += self._simpan(kumpulan, pohon)
        self.stdout.write(f'  petak {p["tile_id"]}: {dibaca} dibaca, {disimpan} di zona darat ({time.monotonic() - awal:.0f} dtk)')
        return disimpan

    def _simpan(self, kumpulan, pohon):
        if not kumpulan:
            return 0
        titik = shapely.points([float(b['longitude']) for b in kumpulan], [float(b['latitude']) for b in kumpulan])
        masuk = np.unique(pohon.query(titik, predicate='intersects')[0])
        if not len(masuk):
            return 0
        with connection.cursor() as c:
            execute_values(c, SISIP, [(f'gob/{kumpulan[i]["full_plus_code"]}', kumpulan[i]['geometry']) for i in masuk],
                           page_size=5000)
        return len(masuk)
