from django.core.management.base import BaseCommand

from ketenagakerjaan.models import KalibrasiPelatihanSektor, MatriksKeahlianSektor
from ketenagakerjaan.proyeksi import MATRIKS_KEAHLIAN


class Command(BaseCommand):
    help = 'Isi katalog pelatihan per kategori investasi dengan isian bawaan.'

    def add_arguments(self, parser):
        parser.add_argument('--ganti', action='store_true', help='Timpa baris yang sudah ada.')

    def handle(self, *args, **options):
        from inti.models import SektorInvestasi

        terisi = dilewati = 0
        for sektor in SektorInvestasi.objects.all().order_by('kode'):
            katalog = MATRIKS_KEAHLIAN.get(sektor.kode)
            if not katalog:
                self.stdout.write(f'  {sektor.kode}: tidak ada katalog bawaan, dilewati')
                dilewati += 1
                continue

            kepala, baru = KalibrasiPelatihanSektor.objects.get_or_create(sektor=sektor)
            if not baru and not options['ganti']:
                dilewati += 1
                continue

            MatriksKeahlianSektor.objects.filter(labor_coefficient=kepala).delete()
            for m in katalog:
                MatriksKeahlianSektor.objects.create(
                    labor_coefficient=kepala,
                    nama_posisi=m['posisi'],
                    pct_demand=m['pct'],
                    prioritas=m['prioritas'],
                    lembaga_pelatihan_rekomendasi=m['lembaga'],
                    durasi_pelatihan_bulan=m['bulan'],
                    estimasi_biaya_per_orang_juta=m['biaya_juta'],
                    skema_sertifikasi=m['skema'],
                )
            terisi += 1
            bagian = sum(m['pct'] for m in katalog)
            self.stdout.write(
                f'  {sektor.kode}: {len(katalog)} posisi, mencakup '
                f'{bagian * 100:.0f}% tenaga kerja proyek'
            )

        self.stdout.write(
            self.style.SUCCESS(f'Selesai — {terisi} kategori terisi, {dilewati} dilewati.')
        )
        self.stdout.write(
            'Bagian posisi masih ASUMSI. Isi kolom "dikalibrasi_oleh" lewat admin '
            'setelah angkanya diganti dengan sumber yang dapat dikutip.'
        )
