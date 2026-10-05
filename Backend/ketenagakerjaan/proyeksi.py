import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger('ketenagakerjaan')

MATRIKS_KEAHLIAN: Dict[str, List[Dict[str, Any]]] = {
    'PERIKANAN_TANGKAP': [
        {'posisi': 'Nakhoda kapal penangkap ikan', 'pct': 0.06, 'bulan': 6, 'biaya_juta': 12.0,
         'prioritas': 'TINGGI', 'lembaga': 'Politeknik KP / BPPP',
         'skema': 'ANKAPIN/ATKAPIN tingkat II-III'},
        {'posisi': 'Awak kapal perikanan (rating)', 'pct': 0.30, 'bulan': 3, 'biaya_juta': 6.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPPP / Politeknik KP',
         'skema': 'Basic Safety Training kapal layar motor'},
        {'posisi': 'Teknisi mesin & alat tangkap', 'pct': 0.12, 'bulan': 3, 'biaya_juta': 7.0,
         'prioritas': 'TINGGI', 'lembaga': 'BLK / BPPP',
         'skema': 'LSP Perikanan Tangkap'},
        {'posisi': 'Penanganan ikan di atas kapal', 'pct': 0.20, 'bulan': 1, 'biaya_juta': 3.0,
         'prioritas': 'SEDANG', 'lembaga': 'BPPP / Dinas KP',
         'skema': 'Cara Penanganan Ikan yang Baik'},
        {'posisi': 'Pencatat hasil tangkapan (logbook)', 'pct': 0.05, 'bulan': 1, 'biaya_juta': 2.5,
         'prioritas': 'SEDANG', 'lembaga': 'Ditjen Perikanan Tangkap KKP',
         'skema': 'Enumerator logbook penangkapan ikan'},
    ],
    'PERIKANAN_BUDIDAYA': [
        {'posisi': 'Teknisi budidaya (KJA/tambak)', 'pct': 0.28, 'bulan': 3, 'biaya_juta': 6.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPBL / BBPBAP / Politeknik KP',
         'skema': 'LSP Budidaya Perikanan'},
        {'posisi': 'Pengelola kualitas air & pakan', 'pct': 0.15, 'bulan': 2, 'biaya_juta': 5.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPBL / BBPBAP',
         'skema': 'Cara Budidaya Ikan yang Baik (CBIB)'},
        {'posisi': 'Pengendali hama & penyakit ikan', 'pct': 0.08, 'bulan': 2, 'biaya_juta': 6.5,
         'prioritas': 'TINGGI', 'lembaga': 'BKIPM / Balai Karantina Ikan',
         'skema': 'Biosekuriti & kesehatan ikan'},
        {'posisi': 'Operator pembenihan', 'pct': 0.10, 'bulan': 3, 'biaya_juta': 5.5,
         'prioritas': 'SEDANG', 'lembaga': 'BBPBL / BPBAP',
         'skema': 'Cara Pembenihan Ikan yang Baik (CPIB)'},
        {'posisi': 'Pemanenan & penanganan pascapanen', 'pct': 0.15, 'bulan': 1, 'biaya_juta': 3.0,
         'prioritas': 'SEDANG', 'lembaga': 'BPPP / Dinas KP', 'skema': ''},
    ],
    'PENGOLAHAN_HASIL_LAUT': [
        {'posisi': 'Operator lini pengolahan', 'pct': 0.35, 'bulan': 2, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'BLK Industri / BPPP',
         'skema': 'Cara Pengolahan Ikan yang Baik (GMP)'},
        {'posisi': 'Penanggung jawab mutu (HACCP)', 'pct': 0.05, 'bulan': 3, 'biaya_juta': 9.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPPMHKP / BBP2HP',
         'skema': 'HACCP & Sertifikat Kelayakan Pengolahan'},
        {'posisi': 'Teknisi rantai dingin & refrigerasi', 'pct': 0.08, 'bulan': 3, 'biaya_juta': 8.0,
         'prioritas': 'TINGGI', 'lembaga': 'BLK Industri',
         'skema': 'LSP Teknik Refrigerasi'},
        {'posisi': 'Analis laboratorium mutu produk', 'pct': 0.04, 'bulan': 3, 'biaya_juta': 10.0,
         'prioritas': 'SEDANG', 'lembaga': 'BBP2HP / BPOM',
         'skema': 'Pengujian mutu hasil perikanan'},
        {'posisi': 'Pengelola limbah & sanitasi pabrik', 'pct': 0.06, 'bulan': 2, 'biaya_juta': 5.0,
         'prioritas': 'SEDANG', 'lembaga': 'BLK / KLHK',
         'skema': 'Penanggung jawab operasional IPAL'},
    ],
    'PARIWISATA_BAHARI': [
        {'posisi': 'Pemandu wisata selam', 'pct': 0.10, 'bulan': 6, 'biaya_juta': 16.0,
         'prioritas': 'TINGGI', 'lembaga': 'POSSI / SSI / PADI',
         'skema': 'Dive guide + sertifikasi BNSP'},
        {'posisi': 'Pemandu snorkeling & wisata pantai', 'pct': 0.12, 'bulan': 2, 'biaya_juta': 5.0,
         'prioritas': 'TINGGI', 'lembaga': 'LSP Pariwisata',
         'skema': 'Pemandu wisata alam bahari'},
        {'posisi': 'Operator & nakhoda kapal wisata', 'pct': 0.08, 'bulan': 3, 'biaya_juta': 9.0,
         'prioritas': 'TINGGI', 'lembaga': 'Politeknik Pelayaran / KSOP',
         'skema': 'Surat Keterangan Kecakapan + BST'},
        {'posisi': 'Hospitality & tata hidang', 'pct': 0.25, 'bulan': 3, 'biaya_juta': 4.5,
         'prioritas': 'TINGGI', 'lembaga': 'SMK Pariwisata / LSP Pariwisata',
         'skema': 'Sertifikasi kompetensi hotel & restoran'},
        {'posisi': 'Penyelamat pantai & tanggap darurat', 'pct': 0.06, 'bulan': 1, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'Basarnas / PMI',
         'skema': 'Water rescue & pertolongan pertama'},
        {'posisi': 'Interpretasi ekosistem & edukasi', 'pct': 0.05, 'bulan': 2, 'biaya_juta': 4.0,
         'prioritas': 'SEDANG', 'lembaga': 'BKKPN / Balai Konservasi', 'skema': ''},
    ],
    'ENERGI_KELAUTAN': [
        {'posisi': 'Teknisi pembangkit energi laut', 'pct': 0.25, 'bulan': 6, 'biaya_juta': 18.0,
         'prioritas': 'TINGGI', 'lembaga': 'Politeknik Energi / PLN Corporate University',
         'skema': 'LSP Ketenagalistrikan'},
        {'posisi': 'Operator ruang kendali', 'pct': 0.12, 'bulan': 4, 'biaya_juta': 12.0,
         'prioritas': 'TINGGI', 'lembaga': 'PLN Corporate University',
         'skema': 'Operator pembangkit bersertifikat'},
        {'posisi': 'Teknisi pemeliharaan bawah air', 'pct': 0.08, 'bulan': 6, 'biaya_juta': 22.0,
         'prioritas': 'TINGGI', 'lembaga': 'Lembaga selam komersial terakreditasi',
         'skema': 'Commercial diver + inspeksi bawah air'},
        {'posisi': 'Ahli K3 instalasi kelistrikan', 'pct': 0.06, 'bulan': 2, 'biaya_juta': 8.0,
         'prioritas': 'TINGGI', 'lembaga': 'Kemnaker / LSP K3',
         'skema': 'Ahli K3 Listrik'},
        {'posisi': 'Pemantauan lingkungan operasi', 'pct': 0.05, 'bulan': 2, 'biaya_juta': 6.0,
         'prioritas': 'SEDANG', 'lembaga': 'KLHK',
         'skema': 'Pemantauan pelaksanaan RKL-RPL'},
    ],
    'INFRASTRUKTUR_LAUT': [
        {'posisi': 'Pelaksana konstruksi bangunan laut', 'pct': 0.30, 'bulan': 4, 'biaya_juta': 9.0,
         'prioritas': 'TINGGI', 'lembaga': 'BLK Konstruksi / LPJK',
         'skema': 'SKK Konstruksi jenjang 4-6'},
        {'posisi': 'Surveyor hidrografi & batimetri', 'pct': 0.05, 'bulan': 6, 'biaya_juta': 20.0,
         'prioritas': 'TINGGI', 'lembaga': 'Pushidrosal / Politeknik Geomatika',
         'skema': 'Surveyor hidrografi kategori B'},
        {'posisi': 'Penyelam kerja konstruksi', 'pct': 0.06, 'bulan': 3, 'biaya_juta': 18.0,
         'prioritas': 'TINGGI', 'lembaga': 'Lembaga selam komersial terakreditasi',
         'skema': 'Commercial diver kelas 1-2'},
        {'posisi': 'Ahli K3 pekerjaan bawah air', 'pct': 0.05, 'bulan': 2, 'biaya_juta': 9.0,
         'prioritas': 'TINGGI', 'lembaga': 'Kemnaker / LSP K3',
         'skema': 'Ahli K3 Umum + pekerjaan bawah air'},
        {'posisi': 'Operator alat berat maritim', 'pct': 0.10, 'bulan': 2, 'biaya_juta': 7.0,
         'prioritas': 'SEDANG', 'lembaga': 'BLK Konstruksi',
         'skema': 'SIO operator crane / pile driver'},
        {'posisi': 'Pengawas mutu pekerjaan', 'pct': 0.05, 'bulan': 3, 'biaya_juta': 10.0,
         'prioritas': 'SEDANG', 'lembaga': 'LPJK',
         'skema': 'Pengawas pekerjaan konstruksi'},
    ],
    'JASA_MARITIM': [
        {'posisi': 'Operator bongkar muat', 'pct': 0.28, 'bulan': 2, 'biaya_juta': 5.0,
         'prioritas': 'TINGGI', 'lembaga': 'Pelindo Maritime Institute / BLK',
         'skema': 'Operator terminal bersertifikat'},
        {'posisi': 'Operator alat angkat pelabuhan', 'pct': 0.08, 'bulan': 3, 'biaya_juta': 9.0,
         'prioritas': 'TINGGI', 'lembaga': 'Kemnaker / Pelindo',
         'skema': 'SIO crane & forklift'},
        {'posisi': 'Teknisi perawatan kapal', 'pct': 0.12, 'bulan': 4, 'biaya_juta': 8.0,
         'prioritas': 'TINGGI', 'lembaga': 'BLK Perkapalan / Politeknik Perkapalan',
         'skema': 'LSP Perkapalan'},
        {'posisi': 'Administrasi kepelabuhanan & dokumen', 'pct': 0.10, 'bulan': 2, 'biaya_juta': 4.5,
         'prioritas': 'SEDANG', 'lembaga': 'Politeknik Pelayaran / KSOP',
         'skema': 'Ketatalaksanaan angkutan laut'},
        {'posisi': 'Petugas keamanan fasilitas pelabuhan', 'pct': 0.07, 'bulan': 1, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'KSOP / Ditjen Perhubungan Laut',
         'skema': 'Port Facility Security Officer (ISPS Code)'},
    ],
    'GARAM': [
        {'posisi': 'Petugas produksi lahan garam', 'pct': 0.35, 'bulan': 1, 'biaya_juta': 2.5,
         'prioritas': 'TINGGI', 'lembaga': 'Dinas KP / BPPP',
         'skema': 'Cara Produksi Garam yang Baik'},
        {'posisi': 'Operator geomembran & kristalisasi', 'pct': 0.12, 'bulan': 2, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'Ditjen PDSPKP KKP', 'skema': ''},
        {'posisi': 'Operator pencucian & iodisasi', 'pct': 0.10, 'bulan': 2, 'biaya_juta': 4.5,
         'prioritas': 'TINGGI', 'lembaga': 'BLK Industri',
         'skema': 'SNI garam konsumsi beriodium'},
        {'posisi': 'Pengendali mutu garam industri', 'pct': 0.05, 'bulan': 3, 'biaya_juta': 6.5,
         'prioritas': 'SEDANG', 'lembaga': 'Balai Standardisasi / BSN',
         'skema': 'Pengujian kadar NaCl & air'},
    ],
    'BIOTEKNOLOGI_KELAUTAN': [
        {'posisi': 'Analis laboratorium bioteknologi', 'pct': 0.25, 'bulan': 6, 'biaya_juta': 22.0,
         'prioritas': 'TINGGI', 'lembaga': 'BRIN / perguruan tinggi',
         'skema': 'Analis laboratorium bersertifikat'},
        {'posisi': 'Teknisi kultur & fermentasi', 'pct': 0.18, 'bulan': 4, 'biaya_juta': 14.0,
         'prioritas': 'TINGGI', 'lembaga': 'BRIN / Politeknik',
         'skema': 'Kultur mikroalga & bioproses'},
        {'posisi': 'Operator ekstraksi senyawa aktif', 'pct': 0.12, 'bulan': 3, 'biaya_juta': 11.0,
         'prioritas': 'TINGGI', 'lembaga': 'BBP2HP / BRIN', 'skema': ''},
        {'posisi': 'Penjaminan mutu & registrasi produk', 'pct': 0.06, 'bulan': 3, 'biaya_juta': 12.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPOM',
         'skema': 'CPOTB/CPKB & registrasi produk'},
        {'posisi': 'Pengelola keamanan hayati laboratorium', 'pct': 0.04, 'bulan': 2,
         'biaya_juta': 9.0, 'prioritas': 'SEDANG', 'lembaga': 'BRIN / Kemenkes',
         'skema': 'Biosafety level 2'},
    ],
    'KONSERVASI_PESISIR': [
        {'posisi': 'Teknisi rehabilitasi mangrove', 'pct': 0.25, 'bulan': 2, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPSPL / BRGM',
         'skema': 'Pembibitan & penanaman mangrove'},
        {'posisi': 'Teknisi transplantasi terumbu karang', 'pct': 0.12, 'bulan': 3,
         'biaya_juta': 12.0, 'prioritas': 'TINGGI', 'lembaga': 'BKKPN / BPSPL',
         'skema': 'Scientific diver + transplantasi karang'},
        {'posisi': 'Pemantau ekosistem & pendataan', 'pct': 0.12, 'bulan': 2, 'biaya_juta': 5.0,
         'prioritas': 'TINGGI', 'lembaga': 'BPSPL / BRIN',
         'skema': 'Monitoring kesehatan ekosistem pesisir'},
        {'posisi': 'Fasilitator masyarakat pesisir', 'pct': 0.15, 'bulan': 2, 'biaya_juta': 4.0,
         'prioritas': 'TINGGI', 'lembaga': 'Dinas KP / LSM konservasi',
         'skema': 'Pendampingan kelompok masyarakat'},
        {'posisi': 'Pengawas kawasan konservasi', 'pct': 0.06, 'bulan': 3, 'biaya_juta': 7.0,
         'prioritas': 'SEDANG', 'lembaga': 'BKKPN / Ditjen PSDKP',
         'skema': 'Pengawas perikanan'},
    ],
    'DEFAULT': [
        {'posisi': 'Keterampilan dasar kelautan', 'pct': 0.25, 'bulan': 3, 'biaya_juta': 4.5,
         'prioritas': 'SEDANG', 'lembaga': 'BLK Daerah / BPPP', 'skema': ''},
        {'posisi': 'K3 & keselamatan kerja di perairan', 'pct': 0.15, 'bulan': 1, 'biaya_juta': 3.5,
         'prioritas': 'TINGGI', 'lembaga': 'Kemnaker / LSP K3',
         'skema': 'Basic Safety Training'},
    ],
}


def _matriks(sektor_kode: str) -> List[Dict[str, Any]]:
    try:
        from .models import MatriksKeahlianSektor

        baris = list(
            MatriksKeahlianSektor.objects.filter(
                labor_coefficient__sektor__kode=sektor_kode
            ).order_by('-pct_demand')
        )
        if baris:
            return [
                {
                    'posisi': b.nama_posisi,
                    'pct': b.pct_demand,
                    'bulan': b.durasi_pelatihan_bulan,
                    'biaya_juta': b.estimasi_biaya_per_orang_juta,
                    'prioritas': b.prioritas,
                    'lembaga': b.lembaga_pelatihan_rekomendasi,
                    'skema': b.skema_sertifikasi,
                }
                for b in baris
            ]
    except Exception as e:
        logger.debug(f'[Ketenagakerjaan] Matriks DB tidak terpakai untuk {sektor_kode}: {e}')
    return MATRIKS_KEAHLIAN.get(sektor_kode, MATRIKS_KEAHLIAN['DEFAULT'])


def kode_sektor(nilai: str) -> str:
    teks = str(nilai or '').strip()
    if not teks:
        return 'DEFAULT'
    if teks in MATRIKS_KEAHLIAN:
        return teks

    slug = teks.upper().replace(' ', '_').replace('-', '_')
    while '__' in slug:
        slug = slug.replace('__', '_')
    if slug in MATRIKS_KEAHLIAN:
        return slug

    try:
        from inti.models import SektorInvestasi

        if SektorInvestasi.objects.filter(kode=slug).exists():
            return slug
        kode = SektorInvestasi.objects.values_list('kode', flat=True).filter(nama__iexact=teks).first()
        if kode:
            return kode
    except Exception as e:
        logger.debug(f'[Ketenagakerjaan] Pencocokan nama sektor gagal untuk {teks!r}: {e}')
    return 'DEFAULT'


def _nama_sektor(sektor_kode: str) -> str:
    try:
        from inti.models import SektorInvestasi

        return SektorInvestasi.objects.values_list('nama', flat=True).get(kode=sektor_kode)
    except Exception:
        return sektor_kode


def kebutuhan_pelatihan(sektor_kode: str, total_tk: Optional[int]) -> List[Dict[str, Any]]:
    hasil = []
    for m in _matriks(sektor_kode):
        peserta = max(1, round(total_tk * m['pct'])) if total_tk else None
        hasil.append({
            'keahlian': m['posisi'],
            'durasi_bulan': m['bulan'],
            'prioritas': m['prioritas'],
            'lembaga': m['lembaga'],
            'skema': m['skema'],
            'bagian_dari_total_pct': round(m['pct'] * 100, 1),
            'biaya_per_orang_juta': m['biaya_juta'],
            'jumlah_peserta': peserta,
            'estimasi_biaya_juta': round(peserta * m['biaya_juta'], 1) if peserta else None,
        })
    return hasil


def hitung_proyeksi_tk(
    sektor_kode: str = 'DEFAULT',
    serapan_dimasukkan: Optional[float] = None,
) -> Dict[str, Any]:
    sektor_kode = kode_sektor(sektor_kode)

    total_tk = None
    if serapan_dimasukkan is not None and float(serapan_dimasukkan) > 0:
        total_tk = int(serapan_dimasukkan)

    pelatihan = kebutuhan_pelatihan(sektor_kode, total_tk)
    biaya = [p['estimasi_biaya_juta'] for p in pelatihan if p['estimasi_biaya_juta']]

    logger.info(
        f'[Ketenagakerjaan] {sektor_kode}: serapan '
        f'{total_tk if total_tk is not None else "belum diisi"}, '
        f'{len(pelatihan)} kebutuhan pelatihan'
    )

    return {
        'total_tenaga_kerja': total_tk,
        'asal_angka': 'dimasukkan pengguna' if total_tk is not None else 'belum diisi',
        'sektor': sektor_kode,
        'sektor_nama': _nama_sektor(sektor_kode),
        'kebutuhan_pelatihan': pelatihan,
        'total_biaya_pelatihan_juta': round(sum(biaya), 1) if biaya else None,
        'bagian_posisi_asumsi': True,
    }
