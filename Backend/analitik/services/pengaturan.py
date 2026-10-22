import json
import math
import time

from django.db import DatabaseError

from analitik.services import konstanta

PETA, SKOR = 'peta', 'skor'

KELOMPOK = [
    ('karakter', 'Kriteria kesesuaian per jenis investasi'),
    ('peta', 'Peta Sebaran Wilayah Potensial Investasi'),
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
    _d('KRITERIA_JENIS', 'karakter', 'Kriteria kesesuaian per jenis dan sub-sektor',
       'Batas layak dipakai analisis area; batas unggulan dipakai Peta Sebaran.',
       dampak=(PETA, SKOR)),
    _d('PROPORSI_MINIMAL_KRITERIA_TERUKUR', 'karakter', 'Bagian minimal kriteria yang harus terukur',
       'Lokasi baru dinilai bila sedikitnya bagian ini dari kriterianya terukur.',
       'proporsi (0-1)', (PETA, SKOR), (0, 1)),
    _d('RADIUS_ADAT_DEKAT_M', 'karakter', 'Jarak peringatan wilayah adat',
       'Lokasi dalam jarak ini dari wilayah adat diberi peringatan, tanpa mengubah penilaian.', 'm', (PETA,), (0, 20000),
       bulat=True),
    _d('RADIUS_KARANG_KM', 'karakter', 'Radius terumbu karang',
       'Terumbu karang dihitung ada bila tercatat dalam jarak ini dari lokasi.', 'km', (PETA,), (0, 20)),
    _d('KARANG_TERPETAKAN_KM', 'karakter', 'Jarak wilayah karang terpetakan',
       'Bila tidak ada terumbu karang tercatat dalam jarak ini, wilayah dianggap belum terpetakan dan syarat karang '
       'dilewati.', 'km', (PETA,), (1, 500)),
    _d('BUFFER_UNSUR_TERLARANG_M', 'karakter', 'Jarak aman kabel, pipa, dan alur pelayaran',
       'Lokasi tidak boleh berada dalam jarak ini dari kabel, pipa, dan alur pelayaran.', 'm', (PETA,), (0, 20000)),
    _d('AMBANG_IRISAN_PENGECUALIAN_PERSEN', 'analisis_area', 'Toleransi irisan pengecualian pada screening',
       'Irisan kecil dengan alur pelayaran, ekosistem sensitif, atau jarak aman ditandai perlu verifikasi, tidak '
       'menggugurkan.', '%', (), (0, 100)),
    _d('AMBANG_IRISAN_TEPI_PERSEN', 'analisis_area', 'Toleransi irisan tepi zona pada screening',
       'Irisan kecil di tepi zona yang tidak mengizinkan atau KKPRL terbit ditandai perlu verifikasi, tidak '
       'menggugurkan.', '%', (),
       (0, 50)),
    _d('PORSI_DARAT_MINIMAL', 'analisis_area', 'Porsi daratan agar area dinilai sebagai darat',
       'Area dinilai sebagai darat bila sedikitnya bagian ini berupa daratan.',
       'proporsi (0-1)', (), (0, 1)),
    _d('LUAS_AREA_MIN_HA', 'analisis_area', 'Luas area paling kecil',
       'Area yang digambar atau diunggah harus seluas ini atau lebih.', 'ha', (), (0, 100)),
    _d('LUAS_AREA_MAKS_HA', 'analisis_area', 'Luas area paling besar',
       'Area yang lebih luas ditolak; pecah menjadi beberapa area proyek.', 'ha', (), (1, 10000000)),
    _d('AMBANG_BULAN_KERING_MM', 'karakter', 'Batas curah hujan bulan kering',
       'Bulan dengan curah hujan di bawah ini dihitung bulan kering (parameter tambak garam).', 'mm/bulan', (PETA,),
       (0, 500)),
    _d('AMBANG_KECOCOKAN', 'peta', 'Bagian area minimal di dalam area parameter tambahan',
       'Parameter tambahan bertipe area terpenuhi bila sedikitnya bagian ini dari lokasi berada di dalamnya.', 'proporsi (0-1)', (PETA,), (0, 1)),
    _d('JARAK_ANTAR_LOKASI_KM', 'peta', 'Jarak minimal antartitik lokasi',
       'Dalam radius ini hanya lokasi berskor mutu tertinggi tiap jenis yang ditampilkan.', 'km', (PETA,), (0, 200)),
    _d('MAKS_LOKASI_NASIONAL', 'peta', 'Jumlah lokasi unggulan per jenis se-Indonesia',
       'Hanya lokasi berskor tertinggi sebanyak ini yang ditampilkan untuk tiap jenis; sub-sektor mendapat giliran '
       'bergantian.', 'lokasi', (PETA,), (1, 1000), bulat=True),
    _d('MAKS_LOKASI_PER_PROVINSI', 'peta', 'Jumlah lokasi unggulan per jenis per provinsi',
       'Satu provinsi paling banyak menyumbang sebanyak ini untuk tiap jenis.', 'lokasi', (PETA,), (1, 100), bulat=True),
    _d('SKOR_MINIMAL_LOKASI_UNGGULAN', 'peta', 'Skor mutu minimal lokasi unggulan',
       'Skor 0-100 dari kedekatan nilai tiap kriteria ke kondisi ideal; di bawah angka ini lokasi bukan unggulan.',
       'skor (0-100)', (PETA,), (0, 100)),
    _d('BOBOT_RUANG_BERSYARAT', 'peta', 'Bobot zona bersyarat',
       'Pengali skor mutu untuk zona bersyarat, bila provinsi punya zona yang mengizinkan jenis itu tanpa syarat.', 'pengali (0-1)', (PETA,), (0, 1)),
    _d('SEL_PER_SISI_INTI_LOKASI', 'peta', 'Ukuran inti lokasi',
       'Jumlah sel 250 m per sisi; 4 berarti inti paling luas 1 km x 1 km.', 'sel', (PETA,), (1, 20), bulat=True),
    _d('INFRASTRUKTUR_AKSESIBILITAS', 'lokasi_risiko', 'Jarak infrastruktur pendukung',
       'Bobot, jarak ideal, dan jarak maksimum infrastruktur untuk skor aksesibilitas.', dampak=(SKOR,),
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
       'Baris dibandingkan dengan kolom (skala Saaty 1/9 sampai 9).', batas=(1 / 9, 9),
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
    'PERMUKIMAN': 'Permukiman', 'LAUT': 'Perairan', 'DARAT': 'Darat',
    'KABEL': 'Kabel bawah laut', 'PIPA': 'Pipa bawah laut', 'ALUR_PELAYARAN': 'Alur pelayaran',
    'lokasi_risiko': 'Lokasi dan risiko',
}

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


def _kriteria(nilai, sektor):
    from analitik.services.kriteria import PARAMETER

    meta = {'batas': [None, None], 'bulat': False}
    if not isinstance(nilai, dict) or not set(nilai) <= sektor:
        raise NilaiTidakSah('Kriteria: kunci harus kode jenis investasi yang terdaftar.')
    for kode, per_sub in nilai.items():
        if not isinstance(per_sub, dict) or not per_sub:
            raise NilaiTidakSah(f'{kode}: sedikitnya satu sub-sektor.')
        for sub, isi in per_sub.items():
            jalur = f'{kode} > {sub}'
            if not isinstance(isi, dict) or not {'nama', 'ranah', 'kriteria'} <= set(isi) <= {'nama', 'ranah', 'kriteria', 'unggulan'}:
                raise NilaiTidakSah(f'{jalur}: isian harus nama, ranah, kriteria, dan (bila ada) unggulan.')
            if not isinstance(isi['nama'], str) or not isi['nama'].strip():
                raise NilaiTidakSah(f'{jalur}: nama sub-sektor wajib diisi.')
            if not isinstance(isi['ranah'], list) or not isi['ranah'] or not set(isi['ranah']) <= {'LAUT', 'DARAT'}:
                raise NilaiTidakSah(f'{jalur}: pilih perairan dan/atau darat.')
            if not isinstance(isi['kriteria'], dict) or not isi['kriteria'] or not set(isi['kriteria']) <= set(PARAMETER):
                raise NilaiTidakSah(f'{jalur}: sedikitnya satu kriteria yang dikenal.')
            unggulan = isi.get('unggulan', {})
            if not isinstance(unggulan, dict) or not set(unggulan) <= set(PARAMETER):
                raise NilaiTidakSah(f'{jalur}: kriteria unggulan harus kriteria yang dikenal.')
            for k, ambang in [*isi['kriteria'].items(), *unggulan.items()]:
                if not isinstance(ambang, list) or len(ambang) != 2 or ambang == [None, None]:
                    raise NilaiTidakSah(f'{jalur} > {PARAMETER[k][0]}: isi batas bawah dan/atau atas.')
                for batas in ambang:
                    _angka(batas, f'{jalur} > {PARAMETER[k][0]}', meta, boleh_kosong=True)
                if None not in ambang and ambang[0] > ambang[1]:
                    raise NilaiTidakSah(f'{jalur} > {PARAMETER[k][0]}: batas bawah melebihi batas atas.')


def periksa(kunci, nilai):
    from inti.models import SektorInvestasi

    meta = TERDAFTAR[kunci]
    if kunci == 'KRITERIA_JENIS':
        _kriteria(nilai, set(SektorInvestasi.objects.values_list('kode', flat=True)))
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
