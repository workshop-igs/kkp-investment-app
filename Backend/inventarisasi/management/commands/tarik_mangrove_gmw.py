import os
import time

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from inventarisasi.models import SumberDayaAlam

TANDA = 'GMW-MANGROVE'
TABEL_SINGGAHAN = 'gmw_singgahan'

KOTAK_INDONESIA = (94.5, -11.5, 141.5, 6.5)

LUAS_MINIMUM_HA = 0.5

UKURAN_KELOMPOK = 20000


def _ribuan(n, desimal=0):
    return f'{n:,.{desimal}f}'.replace(',', '.')


class Command(BaseCommand):
    help = 'Muat sebaran mangrove Global Mangrove Watch v3.0 dari berkas vektor.'

    def add_arguments(self, parser):
        parser.add_argument('--berkas', help='Jalur ke gmw_v3_<tahun>_vec.zip.')
        parser.add_argument('--tahun', type=int, help='Tahun data; dibaca dari nama berkas bila kosong.')
        parser.add_argument('--hapus', action='store_true', help='Hapus baris bertanda GMW-MANGROVE.')
        parser.add_argument('--tahun-hapus', type=int, help='Batasi --hapus pada satu tahun.')

    def handle(self, *args, **opsi):
        if opsi['hapus']:
            qs = SumberDayaAlam.objects.filter(sumber_data=TANDA)
            if opsi.get('tahun_hapus'):
                qs = qs.filter(tahun_data=opsi['tahun_hapus'])
            self.stdout.write(self.style.SUCCESS(f'{qs.delete()[0]} baris {TANDA} dihapus.'))
            return

        berkas = opsi['berkas']
        if not berkas or not os.path.exists(berkas):
            self.stderr.write('--berkas wajib dan harus menunjuk ke berkas yang ada.')
            self.stderr.write('Unduh dari https://zenodo.org/records/6894273')
            return

        tahun = opsi['tahun'] or self._tahun_dari_nama(berkas)
        if not tahun:
            self.stderr.write('Tahun tidak dapat ditentukan; sebutkan lewat --tahun.')
            return

        try:
            import fiona
            from pyproj import Geod
            from shapely.geometry import shape
        except ImportError as e:
            self.stderr.write(f'Pustaka geospasial tidak lengkap: {e}')
            return

        mulai = time.time()
        self.stdout.write(
            self.style.MIGRATE_HEADING(f'GMW v3.0 tahun {tahun} — {os.path.basename(berkas)}')
        )

        geod = Geod(ellps='WGS84')
        self._buat_singgahan()

        antre = []
        dibaca = kecil = 0
        try:
            with fiona.open('zip://' + berkas) as sumber:
                self.stdout.write(
                    f'  {_ribuan(len(sumber))} poligon sedunia · disaring ke kotak Indonesia'
                )
                for fitur in sumber.filter(bbox=KOTAK_INDONESIA):
                    dibaca += 1
                    try:
                        g = shape(fitur['geometry'])
                    except Exception:
                        continue

                    luas_ha = abs(geod.geometry_area_perimeter(g)[0]) / 10000.0
                    if luas_ha < LUAS_MINIMUM_HA:
                        kecil += 1
                        continue

                    antre.append((g.wkt, luas_ha))
                    if len(antre) >= UKURAN_KELOMPOK:
                        self._isi_singgahan(antre)
                        antre = []
                        self.stdout.write(
                            f'  … {_ribuan(dibaca)} dibaca, {_ribuan(kecil)} di bawah ambang'
                        )

            if antre:
                self._isi_singgahan(antre)

            self.stdout.write('  Menetapkan provinsi lewat gabungan spasial PostGIS…')
            tersimpan, tanpa_provinsi = self._pindahkan(tahun)
        finally:
            self._buang_singgahan()

        lewat = time.time() - mulai
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Selesai dalam {lewat:.0f} dtk — {_ribuan(tersimpan)} poligon mangrove {tahun} '
            f'tersimpan ({_ribuan(dibaca)} dibaca, {_ribuan(kecil)} di bawah '
            f'{LUAS_MINIMUM_HA} ha, {_ribuan(tanpa_provinsi)} tidak beririsan provinsi mana pun)'
        ))
        self._rekap(tahun)

    def _buat_singgahan(self):
        with connection.cursor() as c:
            c.execute(f'DROP TABLE IF EXISTS {TABEL_SINGGAHAN}')
            c.execute(
                f'CREATE UNLOGGED TABLE {TABEL_SINGGAHAN} '
                '(geom geometry(MultiPolygon, 4326), luas_ha double precision)'
            )

    def _isi_singgahan(self, antre):
        with connection.cursor() as c:
            c.executemany(
                f'INSERT INTO {TABEL_SINGGAHAN} (geom, luas_ha) '
                'VALUES (ST_Multi(ST_GeomFromText(%s, 4326)), %s)',
                antre,
            )

    def _buang_singgahan(self):
        with connection.cursor() as c:
            c.execute(f'DROP TABLE IF EXISTS {TABEL_SINGGAHAN}')

    def _pindahkan(self, tahun):
        with connection.cursor() as c:
            c.execute(f'CREATE INDEX ON {TABEL_SINGGAHAN} USING GIST (geom)')
            c.execute(f'ANALYZE {TABEL_SINGGAHAN}')
            c.execute(f'SELECT COUNT(*) FROM {TABEL_SINGGAHAN}')
            total = c.fetchone()[0]

            with transaction.atomic():
                c.execute(
                    'DELETE FROM inventarisasi_sumber_daya_alam '
                    'WHERE sumber_data = %s AND tahun_data = %s',
                    [TANDA, tahun],
                )
                c.execute(
                    f"""
                    INSERT INTO inventarisasi_sumber_daya_alam
                        (provinsi_id, jenis, nama, geometry, luas_ha, kondisi,
                         estimasi_nilai_miliar, tahun_data, sumber_data, detail_json,
                         created_at, updated_at)
                    SELECT p.id, 'MANGROVE', %s, t.geom, t.luas_ha, '',
                           0, %s, %s, %s::jsonb, NOW(), NOW()
                    FROM {TABEL_SINGGAHAN} t
                    JOIN LATERAL (
                        SELECT pr.id
                        FROM inti_provinsi pr
                        WHERE pr.geometry IS NOT NULL
                          AND ST_Intersects(pr.geometry, t.geom)
                        LIMIT 1
                    ) p ON TRUE
                    """,
                    [
                        f'Mangrove GMW {tahun}',
                        tahun,
                        TANDA,
                        '{"sumber": "Global Mangrove Watch v3.0", "lisensi": "CC-BY-4.0"}',
                    ],
                )
                tersimpan = c.rowcount
        return tersimpan, total - tersimpan

    def _rekap(self, tahun):
        with connection.cursor() as c:
            c.execute(
                """
                SELECT pr.nama, COUNT(*), SUM(s.luas_ha)
                FROM inventarisasi_sumber_daya_alam s
                JOIN inti_provinsi pr ON pr.id = s.provinsi_id
                WHERE s.sumber_data = %s AND s.tahun_data = %s
                GROUP BY 1 ORDER BY 3 DESC LIMIT 10
                """,
                [TANDA, tahun],
            )
            for nama, n, luas in c.fetchall():
                self.stdout.write(
                    f'   {nama:26s} {_ribuan(n):>9} poligon  {_ribuan(luas):>12} ha'
                )

    @staticmethod
    def _tahun_dari_nama(jalur):
        for bagian in os.path.basename(jalur).replace('.', '_').split('_'):
            if bagian.isdigit() and len(bagian) == 4 and 1990 < int(bagian) < 2100:
                return int(bagian)
        return None
