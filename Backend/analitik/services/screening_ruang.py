import json
from typing import Any, Dict, List, Optional

from django.contrib.gis.geos import GEOSGeometry
from django.db import connection

from analitik.models import KetentuanRuang
from analitik.services.konstanta import (
    AMBANG_CAKUPAN_ACUAN,
    AMBANG_IRISAN_KKPRL_M2,
    BATAS_PERIKSA_LOKASI,
    JENIS_ZONA_TERLARANG,
    JUMLAH_LOKASI_ALTERNATIF,
    LABEL_SUMBER_ZONASI,
    PRIORITAS_SUMBER_ZONASI,
    RADIUS_LOKASI_ALTERNATIF_KM,
    SEKTOR_SUB_ZONA_COCOK,
    SUB_ZONA_TANPA_RINCIAN,
)
from analitik.services.laporan_spasial import _arah
from inti.models import SektorInvestasi
from inventarisasi.models import ZonasiRuangLaut

URUTAN_ACUAN = ['RTRW_PROVINSI', 'KAW', 'RTRWN']
BATAS_SYARAT_RINGKAS = 240
LABEL_ACUAN = dict(ZonasiRuangLaut.TINGKAT_ACUAN_CHOICES)
LABEL_SUB_ZONA = dict(ZonasiRuangLaut.SUB_ZONA_CHOICES)
LABEL_JENIS_ZONA = dict(ZonasiRuangLaut.JENIS_ZONA_CHOICES)
LABEL_KETENTUAN = dict(KetentuanRuang.STATUS_CHOICES)
LABEL_STATUS = {
    'SESUAI': 'Sesuai',
    'SESUAI_BERSYARAT': 'Sesuai bersyarat',
    'TIDAK_SESUAI': 'Tidak sesuai',
    'BELUM_TERVERIFIKASI': 'Belum dapat diverifikasi',
}
BOLEH = ('DIIZINKAN', 'BERSYARAT')


NAMA_TANPA_ARTI = {'', '-', 'TIDAK ADA KETERANGAN', 'TIDAK ADA KETERANGAN TAMBAHAN'}


def _nama_zona(nama: str, sub_zona: str, provinsi: str) -> str:
    if (nama or '').strip().upper() in NAMA_TANPA_ARTI:
        return f'{LABEL_SUB_ZONA.get(sub_zona, sub_zona)} ({provinsi})'
    return nama


def _prioritas_sumber(sumber: str) -> int:
    if sumber in PRIORITAS_SUMBER_ZONASI:
        return PRIORITAS_SUMBER_ZONASI.index(sumber)
    return len(PRIORITAS_SUMBER_ZONASI)


def _geos(ewkb) -> GEOSGeometry:
    g = GEOSGeometry(memoryview(ewkb))
    return g if g.valid else g.buffer(0)


def _luas(c, geom) -> float:
    if geom is None or geom.empty:
        return 0.0
    c.execute('SELECT ST_Area(ST_GeomFromEWKB(%s)::geography)', [bytes(geom.ewkb)])
    return float(c.fetchone()[0] or 0)


def isi_ketentuan_bawaan() -> int:
    kode_sub = [k for k, _ in ZonasiRuangLaut.SUB_ZONA_CHOICES if k not in SUB_ZONA_TANPA_RINCIAN]
    dibuat = 0
    for sektor in SektorInvestasi.objects.all():
        cocok = SEKTOR_SUB_ZONA_COCOK.get(sektor.kode)
        if cocok is None:
            continue
        for sub in kode_sub:
            _, baru = KetentuanRuang.objects.get_or_create(
                sektor=sektor, sub_zona=sub, provinsi=None,
                defaults={
                    'status': 'DIIZINKAN' if sub in cocok else 'TIDAK_DIIZINKAN',
                    'sumber': 'Bawaan sistem (peruntukan sub-zona RZWP-3-K)',
                },
            )
            dibuat += baru
    return dibuat


def _aturan_per_sektor() -> Dict[int, Dict[tuple, KetentuanRuang]]:
    hasil: Dict[int, Dict[tuple, KetentuanRuang]] = {}
    for k in KetentuanRuang.objects.all():
        hasil.setdefault(k.sektor_id, {})[(k.sub_zona, k.provinsi_id)] = k
    return hasil


def _ketentuan(aturan, zona) -> Dict[str, Any]:
    if zona['jenis_zona'] in JENIS_ZONA_TERLARANG:
        return {'status': 'TIDAK_DIIZINKAN', 'syarat': '', 'sumber': 'UU No. 6/1996 & PP No. 37/2002 (ALKI)'}
    k = aturan.get((zona['sub_zona'], zona['provinsi_id'])) or aturan.get((zona['sub_zona'], None))
    if k is None:
        return {'status': None, 'syarat': '', 'sumber': ''}
    return {'status': k.status, 'syarat': k.syarat, 'sumber': k.sumber}


def _nilai(zona_efektif, aturan, cakupan, ada_kkprl) -> str:
    status = [_ketentuan(aturan, z)['status'] for z in zona_efektif]
    if ada_kkprl or 'TIDAK_DIIZINKAN' in status:
        return 'TIDAK_SESUAI'
    if cakupan < AMBANG_CAKUPAN_ACUAN or not zona_efektif or None in status:
        return 'BELUM_TERVERIFIKASI'
    if 'BERSYARAT' in status:
        return 'SESUAI_BERSYARAT'
    return 'SESUAI'


def _zona_efektif(c, geom, luas_aoi):
    c.execute(
        """
        SELECT z.id, z.nama_zona, z.jenis_zona, z.sub_zona, z.tingkat_acuan, z.sumber_data,
               z.nomor_regulasi, z.provinsi_id, p.nama,
               ST_AsEWKB(ST_Intersection(ST_MakeValid(ST_ClipByBox2D(z.geometry, ST_Expand(a.g, 0.0001))), a.g))
        FROM inventarisasi_zonasi_ruang_laut z
        JOIN inti_provinsi p ON p.id = z.provinsi_id,
             (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE z.geometry && a.g AND ST_Intersects(z.geometry, a.g)
        """,
        [geom.ewkt],
    )
    baris = c.fetchall()
    sisa = geom
    efektif = []
    urutan = sorted(
        {(r[4], r[5], r[3] in SUB_ZONA_TANPA_RINCIAN) for r in baris},
        key=lambda t: (URUTAN_ACUAN.index(t[0]), _prioritas_sumber(t[1]), t[2]),
    )
    for tingkat, sumber, umum in urutan:
        if sisa.empty:
            break
        gabung = None
        for (zid, nama, jenis, sub, tk, sd, regulasi, prov_id, prov_nama, ewkb) in baris:
            if tk != tingkat or sd != sumber or (sub in SUB_ZONA_TANPA_RINCIAN) != umum or ewkb is None:
                continue
            irisan = _geos(ewkb).intersection(sisa)
            m2 = _luas(c, irisan)
            if m2 < 1.0:
                continue
            efektif.append({
                'id': zid,
                'nama': _nama_zona(nama, sub, prov_nama),
                'jenis_zona': jenis,
                'jenis_label': LABEL_JENIS_ZONA.get(jenis, jenis),
                'sub_zona': sub,
                'sub_zona_label': LABEL_SUB_ZONA.get(sub, sub),
                'tingkat': tingkat,
                'tingkat_label': LABEL_ACUAN[tingkat],
                'sumber_label': LABEL_SUMBER_ZONASI.get(sumber, sumber),
                'regulasi': regulasi,
                'provinsi_id': prov_id,
                'provinsi': prov_nama,
                'luas_m2': m2,
                'persen': round(m2 / luas_aoi * 100, 1) if luas_aoi else 0,
            })
            gabung = irisan if gabung is None else gabung.union(irisan)
        if gabung is not None:
            sisa = sisa.difference(gabung)
    luas_sisa = _luas(c, sisa)
    cakupan = max(0.0, 1 - luas_sisa / luas_aoi) if luas_aoi else 0.0
    return efektif, cakupan


def _kkprl(c, geom) -> List[Dict[str, Any]]:
    c.execute(
        """
        SELECT k.nomor_izin, k.nama_pemohon, k.jenis_kegiatan,
               ST_Area(ST_Intersection(ST_MakeValid(ST_ClipByBox2D(k.geometry, ST_Expand(a.g, 0.0001))), a.g)::geography)
        FROM inventarisasi_kkprl k, (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE k.status = 'AKTIF' AND k.geometry && a.g AND ST_Intersects(k.geometry, a.g)
        """,
        [geom.ewkt],
    )
    return [
        {'nomor_izin': n, 'pemohon': p, 'kegiatan': j, 'luas_m2': float(m2)}
        for n, p, j, m2 in c.fetchall()
        if (m2 or 0) > AMBANG_IRISAN_KKPRL_M2
    ]


def _lokasi_alternatif(c, geom, aturan) -> List[Dict[str, Any]]:
    sub_boleh = sorted({sub for (sub, _), k in aturan.items() if k.status in BOLEH})
    if not sub_boleh:
        return []
    pusat = geom.centroid
    c.execute(
        """
        SELECT z.id, z.nama_zona, z.sub_zona, p.nama,
               ST_AsText(ST_PointOnSurface(ST_ClipByBox2D(
                   z.geometry, ST_Expand(ST_ClosestPoint(z.geometry, ST_GeomFromEWKT(%s)), 0.005))))
        FROM inventarisasi_zonasi_ruang_laut z JOIN inti_provinsi p ON p.id = z.provinsi_id
        WHERE z.sub_zona = ANY(%s) AND z.jenis_zona <> ALL(%s)
          AND NOT ST_Intersects(z.geometry, ST_GeomFromEWKT(%s))
        ORDER BY z.geometry <-> ST_GeomFromEWKT(%s)
        LIMIT 30
        """,
        [pusat.ewkt, sub_boleh, list(JENIS_ZONA_TERLARANG), geom.ewkt, pusat.ewkt],
    )
    hasil, terpakai, diperiksa = [], set(), 0
    for zid, nama, sub, prov, wkt in c.fetchall():
        if diperiksa >= BATAS_PERIKSA_LOKASI or not wkt or (nama, sub) in terpakai:
            continue
        titik = GEOSGeometry(wkt, srid=4326)
        kunci_titik = (round(titik.x, 3), round(titik.y, 3))
        if kunci_titik in terpakai:
            continue
        c.execute(
            'SELECT ST_Distance(ST_GeomFromEWKT(%s)::geography, ST_GeomFromEWKT(%s)::geography), '
            'degrees(ST_Azimuth(ST_GeomFromEWKT(%s), ST_GeomFromEWKT(%s)))',
            [pusat.ewkt, titik.ewkt, pusat.ewkt, titik.ewkt],
        )
        meter, azimut = c.fetchone()
        km = float(meter or 0) / 1000.0
        if km > RADIUS_LOKASI_ALTERNATIF_KM:
            break
        diperiksa += 1
        uji = titik.buffer(0.0005)
        efektif, cakupan = _zona_efektif(c, uji, _luas(c, uji))
        status = _nilai(efektif, aturan, cakupan, bool(_kkprl(c, uji)))
        if status not in ('SESUAI', 'SESUAI_BERSYARAT'):
            continue
        terpakai.update({(nama, sub), kunci_titik})
        hasil.append({
            'zona_id': zid,
            'nama': _nama_zona(nama, sub, prov),
            'sub_zona_label': LABEL_SUB_ZONA.get(sub, sub),
            'provinsi': prov,
            'status_label': LABEL_STATUS[status],
            'jarak_km': round(km, 1),
            'arah': _arah(float(azimut)) if azimut is not None else '',
            'titik': [round(titik.x, 6), round(titik.y, 6)],
        })
        if len(hasil) >= JUMLAH_LOKASI_ALTERNATIF:
            break
    return hasil


def _alasan(sektor_nama, zona_efektif, aturan, cakupan, kkprl) -> List[str]:
    alasan = []
    if kkprl:
        nomor = ', '.join(k['nomor_izin'] for k in kkprl[:5])
        lebih = f' dan {len(kkprl) - 5} lainnya' if len(kkprl) > 5 else ''
        alasan.append(
            f'Area tumpang tindih dengan {len(kkprl)} KKPRL yang sudah terbit ({nomor}{lebih}). '
            f'Investasi tidak boleh tumpang tindih dengan KKPRL yang sudah terbit.'
        )
    kelompok: Dict[tuple, Dict[str, Any]] = {}
    for z in zona_efektif:
        k = kelompok.setdefault((z['nama'], z['sub_zona'], z['tingkat']), {**z, 'persen': 0})
        k['persen'] = round(k['persen'] + z['persen'], 1)
    for z in kelompok.values():
        ket = _ketentuan(aturan, z)
        lokasi = f"{z['persen']}% area berada di {z['nama']} ({z['sub_zona_label']}, {z['tingkat_label']})"
        syarat = ket['syarat'] if len(ket['syarat']) <= BATAS_SYARAT_RINGKAS else (
            'Syarat lengkapnya tercantum pada ketentuan khusus zona ini di tabel ketentuan kegiatan.')
        if z['jenis_zona'] in JENIS_ZONA_TERLARANG:
            alasan.append(f'{lokasi}, yaitu Alur Laut Kepulauan Indonesia yang tidak dapat dimanfaatkan untuk investasi.')
        elif ket['status'] == 'TIDAK_DIIZINKAN':
            alasan.append(f'{lokasi} yang tidak mengizinkan kegiatan {sektor_nama}.')
        elif ket['status'] == 'BERSYARAT':
            alasan.append(f"{lokasi}: {sektor_nama} diizinkan bersyarat. {syarat or 'Syarat mengikuti ketentuan RTRW yang berlaku.'}")
        elif ket['status'] is None:
            alasan.append(
                f'{lokasi} yang belum memiliki ketentuan pemanfaatan untuk {sektor_nama}; '
                f'kesesuaian belum dapat diverifikasi sampai ketentuannya ditetapkan.'
            )
    if cakupan < AMBANG_CAKUPAN_ACUAN:
        alasan.append(
            f'{round((1 - cakupan) * 100, 1)}% area tidak tercakup acuan tata ruang mana pun '
            f'(RTRW Provinsi, Rencana Zonasi KAW, maupun RTRWN).'
        )
    return alasan


def _informasi_ruang(c, zona_efektif, semua_aturan, sektor_aktif) -> List[Dict[str, Any]]:
    kelompok: Dict[str, Dict[str, Any]] = {}
    for z in zona_efektif:
        kunci = f"{z['nama']}|{z['sub_zona']}|{z['tingkat']}"
        if kunci in kelompok:
            kelompok[kunci]['persen'] = round(kelompok[kunci]['persen'] + z['persen'], 1)
            continue
        kegiatan = {kode: [] for kode in LABEL_KETENTUAN}
        sumber, khusus = [], []
        for s in sektor_aktif:
            ket = _ketentuan(semua_aturan.get(s.id, {}), z)
            if ket['status'] in kegiatan:
                kegiatan[ket['status']].append(s.nama)
            if ket['sumber'] and ket['sumber'] not in sumber:
                sumber.append(ket['sumber'])
            if ket['status'] == 'BERSYARAT' and ket['syarat'] and ket['syarat'] not in khusus:
                khusus.append(ket['syarat'])
        kelompok[kunci] = {'nama': z['nama'], 'jenis_label': z['jenis_label'], 'sub_zona_label': z['sub_zona_label'],
                           'persen': z['persen'], 'dasar_zona': ' - '.join(filter(None, [z['sumber_label'], z['regulasi']])),
                           'sumber_aturan': sumber, 'ketentuan_khusus': khusus, 'kegiatan': kegiatan, 'kkprl_terbit': []}
    if not zona_efektif:
        return []
    c.execute(
        """
        SELECT g.kunci, COALESCE(s.nama, 'Belum terklasifikasi'), COUNT(DISTINCT k.id)
        FROM unnest(%s::int[], %s::text[]) AS g(zid, kunci)
        JOIN inventarisasi_zonasi_ruang_laut z ON z.id = g.zid
        JOIN inventarisasi_kkprl k ON k.status = 'AKTIF' AND k.geometry && z.geometry
             AND ST_Intersects(k.geometry, z.geometry)
        LEFT JOIN inti_sektor_investasi s ON s.id = k.sektor_id
        GROUP BY 1, 2
        ORDER BY 3 DESC
        """,
        [[z['id'] for z in zona_efektif], [f"{z['nama']}|{z['sub_zona']}|{z['tingkat']}" for z in zona_efektif]],
    )
    for kunci, jenis, n in c.fetchall():
        kelompok[kunci]['kkprl_terbit'].append({'jenis': jenis, 'jumlah': n})
    return sorted(kelompok.values(), key=lambda g: -g['persen'])


def screening_ruang(geometry: Dict[str, Any], sektor_kode: str) -> Dict[str, Any]:
    geom = GEOSGeometry(json.dumps(geometry), srid=4326)
    if not geom.valid:
        geom = geom.buffer(0)
    sektor = SektorInvestasi.objects.filter(kode=sektor_kode).first()
    if sektor is None:
        raise ValueError(f'Jenis investasi "{sektor_kode}" tidak dikenal.')

    semua_aturan = _aturan_per_sektor()
    aturan = semua_aturan.get(sektor.id, {})

    with connection.cursor() as c:
        luas_aoi = _luas(c, geom)
        zona_efektif, cakupan = _zona_efektif(c, geom, luas_aoi)
        kkprl = _kkprl(c, geom)
        informasi_ruang = _informasi_ruang(
            c, zona_efektif, semua_aturan,
            list(SektorInvestasi.objects.filter(aktif=True).order_by('urutan', 'nama')),
        )
        status = _nilai(zona_efektif, aturan, cakupan, bool(kkprl))
        lanjut = status in ('SESUAI', 'SESUAI_BERSYARAT')

        rekomendasi: Optional[Dict[str, Any]] = None
        if not lanjut:
            alternatif = []
            if not kkprl:
                for s in SektorInvestasi.objects.filter(aktif=True).exclude(id=sektor.id).order_by('urutan', 'nama'):
                    st = _nilai(zona_efektif, semua_aturan.get(s.id, {}), cakupan, False)
                    if st in ('SESUAI', 'SESUAI_BERSYARAT'):
                        alternatif.append({'kode': s.kode, 'nama': s.nama, 'status_label': LABEL_STATUS[st]})
            rekomendasi = {
                'sektor_alternatif': alternatif,
                'lokasi_alternatif': _lokasi_alternatif(c, geom, aturan),
            }

    for z in zona_efektif:
        ket = _ketentuan(aturan, z)
        z['ketentuan'] = ket['status']
        z['ketentuan_label'] = LABEL_KETENTUAN.get(ket['status'], 'Belum ditetapkan')
        z['syarat'] = ket['syarat']
        z['sumber_ketentuan'] = ket['sumber']

    tingkat_dipakai = []
    for t in URUTAN_ACUAN:
        persen = round(sum(z['persen'] for z in zona_efektif if z['tingkat'] == t), 1)
        if persen:
            tingkat_dipakai.append({'tingkat': t, 'label': LABEL_ACUAN[t], 'persen': persen})

    return {
        'status': status,
        'status_label': LABEL_STATUS[status],
        'lanjut': lanjut,
        'sektor': sektor.kode,
        'sektor_nama': sektor.nama,
        'luas_m2': luas_aoi,
        'cakupan_persen': round(cakupan * 100, 1),
        'acuan': tingkat_dipakai,
        'zona': zona_efektif,
        'informasi_ruang': informasi_ruang,
        'kkprl': kkprl,
        'alasan': _alasan(sektor.nama, zona_efektif, aturan, cakupan, kkprl),
        'rekomendasi': rekomendasi,
    }
