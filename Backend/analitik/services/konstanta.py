FINANCIAL_WEIGHTS = {
    'npv': 0.35,
    'irr': 0.25,
    'payback': 0.25,
    'roi': 0.15,
}

BATAS_ATAS_IRR_PERSEN = 30.0

PAYBACK_THRESHOLDS = {
    'excellent': 3,
    'good': 7,
    'fair': 12,
}

ROI_CEILING_PCT = 100.0

FAKTOR_NORMALISASI_NPV = 0.5

RISK_WEIGHTS = {
    'pasar': 0.15,
    'operasional': 0.15,
    'regulasi': 0.25,
    'lingkungan': 0.25,
    'sosial': 0.20,
}

LOCATION_WEIGHTS = {
    'tata_ruang': 0.30,
    'potensi_sda': 0.30,
    'aksesibilitas': 0.20,
    'sosial_ekonomi': 0.20,
}

TATA_RUANG_PASS_SCORE = 1.0
TATA_RUANG_FAIL_SCORE = 0.2

PROFIT_RATIO_CEILING = 2.0

RECOMMENDATION_WEIGHTS = {
    'finansial': 0.30,
    'risiko': 0.25,
    'lokasi': 0.25,
    'prediksi': 0.20,
}

DECISION_THRESHOLDS = {
    'layak': {
        'min_score': 0.70,
        'require_tata_ruang': True,
        'require_npv_positive': True,
    },
    'bersyarat': {
        'min_score': 0.40,
        'require_tata_ruang_or_npv': True,
    },
}

PRIORITY_THRESHOLDS = {
    'tinggi': 0.85,
    'sedang_layak': 0.55,
    'sedang_bersyarat': 0.55,
}

RISK_CLASS_THRESHOLDS = {
    'sangat_rendah': 0.20,
    'rendah': 0.40,
    'sedang': 0.70,
}

SENSITIVITAS_FINANSIAL = [0.10, 0.05, 0.0, -0.05, -0.10]

BEST_CASE_REVENUE_MULTIPLIER = 1.20
BEST_CASE_OPEX_MULTIPLIER = 0.90
WORST_CASE_REVENUE_MULTIPLIER = 0.80
WORST_CASE_OPEX_MULTIPLIER = 1.10

RANDOM_INDEX = {
    1: 0.00,
    2: 0.00,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}

AMBANG_KONSISTENSI_AHP = 0.10

KRITERIA_BAWAAN = [
    'FINANSIAL',
    'RISIKO',
    'LOKASI',
    'PREDIKSI',
    'REKOMENDASI',
]

MATRIKS_PERBANDINGAN_BAWAAN = [
    [1.0, 2.0, 3.0, 4.0, 5.0],
    [0.5, 1.0, 2.0, 3.0, 4.0],
    [1/3, 0.5, 1.0, 2.0, 3.0],
    [0.25, 1/3, 0.5, 1.0, 2.0],
    [0.2, 0.25, 1/3, 0.5, 1.0],
]

VALIDATION_LIMITS = {
    'min_capex': 1,
    'min_revenue': 1,
    'min_opex': 0,
    'min_wacc': 0.01,
    'max_wacc': 100.0,
    'min_years': 1,
    'max_years': 100,
    'min_polygon_area_ha': 0.001,
    'max_polygon_area_ha': 1_000_000,
}

DEFAULT_LOCAL_SUPPLY_RATIO = 0.30

SPATIAL_DEFAULT_RISK = {
    'pasar': 0.40,
    'operasional': 0.40,
    'regulasi': 0.40,
    'lingkungan': 0.40,
    'sosial': 0.40,
}

SPATIAL_DEFAULT_LOCATION = {
    'potensi_sda': 0.50,
    'aksesibilitas': 0.50,
    'kondisi_sosek': 0.50,
}

KELAS_RISIKO_SCORE = {
    'SANGAT_RENDAH': 0.15,
    'RENDAH': 0.35,
    'SEDANG': 0.55,
    'TINGGI': 0.85,
}

HAZARD_OPERASIONAL_WEIGHTS = {
    'TSUNAMI': 0.40,
    'ABRASI': 0.35,
    'BANJIR': 0.25,
}

HAZARD_LINGKUNGAN_WEIGHTS = {
    'ABRASI': 0.50,
    'BANJIR': 0.35,
    'TSUNAMI': 0.15,
}

TINGKAT_POTENSI_SCORE = {
    'SANGAT_TINGGI': 0.95,
    'TINGGI': 0.80,
    'SEDANG': 0.55,
    'RENDAH': 0.30,
}

AKSESIBILITAS_PELABUHAN_IDEAL_KM = 10.0
AKSESIBILITAS_PELABUHAN_MAX_KM = 150.0
AKSESIBILITAS_WEIGHTS = {
    'jarak_pelabuhan': 0.40,
    'akses_jalan': 0.25,
    'akses_listrik': 0.20,
    'akses_air': 0.15,
}

INFRASTRUKTUR_AKSESIBILITAS = [
    ('PELABUHAN_PERIKANAN', 0.35, 5.0, 100.0),
    ('PELABUHAN_UMUM', 0.20, 10.0, 150.0),
    ('JALAN_NASIONAL', 0.20, 5.0, 60.0),
    ('JARINGAN_LISTRIK', 0.15, 5.0, 50.0),
    ('KAWASAN_INDUSTRI', 0.10, 20.0, 200.0),
]

INFRASTRUKTUR_RADIUS_CARI_KM = 300.0

SEKTOR_SUB_ZONA_COCOK = {
    'PERIKANAN_TANGKAP': ['PERIKANAN_TANGKAP', 'PERIKANAN'],
    'PERIKANAN_BUDIDAYA': ['PERIKANAN_BUDIDAYA', 'PERIKANAN'],
    'PARIWISATA_BAHARI': ['PARIWISATA', 'MANGROVE'],
    'ENERGI_KELAUTAN': ['ENERGI'],
    'PENGOLAHAN_HASIL_LAUT': ['INDUSTRI', 'PERIKANAN_TANGKAP', 'PERIKANAN_BUDIDAYA', 'PERIKANAN'],
    'JASA_MARITIM': ['PELAYARAN', 'INDUSTRI', 'INFRASTRUKTUR'],
    'INFRASTRUKTUR_LAUT': ['INDUSTRI', 'PELAYARAN', 'INFRASTRUKTUR'],
    'GARAM': ['INDUSTRI', 'PERGARAMAN'],
    'BIOTEKNOLOGI_KELAUTAN': ['INDUSTRI', 'PERIKANAN_BUDIDAYA', 'PERIKANAN'],
    'KONSERVASI_PESISIR': ['KONSERVASI', 'MANGROVE'],
}

KETENTUAN_DARAT_BAWAAN = {
    'GARAM': {'DARAT_PERGARAMAN': 'DIIZINKAN', 'DARAT_PERIKANAN': 'BERSYARAT', 'DARAT_INDUSTRI': 'BERSYARAT'},
    'PERIKANAN_BUDIDAYA': {'DARAT_PERIKANAN': 'DIIZINKAN', 'DARAT_PERGARAMAN': 'BERSYARAT'},
    'PENGOLAHAN_HASIL_LAUT': {'DARAT_INDUSTRI': 'DIIZINKAN', 'DARAT_PERIKANAN': 'BERSYARAT'},
    'PARIWISATA_BAHARI': {'DARAT_PARIWISATA': 'DIIZINKAN'},
    'KONSERVASI_PESISIR': {'DARAT_MANGROVE': 'DIIZINKAN', 'DARAT_LINDUNG': 'DIIZINKAN'},
}

SEKTOR_TERSENDIRI_DI_PETA = ['KONSERVASI_PESISIR']

AMBANG_KECOCOKAN = 0.75
# Dihitung dari parameter yang dinilai saja; syarat dasar (ranah, karakter, infrastruktur, pengecualian) yang
# pasti terpenuhi pada lokasi yang lolos tidak lagi ikut dihitung.
MINIMAL_PARAMETER_TERUKUR = 3
# Hasil screening berlabel "indikatif" bila parameter terukurnya kurang dari bagian ini (atau kurang dari
# MINIMAL_PARAMETER_TERUKUR).
AMBANG_KELENGKAPAN_DATA = 0.75
WAJIB_LENGKAP_BERSYARAT = True
AMBANG_KECOCOKAN_BERSYARAT = 1.0
UKURAN_SEL_LOKASI_DERAJAT = 0.00225
SEL_PER_SISI_INTI_LOKASI = 4
JARAK_ANTAR_LOKASI_KM = 10

PITA_PESISIR_DARAT_M = (100, 4000)
KM_PER_DERAJAT = 111.32
BATAS_JARAK_PANTAI_DERAJAT = 0.06

EKOSISTEM_PESISIR = ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG']

KARAKTER_LOKASI = {
    'GARAM': {
        'uraian': 'tambak garam di darat pesisir, 100 m sampai 4 km dari garis pantai',
        'DARAT': [{}],
    },
    'PENGOLAHAN_HASIL_LAUT': {
        'uraian': 'unit pengolahan di darat pesisir, paling jauh 4 km dari garis pantai',
        'DARAT': [{}],
    },
    'PERIKANAN_BUDIDAYA': {
        'uraian': 'budi daya laut di perairan 1-30 m bergelombang paling tinggi 1,5 m, atau tambak di kawasan '
                  'perikanan darat pesisir, 100 m sampai 4 km dari garis pantai',
        'LAUT': [{'kedalaman': (1, 30), 'gelombang_maks': 1.5}],
        'DARAT': [{}],
    },
    'PERIKANAN_TANGKAP': {
        'uraian': 'daerah penangkapan di perairan sedalam 10 m atau lebih',
        'LAUT': [{'kedalaman': (10, None)}],
    },
    'PARIWISATA_BAHARI': {
        'uraian': 'perairan paling dalam 30 m dan paling jauh 5 km dari pantai atau di dekat terumbu karang, '
                  'serta kawasan pariwisata di darat pesisir',
        'LAUT': [{'kedalaman': (None, 30), 'jarak_pantai_maks_km': 5}, {'ekosistem': ['TERUMBU_KARANG']}],
        'DARAT': [{}],
    },
    'JASA_MARITIM': {
        'uraian': 'perairan yang menempel garis pantai (paling jauh 500 m) dengan gelombang paling tinggi 1,5 m',
        'LAUT': [{'jarak_pantai_maks_km': 0.5, 'gelombang_maks': 1.5}],
    },
    'INFRASTRUKTUR_LAUT': {
        'uraian': 'perairan paling dalam 40 m tanpa terumbu karang atau lamun',
        'LAUT': [{'kedalaman': (None, 40), 'tanpa_ekosistem': ['TERUMBU_KARANG', 'LAMUN']}],
    },
    'ENERGI_KELAUTAN': {
        'uraian': 'perairan untuk OTEC (sedalam 500 m atau lebih, suhu permukaan minimum 25 °C), energi gelombang '
                  '(tinggi gelombang 1 m atau lebih dan daya gelombang 10 kW/m atau lebih), atau PLTS terapung '
                  '(5-50 m, gelombang di bawah 1,5 m)',
        'LAUT': [
            {'kedalaman': (500, None), 'suhu_min': 25, 'dinilai': {'kedalaman_min': 1000, 'suhu_rata_min': 27}},
            {'gelombang_min': 1.0, 'daya_gelombang_min': 10, 'dinilai': {'daya_gelombang_min': 15, 'kedalaman_maks': 100}},
            {'kedalaman': (5, 50), 'gelombang_maks': 1.5, 'dinilai': {'gelombang_tertinggi_maks': 2.5, 'kedalaman_maks': 30}},
        ],
    },
    'KONSERVASI_PESISIR': {
        'uraian': 'pesisir yang memiliki atau berdekatan dengan mangrove, lamun, atau terumbu karang, di perairan '
                  'maupun di darat',
        'LAUT': [{'ekosistem': EKOSISTEM_PESISIR}],
        'DARAT': [{'ekosistem': EKOSISTEM_PESISIR}],
    },
    'BIOTEKNOLOGI_KELAUTAN': {
        'uraian': 'perairan yang memiliki atau berdekatan dengan mangrove, lamun, atau terumbu karang sebagai sumber '
                  'bahan baku hayati',
        'LAUT': [{'ekosistem': EKOSISTEM_PESISIR}],
    },
}

# Parameter dinilai per jenis investasi (ikut persentase sangat sesuai, tidak menggugurkan). Seluruhnya dari data
# publik; ambangnya usulan berdasarkan pustaka kesesuaian lokasi dan menunggu tinjauan KKP. Parameter yang
# datanya belum pernah ditarik ke aplikasi dilewati, bukan dihitung "tidak terukur".
PARAMETER_TAMBAHAN = {
    'PERIKANAN_BUDIDAYA': {'LAUT': {
        'suhu_rata_min': 26, 'suhu_rata_maks': 32, 'anomali_suhu_maks': 1.0, 'klorofil_min': 0.2, 'klorofil_maks': 10,
        'kd490_maks': 0.4, 'gelombang_tertinggi_maks': 2.5,
    }},
    'PERIKANAN_TANGKAP': {'LAUT': {'klorofil_min': 0.2}},
    'PARIWISATA_BAHARI': {'LAUT': {
        'kd490_maks': 0.15, 'jarak_karang_maks_km': 2, 'anomali_suhu_maks': 1.0, 'gelombang_tertinggi_maks': 2.5,
    }},
    'JASA_MARITIM': {'LAUT': {'gelombang_tertinggi_maks': 2.5}},
    'ENERGI_KELAUTAN': {'LAUT': {'jarak_pantai_maks_km': 5}},
    'GARAM': {'DARAT': {'curah_hujan_maks': 1300, 'bulan_kering_min': 4}},
    'KONSERVASI_PESISIR': {'LAUT': {'kedalaman_maks': 30, 'gelombang_maks': 1.5, 'anomali_suhu_maks': 1.0}},
    'BIOTEKNOLOGI_KELAUTAN': {'LAUT': {'kedalaman_maks': 30, 'gelombang_maks': 1.5, 'anomali_suhu_maks': 1.0}},
}
# Bulan dengan curah hujan di bawah ini dihitung bulan kering (pustaka tambak garam: < 100 mm/bulan).
AMBANG_BULAN_KERING_MM = 100

# Pengecualian keras, berlaku sama di Peta Sebaran dan screening.
# Ekosistem sensitif yang tidak boleh ditempati tiap jenis investasi. Jenis yang membutuhkan ekosistem
# (pariwisata, konservasi, bioteknologi) dan perikanan tangkap tidak dikecualikan.
EKOSISTEM_TERLARANG_SEKTOR = {
    'PERIKANAN_BUDIDAYA': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'ENERGI_KELAUTAN': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'JASA_MARITIM': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'INFRASTRUKTUR_LAUT': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'GARAM': ['MANGROVE'],
    'PENGOLAHAN_HASIL_LAUT': ['MANGROVE'],
}
# Kawasan konservasi (jenis zona ZL atau sub-zona konservasi dari sumber mana pun) hanya terbuka bagi jenis ini.
SEKTOR_BOLEH_DI_KAWASAN_KONSERVASI = ['KONSERVASI_PESISIR']
# Alur pelayaran/ALKI (poligon zonasi dari lapisan mana pun) dikecualikan bagi semua jenis kecuali yang tercantum.
SEKTOR_BOLEH_DI_ALUR_PELAYARAN = []
# Jarak aman dari unsur garis RTRL; usulan, sesuaikan dengan ketentuan Kemenhub/KKP yang berlaku.
BUFFER_UNSUR_TERLARANG_M = {'KABEL': 500.0, 'PIPA': 500.0, 'ALUR_PELAYARAN': 500.0}
# Screening area: irisan pengecualian di bawah bagian ini dicatat sebagai peringatan, tidak menggugurkan
# (batas peta tata ruang 1:50.000-1:250.000 dapat bergeser puluhan hingga ratusan meter).
AMBANG_IRISAN_PENGECUALIAN_PERSEN = 1.0
# Screening area: zona yang tidak mengizinkan (atau belum berketentuan) dan KKPRL terbit yang hanya teriris sebagian
# kecil di tepi area ditandai "perlu verifikasi batas", tidak langsung menggugurkan.
AMBANG_IRISAN_TEPI_PERSEN = 2.0
# Batas luas area yang dapat di-screening / dianalisis.
LUAS_AREA_MIN_HA = 0.01
LUAS_AREA_MAKS_HA = 50000

RADIUS_EKOSISTEM_PENDUKUNG_M = 500

JENIS_ZONA_TERLARANG = ['ALKI']

SUB_ZONA_TANPA_RINCIAN = ['LAINNYA', 'BELUM_DIATUR', 'TIDAK_DIBAGI', 'DARAT_LAINNYA']

SUMBER_ZONASI_DARAT = 'KKP-RTRW-DARAT'
PRIORITAS_SUMBER_ZONASI = ['KKP-RTRW', 'KKP-PKKPRL', 'KKP-RZWP3K']
LABEL_SUMBER_ZONASI = {
    'KKP-RTRW': 'RTRW Provinsi (KKP)',
    'KKP-PKKPRL': 'Peta arahan PKKPRL 1:50.000',
    'KKP-RZWP3K': 'RZWP-3-K',
    'KKP-WFS': 'Rencana Zonasi KAW (Perpres 83/2020)',
    SUMBER_ZONASI_DARAT: 'Pola Ruang darat RTRW Provinsi (KKP)',
}

AMBANG_CAKUPAN_ACUAN = 0.99
AMBANG_IRISAN_KKPRL_M2 = 1.0
RADIUS_LOKASI_ALTERNATIF_KM = 100.0
JUMLAH_LOKASI_ALTERNATIF = 5
BATAS_PERIKSA_LOKASI = 8

REGULASI_PENALTY = {
    'zona_tidak_cocok': 0.20,
    'tumpang_tindih_kkprl': 0.25,
}

SOSEK_PESISIR_BONUS = 0.10
SOSEK_PENDUDUK_REFERENSI = 500_000

AMBANG_TERBANGUN_PERSEN = 10

BOBOT_SKOR_ZONA = {
    'lokasi': 0.50,
    'risiko': 0.50,
}

KELAS_KELAYAKAN_ZONA = [
    ('TINGGI', 0.70),
    ('SEDANG', 0.55),
    ('RENDAH', 0.40),
    ('SANGAT_RENDAH', 0.0),
]


def _atur(kunci):
    from analitik.services.pengaturan import atur

    return atur(kunci)


def kelas_kelayakan(skor: float) -> str:
    for nama, ambang in _atur('KELAS_KELAYAKAN_ZONA'):
        if skor >= ambang:
            return nama
    return 'SANGAT_RENDAH'


def rerata_berbobot_berdata(komponen):
    total_bobot = sum(b for _, b, ada in komponen.values() if ada)
    if not total_bobot:
        return 0.5, []
    nilai = sum(v * b for v, b, ada in komponen.values() if ada) / total_bobot
    dipakai = sorted(k for k, (_, _, ada) in komponen.items() if ada)
    return nilai, dipakai


SENSITIVITAS_EKOSISTEM = {
    ('MANGROVE', 'Baik'): 0.90,
    ('MANGROVE', 'Sedang'): 0.65,
    ('MANGROVE', 'Rusak'): 0.40,
    ('MANGROVE', ''): 0.70,
    ('TERUMBU_KARANG', ''): 0.85,
    ('LAMUN', ''): 0.80,
}

EKOSISTEM_LANTAI_CAKUPAN = 0.60

BOBOT_RISIKO_LINGKUNGAN = {
    'ekosistem': 0.60,
    'bencana': 0.40,
}


BOBOT_RISIKO_SOSIAL = {
    'kemiskinan': 0.50,
    'tenurial': 0.50,
}

SKALA_RASIO_DTKS = (0.069, 0.145)
SKALA_RASIO_NELAYAN = (0.002, 0.078)

TENURIAL_LANTAI_ADAT = 0.85

TENURIAL_LANTAI_SUB_ZONA = {
    'KAWASAN_SUCI': 0.90,
    'PERMUKIMAN': 0.75,
}


def skala(nilai, rendah, tinggi):
    if nilai is None or tinggi <= rendah:
        return None
    return max(0.0, min(1.0, (nilai - rendah) / (tinggi - rendah)))


def risiko_sosial(
    rasio_dtks=None, rasio_nelayan=None, ada_adat=False, sub_zona='', adat_terdata=False
):
    kemiskinan = skala(rasio_dtks, *_atur('SKALA_RASIO_DTKS'))

    tenurial = skala(rasio_nelayan, *_atur('SKALA_RASIO_NELAYAN'))
    lantai = []
    if ada_adat:
        lantai.append(_atur('TENURIAL_LANTAI_ADAT'))
    if sub_zona in _atur('TENURIAL_LANTAI_SUB_ZONA'):
        lantai.append(_atur('TENURIAL_LANTAI_SUB_ZONA')[sub_zona])
    if lantai:
        tenurial = max([tenurial or 0.0, *lantai])

    bobot = _atur('BOBOT_RISIKO_SOSIAL')
    nilai, dipakai = rerata_berbobot_berdata({
        'kemiskinan': (kemiskinan or 0.0, bobot['kemiskinan'], kemiskinan is not None),
        'tenurial': (tenurial or 0.0, bobot['tenurial'], tenurial is not None),
    })
    if adat_terdata and dipakai:
        dipakai = sorted([*dipakai, 'adat'])
    komponen = {'kemiskinan': kemiskinan, 'tenurial': tenurial}
    return (nilai if dipakai else None), dipakai, komponen


def skor_sosial_ekonomi(jumlah_penduduk=0, pesisir=False):
    if not jumlah_penduduk:
        return None
    skor = 0.5
    if pesisir:
        skor += _atur('SOSEK_PESISIR_BONUS')
    skor += min(1.0, jumlah_penduduk / _atur('SOSEK_PENDUDUK_REFERENSI')) * 0.3
    return max(0.0, min(1.0, skor))


SUMBER_EKOSISTEM_UTAMA = 'KKP-EKOSISTEM'
SUMBER_MANGROVE_GMW = 'GMW-MANGROVE'
SUMBER_LAMUN = 'SIDAKO-LAMUN'
SUMBER_KARANG = 'SIDAKO-KARANG'

BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober',
         'November', 'Desember')

STOK_KARBON_BIRU = {
    'MANGROVE': (1083.0, 'Murdiyarso dkk. 2015, Nature Climate Change 5:1089-1092'),
    'LAMUN': (119.5, 'Alongi dkk. 2016, Wetlands Ecology and Management 24:3-13'),
}
FAKTOR_KARBON_KE_CO2 = 44 / 12
BATAS_PESISIR_M = 1000

GMW_TAHUN_AWAL = 1996
GMW_TAHUN_AKHIR = 2020

GMW_TREN_MASUK_SKOR = False

GMW_AMBANG_TREN_PERSEN = 5.0


KELAS_RISIKO_LABEL = {
    'SANGAT_RENDAH': 'Sangat Rendah',
    'RENDAH': 'Rendah',
    'SEDANG': 'Sedang',
    'TINGGI': 'Tinggi',
}


def kelas_risiko_investasi(pasar, operasional, regulasi, lingkungan, sosial):
    bawaan, ambang = _atur('SPATIAL_DEFAULT_RISK'), _atur('RISK_CLASS_THRESHOLDS')
    nilai = [
        pasar if pasar is not None else bawaan['pasar'],
        operasional if operasional is not None else bawaan['operasional'],
        regulasi if regulasi is not None else bawaan['regulasi'],
        lingkungan if lingkungan is not None else bawaan['lingkungan'],
        sosial if sosial is not None else bawaan['sosial'],
    ]
    rerata = sum(nilai) / len(nilai)
    if rerata <= ambang['sangat_rendah']:
        return 'SANGAT_RENDAH'
    if rerata <= ambang['rendah']:
        return 'RENDAH'
    if rerata <= ambang['sedang']:
        return 'SEDANG'
    return 'TINGGI'
