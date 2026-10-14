import re

from django.db.models import Q

from analitik.models import NilaiWilayahParameter, ParameterTambahan
from analitik.services.pengaturan import atur

LABEL_PERAN = dict(ParameterTambahan.PERAN_CHOICES)


def _g(n):
    return f'{n:g}'.replace('.', ',')


def berlaku(sektor_kode, provinsi_ids, peran=None):
    qs = ParameterTambahan.objects.filter(aktif=True).filter(
        Q(sektor__isnull=True) | Q(sektor__kode=sektor_kode)
    ).filter(Q(provinsi__isnull=True) | Q(provinsi__id__in=list(provinsi_ids)))
    if peran:
        qs = qs.filter(peran__in=peran)
    return list(qs.distinct().order_by('nama'))


def ambang_teks(p):
    satuan = f' {p.satuan}' if p.satuan else ''
    if p.nilai_min is not None and p.nilai_maks is not None:
        return f'{_g(p.nilai_min)}-{_g(p.nilai_maks)}{satuan}'
    if p.nilai_min is not None:
        return f'paling rendah {_g(p.nilai_min)}{satuan}'
    return f'paling tinggi {_g(p.nilai_maks)}{satuan}'


def sesuai_ambang(p, nilai):
    return (p.nilai_min is None or nilai >= p.nilai_min) and (p.nilai_maks is None or nilai <= p.nilai_maks)


def _area(c, p, geom):
    c.execute(
        'SELECT COALESCE(SUM(ST_Area(ST_Intersection(a.geometry, g.g)::geography)), 0), ST_Area(g.g::geography) '
        'FROM (SELECT ST_GeomFromEWKT(%s) AS g) g LEFT JOIN analitik_area_parameter a ON a.parameter_id = %s '
        'AND a.geometry && g.g AND ST_Intersects(a.geometry, g.g) GROUP BY g.g',
        [geom.ewkt, p.id],
    )
    irisan, luas = c.fetchone()
    persen = round(100 * irisan / luas, 1) if luas else 0
    if p.kondisi == 'DI_DALAM':
        return persen >= 100 * atur('AMBANG_KECOCOKAN'), f'{_g(persen)}% area berada di dalam {p.nama}'
    if irisan < 1:
        return True, f'area tidak beririsan dengan {p.nama}'
    return False, f'{_g(persen)}% area beririsan dengan {p.nama}'


def _tabel(c, p, geom, provinsi_ids):
    if p.tingkat == 'PROVINSI':
        r = NilaiWilayahParameter.objects.filter(parameter=p, provinsi_id__in=list(provinsi_ids)).values_list(
            'nilai', 'provinsi__nama').first()
    else:
        c.execute(
            'SELECT n.nilai, k.nama FROM analitik_nilai_wilayah_parameter n '
            'JOIN inti_kabupaten_kota k ON k.id = n.kabupaten_id '
            'WHERE n.parameter_id = %s AND k.provinsi_id = ANY(%s) AND k.geometry IS NOT NULL '
            'ORDER BY k.geometry <-> ST_PointOnSurface(ST_GeomFromEWKT(%s)) LIMIT 1',
            [p.id, list(provinsi_ids), geom.ewkt],
        )
        r = c.fetchone()
    if not r:
        return None, 'nilai wilayah ini tidak tercantum pada tabel'
    nilai, wilayah = r
    satuan = f' {p.satuan}' if p.satuan else ''
    return sesuai_ambang(p, nilai), f'{wilayah}: {_g(nilai)}{satuan} (syarat {ambang_teks(p)})'


def nilai_area(c, geom, sektor_kode, provinsi_ids):
    hasil = []
    for p in berlaku(sektor_kode, provinsi_ids):
        nilai, keterangan = _area(c, p, geom) if p.tipe == 'AREA' else _tabel(c, p, geom, provinsi_ids)
        hasil.append({
            'id': p.id, 'nama': p.nama, 'tipe': p.tipe, 'peran': p.peran, 'peran_label': LABEL_PERAN[p.peran],
            'hasil': nilai, 'keterangan': keterangan, 'sumber': p.sumber,
        })
    return hasil


def kunci_nama(teks):
    teks = re.sub(r'\b(kabupaten|kab|adm|administrasi|provinsi|prov)\b\.?', ' ', str(teks or '').lower())
    return re.sub(r'[^a-z0-9]', '', teks)
