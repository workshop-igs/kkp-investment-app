import { KATEGORI_RTRL, gayaUnsurRtrl } from '../../utils/simbologiPeta';
import { warnaKelasRisiko } from '../../utils/simbologiPeta';
import {
  IKON_JENIS_INVESTASI,
  KATEGORI_ZONA,
  URUTAN_KATEGORI,
  URUTAN_KATEGORI_DARAT,
  URUTAN_ZONA_RPZ,
  gayaKawasan,
  kategoriZona,
  warnaJenisInvestasi,
  warnaZona,
} from '../../utils/simbologiPeta';
import { SECTORS } from '../../utils/konstanta';
import { API_V1_URL } from '../../api/alamat';
import { getAccessToken } from '../../api/autentikasi';
import { api } from '../../api/klien';
import { rupiahRingkas } from '../../utils/pemformat';
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

export const CITRA_KOSONG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const penanganCitra = (catat) => {
  const gagal = { memuat: false, galat: 'Gambar layer tidak tersedia' };
  return {
    add: () => catat({ memuat: true }),
    load: (e) => catat(e.target.getElement()?.src === CITRA_KOSONG ? gagal : { memuat: false }),
    error: () => catat(gagal),
    remove: () => catat(null),
  };
};

const OSEANOGRAFI = [
  ['osea_suhu', 'SUHU', 'Suhu Permukaan Laut', 'Rata-rata suhu permukaan laut 12 bulan terakhir (Sidako KKP).', 'Sidako KKP'],
  ['osea_anomali', 'ANOMALI_SUHU', 'Anomali Suhu Permukaan Laut',
    'Selisih suhu dari rata-rata jangka panjangnya; nilai positif tinggi menandai stres panas bagi karang dan budidaya.', 'Sidako KKP'],
  ['osea_klorofil', 'KLOROFIL', 'Kesuburan Laut (Klorofil)', 'Kadar klorofil-a dari satelit MODIS, petunjuk kesuburan perairan; makin tinggi makin subur.'],
  ['osea_gelombang', 'GELOMBANG', 'Tinggi Gelombang Signifikan', 'Rata-rata tinggi gelombang 12 bulan terakhir (WaveWatch III).'],
  ['osea_kedalaman', 'KEDALAMAN', 'Kedalaman Laut', 'Kedalaman laut dari batimetri SRTM15+.'],
  ['osea_kemiringan_dasar', 'KEMIRINGAN_DASAR', 'Kemiringan Dasar Laut', 'Kemiringan dasar laut dari batimetri SRTM15+.'],
  ['osea_arus', 'ARUS', 'Kecepatan Arus Permukaan', 'Rata-rata kecepatan arus permukaan setahun (HYCOM).'],
  ['osea_salinitas', 'SALINITAS', 'Salinitas Permukaan Laut', 'Rata-rata kadar garam air laut setahun (HYCOM).'],
  ['osea_ph', 'PH', 'pH Permukaan Laut', 'Rata-rata pH air laut 2020–2024 (OceanSODA-ETHZ, NOAA).'],
  ['osea_oksigen', 'OKSIGEN', 'Oksigen Terlarut', 'Rata-rata oksigen terlarut di permukaan laut (NOAA World Ocean Atlas 2023).'],
  ['osea_arus_dasar', 'ARUS_DASAR', 'Kecepatan Arus Dasar',
    'Kecepatan arus di dekat dasar laut (HYCOM); penting untuk kabel, pipa, dan bangunan laut.'],
  ['osea_gelombang_ekstrem', 'GELOMBANG_EKSTREM', 'Gelombang Ekstrem 50 Tahunan',
    'Perkiraan gelombang terbesar yang terjadi sekali dalam 50 tahun (WaveWatch III).'],
  ['osea_pasut', 'PASUT', 'Tunggang Pasang Surut', 'Selisih muka air pasang tertinggi dan surut terendah (EOT20).'],
  ['osea_beda_suhu', 'BEDA_SUHU_1000M', 'Potensi Energi Panas Laut',
    'Selisih suhu permukaan dan kedalaman 1.000 m (World Ocean Atlas), dasar energi panas laut (OTEC).'],
  ['osea_kd490', 'KD490', 'Kejernihan Air Laut', 'Kejernihan air (Kd490) dari satelit MODIS; makin kecil makin jernih.'],
  ['osea_periode', 'PERIODE_GLB', 'Periode Gelombang', 'Rata-rata periode gelombang 12 bulan terakhir (WaveWatch III).'],
  ['iklim_hujan', 'CURAH_HUJAN', 'Curah Hujan Bulanan', 'Rata-rata curah hujan bulanan 12 bulan terakhir (CHIRPS).'],
  ['iklim_kering', 'BULAN_KERING', 'Bulan Kering Berturut-turut',
    'Jumlah bulan berturut-turut dengan hujan di bawah 50 mm dalam setahun terakhir (CHIRPS).'],
  ['iklim_kemiringan', 'KEMIRINGAN', 'Kemiringan Lahan', 'Kemiringan lahan darat dari Copernicus DEM.'],
  ['iklim_liat', 'TANAH_LIAT', 'Kandungan Tanah Liat', 'Kandungan liat tanah lapisan atas (SoilGrids).'],
  ['iklim_angin', 'ANGIN_100M', 'Potensi Tenaga Angin', 'Kecepatan angin rata-rata pada ketinggian 100 m (Global Wind Atlas).'],
  ['iklim_ghi', 'GHI', 'Potensi Tenaga Surya', 'Rata-rata energi matahari harian, iradiasi surya global atau GHI (NASA POWER).'],
  ['risiko_pga', 'PGA', 'Kekuatan Guncangan Gempa',
    'Percepatan tanah puncak (PGA) akibat gempa yang mungkin terjadi dalam 50 tahun (GEM).'],
  ['risiko_laju_abrasi', 'ABRASI_PANTAI', 'Laju Abrasi Garis Pantai', 'Laju mundurnya garis pantai 1984–2015 (JRC).'],
  ['pesisir_eks_mangrove', 'LUAS_EKS_MANGROVE', 'Bekas Hutan Mangrove',
    'Mangrove yang hilang antara 1996 dan 2020 (Global Mangrove Watch), diwarnai menurut luas hamparannya.'],
  ['pesisir_produksi_kab', 'PRODUKSI_KABUPATEN', 'Perkiraan Produksi Ikan Kabupaten',
    'Perkiraan produksi perikanan tangkap per kabupaten/kota, dibagi dari angka provinsi BPS.'],
  ['osea_shannon', 'SHANNON', 'Keanekaragaman Hayati Laut',
    'Indeks keanekaragaman spesies laut (Shannon) dari catatan OBIS; sel dengan catatan terlalu sedikit dikosongkan.'],
  ['tangkap_siang', 'TANGKAP_SIANG', 'Aktivitas Penangkapan Ikan Siang',
    'Jam penangkapan kapal berpelacak AIS pukul 06.00–18.00 selama 12 bulan terakhir; perahu tanpa AIS tidak terlihat. '
    + 'Powered by Global Fishing Watch.', 'Global Fishing Watch'],
  ['tangkap_malam', 'TANGKAP_MALAM', 'Aktivitas Penangkapan Ikan Malam',
    'Jam penangkapan kapal berpelacak AIS pukul 18.00–06.00 selama 12 bulan terakhir; perahu tanpa AIS tidak terlihat. '
    + 'Powered by Global Fishing Watch.', 'Global Fishing Watch'],
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
   'Bandar udara berkode IATA/ICAO (OpenStreetMap)'],
  ['infra_gardu_induk', 'GARDU_INDUK', 'Gardu Induk', '#9a3412', 'gardu',
   'Gardu induk listrik (OpenStreetMap)'],
  ['infra_listrik_tm', 'JARINGAN_LISTRIK_TM', 'Jaringan Listrik 20 kV', '#ca8a04', null,
   'Jaringan listrik tegangan menengah 20 kV (OpenStreetMap)'],
  ['infra_kampus_riset', 'KAMPUS_RISET', 'Kampus & Lembaga Riset', '#4338ca', 'toga',
   'Perguruan tinggi dan lembaga riset (OpenStreetMap)'],
  ['infra_muara', 'MUARA_SUNGAI', 'Muara Sungai Besar', '#0284c7', 'sungai',
   'Muara sungai besar (HydroRIVERS)'],
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
      ${p.zona_rpz_label ? `<b>Zona kawasan konservasi:</b> ${aman(p.zona_rpz_label)}<br/>` : ''}
      <b>Instrumen:</b> ${
        {
          'KKP-RTRW': 'Perda RTRW Provinsi',
          'KKP-RTRW-DARAT': 'Pola Ruang darat Perda RTRW Provinsi',
          'KKP-PKKPRL': 'PKKPRL pada RTRW Provinsi',
          'KKP-WFS': 'Rencana Zonasi KAW',
          'KKP-RZKAW': 'Rencana Zonasi KAW (IGT KKP)',
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
    OSEANOGRAFI.map(([id, citra, label, keteranganLegenda, sumberData = 'NOAA (lewat ERDDAP)']) => [
      id, { citra, label, legenda: 'gradasi', keteranganLegenda, sumberData },
    ])
  ),
  ...Object.fromEntries(
    [
      ['risiko_tsunami', 'TSUNAMI', 'Risiko Tsunami', 'RISIKO', ''],
      [
        'risiko_abrasi',
        'ABRASI',
        'Risiko Gelombang Ekstrem & Abrasi',
        'RISIKO',
        'Gelombang ekstrem dan abrasi diterbitkan BNPB sebagai satu indeks.',
      ],
      [
        'risiko_banjir',
        'BANJIR',
        'Risiko Banjir',
        'RISIKO',
        'Mencakup banjir sungai dan genangan pesisir.',
      ],
    ].map(([id, jenis, label, varian, catatan]) => [
      id,
      {
        url: '/analitik/zona-risiko/peta/',
        params: { jenis, varian },
        label,
        legenda: 'risiko',
        keteranganLegenda:
          `Indeks ${varian === 'BAHAYA' ? 'bahaya' : 'risiko'} BNPB InaRISK.`
          + (varian === 'RISIKO' ? ' Pesisir tanpa warna berarti risikonya nol karena tidak ada penduduk atau aset, bukan data hilang.' : '')
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
    gaya: (f) => {
      const warna = warnaJenisInvestasi(f.properties?.sektor_kode);
      return { color: warna, weight: 2, opacity: 0.9, dashArray: '6 4', fillColor: warna, fillOpacity: 0.25 };
    },
    tooltip: (p) => `Lokasi potensial:
${aman((p.jenis_nama?.length ? p.jenis_nama : [p.sektor]).join(', '))}`,
    zoomPin: 8,
    keteranganLegenda:
      'Lokasi yang diizinkan matriks Perda dan memenuhi kriteria unggulan jenis investasinya dengan skor mutu tinggi. '
      + 'Saat peta diperbesar, lokasi tampil sebagai area indikatif, bukan batas tapak. Warna menunjukkan jenis '
      + 'investasi. Klik lokasi lalu Analisis lokasi ini untuk penilaian lengkap. Bukan pengganti Persetujuan KKPRL.',
    popup: (p) => {
      const jenis = p.jenis?.length ? p.jenis : [p.sektor_kode];
      const nama = p.jenis_nama?.length ? p.jenis_nama : [p.sub_sektor || p.sektor || ''];
      const warna = warnaJenisInvestasi(jenis[0]);
      const luas = Number(p.luas_ha || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 });
      const rencana = p.ranah === 'DARAT' ? 'Pola Ruang darat RTRW Provinsi' : 'rencana tata ruang laut';
      const kriteria = p.kriteria || [];
      const butir = kriteria
        .map((k) => {
          const [tanda, kelasTanda] = k.informasi ? ['i', 'text-slate-400'] : k.lulus ? ['&check;', 'text-emerald-600'] : ['?', 'text-slate-400'];
          const nilai = k.nilai_teks ? `: <b class="font-semibold">${aman(k.nilai_teks)}</b>` : k.lulus ? '' : ': belum terukur';
          return `<li class="flex gap-1.5 leading-snug">
             <span class="${kelasTanda} font-bold shrink-0 w-3">${tanda}</span>
             <span>${aman(k.label)}${k.pelengkap ? ' <span class="text-slate-400">(pelengkap)</span>' : ''}${nilai} <span class="text-slate-400">(${k.informasi ? '' : 'syarat unggulan '}${aman(k.ambang_teks)}${k.mutu != null ? `; mutu ${k.mutu}` : ''})</span></span>
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
            ${p.alamat ? `<p class="text-[11px] text-slate-500 leading-snug">${aman(p.alamat)}</p>` : ''}
            ${p.wpp ? `<p class="text-[11px] text-slate-500 leading-snug">${aman(p.wpp)}</p>` : ''}
          </div>
        </div>
        ${nama.length === 1 && p.kbli ? `<p class="mt-1.5 text-[11px] text-slate-600 leading-snug"><b class="font-semibold">KBLI ${aman(p.kbli.kode)}</b> &middot; ${aman(p.kbli.judul)}</p>` : ''}
        ${nama.length > 1
          ? `<div class="mt-2 flex flex-wrap gap-1">${nama.map((n, i) => `<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700"><span class="h-2 w-2 rounded-full" style="background:${warnaJenisInvestasi((p.jenis_sub || jenis)[i] || jenis[0])}"></span>${aman(n)}</span>`).join('')}</div>`
          : ''}
        <div class="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <p class="flex items-baseline justify-between gap-2 text-[11px] font-semibold" style="color:${warna}"><span>Skor mutu lokasi</span><span class="text-[15px] tabular-nums">${Math.round(Number(p.persen_sesuai || 0))}<span class="text-[10px] font-medium text-slate-400">/100</span></span></p>
          <p class="mt-0.5 text-[10px] text-slate-500 leading-tight">Semua batas unggulan terpenuhi${p.total ? ` (${p.terukur} dari ${p.total} kriteria terukur)` : ''}</p>
          <p class="mt-0.5 text-[10px] text-slate-500 leading-tight">${p.luas_wilayah_ha > p.luas_ha ? `Area indikatif &plusmn;${aman(Number(p.luas_wilayah_ha).toLocaleString('id-ID'))} ha; Analisis lokasi ini menilai inti terbaik &plusmn;${aman(luas)} ha di dalamnya` : `Area indikatif &plusmn;${aman(luas)} ha`}</p>
        </div>
        <div data-nilai-investasi></div>
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
    saatBuka: (elemen, idFitur) => {
      const kotak = elemen?.querySelector('[data-nilai-investasi]');
      if (!kotak || idFitur === undefined || idFitur === null || !getAccessToken()) return;
      api.get(`/analitik/lokasi-potensial/${idFitur}/nilai/`).then(({ data }) => {
        const ada = (data?.nilai || []).filter((n) => n.nilai_investasi);
        if (!ada.length) return;
        const rp = (v) => `Rp ${rupiahRingkas(v)}`;
        const persen = (v) => `${Math.round(v * 100)}%`;
        const angkaId = (v) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 });
        const garis = 'mt-1 flex justify-between gap-2 border-t border-slate-100 pt-1 font-semibold';
        const daftar = (isi, tanda = '') => `<ul class="mt-1 space-y-px">${Object.entries(isi).map(([k, v]) => `<li class="flex justify-between gap-2"><span>${aman(k)}</span><span class="tabular-nums">${tanda}${rp(v)}</span></li>`).join('')}</ul>`;
        const per = (n) => (n.per_hektar ? 'hektar' : 'unit');
        const jumlahUnit = (n) => (n.per_hektar
          ? `Luas dimanfaatkan: ${angkaId(n.luas_ha)} ha &times; ${persen(n.porsi)} = <b class="font-semibold text-slate-800">${angkaId(n.unit)} ha</b>${n.unit === 1 && n.luas_ha * n.porsi < 1 ? ' (paling sedikit 1 ha)' : ''}`
          : 'Dihitung <b class="font-semibold text-slate-800">1 unit</b>; model usaha per unit tidak bergantung luas lokasi.');
        const GAYA = {
          modal: { kartu: 'bg-[#0056A5]/[0.06] ring-[#0056A5]/20 hover:bg-[#0056A5]/10 aria-expanded:ring-2 aria-expanded:ring-[#0056A5]/60', label: 'text-[#0056A5]', total: 'text-[#0056A5]' },
          untung: { kartu: 'bg-emerald-50 ring-emerald-200 hover:bg-emerald-100/70 aria-expanded:ring-2 aria-expanded:ring-emerald-500/70', label: 'text-emerald-700', total: 'text-emerald-700' },
        };
        const kartu = (id, jenis, judul, nilai, ket) => `<button type="button" data-rincian="${id}" aria-expanded="false" class="group flex min-w-0 flex-col rounded-lg px-2.5 py-2 text-left ring-1 ring-inset transition ${GAYA[jenis].kartu}">
          <span class="text-[10.5px] font-semibold leading-tight ${GAYA[jenis].label}">${judul}</span>
          <span class="mt-0.5 text-[16px] font-bold leading-tight tabular-nums text-slate-900">${rp(nilai)}</span>
          <span class="mt-0.5 flex items-center justify-between gap-1 text-[10px] leading-tight text-slate-500">${ket}<span class="shrink-0 transition-transform group-aria-expanded:rotate-180">&#9662;</span></span>
        </button>`;
        const panel = (id, jenis, judul, isi, nilai) => `<div data-panel="${id}" hidden class="mt-1.5 rounded-lg bg-white px-2.5 py-2 text-[10.5px] leading-snug text-slate-600 ring-1 ring-slate-200">
          <p class="mb-1 text-[11px] font-semibold text-slate-800">${judul}</p>
          ${isi}
          <p class="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1 text-[11.5px] font-bold ${GAYA[jenis].total}"><span>Hasil</span><span class="tabular-nums">${rp(nilai)}</span></p>
        </div>`;
        const hitungModal = (n) => `<p>Model usaha acuan: <b class="font-semibold text-slate-800">${aman(n.satuan_usaha)}</b></p>
          ${daftar(n.komponen)}
          <p class="${garis} text-slate-800"><span>Modal per ${per(n)}</span><span class="tabular-nums">${rp(n.modal_per_unit)}</span></p>
          <p class="mt-1">${jumlahUnit(n)}</p>
          <p class="mt-1 text-slate-500">${rp(n.modal_per_unit)} &times; ${angkaId(n.unit)}</p>`;
        const hitungUntung = (n, k) => `<p>Produksi per ${per(n)}: <b class="font-semibold text-slate-800">${angkaId(k.volume)} ${aman(k.satuan_produk)}</b> &times; ${rp(k.harga)}</p>
          <p class="${garis} text-slate-800"><span>Pendapatan per tahun</span><span class="tabular-nums">${rp(k.pendapatan)}</span></p>
          ${daftar(k.operasional, '&minus;')}
          <p class="${garis} text-slate-800"><span>Keuntungan per ${per(n)}</span><span class="tabular-nums">${rp(k.laba)}</span></p>
          <p class="mt-1">${jumlahUnit(n)}</p>
          <p class="mt-1 text-slate-500">${rp(k.laba)} &times; ${angkaId(n.unit)}; sebelum pajak dan penyusutan</p>`;
        const blok = (n, i) => `<div>
          ${ada.length > 1 ? `<p class="mb-1 text-[11px] font-semibold text-slate-700">${aman(n.sub_jenis)}</p>` : ''}
          <div class="grid ${n.keuntungan ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5">
            ${kartu(`m${i}`, 'modal', 'Nilai investasi', n.nilai_investasi, 'modal awal')}
            ${n.keuntungan ? kartu(`u${i}`, 'untung', 'Keuntungan per tahun', n.keuntungan.nilai_per_tahun, 'sebelum pajak') : ''}
          </div>
          ${panel(`m${i}`, 'modal', 'Hitungan nilai investasi', hitungModal(n), n.nilai_investasi)}
          ${n.keuntungan ? panel(`u${i}`, 'untung', 'Hitungan keuntungan per tahun', hitungUntung(n, n.keuntungan), n.keuntungan.nilai_per_tahun) : ''}
        </div>`;
        kotak.innerHTML = `<div class="mt-2">
          <div class="space-y-2">${ada.map(blok).join('')}</div>
          <p class="mt-1.5 text-[10px] leading-tight text-slate-500">Perkiraan bila lokasi direalisasikan, dari model usaha sub-jenisnya. Klik kartu untuk melihat hitungan.</p>
        </div>`;
        kotak.querySelectorAll('[data-rincian]').forEach((tombol) => tombol.addEventListener('click', () => {
          const buka = tombol.getAttribute('aria-expanded') !== 'true';
          kotak.querySelectorAll('[data-rincian]').forEach((t) => t.setAttribute('aria-expanded', 'false'));
          kotak.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = true; });
          tombol.setAttribute('aria-expanded', String(buka));
          kotak.querySelector(`[data-panel="${tombol.dataset.rincian}"]`).hidden = !buka;
        }));
      }).catch(() => {});
    },
  },
  kkprl: {
    url: '/inventarisasi/kkprl/peta/',
    urlWilayah: '/inventarisasi/kkprl/wilayah/',
    label: 'KKPRL Terbit',
    legenda: 'jenis',
    keteranganLegenda: 'Izin pemanfaatan ruang laut (Persetujuan KKPRL) yang sudah terbit, diwarnai menurut jenis investasinya.',
    zoomPin: 8,
    pilihan: {
      param: 'sektor',
      label: 'Tampilkan jenis investasi',
      semua: 'Semua jenis investasi',
      get opsi() {
        return [...SECTORS.map((s) => [s.id, s.label]), ['LAINNYA', 'Kegiatan lain']];
      },
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
  iup_esdm: {
    url: '/inventarisasi/izin-tambang/peta/',
    urlWilayah: '/inventarisasi/izin-tambang/wilayah/',
    label: 'Izin Tambang (IUP)',
    legenda: 'tunggal',
    warnaContoh: '#92400e',
    keteranganLegenda: 'Wilayah izin usaha pertambangan (IUP dan IUPK Minerba) yang mulai berlaku dalam 5 tahun terakhir.',
    sumberData: 'Geoportal ESDM (Ditjen Minerba)',
    zoomPin: 8,
    gaya: { color: '#92400e', weight: 1.5, fillColor: '#b45309', fillOpacity: 0.3 },
    ikon: 'kristal',
    warnaIkon: '#92400e',
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:#92400e">${aman(p.nama || 'Pemegang izin')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman([p.jenis_izin, p.kegiatan, p.komoditas].filter(Boolean).join(' · '))}</p>
        <div class="text-xs"><b>No. SK:</b> ${aman(p.sk || '-')}<br/>
        <b>Berlaku:</b> ${aman(p.berlaku || '-')}${p.berakhir ? ` s.d. ${aman(p.berakhir)}` : ''}<br/>
        <b>Luas:</b> ${aman(String(p.luas_ha ?? '-'))} ha<br/>
        <b>Wilayah:</b> ${aman([p.kabupaten, p.provinsi].filter(Boolean).join(', ') || '-')}</div>
      </div>`,
  },
  batas_kecamatan: {
    url: '/inti/kecamatan/peta/',
    urlWilayah: '/inti/kecamatan/wilayah/',
    label: 'Batas Kecamatan',
    legenda: 'tunggal',
    warnaContoh: '#f59e0b',
    keteranganLegenda: 'Batas kecamatan. Klik sebuah kecamatan untuk melihat nama, kode Kemendagri, dan kabupatennya.',
    sumberData: 'Portal Satu Data KKP',
    gaya: { color: '#f59e0b', weight: 2.2, dashArray: '8 5', fillColor: '#f59e0b', fillOpacity: 0 },
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold text-slate-800 mb-1">Kecamatan ${aman(p.nama || '-')}</h3>
        <div class="text-xs"><b>Kode Kemendagri:</b> ${aman(p.kode || '-')}<br/>
        <b>Wilayah:</b> ${aman([p.kabupaten, p.provinsi].filter(Boolean).join(', ') || '-')}</div>
      </div>`,
  },
  batas_desa: {
    url: '/inti/desa-kelurahan/peta/',
    urlWilayah: '/inti/desa-kelurahan/wilayah/',
    label: 'Batas Desa/Kelurahan',
    legenda: 'tunggal',
    warnaContoh: '#fcd34d',
    keteranganLegenda: 'Batas desa dan kelurahan skala 1:10.000. Perbesar peta atau pilih provinsi untuk melihat semua desa.',
    sumberData: 'Badan Informasi Geospasial',
    gaya: { color: '#fcd34d', weight: 1.3, dashArray: '2 4', fillColor: '#fcd34d', fillOpacity: 0 },
    popup: (p) =>
      `<div class="font-sans">
        <h3 class="font-bold text-slate-800 mb-1">${aman(p.jenis || 'Desa')} ${aman(p.nama || '-')}</h3>
        <div class="text-xs"><b>Kode Kemendagri:</b> ${aman(p.kode || '-')}<br/>
        <b>Wilayah:</b> ${aman([p.kecamatan && `Kec. ${p.kecamatan}`, p.kabupaten, p.provinsi].filter(Boolean).join(', ') || '-')}</div>
      </div>`,
  },
  ...Object.fromEntries(
    [
      ['rtrl', 'Kabel & Pipa Bawah Laut', ['KABEL', 'PIPA'],
        'Kabel dan pipa di dasar laut menurut RTRL Nasional; sekitarnya tidak boleh untuk jangkar, keramba, atau pengerukan.'],
      ['rtrl_alur', 'Alur Pelayaran Kapal', ['ALUR_PELAYARAN'],
        'Alur pelayaran dan ALKI menurut RTRL Nasional; badan alur harus bebas dari bangunan dan budidaya.'],
      ['rtrl_migrasi', 'Jalur Migrasi Satwa Laut', ['MIGRASI_BIOTA'],
        'Jalur migrasi penyu, paus, dan lumba-lumba menurut RTRL Nasional; kegiatan di sekitarnya perlu menjaga jalur ini.'],
      ['rtrl_ksnt', 'Kawasan Strategis Nasional (KSNT)', ['KSNT'],
        'Kawasan Strategis Nasional Tertentu menurut RTRL Nasional, seperti situs warisan dunia dan cadangan karbon biru.'],
    ].map(([id, label, jenisRtrl, keteranganLegenda]) => [
      id,
      {
        url: '/inventarisasi/unsur-ruang/peta/',
        params: { kelompok: 'RTRL', jenis_unsur: jenisRtrl.join(',') },
        label,
        legenda: 'rtrl',
        jenisRtrl,
        keteranganLegenda,
        warnaContoh: KATEGORI_RTRL[jenisRtrl[0]].warna,
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
    ])
  ),

  ...Object.fromEntries(
    [
      ['eko_karang', 'TERUMBU_KARANG', 'Terumbu Karang', '#f43f5e', 'Sebaran terumbu karang Sidako KKP; dipakai untuk wisata bahari, bioteknologi, dan larangan budidaya.'],
      ['eko_lamun', 'LAMUN', 'Padang Lamun', '#16a34a', 'Sebaran padang lamun Sidako KKP; kegiatan yang merusak lamun tidak diizinkan di atasnya.'],
      ['eko_mangrove', 'MANGROVE', 'Mangrove', '#065f46', 'Mangrove dari peta KKP dan Global Mangrove Watch 2020; kegiatan yang merusak mangrove tidak diizinkan di atasnya.'],
    ].map(([id, jenis, label, warna, keteranganLegenda]) => [
      id,
      {
        url: '/inventarisasi/sumber-daya/peta/',
        params: { jenis },
        label,
        warnaContoh: warna,
        keteranganLegenda,
        gaya: () => ({ color: warna, weight: 0.8, fillColor: warna, fillOpacity: 0.5, opacity: 0.9 }),
        popup: (p) =>
          `<div class="font-sans">
            <h3 class="font-bold mb-1" style="color:${warna}">${aman(p.jenis || label)}</h3>
            <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.nama || '-')}</p>
            <div class="text-xs">
              ${p.kondisi ? `<b>Kondisi:</b> ${aman(p.kondisi)}<br/>` : ''}
              <b>Luas:</b> ${aman((p.luas_ha ?? 0).toLocaleString('id-ID'))} ha<br/>
              <b>Provinsi:</b> ${aman(p.provinsi || '-')}<br/>
              <b>Sumber:</b> ${aman(p.sumber || '-')}${p.tahun ? ` (${aman(p.tahun)})` : ''}
            </div>
          </div>`,
      },
    ])
  ),

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
      'Perairan yang dikelola masyarakat hukum adat (Sidako dan Portal Satu Data KKP). Baru mencakup enam provinsi; '
      + 'perairan tanpa poligon belum tentu bebas klaim adat.',
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
    label: 'RTRW Provinsi',
    keteranganLegenda:
      'Zonasi ruang laut provinsi dari Perda RTRW, dilengkapi PKKPRL dan RZWP-3-K untuk perairan yang belum diatur.',
  },

  polaruang_darat: {
    ...POLA_RUANG,
    params: { tingkat: 'RTRW_PROVINSI', ranah: 'DARAT' },
    legenda: 'zona_darat',
    pilihan: { ...POLA_RUANG.pilihan, opsi: URUTAN_KATEGORI_DARAT.map((kode) => [kode, KATEGORI_ZONA[kode].label]) },
    label: 'RTRW Provinsi (Darat Pesisir)',
    keteranganLegenda:
      'Peruntukan lahan pesisir (100 m–4 km dari laut) dari Perda RTRW Provinsi, untuk investasi di darat seperti tambak '
      + 'dan pengolahan.',
  },

  polaruang_kaw: {
    ...POLA_RUANG,
    params: { tingkat: 'KAW' },
    label: 'RZ KAW (Kawasan Antarwilayah)',
    keteranganLegenda:
      'Rencana zonasi perairan lintas provinsi. Kawasan yang Perpres-nya belum tersedia ditandai di popup dan belum dipakai sebagai acuan.',
  },

  zonasi_konservasi: {
    ...POLA_RUANG,
    params: { rpz: 1 },
    legenda: 'zona_rpz',
    pilihan: {
      param: 'kelas',
      label: 'Tampilkan zona',
      semua: 'Semua zona',
      opsi: URUTAN_ZONA_RPZ.map((kode) => [kode, KATEGORI_ZONA[kode].label]),
    },
    label: 'Zonasi Kawasan Konservasi (RPZ)',
    keteranganLegenda: 'Pembagian zona di dalam kawasan konservasi. Zona inti tertutup bagi investasi.',
    gaya: (f) => {
      const warna = warnaZona(f?.properties?.zona_rpz);
      return { color: warna, weight: 1.4, fillColor: warna, fillOpacity: 0.4, opacity: 0.95 };
    },
    popup: (p) => `<div class="font-sans">
      <h3 class="font-bold text-kkp-800 mb-1">${aman(p.nama || 'Kawasan konservasi')}</h3>
      <p class="text-xs mb-2 flex items-center gap-1.5">
        <span style="width:10px;height:10px;border-radius:2px;display:inline-block;background:${warnaZona(p.zona_rpz)}"></span>
        <span class="font-semibold text-slate-700">${aman(p.zona_rpz_label || '-')}</span>
      </p>
      <div class="text-xs border-t pt-1">
      <b>Aturan kegiatan:</b> ${aman(p.dasar_rpz || 'Matriks KKPRL Perda (rincian RPZ kawasan ini belum dimasukkan)')}<br/>
      <b>Provinsi:</b> ${aman(p.provinsi || '-')}</div>
      ${TOMBOL_ANALISIS}
    </div>`,
  },
};

const WARNA_PARAMETER = ['#db2777', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#ca8a04'];

export const lapisanParameter = (p, i) => {
  const warna = WARNA_PARAMETER[i % WARNA_PARAMETER.length];
  const aturan = p.peran === 'INFORMASI'
    ? 'Informasi saja, tidak memengaruhi penilaian.'
    : `${p.peran_label}: lokasi sesuai bila ${p.kondisi === 'DI_DALAM' ? 'di dalam' : 'di luar'} area${
      p.sektor.length ? ` untuk ${p.sektor.join(', ')}` : ''}.`;
  const keterangan = `${aturan}${p.aktif ? '' : ' Sedang nonaktif.'}`;
  return [`parameter_${p.id}`, {
    url: '/analitik/parameter-tambahan/peta/',
    params: { parameter: p.id },
    label: p.nama,
    tambahan: true,
    legenda: 'tunggal',
    warnaContoh: warna,
    keteranganLegenda: keterangan,
    sumberData: p.sumber || 'Administrator aplikasi',
    gaya: { color: warna, weight: 2, opacity: 0.9, fillColor: warna, fillOpacity: 0.2 },
    popup: (f) =>
      `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:${warna}">${aman(f.nama || p.nama)}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.nama)}</p>
        <p class="text-xs text-slate-500">${aman(keterangan)}</p>
      </div>`,
  }];
};
