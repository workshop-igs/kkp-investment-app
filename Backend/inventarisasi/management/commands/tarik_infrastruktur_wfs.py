import collections
import json
import time

import httpx
from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from inti.models import Provinsi
from inventarisasi.management.commands._geometri import buang_z
from inventarisasi.models import InfrastrukturPendukung

WFS = 'https://portaldata.kkp.go.id/gis/wms'
TANDA = 'KKP-WFS'

LAPISAN = [
    ('demo:PELABUHAN_PERIKANAN_PT_50K', 'PELABUHAN_PERIKANAN', ''),
    ('demo:Peta_Sebaran_Pelabuhan_Umum', 'PELABUHAN_UMUM', ''),
    ('demo:Peta_Sebaran_Pelabuhan_Penyeberangan', 'PELABUHAN_PENYEBERANGAN', ''),
    ('demo:Peta_Sebaran_Terminal_Khusus', 'TERMINAL_KHUSUS', ''),
    ('demo:Peta_Jalan_Nasional', 'JALAN_NASIONAL', ''),
    ('demo:Peta_Jaringan_Listrik', 'JARINGAN_LISTRIK', ''),
    ('demo:Peta_Lokasi_Pembangkit_Listrik', 'PEMBANGKIT_LISTRIK', ''),
    ('demo:Peta_Kawasan_Industri_Eksisting', 'KAWASAN_INDUSTRI', 'Eksisting'),
    ('demo:Peta_Rencana_Kawasan_Industri', 'KAWASAN_INDUSTRI', 'Rencana'),
    ('demo:Peta_Kawasan_Perdagangan_Bebas_dan_Pelabuhan_Bebas', 'KAWASAN_PERDAGANGAN_BEBAS', ''),
]

KOLOM = {
    'nama': ('Nama_Objek', 'namobj', 'NAMOBJ', 'nm_inf', 'remark', 'NAMA'),
    'kelas': ('KELAS', 'kelas', 'fungsi', 'jnspel'),
    'pengelola': ('PENGELOLA', 'pengelola', 'pjapel'),
    'status': ('STATUS', 'status', 'admpel'),
    'keterangan': ('KETERANGAN', 'remark', 'metadata', 'thn_data'),
    'provinsi': ('PROVINSI', 'Provinsi', 'provinsi', 'wadmpr'),
}

KOSONG = ('', '-', 'none', 'null', '0', 'tidak ada')


def bersih(nilai):
    t = str(nilai if nilai is not None else '').strip()
    return '' if t.lower() in KOSONG else t


def ambil(properti, maksud):
    for kunci in KOLOM[maksud]:
        nilai = bersih(properti.get(kunci))
        if nilai:
            return nilai
    return ''


def ambil_fitur(layer, percobaan=4):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(WFS, params={
                'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
                'typeName': layer, 'outputFormat': 'application/json',
                'maxFeatures': 50000}, timeout=600.0)
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    return None, galat


class Command(BaseCommand):
    help = 'Tarik sebaran infrastruktur transportasi & penunjang dari WFS KKP.'

    def add_arguments(self, parser):
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan saja.')
        parser.add_argument('--layer', action='append', help='Tarik hanya lapisan ini.')

    def handle(self, *args, **options):
        if options['hapus']:
            terhapus = InfrastrukturPendukung.objects.filter(sumber_data=TANDA).delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Selesai — {terhapus} objek hasil tarikan dibuang.'))
            return

        provinsi_list = list(Provinsi.objects.exclude(geometry=None))
        indeks = {p.nama.lower(): p for p in provinsi_list}

        def cari_provinsi(teks, geom):
            n = (teks or '').lower().strip().split(',')[0].strip()
            if n:
                if n in indeks:
                    return indeks[n]
                for nama, p in indeks.items():
                    if n in nama or nama in n:
                        return p
            if not provinsi_list:
                return None
            titik = geom.centroid
            return min(provinsi_list, key=lambda p: p.geometry.distance(titik))

        daftar = (
            [(x, dict((a, b) for a, b, _ in LAPISAN).get(x, 'PELABUHAN_UMUM'), '')
             for x in options['layer']]
            if options['layer'] else LAPISAN
        )

        total = 0
        rekap = collections.Counter()
        gagal = []
        kode_dipakai = set()

        for layer, kategori, status_tetap in daftar:
            fitur, galat = ambil_fitur(layer)
            if fitur is None:
                gagal.append((layer, str(galat)[:70]))
                self.stdout.write(self.style.WARNING('  ! %-56s gagal' % layer))
                continue

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
                antre.append(InfrastrukturPendukung(
                    kategori=kategori,
                    kode_lapisan=layer.split(':')[-1][:80],
                    nama=(ambil(p, 'nama') or dict(InfrastrukturPendukung.KATEGORI_CHOICES)[kategori])[:255],
                    kelas=ambil(p, 'kelas')[:120],
                    pengelola=ambil(p, 'pengelola')[:180],
                    status=(status_tetap or ambil(p, 'status'))[:120],
                    keterangan=ambil(p, 'keterangan')[:500],
                    provinsi=cari_provinsi(ambil(p, 'provinsi'), geom),
                    geometry=geom,
                    sumber_data=TANDA,
                ))
                rekap[geom.geom_type] += 1

            kode = layer.split(':')[-1][:80]
            kode_dipakai.add(kode)
            if not antre:
                gagal.append((layer, 'tidak ada fitur'))
                self.stdout.write(self.style.WARNING(f'  ! {layer:<56} kosong'))
                continue
            with transaction.atomic():
                InfrastrukturPendukung.objects.filter(sumber_data=TANDA, kode_lapisan=kode).delete()
                InfrastrukturPendukung.objects.bulk_create(antre, batch_size=200)
            total += len(antre)
            self.stdout.write('  %-56s %5d fitur%s' % (
                layer, len(antre), ' (%d dilewati)' % dilewati if dilewati else ''))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Tersimpan: %d objek infrastruktur' % total))
        for tipe, n in rekap.most_common():
            self.stdout.write('   %-18s %d' % (tipe, n))
        for layer, pesan in gagal:
            self.stdout.write(self.style.WARNING('Gagal: %s — %s' % (layer, pesan)))
        self.stdout.write('Sumber: Portal Satu Data KKP (WFS).')
        if gagal:
            raise CommandError(f'{len(gagal)} lapisan gagal ditarik, datanya yang lama dipertahankan: '
                               f'{", ".join(layer for layer, _ in gagal)}')
        if not options['layer']:
            InfrastrukturPendukung.objects.filter(sumber_data=TANDA).exclude(kode_lapisan__in=kode_dipakai).delete()
