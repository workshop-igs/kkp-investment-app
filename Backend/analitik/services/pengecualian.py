from analitik.services.konstanta import (
    EKOSISTEM_TERLARANG_SEKTOR,
    GMW_TAHUN_AKHIR,
    KM_PER_DERAJAT,
    SEKTOR_BOLEH_DI_ALUR_PELAYARAN,
)
from analitik.services.pengaturan import atur
from inventarisasi.klasifikasi import jenis_unsur

ALUR, EKOSISTEM, UNSUR, KKPRL, BANGUNAN = 'ALUR', 'EKOSISTEM', 'UNSUR', 'KKPRL', 'BANGUNAN'

LABEL = {
    ALUR: 'Di luar alur pelayaran dan ALKI',
    EKOSISTEM: 'Tidak menempati ekosistem sensitif',
    UNSUR: 'Di luar jarak aman kabel, pipa, dan alur pelayaran',
    KKPRL: 'Tidak tumpang tindih KKPRL terbit',
    BANGUNAN: 'Tidak tertutup bangunan atau struktur eksisting',
}

ZONA_ALUR = (
    "(z.jenis_zona = 'ALKI' OR (z.sub_zona = 'PELAYARAN' "
    "AND z.nama_zona ~* '(alur[[:space:]]+(pelayaran|laut)|[[:<:]]alki[[:>:]]|perlintasan)'))"
)
SUMBER_EKOSISTEM = (
    "(e.sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG') "
    f"OR (e.sumber_data = 'GMW-MANGROVE' AND e.tahun_data = {int(GMW_TAHUN_AKHIR)}))"
)
NAMA_EKOSISTEM = {'MANGROVE': 'mangrove', 'LAMUN': 'padang lamun', 'TERUMBU_KARANG': 'terumbu karang'}
NAMA_UNSUR = {'KABEL': 'kabel bawah laut', 'PIPA': 'pipa bawah laut', 'ALUR_PELAYARAN': 'alur pelayaran'}


def ekosistem_terlarang(sektor_kode):
    return set(EKOSISTEM_TERLARANG_SEKTOR.get(sektor_kode, ()))


def alur_terlarang(sektor_kode):
    return sektor_kode not in SEKTOR_BOLEH_DI_ALUR_PELAYARAN


def _buffer(sektor_kode=None):
    return {
        k: v for k, v in atur('BUFFER_UNSUR_TERLARANG_M').items()
        if v > 0 and (k != 'ALUR_PELAYARAN' or sektor_kode is None or alur_terlarang(sektor_kode))
    }


def label(kode, sektor_kode):
    if kode == UNSUR and not alur_terlarang(sektor_kode):
        return 'Di luar jarak aman kabel dan pipa'
    return LABEL[kode]


def berlaku(sektor_kode):
    kode = []
    if alur_terlarang(sektor_kode):
        kode.append(ALUR)
    if ekosistem_terlarang(sektor_kode):
        kode.append(EKOSISTEM)
    if _buffer(sektor_kode):
        kode.append(UNSUR)
    return [*kode, KKPRL, BANGUNAN]


def unsur_terlarang(c, ewkt):
    buffer = _buffer()
    if not buffer:
        return []
    ekspansi = max(buffer.values()) / 1000 / KM_PER_DERAJAT * 1.5
    c.execute(
        "SELECT id, nama, jenis, keterangan, kode_lapisan FROM inventarisasi_unsur_ruang_laut "
        "WHERE kelompok = 'RTRL' AND geometry && ST_Expand(ST_GeomFromEWKT(%s), %s)",
        [ewkt, ekspansi],
    )
    hasil = []
    for uid, *teks in c.fetchall():
        kode = jenis_unsur(*teks)
        if kode in buffer:
            hasil.append((uid, kode, buffer[kode]))
    return hasil


def irisan_area(c, geom):
    ewkt = geom.ewkt

    c.execute(
        f"""
        SELECT COALESCE(ST_Area(ST_Intersection(ST_Union(ST_MakeValid(z.geometry)), a.g)::geography), 0),
               string_agg(DISTINCT z.nama_zona, ', ')
        FROM inventarisasi_zonasi_ruang_laut z, (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE z.geometry && a.g AND ST_Intersects(z.geometry, a.g) AND {ZONA_ALUR}
        GROUP BY a.g
        """,
        [ewkt],
    )
    baris = c.fetchone()
    alur = (float(baris[0]), baris[1]) if baris else (0.0, '')

    c.execute(
        f"""
        SELECT e.jenis, ST_Area(ST_Intersection(ST_Union(ST_MakeValid(e.geometry)), a.g)::geography)
        FROM inventarisasi_sumber_daya_alam e, (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE e.geometry && a.g AND ST_Intersects(e.geometry, a.g) AND {SUMBER_EKOSISTEM}
          AND e.jenis IN ('MANGROVE', 'LAMUN', 'TERUMBU_KARANG')
        GROUP BY e.jenis, a.g
        """,
        [ewkt],
    )
    ekosistem = {jenis: float(luas or 0) for jenis, luas in c.fetchall()}

    def unsur_kena(daftar):
        if not daftar:
            return 0.0, []
        c.execute(
            """
            SELECT COALESCE(ST_Area(ST_Intersection(ST_Union(ST_Buffer(u.geometry::geography, b.m)::geometry),
                                                    a.g)::geography), 0),
                   array_agg(DISTINCT b.kode) FILTER (WHERE ST_DWithin(u.geometry::geography, a.g::geography, b.m))
            FROM unnest(%s::int[], %s::text[], %s::float8[]) AS b(id, kode, m)
            JOIN inventarisasi_unsur_ruang_laut u ON u.id = b.id,
                 (SELECT ST_GeomFromEWKT(%s) AS g) a
            WHERE ST_DWithin(u.geometry::geography, a.g::geography, b.m)
            GROUP BY a.g
            """,
            [[u[0] for u in daftar], [u[1] for u in daftar], [u[2] for u in daftar], ewkt],
        )
        baris = c.fetchone()
        return (float(baris[0]), sorted(baris[1] or [])) if baris else (0.0, [])

    unsur = unsur_terlarang(c, ewkt)
    tanpa_alur = [u for u in unsur if u[1] != 'ALUR_PELAYARAN']
    semua = unsur_kena(unsur)

    c.execute(
        """
        SELECT COALESCE(ST_Area(ST_Intersection(ST_Union(b.geometry), a.g)::geography), 0)
        FROM inventarisasi_bangunan_eksisting b, (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE b.geometry && a.g AND ST_Intersects(b.geometry, a.g)
        GROUP BY a.g
        """,
        [ewkt],
    )
    baris = c.fetchone()
    return {
        ALUR: alur,
        EKOSISTEM: ekosistem,
        UNSUR: {True: semua, False: semua if len(tanpa_alur) == len(unsur) else unsur_kena(tanpa_alur)},
        BANGUNAN: float(baris[0]) if baris else 0.0,
    }


def _persen(luas, luas_aoi):
    return round(luas / luas_aoi * 100, 2) if luas_aoi else 0.0


def nilai_area(irisan, sektor_kode, luas_aoi):
    toleransi = atur('AMBANG_IRISAN_PENGECUALIAN_PERSEN')
    hasil = []

    def tambah(kode, luas, keterangan, ambang=toleransi):
        if luas >= 1.0:
            persen = _persen(luas, luas_aoi)
            hasil.append({'kode': kode, 'label': label(kode, sektor_kode), 'keterangan': keterangan,
                          'luas_m2': luas, 'persen': persen, 'gugur': persen >= ambang})

    berlaku_ = berlaku(sektor_kode)
    if ALUR in berlaku_:
        luas, nama = irisan[ALUR]
        tambah(ALUR, luas, f'alur pelayaran/ALKI ({nama})' if nama else 'alur pelayaran/ALKI')
    if EKOSISTEM in berlaku_:
        kena = {j: luas for j, luas in irisan[EKOSISTEM].items() if j in ekosistem_terlarang(sektor_kode)}
        if kena:
            tambah(EKOSISTEM, sum(kena.values()), ', '.join(NAMA_EKOSISTEM.get(j, j.lower()) for j in sorted(kena)))
    if UNSUR in berlaku_:
        luas, jenis = irisan[UNSUR][alur_terlarang(sektor_kode)]
        buffer = atur('BUFFER_UNSUR_TERLARANG_M')
        tambah(UNSUR, luas, ', '.join(f'{NAMA_UNSUR.get(j, j)} (jarak aman {buffer[j]:.0f} m)' for j in jenis))
    tambah(BANGUNAN, irisan[BANGUNAN], 'bangunan atau struktur eksisting', atur('AMBANG_TERBANGUN_PERSEN'))
    return hasil


def bebas(sektor_kode, kena, kkprl):
    gugur = {k['kode'] for k in kena if k['gugur']}
    hasil = {}
    for kode in berlaku(sektor_kode):
        hasil[kode] = not kkprl if kode == KKPRL else kode not in gugur
    return hasil
