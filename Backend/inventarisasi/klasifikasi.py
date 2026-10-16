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

# Matriks RZWP3K yang mengelompokkan butir di bawah judul jenis investasi disimpan sebagai "Judul: kegiatan";
# judul itu menentukan jenis investasinya, bukan kata kunci.
JUDUL_SEKTOR = {
    'perikanan tangkap': ('PERIKANAN_TANGKAP',),
    'perikanan budidaya': ('PERIKANAN_BUDIDAYA',),
    'wisata bahari': ('PARIWISATA_BAHARI',),
    'jasa maritim & kepelabuhanan': ('JASA_MARITIM',),
    'jasa maritim & kepelabuhan': ('JASA_MARITIM',),
    'infrastruktur & bangunan laut': ('INFRASTRUKTUR_LAUT',),
    'energi & sumber daya non-hayati': ('ENERGI_KELAUTAN',),
    'bioteknologi kelautan': ('BIOTEKNOLOGI_KELAUTAN',),
    'konservasi & rehabilitasi pesisir': ('KONSERVASI_PESISIR',),
    'pengolahan & hilirisasi hasil laut': ('PENGOLAHAN_HASIL_LAUT',),
    'produksi garam': ('GARAM',),
    'semua jenis investasi': tuple(KATA_SEKTOR),
}
# Judul yang juga memuat kegiatan di luar jenis investasinya (pertambangan, perusakan habitat): butirnya dihitung
# hanya bila kata kunci jenis investasinya cocok.
JUDUL_LUAS = {'ENERGI_KELAUTAN', 'KONSERVASI_PESISIR'}
# Larangan atas cara yang ilegal atau merusak, bukan atas jenis investasinya.
LARANGAN_PRAKTIK = re.compile(
    r'peledak|beracun|\bbius\b|potas|perusak|kerusakan|tidak ramah lingkungan|dilindungi|sampah|limbah|dumping'
    r'|pencemaran|mencemari'
)
SEMUA_TERBATAS = re.compile(r'\b(?:selain|saat|di area|di luar)\b')


def pecah_judul(butir):
    """(jenis investasi, isi) bila butir berawalan judul sektor matriks; selain itu (None, butir)."""
    judul, pemisah, isi = butir.partition(': ')
    sektor = JUDUL_SEKTOR.get(judul.strip().lower()) if pemisah else None
    return (sektor, isi) if sektor else (None, butir)


def _milik(butir, kode, pola, larangan):
    sektor, isi = pecah_judul(butir)
    teks = isi.lower()
    if sektor is None:
        return bool(pola.search(teks)) and not LARANGAN_UMUM.search(teks)
    if larangan and (LARANGAN_UMUM.search(teks) or LARANGAN_PRAKTIK.search(teks)):
        return False
    return kode in sektor and (len(sektor) > 1 or kode not in JUDUL_LUAS or bool(pola.search(teks)))


def rincian_kegiatan(matriks, kode):
    pola = re.compile(KATA_SEKTOR[kode])
    return {
        status: list(dict.fromkeys(
            k for b in getattr(matriks, kolom) for k in re.split(r'\s*;\s*', b.strip(' ;'))
            if _milik(k, kode, pola, status == 'TIDAK_DIIZINKAN')
        ))
        for status, kolom in KOLOM_MATRIKS
    }


def _larangan_menyeluruh(butir):
    sektor, isi = pecah_judul(butir)
    isi = isi.lower()
    return bool(SEMUA_KEGIATAN.match(isi)) and not (sektor and SEMUA_TERBATAS.search(isi))


def status_rincian(rincian):
    boleh, syarat, larang = (rincian[s] for s, _ in KOLOM_MATRIKS)
    if any(_larangan_menyeluruh(b) for b in larang) or (larang and not boleh and not syarat):
        return 'TIDAK_DIIZINKAN'
    if syarat or larang:
        return 'BERSYARAT'
    return 'DIIZINKAN' if boleh else None


def _sebut(daftar, batas=3):
    return '; '.join(daftar[:batas]) + (f'; dan {len(daftar) - batas} lainnya' if len(daftar) > batas else '')


def syarat_rincian(rincian, khusus=''):
    boleh, syarat, larang = (rincian[s] for s, _ in KOLOM_MATRIKS)
    if larang:
        return (f'Hanya rincian kegiatan tertentu yang diperbolehkan menurut matriks KKPRL: {len(boleh)} diperbolehkan, '
                f'{len(syarat)} bersyarat, dan {len(larang)} tidak diperbolehkan ({_sebut(larang, 2)}).')
    if boleh:
        return (f'{len(boleh)} rincian kegiatan diperbolehkan, sedangkan yang bersyarat menurut matriks KKPRL: '
                f'{_sebut(syarat)}.')
    return khusus or f'Seluruh {len(syarat)} rincian kegiatan diperbolehkan bersyarat menurut matriks KKPRL.'


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
