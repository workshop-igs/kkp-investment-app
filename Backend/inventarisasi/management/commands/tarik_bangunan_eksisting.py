import time
from collections import Counter

import httpx
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from analitik.models import SkorKelayakanZona
from analitik.services.konstanta import AMBANG_TERBANGUN_PERSEN
from analitik.services.profil_investasi import _saring_sumber_utama

OVERPASS = (
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
)
KEPALA = {'User-Agent': 'kkp-investasi-ruang-laut/1.0'}
KUNCI = '^(man_made|harbour|industrial|water|leisure|landuse|aeroway|power|building)$'
UKURAN_KUERI = (5_000, 20_000, 200_000)

JENIS_OSM = {
    'man_made': {
        'offshore_platform': ('ANJUNGAN', 500), 'petroleum_well': ('ANJUNGAN', 100),
        'pier': ('DERMAGA', 8), 'jetty': ('DERMAGA', 8), 'quay': ('DERMAGA', 8),
        'breakwater': ('PEMECAH_GELOMBANG', 10), 'groyne': ('PEMECAH_GELOMBANG', 5),
        'dyke': ('PEMECAH_GELOMBANG', 10), 'bridge': ('JEMBATAN', 12),
        'works': ('INDUSTRI', 0), 'storage_tank': ('INDUSTRI', 0),
    },
    'harbour': {'*': ('PELABUHAN', 50)},
    'industrial': {'port': ('PELABUHAN', 0), '*': ('INDUSTRI', 0)},
    'water': {'harbour': ('PELABUHAN', 0), 'dock': ('PELABUHAN', 0), 'lock': ('PELABUHAN', 0)},
    'leisure': {'marina': ('PELABUHAN', 0)},
    'landuse': {
        'port': ('PELABUHAN', 0), 'harbour': ('PELABUHAN', 0),
        'industrial': ('INDUSTRI', 0), 'railway': ('INDUSTRI', 0),
        'residential': ('PERMUKIMAN', 0), 'commercial': ('PERMUKIMAN', 0), 'retail': ('PERMUKIMAN', 0),
        'construction': ('KONSTRUKSI', 0), 'landfill': ('KONSTRUKSI', 0), 'military': ('MILITER', 0),
    },
    'aeroway': {
        'aerodrome': ('BANDARA', 0), 'runway': ('BANDARA', 25), 'taxiway': ('BANDARA', 10),
        'apron': ('BANDARA', 0), 'terminal': ('BANDARA', 0),
    },
    'power': {'plant': ('PEMBANGKIT', 0), 'substation': ('PEMBANGKIT', 0)},
    'building': {'*': ('BANGUNAN', 0)},
}
PENYANGGA_TITIK = 25
PENYANGGA_GARIS = 5
PENYANGGA_PELABUHAN_KKP = 250
LINGKUNGAN_ZONA_M = 25
KATEGORI_KKP = ['PELABUHAN_PERIKANAN', 'PELABUHAN_UMUM', 'PELABUHAN_PENYEBERANGAN', 'TERMINAL_KHUSUS', 'PEMBANGKIT_LISTRIK']

SISIP = '''
INSERT INTO inventarisasi_bangunan_eksisting (kode, jenis, nama, sumber_data, geometry, updated_at)
SELECT %(kode)s, %(jenis)s, %(nama)s, 'OpenStreetMap', g, now() FROM (
  SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(CASE
    WHEN %(relasi)s THEN ST_BuildArea(ST_GeomFromText(%(wkt)s, 4326))
    WHEN %(m)s > 0 THEN ST_Buffer(ST_GeomFromText(%(wkt)s, 4326)::geography, %(m)s)::geometry
    ELSE ST_GeomFromText(%(wkt)s, 4326) END), 3)) AS g) s
WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)
ON CONFLICT (kode) DO UPDATE SET jenis = EXCLUDED.jenis, nama = EXCLUDED.nama,
  geometry = EXCLUDED.geometry, updated_at = now()
'''

SISIP_KKP = '''
INSERT INTO inventarisasi_bangunan_eksisting (kode, jenis, nama, sumber_data, geometry, updated_at)
SELECT 'kkp/' || id, CASE WHEN kategori = 'PEMBANGKIT_LISTRIK' THEN 'PEMBANGKIT' ELSE 'PELABUHAN' END,
  LEFT(nama, 255), 'KKP', ST_Multi(ST_CollectionExtract(ST_MakeValid(CASE WHEN ST_Dimension(geometry) = 2
    THEN geometry ELSE ST_Buffer(geometry::geography, %s)::geometry END), 3)), now()
FROM inventarisasi_infrastruktur_pendukung WHERE kategori = ANY(%s)
ON CONFLICT (kode) DO UPDATE SET jenis = EXCLUDED.jenis, nama = EXCLUDED.nama,
  geometry = EXCLUDED.geometry, updated_at = now()
'''

POTONGAN = '''
WITH p AS (
  SELECT (ST_Dump(ST_Subdivide(ST_MakeValid(ST_SimplifyPreserveTopology(geometry, 0.0005)), 64))).geom AS g
  FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s)),
s AS (
  SELECT floor(ST_X(ST_Centroid(g)) / 0.1) AS gx, floor(ST_Y(ST_Centroid(g)) / 0.1) AS gy,
    ST_Buffer(ST_Collect(g), 0.0005, 'quad_segs=2') AS g
  FROM p GROUP BY 1, 2)
SELECT ST_AsText(ST_ExteriorRing((d).geom)) FROM (
  SELECT gx, gy, ST_Dump(ST_Subdivide(ST_SimplifyPreserveTopology(g, 0.0003), 96)) AS d FROM s) q
WHERE GeometryType((d).geom) = 'POLYGON'
ORDER BY gx, gy
'''

PERSEN = '''
WITH z AS MATERIALIZED (
  SELECT id, ST_Buffer(ST_MakeValid(geometry)::geography, %s)::geometry AS g
  FROM inventarisasi_zonasi_ruang_laut WHERE id = %s)
UPDATE inventarisasi_zonasi_ruang_laut t SET persen_terbangun = LEAST(100, COALESCE(100 * (
  SELECT ST_Area(ST_Union(CASE WHEN ST_CoveredBy(b.geometry, z.g) THEN b.geometry
    ELSE ST_CollectionExtract(ST_Intersection(b.geometry, z.g), 3) END)::geography) / 10000
  FROM inventarisasi_bangunan_eksisting b WHERE b.geometry && z.g AND ST_Intersects(b.geometry, z.g)
) / NULLIF(ST_Area(z.g::geography) / 10000, 0), 0))
FROM z WHERE t.id = z.id
'''


def golongkan(tag):
    for kunci, aturan in JENIS_OSM.items():
        nilai = tag.get(kunci)
        if nilai and nilai != 'no':
            hasil = aturan.get(nilai) or aturan.get('*')
            if hasil:
                return hasil
    return None


def _rangkai(titik):
    return ','.join(f"{p['lon']} {p['lat']}" for p in titik if p)


def bentuk(e, penyangga):
    if e['type'] == 'node':
        return f"POINT({e['lon']} {e['lat']})", max(penyangga, PENYANGGA_TITIK), False
    if e['type'] == 'way':
        titik = [p for p in e.get('geometry') or [] if p]
        if len(titik) < 2:
            return None
        if len(titik) >= 4 and titik[0] == titik[-1]:
            return f'POLYGON(({_rangkai(titik)}))', 0, False
        return f'LINESTRING({_rangkai(titik)})', max(penyangga, PENYANGGA_GARIS), False
    if e.get('tags', {}).get('type') != 'multipolygon':
        return None
    garis = [_rangkai(m['geometry']) for m in e.get('members', []) if len([p for p in m.get('geometry') or [] if p]) >= 2]
    if not garis:
        return None
    return 'MULTILINESTRING(' + ','.join(f'({g})' for g in garis) + ')', 0, True


def poly_overpass(wkt):
    pasangan = wkt[wkt.index('(') + 1:wkt.rindex(')')].split(',')[:-1]
    return ' '.join(f'{float(y):.5f} {float(x):.5f}' for x, y in (p.split() for p in pasangan))


class Command(BaseCommand):
    help = (
        'Tarik bangunan dan struktur eksisting (OpenStreetMap dan infrastruktur KKP) di zona kandidat '
        'rekomendasi, lalu hitung bagian luas setiap zona yang sudah terbangun. Jalankan setelah hitung_skor_zona.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--provinsi', help='Kode BPS provinsi, dipisah koma')
        parser.add_argument('--mulai', type=int, default=0, help='Lanjutkan dari potongan ke-N')

    def handle(self, *args, **opsi):
        skor = _saring_sumber_utama(
            SkorKelayakanZona.objects.filter(kesesuaian_tr=True, kelas__in=['TINGGI', 'SEDANG'], sektor__aktif=True)
        )
        if opsi['provinsi']:
            skor = skor.filter(zona__provinsi__kode_bps__in=opsi['provinsi'].split(','))
        ids = list(skor.values_list('zona_id', flat=True).distinct())
        if not ids:
            raise CommandError('Belum ada zona kandidat; jalankan hitung_skor_zona lebih dulu.')

        with connection.cursor() as c:
            c.execute('SELECT now()')
            waktu_mulai = c.fetchone()[0]
            c.execute(POTONGAN, [ids])
            potongan = [poly_overpass(r[0]) for r in c.fetchall()]

        self.stdout.write(f'{len(ids)} zona kandidat, {len(potongan)} potongan')
        self.terlihat = set()
        self.jumlah = Counter()
        minimum, ukuran, maksimum = UKURAN_KUERI
        i = opsi['mulai']
        while i < len(potongan):
            isi, panjang = [], 0
            while i + len(isi) < len(potongan) and (not isi or panjang < ukuran):
                isi.append(potongan[i + len(isi)])
                panjang += len(isi[-1])
            t = time.time()
            n = self.simpan(self.ambil(isi, i))
            lama = time.time() - t
            i += len(isi)
            self.stdout.write(f'[{i}/{len(potongan)}] {len(isi)} potongan, {n} objek baru, {lama:.0f} dtk')
            if lama < 30:
                ukuran = min(ukuran * 2, maksimum)
            elif lama > 90:
                ukuran = max(ukuran // 2, minimum)

        with connection.cursor() as c:
            c.execute(SISIP_KKP, [PENYANGGA_PELABUHAN_KKP, KATEGORI_KKP])
            self.stdout.write(f'{c.rowcount} pelabuhan, terminal, dan pembangkit dari infrastruktur KKP')
            if not opsi['provinsi'] and not opsi['mulai']:
                c.execute(
                    "DELETE FROM inventarisasi_bangunan_eksisting WHERE sumber_data = 'OpenStreetMap' AND updated_at < %s",
                    [waktu_mulai],
                )
                self.stdout.write(f'{c.rowcount} objek OSM lama yang sudah tidak ada dihapus')

        self.hitung_persen(ids)
        self.stdout.write(self.style.SUCCESS(f'Objek OSM per jenis: {dict(self.jumlah.most_common())}'))

    def ambil(self, isi, nomor, coba=0):
        kueri = (
            '[out:json][timeout:150][maxsize:268435456];('
            + ''.join(f'nwr[~"{KUNCI}"~"."](poly:"{p}");' for p in isi)
            + ');out geom qt;'
        )
        url = OVERPASS[coba % len(OVERPASS)]
        try:
            r = httpx.post(url, data={'data': kueri}, headers=KEPALA, timeout=200)
            data = r.json() if r.status_code == 200 else None
            if data is not None and 'error' not in (data.get('remark') or ''):
                return data['elements']
            alasan = f'{r.status_code} {(data or {}).get("remark", "")[:120]}'
            berat = r.status_code == 504 or data is not None
        except (httpx.HTTPError, ValueError) as e:
            alasan, berat = type(e).__name__, isinstance(e, httpx.TimeoutException)
        self.stderr.write(f'  potongan {nomor}+{len(isi)}: {url} {alasan}')
        if berat and len(isi) > 1:
            tengah = len(isi) // 2
            return self.ambil(isi[:tengah], nomor) + self.ambil(isi[tengah:], nomor + tengah)
        if coba >= 5:
            raise CommandError(f'Overpass gagal pada potongan {nomor}; ulangi dengan --mulai {nomor}.')
        time.sleep(20 * (coba + 1))
        return self.ambil(isi, nomor, coba + 1)

    def simpan(self, elemen):
        baris = []
        for e in elemen:
            kode = f"osm/{e['type']}/{e['id']}"
            jenis = golongkan(e.get('tags', {}))
            if kode in self.terlihat or not jenis:
                continue
            self.terlihat.add(kode)
            hasil = bentuk(e, jenis[1])
            if not hasil:
                continue
            wkt, m, relasi = hasil
            nama = (e['tags'].get('name') or '')[:255]
            baris.append({'kode': kode, 'jenis': jenis[0], 'nama': nama, 'wkt': wkt, 'm': m, 'relasi': relasi})
        try:
            with transaction.atomic(), connection.cursor() as c:
                c.executemany(SISIP, baris)
        except Exception:
            for b in baris:
                try:
                    with transaction.atomic(), connection.cursor() as c:
                        c.execute(SISIP, b)
                except Exception as e:
                    self.stderr.write(f"  {b['kode']} dilewati: {str(e).splitlines()[0][:120]}")
        self.jumlah.update(b['jenis'] for b in baris)
        return len(baris)

    def hitung_persen(self, ids):
        with connection.cursor() as c:
            c.execute('UPDATE inventarisasi_zonasi_ruang_laut SET persen_terbangun = 0 WHERE id = ANY(%s)', [ids])
            c.execute(
                'SELECT z.id FROM inventarisasi_zonasi_ruang_laut z WHERE z.id = ANY(%s) AND EXISTS ('
                'SELECT 1 FROM inventarisasi_bangunan_eksisting b '
                'WHERE ST_DWithin(b.geometry, z.geometry, 0.0003))',
                [ids],
            )
            tersentuh = [r[0] for r in c.fetchall()]
        for zona_id in tersentuh:
            try:
                with transaction.atomic(), connection.cursor() as c:
                    c.execute(PERSEN, [LINGKUNGAN_ZONA_M, zona_id])
            except Exception as e:
                self.stderr.write(f'  zona {zona_id} dilewati: {str(e).splitlines()[0][:120]}')
        with connection.cursor() as c:
            c.execute(
                'SELECT COUNT(*) FROM inventarisasi_zonasi_ruang_laut WHERE id = ANY(%s) AND persen_terbangun >= %s',
                [ids, AMBANG_TERBANGUN_PERSEN],
            )
            terbangun = c.fetchone()[0]
        self.stdout.write(
            f'{len(tersentuh)} zona bersinggungan dengan bangunan; {terbangun} zona terbangun '
            f'{AMBANG_TERBANGUN_PERSEN}% atau lebih dikeluarkan dari rekomendasi'
        )
