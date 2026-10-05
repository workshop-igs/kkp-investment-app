PETA_KAWASAN = [
    ('strategis nasional tertentu', 'KST'),
    ('ksnt', 'KST'),
    ('strategis nasional', 'KSN'),
    ('ksn', 'KSN'),
    ('konservasi', 'ZL'),
    ('alur', 'ALKI'),
    ('pemanfaatan umum', 'ZU'),
    ('kpu', 'ZU'),
]

PETA_ZONA = [
    ('belum diatur', 'BELUM_DIATUR'),
    ('tangkap', 'PERIKANAN_TANGKAP'),
    ('budi', 'PERIKANAN_BUDIDAYA'),
    ('mangrove', 'MANGROVE'),
    ('pelabuhan', 'PELAYARAN'),
    ('pelayaran', 'PELAYARAN'),
    ('alur', 'PELAYARAN'),
    ('energi', 'ENERGI'),
    ('listrik', 'ENERGI'),
    ('wisata', 'PARIWISATA'),
    ('konservasi', 'KONSERVASI'),
    ('lindung', 'KONSERVASI'),
    ('taman nasional', 'KONSERVASI'),
    ('suaka', 'KONSERVASI'),
    ('tambang', 'PERTAMBANGAN'),
    ('migas', 'PERTAMBANGAN'),
    ('minyak', 'PERTAMBANGAN'),
    ('industri', 'INDUSTRI'),
    ('pertahanan', 'PERTAHANAN_KEAMANAN'),
    ('keamanan', 'PERTAHANAN_KEAMANAN'),
    ('hankam', 'PERTAHANAN_KEAMANAN'),
    ('latihan militer', 'PERTAHANAN_KEAMANAN'),
    ('infrastruktur', 'INFRASTRUKTUR'),
    ('bandar', 'INFRASTRUKTUR'),
    ('pipa', 'INFRASTRUKTUR'),
    ('kabel', 'INFRASTRUKTUR'),
    ('ekosistem pesisir', 'EKOSISTEM_PESISIR'),
    ('eksosistem pesisir', 'EKOSISTEM_PESISIR'),
    ('karbon biru', 'EKOSISTEM_PESISIR'),
    ('permukiman', 'PERMUKIMAN'),
    ('garam', 'PERGARAMAN'),
    ('dumping', 'DUMPING'),
    ('taman', 'KONSERVASI'),
    ('pendaratan ikan', 'PELAYARAN'),
    ('suci laut', 'KAWASAN_SUCI'),
    ('pura ', 'KAWASAN_SUCI'),
    ('tidak dibagi', 'TIDAK_DIBAGI'),
    ('transportasi', 'PELAYARAN'),
    ('pengerukan', 'DUMPING'),
    ('perikanan', 'PERIKANAN'),
]


def cocokkan(teks, tabel, bawaan):
    rendah = (teks or '').lower()
    for kata, kode in tabel:
        if kata in rendah:
            return kode
    return bawaan


def jenis_kawasan(teks):
    return cocokkan(teks, PETA_KAWASAN, 'ZU')


def sub_zona(teks, jenis):
    hasil = cocokkan(teks, PETA_ZONA, 'LAINNYA')
    if hasil == 'LAINNYA' and jenis == 'ZL':
        return 'KONSERVASI'
    return hasil


PETA_UNSUR_RTRL = [
    ('kabel', 'KABEL'),
    ('pipa', 'PIPA'),
    ('migrasi', 'MIGRASI_BIOTA'),
    ('alur pelayaran', 'ALUR_PELAYARAN'),
    ('alur laut', 'ALUR_PELAYARAN'),
    ('alki', 'ALUR_PELAYARAN'),
    ('ksnt', 'KSNT'),
    ('strategis nasional tertentu', 'KSNT'),
]


def jenis_unsur(*teks):
    gabungan = ' '.join(t for t in teks if t).lower()
    for kata, kode in PETA_UNSUR_RTRL:
        if kata in gabungan:
            return kode
    return 'LAINNYA'
