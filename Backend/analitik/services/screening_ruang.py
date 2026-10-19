import json
from typing import Any, Dict, List, Optional

from django.contrib.gis.geos import GeometryCollection, GEOSException, GEOSGeometry
from django.db import connection

from analitik.models import KetentuanRuang
from analitik.services.konstanta import (
    AMBANG_IRISAN_KKPRL_M2,
    BATAS_JARAK_PANTAI_DERAJAT,
    EKOSISTEM_PESISIR,
    GMW_TAHUN_AKHIR,
    JENIS_ZONA_TERLARANG,
    KETENTUAN_DARAT_BAWAAN,
    KM_PER_DERAJAT,
    LABEL_SUMBER_ZONASI,
    PRIORITAS_SUMBER_ZONASI,
    SEKTOR_SUB_ZONA_COCOK,
    SUB_ZONA_TANPA_RINCIAN,
)
from analitik.services import pengecualian
from analitik.services.asal_data import asal_data, catatan_skala, kelengkapan
from analitik.services.konstanta import BULAN, EKOSISTEM_TERLARANG_SEKTOR
from analitik.services.laporan_spasial import _arah
from analitik.services.oseanografi import daya_gelombang, raster_tersedia
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
LABEL_TATA_RUANG = 'Peruntukan tata ruang diizinkan tanpa syarat'
STATUS_TATA_RUANG = {'SESUAI': 'DIIZINKAN', 'SESUAI_BERSYARAT': 'BERSYARAT', 'TIDAK_SESUAI': 'TIDAK_DIIZINKAN'}


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


def _ringkas_karakter(data, sektor_kode):
    pilihan = atur('KARAKTER_LOKASI').get(sektor_kode, {}).get(data['ranah'], [])
    kunci = {k for syarat in pilihan for k in syarat} | set(atur('PARAMETER_TAMBAHAN').get(sektor_kode, {}).get(data['ranah'], {}))
    bagian = []
    if kunci & {'kedalaman', 'kedalaman_maks'}:
        if data.get('kedalaman_maks') is None:
            bagian.append('kedalaman tidak terukur')
        else:
            dangkal, dalam = _angka(data['kedalaman_min'], 0), _angka(data['kedalaman_maks'], 0)
            bagian.append(f'kedalaman sekitar {dalam} m' if dangkal == dalam else f'kedalaman {dangkal} sampai {dalam} m')
    if kunci & {'gelombang_maks', 'gelombang_min'}:
        gelombang = data.get('gelombang')
        bagian.append('gelombang tidak terukur' if gelombang is None else f'gelombang {_angka(gelombang)} m')
    if 'suhu_min' in kunci:
        suhu = data.get('suhu_min')
        bagian.append('suhu permukaan tidak terukur' if suhu is None else f'suhu permukaan paling rendah {_angka(suhu)} °C')
    if 'anomali_suhu_maks' in kunci:
        anomali = data.get('anomali_suhu')
        bagian.append('anomali suhu tidak terukur' if anomali is None else f'anomali suhu {_angka(anomali)} °C')
    if 'jarak_pantai_maks_km' in kunci and data.get('jarak_pantai_km') is not None:
        bagian.append(f"{_angka(data['jarak_pantai_km'])} km dari pantai")
    ada = set(data.get('ekosistem') or ())
    dicari = {e for syarat in pilihan for e in syarat.get('ekosistem', ())}
    terlarang = {e for syarat in pilihan for e in syarat.get('tanpa_ekosistem', ())}
    if dicari:
        temu = dicari & (ada | set(data.get('ekosistem_sekitar') or ()))
        radius = _angka(atur('RADIUS_EKOSISTEM_PENDUKUNG_M'), 0)
        bagian.append(f'{_nama_ekosistem(temu)} di lokasi atau dalam radius {radius} m' if temu
                      else f'tanpa {_nama_ekosistem(dicari, "atau")} dalam radius {radius} m')
    if terlarang & ada:
        bagian.append(f'ada {_nama_ekosistem(terlarang & ada)}')
    elif not dicari and pilihan:
        sensitif = ada & set(EKOSISTEM_PESISIR)
        bagian.append(f'ekosistem sensitif {_nama_ekosistem(sensitif)}' if sensitif else 'tanpa ekosistem sensitif')
    return '; '.join(bagian)


def _nama_ekosistem(daftar, sambung=None):
    nama = sorted(e.replace('_', ' ').lower() for e in daftar)
    if sambung and len(nama) > 1:
        return f"{', '.join(nama[:-1])} {sambung} {nama[-1]}"
    return ', '.join(nama)


def _rinci(syarat, data):
    """Terpenuhi atau tidaknya setiap butir satu alternatif syarat karakter lokasi."""
    hasil = {}
    dangkal, dalam = data.get('kedalaman_min'), data.get('kedalaman_maks')
    if 'kedalaman' in syarat:
        bawah, atas = syarat['kedalaman']
        sebaran = data.get('sebaran_kedalaman')
        if dalam is None:
            hasil['kedalaman'] = bawah is None
        elif sebaran:
            cocok = sum(n for d, n in sebaran if (bawah is None or d >= bawah) and (atas is None or d <= atas))
            hasil['kedalaman'] = cocok >= atur('AMBANG_KECOCOKAN') * sum(n for _, n in sebaran)
        else:
            hasil['kedalaman'] = not ((bawah is not None and dalam < bawah) or (atas is not None and dangkal > atas))
    if 'daya_gelombang_min' in syarat and 'PERIODE_GLB' in data.get('tersedia', ()):
        daya = data.get('daya_gelombang')
        hasil['daya_gelombang_min'] = daya is not None and daya >= syarat['daya_gelombang_min']
    gelombang = data.get('gelombang')
    if 'gelombang_maks' in syarat:
        hasil['gelombang_maks'] = gelombang is None or gelombang <= syarat['gelombang_maks']
    if 'gelombang_min' in syarat:
        hasil['gelombang_min'] = gelombang is not None and gelombang >= syarat['gelombang_min']
    if 'suhu_min' in syarat:
        suhu = data.get('suhu_min')
        hasil['suhu_min'] = suhu is not None and suhu >= syarat['suhu_min']
    jarak = data.get('jarak_pantai_km')
    if 'jarak_pantai_maks_km' in syarat:
        hasil['jarak_pantai_maks_km'] = jarak is None or jarak <= syarat['jarak_pantai_maks_km']
    ekosistem = set(data.get('ekosistem') or ())
    if 'ekosistem' in syarat:
        hasil['ekosistem'] = bool((set(data.get('ekosistem_sekitar') or ()) | ekosistem) & set(syarat['ekosistem']))
    if 'tanpa_ekosistem' in syarat:
        hasil['tanpa_ekosistem'] = not ekosistem & set(syarat['tanpa_ekosistem'])
    return hasil


def _penuhi(syarat, data):
    return all(_rinci(syarat, data).values())


def cocok_karakter(sektor_kode, data):
    aturan = atur('KARAKTER_LOKASI').get(sektor_kode)
    if aturan is None:
        return True, ''
    pilihan = aturan.get(data['ranah'])
    if pilihan is None:
        letak = 'perairan' if data['ranah'] == 'LAUT' else 'darat'
        return False, f"Lokasi berada di {letak}, sedangkan karakter lokasinya adalah {aturan['uraian']}."
    if any(_penuhi(syarat, data) for syarat in pilihan):
        return True, ''
    return False, (f"Karakter lokasi belum cocok ({_ringkas_karakter(data, sektor_kode)}; kedalaman dan gelombang indikatif "
                   f"dari ETOPO1 dan WaveWatch III). Yang dibutuhkan: {aturan['uraian']}.")


LABEL_SYARAT = {
    'kedalaman': 'Kedalaman perairan sesuai',
    'gelombang_maks': 'Tinggi gelombang sesuai',
    'gelombang_min': 'Tinggi gelombang sesuai',
    'daya_gelombang_min': 'Daya gelombang memadai',
    'suhu_min': 'Suhu permukaan laut sesuai',
    'jarak_pantai_maks_km': 'Jarak ke pantai sesuai',
    'ekosistem': 'Ada ekosistem pendukung',
}
SUMBER_SYARAT = {
    'kedalaman': 'kedalaman_maks',
    'gelombang_maks': 'gelombang',
    'gelombang_min': 'gelombang',
    'daya_gelombang_min': 'daya_gelombang',
    'suhu_min': 'suhu_min',
    'jarak_pantai_maks_km': 'jarak_pantai_km',
}
# Syarat yang bergantung pada raster yang mungkin belum pernah ditarik: dilewati bila datanya belum ada.
RASTER_SYARAT = {'daya_gelombang_min': 'PERIODE_GLB'}
LABEL_RANAH = 'Ranah lokasi sesuai jenis investasi'
LABEL_INFRASTRUKTUR = 'Dekat infrastruktur pendukung'
# Butir syarat dasar yang bersifat fisik: pada screening dipisah sebagai kecocokan fisik (peringatan).
LABEL_FISIK = {LABEL_RANAH, LABEL_INFRASTRUKTUR, *LABEL_SYARAT.values()}
# kunci PARAMETER_TAMBAHAN -> (label, kunci data, arah ambang, raster sumber atau None)
LABEL_TAMBAHAN = {
    'kedalaman_maks': ('Perairan cukup dangkal', 'kedalaman_maks', 'maks', 'KEDALAMAN'),
    'kedalaman_min': ('Perairan cukup dalam', 'kedalaman_maks', 'min', 'KEDALAMAN'),
    'daya_gelombang_min': ('Daya gelombang tinggi', 'daya_gelombang', 'min', 'PERIODE_GLB'),
    'jarak_pantai_maks_km': ('Dekat garis pantai', 'jarak_pantai_km', 'maks', None),
    'gelombang_maks': ('Tinggi gelombang sesuai', 'gelombang', 'maks', 'GELOMBANG'),
    'anomali_suhu_maks': ('Tanpa stres panas (anomali suhu rendah)', 'anomali_suhu', 'maks', 'ANOMALI_SUHU'),
    'suhu_rata_min': ('Suhu permukaan laut tidak terlalu dingin', 'suhu_rata', 'min', 'SUHU'),
    'suhu_rata_maks': ('Suhu permukaan laut tidak terlalu panas', 'suhu_rata', 'maks', 'SUHU'),
    'klorofil_min': ('Perairan cukup subur (klorofil-a)', 'klorofil', 'min', 'KLOROFIL'),
    'klorofil_maks': ('Perairan tidak terlalu subur atau tercemar (klorofil-a)', 'klorofil', 'maks', 'KLOROFIL'),
    'kd490_maks': ('Perairan cukup jernih (Kd490)', 'kd490', 'maks', 'KD490'),
    'gelombang_tertinggi_maks': ('Gelombang tertinggi setahun aman', 'gelombang_tertinggi', 'maks', 'GELOMBANG'),
    'jarak_karang_maks_km': ('Dekat terumbu karang', 'jarak_karang_km', 'maks', None),
    'curah_hujan_maks': ('Curah hujan tahunan rendah', 'curah_hujan', 'maks', 'CURAH_HUJAN'),
    'bulan_kering_min': ('Musim kemarau cukup panjang', 'bulan_kering', 'min', 'BULAN_KERING'),
}
BENCANA_LOKASI = (
    ('TSUNAMI', 'Risiko tsunami rendah'),
    ('ABRASI', 'Risiko gelombang ekstrem dan abrasi rendah'),
    ('BANJIR', 'Risiko banjir rendah'),
)


def _syarat_berlaku(kunci, data):
    raster = RASTER_SYARAT.get(kunci)
    return raster is None or raster in data.get('tersedia', ())


def _dinilai(batasan, data):
    nilai = {}
    for kunci, batas in batasan.items():
        if kunci not in LABEL_TAMBAHAN:
            continue
        label, sumber, arah, raster = LABEL_TAMBAHAN[kunci]
        if raster is not None and raster not in data.get('tersedia', ()):
            continue
        v = data.get(sumber)
        nilai[label] = None if v is None else (v <= batas if arah == 'maks' else v >= batas)
    return nilai


def parameter_lokasi(sektor_kode, data, saring_fisik=True):
    """Penilaian lokasi untuk satu jenis investasi, sama untuk Peta Sebaran dan screening.

    Mengembalikan (syarat_dasar, dinilai). Syarat dasar menyaring lokasi (ranah, karakter fisik, pengecualian keras,
    infrastruktur) sehingga pada lokasi peta yang lolos semuanya terpenuhi; karena itu tidak ikut persentase.
    Parameter dinilai membedakan mutu lokasi: True sangat sesuai, False perlu dinilai di lapangan, None tidak
    terukur di lokasi itu. Dengan saring_fisik (Peta Sebaran) lokasi yang karakter fisiknya tidak cocok
    menghasilkan None; tanpa itu (screening) butir fisik yang tidak terpenuhi bernilai False sebagai peringatan.
    """
    aturan = atur('KARAKTER_LOKASI').get(sektor_kode)
    if saring_fisik and not cocok_karakter(sektor_kode, data)[0]:
        return None
    ranah_cocok = aturan is None or data['ranah'] in aturan
    pilihan = (aturan or {}).get(data['ranah'], [{}])
    cocok = [s for s in pilihan if _penuhi(s, data)]
    if cocok:
        syarat = max(cocok, key=lambda s: persen_sangat_sesuai(_dinilai(s.get('dinilai', {}), data)))
    else:
        # Tidak ada alternatif yang terpenuhi: tampilkan alternatif yang paling banyak butirnya terpenuhi.
        syarat = max(pilihan, key=lambda s: sum(_rinci(s, data).values()))
    rinci = _rinci(syarat, data)
    dasar = {LABEL_RANAH: ranah_cocok}
    for k in syarat:
        if k in LABEL_SYARAT and _syarat_berlaku(k, data):
            terukur = not (k in SUMBER_SYARAT and data.get(SUMBER_SYARAT[k]) is None)
            dasar[LABEL_SYARAT[k]] = rinci.get(k, True) if terukur else None
    for kode, nilai in (data.get('pengecualian') or {}).items():
        dasar[pengecualian.label(kode, sektor_kode)] = nilai
    if 'dekat_infrastruktur' in data:
        dasar[LABEL_INFRASTRUKTUR] = data['dekat_infrastruktur']

    nilai = _dinilai(atur('PARAMETER_TAMBAHAN').get(sektor_kode, {}).get(data['ranah'], {}), data)
    nilai.update(_dinilai(syarat.get('dinilai', {}), data))
    nilai[LABEL_TATA_RUANG] = data.get('status_tr') == 'DIIZINKAN'
    if not (data['ranah'] == 'LAUT' and (data.get('jarak_pantai_km') or 0) > 0):
        for jenis, label in BENCANA_LOKASI:
            kelas = (data.get('bencana') or {}).get(jenis)
            nilai[label] = None if kelas is None else kelas == 'RENDAH'
    if not any('ekosistem' in s for s in pilihan) and sektor_kode not in EKOSISTEM_TERLARANG_SEKTOR:
        nilai['Tidak beririsan ekosistem sensitif'] = not set(data.get('ekosistem') or ()) & set(EKOSISTEM_PESISIR)
    nilai['Di luar wilayah kelola masyarakat hukum adat'] = None if data.get('adat') is None else not data['adat']
    nilai.update(data.get('tambahan') or {})
    return dasar, nilai


def persen_sangat_sesuai(nilai):
    terukur = [v for v in nilai.values() if v is not None]
    return 100 * sum(terukur) / len(terukur) if terukur else 0.0


def ekosistem_di(c, geom, radius=0.0):
    c.execute(
        """
        SELECT DISTINCT jenis FROM inventarisasi_sumber_daya_alam
        WHERE geometry && ST_Expand(ST_GeomFromEWKT(%s), %s) AND ST_DWithin(geometry, ST_GeomFromEWKT(%s), %s)
          AND (sumber_data IN ('KKP-EKOSISTEM', 'SIDAKO-LAMUN', 'SIDAKO-KARANG')
               OR (sumber_data = 'GMW-MANGROVE' AND tahun_data = %s))
        """,
        [geom.ewkt, radius, geom.ewkt, radius, GMW_TAHUN_AKHIR],
    )
    return {r[0] for r in c.fetchall()}


RASTER_LAUT = ['KEDALAMAN', 'GELOMBANG', 'SUHU', 'ANOMALI_SUHU', 'KLOROFIL', 'KD490', 'PERIODE_GLB']
RASTER_DARAT = ['CURAH_HUJAN', 'BULAN_KERING']
# Batas pencarian terumbu karang terdekat untuk parameter "dekat terumbu karang".
RADIUS_CARI_KARANG_KM = 20.0


def _catat_oseanografi(data, stat):
    data['oseanografi'] = {
        k: {'sumber': v.get('sumber'), 'periode': v.get('periode')} for k, v in stat.items() if v.get('rata2') is not None
    }


def _jarak_karang(c, geom):
    c.execute("SELECT EXISTS (SELECT 1 FROM inventarisasi_sumber_daya_alam WHERE jenis = 'TERUMBU_KARANG')")
    if not c.fetchone()[0]:
        return None
    radius = RADIUS_CARI_KARANG_KM / KM_PER_DERAJAT
    c.execute(
        "SELECT MIN(ST_Distance(e.geometry, a.g)) FROM inventarisasi_sumber_daya_alam e, "
        "(SELECT ST_GeomFromEWKT(%s) AS g) a WHERE e.jenis = 'TERUMBU_KARANG' "
        "AND e.geometry && ST_Expand(a.g, %s) AND ST_DWithin(e.geometry, a.g, %s)",
        [geom.ewkt, radius, radius],
    )
    jarak = c.fetchone()[0]
    return jarak * KM_PER_DERAJAT if jarak is not None else 99.0


def karakter_area(c, geom):
    c.execute(
        'SELECT EXISTS (SELECT 1 FROM inti_provinsi WHERE geometry && ST_PointOnSurface(ST_GeomFromEWKT(%s)) '
        'AND ST_Intersects(geometry, ST_PointOnSurface(ST_GeomFromEWKT(%s))))',
        [geom.ewkt, geom.ewkt],
    )
    data = {
        'ranah': 'DARAT' if c.fetchone()[0] else 'LAUT',
        'ekosistem': ekosistem_di(c, geom),
        'ekosistem_sekitar': ekosistem_di(c, geom, atur('RADIUS_EKOSISTEM_PENDUKUNG_M') / 1000 / KM_PER_DERAJAT),
        'tersedia': raster_tersedia(),
    }
    if data['ranah'] == 'DARAT':
        stat = statistik_oseanografi(geom, RASTER_DARAT)
        _catat_oseanografi(data, stat)
        hujan = stat.get('CURAH_HUJAN', {}).get('rata2')
        data['curah_hujan'] = hujan * 12 if hujan is not None else None
        data['bulan_kering'] = stat.get('BULAN_KERING', {}).get('rata2')
        return data
    stat = statistik_oseanografi(geom, RASTER_LAUT)
    _catat_oseanografi(data, stat)
    dalam = stat.get('KEDALAMAN', {})
    if dalam.get('rata2') is not None:
        data['kedalaman_min'], data['kedalaman_maks'] = max(0.0, -dalam['max']), max(0.0, -dalam['min'])
    c.execute(SEBARAN_KEDALAMAN.format(zona='(SELECT 0 AS id, ST_GeomFromEWKT(%s) AS geometry)'), [geom.ewkt])
    data['sebaran_kedalaman'] = [(d, n) for _, d, n in c.fetchall()]
    gelombang = stat.get('GELOMBANG', {})
    data['gelombang'] = gelombang.get('rata2')
    data['gelombang_tertinggi'] = gelombang.get('max') if gelombang.get('rata2') is not None else None
    data['anomali_suhu'] = stat.get('ANOMALI_SUHU', {}).get('rata2')
    suhu = stat.get('SUHU', {})
    data['suhu_min'] = suhu['min'] if suhu.get('rata2') is not None else None
    data['suhu_rata'] = suhu.get('rata2')
    data['klorofil'] = stat.get('KLOROFIL', {}).get('rata2')
    data['kd490'] = stat.get('KD490', {}).get('rata2')
    data['daya_gelombang'] = daya_gelombang(data['gelombang'], stat.get('PERIODE_GLB', {}).get('rata2'))
    data['jarak_karang_km'] = _jarak_karang(c, geom)
    c.execute(
        'SELECT MIN(ST_Distance(COALESCE(v.geometry_tampilan, v.geometry), a.g)) '
        'FROM inti_provinsi v, (SELECT ST_GeomFromEWKT(%s) AS g) a '
        'WHERE ST_DWithin(COALESCE(v.geometry_tampilan, v.geometry), a.g, %s)',
        [geom.ewkt, BATAS_JARAK_PANTAI_DERAJAT],
    )
    jarak = c.fetchone()[0]
    data['jarak_pantai_km'] = jarak * KM_PER_DERAJAT if jarak is not None else BATAS_JARAK_PANTAI_DERAJAT * KM_PER_DERAJAT
    return data


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
    """Status kesesuaian ruang (gerbang hukum) beserta zona yang hanya teriris kecil di tepi area.

    Zona yang tidak mengizinkan atau belum memiliki ketentuan, tetapi seluruhnya mengiris kurang dari toleransi tepi,
    tidak menggugurkan area: zona itu dikembalikan sebagai butir "perlu verifikasi batas" dan statusnya paling
    tinggi sesuai bersyarat.
    """
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


def parameter_area(c, geom, sektor_kode, karakter, status_tr, provinsi_ids, tambahan=None, bebas=None):
    c.execute(
        "SELECT jenis, (ARRAY['RENDAH', 'SEDANG', 'TINGGI'])[MAX(CASE kelas WHEN 'TINGGI' THEN 3 "
        "WHEN 'SEDANG' THEN 2 ELSE 1 END)] FROM analitik_zona_risiko_bencana "
        "WHERE varian = 'RISIKO' AND geometry && ST_GeomFromEWKT(%s) AND ST_Intersects(geometry, ST_GeomFromEWKT(%s)) "
        'GROUP BY jenis',
        [geom.ewkt, geom.ewkt],
    )
    data = {**karakter, 'status_tr': status_tr, 'bencana': dict(c.fetchall()), 'tambahan': tambahan,
            'pengecualian': bebas or {}, 'dekat_infrastruktur': None}
    c.execute('SELECT EXISTS (SELECT 1 FROM inventarisasi_infrastruktur_pendukung)')
    if c.fetchone()[0]:
        c.execute(
            'SELECT EXISTS (SELECT 1 FROM inventarisasi_infrastruktur_pendukung i, '
            'unnest(%s::text[], %s::float8[]) AS k(kategori, batas) '
            'WHERE i.kategori = k.kategori AND ST_DWithin(i.geometry, ST_GeomFromEWKT(%s), k.batas))',
            [[k for k, _, _, _ in atur('INFRASTRUKTUR_AKSESIBILITAS')],
             [ideal / KM_PER_DERAJAT for _, _, ideal, _ in atur('INFRASTRUKTUR_AKSESIBILITAS')], geom.ewkt],
        )
        data['dekat_infrastruktur'] = c.fetchone()[0]
    c.execute(
        "SELECT EXISTS (SELECT 1 FROM inventarisasi_unsur_ruang_laut WHERE kelompok = 'MHA' AND provinsi_id = ANY(%s)), "
        "EXISTS (SELECT 1 FROM inventarisasi_unsur_ruang_laut WHERE kelompok = 'MHA' "
        'AND geometry && ST_GeomFromEWKT(%s) AND ST_Intersects(geometry, ST_GeomFromEWKT(%s)))',
        [list(provinsi_ids), geom.ewkt, geom.ewkt],
    )
    terdata, adat = c.fetchone()
    data['adat'] = adat if terdata else None
    return parameter_lokasi(sektor_kode, data, saring_fisik=False)


def _alasan_pengecualian(kena, sektor_nama):
    """(alasan gugur, peringatan perlu verifikasi batas) dari pengecualian keras yang mengenai area."""
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
        cocok, alasan_karakter = cocok_karakter(sektor.kode, karakter)
        toleransi = atur('AMBANG_IRISAN_TEPI_PERSEN')
        for k in kkprl:
            k['persen'] = round(k['luas_m2'] / luas_aoi * 100, 2) if luas_aoi else 0.0
            k['gugur'] = k['persen'] >= toleransi
        kkprl_gugur = [k for k in kkprl if k['gugur']]
        status, tepi = _nilai(zona_efektif, aturan, cakupan, luas_aoi, bool(kkprl_gugur))
        if not cocok or any(k['gugur'] for k in kena):
            status = 'TIDAK_SESUAI'
        provinsi_ids = {z['provinsi_id'] for z in zona_efektif}
        tambahan = nilai_area(c, geom, sektor.kode, provinsi_ids)
        gerbang_gagal = [t for t in tambahan if t['peran'] == 'GERBANG' and t['hasil'] is False]
        if gerbang_gagal:
            status = 'TIDAK_SESUAI'
        kkprl_tepi = [k for k in kkprl if not k['gugur']]
        if status == 'SESUAI' and (kkprl_tepi or any(not k['gugur'] for k in kena)):
            status = 'SESUAI_BERSYARAT'
        lanjut = status != 'TIDAK_SESUAI'
        dasar, parameter = parameter_area(
            c, geom, sektor.kode, karakter, STATUS_TATA_RUANG.get(status), provinsi_ids,
            {t['nama']: t['hasil'] for t in tambahan if t['peran'] == 'DINILAI'},
            pengecualian.bebas(sektor.kode, kena, kkprl_gugur),
        )
        fisik = {k: v for k, v in dasar.items() if k in LABEL_FISIK}
        dasar = {k: v for k, v in dasar.items() if k not in LABEL_FISIK}

        rekomendasi: Optional[Dict[str, Any]] = None
        if not lanjut:
            alternatif = []
            if not kkprl_gugur:
                for s in SektorInvestasi.objects.filter(aktif=True).exclude(id=sektor.id).order_by('urutan', 'nama'):
                    st = _nilai(zona_efektif, semua_aturan.get(s.id, {}), cakupan, luas_aoi)[0]
                    gugur = any(k['gugur'] for k in pengecualian.nilai_area(irisan, s.kode, luas_aoi))
                    if st in ('SESUAI', 'SESUAI_BERSYARAT') and not gugur and cocok_karakter(s.kode, karakter)[0]:
                        alternatif.append({'kode': s.kode, 'nama': s.nama, 'status_label': LABEL_STATUS[st]})
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

    karakter_ringkas = {
        'kebutuhan': atur('KARAKTER_LOKASI').get(sektor.kode, {}).get('uraian', ''),
        'terukur': '; '.join(filter(None, [
            'Darat' if karakter['ranah'] == 'DARAT' else 'Perairan', _ringkas_karakter(karakter, sektor.kode),
        ])),
        'cocok': cocok,
    }
    alasan_gugur, batas_pengecualian = _alasan_pengecualian(kena, sektor.nama)
    peringatan = [{'jenis': 'BATAS', 'teks': t} for t in
                  _peringatan_tepi(tepi, kkprl_tepi, sektor.nama) + batas_pengecualian]
    if status == 'BELUM_TERVERIFIKASI':
        peringatan.append({'jenis': 'BELUM_TERVERIFIKASI', 'teks': (
            'Kesesuaian ruang belum dapat diverifikasi dengan acuan yang tersedia. Analisis tetap dapat dilanjutkan '
            'dengan label belum terverifikasi; konfirmasikan ketentuan ruangnya ke DKP provinsi atau KKP sebelum '
            'pengajuan KKPRL.')})

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
            'label': 'Cocok' if cocok else 'Tidak cocok',
            'alasan': alasan_karakter,
            'syarat': [{'label': k, 'nilai': v} for k, v in fisik.items()],
        },
        'syarat_dasar': [{'label': k, 'nilai': v} for k, v in dasar.items()],
        'parameter': [{'label': k, 'nilai': v} for k, v in (parameter or {}).items()],
        'pengecualian': kena,
        'persen_sangat_sesuai': round(persen_sangat_sesuai(parameter)) if parameter else None,
        'kkprl': kkprl,
        'verifikasi_batas': tepi,
        'parameter_tambahan': tambahan,
        'alasan': [alasan_karakter] * (not cocok) + alasan_gugur + [
            f"Area tidak memenuhi parameter wajib {t['nama']}: {t['keterangan']}." for t in gerbang_gagal
        ] + _alasan(sektor.nama, zona_efektif, aturan, cakupan, kkprl_gugur, tepi) + [
            'Sebagian kecil area perlu verifikasi batas (lihat peringatan), sehingga kesesuaiannya bersyarat: bagian '
            'itu dikeluarkan dari rencana tapak bila terbukti masuk.'
        ] * (status != 'TIDAK_SESUAI' and bool(tepi or kkprl_tepi or batas_pengecualian)),
        'peringatan': peringatan,
        'rekomendasi': rekomendasi,
        'kelengkapan': kelengkapan(parameter, dasar),
        'asal_data': asal_data(zona_efektif, karakter, tambahan),
        'catatan_skala': catatan_skala(zona_efektif, karakter),
    }
