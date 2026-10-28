import json
import math
import re
import time

from django.db import DatabaseError

from analitik.services import konstanta

PETA, SKOR = 'peta', 'skor'

KELOMPOK = [
    ('syarat_lokasi', 'Syarat lokasi per jenis usaha', ''),
    ('peta', 'Peta Sebaran', ''),
    ('analisis_area', 'Analisis area yang digambar pengguna', ''),
    ('keuangan', 'Keuangan & model usaha', ''),
    ('sumber_data', 'Sumber data & masa berlaku', ''),
    ('rumus', 'Rumus skor & bobot (untuk tim ahli)',
     'Ubah hanya berdasarkan kajian tim ahli. Nilai bawaan mengikuti metodologi aplikasi.'),
]


def _d(kunci, kelompok, label, keterangan='', satuan='', dampak=(), batas=(0, None), jumlah_satu=False,
       kolom=None, baris=None, bulat=False, istilah='', persen=False):
    return {
        'kunci': kunci, 'kelompok': kelompok, 'label': label, 'keterangan': keterangan, 'satuan': satuan,
        'dampak': list(dampak), 'batas': list(batas), 'jumlah_satu': jumlah_satu, 'kolom': kolom, 'baris': baris,
        'bulat': bulat, 'istilah': istilah, 'persen': persen,
    }


BOBOT = dict(batas=(0, 1), jumlah_satu=True, satuan='%', persen=True)
PERSEN = dict(batas=(0, 1), satuan='%', persen=True)

DAFTAR = [
    _d('KRITERIA_JENIS', 'syarat_lokasi', 'Syarat kondisi alam per jenis usaha',
       'Batas kedalaman, suhu, gelombang, dan kondisi lain yang harus dipenuhi tiap sub-jenis usaha.',
       dampak=(PETA, SKOR), istilah='Kriteria kesesuaian per jenis dan sub-sektor'),
    _d('BUFFER_UNSUR_TERLARANG_M', 'syarat_lokasi', 'Jarak aman dari kabel, pipa & alur kapal',
       'Lokasi tidak direkomendasikan bila berada dalam jarak ini dari kabel, pipa, atau alur pelayaran. Dinaikkan: '
       'lokasi lebih sedikit tetapi lebih aman.', 'm', (PETA,), (0, 20000), istilah='Buffer unsur terlarang'),
    _d('RADIUS_ADAT_DEKAT_M', 'syarat_lokasi', 'Jarak peringatan wilayah adat',
       'Lokasi dalam jarak ini dari wilayah adat diberi peringatan, tanpa mengubah penilaian.', 'm', (PETA,),
       (0, 20000), bulat=True),
    _d('RADIUS_KARANG_KM', 'syarat_lokasi', 'Jarak pencarian terumbu karang',
       'Terumbu karang dihitung ada di lokasi bila tercatat dalam jarak ini. Dinaikkan: lebih banyak lokasi '
       'dianggap dekat karang.', 'km', (PETA,), (0, 20)),
    _d('KARANG_TERPETAKAN_KM', 'syarat_lokasi', 'Batas wilayah yang dianggap belum dipetakan karangnya',
       'Bila tidak ada terumbu karang tercatat dalam jarak ini, wilayah dianggap belum terpetakan dan syarat karang '
       'dilewati.', 'km', (PETA,), (1, 500)),
    _d('AMBANG_BULAN_KERING_MM', 'syarat_lokasi', 'Batas hujan bulan kering (tambak garam)',
       'Bulan dengan curah hujan di bawah angka ini dihitung bulan kering.', 'mm/bulan', (PETA,), (0, 500)),
    _d('PROPORSI_MINIMAL_KRITERIA_TERUKUR', 'syarat_lokasi', 'Kelengkapan data minimal sebelum lokasi dinilai',
       'Lokasi baru dinilai bila sedikitnya sebagian ini dari syaratnya punya data. Dinaikkan: lokasi lebih '
       'sedikit tetapi penilaiannya lebih lengkap.', dampak=(PETA, SKOR),
       istilah='Proporsi minimal kriteria terukur', **PERSEN),
    _d('MAKS_LOKASI_NASIONAL', 'peta', 'Jumlah lokasi per jenis se-Indonesia',
       'Hanya lokasi berskor tertinggi sebanyak ini yang ditampilkan untuk tiap jenis; sub-jenis mendapat giliran '
       'bergantian.', 'lokasi', (PETA,), (1, 1000), bulat=True),
    _d('MAKS_LOKASI_PER_PROVINSI', 'peta', 'Jumlah lokasi per jenis per provinsi',
       'Satu provinsi paling banyak menyumbang sebanyak ini untuk tiap jenis, supaya lokasi tersebar ke banyak '
       'provinsi.', 'lokasi', (PETA,), (1, 100), bulat=True),
    _d('JARAK_ANTAR_LOKASI_KM', 'peta', 'Jarak minimal antarlokasi',
       'Dalam jarak ini hanya lokasi berskor tertinggi tiap jenis yang ditampilkan. Dinaikkan: lokasi lebih '
       'tersebar.', 'km', (PETA,), (0, 200)),
    _d('SKOR_MINIMAL_LOKASI_UNGGULAN', 'peta', 'Skor minimal lokasi unggulan',
       'Skor 0-100 menunjukkan seberapa dekat kondisi lokasi ke kondisi ideal. Lokasi di bawah angka ini tidak '
       'ditampilkan.', 'skor (0-100)', (PETA,), (0, 100), istilah='Skor mutu'),
    _d('BOBOT_RUANG_BERSYARAT', 'peta', 'Pengurang skor untuk zona bersyarat',
       'Skor lokasi di zona yang mengizinkan dengan syarat dikali angka ini, bila di provinsi yang sama ada zona '
       'yang mengizinkan tanpa syarat. 100% berarti tidak dikurangi.', dampak=(PETA,),
       istilah='Bobot ruang bersyarat', **PERSEN),
    _d('SEL_PER_SISI_INTI_LOKASI', 'peta', 'Ukuran area inti lokasi',
       'Jumlah sel 250 m per sisi; 4 berarti inti paling luas 1 km x 1 km.', 'sel', (PETA,), (1, 20), bulat=True),
    _d('AMBANG_KECOCOKAN', 'peta', 'Bagian lokasi yang harus masuk area Parameter Tambahan',
       'Parameter Tambahan bertipe area terpenuhi bila sedikitnya bagian ini dari lokasi berada di dalamnya.',
       dampak=(PETA,), istilah='Ambang kecocokan', **PERSEN),
    _d('LUAS_AREA_MIN_HA', 'analisis_area', 'Luas area paling kecil',
       'Area yang digambar atau diunggah harus seluas ini atau lebih.', 'ha', (), (0, 100)),
    _d('LUAS_AREA_MAKS_HA', 'analisis_area', 'Luas area paling besar',
       'Area yang lebih luas ditolak; pengguna diminta memecahnya menjadi beberapa area.', 'ha', (), (1, 10000000)),
    _d('AMBANG_IRISAN_PENGECUALIAN_PERSEN', 'analisis_area', 'Toleransi singgungan dengan area terlarang',
       'Singgungan kecil dengan alur pelayaran, ekosistem sensitif, atau jarak aman ditandai perlu verifikasi dan '
       'tidak langsung menggugurkan.', '%', (), (0, 100), istilah='Ambang irisan pengecualian'),
    _d('AMBANG_IRISAN_TEPI_PERSEN', 'analisis_area', 'Toleransi singgungan di tepi zona',
       'Singgungan kecil di tepi zona yang tidak mengizinkan, atau dengan KKPRL yang sudah terbit, ditandai perlu '
       'verifikasi dan tidak langsung menggugurkan.', '%', (), (0, 50), istilah='Ambang irisan tepi'),
    _d('PORSI_DARAT_MINIMAL', 'analisis_area', 'Bagian daratan agar area dinilai sebagai darat',
       'Area dinilai dengan syarat darat bila sedikitnya bagian ini berupa daratan.', **PERSEN),
    _d('AMBANG_CAKUPAN_ACUAN', 'analisis_area', 'Cakupan peta tata ruang minimal',
       'Bagian area yang harus tercakup peta tata ruang agar kesesuaiannya bisa dipastikan; bila kurang, hasil '
       'ditandai belum terverifikasi.', dampak=(PETA,), istilah='Ambang cakupan acuan', **PERSEN),
    _d('RADIUS_LOKASI_ALTERNATIF_KM', 'analisis_area', 'Jarak pencarian lokasi pengganti',
       'Bila area tidak sesuai, aplikasi menawarkan lokasi Peta Sebaran terdekat untuk jenis yang sama dalam jarak '
       'ini.', 'km', (), (1, 1000), istilah='Lokasi alternatif'),
    _d('JUMLAH_LOKASI_ALTERNATIF', 'analisis_area', 'Jumlah lokasi pengganti yang ditawarkan',
       'Banyaknya lokasi pengganti yang ditampilkan bila area tidak sesuai.', 'lokasi', (), (1, 20), bulat=True),
    _d('MODEL_USAHA', 'keuangan', 'Model usaha per sub-jenis',
       'Dipakai halaman analisis finansial Profil Investasi. Kosongkan harga untuk memakai harga produsen BPS provinsi; '
       'sub-jenis tanpa volume, investasi, atau harga ditulis belum memiliki model usaha.'),
    _d('ASUMSI_MODEL_USAHA', 'keuangan', 'Asumsi keuangan Profil Investasi',
       'Berlaku untuk semua model usaha. CSR dihitung dari pendapatan bersih tahun sebelumnya.', batas=(0, 100)),
    _d('FINANCIAL_WEIGHTS', 'keuangan', 'Bobot unsur skor keuangan',
       'Seberapa besar NPV, IRR, masa balik modal, dan ROI menentukan skor keuangan proyek. Jumlahnya harus 100%.',
       istilah='Bobot NPV, IRR, payback, ROI', **BOBOT),
    _d('FAKTOR_NORMALISASI_NPV', 'keuangan', 'Keuntungan bersih (NPV) untuk skor penuh',
       'Proyek dengan NPV sebesar persentase ini dari nilai investasinya mendapat skor NPV penuh. Contoh 50%: '
       'proyek Rp10 miliar perlu NPV Rp5 miliar.', '% dari investasi', batas=(0.01, 100),
       istilah='Faktor normalisasi NPV', persen=True),
    _d('BATAS_ATAS_IRR_PERSEN', 'keuangan', 'IRR untuk skor penuh',
       'Proyek dengan tingkat pengembalian internal (IRR) setinggi ini atau lebih mendapat skor IRR penuh; di '
       'bawahnya skor turun sebanding.', '%', batas=(1, 200), istilah='Internal Rate of Return'),
    _d('PAYBACK_THRESHOLDS', 'keuangan', 'Batas masa balik modal',
       'Balik modal dalam batas "sangat baik" mendapat skor penuh, "baik" 80%, dan "wajar" 50%. Lebih lama dari '
       'batas wajar diberi catatan di laporan.', 'tahun', batas=(0, 100), istilah='Payback period'),
    _d('ROI_CEILING_PCT', 'keuangan', 'ROI untuk skor penuh',
       'Proyek dengan ROI setinggi ini atau lebih mendapat skor ROI penuh; di bawahnya skor turun sebanding.', '%',
       batas=(1, 10000), istilah='Return on Investment'),
    _d('PROFIT_RATIO_CEILING', 'keuangan', 'Laba untuk skor prediksi penuh',
       'Proyek yang perkiraan labanya mencapai kelipatan ini dari nilai investasi mendapat skor prediksi laba penuh.',
       'kali investasi', batas=(0.01, 100), istilah='Profit ratio'),
    _d('SENSITIVITAS_FINANSIAL', 'keuangan', 'Langkah uji naik-turun pendapatan & biaya',
       'Pendapatan dan biaya diuji naik atau turun sebesar persentase ini untuk melihat ketahanan kelayakan proyek.',
       '%', batas=(-1, 1), istilah='Analisis sensitivitas', persen=True),
    _d('BEST_CASE_REVENUE_MULTIPLIER', 'keuangan', 'Skenario optimis: pengali pendapatan',
       'Pendapatan pada skenario optimis = perkiraan normal dikali angka ini.', 'kali', batas=(0, 5)),
    _d('BEST_CASE_OPEX_MULTIPLIER', 'keuangan', 'Skenario optimis: pengali biaya operasi',
       'Biaya operasi pada skenario optimis = perkiraan normal dikali angka ini.', 'kali', batas=(0, 5)),
    _d('WORST_CASE_REVENUE_MULTIPLIER', 'keuangan', 'Skenario pesimis: pengali pendapatan',
       'Pendapatan pada skenario pesimis = perkiraan normal dikali angka ini.', 'kali', batas=(0, 5)),
    _d('WORST_CASE_OPEX_MULTIPLIER', 'keuangan', 'Skenario pesimis: pengali biaya operasi',
       'Biaya operasi pada skenario pesimis = perkiraan normal dikali angka ini.', 'kali', batas=(0, 5)),
    _d('MASA_BERLAKU_DATA', 'sumber_data', 'Masa berlaku data',
       'Data yang lebih tua dari batas ini ditandai di hasil analisis, laporan, dan legenda peta. 0 berarti tanpa '
       'batas. Data tarikan otomatis diperiksa tiap minggu dan ditarik ulang setelah 90 hari.', 'tahun',
       batas=(0, 100), bulat=True),
    _d('MATRIKS_PERBANDINGAN_BAWAAN', 'rumus', 'Tingkat kepentingan antaraspek',
       'Seberapa penting aspek di baris dibanding aspek di kolom: 1 sama penting, 3 sedikit lebih penting, 5 lebih '
       'penting, 9 mutlak lebih penting. Dari sini dihitung bobot tiap aspek pada skor kelayakan.',
       batas=(1 / 9, 9), kolom=['Finansial', 'Risiko', 'Lokasi', 'Prediksi', 'Rekomendasi'],
       baris=['Finansial', 'Risiko', 'Lokasi', 'Prediksi', 'Rekomendasi'],
       istilah='Matriks perbandingan berpasangan AHP (skala Saaty)'),
    _d('AMBANG_KONSISTENSI_AHP', 'rumus', 'Batas ketidakkonsistenan perbandingan',
       'Isian tingkat kepentingan ditolak bila saling bertentangan melebihi batas ini. Angka 0,1 adalah batas yang '
       'lazim dipakai.', batas=(0.01, 0.5), istilah='Consistency Ratio (CR) AHP'),
    _d('RECOMMENDATION_WEIGHTS', 'rumus', 'Bobot aspek pada skor rekomendasi',
       'Seberapa besar keuangan, risiko, lokasi, dan prediksi laba menentukan skor rekomendasi. Jumlahnya harus '
       '100%.', istilah='Recommendation weights', **BOBOT),
    _d('DECISION_THRESHOLDS', 'rumus', 'Syarat keputusan layak dan bersyarat',
       'Skor minimal dan syarat tambahan untuk keputusan Layak dan Bersyarat. Bawaannya, Layak wajib sesuai tata ruang '
       'dan NPV positif, sedangkan Bersyarat cukup salah satunya; hapus centang untuk melonggarkan syarat itu.', istilah='Decision thresholds', **PERSEN),
    _d('PRIORITY_THRESHOLDS', 'rumus', 'Skor untuk tingkat prioritas',
       'Proyek layak dengan skor setinggi batas "tinggi" mendapat prioritas tinggi; proyek bersyarat dengan skor '
       'setinggi batas "sedang (bersyarat)" mendapat prioritas sedang.', istilah='Priority thresholds', **PERSEN),
    _d('RISK_CLASS_THRESHOLDS', 'rumus', 'Batas kelas risiko proyek',
       'Rata-rata risiko paling tinggi untuk masuk tiap kelas; di atas batas "sedang" proyek tergolong berisiko '
       'tinggi.', dampak=(SKOR,), istilah='Risk class thresholds', **PERSEN),
    _d('LOCATION_WEIGHTS', 'rumus', 'Bobot unsur skor lokasi',
       'Seberapa besar tata ruang, potensi sumber daya, akses infrastruktur, dan sosial ekonomi menentukan skor '
       'lokasi. Jumlahnya harus 100%.', dampak=(SKOR,), istilah='Location weights', **BOBOT),
    _d('TATA_RUANG_PASS_SCORE', 'rumus', 'Nilai tata ruang bila sesuai',
       'Nilai unsur tata ruang pada skor lokasi bila area sesuai rencana tata ruang.', dampak=(SKOR,), **PERSEN),
    _d('TATA_RUANG_FAIL_SCORE', 'rumus', 'Nilai tata ruang bila tidak sesuai',
       'Nilai unsur tata ruang pada skor lokasi bila area tidak sesuai rencana tata ruang.', dampak=(SKOR,),
       **PERSEN),
    _d('TINGKAT_POTENSI_SCORE', 'rumus', 'Nilai per tingkat potensi sumber daya',
       'Nilai potensi sumber daya sebuah zona menurut tingkat potensinya, dari sangat tinggi sampai rendah.',
       dampak=(SKOR,), **PERSEN),
    _d('INFRASTRUKTUR_AKSESIBILITAS', 'rumus', 'Jarak ke infrastruktur pendukung',
       'Bobot, jarak ideal, dan jarak maksimum tiap jenis infrastruktur untuk nilai akses: dalam jarak ideal nilai '
       'penuh, melewati jarak maksimum nilai terendah.', dampak=(SKOR,),
       kolom=['Kategori', 'Bobot (0-1)', 'Jarak ideal (km)', 'Jarak maksimum (km)']),
    _d('INFRASTRUKTUR_RADIUS_CARI_KM', 'rumus', 'Jarak terjauh pencarian infrastruktur',
       'Infrastruktur dicari bertahap hingga sejauh ini dari area; yang lebih jauh dianggap tidak ada.', 'km', (SKOR,),
       (1, 2000)),
    _d('AKSESIBILITAS_PELABUHAN_IDEAL_KM', 'rumus', 'Jarak pelabuhan untuk nilai akses penuh',
       'Area dalam jarak ini dari pelabuhan mendapat nilai jarak pelabuhan penuh (data potensi kawasan).', 'km',
       (SKOR,), (0, 1000)),
    _d('AKSESIBILITAS_PELABUHAN_MAX_KM', 'rumus', 'Jarak pelabuhan terjauh',
       'Di luar jarak ini nilai jarak pelabuhan paling rendah (10%); di antaranya menurun bertahap.', 'km', (SKOR,),
       (1, 2000)),
    _d('AKSESIBILITAS_WEIGHTS', 'rumus', 'Bobot unsur akses dari data potensi kawasan',
       'Seberapa besar jarak pelabuhan, jalan, listrik, dan air bersih menentukan nilai akses bila dihitung dari '
       'data potensi kawasan. Jumlahnya harus 100%.', dampak=(SKOR,), **BOBOT),
    _d('SPATIAL_DEFAULT_LOCATION', 'rumus', 'Nilai lokasi bila data tidak tersedia',
       'Nilai pengganti untuk unsur lokasi yang datanya belum ada di wilayah itu.', dampak=(SKOR,), **PERSEN),
    _d('SOSEK_PESISIR_BONUS', 'rumus', 'Tambahan nilai sosial ekonomi kabupaten pesisir',
       'Nilai sosial ekonomi berawal 50%, ditambah angka ini untuk kabupaten pesisir, lalu ditambah hingga 30% '
       'menurut jumlah penduduk.', dampak=(SKOR,), **PERSEN),
    _d('SOSEK_PENDUDUK_REFERENSI', 'rumus', 'Jumlah penduduk untuk tambahan penuh',
       'Kabupaten dengan penduduk sebanyak ini atau lebih mendapat tambahan penduduk penuh (30%) pada nilai sosial '
       'ekonomi.', 'jiwa', (SKOR,), (1, None)),
    _d('RISK_WEIGHTS', 'rumus', 'Bobot unsur skor risiko',
       'Seberapa besar risiko pasar, operasional, regulasi, lingkungan, dan sosial menentukan skor risiko. '
       'Jumlahnya harus 100%.', dampak=(SKOR,), istilah='Risk weights', **BOBOT),
    _d('SPATIAL_DEFAULT_RISK', 'rumus', 'Nilai risiko bila data tidak tersedia',
       'Nilai pengganti untuk unsur risiko yang datanya belum ada, sekaligus titik awal risiko regulasi.',
       dampak=(SKOR,), **PERSEN),
    _d('REGULASI_PENALTY', 'rumus', 'Tambahan risiko regulasi',
       'Kenaikan risiko regulasi bila zona tidak cocok untuk jenis usaha, atau bila area beririsan dengan KKPRL yang '
       'sudah terbit.', dampak=(SKOR,), **PERSEN),
    _d('KELAS_RISIKO_SCORE', 'rumus', 'Nilai risiko per kelas bahaya InaRISK',
       'Nilai risiko untuk tiap kelas bahaya bencana dari InaRISK.', dampak=(SKOR,), **PERSEN),
    _d('HAZARD_OPERASIONAL_WEIGHTS', 'rumus', 'Bobot bencana pada risiko operasional',
       'Seberapa besar tsunami, gelombang ekstrem dan abrasi, serta banjir menentukan risiko operasional. Jumlahnya '
       'harus 100%.', dampak=(SKOR,), **BOBOT),
    _d('HAZARD_LINGKUNGAN_WEIGHTS', 'rumus', 'Bobot bencana pada risiko lingkungan',
       'Seberapa besar gelombang ekstrem dan abrasi, banjir, serta tsunami menentukan tekanan bencana pada risiko '
       'lingkungan. Jumlahnya harus 100%.', dampak=(SKOR,), **BOBOT),
    _d('BOBOT_RISIKO_LINGKUNGAN', 'rumus', 'Bobot ekosistem dan bencana pada risiko lingkungan',
       'Seberapa besar kepekaan ekosistem dan tekanan bencana menentukan risiko lingkungan. Jumlahnya harus 100%.',
       dampak=(SKOR,), **BOBOT),
    _d('EKOSISTEM_LANTAI_CAKUPAN', 'rumus', 'Nilai dasar risiko ekosistem',
       'Area yang menyentuh ekosistem sensitif langsung mendapat sedikitnya bagian ini dari risiko ekosistem penuh; '
       'sisanya naik sesuai luas ekosistem yang tercakup.', dampak=(SKOR,), **PERSEN),
    _d('BOBOT_RISIKO_SOSIAL', 'rumus', 'Bobot kemiskinan dan penguasaan ruang pada risiko sosial',
       'Seberapa besar kemiskinan dan risiko sengketa penguasaan ruang menentukan risiko sosial. Jumlahnya harus '
       '100%.', dampak=(SKOR,), istilah='Kemiskinan dan tenurial', **BOBOT),
    _d('SKALA_RASIO_DTKS', 'rumus', 'Rentang persentase penduduk miskin',
       'Di bawah batas bawah risiko kemiskinan nol, di atas batas atas risiko penuh.', dampak=(SKOR,),
       kolom=['Batas bawah', 'Batas atas'], istilah='Rasio penduduk DTKS', **PERSEN),
    _d('SKALA_RASIO_NELAYAN', 'rumus', 'Rentang persentase nelayan',
       'Makin banyak nelayan, makin besar risiko sengketa ruang: di bawah batas bawah risiko nol, di atas batas atas '
       'risiko penuh.', dampak=(SKOR,), kolom=['Batas bawah', 'Batas atas'], istilah='Rasio nelayan', **PERSEN),
    _d('TENURIAL_LANTAI_ADAT', 'rumus', 'Risiko sengketa minimal di wilayah adat',
       'Area di wilayah adat mendapat risiko sengketa ruang sedikitnya sebesar ini.', dampak=(SKOR,),
       istilah='Risiko tenurial minimum', **PERSEN),
    _d('TENURIAL_LANTAI_SUB_ZONA', 'rumus', 'Risiko sengketa minimal per sub-zona',
       'Area di sub-zona kawasan suci atau permukiman mendapat risiko sengketa ruang sedikitnya sebesar ini.',
       dampak=(SKOR,), istilah='Risiko tenurial minimum', **PERSEN),
    _d('BOBOT_SKOR_ZONA', 'rumus', 'Bobot lokasi dan risiko pada skor zona',
       'Skor kelayakan tiap zona dihitung dari skor lokasi dan skor risiko dengan bobot ini. Jumlahnya harus 100%.',
       dampak=(SKOR,), **BOBOT),
    _d('KELAS_KELAYAKAN_ZONA', 'rumus', 'Batas kelas kelayakan zona',
       'Skor minimal untuk tiap kelas kelayakan zona, dari tinggi ke sangat rendah.', dampak=(SKOR,),
       kolom=['Kelas', 'Skor minimum'], **PERSEN),
    _d('AMBANG_TERBANGUN_PERSEN', 'rumus', 'Batas bagian zona yang sudah terbangun',
       'Zona yang terbangun sebesar ini atau lebih tidak menjadi lokasi prioritas Profil Investasi.', '%', (),
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
    'PELABUHAN_PERIKANAN': 'Pelabuhan perikanan', 'PELABUHAN_UMUM': 'Pelabuhan umum',
    'JALAN_NASIONAL': 'Jalan nasional', 'JARINGAN_LISTRIK': 'Jaringan listrik', 'KAWASAN_INDUSTRI': 'Kawasan industri',
    'lokasi_risiko': 'Lokasi dan risiko',
    'umur_tahun': 'Umur proyek (tahun)', 'diskonto_persen': 'Tingkat diskonto atau MARR (%)',
    'kenaikan_harga_persen': 'Kenaikan harga per tahun (%)', 'kenaikan_biaya_persen': 'Kenaikan biaya per tahun (%)',
    'csr_persen': 'CSR (% pendapatan bersih)', 'batas_pbp_tahun': 'Batas masa pengembalian modal (tahun)',
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
        def teks(b):
            return '-' if b is None else f'{round(b * 100, 6):g}%' if meta.get('persen') else str(b)

        rentang = f'{teks(bawah)} sampai {teks(atas)}'
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
            if not re.fullmatch(r'[A-Z0-9_]{2,40}', sub):
                raise NilaiTidakSah(f'{jalur}: kode sub-sektor hanya huruf kapital, angka, dan garis bawah, paling panjang 40.')
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


def _model_usaha(nilai):
    dikenal = {sub: (jenis, isi['nama']) for sumber in (konstanta.KRITERIA_JENIS, atur('KRITERIA_JENIS'))
               for jenis, per_sub in sumber.items() for sub, isi in per_sub.items()}
    meta = {'batas': [0, None], 'bulat': False}
    if not isinstance(nilai, dict) or not set(nilai) <= set(dikenal):
        raise NilaiTidakSah('Model usaha: ada sub-jenis yang tidak dikenal.')
    for sub, isi in nilai.items():
        jenis, jalur = dikenal[sub]
        contoh = konstanta.model_usaha_kosong(jenis, sub)
        if not isinstance(isi, dict) or set(isi) != set(contoh):
            raise NilaiTidakSah(f'{jalur}: susunan isian tidak sesuai.')
        for k in ('satuan_usaha', 'satuan_produk'):
            if not isinstance(isi[k], str) or not isi[k].strip() or len(isi[k]) > 40:
                raise NilaiTidakSah(f'{jalur}: satuan wajib diisi, paling panjang 40 huruf.')
        _angka(isi['harga_per_satuan'], f'{jalur} > harga', meta, boleh_kosong=True)
        for bagian in ('volume_per_tahun', 'investasi', 'operasional_per_tahun'):
            if not isinstance(isi[bagian], dict) or set(isi[bagian]) != set(contoh[bagian]):
                raise NilaiTidakSah(f'{jalur}: susunan isian tidak sesuai.')
            for k, v in isi[bagian].items():
                _angka(v, f'{jalur} > {k}', meta, boleh_kosong=True)


def periksa(kunci, nilai):
    from inti.models import SektorInvestasi

    meta = TERDAFTAR[kunci]
    if kunci == 'KRITERIA_JENIS':
        _kriteria(nilai, set(SektorInvestasi.objects.values_list('kode', flat=True)))
        return
    if kunci == 'MODEL_USAHA':
        _model_usaha(nilai)
        return
    _sama_bentuk(nilai, BAWAAN[kunci], meta['label'], meta)
    if kunci == 'ASUMSI_MODEL_USAHA' and (int(nilai['umur_tahun']) != nilai['umur_tahun'] or nilai['umur_tahun'] < 1):
        raise NilaiTidakSah('Umur proyek harus bilangan bulat sedikitnya 1 tahun.')
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
