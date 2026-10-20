import { gayaUnsurRtrl } from '../../utils/simbologiPeta';
import { warnaKelasRisiko } from '../../utils/simbologiPeta';
import {
  IKON_JENIS_INVESTASI,
  KATEGORI_ZONA,
  URUTAN_KATEGORI,
  URUTAN_KATEGORI_DARAT,
  gayaKawasan,
  kategoriZona,
  warnaJenisInvestasi,
  warnaZona,
} from '../../utils/simbologiPeta';
import { SECTORS } from '../../utils/konstanta';
import { API_V1_URL } from '../../api/alamat';
import { lambangSvg } from './ikonPeta';

const TOMBOL_ANALISIS = `<button type="button" data-analisis-lokasi class="mt-2 w-full rounded-lg bg-[#0056A5] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#004a8f]">
  Analisis lokasi ini
</button>`;

const aman = (nilai) =>
  nilai === null || nilai === undefined
    ? ''
    : String(nilai)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const WMS_KKP = 'https://portaldata.kkp.go.id/gis/wms';

export const BATAS_OSEANOGRAFI = [[-11, 94], [7, 142]];

export const urlCitraOseanografi = (kode) => `${API_V1_URL}/analitik/oseanografi/${kode}.png`;

const OSEANOGRAFI = [
  ['osea_suhu', 'SUHU', 'Suhu Permukaan Laut',
    'Rata-rata suhu permukaan laut 12 bulan terakhir dari NOAA Coral Reef Watch, dataset yang juga '
      + 'ditayangkan Sidako KKP. Perairan yang terlalu hangat perlu diperhatikan untuk budidaya.'],
  ['osea_anomali', 'ANOMALI_SUHU', 'Anomali Suhu Permukaan Laut',
    'Selisih suhu permukaan laut terhadap rata-rata jangka panjangnya (NOAA Coral Reef Watch, juga '
      + 'ditayangkan Sidako KKP), dirata-rata 12 bulan terakhir. Anomali positif yang tinggi menandai '
      + 'stres panas bagi terumbu karang dan biota budidaya.'],
  ['osea_klorofil', 'KLOROFIL', 'Klorofil-a',
    'Klorofil-a dari satelit NASA MODIS-Aqua sebagai petunjuk kesuburan perairan; nilainya tinggi di '
      + 'perairan dekat muara dan pesisir.'],
  ['osea_gelombang', 'GELOMBANG', 'Tinggi Gelombang Signifikan',
    'Rata-rata tinggi gelombang signifikan 12 bulan terakhir dari model NOAA WaveWatch III (resolusi '
      + '0,5°), penentu desain bangunan laut dan sarana budidaya.'],
  ['osea_kedalaman', 'KEDALAMAN', 'Kedalaman Laut',
    'Kedalaman laut dari batimetri SRTM15+ v2.6 (Scripps), dirata-rata ke 30 detik busur (sekitar 0,9 km).'],
  ['osea_kemiringan_dasar', 'KEMIRINGAN_DASAR', 'Kemiringan Dasar Laut',
    'Kemiringan dasar laut yang dihitung dari batimetri SRTM15+; infrastruktur laut membutuhkan paling tinggi 5°.'],
  ['osea_arus', 'ARUS', 'Kecepatan Arus Permukaan',
    'Rata-rata kecepatan arus permukaan setahun (September 2023 sampai Agustus 2024) dari model HYCOM GOFS 3.1 (1/12°); budidaya laut '
      + 'membutuhkan 0,15 sampai 0,45 m/s, wisata bahari paling tinggi 0,3 m/s.'],
  ['osea_salinitas', 'SALINITAS', 'Salinitas Permukaan Laut',
    'Rata-rata salinitas permukaan setahun (September 2023 sampai Agustus 2024) dari HYCOM GOFS 3.1; budidaya laut membutuhkan 27 sampai '
      + '34 ppt, tambak garam sedikitnya 30 ppt.'],
  ['osea_beda_suhu', 'BEDA_SUHU_1000M', 'Beda Suhu Permukaan dan 1.000 m',
    'Selisih suhu permukaan dan kedalaman 1.000 m dari klimatologi NOAA World Ocean Atlas 2023; energi panas laut '
      + '(OTEC) membutuhkan sedikitnya 20 °C.'],
  ['osea_kd490', 'KD490', 'Kecerahan Perairan (Kd490)',
    'Koefisien atenuasi cahaya Kd490 dari NASA MODIS-Aqua, rata-rata 12 bulan terakhir; makin kecil makin jernih. '
      + 'Wisata bahari mensyaratkan paling tinggi 0,08 per meter (visibilitas sekitar 10 m).'],
  ['osea_periode', 'PERIODE_GLB', 'Periode Gelombang',
    'Rata-rata periode puncak gelombang 12 bulan terakhir dari NOAA WaveWatch III; energi gelombang membutuhkan '
      + 'periode 5 sampai 10 detik.'],
  ['iklim_hujan', 'CURAH_HUJAN', 'Curah Hujan Bulanan',
    'Rata-rata curah hujan bulanan 12 bulan terakhir dari CHIRPS v2.0; tambak garam membutuhkan curah hujan '
      + 'tahunan paling tinggi 1.500 mm.'],
  ['iklim_kering', 'BULAN_KERING', 'Bulan Kering Berturut-turut',
    'Rangkaian bulan berturut-turut terpanjang dengan curah hujan di bawah 50 mm dalam 12 bulan terakhir '
      + '(CHIRPS v2.0); tambak garam membutuhkan sedikitnya 4 bulan.'],
  ['iklim_kemiringan', 'KEMIRINGAN', 'Kemiringan Lahan',
    'Kemiringan lahan dari Copernicus DEM GLO-90, dirata-rata per 0,005° (sekitar 550 m); tambak budidaya '
      + 'membutuhkan paling tinggi 3%, tambak garam paling tinggi 2%.'],
  ['iklim_liat', 'TANAH_LIAT', 'Kandungan Tanah Liat',
    'Kandungan liat tanah lapisan atas (0-5 cm) dari ISRIC SoilGrids 2.0; tambak garam membutuhkan sedikitnya 30%.'],
  ['iklim_angin', 'ANGIN_100M', 'Kecepatan Angin 100 m',
    'Kecepatan angin rata-rata 10 tahun pada ketinggian 100 m dari Global Wind Atlas 3; PLTB lepas pantai '
      + 'membutuhkan sedikitnya 6,5 m/s.'],
  ['iklim_ghi', 'GHI', 'Iradiasi Surya (GHI)',
    'Iradiasi surya global horizontal rata-rata tahunan dari NASA POWER; PLTS terapung membutuhkan sedikitnya '
      + '4,8 kWh/m² per hari.'],
  ['risiko_pga', 'PGA', 'Percepatan Tanah Gempa (PGA)',
    'Percepatan tanah puncak pada batuan dasar dengan peluang terlampaui 10% dalam 50 tahun dari GEM Global Seismic '
      + 'Hazard Map 2023; infrastruktur laut membutuhkan paling tinggi 0,35 g.'],
  ['risiko_laju_abrasi', 'ABRASI_PANTAI', 'Laju Abrasi Garis Pantai',
    'Rata-rata laju mundurnya garis pantai 1984-2015 dari transek citra Landsat JRC (Mentaschi dkk., 2018); '
      + 'konservasi dan rehabilitasi pesisir mensyaratkan paling tinggi 1,5 m per tahun.'],
  ['pesisir_eks_mangrove', 'LUAS_EKS_MANGROVE', 'Eks-Mangrove 1996-2020',
    'Hamparan mangrove yang hilang antara 1996 dan 2020 menurut Global Mangrove Watch v3, diwarnai menurut luas '
      + 'hamparan kontigu; konservasi dan rehabilitasi pesisir membutuhkan hamparan sedikitnya 100 ha.'],
  ['pesisir_produksi_kab', 'PRODUKSI_KABUPATEN', 'Perkiraan Produksi Ikan Kabupaten',
    'Perkiraan produksi perikanan tangkap laut per kabupaten/kota: angka provinsi BPS dibagi menurut kapasitas '
      + 'pendaratan kelas pelabuhan perikanan di tiap kabupaten; pengolahan hasil laut membutuhkan sedikitnya 20.000 '
      + 'ton per tahun.'],
  ['osea_shannon', 'SHANNON', 'Keanekaragaman Hayati Laut (Shannon)',
    'Indeks Shannon-Wiener dari catatan spesies OBIS per sel 0,5°; bioteknologi kelautan membutuhkan '
      + 'sedikitnya 2. Sel dengan catatan terlalu sedikit dikosongkan.'],
];

export const LAYER_WMS = {};

const INFRASTRUKTUR = [
  ['infra_pelabuhan_perikanan', 'PELABUHAN_PERIKANAN', 'Pelabuhan Perikanan', '#0e7490', 'ikan',
   'Pelabuhan perikanan PPS, PPN, PPP, PPI, dan swasta'],
  ['infra_pelabuhan_umum', 'PELABUHAN_UMUM', 'Pelabuhan Umum', '#1e40af', 'jangkar',
   'Pelabuhan umum yang melayani bongkar muat barang dan penumpang'],
  ['infra_pelabuhan_penyeberangan', 'PELABUHAN_PENYEBERANGAN', 'Pelabuhan Penyeberangan', '#7e22ce', 'kapal',
   'Pelabuhan penyeberangan antarpulau'],
  ['infra_terminal_khusus', 'TERMINAL_KHUSUS', 'Terminal Khusus', '#c2410c', 'kontainer',
   'Terminal khusus milik badan usaha untuk kegiatannya sendiri'],
  ['infra_jalan_nasional', 'JALAN_NASIONAL', 'Jalan Nasional', '#78350f', null,
   'Ruas jalan nasional sebagai jalur angkutan darat utama'],
  ['infra_jaringan_listrik', 'JARINGAN_LISTRIK', 'Jaringan Listrik', '#a16207', null,
   'Jaringan transmisi tegangan tinggi'],
  ['infra_pembangkit_listrik', 'PEMBANGKIT_LISTRIK', 'Pembangkit Listrik', '#b91c1c', 'petir',
   'Lokasi pembangkit tenaga listrik'],
  ['infra_kawasan_industri', 'KAWASAN_INDUSTRI', 'Kawasan Industri', '#44403c', 'pabrik',
   'Kawasan industri eksisting dan yang direncanakan'],
  ['infra_kpbpb', 'KAWASAN_PERDAGANGAN_BEBAS', 'Kawasan Perdagangan Bebas', '#15803d', null,
   'Kawasan Perdagangan Bebas dan Pelabuhan Bebas (KPBPB)'],
  ['infra_bandara', 'BANDARA', 'Bandar Udara', '#0f766e', 'pesawat',
   'Bandar udara berkode IATA/ICAO dari OpenStreetMap; acuan waktu tempuh wisata bahari, ekspor, dan bioteknologi'],
  ['infra_gardu_induk', 'GARDU_INDUK', 'Gardu Induk', '#9a3412', 'gardu',
   'Gardu induk listrik dari OpenStreetMap (bukan gardu distribusi); energi kelautan mensyaratkan paling jauh 20 km'],
  ['infra_listrik_tm', 'JARINGAN_LISTRIK_TM', 'Jaringan Listrik 20 kV', '#ca8a04', null,
   'Jaringan listrik tegangan menengah 20 kV dari OpenStreetMap; pengolahan hasil laut mensyaratkan paling jauh 3 km'],
  ['infra_kampus_riset', 'KAMPUS_RISET', 'Kampus & Lembaga Riset', '#4338ca', 'toga',
   'Perguruan tinggi dan lembaga riset dari OpenStreetMap, pendekatan fasilitas laboratorium bioteknologi'],
  ['infra_muara', 'MUARA_SUNGAI', 'Muara Sungai Besar', '#0284c7', 'sungai',
   'Muara sungai besar dari HydroRIVERS (HydroSHEDS); jasa maritim dan bioteknologi mensyaratkan jarak minimum'],
];

export const warnaInfrastruktur = (kategori) =>
  (INFRASTRUKTUR.find(([, kode]) => kode === kategori) || [])[3] || '#64748b';

const LAPISAN_INFRASTRUKTUR = Object.fromEntries(
  INFRASTRUKTUR.map(([id, kategori, label, warna, ikon, keterangan]) => [
    id,
    {
      url: '/inventarisasi/infrastruktur/peta/',
      urlWilayah: '/inventarisasi/infrastruktur/wilayah/',
      params: { kategori },
      label,
      legenda: 'tunggal',
      warnaContoh: warna,
      keteranganLegenda: keterangan,
      gaya: { color: warna, weight: 2, opacity: 0.9, fillColor: warna, fillOpacity: 0.22 },
      ikon,
      warnaIkon: warna,
      popup: (p) =>
        `<div class="font-sans">
          <h3 class="font-bold mb-1" style="color:${warna}">${aman(p.nama || label)}</h3>
          <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.kategori_label || label)}</p>
          <div class="text-xs">
          ${p.kelas ? `<b>Kelas:</b> ${aman(p.kelas)}<br/>` : ''}
          ${p.pengelola ? `<b>Pengelola:</b> ${aman(p.pengelola)}<br/>` : ''}
          ${p.status ? `<b>Status:</b> ${aman(p.status)}<br/>` : ''}
          <b>Provinsi:</b> ${aman(p.provinsi || '-')}</div>
        </div>`,
    },
  ])
);

const POLA_RUANG = {
  url: '/inventarisasi/zonasi/peta/',
  urlWilayah: '/inventarisasi/zonasi/wilayah/',
  legenda: 'zona',
  pilihan: {
    param: 'kategori',
    label: 'Tampilkan peruntukan',
    semua: 'Semua peruntukan',
    opsi: URUTAN_KATEGORI.map((kode) => [kode, KATEGORI_ZONA[kode].label]),
  },
  gaya: (f) => {
    const p = f?.properties || {};
    const warna = warnaZona(p.kategori);
    const garis = gayaKawasan(p.jenis_kode);
    return {
      color: warna,
      weight: garis.weight,
      dashArray: garis.dashArray || undefined,
      fillColor: warna,
      fillOpacity: 0.32,
      opacity: 0.9,
    };
  },
  popup: (p) => {
    const k = kategoriZona(p.kategori);
    return `<div class="font-sans">
      <h3 class="font-bold text-kkp-800 mb-1">${aman(p.nama || 'Zona')}</h3>
      <p class="text-xs mb-2 flex items-center gap-1.5">
        <span style="width:10px;height:10px;border-radius:2px;display:inline-block;background:${k.warna}"></span>
        <span class="font-semibold text-slate-700">${k.label}</span>
      </p>
      <div class="text-xs border-t pt-1">
      ${p.jenis === p.sub_zona ? '' : `<b>Kawasan:</b> ${aman(p.jenis || '-')}<br/>`}
      <b>${p.sumber === 'KKP-RTRW-DARAT' ? 'Peruntukan' : 'Sub-zona'}:</b> ${aman(p.sub_zona || '-')}<br/>
      <b>Instrumen:</b> ${
        {
          'KKP-RTRW': 'Perda RTRW Provinsi',
          'KKP-RTRW-DARAT': 'Pola Ruang darat Perda RTRW Provinsi',
          'KKP-PKKPRL': 'PKKPRL pada RTRW Provinsi',
          'KKP-WFS': 'Rencana Zonasi KAW',
        }[p.sumber] || 'RZWP-3-K'
      }<br/>
      <b>Dasar hukum:</b> ${aman(p.regulasi || '-')}<br/>
      <b>Provinsi:</b> ${aman(p.provinsi || '-')}</div>
      ${TOMBOL_ANALISIS}
    </div>`;
  },
};

export const LAYER_LOKAL = {
  ...Object.fromEntries(
    OSEANOGRAFI.map(([id, citra, label, keteranganLegenda]) => [id, { citra, label, legenda: 'gradasi', keteranganLegenda }])
  ),
  ...Object.fromEntries(
    [
      ['risiko_tsunami', 'TSUNAMI', 'Risiko Tsunami', 'RISIKO', ''],
      [
        'risiko_abrasi',
        'ABRASI',
        'Risiko Gelombang Ekstrem & Abrasi',
        'RISIKO',
        'BNPB menerbitkan gelombang ekstrem dan abrasi sebagai satu indeks gabungan; '
          + 'keduanya tidak dipisahkan di sumbernya.',
      ],
      [
        'risiko_banjir',
        'BANJIR',
        'Risiko Banjir',
        'RISIKO',
        'InaRISK tidak menerbitkan indeks banjir rob tersendiri; indeks ini mencakup '
          + 'banjir sungai maupun genangan pesisir tanpa memisahkannya.',
      ],
    ].map(([id, jenis, label, varian, catatan]) => [
      id,
      {
        url: '/analitik/zona-risiko/peta/',
        params: { jenis, varian },
        label,
        legenda: 'risiko',
        keteranganLegenda:
          `Indeks ${varian === 'BAHAYA' ? 'bahaya' : 'risiko'} BNPB InaRISK `
          + 'dikelompokkan menurut ambangnya sendiri: rendah di bawah 0,33, '
          + 'sedang di bawah 0,67, selebihnya tinggi.'
          + (varian === 'RISIKO'
            ? ' Pesisir yang kosong berarti risikonya NOL, bukan datanya hilang: '
              + 'risiko = bahaya x kerentanan / kapasitas, sehingga pantai tanpa '
              + 'penduduk atau aset bernilai nol meskipun bahayanya tinggi. '
              + 'Diperiksa pada pesisir selatan Jawa Timur — bahaya tsunami 0,283, '
              + 'risikonya 0.'
            : '')
          + (catatan ? ` ${catatan}` : ''),
        gaya: (f) => {
          const warna = warnaKelasRisiko(f && f.properties ? f.properties.kelas : null);
          return {
            color: warna,
            weight: 0.6,
            fillColor: warna,
            fillOpacity: 0.45,
            opacity: 0.8,
          };
        },
        popup: (p) =>
          `<div class="font-sans">
            <h3 class="font-bold mb-1" style="color:${warnaKelasRisiko(p.kelas)}">${aman([p.varian_label, p.jenis_label].filter(Boolean).join(' ') || 'Indeks bencana')}</h3>
            <p class="text-xs text-slate-600 border-b pb-1 mb-1">Kelas ${aman(p.kelas_label || '-')}</p>
            <div class="text-xs"><b>Luas zona:</b> ${aman(p.luas_ha ?? '-')} ha<br/>
            <b>Sumber:</b> ${aman(p.sumber || 'BNPB InaRISK')}</div>
          </div>`,
      },
    ])
  ),

  ...LAPISAN_INFRASTRUKTUR,
  potensi: {
    url: '/analitik/lokasi-potensial/peta/',
    urlWilayah: '/analitik/lokasi-potensial/wilayah/',
    params: { sektor: 'SEMUA', kelas: 'TINGGI' },
    semuaJenis: 'Semua jenis investasi',
    label: 'Peta Sebaran Wilayah Potensial Investasi',
    legenda: 'disarankan',
    ikon: (p) => IKON_JENIS_INVESTASI[p.sektor_kode] || 'bintang',
    warnaIkon: (p) => warnaJenisInvestasi(p.sektor_kode),
    warnaTitik: (p) => (p.jenis?.length ? p.jenis : [p.sektor_kode]).map(warnaJenisInvestasi),
    tooltip: (p) => `Lokasi potensial:
${aman((p.jenis_nama?.length ? p.jenis_nama : [p.sektor]).join(', '))}`,
    zoomPin: 8,
    keteranganLegenda:
      'Setiap titik adalah lokasi potensial untuk satu sub-sektor investasi; warnanya menunjukkan jenisnya dan titik '
      + 'berwarna ganda cocok untuk beberapa jenis. Ini bukan rekomendasi pasti dan bukan pengganti Persetujuan KKPRL. '
      + 'Mulai tingkat provinsi titik menjadi penanda berlambang jenis, dan batas lokasinya dimuat sebagai area analisis '
      + 'saat tombol Analisis lokasi ini di popup diklik; analisis itu memakai aturan yang sama. Lokasi dibentuk dari sel '
      + '250 m (sekitar 6,25 ha) di zona ruang laut atau kawasan Pola Ruang darat RTRW Provinsi di pesisir. Sel harus '
      + 'lolos GERBANG: matriks KKPRL Perda mengizinkan jenis itu (langsung atau bersyarat), tidak berada di wilayah '
      + 'kelola masyarakat hukum adat, di luar alur pelayaran/ALKI (kecuali jasa maritim dan infrastruktur laut), tidak '
      + 'menempati mangrove, lamun, atau terumbu karang bagi jenis yang dapat merusaknya, di luar jarak aman kabel, pipa, '
      + 'dan alur pelayaran, tidak beririsan KKPRL terbit, dan tidak tertutup bangunan. Sesudah itu sel harus memenuhi '
      + 'SEMUA KRITERIA sub-sektornya yang terukur, misalnya klorofil-a 0,3–5 mg/m³, suhu permukaan 26–30 °C, gelombang '
      + 'paling tinggi 2 m, dan jarak ke pelabuhan perikanan paling jauh 100 km untuk perikanan tangkap. Kriteria yang '
      + 'datanya belum tersedia dilewati selama sedikitnya separuh kriteria terukur. Risiko tsunami, abrasi, atau banjir '
      + 'yang tinggi menggugurkan lokasi di darat atau yang menyentuh darat. Ambang kriteria dapat diubah administrator. '
      + 'Setiap wilayah sel yang bersambung ditampilkan sebagai satu titik dengan batas berupa inti terbaiknya, paling '
      + 'luas 1 km x 1 km (100 ha); dalam radius 10 km hanya lokasi terbaik tiap sub-sektor yang ditampilkan. Pada '
      + 'pilihan semua jenis, lokasi yang bertumpuk digabung dan popup menyebut jenis yang cocok; Konservasi & '
      + 'Rehabilitasi Pesisir hanya tampil bila jenis itu dipilih. Kriteria finansial (NPV, IRR, payback) tidak ikut; '
      + 'penilaian proyek tetap dilakukan lewat Analisis lokasi ini.',
    popup: (p) => {
      const jenis = p.jenis?.length ? p.jenis : [p.sektor_kode];
      const nama = p.jenis_nama?.length ? p.jenis_nama : [p.sub_sektor || p.sektor || ''];
      const warna = warnaJenisInvestasi(jenis[0]);
      const luas = Number(p.luas_ha || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 });
      const rencana = p.ranah === 'DARAT' ? 'Pola Ruang darat RTRW Provinsi' : 'rencana tata ruang laut';
      const kriteria = p.kriteria || [];
      const butir = kriteria
        .map((k) => {
          const [tanda, kelasTanda] = k.lulus ? ['&check;', 'text-emerald-600'] : ['?', 'text-slate-400'];
          const nilai = k.nilai_teks ? `: <b class="font-semibold">${aman(k.nilai_teks)}</b>` : k.lulus ? '' : ': belum terukur';
          return `<li class="flex gap-1.5 leading-snug">
             <span class="${kelasTanda} font-bold shrink-0 w-3">${tanda}</span>
             <span>${aman(k.label)}${nilai} <span class="text-slate-400">(syarat ${aman(k.ambang_teks)})</span></span>
           </li>`;
        })
        .join('');
      const gerbang = Array.isArray(p.syarat_dasar) ? p.syarat_dasar : [];
      const peringatan = (p.peringatan || [])
        .map((teks) => `<p class="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800 leading-snug">${aman(teks)}</p>`)
        .join('');

      return `<div class="font-sans w-[19rem] max-w-full">
        <div class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm" style="background:${warna}">${lambangSvg(IKON_JENIS_INVESTASI[jenis[0]], 18)}</span>
          <div class="min-w-0">
            <h3 class="text-[14px] font-bold leading-tight text-slate-900">${nama.length > 1 ? `Cocok untuk ${nama.length} sub-sektor investasi` : `Lokasi potensial ${aman(nama[0])}`}</h3>
            <p class="text-[11px] text-slate-500 leading-snug">${aman(p.nama || '-')} &middot; ${aman(p.provinsi || '-')}</p>
          </div>
        </div>
        ${nama.length > 1
          ? `<div class="mt-2 flex flex-wrap gap-1">${nama.map((n, i) => `<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700"><span class="h-2 w-2 rounded-full" style="background:${warnaJenisInvestasi((p.jenis_sub || jenis)[i] || jenis[0])}"></span>${aman(n)}</span>`).join('')}</div>`
          : ''}
        <div class="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <p class="text-[11px] font-semibold" style="color:${warna}">&check; Semua kriteria terukur terpenuhi${p.total ? ` (${p.terukur} dari ${p.total} kriteria terukur)` : ''}</p>
          <p class="mt-0.5 text-[10px] text-slate-500 leading-tight">Inti lokasi &plusmn;${aman(luas)} ha${p.luas_wilayah_ha > p.luas_ha ? ` dari wilayah sesuai &plusmn;${aman(Number(p.luas_wilayah_ha).toLocaleString('id-ID'))} ha` : ''}</p>
        </div>
        ${gerbang.length
          ? `<div class="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
              <p class="text-[10.5px] font-semibold text-emerald-800">&check; Lolos gerbang Perda KKPRL dan pengecualian</p>
              <p class="mt-0.5 text-[10px] leading-snug text-emerald-900/80">${gerbang.map(aman).join(' &middot; ')}</p>
            </div>`
          : ''}
        ${kriteria.length
          ? `<p class="mt-2 text-[10.5px] font-semibold text-slate-600">Kriteria ${aman(p.sub_sektor || '')}</p>
             <ul class="mt-0.5 text-[11px] space-y-px text-slate-700">${butir}</ul>`
          : '<p class="mt-2 text-[10.5px] text-slate-500">Rincian kriteria tampil setelah Peta Sebaran dihitung ulang.</p>'}
        ${p.status_tata_ruang === 'BERSYARAT'
          ? `<p class="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800 leading-snug">Diizinkan bersyarat oleh ${rencana}; syaratnya tercantum di Analisis lokasi ini.</p>`
          : ''}
        ${peringatan}
        <p class="text-[10px] text-slate-500 mt-1.5 leading-snug">${p.perlu_dinilai?.length ? 'Kriteria bertanda ? belum terukur dan perlu' : 'Kondisi tapak tetap perlu'} dinilai langsung di lapangan.</p>
        <p class="text-[10px] text-slate-400 mt-1 leading-snug">Penyaringan awal dari peta tata ruang berskala provinsi; bukan pengganti Persetujuan KKPRL.</p>
        ${TOMBOL_ANALISIS}
      </div>`;
    },
  },
  kkprl: {
    url: '/inventarisasi/kkprl/peta/',
    urlWilayah: '/inventarisasi/kkprl/wilayah/',
    label: 'KKPRL Nasional',
    legenda: 'jenis',
    keteranganLegenda:
      'Izin kesesuaian kegiatan pemanfaatan ruang laut yang telah terbit, diwarnai menurut jenis investasi. '
      + 'Jenis investasi ditetapkan dari teks kegiatan pada izin. '
      + 'Ditandai titik saat peta masih jauh dan penanda ikon mulai tingkat provinsi — '
      + 'luas rata-ratanya hanya 50 ha sehingga bentuk aslinya baru tergambar setelah diperbesar.',
    zoomPin: 8,
    pilihan: {
      param: 'sektor',
      label: 'Tampilkan jenis investasi',
      semua: 'Semua jenis investasi',
      opsi: [...SECTORS.map((s) => [s.id, s.label]), ['LAINNYA', 'Kegiatan lain']],
    },
    gaya: (f) => {
      const warna = warnaJenisInvestasi(f?.properties?.sektor);
      return { color: warna, weight: 1.5, fillColor: warna, fillOpacity: 0.35 };
    },
    ikon: 'sertifikat',
    warnaIkon: (p) => warnaJenisInvestasi(p.sektor),
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:${warnaJenisInvestasi(p.sektor)}">${aman(p.pemohon || 'Pemegang izin')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.kegiatan || '-')}</p>
        <div class="text-xs"><b>Jenis investasi:</b> ${aman(p.sektor_nama || '-')}<br/>
        <b>No. KKPRL:</b> ${aman(p.nomor_izin || '-')}<br/>
        <b>Status:</b> ${aman(p.status || '-')}<br/>
        <b>Provinsi:</b> ${aman(p.provinsi || '-')}</div>
      </div>`,
  },
  rtrl: {
    url: '/inventarisasi/unsur-ruang/peta/',
    params: { kelompok: 'RTRL' },
    label: 'Rencana Tata Ruang Laut',
    legenda: 'rtrl',
    warnaContoh: '#0056A5',
    gaya: gayaUnsurRtrl,
    ikon: 'bintang',
    warnaIkon: '#dc2626',
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold text-kkp-800 mb-1">${aman(p.nama || 'Unsur ruang laut')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.jenis || '-')}</p>
        <div class="text-xs"><b>Keterangan:</b> ${aman(p.keterangan || '-')}<br/>
        <b>Lapisan:</b> ${aman(p.lapisan || '-')}</div>
      </div>`,
  },

  wilayah_adat: {
    url: '/inventarisasi/unsur-ruang/peta/',
    params: { kelompok: 'MHA' },
    label: 'Wilayah Kelola Masyarakat Hukum Adat',
    warnaContoh: '#b45309',
    ikon: 'rumah',
    warnaIkon: '#b45309',
    warnaTitik: () => ['#b45309'],
    zoomPin: 8,
    keteranganLegenda:
      'Setiap wilayah ditandai titik, dan mulai tingkat provinsi berganti menjadi penanda, agar wilayah yang kecil '
      + 'mudah ditemukan; batas poligonnya tetap tergambar. '
      + 'Perairan yang berada di bawah hak kelola masyarakat hukum adat — wilayah '
      + 'sasi, penangkapan tradisional, dan kegiatan adat — dari Sidako KKP (2024, lengkap '
      + 'dengan nama MHA dan SK penetapannya) dan Portal Satu Data KKP, ditambah zona RTRW '
      + 'Provinsi Papua yang ditandai berada di wilayah kelola '
      + 'adat (data RTRW tidak mencantumkan nama masyarakatnya). Irisan dengan wilayah ini MENAIKKAN risiko sosial sebuah rencana '
      + 'investasi karena ada pihak yang sudah memegang hak atas perairan itu. '
      + 'CAKUPANNYA BARU ENAM PROVINSI (Papua, Papua Barat, Papua Barat Daya, Maluku, '
      + 'Sulawesi Tenggara, Sulawesi Utara), jadi perairan tanpa poligon di sini berarti '
      + 'belum tercatat — bukan berarti tidak ada klaim adat.',
    gaya: () => ({
      color: '#78350f',
      weight: 1.2,
      fillColor: '#b45309',
      fillOpacity: 0.4,
      dashArray: '4 3',
    }),
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:#b45309">${aman(p.nama || 'Wilayah adat')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.jenis || '-')}</p>
        <div class="text-xs">
          <b>Keterangan:</b> ${aman(p.keterangan || '-')}<br/>
          <b>Provinsi:</b> ${aman(p.provinsi || '-')}<br/>
          ${p.luas_ha ? `<b>Luas:</b> ${aman(Math.round(p.luas_ha).toLocaleString('id-ID'))} ha<br/>` : ''}
          ${p.regulasi ? `<b>Dasar:</b> ${aman(p.regulasi)}<br/>` : ''}
        </div>
      </div>`,
  },

  polaruang: {
    ...POLA_RUANG,
    params: { tingkat: 'RTRW_PROVINSI' },
    label: 'RTRW Provinsi (Perda RTRW, PKKPRL & RZWP-3-K)',
    keteranganLegenda:
      'Alokasi ruang laut provinsi dari tiga instrumen. Zona laut dari geodatabase '
      + 'Perda RTRW Provinsi (KKP) menjadi acuan utama; peta arahan PKKPRL dan '
      + 'RZWP-3-K yang lebih lama mengisi perairan yang belum diatur RTRW. Sejak UU '
      + 'Cipta Kerja zonasi laut diintegrasikan ke dalam RTRW provinsi, sehingga '
      + 'RTRWP sebelum 2021 tidak memuat zona laut. Ketiganya disajikan sebagai satu '
      + 'lapisan dan dapat bertumpuk; popup tiap zona menyebutkan instrumen dasarnya, '
      + 'dan screening memakai acuan teratas yang tersedia. Rencana Zonasi KAW '
      + 'disajikan pada lapisan tersendiri.',
  },

  polaruang_darat: {
    ...POLA_RUANG,
    params: { tingkat: 'RTRW_PROVINSI', ranah: 'DARAT' },
    legenda: 'zona_darat',
    pilihan: { ...POLA_RUANG.pilihan, opsi: URUTAN_KATEGORI_DARAT.map((kode) => [kode, KATEGORI_ZONA[kode].label]) },
    label: 'Pola Ruang Darat Pesisir (RTRW Provinsi)',
    keteranganLegenda:
      'Peruntukan ruang darat dari geodatabase Perda RTRW Provinsi (KKP) pada jalur pesisir 100 m sampai 4 km '
      + 'dari zona laut. Dipakai untuk jenis investasi yang berlokasi di darat, misalnya tambak garam di Kawasan '
      + 'Pergaraman, tambak di Kawasan Perikanan, dan unit pengolahan di Kawasan Peruntukan Industri. Sempadan '
      + 'pantai 100 m tidak dimuat. Provinsi yang geodatabase RTRW-nya tidak memuat Pola Ruang belum tersedia.',
  },

  polaruang_kaw: {
    ...POLA_RUANG,
    params: { tingkat: 'KAW' },
    label: 'Rencana Zonasi Kawasan Antarwilayah (KAW)',
    keteranganLegenda:
      'Rencana zonasi untuk perairan yang melintasi lebih dari satu provinsi, '
      + 'ditetapkan dengan Peraturan Presiden. Yang tersedia di basis data baru '
      + 'Perpres No. 83/2020 (perairan Kalimantan Timur, Kalimantan Selatan, Sulawesi '
      + 'Barat, Sulawesi Selatan, dan Sulawesi Tengah). Screening memakai KAW untuk '
      + 'bagian area yang tidak diatur RTRW Provinsi.',
  },
};
