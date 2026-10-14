import { gayaUnsurRtrl } from '../../utils/simbologiPeta';
import { warnaKelasRisiko } from '../../utils/simbologiPeta';
import { garisKelasKelayakan, warnaKelasKelayakan } from '../../utils/simbologiPeta';
import {
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
    'Kedalaman laut dari batimetri NOAA ETOPO1 (resolusi 1 menit busur).'],
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
    ikon: 'bintang',
    warnaIkon: (p) => warnaKelasKelayakan(p.kelas),
    zoomBidang: 12,
    keteranganLegenda:
      'Setiap titik adalah lokasi potensial untuk sebuah jenis investasi; batas lokasinya tampak setelah peta '
      + 'diperbesar. Lokasi dibentuk dari sel 250 m (sekitar 6,25 ha) di zona ruang laut, atau kawasan Pola Ruang darat '
      + 'RTRW Provinsi di pesisir, yang peruntukannya mengizinkan jenis itu, karakter lokasinya cocok (misalnya tambak '
      + 'garam dan unit pengolahan di darat pesisir, budi daya laut di perairan 1 sampai 30 m, OTEC di perairan dalam; '
      + 'kedalaman dan gelombang bersifat indikatif), tidak beririsan KKPRL terbit, tidak tertutup bangunan atau '
      + 'struktur menurut OpenStreetMap dan data infrastruktur KKP, dan berada dalam jarak ideal infrastruktur pendukung '
      + '(pelabuhan, jalan, listrik, atau kawasan industri). Sebuah sel masuk bila sedikitnya 75% parameter yang '
      + 'terukur di sel itu sangat sesuai: peruntukan diizinkan tanpa syarat, karakter lokasi, risiko tsunami, gelombang '
      + 'ekstrem dan abrasi, serta banjir yang rendah, tidak beririsan ekosistem sensitif, dekat infrastruktur pendukung, '
      + 'dan di luar wilayah kelola masyarakat hukum adat. Setiap wilayah sel yang bersambung ditampilkan sebagai satu '
      + 'titik dengan batas berupa inti terbaiknya, paling luas 1 km x 1 km (100 ha): persentase tertinggi, lalu paling '
      + 'dekat infrastruktur. Dalam radius 10 km hanya lokasi terbaik yang ditampilkan, sehingga titik tidak '
      + 'berdempetan; wilayah sesuai lain di sekitarnya dapat diperiksa lewat Analisis lokasi. Parameter '
      + 'yang tidak sangat sesuai atau tidak terukur disebut di popup sebagai hal yang perlu dinilai langsung di '
      + 'lapangan. Pada pilihan semua jenis, lokasi yang bertumpuk digabung dan popup menyebut jenis yang cocok; '
      + 'dalam radius 10 km dipilih yang persentasenya tertinggi, lalu yang cocok untuk paling banyak jenis; '
      + 'Konservasi & Rehabilitasi Pesisir hanya tampil bila jenis itu dipilih. Pada tampilan seluruh Indonesia yang '
      + 'tampil adalah lokasi dengan persentase tertinggi; perbesar peta untuk melihat lokasi lainnya. Kriteria '
      + 'finansial proyek (NPV, IRR, payback, ROI) tidak ikut; penilaian proyek tetap dilakukan lewat Analisis lokasi ini.',
    gaya: (f) => {
      const kelas = f && f.properties ? f.properties.kelas : null;
      return {
        color: garisKelasKelayakan(kelas),
        weight: 1,
        fillColor: warnaKelasKelayakan(kelas),
        fillOpacity: 0.55,
        opacity: 0.9,
      };
    },
    popup: (p) => {
      const warna = warnaKelasKelayakan(p.kelas);
      const luas = Number(p.luas_ha || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 });
      const rencana = p.ranah === 'DARAT' ? 'Pola Ruang darat RTRW Provinsi' : 'rencana tata ruang laut';
      const butir = Object.entries(p.parameter || {})
        .map(([label, bagian]) => {
          const [tanda, kelasTanda, ket] = bagian === null
            ? ['?', 'text-slate-400', ' (tidak terukur)']
            : bagian >= 100
              ? ['&check;', 'text-emerald-600', '']
              : ['!', 'text-amber-600', ` (${bagian}% luas)`];
          return `<li class="flex gap-1.5 leading-snug">
             <span class="${kelasTanda} font-bold shrink-0">${tanda}</span>
             <span>${aman(label)}${ket}</span>
           </li>`;
        })
        .join('');

      return `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:${warna}">Lokasi potensial ${aman(p.sektor || '')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.nama || '-')} &middot; ${aman(p.provinsi || '-')}</p>
        <div class="text-xs mb-1.5">
          <span class="font-bold text-base" style="color:${warna}">${aman(p.persen_sesuai)}%</span>
          <span class="text-slate-500"> parameter terukur sangat sesuai &middot; ${aman(luas)} ha</span>
        </div>
        ${p.luas_wilayah_ha > p.luas_ha
          ? `<p class="text-[10px] text-slate-500 mb-1 leading-snug">Inti terbaik dari wilayah sesuai seluas &plusmn;${aman(Number(p.luas_wilayah_ha).toLocaleString('id-ID'))} ha: persentase tertinggi, lalu paling dekat infrastruktur.</p>`
          : ''}
        ${p.jenis_nama?.length
          ? `<p class="text-[11px] text-slate-700 mb-1 leading-snug"><b>Cocok untuk:</b> ${aman(p.jenis_nama.join(', '))}</p>`
          : ''}
        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Parameter terukur</p>
        <ul class="text-[11px] space-y-0.5 mb-1">${butir}</ul>
        ${p.status_tata_ruang === 'BERSYARAT'
          ? `<p class="text-[10px] text-amber-700 mt-1 leading-snug">Diizinkan bersyarat oleh ${rencana}; syaratnya tercantum di Analisis lokasi ini.</p>`
          : ''}
        ${p.perlu_dinilai?.length
          ? `<p class="text-[10px] text-slate-600 mt-1 leading-snug"><b>Perlu dinilai langsung di lapangan:</b> ${aman(p.perlu_dinilai.join('; '))}, serta parameter yang belum terukur di aplikasi seperti kualitas air dan substrat.</p>`
          : '<p class="text-[10px] text-slate-600 mt-1 leading-snug">Parameter yang belum terukur di aplikasi, seperti kualitas air dan substrat, tetap perlu dinilai langsung di lapangan.</p>'}
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
    keteranganLegenda:
      'Perairan yang berada di bawah hak kelola masyarakat hukum adat — wilayah '
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
