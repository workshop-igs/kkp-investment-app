import time

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.models import RasterRisikoBencana, ZonaRisikoBencana

ATURAN_KELAS = '0.0001-0.334:1-1, 0.334-0.667:2-2, 0.667-1:3-3'
NOMOR_KE_KELAS = {1: 'RENDAH', 2: 'SEDANG', 3: 'TINGGI'}

LUAS_MINIMUM_HA = 0.0


class Command(BaseCommand):
    help = 'Ubah raster risiko bencana menjadi poligon kelas untuk peta.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--jenis',
            choices=[k for k, _ in RasterRisikoBencana.JENIS_CHOICES],
            help='Satu jenis bencana saja.',
        )
        parser.add_argument(
            '--varian',
            choices=[k for k, _ in RasterRisikoBencana.VARIAN_CHOICES],
            default='RISIKO',
            help='RISIKO (bawaan) atau BAHAYA.',
        )
        parser.add_argument(
            '--lanjutkan',
            action='store_true',
            help='Lewati petak yang zonanya sudah dibuat.',
        )

    def handle(self, *args, **opsi):
        jenis_diminta = (
            [opsi['jenis']]
            if opsi['jenis']
            else [k for k, _ in RasterRisikoBencana.JENIS_CHOICES]
        )
        varian = opsi['varian']

        for jenis in jenis_diminta:
            petak = list(
                RasterRisikoBencana.objects.filter(
                    jenis=jenis, varian=varian, rast__isnull=False
                ).values_list('id', flat=True)
            )
            self.stdout.write(
                self.style.MIGRATE_HEADING(f'\n{varian} {jenis}: {len(petak)} petak raster')
            )
            if not petak:
                self.stdout.write(
                    '  Belum ada rasternya. Jalankan tarik_risiko_bencana lebih dulu.'
                )
                continue

            if opsi['lanjutkan']:
                sudah = set(
                    ZonaRisikoBencana.objects.filter(jenis=jenis, varian=varian)
                    .values_list('cakupan', flat=True)
                )
                kotak_sudah = {
                    (round(g.extent[0], 3), round(g.extent[1], 3)) for g in sudah if g
                }
                self.stdout.write(f'  {len(kotak_sudah)} petak sudah divektorkan.')
            else:
                hapus = ZonaRisikoBencana.objects.filter(
                    jenis=jenis, varian=varian
                ).delete()[0]
                self.stdout.write(f'  {hapus} zona lama dihapus.')
                kotak_sudah = set()

            dibuat = dilewati = 0
            mulai = time.time()

            for i, pid in enumerate(petak, 1):
                r = RasterRisikoBencana.objects.filter(pk=pid).only('cakupan').first()
                if r is None or r.cakupan is None:
                    continue
                kunci = (round(r.cakupan.extent[0], 3), round(r.cakupan.extent[1], 3))
                if kunci in kotak_sudah:
                    dilewati += 1
                    continue

                dibuat += self._vektorkan(pid, jenis, varian)

                if i % 50 == 0 or i == len(petak):
                    self.stdout.write(
                        f'  {i}/{len(petak)} petak - {dibuat} zona dibuat, '
                        f'{dilewati} dilewati, {time.time() - mulai:.0f}s'
                    )

            jumlah = ZonaRisikoBencana.objects.filter(
                jenis=jenis, varian=varian
            ).count()
            self.stdout.write(
                self.style.SUCCESS(f'  {varian} {jenis}: {jumlah} zona tersimpan.')
            )

        self.stdout.write('')
        self.stdout.write('Kosongkan simpanan peta agar lapisannya langsung terpakai:')
        self.stdout.write(
            '  python manage.py shell -c "from django.core.cache import cache; cache.clear()"'
        )

    def _vektorkan(self, raster_id: int, jenis: str, varian: str) -> int:
        sql = """
            WITH sumber AS (
                SELECT rast, cakupan FROM analitik_raster_risiko_bencana WHERE id = %s
            ),
            kelas AS (
                SELECT ST_Reclass(rast, 1, %s, '8BUI', 0) AS r, cakupan FROM sumber
            ),
            pecahan AS (
                SELECT (ST_DumpAsPolygons(r)).*, cakupan FROM kelas
            ),
            disaring AS (
                SELECT val, geom, cakupan
                FROM pecahan
                WHERE ST_Area(geom::geography) / 10000.0 >= %s
            ),
            gabung AS (
                SELECT val,
                       ST_Multi(ST_MakeValid(ST_Union(geom))) AS g,
                       MIN(cakupan::text) AS kotak
                FROM disaring
                GROUP BY val
            )
            INSERT INTO analitik_zona_risiko_bencana
                (jenis, varian, kelas, geometry, luas_ha, cakupan, sumber, dibuat_pada)
            SELECT %s, %s,
                   CASE val WHEN 1 THEN 'RENDAH' WHEN 2 THEN 'SEDANG' ELSE 'TINGGI' END,
                   g,
                   ST_Area(g::geography) / 10000.0,
                   kotak::geometry,
                   'BNPB InaRISK',
                   NOW()
            FROM gabung
            WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)
            ON CONFLICT (jenis, varian, kelas, cakupan) DO UPDATE
                SET geometry = EXCLUDED.geometry, luas_ha = EXCLUDED.luas_ha
        """
        try:
            with transaction.atomic(), connection.cursor() as c:
                c.execute(
                    sql, [raster_id, ATURAN_KELAS, LUAS_MINIMUM_HA, jenis, varian]
                )
                return c.rowcount or 0
        except Exception as e:
            self.stderr.write(f'  petak {raster_id} gagal: {str(e)[:110]}')
            return 0
