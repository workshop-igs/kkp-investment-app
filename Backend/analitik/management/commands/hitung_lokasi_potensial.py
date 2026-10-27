import json
import math
import time
from collections import Counter, defaultdict
from functools import partial
from itertools import zip_longest

import numpy as np
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Q

from analitik.models import LokasiPotensial, NilaiWilayahParameter, ParameterTambahan
from analitik.services import pengecualian
from analitik.services.konstanta import (
    GMW_TAHUN_AKHIR,
    KM_PER_DERAJAT,
    KRITERIA_PELENGKAP,
    SEKTOR_TERSENDIRI_DI_PETA,
    UKURAN_SEL_LOKASI_DERAJAT,
)
from analitik.services.kriteria import (
    BATAS_JARAK_ZONA_DERAJAT,
    BENCANA,
    INFRA,
    JARAK_ZONA,
    KARANG,
    PARAMETER,
    RASTER_DATA,
    cek,
    dari_raster,
    karang_dari_jarak,
    kedekatan,
    sumber_tersedia,
    syarat_unggulan,
    teks_ambang,
    teks_nilai,
    wajib,
)
from analitik.services.oseanografi import nilai_titik
from analitik.services.parameter_tambahan import sesuai_ambang
from analitik.services.pengaturan import atur
from analitik.services.profil_investasi import _saring_sumber_utama
from analitik.services.screening_ruang import BOLEH, LABEL_ADAT, _aturan_per_sektor, _ketentuan, screening_ruang
from inti.models import Provinsi, SektorInvestasi
from inventarisasi.klasifikasi import jenis_unsur
from inventarisasi.models import ZonasiRuangLaut

LABEL_SUB_ZONA = dict(ZonasiRuangLaut.SUB_ZONA_CHOICES)
PERINGKAT_BENCANA = {1: 'RENDAH', 2: 'SEDANG', 3: 'TINGGI'}
JANGKAU_ALUR_DERAJAT = 0.7

SEL = """
CREATE TEMP TABLE sel AS
SELECT row_number() OVER ()::int AS id, g.geom AS kotak, ST_Centroid(g.geom) AS titik
FROM (
    SELECT DISTINCT ON (q.i, q.j) q.geom
    FROM zona_sel z CROSS JOIN LATERAL ST_SquareGrid(%s, z.g) q
    WHERE z.kandidat AND ST_Intersects(z.g, ST_Centroid(q.geom))
    ORDER BY q.i, q.j
) g
"""

INTI = """
SELECT q.k, ST_AsEWKB(ST_Multi(q.g)), ST_Area(q.g::geography) / 10000
FROM (
    SELECT u.k, ST_Union(s.kotak, 1e-9) AS g
    FROM unnest(%s::int[], %s::int[]) AS u(k, id) JOIN sel s ON s.id = u.id
    GROUP BY u.k
) q
"""

WILAYAH = """
SELECT q.k, ST_AsEWKB(ST_Multi(ST_SimplifyPreserveTopology(q.g, %s)))
FROM (
    SELECT u.k, ST_Union(s.kotak, 1e-9) AS g
    FROM unnest(%s::int[], %s::int[]) AS u(k, id) JOIN sel s ON s.id = u.id
    GROUP BY u.k
) q
"""

WILAYAH_GABUNGAN = """
SELECT ST_AsEWKB(q.g), ST_Area(q.g::geography) / 10000
FROM (SELECT ST_Multi(ST_CollectionExtract(ST_Union(wilayah, 1e-9), 3)) AS g
      FROM analitik_lokasi_potensial WHERE id = ANY(%s)) q
"""


def multipoligon(g):
    return MultiPolygon([g] if g.geom_type == 'Polygon' else [p for p in g if p.geom_type == 'Polygon'], srid=g.srid)

GABUNGAN = """
WITH a AS MATERIALIZED (SELECT id, geometry AS g FROM analitik_lokasi_potensial WHERE id = ANY(%s)),
p AS MATERIALIZED (
    SELECT row_number() OVER () AS i, d.g FROM (SELECT (ST_Dump(ST_Union(a.g, 1e-9))).geom AS g FROM a) d
)
SELECT p.i, ST_AsEWKB(ST_Multi(p.g)), ST_Area(p.g::geography) / 10000, a.id,
       ST_X(ST_PointOnSurface(p.g)), ST_Y(ST_PointOnSurface(p.g))
FROM p JOIN a ON a.g && p.g AND ST_Intersects(a.g, p.g)
"""

TERDEKAT = """
SELECT s.id, (SELECT ST_Distance(t.g, s.{kolom}) FROM {tabel} t {saring} ORDER BY t.g <-> s.{kolom} LIMIT 1)
FROM sel s WHERE s.id = ANY(%s)
"""


def siapkan_infra_terbagi(c):
    c.execute('DROP TABLE IF EXISTS infra_terbagi')
    c.execute(
        f'CREATE TEMP TABLE infra_terbagi AS SELECT kategori, ST_Subdivide(ST_MakeValid(geometry), 128) AS g '
        f'FROM {INFRA} i WHERE ST_Dimension(geometry) > 0 '
        f'UNION ALL SELECT kategori, (ST_Dump(geometry)).geom FROM {INFRA} i WHERE ST_Dimension(geometry) = 0'
    )
    c.execute('SELECT DISTINCT kategori FROM infra_terbagi')
    for (kategori,) in c.fetchall():
        c.execute('CREATE INDEX ON infra_terbagi USING gist (g) WHERE kategori = %s', [kategori])
    c.execute('ANALYZE infra_terbagi')


def _di_area(i, kena, dalam):
    return (i in kena) == dalam


def _tetap(i, nilai):
    return nilai


def _per_kabupaten(i, per_kab, kabupaten):
    return per_kab.get(kabupaten.get(i))


class Command(BaseCommand):
    help = (
        'Bentuk Peta Sebaran Wilayah Potensial Investasi: zona yang peruntukannya mengizinkan dibagi ke sel 250 m; '
        'sel harus lolos gerbang (matriks Perda, wilayah adat, alur pelayaran/ALKI, ekosistem sensitif, jarak aman '
        'kabel/pipa/alur, KKPRL, bangunan) lalu memenuhi batas unggulan seluruh kriteria sub-sektor; kriteria yang '
        'datanya tersedia wajib terukur di sel itu dan sedikitnya separuh kriteria terukur. Skor mutu sel = rata-rata '
        'kedekatan nilai kriteria ke kondisi ideal, dikali bobot zona bersyarat; sel di bawah skor minimal dibuang. '
        'Sel yang bersebelahan digabung dan untuk setiap jenis hanya lokasi berskor mutu tertinggi dalam radius jarak '
        'antartitik yang disimpan.'
    )

    stealth_options = ('progres', 'selesai')

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', help='Kode BPS provinsi, dipisah koma')

    def handle(self, *args, **opsi):
        provinsi = Provinsi.objects.order_by('kode_bps')
        if opsi['provinsi']:
            provinsi = provinsi.filter(kode_bps__in=opsi['provinsi'].split(','))
        self.sektor = list(SektorInvestasi.objects.filter(aktif=True).order_by('kode'))
        self.aturan = _aturan_per_sektor()
        with connection.cursor() as c:
            c.execute('DROP TABLE IF EXISTS darat_terbagi')
            c.execute(
                'CREATE TEMP TABLE darat_terbagi AS '
                'SELECT ST_Subdivide(ST_MakeValid(ST_SimplifyPreserveTopology(ST_MakeValid(geometry), 0.0005)), 128, 1e-7) AS g '
                'FROM inti_provinsi WHERE geometry IS NOT NULL'
            )
            c.execute('CREATE INDEX ON darat_terbagi USING gist (g)')
            if 'jarak_dari_pantai_km' in self._kunci_dipakai():
                c.execute('DROP TABLE IF EXISTS pantai_terbagi')
                c.execute(
                    'CREATE TEMP TABLE pantai_terbagi AS SELECT ST_Subdivide(ST_Boundary(ST_MakeValid(geometry)), 128) AS g '
                    'FROM inti_provinsi WHERE geometry IS NOT NULL'
                )
                c.execute('CREATE INDEX ON pantai_terbagi USING gist (g)')
            siapkan_infra_terbagi(c)
        total = Counter()
        daftar = list(provinsi)
        for i, prov in enumerate(daftar, 1):
            if opsi.get('progres'):
                opsi['progres'](i, len(daftar), prov.nama)
            t = time.time()
            jumlah = self._provinsi(prov)
            if opsi.get('selesai'):
                opsi['selesai']([p.kode_bps for p in daftar[i:]])
            total.update(jumlah)
            if jumlah:
                self.stdout.write(
                    f'  {prov.nama:28s} {sum(jumlah.values()):6d} lokasi ({time.time() - t:.0f} dtk) {dict(jumlah)}'
                )
        self.stdout.write(self.style.SUCCESS(f'Lokasi per jenis: {dict(total.most_common())}'))
        self._seleksi_nasional()

    def _provinsi(self, prov):
        zona = {
            z[0]: z for z in _saring_sumber_utama(ZonasiRuangLaut.objects.filter(provinsi=prov), prefiks='')
            .values_list('id', 'sub_zona', 'jenis_zona', 'ranah', 'nama_zona', 'matriks_id')
        }
        status = {
            (zid, s.kode): _ketentuan(
                self.aturan.get(s.id, {}),
                {'jenis_zona': jenis, 'sub_zona': sub, 'provinsi_id': prov.id, 'matriks_id': matriks_id},
            )['status']
            for zid, sub, jenis, _, _, matriks_id in zona.values() for s in self.sektor
        }
        kandidat = [zid for zid in zona if any(status[(zid, s.kode)] in BOLEH for s in self.sektor)]
        if not kandidat:
            with transaction.atomic():
                LokasiPotensial.objects.filter(provinsi=prov).delete()
            return Counter()

        with connection.cursor() as c:
            c.execute('DROP TABLE IF EXISTS zona_sel, sel, bencana_sel, alur_sel, unsur_sel, alur_jarak')
            c.execute(
                'CREATE TEMP TABLE zona_sel AS SELECT id, id = ANY(%s) AS kandidat, '
                'ST_Subdivide(ST_MakeValid(geometry), 256, 1e-9) AS g '
                'FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s)',
                [kandidat, list(zona)],
            )
            c.execute('CREATE INDEX ON zona_sel USING gist (g)')
            c.execute(SEL, [UKURAN_SEL_LOKASI_DERAJAT])
            c.execute('CREATE INDEX ON sel USING gist (kotak)')
            c.execute('CREATE INDEX ON sel USING gist (titik)')
            c.execute('ANALYZE sel')
            c.execute('SELECT count(*), ST_AsEWKT(ST_SetSRID(ST_Extent(kotak)::geometry, 4326)) FROM sel')
            banyak, cakupan = c.fetchone()
            data = self._data_sel(c, banyak, cakupan, prov)
            lokasi = self._lokasi(c, prov, zona, status, data)
        return Counter(lok.sektor.kode for lok in lokasi)

    def _kunci_dipakai(self):
        return {k for s in self.sektor for sub in atur('KRITERIA_JENIS').get(s.kode, {}).values() for k in syarat_unggulan(sub)}

    def _data_sel(self, c, banyak, cakupan, prov):
        d = {k: [None] * (banyak + 1) for k in ('zona', 'ekosistem', 'bencana', 'jarak_pantai_km', *RASTER_DATA)}
        d['tersedia'] = sumber_tersedia()
        dipakai = self._kunci_dipakai()

        c.execute(
            """
            SELECT s.id, array_agg(DISTINCT z.id),
                   ST_Area(ST_Intersection(s.kotak, ST_Union(z.g, 1e-9), 1e-9)) / ST_Area(s.kotak)
            FROM sel s JOIN zona_sel z ON z.g && s.kotak AND ST_Intersects(z.g, s.kotak)
            GROUP BY s.id, s.kotak
            """
        )
        for i, zids, tertutup in c.fetchall():
            if tertutup >= atur('AMBANG_CAKUPAN_ACUAN'):
                d['zona'][i] = zids
        calon = [i for i in range(1, banyak + 1) if d['zona'][i]]

        c.execute('SELECT id, ST_X(titik), ST_Y(titik) FROM sel WHERE id = ANY(%s)', [calon])
        titik = np.array(c.fetchall(), dtype=float).reshape(-1, 3)
        for kunci, raster in RASTER_DATA.items():
            if raster not in d['tersedia']:
                continue
            for i, v in zip(titik[:, 0].astype(int), nilai_titik(raster, titik[:, 1], titik[:, 2])):
                if not np.isnan(v):
                    d[kunci][i] = dari_raster(kunci, float(v))

        c.execute(TERDEKAT.format(kolom='kotak', tabel='darat_terbagi', saring=''), [calon])
        for i, jarak in c.fetchall():
            d['jarak_pantai_km'][i] = jarak * KM_PER_DERAJAT if jarak is not None else None
        if 'jarak_dari_pantai_km' in dipakai:
            c.execute(TERDEKAT.format(kolom='titik', tabel='pantai_terbagi', saring=''), [calon])
            d['jarak_dari_pantai_km'] = [None] * (banyak + 1)
            for i, jarak in c.fetchall():
                d['jarak_dari_pantai_km'][i] = jarak * KM_PER_DERAJAT if jarak is not None else None

        c.execute(
            """
            SELECT s.id, array_agg(DISTINCT e.jenis) FROM sel s JOIN inventarisasi_sumber_daya_alam e
              ON e.geometry && s.kotak AND ST_Intersects(e.geometry, s.kotak)
             AND (e.sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG')
                  OR (e.sumber_data = 'GMW-MANGROVE' AND e.tahun_data = %s))
            GROUP BY s.id
            """,
            [GMW_TAHUN_AKHIR],
        )
        for i, jenis in c.fetchall():
            d['ekosistem'][i] = frozenset(jenis)

        if 'karang' in dipakai and 'TERUMBU_KARANG' in d['tersedia']:
            c.execute('DROP TABLE IF EXISTS karang_terbagi')
            c.execute(
                f'CREATE TEMP TABLE karang_terbagi AS SELECT ST_Subdivide(ST_MakeValid(geometry), 128) AS g '
                f'FROM inventarisasi_sumber_daya_alam WHERE {KARANG} AND geometry && ST_Expand(%s::geometry, %s)',
                [cakupan, atur('KARANG_TERPETAKAN_KM') / KM_PER_DERAJAT],
            )
            c.execute('CREATE INDEX ON karang_terbagi USING gist (g)')
            c.execute(TERDEKAT.format(kolom='kotak', tabel='karang_terbagi', saring=''), [calon])
            d['karang'] = [None] * (banyak + 1)
            for i, jarak in c.fetchall():
                d['karang'][i] = karang_dari_jarak(None if jarak is None else jarak * KM_PER_DERAJAT)

        km = {}
        for kategori in sorted({k for kunci in dipakai if isinstance(PARAMETER[kunci][2], tuple)
                                for k in PARAMETER[kunci][2]} & d['tersedia']):
            c.execute(
                TERDEKAT.format(kolom='titik', tabel='infra_terbagi', saring='WHERE t.kategori = %s'),
                [kategori, calon],
            )
            km[kategori] = {i: jarak * KM_PER_DERAJAT for i, jarak in c.fetchall() if jarak is not None}
        for kunci in dipakai:
            sumber = PARAMETER[kunci][2]
            if not isinstance(sumber, tuple) or not set(sumber) & set(km):
                continue
            d[kunci] = [None] * (banyak + 1)
            for i in calon:
                ada = [km[k][i] for k in sumber if i in km.get(k, {})]
                d[kunci][i] = min(ada) if ada else None
        for kunci, sub_zona in JARAK_ZONA.items():
            if kunci not in dipakai:
                continue
            c.execute('DROP TABLE IF EXISTS zona_jarak')
            c.execute(
                'CREATE TEMP TABLE zona_jarak AS SELECT ST_Subdivide(ST_MakeValid(geometry), 256, 1e-9) AS g '
                'FROM inventarisasi_zonasi_ruang_laut WHERE sub_zona = ANY(%s) AND geometry && ST_Expand(%s::geometry, %s)',
                [sub_zona, cakupan, BATAS_JARAK_ZONA_DERAJAT],
            )
            c.execute('CREATE INDEX ON zona_jarak USING gist (g)')
            c.execute(TERDEKAT.format(kolom='titik', tabel='zona_jarak', saring=''), [calon])
            d[kunci] = [None] * (banyak + 1)
            for i, jarak in c.fetchall():
                if jarak is not None and jarak <= BATAS_JARAK_ZONA_DERAJAT:
                    d[kunci][i] = jarak * KM_PER_DERAJAT

        c.execute(
            f'CREATE TEMP TABLE alur_sel AS SELECT ST_Subdivide(ST_MakeValid(z.geometry), 256, 1e-9) AS g '
            f'FROM inventarisasi_zonasi_ruang_laut z WHERE z.geometry && %s::geometry AND {pengecualian.ZONA_ALUR}',
            [cakupan],
        )
        c.execute('CREATE INDEX ON alur_sel USING gist (g)')
        if 'jarak_alur_km' in dipakai:
            self._jarak_alur(c, cakupan, calon, d, banyak)
        unsur = pengecualian.unsur_terlarang(c, cakupan)
        c.execute(
            'CREATE TEMP TABLE unsur_sel AS SELECT b.kode, '
            'ST_Subdivide(ST_Buffer(u.geometry::geography, b.m)::geometry, 256, 1e-9) AS g '
            'FROM unnest(%s::int[], %s::text[], %s::float8[]) AS b(id, kode, m) '
            'JOIN inventarisasi_unsur_ruang_laut u ON u.id = b.id',
            [[u[0] for u in unsur], [u[1] for u in unsur], [u[2] for u in unsur]],
        )
        c.execute('CREATE INDEX ON unsur_sel USING gist (g)')

        c.execute(
            'CREATE TEMP TABLE bencana_sel AS SELECT jenis, kelas, ST_Subdivide(ST_MakeValid(geometry), 256, 1e-9) AS g '
            "FROM analitik_zona_risiko_bencana WHERE varian = 'RISIKO' AND geometry && %s::geometry",
            [cakupan],
        )
        c.execute('CREATE INDEX ON bencana_sel USING gist (g)')
        c.execute(
            """
            SELECT s.id, r.jenis, MAX(CASE r.kelas WHEN 'TINGGI' THEN 3 WHEN 'SEDANG' THEN 2 ELSE 1 END)
            FROM sel s JOIN bencana_sel r ON r.g && s.kotak AND ST_Intersects(r.g, s.kotak)
            GROUP BY 1, 2
            """
        )
        for i, jenis, peringkat in c.fetchall():
            d['bencana'][i] = {**(d['bencana'][i] or {}), jenis: PERINGKAT_BENCANA[peringkat]}

        def himpunan(sql, param=()):
            c.execute(sql, list(param))
            return {r[0] for r in c.fetchall()}

        d['kkprl'] = himpunan(
            "SELECT DISTINCT s.id FROM sel s JOIN inventarisasi_kkprl k ON k.status = 'AKTIF' "
            'AND k.geometry && s.kotak AND ST_Intersects(k.geometry, s.kotak)'
        )
        d['bangunan'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN inventarisasi_bangunan_eksisting b '
            'ON b.geometry && s.kotak AND ST_Intersects(b.geometry, s.kotak)'
        )
        d['alur'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN alur_sel k ON k.g && s.kotak AND ST_Intersects(k.g, s.kotak)'
        )
        d['unsur'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN unsur_sel u ON u.g && s.kotak AND ST_Intersects(u.g, s.kotak)'
        )
        d['unsur_tanpa_alur'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN unsur_sel u ON u.g && s.kotak AND ST_Intersects(u.g, s.kotak) '
            "AND u.kode <> 'ALUR_PELAYARAN'"
        )
        radius = atur('RADIUS_ADAT_DEKAT_M') / 1000 / KM_PER_DERAJAT
        c.execute('DROP TABLE IF EXISTS adat_terbagi')
        c.execute(
            "CREATE TEMP TABLE adat_terbagi AS SELECT ST_Subdivide(ST_MakeValid(geometry), 128) AS g "
            "FROM inventarisasi_unsur_ruang_laut WHERE kelompok = 'MHA' AND geometry && ST_Expand(%s::geometry, %s)",
            [cakupan, radius],
        )
        c.execute('CREATE INDEX ON adat_terbagi USING gist (g)')
        d['adat'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN adat_terbagi u ON u.g && s.kotak AND ST_Intersects(u.g, s.kotak)'
        )
        d['adat_dekat'] = himpunan(
            'SELECT DISTINCT s.id FROM sel s JOIN adat_terbagi u '
            'ON u.g && ST_Expand(s.kotak, %s) AND ST_DWithin(u.g, s.kotak, %s)',
            [radius, radius],
        ) - d['adat']
        c.execute(
            'SELECT id, floor(ST_X(titik) / %s)::int, floor(ST_Y(titik) / %s)::int FROM sel',
            [UKURAN_SEL_LOKASI_DERAJAT, UKURAN_SEL_LOKASI_DERAJAT],
        )
        d['ij'] = {i: (x, y) for i, x, y in c.fetchall()}
        d['banyak'] = banyak
        d['tambahan'] = self._tambahan(c, prov, d)
        return d

    @staticmethod
    def _jarak_alur(c, cakupan, calon, d, banyak):
        c.execute(
            f'CREATE TEMP TABLE alur_jarak AS SELECT ST_Subdivide(ST_MakeValid(z.geometry), 256, 1e-9) AS g '
            f'FROM inventarisasi_zonasi_ruang_laut z WHERE z.geometry && ST_Expand(%s::geometry, %s) '
            f'AND {pengecualian.ZONA_ALUR}',
            [cakupan, JANGKAU_ALUR_DERAJAT],
        )
        c.execute(
            "SELECT id, nama, jenis, keterangan, kode_lapisan FROM inventarisasi_unsur_ruang_laut "
            "WHERE kelompok = 'RTRL' AND geometry && ST_Expand(%s::geometry, %s)",
            [cakupan, JANGKAU_ALUR_DERAJAT],
        )
        garis = [uid for uid, *teks in c.fetchall() if jenis_unsur(*teks) == 'ALUR_PELAYARAN']
        c.execute('INSERT INTO alur_jarak SELECT geometry FROM inventarisasi_unsur_ruang_laut WHERE id = ANY(%s)', [garis])
        c.execute('CREATE INDEX ON alur_jarak USING gist (g)')
        c.execute(TERDEKAT.format(kolom='titik', tabel='alur_jarak', saring=''), [calon])
        d['jarak_alur_km'] = [None] * (banyak + 1)
        for i, jarak in c.fetchall():
            d['jarak_alur_km'][i] = jarak * KM_PER_DERAJAT if jarak is not None else None

    def _tambahan(self, c, prov, d):
        hasil, kabupaten = [], None
        for p in ParameterTambahan.objects.filter(aktif=True, peran__in=['GERBANG', 'DINILAI']).filter(
            Q(provinsi__isnull=True) | Q(provinsi=prov)
        ).prefetch_related('sektor').distinct():
            if p.tipe == 'AREA':
                kolom = 'titik' if p.kondisi == 'DI_DALAM' else 'kotak'
                c.execute(
                    f'SELECT DISTINCT s.id FROM sel s JOIN analitik_area_parameter a ON a.parameter_id = %s '
                    f'AND a.geometry && s.{kolom} AND ST_Intersects(a.geometry, s.{kolom})',
                    [p.id],
                )
                kena = {r[0] for r in c.fetchall()}
                if not kena and not p.area.exists():
                    continue
                dalam = p.kondisi == 'DI_DALAM'
                fungsi = partial(_di_area, kena=kena, dalam=dalam)
            elif p.tingkat == 'PROVINSI':
                v = NilaiWilayahParameter.objects.filter(parameter=p, provinsi=prov).values_list('nilai', flat=True).first()
                tetap = None if v is None else sesuai_ambang(p, v)
                fungsi = partial(_tetap, nilai=tetap)
            else:
                if kabupaten is None:
                    kabupaten = self._kabupaten_sel(c, prov, d)
                per_kab = {k: sesuai_ambang(p, v) for k, v in NilaiWilayahParameter.objects.filter(
                    parameter=p, kabupaten__provinsi=prov).values_list('kabupaten_id', 'nilai')}
                fungsi = partial(_per_kabupaten, per_kab=per_kab, kabupaten=kabupaten)
            hasil.append((p.nama, p.peran, {s.kode for s in p.sektor.all()}, fungsi))
        return hasil

    @staticmethod
    def _kabupaten_sel(c, prov, d):
        calon = [i for i in range(1, d['banyak'] + 1) if d['zona'][i] and i not in d['kkprl'] and i not in d['bangunan']]
        c.execute(
            'SELECT s.id, (SELECT k.id FROM inti_kabupaten_kota k WHERE k.provinsi_id = %s AND k.geometry IS NOT NULL '
            'ORDER BY k.geometry <-> s.titik LIMIT 1) FROM sel s WHERE s.id = ANY(%s)',
            [prov.id, calon],
        )
        return dict(c.fetchall())

    @staticmethod
    def _nilai_kriteria(kunci, i, d):
        v = d[kunci][i] if kunci in d else None
        return None if v is None else round(v, 2)

    @staticmethod
    def _cocok(kriteria, layak, nilai, bencana, tambahan, harus, minimal):
        mutu = []
        for (k, ambang), v, perlu, batas in zip(kriteria, nilai, harus, layak):
            hasil = cek(k, v, ambang)
            if hasil is False:
                return None
            if hasil is None:
                if perlu and v is None:
                    return None
                continue
            mutu.append(kedekatan(k, v, ambang, batas))
        if len(mutu) < minimal or any(kelas == 'TINGGI' for _, kelas in bencana) or False in tambahan:
            return None
        return 100 * sum(mutu) / len(mutu) if mutu else 0.0

    def _nilai_sel(self, sektor, sub, zona, status, d):
        berlaku = [t for t in d['tambahan'] if not t[2] or sektor.kode in t[2]]
        gerbang = [f for _, peran, _, f in berlaku if peran == 'GERBANG']
        dinilai = [f for _, peran, _, f in berlaku if peran == 'DINILAI']
        tanpa_alur = pengecualian.alur_terlarang(sektor.kode)
        unsur = d['unsur'] if tanpa_alur else d['unsur_tanpa_alur']
        ekosistem_terlarang = pengecualian.ekosistem_terlarang(sektor.kode)
        kriteria = list(syarat_unggulan(sub).items())
        layak = tuple(sub['kriteria'].get(k) for k, _ in kriteria)
        harus = tuple(wajib(k, d['tersedia']) for k, _ in kriteria)
        minimal = math.ceil(atur('PROPORSI_MINIMAL_KRITERIA_TERUKUR') * len(kriteria))
        bobot, skor_minimal = atur('BOBOT_RUANG_BERSYARAT'), atur('SKOR_MINIMAL_LOKASI_UNGGULAN')
        khusus = {r: any(status[(z, sektor.kode)] == 'DIIZINKAN' for z in zona if zona[z][3] == r) for r in sub['ranah']}
        tembolok, lolos = {}, {}
        for i in range(1, d['banyak'] + 1):
            zids = d['zona'][i]
            if not zids or i in d['kkprl'] or i in d['bangunan'] or i in unsur or i in d['adat']:
                continue
            if (tanpa_alur and i in d['alur']) or (d['ekosistem'][i] or frozenset()) & ekosistem_terlarang:
                continue
            st = {status[(z, sektor.kode)] for z in zids}
            ranah = {zona[z][3] for z in zids}
            if not st <= set(BOLEH) or len(ranah) != 1 or not ranah <= set(sub['ranah']) or any(f(i) is False for f in gerbang):
                continue
            kena = ranah == {'DARAT'} or (d['jarak_pantai_km'][i] or 0) <= 0
            kunci = (
                tuple(self._nilai_kriteria(k, i, d) for k, _ in kriteria),
                tuple(sorted((d['bencana'][i] or {}).items())) if kena else (),
                tuple(f(i) for f in dinilai),
            )
            if kunci not in tembolok:
                tembolok[kunci] = self._cocok(kriteria, layak, *kunci, harus, minimal)
            if tembolok[kunci] is None:
                continue
            skor = tembolok[kunci] * (bobot if 'BERSYARAT' in st and khusus[next(iter(ranah))] else 1)
            if skor >= skor_minimal:
                lolos[i] = (skor, kunci[0], kunci[1])
        return lolos

    @staticmethod
    def _wilayah(lolos, ij):
        indeks = {ij[i]: i for i in lolos}
        terlihat, wilayah = set(), []
        for awal in lolos:
            if awal in terlihat:
                continue
            terlihat.add(awal)
            antre, anggota = [awal], []
            while antre:
                i = antre.pop()
                anggota.append(i)
                x, y = ij[i]
                for tetangga in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = indeks.get(tetangga)
                    if j is not None and j not in terlihat:
                        terlihat.add(j)
                        antre.append(j)
            wilayah.append(anggota)
        return wilayah

    @staticmethod
    def _mutu(sel, lolos):
        return sum(lolos[i][0] for i in sel) / len(sel), len(sel)

    def _inti(self, wilayah, lolos, d):
        blok = {}
        for i in wilayah:
            x, y = d['ij'][i]
            blok.setdefault((x // atur('SEL_PER_SISI_INTI_LOKASI'), y // atur('SEL_PER_SISI_INTI_LOKASI')), []).append(i)
        return max(blok.values(), key=lambda sel: self._mutu(sel, lolos))

    @staticmethod
    def _bergiliran(calon):
        per_sub = defaultdict(list)
        for c in sorted(calon, key=lambda c: c[0], reverse=True):
            per_sub[c[3][2]].append(c)
        return [c for giliran in zip_longest(*per_sub.values()) for c in giliran if c]

    @staticmethod
    def _tersebar(calon):
        batas = (atur('JARAK_ANTAR_LOKASI_KM') / KM_PER_DERAJAT) ** 2
        pusat, hasil = [], []
        for _, x, y, isi in calon:
            if all((x - a) ** 2 + (y - b) ** 2 >= batas for a, b in pusat):
                pusat.append((x, y))
                hasil.append(isi)
        return hasil

    def _lokasi(self, c, prov, zona, status, d):
        hasil = []
        for sektor in self.sektor:
            calon = []
            for sub_kode, sub in atur('KRITERIA_JENIS').get(sektor.kode, {}).items():
                lolos = self._nilai_sel(sektor, sub, zona, status, d)
                for w in self._wilayah(lolos, d['ij']):
                    sel = self._inti(w, lolos, d)
                    calon.append((
                        self._mutu(sel, lolos),
                        sum(d['ij'][i][0] for i in sel) / len(sel) * UKURAN_SEL_LOKASI_DERAJAT,
                        sum(d['ij'][i][1] for i in sel) / len(sel) * UKURAN_SEL_LOKASI_DERAJAT,
                        (sel, w, sub_kode, sub, lolos),
                    ))
            inti = self._tersebar(self._bergiliran(calon))[:atur('MAKS_LOKASI_PER_PROVINSI')]
            if not inti:
                continue
            c.execute(INTI, [[k for k, t in enumerate(inti) for _ in t[0]], [i for t in inti for i in t[0]]])
            bentuk = c.fetchall()
            c.execute(WILAYAH, [UKURAN_SEL_LOKASI_DERAJAT / 2, [k for k, t in enumerate(inti) for _ in t[1]],
                                [i for t in inti for i in t[1]]])
            wilayah = dict(c.fetchall())
            for k, ewkb, luas in bentuk:
                sel, w, sub_kode, sub, lolos = inti[k]
                hasil.append(self._satu(prov, sektor, sub_kode, sub, ewkb, wilayah[k], luas, sel, len(w), lolos, zona,
                                        status, d))
        with transaction.atomic():
            LokasiPotensial.objects.filter(provinsi=prov).delete()
            LokasiPotensial.objects.bulk_create(hasil)
            LokasiPotensial.objects.bulk_create(
                self._semua(c, prov, [h for h in hasil if h.sektor.kode not in SEKTOR_TERSENDIRI_DI_PETA])
            )
        return hasil

    def _satu(self, prov, sektor, sub_kode, sub, ewkb, ewkb_wilayah, luas, sel, sel_wilayah, lolos, zona, status, d):
        kriteria, syarat = [], syarat_unggulan(sub)
        for j, (kunci, ambang) in enumerate(syarat.items()):
            nilai = [lolos[i][1][j] for i in sel if lolos[i][1][j] is not None]
            rata = sum(nilai) / len(nilai) if nilai else None
            mutu = kedekatan(kunci, rata, ambang, sub['kriteria'].get(kunci))
            kriteria.append({'label': PARAMETER[kunci][0], 'nilai_teks': teks_nilai(kunci, rata),
                             'ambang_teks': teks_ambang(kunci, ambang), 'lulus': cek(kunci, rata, ambang),
                             'mutu': None if mutu is None else round(100 * mutu),
                             'pelengkap': kunci in KRITERIA_PELENGKAP})
        terukur = sum(k['lulus'] is True for k in kriteria)
        bencana = {jenis for i in sel for jenis, _ in lolos[i][2]}
        kriteria += [{'label': label, 'nilai_teks': None, 'ambang_teks': 'rendah–sedang', 'lulus': True}
                     for jenis, label in BENCANA if jenis in bencana]
        zona_utama = Counter(z for i in sel for z in d['zona'][i]).most_common(1)[0][0]
        bersyarat = any(status[(z, sektor.kode)] == 'BERSYARAT' for i in sel for z in d['zona'][i])
        inti = GEOSGeometry(memoryview(ewkb))
        return LokasiPotensial(
            sektor=sektor, provinsi=prov, geometry=inti,
            wilayah=multipoligon(GEOSGeometry(memoryview(ewkb_wilayah)).union(inti)), luas_ha=luas,
            persen_sesuai=sum(lolos[i][0] for i in sel) / len(sel), jenis=[sektor.kode],
            rincian={
                'nama': zona[zona_utama][4],
                'sub_zona': LABEL_SUB_ZONA.get(zona[zona_utama][1], zona[zona_utama][1]),
                'ranah': zona[zona_utama][3],
                'sektor': sektor.nama,
                'sub_sektor': sub['nama'],
                'sub_sektor_kode': sub_kode,
                'jumlah_sel': len(sel),
                'luas_wilayah_ha': round(luas / len(sel) * sel_wilayah),
                'status_tata_ruang': 'BERSYARAT' if bersyarat else 'DIIZINKAN',
                'syarat_dasar': [LABEL_ADAT, *(pengecualian.label(p, sektor.kode) for p in pengecualian.berlaku(sektor.kode))],
                'kriteria': kriteria,
                'terukur': terukur,
                'total': len(syarat),
                'perlu_dinilai': [k['label'] for k in kriteria if k['lulus'] is None],
                'peringatan': [
                    'Dekat wilayah kelola masyarakat hukum adat: berisiko konflik tenurial, libatkan masyarakat adat '
                    'sejak awal.'
                ] if any(i in d['adat_dekat'] for i in sel) else [],
            },
        )

    def _semua(self, c, prov, lokasi):
        if not lokasi:
            return []
        per_id = {lok.id: lok for lok in lokasi}
        gabungan = {}
        c.execute(GABUNGAN, [list(per_id)])
        for i, ewkb, luas, lokasi_id, x, y in c.fetchall():
            g = gabungan.setdefault(i, {'geom': ewkb, 'luas': luas, 'x': x, 'y': y, 'anggota': []})
            g['anggota'].append(per_id[lokasi_id])
        calon = []
        for g in gabungan.values():
            urut = sorted(g['anggota'], key=lambda lok: -lok.persen_sesuai)
            jenis = list(dict.fromkeys(lok.sektor.kode for lok in urut))
            sub = list(dict.fromkeys((lok.rincian.get('sub_sektor') or lok.sektor.nama, lok.sektor.kode) for lok in urut))
            calon.append(((urut[0].persen_sesuai, len(sub), g['luas']), g['x'], g['y'], (LokasiPotensial(
                sektor=None, provinsi=prov, geometry=GEOSGeometry(memoryview(g['geom'])), luas_ha=g['luas'],
                persen_sesuai=urut[0].persen_sesuai, jenis=jenis,
                rincian={**urut[0].rincian, 'jenis_nama': [n for n, _ in sub], 'jenis_sub': [k for _, k in sub]},
            ), [lok.id for lok in urut])))
        terpilih = self._tersebar(sorted(calon, key=lambda c: c[0], reverse=True))
        for lok, anggota in terpilih:
            c.execute(WILAYAH_GABUNGAN, [anggota])
            ewkb, luas = c.fetchone()
            lok.wilayah = GEOSGeometry(memoryview(ewkb))
            lok.rincian['luas_wilayah_ha'] = round(luas)
        return [lok for lok, _ in terpilih]

    def _seleksi_nasional(self):
        per_sub = defaultdict(lambda: defaultdict(list))
        for i, sektor, sub, skor in LokasiPotensial.objects.exclude(sektor=None).values_list(
                'id', 'sektor_id', 'rincian__sub_sektor_kode', 'persen_sesuai'):
            per_sub[sektor][sub].append((-skor, i))
        tampil, ditolak = [], 0
        for subs in per_sub.values():
            pilih = []
            for kelompok in zip_longest(*map(sorted, subs.values())):
                for _, i in filter(None, kelompok):
                    if len(pilih) < atur('MAKS_LOKASI_NASIONAL'):
                        lolos = self._lolos_ruang(i)
                        pilih += [i] * lolos
                        ditolak += not lolos
            tampil += pilih
        per_prov = defaultdict(list)
        for lok in LokasiPotensial.objects.filter(id__in=tampil).select_related('sektor'):
            if lok.sektor.kode not in SEKTOR_TERSENDIRI_DI_PETA:
                per_prov[lok.provinsi_id].append(lok)
        with transaction.atomic(), connection.cursor() as c:
            LokasiPotensial.objects.exclude(sektor=None).update(tampil=False)
            LokasiPotensial.objects.filter(id__in=tampil).update(tampil=True)
            LokasiPotensial.objects.filter(sektor=None).delete()
            for prov_id, lokasi in per_prov.items():
                LokasiPotensial.objects.bulk_create(self._semua(c, Provinsi(id=prov_id), lokasi))
        self.stdout.write(self.style.SUCCESS(
            f'Lokasi unggulan nasional ditampilkan: {len(tampil)}; tidak lolos analisis ruang: {ditolak}'))

    @staticmethod
    def _lolos_ruang(i):
        lok = LokasiPotensial.objects.select_related('sektor').get(id=i)
        if 'lolos_ruang' not in lok.rincian:
            try:
                lok.rincian['lolos_ruang'] = screening_ruang(json.loads(lok.geometry.geojson), lok.sektor.kode,
                                                             lok.rincian.get('sub_sektor_kode'))['lanjut']
            except ValueError:
                lok.rincian['lolos_ruang'] = False
            LokasiPotensial.objects.filter(id=i).update(rincian=lok.rincian)
        return lok.rincian['lolos_ruang']
