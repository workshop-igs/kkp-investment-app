import json
import time

import httpx
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand

from inti.models import Provinsi
from inti.peta_bbox import SimplifyPreserveTopology

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAYER = 'demo:Provinsi_Indonesia'

AMBANG_RINCI = 1000

TOLERANSI_TAMPILAN = 0.001


def ambil(kode, percobaan=4):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(
                WFS,
                params={
                    'service': 'WFS',
                    'version': '1.0.0',
                    'request': 'GetFeature',
                    'typeName': LAYER,
                    'outputFormat': 'application/json',
                    'CQL_FILTER': f"kode_provinsi='{kode}'",
                },
                timeout=600.0,
            )
            r.raise_for_status()
            return r.json().get('features', []), None
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2**ke)
    return None, galat


class Command(BaseCommand):
    help = 'Tarik batas provinsi rinci dari WFS Portal Satu Data KKP.'

    def add_arguments(self, parser):
        parser.add_argument('--kode', help='Satu kode BPS provinsi saja, mis. 51.')
        parser.add_argument(
            '--hitung-ulang-tampilan',
            action='store_true',
            help='Jangan mengunduh; hitung ulang geometry_tampilan saja.',
        )
        parser.add_argument(
            '--lanjutkan',
            action='store_true',
            help=f'Lewati provinsi yang geometrinya sudah lebih dari {AMBANG_RINCI} simpul.',
        )

    def handle(self, *args, **opsi):
        qs = Provinsi.objects.order_by('kode_bps')
        if opsi['kode']:
            qs = qs.filter(kode_bps=opsi['kode'])
        daftar = list(qs)
        if not daftar:
            self.stderr.write('Tidak ada provinsi yang cocok.')
            return

        if opsi['hitung_ulang_tampilan']:
            self._sederhanakan(daftar)
            return

        diperbarui = dilewati = gagal = 0
        mulai = time.time()

        for i, prov in enumerate(daftar, 1):
            if opsi['lanjutkan'] and prov.geometry and prov.geometry.num_points > AMBANG_RINCI:
                dilewati += 1
                continue

            fitur, galat = ambil(prov.kode_bps)
            if fitur is None:
                gagal += 1
                self.stderr.write(f'  {prov.kode_bps} {prov.nama}: gagal — {str(galat)[:80]}')
                continue

            geom = self._satukan(fitur)
            if geom is None:
                gagal += 1
                self.stderr.write(f'  {prov.kode_bps} {prov.nama}: tanpa geometri terpakai.')
                continue

            lama = prov.geometry.num_points if prov.geometry else 0
            prov.geometry = geom

            nama_sumber = (fitur[0].get('properties') or {}).get('nama_provinsi')
            bidang = ['geometry']
            if nama_sumber and nama_sumber.strip() != prov.nama:
                self.stdout.write(self.style.WARNING(
                    f'  {prov.kode_bps}: nama diselaraskan "{prov.nama}" → "{nama_sumber.strip()}"'
                ))
                prov.nama = nama_sumber.strip()[:100]
                bidang.append('nama')

            prov.save(update_fields=bidang)
            diperbarui += 1
            self.stdout.write(
                f'  {i}/{len(daftar)} {prov.kode_bps} {prov.nama}: '
                f'{lama} → {geom.num_points} simpul, {geom.num_geom} bagian '
                f'({time.time() - mulai:.0f}s)'
            )

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'{diperbarui} provinsi diperbarui, {dilewati} dilewati, {gagal} gagal.'
            )
        )
        self._sederhanakan(daftar)
        if diperbarui:
            self.stdout.write('Kosongkan simpanan peta:')
            self.stdout.write(
                '  python manage.py shell -c '
                '"from django.core.cache import cache; cache.clear()"'
            )

    def _sederhanakan(self, daftar):
        self.stdout.write('')
        self.stdout.write(f'Menyusun geometri tampilan (toleransi {TOLERANSI_TAMPILAN})…')
        mulai = time.time()
        n = (
            Provinsi.objects.filter(
                pk__in=[p.pk for p in daftar], geometry__isnull=False
            ).update(
                geometry_tampilan=SimplifyPreserveTopology(
                    'geometry', TOLERANSI_TAMPILAN
                )
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'  {n} provinsi disederhanakan dalam {time.time() - mulai:.0f}s.'
            )
        )

    @staticmethod
    def _tanpa_z(koordinat):
        if koordinat and isinstance(koordinat[0], (int, float)):
            return koordinat[:2]
        return [Command._tanpa_z(k) for k in koordinat]

    @staticmethod
    def _satukan(fitur):
        bagian = []
        for f in fitur:
            gj = f.get('geometry')
            if not gj:
                continue
            gj = {'type': gj['type'], 'coordinates': Command._tanpa_z(gj['coordinates'])}
            geom = GEOSGeometry(json.dumps(gj), srid=4326)
            if not geom.valid:
                geom = geom.buffer(0)
            if geom.geom_type == 'Polygon':
                bagian.append(geom)
            elif geom.geom_type == 'MultiPolygon':
                bagian.extend(list(geom))
        if not bagian:
            return None
        gabungan = MultiPolygon(bagian, srid=4326)
        return gabungan
