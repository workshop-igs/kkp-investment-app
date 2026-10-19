import json
from typing import Any, Dict, List, Optional

from django.contrib.gis.geos import GeometryCollection, GEOSException, GEOSGeometry
from django.db import connection

from analitik.models import KetentuanRuang
from analitik.services import pengecualian
from analitik.services.asal_data import asal_data, catatan_skala, kelengkapan
from analitik.services.konstanta import (
    AMBANG_IRISAN_KKPRL_M2,
    BATAS_JARAK_PANTAI_DERAJAT,
    BULAN,
    GMW_TAHUN_AKHIR,
    JENIS_ZONA_TERLARANG,
    KETENTUAN_DARAT_BAWAAN,
    KM_PER_DERAJAT,
    LABEL_SUMBER_ZONASI,
    PRIORITAS_SUMBER_ZONASI,
    SEKTOR_SUB_ZONA_COCOK,
    SUB_ZONA_TANPA_RINCIAN,
)
from analitik.services.kriteria import (
    RASTER_DARAT,
    RASTER_DATA,
    dari_raster,
    jarak_area,
    penilaian,
    sumber_tersedia,
    uraian,
)
from analitik.services.kriteria import alasan as alasan_fisik
from analitik.services.laporan_spasial import _arah
from analitik.services.oseanografi import statistik as statistik_oseanografi
from analitik.services.parameter_tambahan import nilai_area
from analitik.services.pengaturan import atur
from inti.models import SektorInvestasi
from inventarisasi.klasifikasi import KATA_SEKTOR, PENANDA_MATRIKS, rincian_kegiatan, status_rincian, syarat_rincian
from inventarisasi.models import MatriksKKPRL, ZonasiRuangLaut

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
LABEL_ADAT = 'Di luar wilayah kelola masyarakat hukum adat'


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


def _overlay(c, operasi, a, b=None) -> GEOSGeometry:
    try:
        return a.unary_union if b is None else getattr(a, operasi.lower())(b)
    except GEOSException:
        geom = [bytes(g.ewkb) for g in (a, b) if g is not None]
        masukan = ', '.join(['ST_CollectionExtract(ST_GeomFromEWKB(%s), 3)'] * len(geom))
        c.execute(f'SELECT ST_AsEWKB(ST_CollectionExtract(ST_{operasi}({masukan}, 1e-9), 3))', geom)
        return _geos(c.fetchone()[0])


def _bagian(geom) -> List[GEOSGeometry]:
    if geom.geom_type == 'GeometryCollection':
        return [b for g in geom for b in _bagian(g)]
    return [geom]


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
        darat = KETENTUAN_DARAT_BAWAAN.get(sektor.kode, {})
        for sub in kode_sub:
            if sub.startswith('DARAT_'):
                bawaan = {
                    'status': darat.get(sub, 'TIDAK_DIIZINKAN'),
                    'sumber': 'Bawaan sistem (peruntukan kawasan Pola Ruang darat RTRW, Permen ATR/BPN 11/2021)',
                }
            else:
                bawaan = {
                    'status': 'DIIZINKAN' if sub in cocok else 'TIDAK_DIIZINKAN',
                    'sumber': 'Bawaan sistem (peruntukan sub-zona RZWP-3-K)',
                }
            _, baru = KetentuanRuang.objects.get_or_create(sektor=sektor, sub_zona=sub, provinsi=None, defaults=bawaan)
            dibuat += baru
    return dibuat


SEBARAN_KEDALAMAN = """
    SELECT z.id, GREATEST(0, -v.value), SUM(v.count)
    FROM {zona} z
    JOIN analitik_raster_oseanografi o ON o.parameter = 'KEDALAMAN' AND o.cakupan && z.geometry
    CROSS JOIN LATERAL ST_ValueCount(ST_Clip(o.rast, z.geometry, true), 1, true) v
    GROUP BY 1, 2
"""


def _angka(nilai, digit=1):
    return f'{nilai:.{digit}f}'.replace('.', ',')


def _persen_area(nilai):
    return '<0,1%' if nilai < 0.1 else f'{_angka(nilai)}%'


def ekosistem_di(c, geom):
    c.execute(
        """
        SELECT DISTINCT jenis FROM inventarisasi_sumber_daya_alam
        WHERE geometry && ST_GeomFromEWKT(%s) AND ST_Intersects(geometry, ST_GeomFromEWKT(%s))
          AND (sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG')
               OR (sumber_data = 'GMW-MANGROVE' AND tahun_data = %s))
        """,
        [geom.ewkt, geom.ewkt, GMW_TAHUN_AKHIR],
    )
    return {r[0] for r in c.fetchall()}


def _catat_oseanografi(data, stat):
    data['oseanografi'] = {
        k: {'sumber': v.get('sumber'), 'periode': v.get('periode')} for k, v in stat.items() if v.get('rata2') is not None
    }


def karakter_area(c, geom):
    c.execute(
        'SELECT EXISTS (SELECT 1 FROM inti_provinsi WHERE geometry && ST_PointOnSurface(ST_GeomFromEWKT(%s)) '
        'AND ST_Intersects(geometry, ST_PointOnSurface(ST_GeomFromEWKT(%s))))',
        [geom.ewkt, geom.ewkt],
    )
    darat = c.fetchone()[0]
    tersedia = sumber_tersedia()
    data = {'ranah': 'DARAT' if darat else 'LAUT', 'ekosistem': ekosistem_di(c, geom)}
    kunci = [k for k in RASTER_DATA if (k in RASTER_DARAT) == darat]
    stat = statistik_oseanografi(geom, sorted({RASTER_DATA[k] for k in kunci}))
    _catat_oseanografi(data, stat)
    for k in kunci:
        data[k] = dari_raster(k, (stat.get(RASTER_DATA[k]) or {}).get('rata2'))
    if not darat:
        if 'TERUMBU_KARANG' in tersedia:
            data['karang'] = int('TERUMBU_KARANG' in data['ekosistem'])
        c.execute(
            'SELECT MIN(ST_Distance(COALESCE(v.geometry_tampilan, v.geometry), a.g)) '
            'FROM inti_provinsi v, (SELECT ST_GeomFromEWKT(%s) AS g) a '
            'WHERE ST_DWithin(COALESCE(v.geometry_tampilan, v.geometry), a.g, %s)',
            [geom.ewkt, BATAS_JARAK_PANTAI_DERAJAT],
        )
        jarak = c.fetchone()[0]
        data['jarak_pantai_km'] = (jarak if jarak is not None else BATAS_JARAK_PANTAI_DERAJAT) * KM_PER_DERAJAT
    data.update(jarak_area(c, geom.ewkt, tersedia))
    return data


def _ringkas(data, hasil):
    letak = 'Darat' if data['ranah'] == 'DARAT' else 'Perairan'
    if not hasil:
        return letak
    return '; '.join([letak, *(f"{k['label'].lower()} {k['nilai_teks']}" for k in hasil[0]['kriteria'] if k['nilai_teks'])])


def _aturan_per_sektor(matriks=None) -> Dict[int, Dict[tuple, Any]]:
    hasil: Dict[int, Dict[tuple, Any]] = {}
    for k in KetentuanRuang.objects.all():
        hasil.setdefault(k.sektor_id, {})[(k.sub_zona, k.provinsi_id)] = k
    sektor = dict(SektorInvestasi.objects.filter(kode__in=KATA_SEKTOR).values_list('kode', 'id'))
    blok = MatriksKKPRL.objects.all() if matriks is None else MatriksKKPRL.objects.filter(id__in=matriks)
    for m in blok:
        for kode, sid in sektor.items():
            rincian = rincian_kegiatan(m, kode)
            status = status_rincian(rincian)
            if status:
                hasil.setdefault(sid, {})[('MATRIKS', m.id)] = {
                    'status': status,
                    'syarat': syarat_rincian(rincian, m.ketentuan_khusus) if status == 'BERSYARAT' else '',
                    'sumber': f'{m.sumber} ({m.nama_zona})'[:255],
                    'rincian': rincian,
                }
    return hasil


def _ketentuan(aturan, zona) -> Dict[str, Any]:
    if zona['jenis_zona'] in JENIS_ZONA_TERLARANG:
        return {'status': 'TIDAK_DIIZINKAN', 'syarat': '', 'sumber': 'UU No. 6/1996 & PP No. 37/2002 (ALKI)'}
    k = aturan.get((zona['sub_zona'], zona['provinsi_id']))
    dari_matriks = aturan.get(('MATRIKS', zona.get('matriks_id')))
    if dari_matriks and (k is None or PENANDA_MATRIKS in k.sumber):
        return dari_matriks
    k = k or aturan.get((zona['sub_zona'], None))
    if k is None:
        return {'status': None, 'syarat': '', 'sumber': ''}
    return {'status': k.status, 'syarat': k.syarat, 'sumber': k.sumber}


def _nilai(zona_efektif, aturan, cakupan, luas_aoi, kkprl_gugur=False):
    per_zona: Dict[tuple, Dict[str, Any]] = {}
    for z in zona_efektif:
        st = _ketentuan(aturan, z)['status']
        k = per_zona.setdefault((st, z['nama']), {'nama': z['nama'], 'status': st, 'persen': 0.0})
        k['persen'] += z['luas_m2'] / luas_aoi * 100 if luas_aoi else 0.0
    masalah = [k for k in per_zona.values() if k['status'] in ('TIDAK_DIIZINKAN', None)]
    tepi = masalah if 0 < sum(k['persen'] for k in masalah) < atur('AMBANG_IRISAN_TEPI_PERSEN') else []
    status = {k['status'] for k in per_zona.values() if k not in tepi}
    if kkprl_gugur or 'TIDAK_DIIZINKAN' in status:
        hasil = 'TIDAK_SESUAI'
    elif cakupan < atur('AMBANG_CAKUPAN_ACUAN') or not zona_efektif or None in status:
        hasil = 'BELUM_TERVERIFIKASI'
    elif 'BERSYARAT' in status or tepi:
        hasil = 'SESUAI_BERSYARAT'
    else:
        hasil = 'SESUAI'
    return hasil, [{**k, 'persen': round(k['persen'], 2)} for k in tepi]


def _zona_efektif(c, geom, luas_aoi):
    c.execute(
        """
        SELECT z.id, z.nama_zona, z.jenis_zona, z.sub_zona, z.tingkat_acuan, z.sumber_data,
               z.nomor_regulasi, z.provinsi_id, p.nama, z.matriks_id, z.kode_perda,
               z.tahun_penetapan, z.updated_at,
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
        potongan = []
        for (zid, nama, jenis, sub, tk, sd, regulasi, prov_id, prov_nama, matriks_id, kode_perda,
             tahun_penetapan, diperbarui, ewkb) in baris:
            if tk != tingkat or sd != sumber or (sub in SUB_ZONA_TANPA_RINCIAN) != umum or ewkb is None:
                continue
            irisan = _overlay(c, 'Intersection', _geos(ewkb), sisa)
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
                'matriks_id': matriks_id,
                'kode_perda': kode_perda,
                'tahun_penetapan': tahun_penetapan,
                'diperbarui': f'{BULAN[diperbarui.month - 1]} {diperbarui.year}' if diperbarui else None,
            })
            potongan.extend(b for b in _bagian(irisan) if b.geom_type in ('Polygon', 'MultiPolygon'))
        if potongan:
            sisa = _overlay(c, 'Difference', sisa, _overlay(c, 'UnaryUnion', GeometryCollection(*potongan, srid=4326)))
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


def _lokasi_alternatif(c, geom, sektor) -> List[Dict[str, Any]]:
    c.execute(
        """
        SELECT l.id, l.rincian->>'nama', l.rincian->>'sub_zona', p.nama, l.persen_sesuai, l.luas_ha,
               ST_X(q.t), ST_Y(q.t), ST_Distance(q.a::geography, q.t::geography), degrees(ST_Azimuth(q.a, q.t))
        FROM analitik_lokasi_potensial l
        JOIN inti_provinsi p ON p.id = l.provinsi_id
        CROSS JOIN LATERAL (SELECT ST_PointOnSurface(l.geometry) AS t, ST_Centroid(ST_GeomFromEWKT(%s)) AS a) q
        WHERE l.sektor_id = %s AND ST_DWithin(l.geometry, ST_GeomFromEWKT(%s), %s)
          AND NOT ST_Intersects(l.geometry, ST_GeomFromEWKT(%s))
        ORDER BY l.geometry <-> ST_GeomFromEWKT(%s)
        LIMIT %s
        """,
        [geom.ewkt, sektor.id, geom.ewkt, atur('RADIUS_LOKASI_ALTERNATIF_KM') / KM_PER_DERAJAT, geom.ewkt, geom.ewkt,
         atur('JUMLAH_LOKASI_ALTERNATIF')],
    )
    return [
        {
            'id': lid,
            'nama': nama,
            'sub_zona_label': sub,
            'provinsi': prov,
            'status_label': f'{_angka(persen, 0)}% parameter sangat sesuai, ±{_angka(luas, 0)} ha',
            'jarak_km': round(meter / 1000.0, 1),
            'arah': _arah(float(azimut)) if azimut is not None else '',
            'titik': [round(x, 6), round(y, 6)],
        }
        for lid, nama, sub, prov, persen, luas, x, y, meter, azimut in sorted(c.fetchall(), key=lambda r: r[8])
    ]


def _bencana_area(c, geom):
    c.execute(
        "SELECT jenis, (ARRAY['RENDAH', 'SEDANG', 'TINGGI'])[MAX(CASE kelas WHEN 'TINGGI' THEN 3 "
        "WHEN 'SEDANG' THEN 2 ELSE 1 END)] FROM analitik_zona_risiko_bencana "
        "WHERE varian = 'RISIKO' AND geometry && ST_GeomFromEWKT(%s) AND ST_Intersects(geometry, ST_GeomFromEWKT(%s)) "
        'GROUP BY jenis',
        [geom.ewkt, geom.ewkt],
    )
    return dict(c.fetchall())


def _adat_area(c, geom):
    radius = atur('RADIUS_ADAT_DEKAT_M')
    c.execute(
        "SELECT string_agg(DISTINCT COALESCE(NULLIF(u.nama, ''), 'tanpa nama'), ', ') FILTER (WHERE ST_Intersects(u.geometry, a.g)), "
        "string_agg(DISTINCT COALESCE(NULLIF(u.nama, ''), 'tanpa nama'), ', ') FILTER (WHERE NOT ST_Intersects(u.geometry, a.g)) "
        'FROM inventarisasi_unsur_ruang_laut u, (SELECT ST_GeomFromEWKT(%s) AS g) a '
        "WHERE u.kelompok = 'MHA' AND u.geometry && ST_Expand(a.g, %s) "
        'AND ST_DWithin(u.geometry::geography, a.g::geography, %s)',
        [geom.ewkt, radius / 1000 / KM_PER_DERAJAT * 1.5, radius],
    )
    return c.fetchone()


def _alasan_pengecualian(kena, sektor_nama):
    gugur, batas = [], []
    for k in kena:
        porsi = f"{_persen_area(k['persen'])} area ({_angka(k['luas_m2'] / 10000, 2)} ha)"
        if k['gugur']:
            gugur.append(f"{porsi} berada di {k['keterangan']}, yang dikecualikan untuk {sektor_nama}.")
        else:
            batas.append(
                f"{porsi} menyentuh {k['keterangan']}. Irisan sekecil ini belum menggugurkan area: perlu verifikasi "
                f"batas, dan bagian itu dikeluarkan dari rencana tapak bila terbukti masuk."
            )
    return gugur, batas


def _peringatan_tepi(tepi, kkprl_tepi, sektor_nama) -> List[str]:
    hasil = []
    for t in tepi:
        sifat = ('tidak mengizinkan' if t['status'] == 'TIDAK_DIIZINKAN'
                 else 'belum memiliki ketentuan pemanfaatan untuk')
        hasil.append(
            f"{_persen_area(t['persen'])} area menyentuh {t['nama']} yang {sifat} {sektor_nama}. Irisan di tepi "
            f"sekecil ini dapat berasal dari ketelitian batas peta tata ruang: perlu verifikasi batas, dan bagian itu "
            f"dikeluarkan dari rencana tapak bila terbukti masuk."
        )
    for k in kkprl_tepi:
        hasil.append(
            f"{_persen_area(k['persen'])} area ({_angka(k['luas_m2'], 0)} m²) menyentuh KKPRL terbit {k['nomor_izin']}: "
            f"perlu verifikasi batas terhadap izin tersebut sebelum pengajuan."
        )
    return hasil


def _alasan(sektor_nama, zona_efektif, aturan, cakupan, kkprl, tepi=()) -> List[str]:
    alasan = []
    nama_tepi = {t['nama'] for t in tepi}
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
        if z['nama'] in nama_tepi and ket['status'] in ('TIDAK_DIIZINKAN', None):
            continue
        lokasi = f"{_persen_area(z['persen'])} area berada di {z['nama']} ({z['sub_zona_label']}, {z['tingkat_label']})"
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
    if cakupan < atur('AMBANG_CAKUPAN_ACUAN'):
        alasan.append(
            f'{_persen_area((1 - cakupan) * 100)} area tidak tercakup acuan tata ruang mana pun '
            f'(RTRW Provinsi, Rencana Zonasi KAW, maupun RTRWN).'
        )
    return alasan


def _informasi_ruang(c, zona_efektif, semua_aturan, sektor_aktif) -> List[Dict[str, Any]]:
    kelompok: Dict[str, Dict[str, Any]] = {}
    for z in zona_efektif:
        kunci = _kunci_zona(z)
        if kunci in kelompok:
            kelompok[kunci]['persen'] = round(kelompok[kunci]['persen'] + z['persen'], 1)
            kelompok[kunci]['_kode'].update(filter(None, z['kode_perda'].split(', ')))
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
                           'sumber_aturan': sumber, 'ketentuan_khusus': khusus, 'kegiatan': kegiatan, 'kkprl_terbit': [],
                           '_matriks': z['matriks_id'], '_kode': set(filter(None, z['kode_perda'].split(', ')))}
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
        [[z['id'] for z in zona_efektif], [_kunci_zona(z) for z in zona_efektif]],
    )
    for kunci, jenis, n in c.fetchall():
        kelompok[kunci]['kkprl_terbit'].append({'jenis': jenis, 'jumlah': n})
    matriks = MatriksKKPRL.objects.in_bulk({g['_matriks'] for g in kelompok.values() if g['_matriks']})
    for g in kelompok.values():
        m = matriks.get(g.pop('_matriks'))
        kode = sorted(g.pop('_kode'))
        g['perda'] = m and {
            'nama_zona': m.nama_zona, 'kode_zona': kode, 'sumber': m.sumber, 'diperbolehkan': m.diperbolehkan,
            'bersyarat': m.bersyarat, 'tidak_diperbolehkan': m.tidak_diperbolehkan,
            'ketentuan_khusus': m.ketentuan_khusus,
        }
    return sorted(kelompok.values(), key=lambda g: -g['persen'])


def _kunci_zona(z):
    return f"{z['nama']}|{z['sub_zona']}|{z['tingkat']}|{z['matriks_id'] or ''}"


def periksa_luas(luas_ha: float) -> None:
    kecil, besar = atur('LUAS_AREA_MIN_HA'), atur('LUAS_AREA_MAKS_HA')
    if luas_ha < kecil:
        raise ValueError(f'Luas area {_angka(luas_ha, 4)} ha terlalu kecil; paling kecil {_angka(kecil, 2)} ha.')
    if luas_ha > besar:
        raise ValueError(
            f'Luas area {_angka(luas_ha, 0)} ha melebihi batas {_angka(besar, 0)} ha; pecah menjadi beberapa area proyek.')


def screening_ruang(geometry: Dict[str, Any], sektor_kode: str) -> Dict[str, Any]:
    geom = GEOSGeometry(json.dumps(geometry), srid=4326)
    if not geom.valid:
        geom = geom.buffer(0)
    sektor = SektorInvestasi.objects.filter(kode=sektor_kode).first()
    if sektor is None:
        raise ValueError(f'Jenis investasi "{sektor_kode}" tidak dikenal.')

    with connection.cursor() as c:
        luas_aoi = _luas(c, geom)
        periksa_luas(luas_aoi / 10000)
        irisan = pengecualian.irisan_area(c, geom)
        kena = pengecualian.nilai_area(irisan, sektor.kode, luas_aoi)
        zona_efektif, cakupan = _zona_efektif(c, geom, luas_aoi)
        semua_aturan = _aturan_per_sektor({z['matriks_id'] for z in zona_efektif if z['matriks_id']})
        aturan = semua_aturan.get(sektor.id, {})
        kkprl = _kkprl(c, geom)
        informasi_ruang = _informasi_ruang(
            c, zona_efektif, semua_aturan,
            list(SektorInvestasi.objects.filter(aktif=True).order_by('urutan', 'nama')),
        )
        karakter = karakter_area(c, geom)
        karakter['bencana'] = _bencana_area(c, geom)
        provinsi_ids = {z['provinsi_id'] for z in zona_efektif}
        tambahan = nilai_area(c, geom, sektor.kode, provinsi_ids)
        karakter['tambahan'] = {t['nama']: t['hasil'] for t in tambahan if t['peran'] == 'DINILAI'}
        fisik = penilaian(sektor.kode, karakter)
        terbaik = fisik[0] if fisik else None
        cocok = bool(terbaik and terbaik['cocok'])
        data_kurang = bool(terbaik) and not cocok and not terbaik['gagal']
        alasan_karakter = alasan_fisik(sektor.kode, karakter, fisik)
        adat_di, adat_dekat = _adat_area(c, geom)
        toleransi = atur('AMBANG_IRISAN_TEPI_PERSEN')
        for k in kkprl:
            k['persen'] = round(k['luas_m2'] / luas_aoi * 100, 2) if luas_aoi else 0.0
            k['gugur'] = k['persen'] >= toleransi
        kkprl_gugur = [k for k in kkprl if k['gugur']]
        status, tepi = _nilai(zona_efektif, aturan, cakupan, luas_aoi, bool(kkprl_gugur))
        if (not cocok and not data_kurang) or adat_di or any(k['gugur'] for k in kena):
            status = 'TIDAK_SESUAI'
        elif data_kurang and status in ('SESUAI', 'SESUAI_BERSYARAT'):
            status = 'BELUM_TERVERIFIKASI'
        gerbang_gagal = [t for t in tambahan if t['peran'] == 'GERBANG' and t['hasil'] is False]
        if gerbang_gagal:
            status = 'TIDAK_SESUAI'
        kkprl_tepi = [k for k in kkprl if not k['gugur']]
        if status == 'SESUAI' and (kkprl_tepi or any(not k['gugur'] for k in kena)):
            status = 'SESUAI_BERSYARAT'
        lanjut = status != 'TIDAK_SESUAI'
        dasar = {pengecualian.label(k, sektor.kode): v
                 for k, v in pengecualian.bebas(sektor.kode, kena, kkprl_gugur).items()}
        dasar[LABEL_ADAT] = not adat_di

        rekomendasi: Optional[Dict[str, Any]] = None
        if not lanjut:
            alternatif = []
            if not kkprl_gugur and not adat_di:
                for s in SektorInvestasi.objects.filter(aktif=True).exclude(id=sektor.id).order_by('urutan', 'nama'):
                    st = _nilai(zona_efektif, semua_aturan.get(s.id, {}), cakupan, luas_aoi)[0]
                    gugur = any(k['gugur'] for k in pengecualian.nilai_area(irisan, s.kode, luas_aoi))
                    lain = penilaian(s.kode, karakter) if st in ('SESUAI', 'SESUAI_BERSYARAT') and not gugur else []
                    if lain and lain[0]['cocok']:
                        alternatif.append({'kode': s.kode, 'nama': s.nama, 'status_label': f"{LABEL_STATUS[st]} ({lain[0]['nama']})"})
            rekomendasi = {
                'sektor_alternatif': alternatif,
                'lokasi_alternatif': _lokasi_alternatif(c, geom, sektor),
            }

    for z in zona_efektif:
        ket = _ketentuan(aturan, z)
        z['ketentuan'] = ket['status']
        z['ketentuan_label'] = LABEL_KETENTUAN.get(ket['status'], 'Belum ditetapkan')
        z['syarat'] = ket['syarat']
        z['sumber_ketentuan'] = ket['sumber']
        z['rincian'] = ket.get('rincian')

    karakter_ringkas = {'kebutuhan': uraian(sektor.kode), 'terukur': _ringkas(karakter, fisik), 'cocok': cocok}
    parameter = [
        {'label': k['label'], 'nilai': k['lulus'], 'nilai_teks': k['nilai_teks'], 'ambang_teks': k['ambang_teks'],
         'data_ada': k.get('data_ada', True)}
        for k in (terbaik['kriteria'] + terbaik['umum'] if terbaik else [])
    ]
    terukur = [p['nilai'] for p in parameter if p['nilai'] is not None]
    alasan_gugur, batas_pengecualian = _alasan_pengecualian(kena, sektor.nama)
    peringatan = [{'jenis': 'BATAS', 'teks': t} for t in
                  _peringatan_tepi(tepi, kkprl_tepi, sektor.nama) + batas_pengecualian]
    if adat_dekat and not adat_di:
        peringatan.append({'jenis': 'ADAT', 'teks': (
            f"Area berada dalam {_angka(atur('RADIUS_ADAT_DEKAT_M') / 1000)} km dari wilayah kelola masyarakat hukum adat "
            f'({adat_dekat}). Hati-hati: berisiko konflik tenurial; libatkan masyarakat adat sejak awal perencanaan.')})
    if status == 'BELUM_TERVERIFIKASI' and data_kurang:
        peringatan.append({'jenis': 'BELUM_TERVERIFIKASI', 'teks': (
            f'{alasan_karakter} Kecocokan fisik belum dapat dipastikan; analisis tetap dapat dilanjutkan dengan label '
            f'belum terverifikasi dan kriteria yang belum terukur perlu diukur langsung di lapangan.')})
    elif status == 'BELUM_TERVERIFIKASI':
        peringatan.append({'jenis': 'BELUM_TERVERIFIKASI', 'teks': (
            'Kesesuaian ruang belum dapat diverifikasi dengan acuan yang tersedia. Analisis tetap dapat dilanjutkan '
            'dengan label belum terverifikasi; konfirmasikan ketentuan ruangnya ke DKP provinsi atau KKP sebelum '
            'pengajuan KKPRL.')})
    alasan_adat = [
        f'Area berada di wilayah kelola masyarakat hukum adat ({adat_di}), sehingga tidak dapat dimanfaatkan untuk '
        f'investasi secara tata ruang.'
    ] if adat_di else []

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
        'karakter': karakter_ringkas,
        'kecocokan_fisik': {
            **karakter_ringkas,
            'label': 'Cocok' if cocok else 'Belum dapat dinilai' if data_kurang else 'Tidak cocok',
            'alasan': alasan_karakter,
            'sub_sektor': terbaik['nama'] if terbaik else None,
            'syarat': [],
        },
        'sub_sektor': fisik,
        'syarat_dasar': [{'label': k, 'nilai': v} for k, v in dasar.items()],
        'parameter': parameter,
        'pengecualian': kena,
        'persen_sangat_sesuai': round(100 * sum(terukur) / len(terukur)) if terukur else None,
        'kkprl': kkprl,
        'verifikasi_batas': tepi,
        'parameter_tambahan': tambahan,
        'alasan': _alasan(sektor.nama, zona_efektif, aturan, cakupan, kkprl_gugur, tepi) + alasan_adat + alasan_gugur + [
            f"Area tidak memenuhi parameter wajib {t['nama']}: {t['keterangan']}." for t in gerbang_gagal
        ] + [alasan_karakter] * (not cocok and not data_kurang) + [
            'Sebagian kecil area perlu verifikasi batas (lihat peringatan), sehingga kesesuaiannya bersyarat: bagian '
            'itu dikeluarkan dari rencana tapak bila terbukti masuk.'
        ] * (status != 'TIDAK_SESUAI' and bool(tepi or kkprl_tepi or batas_pengecualian)),
        'peringatan': peringatan,
        'rekomendasi': rekomendasi,
        'kelengkapan': kelengkapan(terbaik),
        'asal_data': asal_data(zona_efektif, karakter, tambahan),
        'catatan_skala': catatan_skala(zona_efektif, karakter),
    }
