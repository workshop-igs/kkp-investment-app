import math

from django.core.cache import cache
from django.db import connection

from analitik.services.oseanografi import raster_tersedia
from analitik.services.pengaturan import atur

PARAMETER = {
    'klorofil': ('Klorofil-a', 'mg/m³', 'KLOROFIL'),
    'suhu_rata': ('Suhu permukaan laut', '°C', 'SUHU'),
    'gelombang': ('Tinggi gelombang signifikan (Hs)', 'm', 'GELOMBANG'),
    'periode_gelombang': ('Periode gelombang', 'detik', 'PERIODE_GLB'),
    'kedalaman': ('Kedalaman perairan', 'm', 'KEDALAMAN'),
    'kd490': ('Kecerahan perairan (Kd490)', '1/m', 'KD490'),
    'curah_hujan': ('Curah hujan tahunan', 'mm/tahun', 'CURAH_HUJAN'),
    'jarak_pantai_km': ('Jarak ke garis pantai', 'km', None),
    'karang': ('Terumbu karang di lokasi', 'ada/tidak', 'TERUMBU_KARANG'),
    'jarak_pelabuhan_perikanan_km': ('Jarak ke pelabuhan perikanan (PP/TPI)', 'km', ('PELABUHAN_PERIKANAN',)),
    'jarak_jalan_nasional_km': ('Jarak ke jalan arteri/nasional', 'km', ('JALAN_NASIONAL',)),
    'jarak_listrik_km': ('Jarak ke jaringan listrik', 'km', ('JARINGAN_LISTRIK_TM', 'JARINGAN_LISTRIK')),
    'jarak_pelabuhan_ekspor_km': ('Jarak ke pelabuhan ekspor/bandara kargo', 'km', ('PELABUHAN_UMUM', 'BANDARA')),
    'jarak_gerbang_wisata_km': ('Jarak ke bandara/pelabuhan penumpang (±2 jam)', 'km',
                                ('BANDARA', 'PELABUHAN_PENYEBERANGAN', 'PELABUHAN_UMUM')),
    'jarak_gardu_km': ('Jarak ke gardu induk PLN', 'km', ('GARDU_INDUK',)),
    'jarak_alur_km': ('Jarak ke alur pelayaran utama/ALKI', 'km', 'ALUR'),
    'jarak_muara_km': ('Jarak dari muara sungai besar', 'km', ('MUARA_SUNGAI',)),
    'jarak_muara_pelabuhan_km': ('Jarak dari muara sungai/pelabuhan utama', 'km', ('MUARA_SUNGAI', 'PELABUHAN_UMUM')),
    'jarak_bandara_lab_km': ('Jarak ke bandara/fasilitas riset (±2 jam)', 'km', ('BANDARA', 'KAMPUS_RISET')),
    'arus': ('Kecepatan arus permukaan', 'm/s', 'ARUS'),
    'salinitas': ('Salinitas air laut', 'ppt', 'SALINITAS'),
    'tss': ('Padatan tersuspensi (TSS)', 'mg/L', 'TSS'),
    'kemiringan_lahan': ('Kemiringan lahan', '%', 'KEMIRINGAN'),
    'produksi_ikan_kabupaten_ton': ('Produksi ikan kabupaten/kota', 'ton/tahun', 'PRODUKSI_KABUPATEN'),
    'tunggang_pasut': ('Tunggang pasang surut', 'm', 'PASUT'),
    'pga': ('Percepatan tanah puncak gempa (PGA)', 'g', 'PGA'),
    'kemiringan_dasar_laut': ('Kemiringan dasar laut', '°', 'KEMIRINGAN_DASAR'),
    'arus_dasar': ('Kecepatan arus dasar', 'm/s', 'ARUS_DASAR'),
    'gelombang_ekstrem': ('Gelombang ekstrem periode ulang 50 tahun', 'm', 'GELOMBANG_EKSTREM'),
    'angin_100m': ('Kecepatan angin 100 m', 'm/s', 'ANGIN_100M'),
    'ghi': ('Iradiasi surya global (GHI)', 'kWh/m²/hari', 'GHI'),
    'beda_suhu_1000m': ('Beda suhu permukaan dan kedalaman 1.000 m', '°C', 'BEDA_SUHU_1000M'),
    'bulan_kering_berturut': ('Bulan kering berturut-turut (curah hujan < 50 mm)', 'bulan', 'BULAN_KERING'),
    'tanah_liat': ('Kandungan tanah liat', '%', 'TANAH_LIAT'),
    'shannon': ('Indeks keanekaragaman hayati (Shannon-Wiener H′)', '', 'SHANNON'),
    'eks_mangrove_mudflat': ('Eks-mangrove terdegradasi atau hamparan lumpur', 'ada/tidak', 'EKS_MANGROVE'),
    'intertidal': ('Berada di zona intertidal (MSL–MHW)', 'ada/tidak', 'INTERTIDAL'),
    'luas_hamparan_ha': ('Luas hamparan lahan kontigu', 'ha', 'LUAS_EKS_MANGROVE'),
    'laju_abrasi': ('Laju abrasi garis pantai', 'm/tahun', 'ABRASI_PANTAI'),
}
BINER = {'karang', 'eks_mangrove_mudflat', 'intertidal'}
RASTER_DATA = {
    'kedalaman': 'KEDALAMAN', 'gelombang': 'GELOMBANG', 'suhu_rata': 'SUHU', 'klorofil': 'KLOROFIL', 'kd490': 'KD490',
    'periode_gelombang': 'PERIODE_GLB', 'curah_hujan': 'CURAH_HUJAN', 'bulan_kering_berturut': 'BULAN_KERING',
    'arus': 'ARUS', 'arus_dasar': 'ARUS_DASAR', 'salinitas': 'SALINITAS', 'tss': 'TSS', 'kemiringan_lahan': 'KEMIRINGAN',
    'kemiringan_dasar_laut': 'KEMIRINGAN_DASAR', 'tunggang_pasut': 'PASUT', 'pga': 'PGA',
    'gelombang_ekstrem': 'GELOMBANG_EKSTREM', 'angin_100m': 'ANGIN_100M', 'ghi': 'GHI',
    'beda_suhu_1000m': 'BEDA_SUHU_1000M', 'tanah_liat': 'TANAH_LIAT', 'shannon': 'SHANNON',
    'laju_abrasi': 'ABRASI_PANTAI', 'eks_mangrove_mudflat': 'EKS_MANGROVE', 'luas_hamparan_ha': 'LUAS_EKS_MANGROVE',
}
RASTER_DARAT = {'curah_hujan', 'bulan_kering_berturut', 'kemiringan_lahan', 'tanah_liat'}
RASTER_DUA_RANAH = {'salinitas', 'pga', 'laju_abrasi', 'eks_mangrove_mudflat', 'luas_hamparan_ha'}


def raster_ranah(kunci, darat):
    return kunci in RASTER_DUA_RANAH or (kunci in RASTER_DARAT) == darat
UBAH = {'kedalaman': lambda v: max(0.0, -v), 'curah_hujan': lambda v: v * 12}


def dari_raster(kunci, v):
    return None if v is None else UBAH.get(kunci, float)(v)
BENCANA = (
    ('TSUNAMI', 'Risiko tsunami tidak tinggi'),
    ('ABRASI', 'Risiko gelombang ekstrem dan abrasi tidak tinggi'),
    ('BANJIR', 'Risiko banjir tidak tinggi'),
)


def kategori_infra():
    return sorted({k for _, _, s in PARAMETER.values() if isinstance(s, tuple) for k in s})


def sumber_tersedia():
    hasil = cache.get('kriteria:sumber')
    if hasil is not None:
        return hasil
    with connection.cursor() as c:
        c.execute('SELECT DISTINCT kategori FROM inventarisasi_infrastruktur_pendukung')
        hasil = {r[0] for r in c.fetchall()}
        c.execute("SELECT EXISTS (SELECT 1 FROM inventarisasi_sumber_daya_alam WHERE jenis = 'TERUMBU_KARANG')")
        if c.fetchone()[0]:
            hasil.add('TERUMBU_KARANG')
    hasil |= set(raster_tersedia()) | {'ALUR'}
    cache.set('kriteria:sumber', hasil, 600)
    return hasil


def jarak_alur(c, ewkt):
    from analitik.services.pengecualian import ZONA_ALUR
    from inventarisasi.klasifikasi import jenis_unsur

    c.execute(
        'SELECT MIN(ST_Distance(z.geometry::geography, a.g::geography)) FROM (SELECT ST_GeomFromEWKT(%s) AS g) a, '
        f'LATERAL (SELECT z.geometry FROM inventarisasi_zonasi_ruang_laut z WHERE {ZONA_ALUR} '
        'ORDER BY z.geometry <-> a.g LIMIT 3) z',
        [ewkt],
    )
    meter = [c.fetchone()[0]]
    c.execute(
        'SELECT u.nama, u.jenis, u.keterangan, u.kode_lapisan, ST_Distance(u.geometry::geography, a.g::geography) '
        'FROM (SELECT ST_GeomFromEWKT(%s) AS g) a, LATERAL (SELECT * FROM inventarisasi_unsur_ruang_laut u '
        "WHERE u.kelompok = 'RTRL' ORDER BY u.geometry <-> a.g LIMIT 30) u",
        [ewkt],
    )
    meter += [m for *teks, m in c.fetchall() if jenis_unsur(*teks) == 'ALUR_PELAYARAN']
    meter = [m for m in meter if m is not None]
    return min(meter) / 1000 if meter else None


def jarak_area(c, ewkt, tersedia):
    kategori = [k for k in kategori_infra() if k in tersedia]
    km = {}
    if kategori:
        c.execute(
            'SELECT k.kategori, (SELECT MIN(ST_Distance(i.geometry::geography, a.g::geography)) FROM ('
            '    SELECT geometry FROM inventarisasi_infrastruktur_pendukung WHERE kategori = k.kategori'
            '    ORDER BY geometry <-> a.g LIMIT 5) i) '
            'FROM unnest(%s::text[]) AS k(kategori), (SELECT ST_GeomFromEWKT(%s) AS g) a',
            [kategori, ewkt],
        )
        km = {k: m / 1000 for k, m in c.fetchall() if m is not None}
    data = {}
    for kunci, (_, _, sumber) in PARAMETER.items():
        if isinstance(sumber, tuple) and any(k in km for k in sumber):
            data[kunci] = min(km[k] for k in sumber if k in km)
    data['jarak_alur_km'] = jarak_alur(c, ewkt)
    return data


def data_ada(kunci, tersedia):
    sumber = PARAMETER[kunci][2]
    if sumber is None:
        return True
    if isinstance(sumber, tuple):
        return bool(set(sumber) & tersedia)
    return sumber in tersedia


def _angka(v):
    if abs(v) >= 100:
        return f'{v:,.0f}'.replace(',', '.')
    return f'{v:.2f}'.rstrip('0').rstrip('.').replace('.', ',')


def teks_ambang(kunci, ambang):
    bawah, atas = ambang
    satuan = PARAMETER[kunci][1]
    if kunci in BINER:
        return 'ada'
    akhir = f' {satuan}' if satuan else ''
    if bawah is not None and atas is not None:
        return f'{_angka(bawah)}–{_angka(atas)}{akhir}'
    return f"{'≥' if bawah is not None else '≤'} {_angka(bawah if bawah is not None else atas)}{akhir}"


def teks_nilai(kunci, nilai):
    if nilai is None:
        return None
    if kunci in BINER:
        return 'ada' if nilai >= 1 else 'tidak ada'
    satuan = PARAMETER[kunci][1]
    return f"{_angka(nilai)}{f' {satuan}' if satuan else ''}"


def uraian(sektor_kode):
    bagian = []
    for sub in atur('KRITERIA_JENIS').get(sektor_kode, {}).values():
        syarat = '; '.join(f'{PARAMETER[k][0].lower()} {teks_ambang(k, a)}' for k, a in sub['kriteria'].items())
        bagian.append(f"{sub['nama']}: {syarat}")
    return ' | '.join(bagian)


def lulus(nilai, ambang):
    bawah, atas = ambang
    return (bawah is None or nilai >= bawah) and (atas is None or nilai <= atas)


def kena_bencana(data):
    return data['ranah'] == 'DARAT' or (data.get('jarak_pantai_km') or 0) <= 0


def nilai_sub(sub, data, tersedia):
    kriteria = []
    for kunci, ambang in sub['kriteria'].items():
        v = data.get(kunci)
        kriteria.append({
            'kunci': kunci, 'label': PARAMETER[kunci][0], 'nilai': None if v is None else round(float(v), 3),
            'nilai_teks': teks_nilai(kunci, v), 'ambang': list(ambang), 'ambang_teks': teks_ambang(kunci, ambang),
            'lulus': None if v is None else lulus(v, ambang), 'data_ada': data_ada(kunci, tersedia),
        })
    umum = []
    if kena_bencana(data):
        for jenis, label in BENCANA:
            kelas = (data.get('bencana') or {}).get(jenis)
            umum.append({'kunci': jenis, 'label': label, 'nilai_teks': kelas.lower() if kelas else None,
                         'ambang_teks': 'rendah–sedang', 'lulus': None if kelas is None else kelas != 'TINGGI'})
    for nama, hasil in (data.get('tambahan') or {}).items():
        umum.append({'kunci': nama, 'label': nama, 'nilai_teks': None, 'ambang_teks': 'ditetapkan administrator',
                     'lulus': hasil})
    terukur = sum(k['lulus'] is not None for k in kriteria)
    gagal = [k for k in kriteria + umum if k['lulus'] is False]
    cukup = terukur >= math.ceil(atur('PROPORSI_MINIMAL_KRITERIA_TERUKUR') * len(kriteria))
    return {
        'nama': sub['nama'], 'kriteria': kriteria, 'umum': umum, 'terukur': terukur, 'total': len(kriteria),
        'gagal': [k['label'] for k in gagal], 'cukup_data': cukup, 'cocok': not gagal and cukup,
    }


def penilaian(sektor_kode, data, tersedia=None):
    tersedia = sumber_tersedia() if tersedia is None else tersedia
    hasil = []
    for kode, sub in atur('KRITERIA_JENIS').get(sektor_kode, {}).items():
        if data['ranah'] in sub['ranah']:
            hasil.append({'kode': kode, **nilai_sub(sub, data, tersedia)})
    return sorted(hasil, key=lambda h: (not h['cocok'], len(h['gagal']), -h['terukur']))


def ranah_jenis(sektor_kode):
    return {r for sub in atur('KRITERIA_JENIS').get(sektor_kode, {}).values() for r in sub['ranah']}


def alasan(sektor_kode, data, hasil):
    if not hasil:
        letak = 'perairan' if data['ranah'] == 'LAUT' else 'darat'
        butuh = ' atau '.join('perairan' if r == 'LAUT' else 'darat pesisir' for r in sorted(ranah_jenis(sektor_kode)))
        return f'Lokasi berada di {letak}, sedangkan jenis investasi ini membutuhkan {butuh}.'
    terbaik = hasil[0]
    if terbaik['cocok']:
        return ''
    if terbaik['gagal']:
        rinci = [
            f"{k['label'].lower()} {k['nilai_teks']} (syarat {k['ambang_teks']})"
            for k in terbaik['kriteria'] + terbaik['umum'] if k['lulus'] is False
        ]
        return f"Kecocokan fisik {terbaik['nama']} belum terpenuhi: {'; '.join(rinci)}."
    return (f"Data kecocokan fisik {terbaik['nama']} belum cukup: baru {terbaik['terukur']} dari {terbaik['total']} "
            f'kriteria yang terukur di lokasi ini.')
