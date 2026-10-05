import time

import numpy as np
import requests
from django.contrib.gis.gdal import GDALRaster
from django.contrib.gis.geos import Polygon
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from analitik.models import RasterRisikoBencana
from inti.models import Provinsi

BASE = 'https://gis.bnpb.go.id/server/rest/services/inarisk'

HEADER = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        'Chrome/124 Safari/537.36'
    ),
}

LAYANAN = {
    'BAHAYA': {
        'TSUNAMI': 'layer_bahaya_tsunami',
        'ABRASI': 'layer_bahaya_gelombang_ekstrim_dan_abrasi',
        'BANJIR': 'layer_bahaya_banjir',
    },
    'RISIKO': {
        'TSUNAMI': 'layer_risiko_tsunami',
        'ABRASI': 'layer_risiko_gelombang_ekstrim_dan_abrasi',
        'BANJIR': 'layer_risiko_banjir',
    },
}
JENIS = sorted(LAYANAN['BAHAYA'])

BATAS = (94.0, -11.0, 142.0, 7.0)

PETAK_DERAJAT = 1.0

PIKSEL_PER_DERAJAT = 1100

PELEBARAN_DERAJAT = 1.0

JEDA_DETIK = 0.35

JEDA_SIBUK_DETIK = 45


class Command(BaseCommand):
    help = 'Unduh raster risiko bencana InaRISK ke basis data (sekali jalan).'

    def add_arguments(self, parser):
        parser.add_argument('--jenis', choices=JENIS, help='Satu jenis bencana saja.')
        parser.add_argument(
            '--varian',
            choices=sorted(LAYANAN),
            help='BAHAYA (untuk overlay peta) atau RISIKO (untuk AHP & laporan). '
                 'Bawaan: keduanya.',
        )
        parser.add_argument(
            '--lanjutkan',
            action='store_true',
            help='Lewati petak yang sudah tersimpan (untuk melanjutkan unduhan terputus).',
        )
        parser.add_argument(
            '--jeda',
            type=float,
            default=JEDA_DETIK,
            help=f'Jeda antar permintaan, detik (bawaan {JEDA_DETIK}). Naikkan '
                 f'bila BNPB sering membalas 503.',
        )
        parser.add_argument(
            '--bersihkan',
            action='store_true',
            help='Hapus petak lama untuk jenis yang ditarik sebelum mengunduh.',
        )

    def _petak_kandidat(self):
        self.stdout.write('Menyusun daftar petak (menyaring terhadap batas provinsi)…')
        x1, y1, x2, y2 = BATAS
        semua = [(round(x1 + i * PETAK_DERAJAT, 3), round(y1 + j * PETAK_DERAJAT, 3))
                 for j in range(int((y2 - y1) / PETAK_DERAJAT)) for i in range(int((x2 - x1) / PETAK_DERAJAT))]
        if not Provinsi.objects.exclude(geometry=None).exists():
            self.stderr.write('Batas provinsi belum termuat — seluruh petak akan diunduh.')
            return semua
        with connection.cursor() as c:
            c.execute(
                """
                SELECT t.x, t.y FROM unnest(%s::float8[], %s::float8[]) AS t(x, y)
                WHERE EXISTS (
                    SELECT 1 FROM inti_provinsi p WHERE p.geometry IS NOT NULL
                    AND ST_DWithin(p.geometry, ST_MakeEnvelope(t.x, t.y, t.x + %s, t.y + %s, 4326), %s)
                )
                """,
                [[x for x, _ in semua], [y for _, y in semua], PETAK_DERAJAT, PETAK_DERAJAT, PELEBARAN_DERAJAT],
            )
            lolos = set(c.fetchall())
        terpilih = [t for t in semua if t in lolos]
        semua = len(semua)

        self.stdout.write(f'  {len(terpilih)} dari {semua} petak berpotensi berisi data.\n')
        return terpilih

    @staticmethod
    def _sedang_sibuk(e) -> bool:
        teks = str(e).lower()
        return (
            '503' in teks
            or 'wait timeout' in teks
            or 'timed out' in teks
            or 'timeout' in teks
        )

    def _unduh_dengan_ulangan(self, sesi, layanan, x, y, ulangan=3):
        galat_terakhir = None
        for percobaan in range(ulangan):
            try:
                return self._unduh(sesi, layanan, x, y)
            except Exception as e:
                galat_terakhir = e
                if self._sedang_sibuk(e):
                    tunggu = JEDA_SIBUK_DETIK * (percobaan + 1)
                    self.stdout.write(
                        f'  BNPB sedang sibuk; menunggu {tunggu:.0f}s '
                        f'sebelum mencoba lagi.'
                    )
                    time.sleep(tunggu)
                else:
                    time.sleep(1.5 * (percobaan + 1))
        raise galat_terakhir

    def _unduh(self, sesi, layanan, x, y):
        ukuran = int(PETAK_DERAJAT * PIKSEL_PER_DERAJAT)
        p = {
            'bbox': f'{x},{y},{x + PETAK_DERAJAT},{y + PETAK_DERAJAT}',
            'bboxSR': '4326',
            'imageSR': '4326',
            'size': f'{ukuran},{ukuran}',
            'format': 'tiff',
            'f': 'image',
        }
        r = sesi.get(
            f'{BASE}/{layanan}/ImageServer/exportImage',
            params=p, headers=HEADER, timeout=(6, 90),
        )
        r.raise_for_status()
        if 'image' not in r.headers.get('Content-Type', ''):
            raise ValueError(f'balasan bukan gambar: {r.text[:120]}')
        return r.content

    def handle(self, *args, **opsi):
        jenis_diminta = [opsi['jenis']] if opsi['jenis'] else JENIS
        varian_diminta = [opsi['varian']] if opsi['varian'] else sorted(LAYANAN)
        petak = self._petak_kandidat()

        for varian, jenis in ((v, j) for v in varian_diminta for j in jenis_diminta):
            layanan = LAYANAN[varian][jenis]
            self.stdout.write(self.style.MIGRATE_HEADING(f'\n{varian} {jenis} — {layanan}'))

            if opsi['bersihkan']:
                hapus = RasterRisikoBencana.objects.filter(
                    jenis=jenis, varian=varian
                ).delete()[0]
                self.stdout.write(f'  {hapus} petak lama dihapus.')

            sudah = set()
            if opsi['lanjutkan']:
                for c in RasterRisikoBencana.objects.filter(
                    jenis=jenis, varian=varian
                ).values_list('cakupan', flat=True):
                    if c:
                        sudah.add((round(c.extent[0], 3), round(c.extent[1], 3)))
                self.stdout.write(f'  {len(sudah)} petak sudah tersimpan, dilewati.')

            berisi = kosong = gagal = 0
            mulai = time.time()

            with requests.Session() as sesi:
                for i, (x, y) in enumerate(petak, 1):
                    if (x, y) in sudah:
                        continue
                    try:
                        isi = self._unduh_dengan_ulangan(sesi, layanan, x, y)
                    except Exception as e:
                        gagal += 1
                        self.stderr.write(f'  petak {x},{y} gagal: {str(e)[:90]}')
                        time.sleep(2)
                        continue

                    try:
                        raster = GDALRaster(isi)
                        maks = float(np.asarray(raster.bands[0].data()).max())
                    except Exception as e:
                        gagal += 1
                        self.stderr.write(f'  petak {x},{y} tidak terbaca: {str(e)[:90]}')
                        continue

                    kotak = Polygon.from_bbox((x, y, x + PETAK_DERAJAT, y + PETAK_DERAJAT))
                    kotak.srid = 4326

                    with transaction.atomic():
                        RasterRisikoBencana.objects.update_or_create(
                            jenis=jenis,
                            varian=varian,
                            cakupan=kotak,
                            defaults=dict(
                                rast=raster if maks > 0 else None,
                                nilai_maks=float(maks),
                                layanan=layanan,
                            ),
                        )
                    if maks > 0:
                        berisi += 1
                    else:
                        kosong += 1

                    if i % 10 == 0 or i == len(petak):
                        lewat = time.time() - mulai
                        self.stdout.write(
                            f'  {i}/{len(petak)} petak · berisi {berisi} · kosong {kosong} '
                            f'· gagal {gagal} · {lewat:.0f}s'
                        )
                    time.sleep(opsi['jeda'])

            self.stdout.write(
                self.style.SUCCESS(
                    f'  {varian} {jenis}: {berisi} petak tersimpan, '
                    f'{kosong} kosong dilewati, {gagal} gagal.'
                )
            )

        self.stdout.write('')
        self.stdout.write('Selesai. Kosongkan cache agar pembacaan memakai data lokal:')
        self.stdout.write('  python manage.py shell -c "from django.core.cache import cache; cache.clear()"')
