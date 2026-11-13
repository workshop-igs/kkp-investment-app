from django.core.management.base import BaseCommand
from django.db import connection

TABEL = {
    'inventarisasi_zonasi_ruang_laut': 'Zonasi Ruang Laut',
    'inventarisasi_kkprl': 'KKPRL',
    'inventarisasi_unsur_ruang_laut': 'Unsur Ruang Laut',
    'inventarisasi_infrastruktur_pendukung': 'Infrastruktur Pendukung',
}


class Command(BaseCommand):
    help = 'Hitung dan simpan luas_ha dari geometri pada tabel spasial.'

    def add_arguments(self, parser):
        parser.add_argument('--tabel', action='append',
                            help='Batasi pada tabel tertentu (boleh diulang).')

    def handle(self, *args, **options):
        daftar = options['tabel'] or list(TABEL)
        with connection.cursor() as cur:
            for tabel in daftar:
                label = TABEL.get(tabel, tabel)
                cur.execute(
                    f'UPDATE {tabel} SET luas_ha = COALESCE(ST_Area(geometry::geography), 0) / 10000.0 '
                    'WHERE geometry IS NOT NULL'
                )
                diubah = cur.rowcount
                cur.execute(
                    'SELECT COUNT(*), MIN(luas_ha), MAX(luas_ha), AVG(luas_ha) '
                    f'FROM {tabel} WHERE luas_ha > 0'
                )
                n, kecil, besar, rata = cur.fetchone()
                self.stdout.write(self.style.SUCCESS(f'{label}: {diubah} baris diperbarui'))
                if n:
                    self.stdout.write(
                        f'   berluas > 0: {n} | terkecil {kecil:.2f} ha | terbesar {besar:.0f} ha | rata-rata {rata:.0f} ha'
                    )
