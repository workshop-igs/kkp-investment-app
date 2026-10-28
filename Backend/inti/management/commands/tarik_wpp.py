import json
import re
import time

import httpx
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from inti.geospasial import KUNCI_CACHE_WPP

WFS = 'https://portaldata.kkp.go.id/gis/wms'
LAPISAN_WPP = 'demo:WPPNRI_250K'
LAPISAN_PIT = 'demo:ZonaPIT_WPPNRI'
LAPISAN_GARIS = 'demo:WPPNRI_LN'
JUMLAH_WPP = 11
TOLERANSI = 0.001
TOLERANSI_GARIS = 0.002
PENYANGGA_DARAT = 0.03
PENYANGGA_ANTAR = 0.003
PANJANG_SERPIHAN_M = 2000


def _minta(params, percobaan=4):
    for ke in range(percobaan):
        try:
            r = httpx.get(WFS, params={
                'service': 'WFS', 'version': '1.0.0', 'request': 'GetFeature', 'outputFormat': 'application/json',
                **params,
            }, timeout=httpx.Timeout(120.0, connect=20.0))
            r.raise_for_status()
            if not r.text.lstrip().startswith('{'):
                raise ValueError(r.text[:200])
            return r.text
        except (httpx.HTTPError, ValueError):
            if ke == percobaan - 1:
                raise
            time.sleep(2 ** (ke + 1))


def _fitur(params):
    return json.loads(_minta(params)).get('features') or []


def _kode(nama):
    m = re.search(r'\d{3}', nama or '')
    return m.group(0) if m else ''


class Command(BaseCommand):
    help = 'Tarik batas WPP-NRI beserta zona Penangkapan Ikan Terukur dari Portal Satu Data KKP.'

    def handle(self, *args, **opsi):
        mulai = time.time()
        pit = {}
        for f in _fitur({'typeName': LAPISAN_PIT,
                         'propertyName': 'Nama_Objek,Zona_Penangkapan_Ikan_Terukur,Pembagian_Zona'}):
            p = f.get('properties') or {}
            pit[_kode(p.get('Nama_Objek'))] = p

        garis = [baris for f in _fitur({'typeName': LAPISAN_GARIS, 'CQL_FILTER': 'LEFT_FID <> -1'})
                 for baris in (f.get('geometry') or {}).get('coordinates') or []]
        if not garis:
            raise CommandError('Garis batas antar-WPP tidak terbaca; data lama tidak diubah.')

        teks = _minta({'typeName': LAPISAN_WPP})
        self.stdout.write(f'  poligon WPP terunduh ({len(teks) / 1e6:.0f} MB)')

        with transaction.atomic(), connection.cursor() as c:
            c.execute('DELETE FROM inti_wpp_garis')
            c.execute('DELETE FROM inti_wpp')
            c.execute(r"""
                INSERT INTO inti_wpp (kode, perairan, zona_pit, peruntukan_zona, geometry, titik_label, updated_at)
                SELECT kode, perairan, '', '', g, ST_PointOnSurface(g), now() FROM (
                    SELECT substring(f -> 'properties' ->> 'Nama_Objek' FROM '[0-9]{3}') AS kode,
                           left(regexp_replace(regexp_replace(f -> 'properties' ->> 'PERAIRAN',
                                '^\s*Meliputi Perairan\s+', ''), '\s+', ' ', 'g'), 255) AS perairan,
                           ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(
                               ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON((f -> 'geometry')::text), 4326)), %s)), 3)) AS g
                    FROM json_array_elements(%s::json -> 'features') f
                ) s WHERE kode IS NOT NULL
            """, [TOLERANSI, teks])
            del teks
            c.execute('SELECT kode FROM inti_wpp ORDER BY kode')
            kode_wpp = [r[0] for r in c.fetchall()]
            if len(kode_wpp) < JUMLAH_WPP:
                raise CommandError(f'Hanya {len(kode_wpp)} WPP terbaca; data lama tidak diubah.')
            for kode in kode_wpp:
                zona = pit.get(kode, {})
                c.execute('UPDATE inti_wpp SET zona_pit = %s, peruntukan_zona = %s WHERE kode = %s', [
                    (zona.get('Zona_Penangkapan_Ikan_Terukur') or '').strip()[:20],
                    ' '.join((zona.get('Pembagian_Zona') or '').split())[:255], kode,
                ])
            self.stdout.write(f"  {len(kode_wpp)} WPP tersimpan: {', '.join(kode_wpp)}")
            c.execute("""
                UPDATE inti_wpp w SET titik_label = (
                    SELECT CASE WHEN ST_Contains(d.geom, ST_Centroid(d.geom)) THEN ST_Centroid(d.geom)
                                ELSE ST_PointOnSurface(d.geom) END
                    FROM ST_Dump(w.geometry) d ORDER BY ST_Area(d.geom) DESC LIMIT 1)
            """)
            c.execute("""
                INSERT INTO inti_wpp_garis (jenis, geometry)
                SELECT 'ANTAR', ST_Multi(ST_SimplifyPreserveTopology(ST_LineMerge(
                    ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))), %s))
            """, [json.dumps({'type': 'MultiLineString', 'coordinates': garis}), TOLERANSI_GARIS])
            c.execute("""
                INSERT INTO inti_wpp_garis (jenis, geometry)
                SELECT 'LUAR', ST_Multi(ST_Collect(p.geom)) FROM (
                    SELECT ST_CollectionExtract(ST_SimplifyPreserveTopology(
                        ST_Difference(ST_Boundary(u.g), ST_Union(d.g, a.g)), %s), 2) AS g
                    FROM (SELECT ST_Union(geometry) AS g FROM inti_wpp) u,
                         (SELECT ST_Buffer(ST_Union(geometry_tampilan), %s) AS g FROM inti_provinsi) d,
                         (SELECT ST_Buffer(geometry, %s) AS g FROM inti_wpp_garis WHERE jenis = 'ANTAR') a
                ) s, ST_Dump(s.g) p
                WHERE ST_Length(p.geom::geography) >= %s
            """, [TOLERANSI_GARIS, PENYANGGA_DARAT, PENYANGGA_ANTAR, PANJANG_SERPIHAN_M])
            c.execute('SELECT jenis, ST_NPoints(geometry) FROM inti_wpp_garis ORDER BY jenis')
            titik = dict(c.fetchall())
        cache.delete(KUNCI_CACHE_WPP)
        self.stdout.write(self.style.SUCCESS(
            f'Selesai dalam {time.time() - mulai:.0f} dtk: {JUMLAH_WPP} WPP, garis antar-WPP {titik.get("ANTAR")} titik, '
            f'batas terluar {titik.get("LUAR")} titik.'
        ))
