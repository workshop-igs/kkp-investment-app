from django.core.cache import cache
from django.db import connection
from django.http import Http404
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from analitik.models import RasterOseanografi

LAYANAN = {
    'BatasWilayah': ('Batas Wilayah', 'Batas provinsi, kabupaten/kota, dan Wilayah Pengelolaan Perikanan (WPP-NRI)'),
    'TataRuang': ('Tata Ruang dan Perizinan', 'Zonasi ruang laut, Persetujuan KKPRL terbit, izin tambang, dan unsur ruang laut'),
    'Ekosistem': ('Ekosistem Pesisir', 'Mangrove, terumbu karang, dan padang lamun'),
    'Infrastruktur': ('Infrastruktur', 'Pelabuhan, terminal khusus, jalan nasional, jaringan listrik, dan kawasan industri'),
    'RisikoBencana': ('Risiko Bencana', 'Zona risiko bencana pesisir dari BNPB InaRISK'),
    'PotensiInvestasi': ('Potensi Investasi', 'Peta Sebaran Wilayah Potensial Investasi dan ruang sesuai per sub-jenis'),
    'Oseanografi': ('Oseanografi dan Kondisi Fisik', 'Raster kedalaman, gelombang, arus, suhu, klorofil, dan kondisi fisik lain'),
}
JENIS_GEOMETRI = {0: 'POINT', 1: 'LINE', 2: 'POLYGON'}
VEKTOR = [
    ('BatasWilayah', 'batas_provinsi', 'Batas provinsi', 'SELECT id, kode_bps, nama, geometry FROM inti_provinsi', None),
    ('BatasWilayah', 'batas_kabupaten_kota', 'Batas kabupaten/kota',
     'SELECT id, kode_bps, nama, jenis, pesisir, geometry FROM inti_kabupaten_kota', None),
    ('BatasWilayah', 'wpp', 'Wilayah Pengelolaan Perikanan Negara Republik Indonesia (WPP-NRI)',
     'SELECT id, kode, perairan, zona_pit, geometry FROM inti_wpp', None),
    ('TataRuang', 'zonasi_ruang_laut', 'Zonasi ruang laut (RTRW Provinsi, RZ KAW, RTRWN)',
     'SELECT id, tingkat_acuan, nama_zona, jenis_zona, sub_zona, ranah, nomor_regulasi, tahun_penetapan, luas_ha, '
     'sumber_data, geometry FROM inventarisasi_zonasi_ruang_laut', 2000000),
    ('TataRuang', 'kkprl', 'Persetujuan KKPRL yang telah terbit',
     'SELECT id, jenis_dokumen, jenis_kegiatan, status, tanggal_terbit, tanggal_berakhir, luas_ha, sumber_data, geometry '
     'FROM inventarisasi_kkprl', 2000000),
    ('TataRuang', 'izin_tambang', 'Izin usaha pertambangan (ESDM)',
     'SELECT id, kode_wiup, nama_usaha, jenis_izin, kegiatan, komoditas, tanggal_berlaku, tanggal_akhir, luas_ha, geometry '
     'FROM inventarisasi_izin_tambang', 2000000),
    ('RisikoBencana', 'zona_risiko_bencana', 'Zona risiko bencana pesisir (BNPB InaRISK)',
     'SELECT id, jenis, varian, kelas, luas_ha, sumber, geometry FROM analitik_zona_risiko_bencana', 2000000),
    ('PotensiInvestasi', 'lokasi_potensial', 'Peta Sebaran Wilayah Potensial Investasi',
     "SELECT l.id, s.nama AS jenis_investasi, l.rincian->>'sub_sektor' AS sub_jenis, "
     "l.rincian->>'sub_sektor_kode' AS kode_sub_jenis, p.nama AS provinsi, l.luas_ha, l.dihitung_pada, l.geometry "
     'FROM analitik_lokasi_potensial l JOIN inti_sektor_investasi s ON s.id = l.sektor_id '
     'JOIN inti_provinsi p ON p.id = l.provinsi_id WHERE l.tampil', None),
    ('PotensiInvestasi', 'ruang_sesuai', 'Ruang sesuai per sub-jenis investasi (sel 250 m)',
     'SELECT r.id, s.nama AS jenis_investasi, r.sub_kode AS kode_sub_jenis, r.kelas, p.nama AS provinsi, r.luas_ha, r.geometry '
     'FROM analitik_ruang_sesuai r JOIN inti_sektor_investasi s ON s.id = r.sektor_id '
     'JOIN inti_provinsi p ON p.id = r.provinsi_id', 2000000),
]
EKOSISTEM = {'MANGROVE': 'Mangrove', 'TERUMBU_KARANG': 'Terumbu karang', 'LAMUN': 'Padang lamun'}
PER_KATEGORI = [
    ('Infrastruktur', 'infrastruktur', 'inventarisasi_infrastruktur_pendukung', 'kategori',
     'id, kategori, nama, kelas, pengelola, status, sumber_data'),
    ('TataRuang', 'unsur_ruang_laut', 'inventarisasi_unsur_ruang_laut', 'kelompok',
     'id, kelompok, nama, jenis, nomor_regulasi, sumber_data'),
]
TABEL = ['inti_provinsi', 'inti_kabupaten_kota', 'inti_wpp', 'inti_sektor_investasi', 'inventarisasi_zonasi_ruang_laut',
         'inventarisasi_kkprl', 'inventarisasi_izin_tambang', 'inventarisasi_sumber_daya_alam',
         'inventarisasi_infrastruktur_pendukung', 'inventarisasi_unsur_ruang_laut', 'analitik_zona_risiko_bencana',
         'analitik_lokasi_potensial', 'analitik_ruang_sesuai', 'analitik_raster_oseanografi']
BATAS_QUERY = 1000
CAKUPAN_INDONESIA = [94, -12, 142, 7]


def daftar_lapisan():
    hasil = cache.get('layanan_peta:lapisan')
    if hasil is not None:
        return hasil
    hasil = [{'layanan': lay, 'nama': n, 'judul': j, 'sql': s, 'jenis': 'POLYGON', 'skala': z} for lay, n, j, s, z in VEKTOR]
    hasil += [{'layanan': 'Ekosistem', 'nama': f'ekosistem_{k.lower()}', 'judul': v, 'jenis': 'POLYGON', 'skala': 2000000,
               'sql': "SELECT id, jenis, nama, luas_ha, kondisi, tahun_data, sumber_data, COALESCE(geometry_tampilan, geometry) "
                      f"AS geometry FROM inventarisasi_sumber_daya_alam WHERE jenis = '{k}'"}
              for k, v in EKOSISTEM.items()]
    with connection.cursor() as c:
        for lay, awalan, tabel, kolom, isi in PER_KATEGORI:
            c.execute(f'SELECT DISTINCT {kolom}, ST_Dimension(geometry) FROM {tabel} '
                      f'WHERE {kolom} IS NOT NULL AND NOT ST_IsEmpty(geometry) ORDER BY 1, 2')
            for nilai, dimensi in c.fetchall():
                aman = nilai.replace("'", "''")
                hasil.append({'layanan': lay, 'nama': f'{awalan}_{nilai.lower()}_{JENIS_GEOMETRI[dimensi].lower()}',
                              'judul': f'{awalan.replace("_", " ").capitalize()}: {nilai}', 'jenis': JENIS_GEOMETRI[dimensi],
                              'skala': 2000000,
                              'sql': f"SELECT {isi}, geometry FROM {tabel} WHERE {kolom} = '{aman}' AND ST_Dimension(geometry) = {dimensi}"})
    judul = dict(RasterOseanografi.PARAMETER_CHOICES)
    raster = {}
    for r in RasterOseanografi.objects.order_by('parameter', 'id').values('id', 'parameter', 'cakupan', 'satuan', 'periode', 'sumber'):
        e = r['cakupan'].extent
        g = raster.setdefault(r['parameter'], {
            'layanan': 'Oseanografi', 'nama': f'oseanografi_{r["parameter"].lower()}', 'jenis': 'RASTER',
            'judul': judul.get(r['parameter'], r['parameter']), 'id': [], 'cakupan': list(e),
            'satuan': r['satuan'], 'periode': r['periode'], 'sumber': r['sumber']})
        g['id'].append(r['id'])
        g['cakupan'] = [min(g['cakupan'][0], e[0]), min(g['cakupan'][1], e[1]), max(g['cakupan'][2], e[2]), max(g['cakupan'][3], e[3])]
    hasil += list(raster.values())
    cache.set('layanan_peta:lapisan', hasil, 600)
    return hasil


def _lapisan_layanan(kode):
    if kode not in LAYANAN:
        raise Http404
    return [lp for lp in daftar_lapisan() if lp['layanan'] == kode]


def _ambil(kode, nomor):
    lapisan = _lapisan_layanan(kode)
    if not 0 <= nomor < len(lapisan):
        raise Http404
    return lapisan[nomor]


def _kolom(lp):
    with connection.cursor() as c:
        c.execute(f'SELECT * FROM ({lp["sql"]}) t LIMIT 0')
        return [k.name for k in c.description if k.name != 'geometry']


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def daftar_layanan(request):
    return Response([{'kode': k, 'judul': j, 'keterangan': ket, 'jumlah_lapisan': len(_lapisan_layanan(k))}
                     for k, (j, ket) in LAYANAN.items()])


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def info_layanan(request, kode):
    lapisan = _lapisan_layanan(kode)
    judul, keterangan = LAYANAN[kode]
    return Response({'kode': kode, 'judul': judul, 'keterangan': keterangan, 'sistem_koordinat': 'EPSG:4326 (WGS 84)',
                     'cakupan': CAKUPAN_INDONESIA, 'batas_query': BATAS_QUERY,
                     'lapisan': [{'id': i, 'nama': lp['nama'], 'judul': lp['judul'], 'jenis': lp['jenis']}
                                 for i, lp in enumerate(lapisan)]})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def info_lapisan(request, kode, nomor):
    lp = _ambil(kode, nomor)
    dasar = {'id': nomor, 'layanan': kode, 'nama': lp['nama'], 'judul': lp['judul'], 'jenis': lp['jenis'],
             'sistem_koordinat': 'EPSG:4326 (WGS 84)'}
    if lp['jenis'] == 'RASTER':
        return Response({**dasar, 'cakupan': lp['cakupan'], 'satuan': lp['satuan'], 'periode': lp['periode'],
                         'sumber': lp['sumber'], 'kolom': []})
    kunci = f'layanan_peta:info:{lp["nama"]}'
    statistik = cache.get(kunci)
    if statistik is None:
        with connection.cursor() as c:
            c.execute(f'SELECT n, ST_XMin(e), ST_YMin(e), ST_XMax(e), ST_YMax(e) '
                      f'FROM (SELECT count(*) AS n, ST_Extent(geometry) AS e FROM ({lp["sql"]}) t) q')
            baris = c.fetchone()
            c.execute(f'SELECT ST_X(p), ST_Y(p) FROM (SELECT ST_PointOnSurface(geometry) AS p FROM ({lp["sql"]}) t LIMIT 1) q')
            contoh = c.fetchone()
        cakupan = [round(v, 4) for v in baris[1:]] if baris[1] is not None else CAKUPAN_INDONESIA
        pratinjau = cakupan if not lp['skala'] or not contoh else [
            round(contoh[0] - 1, 4), round(contoh[1] - 0.6, 4), round(contoh[0] + 1, 4), round(contoh[1] + 0.6, 4)]
        statistik = {'jumlah_objek': baris[0], 'cakupan': cakupan, 'pratinjau': pratinjau, 'kolom': _kolom(lp)}
        cache.set(kunci, statistik, 3600)
    return Response({**dasar, **statistik})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def query_lapisan(request, kode, nomor):
    lp = _ambil(kode, nomor)
    if lp['jenis'] == 'RASTER':
        return Response({'galat': 'Layer raster diambil lewat WCS, bukan Query.'}, status=400)
    syarat, nilai = ['TRUE'], []
    kolom = request.query_params.get('kolom')
    if kolom:
        if kolom not in _kolom(lp):
            return Response({'galat': f'Kolom {kolom} tidak ada di layer ini.'}, status=400)
        teks = request.query_params.get('nilai', '')
        if request.query_params.get('operasi') == 'mengandung':
            syarat.append(f'CAST("{kolom}" AS text) ILIKE %s')
            nilai.append(f'%{teks}%')
        else:
            syarat.append(f'CAST("{kolom}" AS text) = %s')
            nilai.append(teks)
    if request.query_params.get('bbox'):
        try:
            kotak = [float(v) for v in request.query_params['bbox'].split(',')]
            assert len(kotak) == 4
        except (ValueError, AssertionError):
            return Response({'galat': 'bbox harus berisi 4 angka: barat,selatan,timur,utara.'}, status=400)
        syarat.append('geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)')
        nilai.extend(kotak)
    try:
        batas = max(1, min(int(request.query_params.get('batas', BATAS_QUERY)), BATAS_QUERY))
    except ValueError:
        batas = BATAS_QUERY
    with connection.cursor() as c:
        c.execute(
            "SELECT json_build_object('type', 'FeatureCollection', 'features', COALESCE(json_agg(json_build_object("
            "'type', 'Feature', 'id', q.id, 'geometry', ST_AsGeoJSON(q.geometry, 6)::json, "
            "'properties', to_jsonb(q) - 'geometry')), '[]'::json)) "
            f"FROM (SELECT * FROM ({lp['sql']}) t WHERE {' AND '.join(syarat)} ORDER BY id LIMIT %s) q",
            [*nilai, batas],
        )
        return Response(c.fetchone()[0])
