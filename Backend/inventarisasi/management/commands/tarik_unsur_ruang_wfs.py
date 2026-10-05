import collections
import json
import time

import httpx
from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from inti.models import Provinsi
from inventarisasi.management.commands._geometri import buang_z
from inventarisasi.models import UnsurRuangLaut

WFS = 'https://portaldata.kkp.go.id/gis/wms'
TANDA = 'KKP-WFS'
SIDAKO = ('https://sidako.kkp.go.id/geoserver/ows', 'SIDAKO-MHA')

LAPISAN = [
    ('demo:POLA_LN', 'RTRL'),
    ('demo:POLA_PT', 'RTRL'),
    ('demo:KKPRL_LN', 'KKPRL'),
    ('oceanaccounts:spatial_wilayah_kelola_mha_2024', 'MHA', SIDAKO),
    ('demo:RZWP3K_SULTRA_ADAT_PERDA_SULAWESI_SELATAN', 'MHA'),
    ('demo:Wilayah_Pesisir_Berbasis_Adat_proses_penetapan_Papua_Barat', 'MHA'),
]


KOLOM = {
    'nama': (
        'nama_mha', 'Nama_Masyarakat_Hukum_Adat', 'Nama_Objek', 'NAMOBJ', 'Nama_Kawasan',
        'KEGIATAN', 'KAWASAN', 'Kawasan', 'Keterangan',
    ),
    'jenis': (
        'Nama_Jenis', 'JENIS', 'KATEGORI', 'kategori', 'ORDE3', 'ORDE2',
        'Jenis_Rencana_Struktur_Ruang_Laut',
    ),
    'keterangan': ('Keterangan', 'KETERANGAN', 'keterangan', 'Nama_Lokasi', 'PERAIRAN', 'Kode_Kawasan'),
    'regulasi': ('Dasar_Hukum', 'STA_PERDA', 'Sta_Perda', 'NO_KKPRL', 'NO_PETA'),
    'provinsi': ('PROVINSI', 'Provinsi', 'provinsi', 'Wilayah_Kelola_Laut_Provinsi'),
}

KOLOM_LUAS = ('LUAS_HA', 'Luas_Ha', 'luas_ha')

KOSONG = ('', '-', 'none', 'null', 'tidak ada')


def bersih(nilai):
    t = str(nilai if nilai is not None else '').strip()
    return '' if t.lower() in KOSONG else t


def ambil(properti, maksud):
    for kunci in KOLOM[maksud]:
        nilai = bersih(properti.get(kunci))
        if nilai:
            return nilai
    return ''


def ambil_luas(properti):
    for kunci in KOLOM_LUAS:
        try:
            nilai = float(properti.get(kunci) or 0)
        except (TypeError, ValueError):
            continue
        if nilai > 0:
            return nilai
    return 0.0


def regulasi(properti):
    dasar = [f'SK {bersih(properti.get("no_sk"))}' if bersih(properti.get('no_sk')) else '',
             f'Perbup {bersih(properti.get("no_perbup"))}' if bersih(properti.get('no_perbup')) else '']
    return '; '.join(filter(None, dasar)) or ambil(properti, 'regulasi')


def keterangan(properti):
    lokasi = ', '.join(filter(None, (bersih(properti.get(k)) for k in ('desa', 'kecamatan', 'kab_kota'))))
    return '; '.join(filter(None, [ambil(properti, 'keterangan'), lokasi and f'Lokasi: {lokasi}',
                                   bersih(properti.get('hal_perbup'))]))


def ambil_fitur(layer, wfs=WFS, percobaan=4):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(wfs, params={
                'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
                'typeName': layer, 'outputFormat': 'application/json',
                'maxFeatures': 50000}, timeout=300.0)
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    return None, galat


class Command(BaseCommand):
    help = 'Tarik unsur ruang laut (garis, titik, lembar 1:50.000) dari WFS KKP.'

    def add_arguments(self, parser):
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan saja.')
        parser.add_argument('--layer', action='append', help='Tarik hanya lapisan ini.')

    def handle(self, *args, **options):
        daftar = options['layer']
        pasangan = [x for x in LAPISAN if not daftar or x[0] in daftar]
        terhapus = UnsurRuangLaut.objects.filter(
            sumber_data__in=[(x[2] if len(x) > 2 else (WFS, TANDA))[1] for x in pasangan],
            kode_lapisan__in=[x[0].split(':')[-1] for x in pasangan],
        ).delete()[0]
        if terhapus:
            self.stdout.write('Data tarikan sebelumnya dihapus: %d baris.' % terhapus)
        if options['hapus']:
            self.stdout.write(self.style.SUCCESS('Selesai — data tarikan dibuang.'))
            return

        provinsi_list = list(Provinsi.objects.all())
        indeks = {p.nama.lower(): p for p in provinsi_list}

        def cari_provinsi(teks, petunjuk_layer):
            for kandidat in (teks, petunjuk_layer):
                n = (kandidat or '').lower().strip()
                if not n:
                    continue
                n = n.split(',')[0].strip()
                if n in indeks:
                    return indeks[n]
                for nama, p in indeks.items():
                    if n in nama or nama in n:
                        return p
            return None

        total = 0
        rekap = collections.Counter()
        gagal = []

        for layer, kelompok, *sumber in pasangan:
            wfs, tanda = sumber[0] if sumber else (WFS, TANDA)
            fitur, galat = ambil_fitur(layer, wfs)
            if fitur is None:
                gagal.append((layer, str(galat)[:70]))
                self.stdout.write(self.style.WARNING('  ! %-46s gagal' % layer))
                continue

            petunjuk = ''

            antre, dilewati = [], 0
            for f in fitur:
                g = f.get('geometry')
                if not g:
                    dilewati += 1
                    continue
                try:
                    geom = GEOSGeometry(json.dumps({
                        'type': g.get('type'),
                        'coordinates': buang_z(g.get('coordinates')),
                    }), srid=4326)
                except Exception:
                    dilewati += 1
                    continue
                if geom.empty:
                    dilewati += 1
                    continue

                p = f.get('properties') or {}
                antre.append(UnsurRuangLaut(
                    kelompok=kelompok,
                    kode_lapisan=layer.split(':')[-1],
                    nama=(ambil(p, 'nama') or 'Unsur ruang laut')[:255],
                    jenis=ambil(p, 'jenis')[:255],
                    keterangan=keterangan(p)[:500],
                    nomor_regulasi=regulasi(p)[:255],
                    provinsi=cari_provinsi(ambil(p, 'provinsi'), petunjuk),
                    geometry=geom,
                    luas_ha=ambil_luas(p),
                    sumber_data=tanda,
                ))
                rekap[geom.geom_type] += 1

            with transaction.atomic():
                UnsurRuangLaut.objects.bulk_create(antre, batch_size=200)
                if kelompok == 'MHA':
                    with connection.cursor() as c:
                        c.execute(
                            """
                            UPDATE inventarisasi_unsur_ruang_laut u SET provinsi_id = (
                                SELECT p.id FROM inti_provinsi p WHERE p.geometry IS NOT NULL
                                ORDER BY p.geometry <-> ST_PointOnSurface(u.geometry) LIMIT 1
                            ) WHERE u.id = ANY(%s)
                            """,
                            [[u.id for u in antre]],
                        )
            total += len(antre)
            self.stdout.write('  %-46s %5d fitur%s' % (
                layer, len(antre), ' (%d dilewati)' % dilewati if dilewati else ''))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Tersimpan: %d unsur' % total))
        for tipe, n in rekap.most_common():
            self.stdout.write('   %-18s %d' % (tipe, n))
        for layer, pesan in gagal:
            self.stdout.write(self.style.WARNING('Gagal: %s — %s' % (layer, pesan)))
        self.stdout.write('Sumber: Portal Satu Data KKP (WFS) dan Sidako KKP (wilayah kelola MHA 2024).')
