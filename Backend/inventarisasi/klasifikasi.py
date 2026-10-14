import re

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


PETA_KAWASAN_DARAT = [
    ('mangrove', 'DARAT_MANGROVE'),
    ('badan air', 'DARAT_LINDUNG'),
    ('lindung', 'DARAT_LINDUNG'),
    ('perlindungan', 'DARAT_LINDUNG'),
    ('konservasi', 'DARAT_LINDUNG'),
    ('sempadan', 'DARAT_LINDUNG'),
    ('cagar', 'DARAT_LINDUNG'),
    ('rawan', 'DARAT_LINDUNG'),
    ('suaka', 'DARAT_LINDUNG'),
    ('taman', 'DARAT_LINDUNG'),
    ('resapan', 'DARAT_LINDUNG'),
    ('garam', 'DARAT_PERGARAMAN'),
    ('perikanan', 'DARAT_PERIKANAN'),
    ('tambak', 'DARAT_PERIKANAN'),
    ('industri', 'DARAT_INDUSTRI'),
    ('wisata', 'DARAT_PARIWISATA'),
    ('transportasi', 'DARAT_TRANSPORTASI'),
    ('pelabuhan', 'DARAT_TRANSPORTASI'),
    ('bandar', 'DARAT_TRANSPORTASI'),
    ('permukiman', 'DARAT_PERMUKIMAN'),
    ('pemukiman', 'DARAT_PERMUKIMAN'),
    ('perkotaan', 'DARAT_PERMUKIMAN'),
    ('perdesaan', 'DARAT_PERMUKIMAN'),
    ('pertanian', 'DARAT_PERTANIAN'),
    ('sawah', 'DARAT_PERTANIAN'),
    ('pangan', 'DARAT_PERTANIAN'),
    ('hortikultura', 'DARAT_PERTANIAN'),
    ('perkebunan', 'DARAT_PERKEBUNAN'),
    ('hutan', 'DARAT_HUTAN_PRODUKSI'),
    ('tambang', 'DARAT_PERTAMBANGAN'),
    ('energi', 'DARAT_PERTAMBANGAN'),
    ('pertahanan', 'DARAT_PERTAHANAN'),
    ('keamanan', 'DARAT_PERTAHANAN'),
]

SUB_ZONA_DARAT_LINDUNG = ('DARAT_LINDUNG', 'DARAT_MANGROVE')


def kawasan_darat(namobj, jnsrpr=''):
    hasil = cocokkan(namobj, PETA_KAWASAN_DARAT, None)
    if hasil is None:
        hasil = 'DARAT_LINDUNG' if str(jnsrpr).startswith('31') else 'DARAT_LAINNYA'
    return hasil, 'KL' if hasil in SUB_ZONA_DARAT_LINDUNG else 'KB'


KATA_SEKTOR = {
    'PERIKANAN_TANGKAP': r'penangkapan (?:ikan|pisces|krustasea|moluska)|perikanan tangkap',
    'PERIKANAN_BUDIDAYA': r'budi ?daya|pembesaran|pembenihan|keramba|rumput laut',
    'PENGOLAHAN_HASIL_LAUT': r'pengolahan (?:ikan|hasil)|pembekuan|industri (?:pengolahan|perikanan)',
    'PARIWISATA_BAHARI': r'wisata',
    'JASA_MARITIM': r'kepelabuhan|pelayanan (?:jasa )?(?:pelabuhan|kapal)|tambat|labuh|pemanduan|bongkar muat|angkutan laut',
    'INFRASTRUKTUR_LAUT': r'pembangunan (?:dermaga|jett?y|pelabuhan|breakwater|pemecah gelombang|tanggul|turap|groin)'
                          r'|konstruksi bangunan|reklamasi',
    'ENERGI_KELAUTAN': r'pembangkit|energi|tenaga listrik|otec|turbin',
    'GARAM': r'garam',
    'BIOTEKNOLOGI_KELAUTAN': r'bioteknologi|biofarmak',
    'KONSERVASI_PESISIR': r'rehabilitasi|restorasi|transplantasi|konservasi|penanaman (?:mangrove|bakau|lamun)',
}
PENANDA_MATRIKS = 'Lampiran Matriks KKPRL'
KOLOM_MATRIKS = (('DIIZINKAN', 'diperbolehkan'), ('BERSYARAT', 'bersyarat'), ('TIDAK_DIIZINKAN', 'tidak_diperbolehkan'))
LARANGAN_UMUM = re.compile(
    r'kegiatan lain|yang dilarang|tidak sesuai (?:dengan )?(?:peraturan|ketentuan)|merusak|mengurangi nilai|mengg?angg?u'
)
SEMUA_KEGIATAN = re.compile(r'^semua\b(?!.*\bkecuali\b)')


def rincian_kegiatan(matriks, kode):
    pola = re.compile(KATA_SEKTOR[kode])
    return {
        status: list(dict.fromkeys(
            k for b in getattr(matriks, kolom) for k in re.split(r'\s*;\s*', b.strip(' ;'))
            if pola.search(k.lower()) and not LARANGAN_UMUM.search(k.lower())
        ))
        for status, kolom in KOLOM_MATRIKS
    }


def status_rincian(rincian):
    boleh, syarat, larang = (rincian[s] for s, _ in KOLOM_MATRIKS)
    if any(SEMUA_KEGIATAN.match(b.lower()) for b in larang) or (larang and not boleh and not syarat):
        return 'TIDAK_DIIZINKAN'
    if syarat or larang:
        return 'BERSYARAT'
    return 'DIIZINKAN' if boleh else None


def syarat_rincian(rincian, khusus=''):
    jumlah = {s: len(rincian[s]) for s, _ in KOLOM_MATRIKS}
    if jumlah['TIDAK_DIIZINKAN']:
        return (f"Hanya rincian kegiatan tertentu yang diperbolehkan menurut matriks KKPRL: {jumlah['DIIZINKAN']} "
                f"diperbolehkan, {jumlah['BERSYARAT']} bersyarat, dan {jumlah['TIDAK_DIIZINKAN']} tidak diperbolehkan.")
    return khusus or 'Diperbolehkan bersyarat menurut matriks KKPRL.'


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
