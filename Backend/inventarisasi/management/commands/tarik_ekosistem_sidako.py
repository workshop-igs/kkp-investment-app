import math
import time

import httpx
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from inti.models import Provinsi
from inventarisasi.models import SumberDayaAlam

WFS = 'https://sidako.kkp.go.id/geoserver/ows'
TAHUN = 2025
SEL_DERAJAT = 0.1

EKOSISTEM = {
    'LAMUN': ('oceanaccounts:spatial_seagrass_2025', 'SIDAKO-LAMUN', 'Padang lamun'),
    'TERUMBU_KARANG': ('oceanaccounts:spatial_coral_2025', 'SIDAKO-KARANG', 'Terumbu karang'),
}


def _ambil(lapisan, params, percobaan=4):
    galat = None
    for ke in range(percobaan):
        try:
            r = httpx.get(WFS, params={'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature',
                                       'typeName': lapisan, 'outputFormat': 'application/json', **params},
                          timeout=300.0)
            r.raise_for_status()
            return r.json()['features']
        except Exception as exc:
            galat = exc
            if ke < percobaan - 1:
                time.sleep(2 ** ke)
    raise galat


def _per_sel(geom):
    sel = {}
    for bagian in geom:
        if bagian.empty:
            continue
        titik = bagian.centroid
        sel.setdefault((math.floor(titik.x / SEL_DERAJAT), math.floor(titik.y / SEL_DERAJAT)), []).append(bagian)
    for kumpulan in sel.values():
        gabung = MultiPolygon(kumpulan, srid=4326)
        if not gabung.valid:
            gabung = gabung.buffer(0)
            if gabung.geom_type == 'Polygon':
                gabung = MultiPolygon(gabung, srid=4326)
        if gabung.geom_type == 'MultiPolygon' and not gabung.empty:
            yield gabung


class Command(BaseCommand):
    help = 'Tarik sebaran padang lamun dan terumbu karang 2025 dari GeoServer Sidako Ekosistem KKP (sidako.kkp.go.id).'

    def add_arguments(self, parser):
        parser.add_argument('--jenis', choices=list(EKOSISTEM), action='append',
                            help='Hanya ekosistem ini (boleh berulang). Bawaan: semua.')

    def handle(self, *args, **opsi):
        for jenis in opsi['jenis'] or list(EKOSISTEM):
            self._tarik(jenis, *EKOSISTEM[jenis])

    def _tarik(self, jenis, lapisan, tanda, label):
        sementara = Provinsi.objects.order_by('kode_bps').first()
        daftar = _ambil(lapisan, {'propertyName': 'provinsi,luas_ha'})
        baris = []
        for i, f in enumerate(daftar, 1):
            fitur = _ambil(lapisan, {'featureID': f['id']})
            if not fitur or not fitur[0].get('geometry'):
                continue
            geom = GEOSGeometry(str(fitur[0]['geometry']).replace("'", '"'), srid=4326)
            if geom.geom_type == 'Polygon':
                geom = MultiPolygon(geom, srid=4326)
            sel = [
                SumberDayaAlam(provinsi=sementara, jenis=jenis, nama=label, geometry=g, tahun_data=TAHUN,
                               sumber_data=tanda, detail_json={'lapisan': lapisan, 'wilayah_sidako': f['properties'].get('provinsi')})
                for g in _per_sel(geom)
            ]
            baris += sel
            self.stdout.write(f'  [{i}/{len(daftar)}] {f["properties"].get("provinsi") or "-":28s} {len(sel):5d} sel')

        with transaction.atomic():
            SumberDayaAlam.objects.filter(sumber_data=tanda).delete()
            if jenis == 'TERUMBU_KARANG':
                SumberDayaAlam.objects.filter(sumber_data='KKP-EKOSISTEM', jenis=jenis).delete()
            SumberDayaAlam.objects.bulk_create(baris, batch_size=500)
            with connection.cursor() as c:
                c.execute(
                    """
                    UPDATE inventarisasi_sumber_daya_alam s
                    SET luas_ha = ST_Area(s.geometry::geography) / 10000,
                        provinsi_id = (
                            SELECT p.id FROM inti_provinsi p WHERE p.geometry IS NOT NULL
                            ORDER BY p.geometry <-> ST_PointOnSurface(s.geometry) LIMIT 1
                        )
                    WHERE s.sumber_data = %s
                    """,
                    [tanda],
                )
                c.execute(
                    'UPDATE inventarisasi_sumber_daya_alam s SET nama = %s || \' \' || p.nama '
                    'FROM inti_provinsi p WHERE s.provinsi_id = p.id AND s.sumber_data = %s',
                    [label, tanda],
                )
        self.stdout.write(self.style.SUCCESS(f'{label}: {len(baris)} sel tersimpan ({tanda}).'))
