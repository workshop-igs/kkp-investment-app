import json
import time

import httpx
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from inti.models import KabupatenKota, Provinsi

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAPISAN_BATAS = 'demo:Batas_Kabupaten_Kota_2023'

TAHUN_STATISTIK = 2023
LAPISAN_STATISTIK = [
    (
        'statistik_spasial:Jumlah_Penduduk_Kabupaten_Kota',
        'Kode_Kabupaten_Kota',
        {'Jumlah_Penduduk': 'jumlah_penduduk'},
    ),
    (
        'statistik_spasial:Jumlah_Kemiskinan_Kabupaten_Kota',
        'KDPKAB',
        {'Total': 'penduduk_dtks'},
    ),
    (
        'statistik_spasial:Jumlah_Nelayan_Kabupaten_Kota',
        'Kode_Kabupaten_Kota',
        {f'Jumlah_Nelayan_{TAHUN_STATISTIK}': 'jumlah_nelayan'},
    ),
    (
        'statistik_spasial:RTP_Tangkap_Kabupaten_Kota',
        'Kode_Kabupaten_Kota',
        {f'RTP_Tangkap_{TAHUN_STATISTIK}': 'jumlah_rtp_tangkap'},
    ),
]


def _kode(nilai):
    return str(nilai or '').replace('.', '').strip()


def _minta(params, percobaan=3):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(
                WFS,
                params={
                    'service': 'WFS',
                    'version': '1.0.0',
                    'request': 'GetFeature',
                    'outputFormat': 'application/json',
                    'maxFeatures': 100000,
                    **params,
                },
                timeout=300.0,
            )
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2**ke)
    return None, galat


def _buang_z(koordinat):
    if not koordinat:
        return koordinat
    if isinstance(koordinat[0], (int, float)):
        return list(koordinat[:2])
    return [_buang_z(k) for k in koordinat]


class Command(BaseCommand):
    help = 'Tarik batas & statistik sosial kabupaten/kota dari WFS Portal Satu Data KKP.'

    def add_arguments(self, parser):
        parser.add_argument('--kode', help='Kode BPS provinsi, mis. 51.')
        parser.add_argument('--lanjutkan', action='store_true', help='Lewati provinsi yang sudah terisi.')
        parser.add_argument(
            '--statistik',
            action='store_true',
            help='Perbarui angka sosial saja, tanpa menarik ulang batas wilayah.',
        )
        parser.add_argument('--hapus', action='store_true', help='Kosongkan tabel kabupaten/kota.')

    def handle(self, *args, **opsi):
        if opsi['hapus']:
            n = KabupatenKota.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'{n} baris kabupaten/kota dihapus.'))
            return

        mulai = time.time()
        if not opsi['statistik']:
            self._tarik_batas(opsi)
        n_statistik = self._tarik_statistik()
        self._tandai_pesisir()

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Selesai dalam {time.time() - mulai:.0f} dtk — '
                f'{KabupatenKota.objects.count()} kabupaten/kota, '
                f'{n_statistik} beroleh statistik sosial, '
                f'{KabupatenKota.objects.filter(pesisir=True).count()} pesisir'
            )
        )

    def _tarik_batas(self, opsi):
        provinsi = Provinsi.objects.order_by('kode_bps')
        if opsi['kode']:
            provinsi = provinsi.filter(kode_bps=str(opsi['kode']).zfill(2))
        daftar = list(provinsi)
        if not daftar:
            self.stderr.write('Tidak ada provinsi yang cocok.')
            return

        self.stdout.write(self.style.MIGRATE_HEADING(f'Batas wilayah — {len(daftar)} provinsi'))
        for i, prov in enumerate(daftar, 1):
            if opsi['lanjutkan'] and KabupatenKota.objects.filter(provinsi_id=prov.id).exists():
                continue

            fitur, galat = _minta({
                'typeName': LAPISAN_BATAS,
                'CQL_FILTER': f"kode_provinsi='{prov.kode_bps}'",
            })
            if fitur is None:
                self.stdout.write(self.style.WARNING(
                    f'  [{i}/{len(daftar)}] {prov.nama:28s} gagal: {type(galat).__name__}'
                ))
                continue

            baris = []
            for f in fitur:
                g = f.get('geometry')
                p = f.get('properties') or {}
                kode = _kode(p.get('kode_kabupaten'))
                if not g or not kode:
                    continue
                try:
                    geom = GEOSGeometry(
                        json.dumps({'type': g['type'], 'coordinates': _buang_z(g['coordinates'])}),
                        srid=4326,
                    )
                except Exception:
                    continue
                if geom.geom_type == 'Polygon':
                    geom = MultiPolygon(geom, srid=4326)
                if geom.empty:
                    continue

                nama = (p.get('nama_kabupaten_kota') or p.get('nama_objek') or kode).strip()
                baris.append(KabupatenKota(
                    provinsi_id=prov.id,
                    kode_bps=kode,
                    nama=nama[:100],
                    jenis='KOTA' if nama.lower().startswith('kota ') else 'KAB',
                    geometry=geom,
                    luas_km2=float(p.get('luas_wilayah') or 0),
                ))

            if baris:
                with transaction.atomic():
                    KabupatenKota.objects.filter(provinsi_id=prov.id).delete()
                    KabupatenKota.objects.bulk_create(baris, batch_size=200, ignore_conflicts=True)
            self.stdout.write(f'  [{i}/{len(daftar)}] {prov.nama:28s} {len(baris):4d} kab/kota')

    def _tarik_statistik(self):
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Statistik sosial (nasional, atribut saja)'))

        nilai = {}
        for lapisan, kunci, peta_kolom in LAPISAN_STATISTIK:
            fitur, galat = _minta({
                'typeName': lapisan,
                'propertyName': ','.join([kunci, *peta_kolom]),
            })
            if fitur is None:
                self.stdout.write(self.style.WARNING(
                    f'  ! {lapisan.split(":")[-1]:38s} gagal: {type(galat).__name__}'
                ))
                continue
            terbaca = 0
            for f in fitur:
                p = f.get('properties') or {}
                kode = _kode(p.get(kunci))
                if not kode:
                    continue
                for kolom, bidang in peta_kolom.items():
                    if p.get(kolom) is not None:
                        nilai.setdefault(kode, {})[bidang] = int(p[kolom] or 0)
                        terbaca += 1
            self.stdout.write(f'  {lapisan.split(":")[-1]:40s} {terbaca:4d} wilayah')

        if not nilai:
            return 0

        kabkota = {k.kode_bps: k for k in KabupatenKota.objects.all()}
        terubah = []
        for kode, bidang in nilai.items():
            obj = kabkota.get(kode)
            if obj is None:
                continue
            for nama_bidang, angka in bidang.items():
                setattr(obj, nama_bidang, angka)
            obj.tahun_data_sosial = TAHUN_STATISTIK
            terubah.append(obj)

        if terubah:
            KabupatenKota.objects.bulk_update(
                terubah,
                ['jumlah_penduduk', 'penduduk_dtks', 'jumlah_nelayan',
                 'jumlah_rtp_tangkap', 'tahun_data_sosial'],
                batch_size=200,
            )
        tak_cocok = len(nilai) - len(terubah)
        if tak_cocok > 0:
            self.stdout.write(self.style.WARNING(
                f'  {tak_cocok} kode kabupaten dari portal statistik tidak ada pada tabel batas '
                '(pemekaran atau kode lama).'
            ))
        return len(terubah)

    def _tandai_pesisir(self):
        with connection.cursor() as c:
            c.execute(
                """
                UPDATE inti_kabupaten_kota k
                SET pesisir = EXISTS (
                    SELECT 1 FROM inventarisasi_zonasi_ruang_laut z
                    WHERE z.provinsi_id = k.provinsi_id
                      AND ST_Intersects(z.geometry, k.geometry)
                )
                WHERE k.geometry IS NOT NULL
                """
            )
