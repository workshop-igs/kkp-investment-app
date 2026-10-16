import json
import math
import time

from django.db import DatabaseError

from analitik.services import konstanta

PETA, SKOR = 'peta', 'skor'

KELOMPOK = [
    ('karakter', 'Karakter lokasi per jenis investasi'),
    ('peta', 'Peta Sebaran Lokasi Indikatif Lolos Penyaringan'),
    ('analisis_area', 'Analisis area'),
    ('finansial', 'Analisis finansial'),
    ('ahp', 'Skor AHP dan keputusan kelayakan'),
    ('lokasi_risiko', 'Skor lokasi dan risiko'),
    ('skor_zona', 'Skor kelayakan zona'),
]


def _d(kunci, kelompok, label, keterangan='', satuan='', dampak=(), batas=(0, None), jumlah_satu=False,
       kolom=None, baris=None, bulat=False):
    return {
        'kunci': kunci, 'kelompok': kelompok, 'label': label, 'keterangan': keterangan, 'satuan': satuan,
        'dampak': list(dampak), 'batas': list(batas), 'jumlah_satu': jumlah_satu, 'kolom': kolom, 'baris': baris,
        'bulat': bulat,
    }


BOBOT = dict(batas=(0, 1), jumlah_satu=True)
SKOR_0_1 = dict(batas=(0, 1))

DAFTAR = [
    _d('KARAKTER_LOKASI', 'karakter', 'Syarat karakter lokasi',
       'Syarat fisik per jenis investasi di perairan dan di darat. Peta Sebaran hanya menampilkan lokasi yang '
       'memenuhi salah satu alternatif syarat; pada screening area syarat ini menjadi kecocokan fisik indikatif '
       '(peringatan), bukan gerbang kesesuaian ruang.', dampak=(PETA, SKOR)),
    _d('RADIUS_EKOSISTEM_PENDUKUNG_M', 'karakter', 'Radius ekosistem pendukung',
       'Syarat ekosistem pendukung (mangrove, lamun, terumbu karang) terpenuhi bila ekosistem itu berada di dalam '
       'lokasi atau dalam radius ini darinya, sehingga area di samping ekosistem dinilai sama dengan lokasi yang '
       'menyentuhnya. Syarat bebas terumbu karang dan lamun tetap memakai irisan langsung.', 'm', (PETA,),
       (0, 5000), bulat=True),
    _d('PARAMETER_TAMBAHAN', 'karakter', 'Parameter penilaian tambahan per jenis',
       'Parameter yang ikut dihitung dalam persentase sangat sesuai, tetapi tidak menggugurkan lokasi. Semuanya '
       'dari data publik; parameter yang datanya belum pernah ditarik ke aplikasi dilewati.',
       dampak=(PETA,)),
    _d('BUFFER_UNSUR_TERLARANG_M', 'karakter', 'Jarak aman kabel, pipa, dan alur pelayaran',
       'Pengecualian keras: lokasi tidak boleh berada dalam jarak ini dari kabel bawah laut, pipa bawah laut, dan '
       'alur pelayaran pada Rencana Tata Ruang Laut.', 'm', (PETA,), (0, 20000)),
    _d('AMBANG_IRISAN_PENGECUALIAN_PERSEN', 'analisis_area', 'Toleransi irisan pengecualian pada screening',
       'Pada screening area, irisan dengan kawasan konservasi, alur pelayaran/ALKI, ekosistem sensitif, atau jarak '
       'aman kabel/pipa/alur yang lebih kecil dari bagian ini ditandai perlu verifikasi batas dan tidak '
       'menggugurkan area.', '%', (), (0, 100)),
    _d('AMBANG_IRISAN_TEPI_PERSEN', 'analisis_area', 'Toleransi irisan tepi zona pada screening',
       'Zona yang tidak mengizinkan jenis investasi (atau belum memiliki ketentuan) dan KKPRL terbit yang hanya '
       'mengiris area lebih kecil dari bagian ini ditandai perlu verifikasi batas, bukan langsung menggugurkan; '
       'batas peta tata ruang skala 1:50.000-1:250.000 dapat bergeser puluhan hingga ratusan meter.', '%', (),
       (0, 50)),
    _d('LUAS_AREA_MIN_HA', 'analisis_area', 'Luas area paling kecil',
       'Area yang digambar atau diunggah harus seluas ini atau lebih.', 'ha', (), (0, 100)),
    _d('LUAS_AREA_MAKS_HA', 'analisis_area', 'Luas area paling besar',
       'Area yang lebih luas ditolak; pecah menjadi beberapa area proyek.', 'ha', (), (1, 10000000)),
    _d('AMBANG_BULAN_KERING_MM', 'karakter', 'Batas curah hujan bulan kering',
       'Bulan dengan curah hujan di bawah ini dihitung bulan kering (parameter tambak garam).', 'mm/bulan', (PETA,),
       (0, 500)),
    _d('AMBANG_KECOCOKAN', 'peta', 'Ambang persentase parameter sangat sesuai',
       'Bagian parameter dinilai yang terukur dan harus sangat sesuai agar sebuah sel menjadi lokasi indikatif '
       'lolos penyaringan.',
       'proporsi (0-1)', (PETA,), (0, 1)),
    _d('MINIMAL_PARAMETER_TERUKUR', 'peta', 'Jumlah minimal parameter terukur',
       'Dihitung dari parameter dinilai saja; syarat dasar yang pasti terpenuhi tidak ikut dihitung.', 'parameter',
       (PETA,), (1, 30), bulat=True),
    _d('WAJIB_LENGKAP_BERSYARAT', 'peta', 'Zona peruntukan lain: seluruh parameter wajib terukur',
       'Lokasi di zona yang peruntukannya untuk kegiatan lain dan hanya mengizinkan jenis itu bersyarat direkomendasikan '
       'hanya bila seluruh parameter selain tata ruang terukur.', dampak=(PETA,)),
    _d('AMBANG_KECOCOKAN_BERSYARAT', 'peta', 'Zona peruntukan lain: ambang parameter sangat sesuai',
       'Bagian parameter selain tata ruang yang harus sangat sesuai untuk lokasi di zona peruntukan lain yang hanya '
       'mengizinkan bersyarat; 1 berarti semuanya.',
       'proporsi (0-1)', (PETA,), (0, 1)),
    _d('JARAK_ANTAR_LOKASI_KM', 'peta', 'Jarak minimal antartitik lokasi',
       'Dalam radius ini hanya lokasi terbaik yang ditampilkan.', 'km', (PETA,), (0, 200)),
    _d('SEL_PER_SISI_INTI_LOKASI', 'peta', 'Ukuran inti lokasi',
       'Jumlah sel 250 m per sisi; 4 berarti inti paling luas 1 km x 1 km.', 'sel', (PETA,), (1, 20), bulat=True),
    _d('INFRASTRUKTUR_AKSESIBILITAS', 'peta', 'Jarak infrastruktur pendukung',
       'Syarat dasar peta: lokasi wajib berada dalam jarak ideal salah satu infrastruktur; bobot dan jarak maksimum '
       'dipakai skor aksesibilitas.', dampak=(PETA, SKOR),
       kolom=['Kategori', 'Bobot', 'Jarak ideal (km)', 'Jarak maksimum (km)']),
    _d('AMBANG_CAKUPAN_ACUAN', 'analisis_area', 'Cakupan minimal acuan tata ruang',
       'Bagian area yang harus tercakup acuan tata ruang agar kesesuaian dapat diverifikasi.', 'proporsi (0-1)',
       (PETA,), (0, 1)),
    _d('RADIUS_LOKASI_ALTERNATIF_KM', 'analisis_area', 'Radius pencarian lokasi alternatif', '', 'km', (),
       (1, 1000)),
    _d('JUMLAH_LOKASI_ALTERNATIF', 'analisis_area', 'Jumlah lokasi alternatif', '', 'lokasi', (), (1, 20),
       bulat=True),
    _d('FINANCIAL_WEIGHTS', 'finansial', 'Bobot indikator finansial', '', **BOBOT),
    _d('BATAS_ATAS_IRR_PERSEN', 'finansial', 'IRR untuk skor penuh', '', '%', batas=(1, 200)),
    _d('PAYBACK_THRESHOLDS', 'finansial', 'Ambang masa pengembalian modal', '', 'tahun', batas=(0, 100)),
    _d('ROI_CEILING_PCT', 'finansial', 'ROI untuk skor penuh', '', '%', batas=(1, 10000)),
    _d('FAKTOR_NORMALISASI_NPV', 'finansial', 'Faktor normalisasi NPV',
       'NPV sebesar faktor ini dikali nilai investasi memperoleh skor penuh.', batas=(0.01, 100)),
    _d('PROFIT_RATIO_CEILING', 'finansial', 'Rasio laba untuk skor prediksi penuh', '', 'kali investasi',
       batas=(0.01, 100)),
    _d('SENSITIVITAS_FINANSIAL', 'finansial', 'Langkah uji sensitivitas', '', 'proporsi', batas=(-1, 1)),
    _d('BEST_CASE_REVENUE_MULTIPLIER', 'finansial', 'Skenario terbaik: pengali pendapatan', '', 'kali', batas=(0, 5)),
    _d('BEST_CASE_OPEX_MULTIPLIER', 'finansial', 'Skenario terbaik: pengali biaya operasi', '', 'kali', batas=(0, 5)),
    _d('WORST_CASE_REVENUE_MULTIPLIER', 'finansial', 'Skenario terburuk: pengali pendapatan', '', 'kali',
       batas=(0, 5)),
    _d('WORST_CASE_OPEX_MULTIPLIER', 'finansial', 'Skenario terburuk: pengali biaya operasi', '', 'kali',
       batas=(0, 5)),
    _d('MATRIKS_PERBANDINGAN_BAWAAN', 'ahp', 'Matriks perbandingan berpasangan AHP',
       'Baris dibandingkan dengan kolom (skala Saaty 1/9 sampai 9); bobot kriteria dihitung dari matriks ini dan '
       'konsistensinya wajib di bawah ambang.', batas=(1 / 9, 9),
       kolom=['Finansial', 'Risiko', 'Lokasi', 'Prediksi', 'Rekomendasi'],
       baris=['Finansial', 'Risiko', 'Lokasi', 'Prediksi', 'Rekomendasi']),
    _d('AMBANG_KONSISTENSI_AHP', 'ahp', 'Ambang rasio konsistensi (CR)', '', batas=(0.01, 0.5)),
    _d('RECOMMENDATION_WEIGHTS', 'ahp', 'Bobot skor rekomendasi', '', **BOBOT),
    _d('DECISION_THRESHOLDS', 'ahp', 'Ambang keputusan kelayakan', '', batas=(0, 1)),
    _d('PRIORITY_THRESHOLDS', 'ahp', 'Ambang prioritas', '', **SKOR_0_1),
    _d('RISK_CLASS_THRESHOLDS', 'ahp', 'Ambang kelas risiko investasi', 'Rata-rata risiko paling tinggi tiap kelas.',
       dampak=(SKOR,), **SKOR_0_1),
    _d('RISK_WEIGHTS', 'lokasi_risiko', 'Bobot komponen risiko', '', dampak=(SKOR,), **BOBOT),
    _d('LOCATION_WEIGHTS', 'lokasi_risiko', 'Bobot komponen lokasi', '', dampak=(SKOR,), **BOBOT),
    _d('TATA_RUANG_PASS_SCORE', 'lokasi_risiko', 'Skor tata ruang bila sesuai', '', dampak=(SKOR,), **SKOR_0_1),
    _d('TATA_RUANG_FAIL_SCORE', 'lokasi_risiko', 'Skor tata ruang bila tidak sesuai', '', dampak=(SKOR,),
       **SKOR_0_1),
    _d('REGULASI_PENALTY', 'lokasi_risiko', 'Tambahan risiko regulasi', '', dampak=(SKOR,), **SKOR_0_1),
    _d('KELAS_RISIKO_SCORE', 'lokasi_risiko', 'Skor risiko per kelas InaRISK', '', dampak=(SKOR,), **SKOR_0_1),
    _d('HAZARD_OPERASIONAL_WEIGHTS', 'lokasi_risiko', 'Bobot bencana untuk risiko operasional', '',
       dampak=(SKOR,), **BOBOT),
    _d('HAZARD_LINGKUNGAN_WEIGHTS', 'lokasi_risiko', 'Bobot bencana untuk risiko lingkungan', '',
       dampak=(SKOR,), **BOBOT),
    _d('TINGKAT_POTENSI_SCORE', 'lokasi_risiko', 'Skor per tingkat potensi sumber daya', '', dampak=(SKOR,),
       **SKOR_0_1),
    _d('AKSESIBILITAS_PELABUHAN_IDEAL_KM', 'lokasi_risiko', 'Jarak ideal ke pelabuhan', '', 'km', (SKOR,),
       (0, 1000)),
    _d('AKSESIBILITAS_PELABUHAN_MAX_KM', 'lokasi_risiko', 'Jarak maksimum ke pelabuhan', '', 'km', (SKOR,),
       (1, 2000)),
    _d('AKSESIBILITAS_WEIGHTS', 'lokasi_risiko', 'Bobot komponen aksesibilitas', '', dampak=(SKOR,), **BOBOT),
    _d('INFRASTRUKTUR_RADIUS_CARI_KM', 'lokasi_risiko', 'Radius pencarian infrastruktur', '', 'km', (SKOR,),
       (1, 2000)),
    _d('SPATIAL_DEFAULT_RISK', 'lokasi_risiko', 'Risiko bawaan bila data tidak tersedia', '', dampak=(SKOR,),
       **SKOR_0_1),
    _d('SPATIAL_DEFAULT_LOCATION', 'lokasi_risiko', 'Skor lokasi bawaan bila data tidak tersedia', '',
       dampak=(SKOR,), **SKOR_0_1),
    _d('EKOSISTEM_LANTAI_CAKUPAN', 'lokasi_risiko', 'Batas cakupan ekosistem untuk risiko penuh', '',
       'proporsi', (SKOR,), (0, 1)),
    _d('BOBOT_RISIKO_LINGKUNGAN', 'lokasi_risiko', 'Bobot risiko lingkungan', '', dampak=(SKOR,), **BOBOT),
    _d('BOBOT_RISIKO_SOSIAL', 'lokasi_risiko', 'Bobot risiko sosial', '', dampak=(SKOR,), **BOBOT),
    _d('SKALA_RASIO_DTKS', 'lokasi_risiko', 'Rentang rasio penduduk DTKS', 'Di bawah batas bawah risiko nol, di '
       'atas batas atas risiko penuh.', 'proporsi', (SKOR,), (0, 1), kolom=['Batas bawah', 'Batas atas']),
    _d('SKALA_RASIO_NELAYAN', 'lokasi_risiko', 'Rentang rasio nelayan', '', 'proporsi', (SKOR,), (0, 1),
       kolom=['Batas bawah', 'Batas atas']),
    _d('TENURIAL_LANTAI_ADAT', 'lokasi_risiko', 'Risiko tenurial minimum di wilayah adat', '', dampak=(SKOR,),
       **SKOR_0_1),
    _d('TENURIAL_LANTAI_SUB_ZONA', 'lokasi_risiko', 'Risiko tenurial minimum per sub-zona', '', dampak=(SKOR,),
       **SKOR_0_1),
    _d('SOSEK_PESISIR_BONUS', 'lokasi_risiko', 'Tambahan skor sosial ekonomi kabupaten pesisir', '',
       dampak=(SKOR,), **SKOR_0_1),
    _d('SOSEK_PENDUDUK_REFERENSI', 'lokasi_risiko', 'Jumlah penduduk acuan skor sosial ekonomi', '', 'jiwa',
       (SKOR,), (1, None)),
    _d('BOBOT_SKOR_ZONA', 'skor_zona', 'Bobot skor kelayakan zona', '', dampak=(SKOR,), **BOBOT),
    _d('KELAS_KELAYAKAN_ZONA', 'skor_zona', 'Ambang kelas kelayakan zona', '', dampak=(SKOR,), batas=(0, 1),
       kolom=['Kelas', 'Skor minimum']),
    _d('AMBANG_TERBANGUN_PERSEN', 'skor_zona', 'Batas bagian zona yang sudah terbangun',
       'Zona yang terbangun sebesar ini atau lebih tidak menjadi lokasi prioritas profil investasi.', '%', (),
       (0, 100)),
]
TERDAFTAR = {d['kunci']: d for d in DAFTAR}

LABEL_BAGIAN = {
    'npv': 'NPV', 'irr': 'IRR', 'payback': 'Payback', 'roi': 'ROI',
    'excellent': 'Sangat baik', 'good': 'Baik', 'fair': 'Wajar',
    'pasar': 'Pasar', 'operasional': 'Operasional', 'regulasi': 'Regulasi', 'lingkungan': 'Lingkungan',
    'sosial': 'Sosial', 'tata_ruang': 'Tata ruang', 'potensi_sda': 'Potensi sumber daya',
    'aksesibilitas': 'Aksesibilitas', 'sosial_ekonomi': 'Sosial ekonomi', 'kondisi_sosek': 'Kondisi sosial ekonomi',
    'finansial': 'Finansial', 'risiko': 'Risiko', 'lokasi': 'Lokasi', 'prediksi': 'Prediksi laba',
    'layak': 'Layak', 'bersyarat': 'Bersyarat', 'min_score': 'Skor minimum',
    'require_tata_ruang': 'Wajib sesuai tata ruang', 'require_npv_positive': 'Wajib NPV positif',
    'require_tata_ruang_or_npv': 'Wajib sesuai tata ruang atau NPV positif',
    'tinggi': 'Tinggi', 'sedang_layak': 'Sedang (layak)', 'sedang_bersyarat': 'Sedang (bersyarat)',
    'sangat_rendah': 'Sangat rendah', 'rendah': 'Rendah', 'sedang': 'Sedang',
    'SANGAT_TINGGI': 'Sangat tinggi', 'TINGGI': 'Tinggi', 'SEDANG': 'Sedang', 'RENDAH': 'Rendah',
    'SANGAT_RENDAH': 'Sangat rendah', 'TSUNAMI': 'Tsunami', 'ABRASI': 'Gelombang ekstrem dan abrasi',
    'BANJIR': 'Banjir', 'jarak_pelabuhan': 'Jarak pelabuhan', 'akses_jalan': 'Akses jalan',
    'akses_listrik': 'Akses listrik', 'akses_air': 'Akses air bersih', 'zona_tidak_cocok': 'Zona tidak cocok',
    'tumpang_tindih_kkprl': 'Tumpang tindih KKPRL', 'ekosistem': 'Ekosistem', 'bencana': 'Bencana',
    'kemiskinan': 'Kemiskinan', 'tenurial': 'Tenurial', 'KAWASAN_SUCI': 'Kawasan suci',
    'PERMUKIMAN': 'Permukiman', 'uraian': 'Uraian kebutuhan', 'LAUT': 'Perairan', 'DARAT': 'Darat',
    'kedalaman': 'Kedalaman (m)', 'gelombang_maks': 'Tinggi gelombang maksimum (m)',
    'gelombang_min': 'Tinggi gelombang minimum (m)', 'suhu_min': 'Suhu permukaan laut minimum (°C)',
    'jarak_pantai_maks_km': 'Jarak maksimum ke pantai (km)', 'tanpa_ekosistem': 'Ekosistem yang harus dihindari',
    'kedalaman_maks': 'Kedalaman maksimum (m)', 'anomali_suhu_maks': 'Anomali suhu maksimum (°C)',
    'daya_gelombang_min': 'Daya gelombang minimum (kW/m)',
    'suhu_rata_min': 'Suhu permukaan rata-rata minimum (°C)', 'suhu_rata_maks': 'Suhu permukaan rata-rata maksimum (°C)',
    'klorofil_min': 'Klorofil-a minimum (mg/m³)', 'klorofil_maks': 'Klorofil-a maksimum (mg/m³)',
    'kd490_maks': 'Kekeruhan Kd490 maksimum (1/m)', 'gelombang_tertinggi_maks': 'Gelombang tertinggi setahun maksimum (m)',
    'jarak_karang_maks_km': 'Jarak maksimum ke terumbu karang (km)', 'curah_hujan_maks': 'Curah hujan tahunan maksimum (mm)',
    'bulan_kering_min': 'Jumlah bulan kering minimum',
    'KABEL': 'Kabel bawah laut', 'PIPA': 'Pipa bawah laut', 'ALUR_PELAYARAN': 'Alur pelayaran',
    'lokasi_risiko': 'Lokasi dan risiko',
}

SYARAT_KARAKTER = ['kedalaman', 'gelombang_maks', 'gelombang_min', 'daya_gelombang_min', 'suhu_min',
                   'jarak_pantai_maks_km', 'ekosistem', 'tanpa_ekosistem']
SYARAT_TAMBAHAN = ['kedalaman_maks', 'gelombang_maks', 'anomali_suhu_maks', 'suhu_rata_min', 'suhu_rata_maks',
                   'klorofil_min', 'klorofil_maks', 'kd490_maks', 'gelombang_tertinggi_maks', 'jarak_karang_maks_km',
                   'curah_hujan_maks', 'bulan_kering_min']

BAWAAN = {kunci: json.loads(json.dumps(getattr(konstanta, kunci))) for kunci in TERDAFTAR}

UMUR_SIMPANAN = 15
_simpanan = {'waktu': -UMUR_SIMPANAN, 'nilai': {}}


def atur(kunci):
    if time.monotonic() - _simpanan['waktu'] >= UMUR_SIMPANAN:
        from analitik.models import PengaturanAnalisis

        try:
            _simpanan['nilai'] = dict(PengaturanAnalisis.objects.values_list('kunci', 'nilai'))
        except DatabaseError:
            _simpanan['nilai'] = {}
        _simpanan['waktu'] = time.monotonic()
    return _simpanan['nilai'].get(kunci, BAWAAN[kunci])


def segarkan():
    _simpanan['waktu'] = -UMUR_SIMPANAN


class NilaiTidakSah(ValueError):  # noqa: N818
    pass


def _angka(nilai, jalur, meta, boleh_kosong=False):
    if nilai is None and boleh_kosong:
        return
    if isinstance(nilai, bool) or not isinstance(nilai, (int, float)) or not math.isfinite(nilai):
        raise NilaiTidakSah(f'{jalur}: harus berupa angka.')
    bawah, atas = meta['batas']
    if (bawah is not None and nilai < bawah - 1e-9) or (atas is not None and nilai > atas + 1e-9):
        rentang = f"{bawah if bawah is not None else '-'} sampai {atas if atas is not None else '-'}"
        raise NilaiTidakSah(f'{jalur}: harus dalam rentang {rentang}.')
    if meta['bulat'] and int(nilai) != nilai:
        raise NilaiTidakSah(f'{jalur}: harus bilangan bulat.')


def _sama_bentuk(nilai, bawaan, jalur, meta):
    if isinstance(bawaan, bool):
        if not isinstance(nilai, bool):
            raise NilaiTidakSah(f'{jalur}: harus ya/tidak.')
    elif isinstance(bawaan, (int, float)):
        _angka(nilai, jalur, meta)
    elif isinstance(bawaan, str):
        if not isinstance(nilai, str):
            raise NilaiTidakSah(f'{jalur}: harus berupa teks.')
        if nilai != bawaan and meta['kolom']:
            raise NilaiTidakSah(f'{jalur}: label tidak dapat diubah.')
    elif isinstance(bawaan, dict):
        if not isinstance(nilai, dict) or set(nilai) != set(bawaan):
            raise NilaiTidakSah(f'{jalur}: susunan isian tidak sesuai.')
        for k in bawaan:
            _sama_bentuk(nilai[k], bawaan[k], f'{jalur} > {k}', meta)
        if meta['jumlah_satu'] and abs(sum(nilai.values()) - 1) > 0.011:
            raise NilaiTidakSah(f'{jalur}: jumlah bobot harus 1 (100%).')
    elif isinstance(bawaan, list):
        if not isinstance(nilai, list) or len(nilai) != len(bawaan):
            raise NilaiTidakSah(f'{jalur}: jumlah isian tidak sesuai.')
        for i, (n, b) in enumerate(zip(nilai, bawaan)):
            _sama_bentuk(n, b, f'{jalur} > {i + 1}', meta)


def _karakter(nilai, sektor):
    meta = {'batas': [0, None], 'bulat': False}
    if not isinstance(nilai, dict) or not set(nilai) <= sektor:
        raise NilaiTidakSah('Karakter lokasi: kunci harus kode jenis investasi yang terdaftar.')
    for kode, aturan in nilai.items():
        if not isinstance(aturan, dict) or not isinstance(aturan.get('uraian'), str) or not aturan['uraian'].strip():
            raise NilaiTidakSah(f'{kode}: uraian karakter wajib diisi.')
        if not set(aturan) - {'uraian'} or not set(aturan) - {'uraian'} <= {'LAUT', 'DARAT'}:
            raise NilaiTidakSah(f'{kode}: pilih sedikitnya satu ranah, perairan atau darat.')
        for ranah in ('LAUT', 'DARAT'):
            pilihan = aturan.get(ranah)
            if pilihan is None:
                continue
            if not isinstance(pilihan, list) or not pilihan:
                raise NilaiTidakSah(f'{kode} > {ranah}: sedikitnya satu alternatif syarat.')
            for i, syarat in enumerate(pilihan, 1):
                jalur = f'{kode} > {ranah} > alternatif {i}'
                if not isinstance(syarat, dict) or not set(syarat) <= set(SYARAT_KARAKTER):
                    raise NilaiTidakSah(f'{jalur}: syarat tidak dikenal.')
                for k, v in syarat.items():
                    if k == 'kedalaman':
                        if not isinstance(v, list) or len(v) != 2 or v == [None, None]:
                            raise NilaiTidakSah(f'{jalur} > kedalaman: isi batas dangkal dan/atau dalam.')
                        for batas in v:
                            _angka(batas, f'{jalur} > kedalaman', meta, boleh_kosong=True)
                        if None not in v and v[0] > v[1]:
                            raise NilaiTidakSah(f'{jalur} > kedalaman: batas dangkal melebihi batas dalam.')
                    elif k in ('ekosistem', 'tanpa_ekosistem'):
                        if not isinstance(v, list) or not v or not set(v) <= set(konstanta.EKOSISTEM_PESISIR):
                            raise NilaiTidakSah(f'{jalur} > {k}: pilih sedikitnya satu ekosistem.')
                    else:
                        _angka(v, f'{jalur} > {k}', meta)


def _tambahan(nilai, sektor):
    meta = {'batas': [0, None], 'bulat': False}
    if not isinstance(nilai, dict) or not set(nilai) <= sektor:
        raise NilaiTidakSah('Parameter tambahan: kunci harus kode jenis investasi yang terdaftar.')
    for kode, per_ranah in nilai.items():
        if not isinstance(per_ranah, dict) or not set(per_ranah) <= {'LAUT', 'DARAT'}:
            raise NilaiTidakSah(f'{kode}: ranah harus perairan atau darat.')
        for ranah, syarat in per_ranah.items():
            if not isinstance(syarat, dict) or not set(syarat) <= set(SYARAT_TAMBAHAN):
                raise NilaiTidakSah(f'{kode} > {ranah}: parameter tidak dikenal.')
            for k, v in syarat.items():
                _angka(v, f'{kode} > {ranah} > {k}', meta)


def periksa(kunci, nilai):
    from inti.models import SektorInvestasi

    meta = TERDAFTAR[kunci]
    if kunci in ('KARAKTER_LOKASI', 'PARAMETER_TAMBAHAN'):
        sektor = set(SektorInvestasi.objects.values_list('kode', flat=True))
        (_karakter if kunci == 'KARAKTER_LOKASI' else _tambahan)(nilai, sektor)
        return
    _sama_bentuk(nilai, BAWAAN[kunci], meta['label'], meta)
    if kunci == 'MATRIKS_PERBANDINGAN_BAWAAN':
        from analitik.services.ahp import hitung_bobot_ahp

        for i, baris in enumerate(nilai):
            for j, v in enumerate(baris):
                if abs(v * nilai[j][i] - 1) > 0.02:
                    raise NilaiTidakSah(f'Matriks AHP baris {i + 1} kolom {j + 1}: harus kebalikan dari baris '
                                        f'{j + 1} kolom {i + 1}.')
        _, cr, _ = hitung_bobot_ahp(nilai)
        if cr >= atur('AMBANG_KONSISTENSI_AHP'):
            raise NilaiTidakSah(f'Matriks AHP tidak konsisten: CR {cr:.3f} melewati ambang '
                                f"{atur('AMBANG_KONSISTENSI_AHP')}.")
    if kunci == 'KELAS_KELAYAKAN_ZONA' and [b[1] for b in nilai] != sorted((b[1] for b in nilai), reverse=True):
        raise NilaiTidakSah('Ambang kelas kelayakan harus menurun dari kelas tinggi ke sangat rendah.')
