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
                    'UPDATE %s SET luas_ha = COALESCE(ST_Area(geometry::geography), 0) / 10000.0 '
                    'WHERE geometry IS NOT NULL' % tabel
                )
                diubah = cur.rowcount
                cur.execute(
                    'SELECT COUNT(*), MIN(luas_ha), MAX(luas_ha), AVG(luas_ha) '
                    'FROM %s WHERE luas_ha > 0' % tabel
                )
                n, kecil, besar, rata = cur.fetchone()
                self.stdout.write(self.style.SUCCESS('%s: %d baris diperbarui' % (label, diubah)))
                if n:
                    self.stdout.write(
                        '   berluas > 0: %d | terkecil %.2f ha | terbesar %.0f ha | rata-rata %.0f ha'
                        % (n, kecil, besar, rata)
                    )
