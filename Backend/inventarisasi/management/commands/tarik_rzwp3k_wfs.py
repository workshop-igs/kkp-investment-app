import collections
import time

import httpx
from django.core.management.base import BaseCommand
from django.db import transaction

from inti.models import Provinsi
from inventarisasi.klasifikasi import jenis_kawasan, sub_zona
from inventarisasi.management.commands._geometri import perbaiki_geometri
from inventarisasi.models import ZonasiRuangLaut

WFS = 'https://portaldata.kkp.go.id/gis/wms'
TANDA = 'KKP-RZWP3K'

TANDA_PKKPRL = 'KKP-PKKPRL'

PROVINSI_PKKPRL = [
    'Bali', 'Banten', 'DIY', 'Gorontalo', 'Jawa_Barat', 'Jawa_Tengah',
    'Jawa_Timur', 'Kalimantan_Selatan', 'Kalimantan_Timur', 'Lampung',
    'NTB', 'Papua', 'Sulawesi_Selatan',
]


def tanda_untuk(layer: str) -> str:
    return TANDA_PKKPRL if 'PKKPRL' in layer.upper() else TANDA

LAPISAN = [
    'demo:ZonasiKawasanKonservasi_AR_50K_2021_Rev2022',
    'demo:KSNT_LH_AR',
    'demo:RZWP3K_AR_ACEH_KPU',
    'demo:RZWP3K_AR_ACEH_KONSERVASI',
    'demo:RZWP3K_AR_ACEH_KSN',
    'demo:RZWP3K_AR_ACEH_KSNT',
    'demo:Kawasan_Pemanfaatan_Umum_Jambi',
    'demo:Kawasan_Konservasi_Jambi',
    'demo:Kawasan_Strategis_Nasional_Jambi',
    'demo:RZWP3K_50_Bengkulu',
    'demo:Kawasan_Strategis_KSNT_Bengkulu',
    'demo:RZWP3K_SUMSEL_50K_AREA',
    'demo:Peta_RZWP3K_Provinsi_Sumatera_Barat_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Sumatera_Barat_Kawasan_Strategis',
    'demo:Peta_RZWP3K_Provinsi_Lampung_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Lampung_Kawasan_Strategis',
    'demo:Zona_Bangka_Belitung',
    'demo:Sub_Zona_Bangka_Belitung',
    'demo:RZWP3K_AR_ZONA_Jawa_Tengah',
    'demo:RZWP3K_AR_KSN_Jawa_Tengah',
    'demo:Peta_RZWP3K_Provinsi_Jawa_Timur_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Jawa_Timur_Kawasan_Strategis',
    'demo:RZWP3K_AR_Kalimantan_Barat',
    'demo:Alokasi_Ruang_Laut_Subzona_Kalimantan_Tengah',
    'demo:Zona_Pertambangan_Kalimantan_Tengah',
    'demo:Kawasan_Strategis_Kalimantan_Timur',
    'demo:RZWP3K_AR_Sulawesi_Selatan',
    'demo:RZWP3K_SULTRA_KPU_PERDA_SULAWESI_SELATAN',
    'demo:RZWP3K_SULTRA_KONSERVASI_PERDA_SULAWESI_SELATAN',
    'demo:RZWP3K_SULTRA_KSN_PERDA_SULAWESI_SELATAN',
    'demo:Peta_RZWP3K_Provinsi_Sulawesi_Tengah_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Sulawesi_Tengah_Kawasan_Strategis',
    'demo:Peta_RZWP3K_Provinsi_Sulawesi_Barat_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Sulawesi_Utara_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Sulawesi_Utara_Kawasan_Strategis',
    'demo:Peta_RZWP3K_Provinsi_Nusa_Tenggara_Barat_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Nusa_Tenggara_Barat_Kawasan_Strategis',
    'demo:Peta_RZWP3K_Provinsi_Nusa_Tenggara_Timur_Zonasi',
    'demo:Peta_RZWP3K_Provinsi_Nusa_Tenggara_Timur_Kawasan_Strategis',
    'demo:Pemanfaatan_Umum_Papua_Barat',
    'demo:Zonasi_Kawasan_Konservasi_Papua_Barat',
    'demo:Kawasan_Strategis_Nasional_Papua_Barat',
    'demo:Kawasan_Strategis_Nasional_Tertentu_Papua_Barat',

]

LAPISAN += ['demo:PKKPRL_50K_%s' % x for x in PROVINSI_PKKPRL]

KOLOM = {
    'kawasan': ('KAWASAN', 'Nama_Kawasan', 'KWS', 'KAW'),
    'zona': ('ZONA', 'Nama_Zona', 'Zona_Kawasan_Konservasi', 'Nama_Jenis', 'JENIS'),
    'sub_zona': ('SUBZONA', 'SUB_ZONA', 'Sub_Zona_Kawasan_Konservasi', 'KODE_SZ', 'KODE_SZONA'),
    'nama': ('Nama_Objek', 'NAMOBJ', 'namobj', 'KETERANGAN', 'Keterangan', 'ZONA'),
    'provinsi': ('PROVINSI', 'Provinsi', 'PROV'),
    'kode': ('KODE_ZONA', 'Kode_Zona'),
    'regulasi': ('Dasar_Hukum', 'No_SK_Kawasan_Konservasi', 'PERDA', 'STA_PERDA',
                 'STATUS_PERDA', 'NO_PERDA'),
    'tahun': ('TAHUN', 'Tahun_SK_Kawasan_Konservasi', 'THN'),
}

KOSONG = ('', '-', 'none', 'null', 'tidak ada', 'tidak dibagi')


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
    galat_akhir = None
    for ke in range(percobaan):
        try:
            r = httpx.get(WFS, params={
                'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
                'typeName': layer, 'outputFormat': 'application/json',
                'maxFeatures': 50000}, timeout=300.0)
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat_akhir = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    return None, galat_akhir


class Command(BaseCommand):
    help = 'Tarik alokasi ruang laut RZWP3K provinsi + kawasan konservasi nasional dari WFS KKP.'

    def add_arguments(self, parser):
        parser.add_argument('--hapus', action='store_true', help='Hapus hasil tarikan saja.')
        parser.add_argument('--layer', action='append', help='Tarik hanya lapisan ini (boleh diulang).')

    def handle(self, *args, **options):
        daftar_diminta = options['layer'] or LAPISAN

        tanda_disentuh = (
            {TANDA, TANDA_PKKPRL}
            if options['hapus']
            else {tanda_untuk(x) for x in daftar_diminta}
        )
        terhapus = ZonasiRuangLaut.objects.filter(sumber_data__in=tanda_disentuh).delete()[0]
        if terhapus:
            self.stdout.write(
                'Data tarikan sebelumnya dihapus: %d baris (%s).'
                % (terhapus, ', '.join(sorted(tanda_disentuh)))
            )
        if options['hapus']:
            self.stdout.write(self.style.SUCCESS('Selesai — data tarikan dibuang.'))
            return

        provinsi_list = list(Provinsi.objects.exclude(geometry=None))
        if not provinsi_list:
            self.stdout.write(self.style.ERROR('Tabel Provinsi kosong; jalankan tarik_batas_provinsi dulu.'))
            return
        indeks_nama = {p.nama.lower(): p for p in provinsi_list}

        def cari_provinsi(nama_teks, geom):
            n = nama_teks.lower().strip()
            if n:
                if n in indeks_nama:
                    return indeks_nama[n]
                for nama, p in indeks_nama.items():
                    if n in nama or nama in n:
                        return p
            titik = geom.centroid
            terdekat, jarak_min = provinsi_list[0], None
            for p in provinsi_list:
                d = p.geometry.distance(titik)
                if jarak_min is None or d < jarak_min:
                    terdekat, jarak_min = p, d
            return terdekat

        daftar = daftar_diminta
        total_simpan = total_lewat = 0
        gagal = []
        sebab_lewat = collections.Counter()

        for layer in daftar:
            fitur, galat = ambil_fitur(layer)
            if fitur is None:
                gagal.append((layer, str(galat)[:70]))
                self.stdout.write(self.style.WARNING('  ! %-52s gagal' % layer))
                continue

            antre, dilewati = [], 0
            for f in fitur:
                geom, alasan = perbaiki_geometri(f.get('geometry'))
                if geom is None:
                    dilewati += 1
                    sebab_lewat[alasan] += 1
                    continue

                p = f.get('properties') or {}
                kawasan = ambil(p, 'kawasan')
                zona = ambil(p, 'zona')
                sub = ambil(p, 'sub_zona')
                kode = ambil(p, 'kode')
                nama = ambil(p, 'nama') or zona or kawasan or 'Zona Ruang Laut'
                tahun = ambil(p, 'tahun')

                acuan_kawasan = kawasan or nama or layer.replace('_', ' ')

                acuan_zona = ' '.join([zona, sub, kode, nama])

                jenis = jenis_kawasan(acuan_kawasan)
                antre.append(ZonasiRuangLaut(
                    provinsi=cari_provinsi(ambil(p, 'provinsi'), geom),
                    nama_zona=nama[:255],
                    jenis_zona=jenis,
                    sub_zona=sub_zona(acuan_zona, jenis),
                    nomor_regulasi=ambil(p, 'regulasi')[:255],
                    geometry=geom,
                    keterangan=(' | '.join(x for x in (kawasan, zona, sub, kode) if x))[:500],
                    tahun_penetapan=int(tahun) if tahun.isdigit() and len(tahun) == 4 else None,
                    sumber_data=tanda_untuk(layer),
                ))

            with transaction.atomic():
                ZonasiRuangLaut.objects.bulk_create(antre, batch_size=200)
            total_simpan += len(antre)
            total_lewat += dilewati
            self.stdout.write('  %-56s %5d fitur%s' % (
                layer, len(antre), ' (%d dilewati)' % dilewati if dilewati else ''))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Tersimpan: %d zona dari %d lapisan' % (total_simpan, len(daftar))))
        if total_lewat:
            self.stdout.write(self.style.WARNING('Dilewati: %d' % total_lewat))
            for alasan, n in sebab_lewat.most_common():
                self.stdout.write('   %-26s %d' % (alasan, n))
        for layer, pesan in gagal:
            self.stdout.write(self.style.WARNING('Gagal: %s — %s' % (layer, pesan)))
        self.stdout.write('Sumber: Portal Satu Data KKP (WFS).')
