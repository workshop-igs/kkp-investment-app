import json
import tempfile
import time

import httpx
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from inti.models import DesaKelurahan, Kecamatan, Provinsi
from inventarisasi.management.commands._geometri import jadikan_multipolygon

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAPISAN_KECAMATAN = 'demo:Batas_Kecamatan_Indonesia_2023'
BIG_DESA = ('https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KelDesa_10K/'
            'MapServer/0/query')
HALAMAN_KECAMATAN = 500
HALAMAN_DESA = 200
JENIS_DESA = {1: 'Desa', 2: 'Kelurahan'}


def _json(metode, url, percobaan=4, **kw):
    for ke in range(percobaan):
        try:
            r = httpx.request(metode, url, timeout=300.0, **kw)
            r.raise_for_status()
            data = r.json()
            if 'error' in data:
                raise ValueError(data['error'].get('message'))
            return data
        except (httpx.HTTPError, ValueError):
            if ke == percobaan - 1:
                raise
            time.sleep(2 ** (ke + 1))


class Command(BaseCommand):
    help = 'Tarik batas kecamatan (Portal Satu Data KKP) dan desa/kelurahan (Badan Informasi Geospasial).'

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', help='Kode provinsi, mis. 52. Tanpa ini seluruh Indonesia.')
        parser.add_argument('--hanya', choices=['kecamatan', 'desa'])

    def handle(self, *args, **opsi):
        self.provinsi = dict(Provinsi.objects.values_list('kode_bps', 'id'))
        kode = str(opsi['provinsi']).zfill(2) if opsi['provinsi'] else ''
        if kode and kode not in self.provinsi:
            raise CommandError(f'Provinsi {kode} tidak dikenal.')
        mulai = time.time()
        if opsi['hanya'] != 'desa':
            self._kecamatan(kode)
        if opsi['hanya'] != 'kecamatan':
            self._desa(kode)
        self._kaitkan()
        self.stdout.write(self.style.SUCCESS(
            f'Selesai dalam {time.time() - mulai:.0f} dtk: {Kecamatan.objects.count()} kecamatan, '
            f'{DesaKelurahan.objects.count()} desa/kelurahan.'
        ))

    def _id_provinsi(self, kode, geom):
        if kode in self.provinsi:
            return self.provinsi[kode]
        return Provinsi.objects.filter(geometry__intersects=geom.point_on_surface).values_list('id', flat=True).first()

    def _kecamatan(self, kode):
        saring = {'CQL_FILTER': f"KDCPUM LIKE '{kode}.%'"} if kode else {}
        baris, awal = [], 0
        while True:
            fitur = _json('GET', WFS, params={
                'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': LAPISAN_KECAMATAN,
                'outputFormat': 'application/json', 'count': HALAMAN_KECAMATAN, 'startIndex': awal, **saring,
            }).get('features') or []
            for f in fitur:
                p = f.get('properties') or {}
                nama = (p.get('WADMKC') or '').strip()
                geom = jadikan_multipolygon(f.get('geometry'))
                if not nama or geom is None:
                    continue
                kc = (p.get('KDCPUM') or '').strip()
                prov = self._id_provinsi(kc[:2], geom)
                if prov:
                    baris.append(Kecamatan(provinsi_id=prov, kode=kc, nama=nama[:100], geometry=geom))
            awal += len(fitur)
            self.stdout.write(f'  kecamatan: {awal} dibaca')
            if len(fitur) < HALAMAN_KECAMATAN:
                break
        if not baris:
            raise CommandError('Tidak ada kecamatan terbaca; data lama tidak diubah.')
        with transaction.atomic():
            (Kecamatan.objects.filter(provinsi_id=self.provinsi[kode]) if kode else Kecamatan.objects.all()).delete()
            Kecamatan.objects.bulk_create(baris, batch_size=500)
        self.stdout.write(f'  {len(baris)} kecamatan tersimpan')

    def _desa(self, kode):
        ids = sorted(_json('POST', BIG_DESA, data={
            'where': f"KDPPUM='{kode}'" if kode else '1=1', 'returnIdsOnly': 'true', 'f': 'json',
        }).get('objectIds') or [])
        self.stdout.write(f'  desa/kelurahan: {len(ids)} di sumber')
        with tempfile.TemporaryFile('w+', encoding='utf-8') as berkas:
            terbaca = 0
            for i in range(0, len(ids), HALAMAN_DESA):
                data = _json('POST', BIG_DESA, data={
                    'objectIds': ','.join(map(str, ids[i:i + HALAMAN_DESA])),
                    'outFields': 'KDEPUM,WADMKD,TIPADM,KDPPUM', 'returnGeometry': 'true', 'outSR': 4326,
                    'maxAllowableOffset': 0.0001, 'geometryPrecision': 6, 'f': 'geojson',
                })
                for f in data.get('features') or []:
                    p = f.get('properties') or {}
                    if (p.get('WADMKD') or '').strip() and f.get('geometry'):
                        berkas.write(json.dumps({'p': p, 'g': f['geometry']}) + '\n')
                        terbaca += 1
                if (i // HALAMAN_DESA) % 25 == 0 or i + HALAMAN_DESA >= len(ids):
                    self.stdout.write(f'  desa/kelurahan: {min(i + HALAMAN_DESA, len(ids))} diunduh')
            if not terbaca:
                raise CommandError('Tidak ada desa/kelurahan terbaca; data lama tidak diubah.')
            berkas.seek(0)
            tersimpan = 0
            with transaction.atomic():
                (DesaKelurahan.objects.filter(provinsi_id=self.provinsi[kode]) if kode
                 else DesaKelurahan.objects.all()).delete()
                kumpulan = []
                for teks in berkas:
                    d = json.loads(teks)
                    p, geom = d['p'], jadikan_multipolygon(d['g'])
                    if geom is None:
                        continue
                    prov = self._id_provinsi(str(p.get('KDPPUM') or '').strip(), geom)
                    if not prov:
                        continue
                    kumpulan.append(DesaKelurahan(
                        provinsi_id=prov, kode=(p.get('KDEPUM') or '').strip(), nama=p['WADMKD'].strip()[:100],
                        jenis=JENIS_DESA.get(p.get('TIPADM'), 'Desa'), geometry=geom,
                    ))
                    if len(kumpulan) == 1000:
                        DesaKelurahan.objects.bulk_create(kumpulan)
                        tersimpan += len(kumpulan)
                        kumpulan = []
                DesaKelurahan.objects.bulk_create(kumpulan)
                tersimpan += len(kumpulan)
        self.stdout.write(f'  {tersimpan} desa/kelurahan tersimpan')

    def _kaitkan(self):
        with connection.cursor() as c:
            for tabel in ('inti_kecamatan', 'inti_desa_kelurahan'):
                c.execute(f'UPDATE {tabel} SET luas_ha = ST_Area(geometry::geography) / 10000 WHERE luas_ha = 0')
            c.execute("""
                UPDATE inti_kecamatan k SET kabupaten_id = kb.id FROM inti_kabupaten_kota kb
                WHERE k.kabupaten_id IS NULL AND k.kode <> '' AND kb.kode_bps = replace(left(k.kode, 5), '.', '')
            """)
            c.execute("""
                UPDATE inti_kecamatan k SET kabupaten_id = (
                    SELECT kb.id FROM inti_kabupaten_kota kb
                    WHERE kb.provinsi_id = k.provinsi_id AND ST_Intersects(kb.geometry, ST_PointOnSurface(k.geometry))
                    LIMIT 1)
                WHERE k.kabupaten_id IS NULL
            """)
            c.execute("""
                UPDATE inti_desa_kelurahan d SET kecamatan_id = k.id FROM inti_kecamatan k
                WHERE d.kecamatan_id IS NULL AND d.kode <> '' AND k.kode = regexp_replace(split_part(d.kode, '/', 1), %s, '')
            """, [r'\.[^.]*$'])
            c.execute("""
                UPDATE inti_desa_kelurahan d SET kecamatan_id = (
                    SELECT k.id FROM inti_kecamatan k
                    WHERE k.provinsi_id = d.provinsi_id AND ST_Intersects(k.geometry, ST_PointOnSurface(d.geometry))
                    LIMIT 1)
                WHERE d.kecamatan_id IS NULL
            """)
        self.stdout.write(
            f'  tanpa kabupaten: {Kecamatan.objects.filter(kabupaten__isnull=True).count()} kecamatan; '
            f'tanpa kecamatan: {DesaKelurahan.objects.filter(kecamatan__isnull=True).count()} desa/kelurahan'
        )
