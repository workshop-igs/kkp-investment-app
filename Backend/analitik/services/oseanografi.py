import math
import struct
import zlib

import numpy as np
from django.contrib.gis.geos import Polygon
from django.core.cache import cache
from django.db import connection
from django.db.models import Max

from analitik.models import RasterOseanografi

BATAS = (94.0, -11.0, 142.0, 7.0)
LEBAR_MAKS_PNG = 1200
CACHE_PNG_DETIK = 24 * 3600

PALET = {
    'SUHU': [(24, '#313695'), (26, '#4575b4'), (27.5, '#74add1'), (28.5, '#abd9e9'), (29.5, '#fee090'),
             (30.5, '#fdae61'), (31.5, '#f46d43'), (33, '#a50026')],
    'ANOMALI_SUHU': [(-2, '#2166ac'), (-1, '#67a9cf'), (-0.25, '#f7f7f7'), (0.25, '#f7f7f7'), (1, '#ef8a62'),
                     (2, '#b2182b')],
    'KLOROFIL': [(0.05, '#440154'), (0.1, '#3b528b'), (0.3, '#21918c'), (1, '#5ec962'), (3, '#fde725')],
    'GELOMBANG': [(0, '#e0f3f8'), (0.75, '#91bfdb'), (1.25, '#4575b4'), (2, '#fc8d59'), (3, '#d73027')],
    'PERIODE_GLB': [(4, '#e0f3f8'), (7, '#91bfdb'), (10, '#4575b4'), (13, '#fc8d59'), (16, '#d73027')],
    'KD490': [(0.03, '#08306b'), (0.06, '#2171b5'), (0.1, '#6baed6'), (0.3, '#c6dbef'), (1, '#8c6d31')],
    'CURAH_HUJAN': [(0, '#fff7bc'), (50, '#fec44f'), (100, '#d9f0a3'), (200, '#78c679'), (400, '#238443')],
    'BULAN_KERING': [(0, '#238443'), (3, '#addd8e'), (5, '#fec44f'), (8, '#ec7014'), (12, '#993404')],
    'KEDALAMAN': [(0, '#e0f2fe'), (50, '#bae6fd'), (200, '#7dd3fc'), (1000, '#38bdf8'), (3000, '#0369a1'),
                  (6000, '#082f49')],
    'ARUS': [(0, '#f7fbff'), (0.15, '#c6dbef'), (0.3, '#6baed6'), (0.45, '#2171b5'), (0.8, '#08306b')],
    'ARUS_DASAR': [(0, '#f7fbff'), (0.2, '#c6dbef'), (0.4, '#6baed6'), (0.8, '#2171b5'), (1.2, '#08306b')],
    'SALINITAS': [(25, '#f7fcb9'), (30, '#addd8e'), (32, '#41ab5d'), (34, '#006837'), (36, '#00441b')],
    'TSS': [(0, '#08306b'), (10, '#4292c6'), (35, '#c6dbef'), (80, '#d9b26f'), (200, '#8c510a')],
    'KEMIRINGAN': [(0, '#1a9850'), (2, '#91cf60'), (3, '#d9ef8b'), (8, '#fee08b'), (15, '#fc8d59'), (30, '#d73027')],
    'KEMIRINGAN_DASAR': [(0, '#1a9850'), (2, '#91cf60'), (5, '#fee08b'), (10, '#fc8d59'), (25, '#d73027')],
    'PASUT': [(0, '#ffffcc'), (1, '#a1dab4'), (2, '#41b6c4'), (3, '#2c7fb8'), (5, '#253494')],
    'PGA': [(0, '#ffffb2'), (0.15, '#fecc5c'), (0.35, '#fd8d3c'), (0.6, '#f03b20'), (1, '#bd0026')],
    'GELOMBANG_EKSTREM': [(0, '#e0f3f8'), (2, '#91bfdb'), (4, '#4575b4'), (6, '#fc8d59'), (9, '#d73027')],
    'ANGIN_100M': [(2, '#f7fcf5'), (4, '#c7e9c0'), (5.5, '#74c476'), (6.5, '#238b45'), (9, '#00441b')],
    'GHI': [(3.5, '#ffffcc'), (4.2, '#fed976'), (4.8, '#fd8d3c'), (5.5, '#e31a1c'), (6.5, '#800026')],
    'BEDA_SUHU_1000M': [(10, '#313695'), (15, '#74add1'), (18, '#fee090'), (20, '#f46d43'), (24, '#a50026')],
    'TANAH_LIAT': [(0, '#fff7bc'), (15, '#fec44f'), (30, '#d95f0e'), (45, '#993404'), (60, '#662506')],
    'SHANNON': [(0, '#f7fcfd'), (1, '#ccece6'), (2, '#66c2a4'), (3, '#238b45'), (4.5, '#00441b')],
}
SKALA_LOG = {'KLOROFIL', 'KD490'}
DIBALIK = {'KEDALAMAN'}


def raster_tersedia():
    hasil = cache.get('raster-tersedia')
    if hasil is None:
        hasil = frozenset(RasterOseanografi.objects.values_list('parameter', flat=True).distinct())
        cache.set('raster-tersedia', hasil, 600)
    return hasil


def daya_gelombang(tinggi, periode_puncak):
    if tinggi is None or periode_puncak is None:
        return None
    return 0.49 * tinggi ** 2 * 0.9 * periode_puncak


def nilai_titik(kode, x, y):
    hasil = np.full(len(x), np.nan)
    if not len(x):
        return hasil
    kotak = Polygon.from_bbox((float(x.min()), float(y.min()), float(x.max()), float(y.max())))
    kotak.srid = 4326
    for b in RasterOseanografi.objects.filter(parameter=kode, cakupan__bboverlaps=kotak).only('rast'):
        r = b.rast
        pita = r.bands[0]
        data = pita.data().reshape(r.height, r.width)
        kolom = np.floor((x - r.origin.x) / r.scale.x).astype(int)
        baris = np.floor((y - r.origin.y) / r.scale.y).astype(int)
        di = (kolom >= 0) & (kolom < r.width) & (baris >= 0) & (baris < r.height) & np.isnan(hasil)
        nilai = data[baris[di], kolom[di]].astype(float)
        if pita.nodata_value is not None:
            nilai[nilai == pita.nodata_value] = np.nan
        hasil[di] = nilai
    return hasil


def statistik(geom, parameter):
    hasil = _statistik(geom, parameter, False)
    kosong = [k for k in parameter if (hasil.get(k) or {}).get('rata2') is None]
    if kosong:
        hasil.update({k: v for k, v in _statistik(geom, kosong, True).items() if v['rata2'] is not None})
    return hasil


def _statistik(geom, parameter, bersinggungan):
    sql = """
        SELECT o.parameter, o.satuan, o.periode, o.sumber, ST_NumBands(o.rast),
               (ST_SummaryStats(c.r, 1, true)).count, (ST_SummaryStats(c.r, 1, true)).sum,
               (ST_SummaryStats(c.r, 1, true)).min, (ST_SummaryStats(c.r, 1, true)).max,
               (ST_SummaryStats(c.r, LEAST(2, ST_NumBands(o.rast)), true)).min,
               (ST_SummaryStats(c.r, ST_NumBands(o.rast), true)).max,
               ST_Value(o.rast, 1, t.titik), ST_Value(o.rast, LEAST(2, ST_NumBands(o.rast)), t.titik),
               ST_Value(o.rast, ST_NumBands(o.rast), t.titik)
        FROM analitik_raster_oseanografi o
        CROSS JOIN (SELECT ST_GeomFromEWKT(%s) AS g, ST_PointOnSurface(ST_GeomFromEWKT(%s)) AS titik) t
        CROSS JOIN LATERAL (SELECT ST_Clip(o.rast, t.g, true, %s) AS r) c
        WHERE o.cakupan && t.g AND o.parameter = ANY(%s)
    """
    hasil = {}
    with connection.cursor() as c:
        c.execute(sql, [geom.ewkt, geom.ewkt, bersinggungan, list(parameter)])
        for kode, satuan, periode, sumber, pita, n, jml, mn, mx, mn_waktu, mx_waktu, t1, t_mn, t_mx in c.fetchall():
            h = hasil.setdefault(kode, {'satuan': satuan, 'periode': periode, 'sumber': sumber, 'pita': pita,
                                        'n': 0, 'jumlah': 0.0, 'min': [], 'max': [], 'titik': None})
            if n:
                h['n'] += n
                h['jumlah'] += jml
                h['min'].append(mn if pita == 1 else mn_waktu)
                h['max'].append(mx if pita == 1 else mx_waktu)
            elif t1 is not None:
                h['titik'] = (t1, t_mn, t_mx)
    for h in hasil.values():
        if h['n']:
            h['rata2'], h['min'], h['max'] = h['jumlah'] / h['n'], min(h['min']), max(h['max'])
        elif h['titik']:
            h['rata2'], h['min'], h['max'] = h['titik'] if h['pita'] > 1 else (h['titik'][0],) * 3
        else:
            h['rata2'] = None
    return hasil


def keterangan_peta():
    parameter = {}
    for kode, label in RasterOseanografi.PARAMETER_CHOICES:
        r = RasterOseanografi.objects.filter(parameter=kode).values('satuan', 'periode', 'sumber').first()
        if r:
            parameter[kode] = {'label': label, **r, 'skala': [[nilai, warna] for nilai, warna in PALET[kode]],
                               'log': kode in SKALA_LOG}
    return {'batas': BATAS, 'parameter': parameter}


def _mosaik(kode):
    baris = list(RasterOseanografi.objects.filter(parameter=kode).only('rast'))
    if not baris:
        return None, None
    res = abs(baris[0].rast.scale.x)
    nx = round((BATAS[2] - BATAS[0]) / res)
    ny = round((BATAS[3] - BATAS[1]) / res)
    grid = np.full((ny, nx), np.nan, dtype='float32')
    for b in baris:
        pita = b.rast.bands[0]
        data = pita.data().astype('float32').reshape(b.rast.height, b.rast.width)
        if pita.nodata_value is not None:
            data[data == pita.nodata_value] = np.nan
        x0 = round((b.rast.origin.x - BATAS[0]) / res)
        y0 = round((BATAS[3] - b.rast.origin.y) / res)
        sy, sx = max(0, -y0), max(0, -x0)
        ty, tx = max(0, y0), max(0, x0)
        h = min(data.shape[0] - sy, ny - ty)
        w = min(data.shape[1] - sx, nx - tx)
        if h > 0 and w > 0:
            grid[ty:ty + h, tx:tx + w] = data[sy:sy + h, sx:sx + w]
    return grid, res


def _merc(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def _warnai(nilai, kode):
    stop = PALET[kode]
    if kode in DIBALIK:
        nilai = -nilai
    if kode in SKALA_LOG:
        nilai = np.log10(np.clip(nilai, 1e-3, None))
        posisi = [math.log10(s) for s, _ in stop]
    else:
        posisi = [s for s, _ in stop]
    rgb = [[int(w[i:i + 2], 16) for i in (1, 3, 5)] for _, w in stop]
    kosong = np.isnan(nilai)
    nilai = np.where(kosong, posisi[0], nilai)
    rgba = np.zeros((*nilai.shape, 4), dtype='uint8')
    for k in range(3):
        rgba[..., k] = np.interp(nilai, posisi, [c[k] for c in rgb]).astype('uint8')
    rgba[..., 3] = np.where(kosong, 0, 255)
    return rgba


def _png(rgba):
    tinggi, lebar = rgba.shape[:2]
    mentah = b''.join(b'\x00' + rgba[i].tobytes() for i in range(tinggi))

    def potongan(jenis, data):
        return struct.pack('>I', len(data)) + jenis + data + struct.pack('>I', zlib.crc32(jenis + data) & 0xFFFFFFFF)

    return (b'\x89PNG\r\n\x1a\n' + potongan(b'IHDR', struct.pack('>IIBBBBB', lebar, tinggi, 8, 6, 0, 0, 0))
            + potongan(b'IDAT', zlib.compress(mentah, 6)) + potongan(b'IEND', b''))


def gambar_peta(kode):
    versi = RasterOseanografi.objects.filter(parameter=kode).aggregate(t=Max('ditarik_pada'))['t']
    if versi is None:
        return None
    kunci = f'oseanografi:png:{kode}:{int(versi.timestamp())}'
    isi = cache.get(kunci)
    if isi is None:
        grid, res = _mosaik(kode)
        ny, nx = grid.shape
        lebar = min(nx, LEBAR_MAKS_PNG)
        atas, bawah = _merc(BATAS[3]), _merc(BATAS[1])
        tinggi = round(lebar * (atas - bawah) / math.radians(BATAS[2] - BATAS[0]))
        lintang = np.degrees(np.arctan(np.sinh(atas - (np.arange(tinggi) + 0.5) * (atas - bawah) / tinggi)))
        baris = np.clip(((BATAS[3] - lintang) / res).astype(int), 0, ny - 1)
        kolom = np.clip(((np.arange(lebar) + 0.5) / lebar * nx).astype(int), 0, nx - 1)
        isi = _png(_warnai(grid[baris][:, kolom], kode))
        cache.set(kunci, isi, CACHE_PNG_DETIK)
    return isi
