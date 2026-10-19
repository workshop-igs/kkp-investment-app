import time
from collections import Counter
from functools import partial

from django.contrib.gis.geos import GEOSGeometry
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Q

from analitik.models import LokasiPotensial, NilaiWilayahParameter, ParameterTambahan
from analitik.services.konstanta import (
    GMW_TAHUN_AKHIR,
    KETENTUAN_DARAT_BAWAAN,
    KM_PER_DERAJAT,
    SEKTOR_SUB_ZONA_COCOK,
    SEKTOR_TERSENDIRI_DI_PETA,
    UKURAN_SEL_LOKASI_DERAJAT,
)
from analitik.services import pengecualian
from analitik.services.oseanografi import daya_gelombang, raster_tersedia
from analitik.services.parameter_tambahan import sesuai_ambang
from analitik.services.pengaturan import atur
from analitik.services.profil_investasi import _saring_sumber_utama
from analitik.services.screening_ruang import (
    BOLEH,
    LABEL_TATA_RUANG,
    _aturan_per_sektor,
    _ketentuan,
    parameter_lokasi,
    persen_sangat_sesuai,
)
from inti.models import Provinsi, SektorInvestasi
from inventarisasi.models import ZonasiRuangLaut

LABEL_SUB_ZONA = dict(ZonasiRuangLaut.SUB_ZONA_CHOICES)
PERINGKAT_BENCANA = {1: 'RENDAH', 2: 'SEDANG', 3: 'TINGGI'}
# (raster, pita, kunci data sel): pita 1 rata-rata, 2 minimum, 3 maksimum sepanjang setahun.
PITA_RASTER = [
    ('KEDALAMAN', 1, 'kedalaman'), ('GELOMBANG', 1, 'gelombang'), ('GELOMBANG', 3, 'gelombang_tertinggi'),
    ('SUHU', 2, 'suhu'), ('SUHU', 1, 'suhu_rata'), ('ANOMALI_SUHU', 1, 'anomali'), ('KLOROFIL', 1, 'klorofil'),
    ('KD490', 1, 'kd490'), ('PERIODE_GLB', 1, 'periode'), ('CURAH_HUJAN', 1, 'curah_hujan'),
    ('BULAN_KERING', 1, 'bulan_kering'),
]

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

GABUNGAN = """
WITH a AS MATERIALIZED (SELECT id, geometry AS g FROM analitik_lokasi_potensial WHERE id = ANY(%s)),
p AS MATERIALIZED (
    SELECT row_number() OVER () AS i, d.g FROM (SELECT (ST_Dump(ST_Union(a.g, 1e-9))).geom AS g FROM a) d
)
SELECT p.i, ST_AsEWKB(ST_Multi(p.g)), ST_Area(p.g::geography) / 10000, a.id,
       ST_X(ST_PointOnSurface(p.g)), ST_Y(ST_PointOnSurface(p.g))
FROM p JOIN a ON a.g && p.g AND ST_Intersects(a.g, p.g)
"""


def _di_area(i, kena, dalam):
    return (i in kena) == dalam


def _tetap(i, nilai):
    return nilai


def _per_kabupaten(i, per_kab, kabupaten):
    return per_kab.get(kabupaten.get(i))


class Command(BaseCommand):
    help = (
        'Bentuk Peta Sebaran Wilayah Potensial Investasi: zona yang peruntukannya mengizinkan dibagi ke sel '
        '250 m; sel harus memenuhi seluruh syarat dasar (karakter lokasi, infrastruktur, dan pengecualian keras: '
        'alur pelayaran/ALKI, ekosistem sensitif, jarak aman kabel/pipa/alur pelayaran, KKPRL, '
        'bangunan), lalu sel yang sedikitnya 75% parameter dinilainya sangat sesuai digabung bila bersebelahan; '
        'dalam radius 10 km hanya lokasi terbaik yang disimpan. Jalankan setelah tarik_bangunan_eksisting.'
    )

    stealth_options = ('progres',)

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
        total = Counter()
        daftar = list(provinsi)
        for i, prov in enumerate(daftar, 1):
            if opsi.get('progres'):
                opsi['progres'](i, len(daftar), prov.nama)
            t = time.time()
            jumlah = self._provinsi(prov)
            total.update(jumlah)
            if jumlah:
                self.stdout.write(
                    f'  {prov.nama:28s} {sum(jumlah.values()):6d} lokasi ({time.time() - t:.0f} dtk) {dict(jumlah)}'
                )
        self.stdout.write(self.style.SUCCESS(f'Lokasi per jenis: {dict(total.most_common())}'))

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
            c.execute('DROP TABLE IF EXISTS zona_sel, sel, piksel, bencana_sel, konservasi_sel, alur_sel, unsur_sel')
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

    def _data_sel(self, c, banyak, cakupan, prov):
        d = {k: [None] * (banyak + 1) for k in (
            'zona', 'jarak', 'ekosistem', 'sekitar', 'bencana', 'jarak_karang', *(kunci for _, _, kunci in PITA_RASTER),
        )}
        d['tersedia'] = raster_tersedia()

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

        c.execute(
            """
            CREATE TEMP TABLE piksel AS
            SELECT v.kunci, (p).val AS nilai, (p).geom AS g
            FROM analitik_raster_oseanografi o
            JOIN unnest(%s::text[], %s::int[], %s::text[]) AS v(parameter, pita, kunci) ON v.parameter = o.parameter
            CROSS JOIN LATERAL ST_DumpAsPolygons(
                ST_Clip(o.rast, %s::geometry, true), LEAST(v.pita, ST_NumBands(o.rast))
            ) p
            WHERE o.cakupan && %s::geometry
            """,
            [[r for r, _, _ in PITA_RASTER], [p for _, p, _ in PITA_RASTER], [k for _, _, k in PITA_RASTER],
             cakupan, cakupan],
        )
        c.execute('CREATE INDEX ON piksel USING gist (g)')
        c.execute(
            'SELECT s.id, p.kunci, p.nilai FROM sel s JOIN piksel p ON p.g && s.titik AND ST_Intersects(p.g, s.titik)'
        )
        for i, kunci, nilai in c.fetchall():
            d[kunci][i] = max(0.0, -nilai) if kunci == 'kedalaman' else nilai

        for km in (0.5, 5):
            c.execute(
                'SELECT s.id FROM sel s WHERE EXISTS '
                '(SELECT 1 FROM darat_terbagi g WHERE ST_DWithin(s.kotak, g.g, %s))',
                [km / KM_PER_DERAJAT],
            )
            for (i,) in c.fetchall():
                if d['jarak'][i] is None:
                    d['jarak'][i] = 0.0 if km == 0.5 else 1.0

        for kolom, radius in (('ekosistem', 0.0), ('sekitar', atur('RADIUS_EKOSISTEM_PENDUKUNG_M') / 1000 / KM_PER_DERAJAT)):
            c.execute(
                """
                SELECT s.id, array_agg(DISTINCT e.jenis) FROM sel s JOIN inventarisasi_sumber_daya_alam e
                  ON e.geometry && ST_Expand(s.kotak, %s) AND ST_DWithin(e.geometry, s.kotak, %s)
                 AND (e.sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG')
                      OR (e.sumber_data = 'GMW-MANGROVE' AND e.tahun_data = %s))
                GROUP BY s.id
                """,
                [radius, radius, GMW_TAHUN_AKHIR],
            )
            for i, jenis in c.fetchall():
                d[kolom][i] = frozenset(jenis)

        radius_karang = max((
            syarat['jarak_karang_maks_km'] for per_ranah in atur('PARAMETER_TAMBAHAN').values()
            for syarat in per_ranah.values() if 'jarak_karang_maks_km' in syarat
        ), default=None)
        c.execute("SELECT EXISTS (SELECT 1 FROM inventarisasi_sumber_daya_alam WHERE jenis = 'TERUMBU_KARANG')")
        if radius_karang is not None and c.fetchone()[0]:
            d['jarak_karang'] = [99.0] * (banyak + 1)
            r = radius_karang / KM_PER_DERAJAT
            c.execute(
                "SELECT s.id, MIN(ST_Distance(e.geometry, s.kotak)) FROM sel s JOIN inventarisasi_sumber_daya_alam e "
                "ON e.jenis = 'TERUMBU_KARANG' AND e.geometry && ST_Expand(s.kotak, %s) AND ST_DWithin(e.geometry, s.kotak, %s) "
                'GROUP BY s.id',
                [r, r],
            )
            for i, jarak in c.fetchall():
                d['jarak_karang'][i] = jarak * KM_PER_DERAJAT

        c.execute(
            f'CREATE TEMP TABLE alur_sel AS SELECT ST_Subdivide(ST_MakeValid(z.geometry), 256, 1e-9) AS g '
            f'FROM inventarisasi_zonasi_ruang_laut z WHERE z.geometry && %s::geometry AND {pengecualian.ZONA_ALUR}',
            [cakupan],
        )
        c.execute('CREATE INDEX ON alur_sel USING gist (g)')
        unsur = pengecualian.unsur_terlarang(c, cakupan)
        c.execute(
            'CREATE TEMP TABLE unsur_sel AS SELECT b.kode, '
            'ST_Subdivide(ST_Buffer(u.geometry::geography, b.m)::geometry, 256, 1e-9) AS g '
            'FROM unnest(%s::int[], %s::text[], %s::float8[]) AS b(id, kode, m) '
            'JOIN inventarisasi_unsur_ruang_laut u ON u.id = b.id',
            [[u[0] for u in unsur], [u[1] for u in unsur], [u[2] for u in unsur]],
        )
        c.execute('CREATE INDEX ON unsur_sel USING gist (g)')

        # Sama dengan screening: indeks RISIKO, kelas terburuk yang menyentuh sel (bukan hanya titik tengahnya).
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
        c.execute('SELECT EXISTS (SELECT 1 FROM inventarisasi_infrastruktur_pendukung)')
        d['infra_terdata'] = c.fetchone()[0]
        d['infra'] = set()
        for kategori, _, ideal_km, _ in atur('INFRASTRUKTUR_AKSESIBILITAS'):
            d['infra'] |= himpunan(
                'SELECT s.id FROM sel s WHERE EXISTS (SELECT 1 FROM inventarisasi_infrastruktur_pendukung i '
                'WHERE i.kategori = %s AND ST_DWithin(i.geometry, s.titik, %s))',
                [kategori, ideal_km / KM_PER_DERAJAT],
            )
        c.execute(
            'SELECT s.id, (SELECT ST_Distance(i.geometry, s.titik) FROM inventarisasi_infrastruktur_pendukung i '
            'WHERE i.kategori = ANY(%s) ORDER BY i.geometry <-> s.titik LIMIT 1) FROM sel s WHERE s.id = ANY(%s)',
            [[k for k, _, _, _ in atur('INFRASTRUKTUR_AKSESIBILITAS')], list(d['infra'])],
        )
        d['jarak_infra'] = dict(c.fetchall())
        c.execute(
            'SELECT id, floor(ST_X(titik) / %s)::int, floor(ST_Y(titik) / %s)::int FROM sel',
            [UKURAN_SEL_LOKASI_DERAJAT, UKURAN_SEL_LOKASI_DERAJAT],
        )
        d['ij'] = {i: (x, y) for i, x, y in c.fetchall()}
        c.execute(
            "SELECT EXISTS (SELECT 1 FROM inventarisasi_unsur_ruang_laut WHERE kelompok = 'MHA' AND provinsi_id = %s)",
            [prov.id],
        )
        d['adat_terdata'] = c.fetchone()[0]
        d['adat'] = himpunan(
            "SELECT DISTINCT s.id FROM sel s JOIN inventarisasi_unsur_ruang_laut u ON u.kelompok = 'MHA' "
            'AND u.geometry && s.kotak AND ST_Intersects(u.geometry, s.kotak)'
        )
        d['banyak'] = banyak
        d['tambahan'] = self._tambahan(c, prov, d)
        return d

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
        calon = [
            i for i in range(1, d['banyak'] + 1)
            if d['zona'][i] and i not in d['kkprl'] and i not in d['bangunan']
            and (not d['infra_terdata'] or i in d['infra'])
        ]
        c.execute(
            'SELECT s.id, (SELECT k.id FROM inti_kabupaten_kota k WHERE k.provinsi_id = %s AND k.geometry IS NOT NULL '
            'ORDER BY k.geometry <-> s.titik LIMIT 1) FROM sel s WHERE s.id = ANY(%s)',
            [prov.id, calon],
        )
        return dict(c.fetchall())

    def _nilai_sel(self, sektor, zona, status, d):
        karakter = atur('KARAKTER_LOKASI').get(sektor.kode)
        izin = {'LAUT', 'DARAT'} if karakter is None else {'LAUT', 'DARAT'} & set(karakter)
        berlaku = [t for t in d['tambahan'] if not t[2] or sektor.kode in t[2]]
        gerbang = [f for _, peran, _, f in berlaku if peran == 'GERBANG']
        dinilai = [(nama, f) for nama, peran, _, f in berlaku if peran == 'DINILAI']
        peruntukan = {*SEKTOR_SUB_ZONA_COCOK.get(sektor.kode, ()), *(
            sub for sub, st in KETENTUAN_DARAT_BAWAAN.get(sektor.kode, {}).items() if st == 'DIIZINKAN')}
        tanpa_alur = pengecualian.alur_terlarang(sektor.kode)
        unsur = d['unsur'] if tanpa_alur else d['unsur_tanpa_alur']
        ekosistem_terlarang = pengecualian.ekosistem_terlarang(sektor.kode)
        tembolok, lolos = {}, {}
        for i in range(1, d['banyak'] + 1):
            zids = d['zona'][i]
            if not zids or i in d['kkprl'] or i in d['bangunan'] or i in unsur or (d['infra_terdata'] and i not in d['infra']):
                continue
            if (tanpa_alur and i in d['alur']) or (d['ekosistem'][i] or frozenset()) & ekosistem_terlarang:
                continue
            st = {status[(z, sektor.kode)] for z in zids}
            ranah = {zona[z][3] for z in zids}
            if not st <= set(BOLEH) or len(ranah) != 1 or not ranah <= izin or any(f(i) is False for f in gerbang):
                continue
            bersyarat = 'BERSYARAT' in st
            kunci = (
                ranah.pop(), 'BERSYARAT' if bersyarat else 'DIIZINKAN', d['jarak'][i], d['ekosistem'][i], d['sekitar'][i],
                tuple(sorted((d['bencana'][i] or {}).items())),
                (i in d['infra']) if d['infra_terdata'] else None, (i in d['adat']) if d['adat_terdata'] else None,
                tuple((nama, f(i)) for nama, f in dinilai),
                bersyarat and any(zona[z][1] not in peruntukan for z in zids),
                d['jarak_karang'][i], tuple(d[k][i] for _, _, k in PITA_RASTER),
            )
            if kunci not in tembolok:
                tembolok[kunci] = self._nilai(sektor.kode, kunci, d['tersedia'])
            if tembolok[kunci]:
                lolos[i] = tembolok[kunci]
        return lolos

    @staticmethod
    def _nilai(kode, kunci, tersedia):
        ranah, status_tr, jarak, ekosistem, sekitar, bencana, infra, adat, tambahan, ketat, jarak_karang, raster = kunci
        r = {k: v for (_, _, k), v in zip(PITA_RASTER, raster)}
        hujan = r['curah_hujan']
        hasil = parameter_lokasi(kode, {
            'ranah': ranah, 'status_tr': status_tr, 'kedalaman_min': r['kedalaman'], 'kedalaman_maks': r['kedalaman'],
            'gelombang': r['gelombang'], 'gelombang_tertinggi': r['gelombang_tertinggi'], 'suhu_min': r['suhu'],
            'suhu_rata': r['suhu_rata'], 'anomali_suhu': r['anomali'], 'klorofil': r['klorofil'], 'kd490': r['kd490'],
            'daya_gelombang': daya_gelombang(r['gelombang'], r['periode']),
            'curah_hujan': hujan * 12 if hujan is not None else None, 'bulan_kering': r['bulan_kering'],
            'jarak_karang_km': jarak_karang, 'tersedia': tersedia,
            'jarak_pantai_km': (jarak if jarak is not None else 99.0) if ranah == 'LAUT' else None,
            'ekosistem': ekosistem or frozenset(), 'ekosistem_sekitar': sekitar or frozenset(), 'bencana': dict(bencana),
            'dekat_infrastruktur': infra, 'adat': adat, 'tambahan': dict(tambahan),
            # Sel yang sampai di sini sudah lolos seluruh pengecualian keras.
            'pengecualian': {p: True for p in pengecualian.berlaku(kode)},
        })
        if hasil is None:
            return None
        dasar, nilai = hasil
        if sum(v is not None for v in nilai.values()) < atur('MINIMAL_PARAMETER_TERUKUR'):
            return None
        if ketat:
            lain = [v for k, v in nilai.items() if k != LABEL_TATA_RUANG]
            if atur('WAJIB_LENGKAP_BERSYARAT') and None in lain:
                return None
            if sum(v is True for v in lain) < atur('AMBANG_KECOCOKAN_BERSYARAT') * sum(v is not None for v in lain):
                return None
        persen = persen_sangat_sesuai(nilai)
        return (persen, nilai, dasar) if persen >= 100 * atur('AMBANG_KECOCOKAN') else None

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
    def _mutu(sel, lolos, d):
        return (
            sum(lolos[i][0] for i in sel) / len(sel),
            -min(d['jarak_infra'].get(i) or 0 for i in sel),
            len(sel),
        )

    def _inti(self, wilayah, lolos, d):
        blok = {}
        for i in wilayah:
            x, y = d['ij'][i]
            blok.setdefault((x // atur('SEL_PER_SISI_INTI_LOKASI'), y // atur('SEL_PER_SISI_INTI_LOKASI')), []).append(i)
        return max(blok.values(), key=lambda sel: self._mutu(sel, lolos, d))

    @staticmethod
    def _tersebar(calon):
        batas = (atur('JARAK_ANTAR_LOKASI_KM') / KM_PER_DERAJAT) ** 2
        pusat, hasil = [], []
        for _, x, y, isi in sorted(calon, key=lambda c: c[0], reverse=True):
            if all((x - a) ** 2 + (y - b) ** 2 >= batas for a, b in pusat):
                pusat.append((x, y))
                hasil.append(isi)
        return hasil

    def _lokasi(self, c, prov, zona, status, d):
        hasil = []
        for sektor in self.sektor:
            lolos = self._nilai_sel(sektor, zona, status, d)
            if not lolos:
                continue
            calon = []
            for w in self._wilayah(lolos, d['ij']):
                sel = self._inti(w, lolos, d)
                calon.append((
                    self._mutu(sel, lolos, d),
                    sum(d['ij'][i][0] for i in sel) / len(sel) * UKURAN_SEL_LOKASI_DERAJAT,
                    sum(d['ij'][i][1] for i in sel) / len(sel) * UKURAN_SEL_LOKASI_DERAJAT,
                    (sel, len(w)),
                ))
            inti = self._tersebar(calon)
            c.execute(INTI, [[k for k, t in enumerate(inti) for _ in t[0]], [i for sel, _ in inti for i in sel]])
            for k, ewkb, luas in c.fetchall():
                hasil.append(self._satu(prov, sektor, ewkb, luas, *inti[k], lolos, zona, status, d))
        with transaction.atomic():
            LokasiPotensial.objects.filter(provinsi=prov).delete()
            LokasiPotensial.objects.bulk_create(hasil)
            LokasiPotensial.objects.bulk_create(
                self._semua(c, prov, [h for h in hasil if h.sektor.kode not in SEKTOR_TERSENDIRI_DI_PETA])
            )
        return hasil

    def _satu(self, prov, sektor, ewkb, luas, sel, sel_wilayah, lolos, zona, status, d):
        bagian, terukur = Counter(), Counter()
        dasar_ada, dasar_terukur = Counter(), Counter()
        for i in sel:
            for label, v in lolos[i][1].items():
                if v is not None:
                    terukur[label] += 1
                    bagian[label] += v
            for label, v in lolos[i][2].items():
                if v is not None:
                    dasar_terukur[label] += 1
                    dasar_ada[label] += v
        label_semua = list(lolos[sel[0]][1])
        label_dasar = list(lolos[sel[0]][2])
        zona_utama = Counter(z for i in sel for z in d['zona'][i]).most_common(1)[0][0]
        bersyarat = any(status[(z, sektor.kode)] == 'BERSYARAT' for i in sel for z in d['zona'][i])
        parameter = {
            label: round(100 * bagian[label] / terukur[label]) if terukur[label] else None for label in label_semua
        }
        return LokasiPotensial(
            sektor=sektor, provinsi=prov, geometry=GEOSGeometry(memoryview(ewkb)), luas_ha=luas,
            persen_sesuai=sum(lolos[i][0] for i in sel) / len(sel), jenis=[sektor.kode],
            rincian={
                'nama': zona[zona_utama][4],
                'sub_zona': LABEL_SUB_ZONA.get(zona[zona_utama][1], zona[zona_utama][1]),
                'ranah': zona[zona_utama][3],
                'sektor': sektor.nama,
                'jumlah_sel': len(sel),
                'luas_wilayah_ha': round(luas / len(sel) * sel_wilayah),
                'status_tata_ruang': 'BERSYARAT' if bersyarat else 'DIIZINKAN',
                'syarat_dasar': {
                    label: round(100 * dasar_ada[label] / dasar_terukur[label]) if dasar_terukur[label] else None
                    for label in label_dasar
                },
                'parameter': parameter,
                'perlu_dinilai': [label for label, v in parameter.items() if v is None or v < 100],
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
            calon.append(((urut[0].persen_sesuai, len(jenis), g['luas']), g['x'], g['y'], LokasiPotensial(
                sektor=None, provinsi=prov, geometry=GEOSGeometry(memoryview(g['geom'])), luas_ha=g['luas'],
                persen_sesuai=urut[0].persen_sesuai, jenis=jenis,
                rincian={**urut[0].rincian, 'jenis_nama': list(dict.fromkeys(lok.sektor.nama for lok in urut))},
            )))
        return self._tersebar(calon)
