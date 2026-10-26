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
    'KONSERVASI_PESISIR': {'DARAT_MANGROVE': 'DIIZINKAN', 'DARAT_LINDUNG': 'DIIZINKAN', 'DARAT_PERIKANAN': 'BERSYARAT'},
    'BIOTEKNOLOGI_KELAUTAN': {'DARAT_INDUSTRI': 'DIIZINKAN', 'DARAT_PERIKANAN': 'BERSYARAT'},
}

SEKTOR_TERSENDIRI_DI_PETA = ['KONSERVASI_PESISIR']

AMBANG_KECOCOKAN = 0.75
PROPORSI_MINIMAL_KRITERIA_TERUKUR = 0.5
RADIUS_ADAT_DEKAT_M = 1000
PORSI_DARAT_MINIMAL = 0.5
UKURAN_SEL_LOKASI_DERAJAT = 0.00225
SEL_PER_SISI_INTI_LOKASI = 4
JARAK_ANTAR_LOKASI_KM = 25
MAKS_LOKASI_NASIONAL = 30
MAKS_LOKASI_PER_PROVINSI = 5
RADIUS_KARANG_KM = 1.0
KARANG_TERPETAKAN_KM = 50.0
KRITERIA_PELENGKAP = ('jarak_listrik_km', 'jarak_jalan_nasional_km', 'tanah_liat', 'shannon')
SKOR_MINIMAL_LOKASI_UNGGULAN = 30
BOBOT_RUANG_BERSYARAT = 0.75

PITA_PESISIR_DARAT_M = (100, 4000)
KM_PER_DERAJAT = 111.32
BATAS_JARAK_PANTAI_DERAJAT = 0.06

KRITERIA_JENIS = {
    'PERIKANAN_TANGKAP': {
        'TANGKAP_ARMADA_INDUSTRI': {
            'nama': 'Armada Kapal Tangkap Skala Industri', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [30.0, None], 'klorofil': [0.15, None], 'gelombang': [None, 2.5],
                         'jarak_pelabuhan_perikanan_besar_km': [None, 100.0]},
            'unggulan': {'kedalaman': [50.0, None], 'klorofil': [0.2, None], 'gelombang': [None, 2.0],
                         'jarak_pelabuhan_perikanan_besar_km': [None, 50.0]},
        },
        'TANGKAP_PELAGIS': {
            'nama': 'Perikanan Pelagis Besar', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [100.0, None], 'klorofil': [0.1, 1.0], 'suhu_rata': [27.0, 31.0],
                         'gelombang': [None, 2.5], 'jarak_pelabuhan_perikanan_km': [None, 100.0]},
            'unggulan': {'kedalaman': [200.0, None], 'klorofil': [0.15, 0.5], 'suhu_rata': [28.0, 30.0],
                         'gelombang': [None, 2.0], 'jarak_pelabuhan_perikanan_km': [None, 60.0]},
        },
        'TANGKAP_DEMERSAL': {
            'nama': 'Perikanan Demersal dan Karang', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [5.0, 100.0], 'klorofil': [0.3, None], 'gelombang': [None, 1.5],
                         'jarak_pelabuhan_perikanan_km': [None, 50.0]},
            'unggulan': {'kedalaman': [10.0, 60.0], 'klorofil': [0.5, None], 'gelombang': [None, 1.0],
                         'jarak_pelabuhan_perikanan_km': [None, 30.0]},
        },
        'TANGKAP_PELAGIS_KECIL': {
            'nama': 'Perikanan Pelagis Kecil', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [20.0, 200.0], 'klorofil': [0.3, 5.0], 'suhu_rata': [26.0, 31.0],
                         'gelombang': [None, 2.0], 'jarak_pelabuhan_perikanan_km': [None, 60.0]},
            'unggulan': {'kedalaman': [30.0, 100.0], 'klorofil': [0.5, 2.0], 'suhu_rata': [27.0, 30.0],
                         'gelombang': [None, 1.5], 'jarak_pelabuhan_perikanan_km': [None, 30.0]},
        },
    },
    'PERIKANAN_BUDIDAYA': {
        'BUDIDAYA_TAMBAK': {
            'nama': 'Budidaya Tambak Udang (Payau)', 'ranah': ['DARAT'],
            'kriteria': {'kemiringan_lahan': [None, 3.0], 'jarak_dari_pantai_km': [0.1, 5.0], 'tanah_liat': [20.0, None]},
            'unggulan': {'kemiringan_lahan': [None, 2.0], 'jarak_dari_pantai_km': [0.1, 3.0], 'tanah_liat': [30.0, None]},
        },
        'BUDIDAYA_RUMPUT_LAUT': {
            'nama': 'Budidaya Rumput Laut (Marikultur)', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [2.0, 10.0], 'arus': [None, 0.54], 'salinitas': [29.0, 35.0],
                         'suhu_rata': [27.0, 32.0], 'kd490': [None, 1.7]},
            'unggulan': {'kedalaman': [3.0, 5.0], 'arus': [None, 0.31], 'salinitas': [31.0, 35.0],
                         'suhu_rata': [27.0, 30.0], 'kd490': [None, 0.57]},
        },
        'BUDIDAYA_LAUT': {
            'nama': 'Budidaya Ikan Laut KJA (Karamba Jaring Apung)', 'ranah': ['LAUT'],
            'kriteria': {'arus': [None, 0.5], 'kedalaman': [5.0, 40.0], 'salinitas': [27.0, 35.0], 'tss': [None, 35.0],
                         'gelombang': [None, 1.0]},
            'unggulan': {'arus': [None, 0.3], 'kedalaman': [7.0, 30.0], 'salinitas': [30.0, 34.0], 'tss': [None, 25.0],
                         'gelombang': [None, 0.6]},
        },
        'BUDIDAYA_KEKERANGAN': {
            'nama': 'Budidaya Kekerangan dan Moluska', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [1.0, 15.0], 'salinitas': [15.0, 34.0], 'klorofil': [0.5, None], 'arus': [None, 0.5],
                         'gelombang': [None, 1.0]},
            'unggulan': {'kedalaman': [2.0, 10.0], 'salinitas': [20.0, 33.0], 'klorofil': [1.0, None], 'arus': [None, 0.3],
                         'gelombang': [None, 0.6]},
        },
        'BUDIDAYA_PEMBENIHAN': {
            'nama': 'Pembenihan (Hatchery) dan Pendederan', 'ranah': ['DARAT'],
            'kriteria': {'jarak_dari_pantai_km': [0.1, 1.0], 'kemiringan_lahan': [None, 8.0], 'salinitas': [28.0, None],
                         'jarak_muara_km': [3.0, None], 'jarak_listrik_km': [None, 3.0], 'jarak_jalan_nasional_km': [None, 3.0]},
            'unggulan': {'jarak_dari_pantai_km': [0.1, 0.5], 'kemiringan_lahan': [None, 5.0], 'salinitas': [30.0, None],
                         'jarak_muara_km': [5.0, None], 'jarak_listrik_km': [None, 1.0], 'jarak_jalan_nasional_km': [None, 1.0]},
        },
    },
    'PENGOLAHAN_HASIL_LAUT': {
        'OLAH_RANTAI_DINGIN': {
            'nama': 'Fasilitas Rantai Dingin (Cold Chain)', 'ranah': ['DARAT'],
            'kriteria': {'jarak_pelabuhan_perikanan_km': [None, 20.0], 'jarak_listrik_km': [None, 3.0],
                         'jarak_jalan_nasional_km': [None, 3.0], 'jarak_pelabuhan_ekspor_km': [None, 100.0],
                         'produksi_ikan_kabupaten_ton': [5000.0, None]},
            'unggulan': {'jarak_pelabuhan_perikanan_km': [None, 5.0], 'jarak_listrik_km': [None, 1.0],
                         'jarak_jalan_nasional_km': [None, 1.0], 'jarak_pelabuhan_ekspor_km': [None, 50.0],
                         'produksi_ikan_kabupaten_ton': [20000.0, None]},
        },
        'OLAH_PENGALENGAN': {
            'nama': 'Pengalengan Ikan', 'ranah': ['DARAT'],
            'kriteria': {'jarak_pelabuhan_perikanan_km': [None, 30.0], 'jarak_listrik_km': [None, 3.0],
                         'jarak_jalan_nasional_km': [None, 3.0], 'jarak_pelabuhan_ekspor_km': [None, 60.0],
                         'produksi_ikan_kabupaten_ton': [20000.0, None]},
            'unggulan': {'jarak_pelabuhan_perikanan_km': [None, 10.0], 'jarak_listrik_km': [None, 1.0],
                         'jarak_jalan_nasional_km': [None, 1.0], 'jarak_pelabuhan_ekspor_km': [None, 30.0],
                         'produksi_ikan_kabupaten_ton': [50000.0, None]},
        },
        'OLAH_RUMPUT_LAUT': {
            'nama': 'Pengolahan Rumput Laut Setengah Jadi', 'ranah': ['DARAT'],
            'kriteria': {'jarak_zona_budidaya_km': [None, 30.0], 'jarak_listrik_km': [None, 3.0],
                         'jarak_jalan_nasional_km': [None, 3.0], 'jarak_pelabuhan_ekspor_km': [None, 100.0]},
            'unggulan': {'jarak_zona_budidaya_km': [None, 10.0], 'jarak_listrik_km': [None, 1.0],
                         'jarak_jalan_nasional_km': [None, 1.0], 'jarak_pelabuhan_ekspor_km': [None, 50.0]},
        },
        'OLAH_SIAP_SAJI': {
            'nama': 'Produk Siap Masak/Makan (Value-Added Products)', 'ranah': ['DARAT'],
            'kriteria': {'jarak_pelabuhan_ekspor_km': [None, 60.0], 'jarak_pelabuhan_perikanan_km': [None, 60.0],
                         'jarak_listrik_km': [None, 3.0], 'jarak_jalan_nasional_km': [None, 3.0],
                         'produksi_ikan_kabupaten_ton': [5000.0, None]},
            'unggulan': {'jarak_pelabuhan_ekspor_km': [None, 25.0], 'jarak_pelabuhan_perikanan_km': [None, 30.0],
                         'jarak_listrik_km': [None, 1.0], 'jarak_jalan_nasional_km': [None, 1.0],
                         'produksi_ikan_kabupaten_ton': [20000.0, None]},
        },
    },
    'PARIWISATA_BAHARI': {
        'WISATA_RESOR': {
            'nama': 'Resor dan Akomodasi Pesisir/Pulau Kecil', 'ranah': ['DARAT'],
            'kriteria': {'jarak_dari_pantai_km': [0.1, 2.0], 'kemiringan_lahan': [None, 15.0],
                         'jarak_gerbang_wisata_km': [None, 100.0]},
            'unggulan': {'jarak_dari_pantai_km': [0.1, 1.0], 'kemiringan_lahan': [None, 8.0],
                         'jarak_gerbang_wisata_km': [None, 60.0]},
        },
        'WISATA_SELAM': {
            'nama': 'Pusat Rekreasi Bawah Laut (Diving & Snorkeling)', 'ranah': ['LAUT'],
            'kriteria': {'kd490': [None, 0.15], 'karang': [1, None], 'arus': [None, 0.3],
                         'jarak_gerbang_wisata_km': [None, 100.0]},
            'unggulan': {'kd490': [None, 0.08], 'karang': [1, None], 'arus': [None, 0.25],
                         'jarak_gerbang_wisata_km': [None, 60.0]},
        },
        'WISATA_KAPAL_PESIAR': {
            'nama': 'Pariwisata Kapal Pesiar (Liveaboard / Yacht Charter)', 'ranah': ['LAUT'],
            'kriteria': {'karang': [1, None], 'kd490': [None, 0.15], 'gelombang': [None, 1.5], 'kedalaman': [5.0, None],
                         'jarak_gerbang_wisata_km': [None, 150.0]},
            'unggulan': {'karang': [1, None], 'kd490': [None, 0.1], 'gelombang': [None, 1.0], 'kedalaman': [10.0, None],
                         'jarak_gerbang_wisata_km': [None, 100.0]},
        },
        'WISATA_MARINA': {
            'nama': 'Taman Rekreasi Bahari & Marina', 'ranah': ['LAUT'],
            'kriteria': {'jarak_pantai_km': [None, 1.0], 'gelombang': [None, 1.0], 'kedalaman': [2.0, 20.0],
                         'tunggang_pasut': [None, 3.0], 'jarak_gerbang_wisata_km': [None, 60.0]},
            'unggulan': {'jarak_pantai_km': [None, 0.5], 'gelombang': [None, 0.6], 'kedalaman': [3.0, 10.0],
                         'tunggang_pasut': [None, 2.0], 'jarak_gerbang_wisata_km': [None, 30.0]},
        },
    },
    'JASA_MARITIM': {
        'JASA_GALANGAN': {
            'nama': 'Galangan Kapal (Shipyard)', 'ranah': ['LAUT'],
            'kriteria': {'jarak_pantai_km': [None, 1.0], 'kedalaman': [4.0, None], 'gelombang': [None, 1.5],
                         'tunggang_pasut': [None, 3.5], 'jarak_alur_km': [None, 100.0], 'jarak_jalan_nasional_km': [None, 3.0]},
            'unggulan': {'jarak_pantai_km': [None, 0.5], 'kedalaman': [6.0, None], 'gelombang': [None, 1.0],
                         'tunggang_pasut': [None, 3.0], 'jarak_alur_km': [None, 50.0], 'jarak_jalan_nasional_km': [None, 1.0]},
        },
        'JASA_BUNKER': {
            'nama': 'Bunker Bahan Bakar Kapal (Bunkering Services)', 'ranah': ['LAUT'],
            'kriteria': {'jarak_alur_km': [None, 50.0], 'kedalaman': [10.0, None], 'gelombang': [None, 1.5],
                         'jarak_pelabuhan_ekspor_km': [None, 50.0]},
            'unggulan': {'jarak_alur_km': [None, 20.0], 'kedalaman': [15.0, None], 'gelombang': [None, 1.0],
                         'jarak_pelabuhan_ekspor_km': [None, 25.0]},
        },
        'JASA_TERMINAL': {
            'nama': 'Terminal Khusus & Logistik Pelabuhan', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [5.0, None], 'jarak_pantai_km': [None, 1.0], 'gelombang': [None, 1.5],
                         'tunggang_pasut': [None, 3.5], 'jarak_alur_km': [None, 100.0], 'jarak_muara_km': [5.0, None]},
            'unggulan': {'kedalaman': [10.0, None], 'jarak_pantai_km': [None, 0.5], 'gelombang': [None, 1.0],
                         'tunggang_pasut': [None, 3.0], 'jarak_alur_km': [None, 50.0], 'jarak_muara_km': [10.0, None]},
        },
        'JASA_SALVAGE': {
            'nama': 'Penyelamatan Laut & Pekerjaan Bawah Air (Salvage & Underwater Work)', 'ranah': ['LAUT'],
            'kriteria': {'jarak_alur_km': [None, 50.0], 'jarak_pelabuhan_ekspor_km': [None, 60.0],
                         'jarak_pantai_km': [None, 2.0], 'gelombang': [None, 2.0]},
            'unggulan': {'jarak_alur_km': [None, 20.0], 'jarak_pelabuhan_ekspor_km': [None, 30.0],
                         'jarak_pantai_km': [None, 1.0], 'gelombang': [None, 1.5]},
        },
    },
    'INFRASTRUKTUR_LAUT': {
        'INFRA_PELABUHAN_PERIKANAN': {
            'nama': 'Infrastruktur Pelabuhan Perikanan', 'ranah': ['LAUT'],
            'kriteria': {'jarak_pantai_km': [None, 1.0], 'kedalaman': [3.0, None], 'gelombang': [None, 1.5],
                         'tunggang_pasut': [None, 3.5], 'klorofil': [0.3, None]},
            'unggulan': {'jarak_pantai_km': [None, 0.5], 'kedalaman': [5.0, None], 'gelombang': [None, 1.0],
                         'tunggang_pasut': [None, 3.0], 'klorofil': [0.5, None]},
        },
        'INFRA_PELINDUNG_PANTAI': {
            'nama': 'Bangunan Pelindung Pantai', 'ranah': ['LAUT'],
            'kriteria': {'laju_abrasi': [0.3, None], 'jarak_pantai_km': [None, 0.5], 'kedalaman': [None, 10.0]},
            'unggulan': {'laju_abrasi': [1.0, None], 'jarak_pantai_km': [None, 0.25], 'kedalaman': [None, 5.0]},
        },
        'INFRA_REKLAMASI': {
            'nama': 'Reklamasi & Polder Terpadu', 'ranah': ['LAUT'],
            'kriteria': {'kedalaman': [None, 10.0], 'jarak_pantai_km': [None, 2.0], 'pga': [None, 0.35],
                         'gelombang_ekstrem': [None, 4.0], 'kemiringan_dasar_laut': [None, 5.0]},
            'unggulan': {'kedalaman': [None, 5.0], 'jarak_pantai_km': [None, 1.0], 'pga': [None, 0.25],
                         'gelombang_ekstrem': [None, 2.5], 'kemiringan_dasar_laut': [None, 2.0]},
        },
        'INFRA_KABEL_PIPA': {
            'nama': 'Kabel & Pipa Bawah Laut', 'ranah': ['LAUT'],
            'kriteria': {'pga': [None, 0.35], 'kemiringan_dasar_laut': [None, 5.0], 'arus_dasar': [None, 0.8],
                         'gelombang_ekstrem': [None, 4.0]},
            'unggulan': {'pga': [None, 0.25], 'kemiringan_dasar_laut': [None, 5.0], 'arus_dasar': [None, 0.5],
                         'gelombang_ekstrem': [None, 2.5]},
        },
    },
    'ENERGI_KELAUTAN': {
        'ENERGI_PASUT': {
            'nama': 'Energi Arus Laut & Pasang Surut (Tidal/Ocean Current Energy)', 'ranah': ['LAUT'],
            'kriteria': {'tunggang_pasut': [4.0, None], 'kedalaman': [None, 50.0], 'jarak_gardu_km': [None, 20.0]},
            'unggulan': {'tunggang_pasut': [5.0, None], 'kedalaman': [None, 30.0], 'jarak_gardu_km': [None, 10.0]},
        },
        'OTEC': {
            'nama': 'Konversi Energi Panas Laut (Ocean Thermal Energy Conversion / OTEC)', 'ranah': ['LAUT'],
            'kriteria': {'beda_suhu_1000m': [20.0, None], 'jarak_gardu_km': [None, 20.0]},
            'unggulan': {'beda_suhu_1000m': [22.0, None], 'jarak_gardu_km': [None, 10.0]},
        },
        'PLTB_OFFSHORE': {
            'nama': 'Pembangkit Listrik Tenaga Bayu Lepas Pantai (Offshore Wind)', 'ranah': ['LAUT'],
            'kriteria': {'angin_100m': [6.5, None], 'kedalaman': [None, 45.0], 'jarak_gardu_km': [None, 20.0]},
            'unggulan': {'angin_100m': [7.0, None], 'kedalaman': [None, 45.0], 'jarak_gardu_km': [None, 10.0]},
        },
    },
    'GARAM': {
        'GARAM_TAMBAK': {
            'nama': 'Tambak Garam Modern Berbasis Geomembran', 'ranah': ['DARAT'],
            'kriteria': {'bulan_kering_berturut': [2.5, None], 'curah_hujan': [None, 2500.0], 'tanah_liat': [25.0, None],
                         'kemiringan_lahan': [None, 2.0], 'salinitas': [30.0, None]},
            'unggulan': {'bulan_kering_berturut': [3.5, None], 'curah_hujan': [None, 1750.0], 'tanah_liat': [30.0, None],
                         'kemiringan_lahan': [None, 2.0], 'salinitas': [32.0, None]},
        },
        'GARAM_PEMURNIAN': {
            'nama': 'Pabrik Pemurnian Garam (Washing Plant / Refinery)', 'ranah': ['DARAT'],
            'kriteria': {'jarak_zona_garam_km': [None, 30.0], 'jarak_pelabuhan_ekspor_km': [None, 100.0],
                         'jarak_listrik_km': [None, 3.0], 'jarak_jalan_nasional_km': [None, 3.0], 'kemiringan_lahan': [None, 8.0]},
            'unggulan': {'jarak_zona_garam_km': [None, 10.0], 'jarak_pelabuhan_ekspor_km': [None, 50.0],
                         'jarak_listrik_km': [None, 1.0], 'jarak_jalan_nasional_km': [None, 1.0], 'kemiringan_lahan': [None, 5.0]},
        },
        'GARAM_FORTIFIKASI': {
            'nama': 'Garam Fortifikasi & Pangan', 'ranah': ['DARAT'],
            'kriteria': {'jarak_zona_garam_km': [None, 60.0], 'jarak_pelabuhan_ekspor_km': [None, 60.0],
                         'jarak_listrik_km': [None, 3.0], 'jarak_jalan_nasional_km': [None, 3.0], 'kemiringan_lahan': [None, 8.0]},
            'unggulan': {'jarak_zona_garam_km': [None, 30.0], 'jarak_pelabuhan_ekspor_km': [None, 25.0],
                         'jarak_listrik_km': [None, 1.0], 'jarak_jalan_nasional_km': [None, 1.0], 'kemiringan_lahan': [None, 5.0]},
        },
    },
    'BIOTEKNOLOGI_KELAUTAN': {
        'BIOTEK_KOSMETIK': {
            'nama': 'Kosmetik dan Perawatan Kulit', 'ranah': ['LAUT'],
            'kriteria': {'kd490': [None, 0.15], 'jarak_zona_budidaya_km': [None, 20.0], 'jarak_muara_pelabuhan_km': [5.0, None],
                         'jarak_bandara_lab_km': [None, 150.0], 'shannon': [2.0, None]},
            'unggulan': {'kd490': [None, 0.1], 'jarak_zona_budidaya_km': [None, 10.0], 'jarak_muara_pelabuhan_km': [10.0, None],
                         'jarak_bandara_lab_km': [None, 100.0], 'shannon': [3.0, None]},
        },
        'BIOTEK_FARMASI': {
            'nama': 'Farmasi & Nutrasetikal', 'ranah': ['LAUT'],
            'kriteria': {'karang': [1, None], 'shannon': [2.0, None], 'jarak_muara_pelabuhan_km': [5.0, None],
                         'jarak_bandara_lab_km': [None, 150.0]},
            'unggulan': {'karang': [1, None], 'shannon': [3.0, None], 'jarak_muara_pelabuhan_km': [10.0, None],
                         'jarak_bandara_lab_km': [None, 100.0]},
        },
        'BIOTEK_BIOPLASTIK': {
            'nama': 'Bioplastik Ramah Lingkungan', 'ranah': ['DARAT'],
            'kriteria': {'jarak_zona_budidaya_km': [None, 30.0], 'jarak_pelabuhan_ekspor_km': [None, 100.0],
                         'jarak_listrik_km': [None, 3.0], 'jarak_jalan_nasional_km': [None, 3.0], 'kemiringan_lahan': [None, 8.0]},
            'unggulan': {'jarak_zona_budidaya_km': [None, 15.0], 'jarak_pelabuhan_ekspor_km': [None, 50.0],
                         'jarak_listrik_km': [None, 1.0], 'jarak_jalan_nasional_km': [None, 1.0], 'kemiringan_lahan': [None, 5.0]},
        },
        'BIOTEK_PAKAN_ALAMI': {
            'nama': 'Pakan Alami & Fitoplankton', 'ranah': ['DARAT'],
            'kriteria': {'jarak_dari_pantai_km': [0.1, 2.0], 'ghi': [4.5, None], 'salinitas': [28.0, None],
                         'jarak_muara_km': [3.0, None], 'kemiringan_lahan': [None, 8.0]},
            'unggulan': {'jarak_dari_pantai_km': [0.1, 1.0], 'ghi': [5.0, None], 'salinitas': [30.0, None],
                         'jarak_muara_km': [5.0, None], 'kemiringan_lahan': [None, 5.0]},
        },
    },
    'KONSERVASI_PESISIR': {
        'KONSERVASI_MANGROVE': {
            'nama': 'Restorasi Mangrove untuk Kredit Karbon Biru (Blue Carbon)', 'ranah': ['LAUT', 'DARAT'],
            'kriteria': {'eks_mangrove_mudflat': [1, None], 'intertidal': [1, None], 'luas_hamparan_ha': [100.0, None],
                         'laju_abrasi': [None, 1.5]},
            'unggulan': {'eks_mangrove_mudflat': [1, None], 'intertidal': [1, None], 'luas_hamparan_ha': [250.0, None],
                         'laju_abrasi': [None, 1.0]},
        },
        'KONSERVASI_KARANG': {
            'nama': 'Restorasi Terumbu Karang Berbasis Pariwisata/Eko-Sains', 'ranah': ['LAUT'],
            'kriteria': {'karang': [1, None], 'kedalaman': [1.0, 20.0], 'kd490': [None, 0.15], 'suhu_rata': [26.0, 31.0],
                         'jarak_gerbang_wisata_km': [None, 100.0]},
            'unggulan': {'karang': [1, None], 'kedalaman': [3.0, 15.0], 'kd490': [None, 0.1], 'suhu_rata': [27.0, 30.0],
                         'jarak_gerbang_wisata_km': [None, 60.0]},
        },
        'KONSERVASI_KAWASAN': {
            'nama': 'Pengembangan Kawasan Konservasi Perairan (KKP) Berkelanjutan', 'ranah': ['LAUT'],
            'kriteria': {'karang': [1, None], 'shannon': [2.0, None], 'kd490': [None, 0.15],
                         'jarak_muara_pelabuhan_km': [5.0, None]},
            'unggulan': {'karang': [1, None], 'shannon': [3.0, None], 'kd490': [None, 0.1],
                         'jarak_muara_pelabuhan_km': [10.0, None]},
        },
    },
}
AMBANG_BULAN_KERING_MM = 50

SATUAN_PRODUK_SEKTOR = {
    'PARIWISATA_BAHARI': 'kunjungan', 'JASA_MARITIM': 'layanan', 'INFRASTRUKTUR_LAUT': 'layanan',
    'ENERGI_KELAUTAN': 'MWh', 'KONSERVASI_PESISIR': 'kunjungan',
}
KOMPONEN_INVESTASI = ['Peralatan', 'Sarana dan prasarana', 'Lahan dan bangunan', 'Perizinan KKPRL', 'Perizinan lain']
KOMPONEN_OPERASIONAL = ['Benih, bibit, atau bahan baku', 'Pakan, BBM, atau energi', 'Operasional alat', 'Tenaga kerja',
                        'Lain-lain']
def model_usaha_kosong(jenis, sub=None):
    return {
        'satuan_usaha': '1 unit usaha',
        'satuan_produk': 'ton CO2e' if sub == 'KONSERVASI_MANGROVE' else SATUAN_PRODUK_SEKTOR.get(jenis, 'kg'),
        'harga_per_satuan': None,
        'volume_per_tahun': {'riil': None, 's1': None, 's2': None},
        'investasi': dict.fromkeys(KOMPONEN_INVESTASI),
        'operasional_per_tahun': dict.fromkeys(KOMPONEN_OPERASIONAL),
    }


MODEL_USAHA = {sub: model_usaha_kosong(jenis, sub) for jenis, per_sub in KRITERIA_JENIS.items() for sub in per_sub}
ASUMSI_MODEL_USAHA = {
    'umur_tahun': 10, 'diskonto_persen': 12.0, 'kenaikan_harga_persen': 0.0, 'kenaikan_biaya_persen': 0.0,
    'csr_persen': 2.5, 'batas_pbp_tahun': 10,
}

EKOSISTEM_TERLARANG_SEKTOR = {
    'PERIKANAN_BUDIDAYA': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'ENERGI_KELAUTAN': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'JASA_MARITIM': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'INFRASTRUKTUR_LAUT': ['MANGROVE', 'LAMUN', 'TERUMBU_KARANG'],
    'GARAM': ['MANGROVE'],
    'PENGOLAHAN_HASIL_LAUT': ['MANGROVE'],
}
SEKTOR_BOLEH_DI_ALUR_PELAYARAN = ['JASA_MARITIM', 'INFRASTRUKTUR_LAUT']
BUFFER_UNSUR_TERLARANG_M = {'KABEL': 500.0, 'PIPA': 500.0, 'ALUR_PELAYARAN': 500.0}
AMBANG_IRISAN_PENGECUALIAN_PERSEN = 1.0
AMBANG_IRISAN_TEPI_PERSEN = 2.0
LUAS_AREA_MIN_HA = 0.01
LUAS_AREA_MAKS_HA = 50000


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
