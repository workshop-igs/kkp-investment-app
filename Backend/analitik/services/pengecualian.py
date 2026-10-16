"""Pengecualian keras yang berlaku sama di Peta Sebaran dan screening area.

Lokasi tidak boleh berada di kawasan konservasi (kecuali jenis yang memang untuk konservasi), menempati ekosistem
sensitif yang terlarang bagi jenis investasinya, berada dalam jarak aman kabel/pipa bawah laut dan alur
pelayaran, tumpang tindih KKPRL terbit, atau tertutup bangunan eksisting.
"""
from analitik.services.konstanta import (
    EKOSISTEM_TERLARANG_SEKTOR,
    GMW_TAHUN_AKHIR,
    KM_PER_DERAJAT,
    SEKTOR_BOLEH_DI_KAWASAN_KONSERVASI,
)
from analitik.services.pengaturan import atur
from inventarisasi.klasifikasi import jenis_unsur

KONSERVASI, EKOSISTEM, UNSUR, KKPRL, BANGUNAN = 'KONSERVASI', 'EKOSISTEM', 'UNSUR', 'KKPRL', 'BANGUNAN'

LABEL = {
    KONSERVASI: 'Di luar kawasan konservasi',
    EKOSISTEM: 'Tidak menempati ekosistem sensitif',
    UNSUR: 'Di luar jarak aman kabel, pipa, dan alur pelayaran',
    KKPRL: 'Tidak tumpang tindih KKPRL terbit',
    BANGUNAN: 'Tidak tertutup bangunan atau struktur eksisting',
}

ZONA_KONSERVASI = "(z.jenis_zona = 'ZL' OR z.sub_zona = 'KONSERVASI')"
SUMBER_EKOSISTEM = (
    "(e.sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG') "
    f"OR (e.sumber_data = 'GMW-MANGROVE' AND e.tahun_data = {int(GMW_TAHUN_AKHIR)}))"
)
NAMA_EKOSISTEM = {'MANGROVE': 'mangrove', 'LAMUN': 'padang lamun', 'TERUMBU_KARANG': 'terumbu karang'}
NAMA_UNSUR = {'KABEL': 'kabel bawah laut', 'PIPA': 'pipa bawah laut', 'ALUR_PELAYARAN': 'alur pelayaran'}


def ekosistem_terlarang(sektor_kode):
    return set(EKOSISTEM_TERLARANG_SEKTOR.get(sektor_kode, ()))


def konservasi_terlarang(sektor_kode):
    return sektor_kode not in SEKTOR_BOLEH_DI_KAWASAN_KONSERVASI


def berlaku(sektor_kode):
    """Pengecualian yang diperiksa untuk jenis investasi ini, berurutan seperti tampilan syarat dasar."""
    kode = []
    if konservasi_terlarang(sektor_kode):
        kode.append(KONSERVASI)
    if ekosistem_terlarang(sektor_kode):
        kode.append(EKOSISTEM)
    if any(v > 0 for v in atur('BUFFER_UNSUR_TERLARANG_M').values()):
        kode.append(UNSUR)
    return kode + [KKPRL, BANGUNAN]


def unsur_terlarang(c, ewkt):
    """(id, kode, jarak aman m) unsur garis RTRL kabel/pipa/alur di sekitar geometri."""
    buffer = {k: v for k, v in atur('BUFFER_UNSUR_TERLARANG_M').items() if v > 0}
    if not buffer:
        return []
    # Sedikit dilebihkan dari jarak aman karena derajat bujur menyempit ke arah kutub.
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
    """Luas irisan (m²) area dengan setiap lapisan pengecualian; dihitung sekali lalu dinilai per jenis."""
    ewkt = geom.ewkt
    c.execute(
        f"""
        SELECT COALESCE(ST_Area(ST_Intersection(ST_Union(ST_MakeValid(z.geometry)), a.g)::geography), 0),
               string_agg(DISTINCT z.nama_zona, ', ')
        FROM inventarisasi_zonasi_ruang_laut z, (SELECT ST_GeomFromEWKT(%s) AS g) a
        WHERE z.geometry && a.g AND ST_Intersects(z.geometry, a.g) AND {ZONA_KONSERVASI}
        GROUP BY a.g
        """,
        [ewkt],
    )
    baris = c.fetchone()
    konservasi = (float(baris[0]), baris[1]) if baris else (0.0, '')

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

    unsur = unsur_terlarang(c, ewkt)
    luas_unsur, jenis_unsur_kena = 0.0, []
    if unsur:
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
            [[u[0] for u in unsur], [u[1] for u in unsur], [u[2] for u in unsur], ewkt],
        )
        baris = c.fetchone()
        if baris:
            luas_unsur, jenis_unsur_kena = float(baris[0]), sorted(baris[1] or [])

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
        KONSERVASI: konservasi,
        EKOSISTEM: ekosistem,
        UNSUR: (luas_unsur, jenis_unsur_kena),
        BANGUNAN: float(baris[0]) if baris else 0.0,
    }


def _persen(luas, luas_aoi):
    return round(luas / luas_aoi * 100, 2) if luas_aoi else 0.0


def nilai_area(irisan, sektor_kode, luas_aoi):
    """Pengecualian yang mengenai area untuk satu jenis investasi.

    Setiap butir: kode, label, keterangan, luas_m2, persen, dan gugur (True bila melewati toleransi sehingga area
    tidak sesuai; False bila hanya sebagian kecil yang perlu dikeluarkan dari rencana tapak).
    """
    toleransi = atur('AMBANG_IRISAN_PENGECUALIAN_PERSEN')
    hasil = []

    def tambah(kode, luas, keterangan, ambang=toleransi):
        if luas >= 1.0:
            persen = _persen(luas, luas_aoi)
            hasil.append({'kode': kode, 'label': LABEL[kode], 'keterangan': keterangan, 'luas_m2': luas,
                          'persen': persen, 'gugur': persen >= ambang})

    berlaku_ = berlaku(sektor_kode)
    if KONSERVASI in berlaku_:
        luas, nama = irisan[KONSERVASI]
        tambah(KONSERVASI, luas, f'kawasan konservasi ({nama})' if nama else 'kawasan konservasi')
    if EKOSISTEM in berlaku_:
        kena = {j: luas for j, luas in irisan[EKOSISTEM].items() if j in ekosistem_terlarang(sektor_kode)}
        if kena:
            tambah(EKOSISTEM, sum(kena.values()), ', '.join(NAMA_EKOSISTEM.get(j, j.lower()) for j in sorted(kena)))
    if UNSUR in berlaku_:
        luas, jenis = irisan[UNSUR]
        buffer = atur('BUFFER_UNSUR_TERLARANG_M')
        tambah(UNSUR, luas, ', '.join(f'{NAMA_UNSUR.get(j, j)} (jarak aman {buffer[j]:.0f} m)' for j in jenis))
    tambah(BANGUNAN, irisan[BANGUNAN], 'bangunan atau struktur eksisting', atur('AMBANG_TERBANGUN_PERSEN'))
    return hasil


def bebas(sektor_kode, kena, kkprl):
    """Status setiap pengecualian untuk syarat dasar: True bila tidak menggugurkan area."""
    gugur = {k['kode'] for k in kena if k['gugur']}
    hasil = {}
    for kode in berlaku(sektor_kode):
        hasil[kode] = not kkprl if kode == KKPRL else kode not in gugur
    return hasil
