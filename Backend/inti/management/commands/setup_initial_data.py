from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand

from inti.models import Provinsi, SektorInvestasi, SumberData
from penarikan_data.models import KonfigurasiAPI


class Command(BaseCommand):
    help = 'Seeds initial data for 34 Provinces, Sectors, and Data Sources'

    def handle(self, *args, **options):
        self.stdout.write('Seeding Sektor Investasi...')
        sektors = [
            ('PERIKANAN_TANGKAP', 'Perikanan Tangkap', 'Penangkapan ikan laut', 25.0, 1),
            ('PERIKANAN_BUDIDAYA', 'Perikanan Budidaya', 'Budidaya laut (KJA, rumput laut)', 30.0, 2),
            ('PARIWISATA_BAHARI', 'Pariwisata Bahari', 'Wisata pesisir, diving, resort', 35.0, 3),
            ('ENERGI_KELAUTAN', 'Energi Kelautan', 'Energi arus, gelombang, OTEC', 12.0, 4),
            ('PENGOLAHAN_HASIL_LAUT', 'Pengolahan Hasil Laut', 'Pabrik pengolahan ikan, cold storage', 28.0, 5),
        ]

        for kode, nama, desc, rasio, urutan in sektors:
            SektorInvestasi.objects.get_or_create(
                kode=kode, defaults={'nama': nama, 'deskripsi': desc, 'rasio_tk_per_miliar': rasio, 'urutan': urutan}
            )

        from analitik.services.screening_ruang import isi_ketentuan_bawaan

        self.stdout.write(f'Ketentuan ruang bawaan: {isi_ketentuan_bawaan()} baris baru')

        self.stdout.write('Seeding Data Sources...')
        sources = [
            ('BIG', 'Badan Informasi Geospasial', 'API', 'ACTIVE'),
            ('BPS', 'Badan Pusat Statistik', 'API', 'ACTIVE'),
            ('BMKG', 'BMKG', 'API', 'ACTIVE'),
            ('KKP', 'Kementerian Kelautan dan Perikanan', 'API', 'ACTIVE'),
            ('BNPB', 'BNPB InaRISK', 'API', 'ACTIVE'),
        ]

        for kode, nama, tipe, status in sources:
            SumberData.objects.get_or_create(kode=kode, defaults={'nama': nama, 'tipe': tipe, 'status': status})

            KonfigurasiAPI.objects.get_or_create(kode=kode, defaults={'nama': nama, 'status': 'MOCK'})

        self.stdout.write('Seeding 34 Provinsi...')
        provinsi_data = [
            ('11', 'ACEH'),
            ('12', 'SUMATERA UTARA'),
            ('13', 'SUMATERA BARAT'),
            ('14', 'RIAU'),
            ('15', 'JAMBI'),
            ('16', 'SUMATERA SELATAN'),
            ('17', 'BENGKULU'),
            ('18', 'LAMPUNG'),
            ('19', 'KEPULAUAN BANGKA BELITUNG'),
            ('21', 'KEPULAUAN RIAU'),
            ('31', 'DKI JAKARTA'),
            ('32', 'JAWA BARAT'),
            ('33', 'JAWA TENGAH'),
            ('34', 'DI YOGYAKARTA'),
            ('35', 'JAWA TIMUR'),
            ('36', 'BANTEN'),
            ('51', 'BALI'),
            ('52', 'NUSA TENGGARA BARAT'),
            ('53', 'NUSA TENGGARA TIMUR'),
            ('61', 'KALIMANTAN BARAT'),
            ('62', 'KALIMANTAN TENGAH'),
            ('63', 'KALIMANTAN SELATAN'),
            ('64', 'KALIMANTAN TIMUR'),
            ('65', 'KALIMANTAN UTARA'),
            ('71', 'SULAWESI UTARA'),
            ('72', 'SULAWESI TENGAH'),
            ('73', 'SULAWESI SELATAN'),
            ('74', 'SULAWESI TENGGARA'),
            ('75', 'GORONTALO'),
            ('76', 'SULAWESI BARAT'),
            ('81', 'MALUKU'),
            ('82', 'MALUKU UTARA'),
            ('91', 'PAPUA BARAT'),
            ('94', 'PAPUA'),
        ]

        dummy_multipolygon = GEOSGeometry('MULTIPOLYGON (((118 -2, 118 -1, 119 -1, 119 -2, 118 -2)))')

        for kode, nama in provinsi_data:
            Provinsi.objects.get_or_create(kode_bps=kode, defaults={'nama': nama, 'geometry': dummy_multipolygon})

        self.stdout.write(self.style.SUCCESS('Successfully seeded initial data!'))
