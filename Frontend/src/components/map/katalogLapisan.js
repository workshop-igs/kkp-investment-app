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
import { kelengkapanScreening } from '../../utils/kelengkapanData';

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
    ikon: (p) => IKON_JENIS_INVESTASI[p.sektor_kode] || 'bintang',
    warnaIkon: (p) => warnaJenisInvestasi(p.sektor_kode),
    warnaTitik: (p) => (p.jenis?.length ? p.jenis : [p.sektor_kode]).map(warnaJenisInvestasi),
    tooltip: (p) => `Lokasi potensial:
${aman((p.jenis_nama?.length ? p.jenis_nama : [p.sektor]).join(', '))}`,
    zoomPin: 8,
    keteranganLegenda:
      'Setiap titik adalah lokasi potensial untuk sebuah jenis investasi; warnanya '
      + 'menunjukkan jenis itu dan titik berwarna ganda cocok untuk beberapa jenis. Ini bukan rekomendasi pasti dan '
      + 'bukan pengganti Persetujuan KKPRL. Mulai tingkat provinsi titik menjadi penanda berlambang jenis, dan batas '
      + 'lokasinya dimuat sebagai area analisis saat tombol Analisis lokasi ini di popup diklik; analisis itu memakai '
      + 'aturan yang sama sehingga hasilnya sama dengan popup. Lokasi dibentuk dari sel 250 m (sekitar 6,25 ha) di zona '
      + 'ruang laut, atau kawasan Pola Ruang darat RTRW Provinsi di pesisir, yang peruntukannya mengizinkan jenis itu. '
      + 'Sel harus memenuhi seluruh SYARAT DASAR: karakter lokasi cocok (misalnya budi daya laut di perairan 1 sampai '
      + '30 m, tambak garam di darat pesisir; kedalaman dan gelombang bersifat indikatif), dekat infrastruktur '
      + 'pendukung, serta lolos pengecualian keras: di luar alur pelayaran/ALKI dari lapisan zonasi mana pun '
      + '(kecuali jasa maritim dan infrastruktur laut), tidak '
      + 'menempati mangrove, lamun, atau terumbu karang bagi jenis yang dapat merusaknya, di luar jarak aman kabel, pipa, '
      + 'dan alur pelayaran, tidak beririsan KKPRL terbit, dan tidak tertutup bangunan. Di kawasan konservasi, jenis '
      + 'yang boleh mengikuti matriks KKPRL Perda zona itu. Syarat dasar ini pasti '
      + 'terpenuhi pada setiap titik sehingga tidak ikut persentase. Persentase dihitung dari PARAMETER DINILAI: '
      + 'peruntukan diizinkan tanpa syarat, risiko tsunami, gelombang ekstrem dan abrasi, serta banjir yang rendah, di '
      + 'luar wilayah kelola masyarakat hukum adat, dan kriteria per jenis dari data publik (misalnya suhu, klorofil-a, '
      + 'kekeruhan, dan gelombang tertinggi untuk budi daya laut; kesuburan perairan untuk perikanan tangkap; kejernihan '
      + 'air dan kedekatan terumbu karang untuk wisata bahari; curah hujan dan panjang musim kemarau untuk garam). '
      + 'Ambang kriteria per jenis adalah usulan dari pustaka kesesuaian lokasi yang menunggu tinjauan KKP. Sebuah sel '
      + 'masuk bila parameter dinilainya cukup terukur dan sedikitnya 75% di antaranya sangat sesuai; di zona yang '
      + 'peruntukannya untuk kegiatan lain dan hanya mengizinkan jenis itu bersyarat, seluruh parameter dinilai wajib '
      + 'terukur dan sangat sesuai. Setiap wilayah sel yang bersambung ditampilkan sebagai satu titik dengan batas '
      + 'berupa inti terbaiknya, paling luas 1 km x 1 km (100 ha). Dalam radius 10 km hanya lokasi terbaik yang '
      + 'ditampilkan; wilayah sesuai lain di sekitarnya dapat diperiksa lewat Analisis lokasi. Pada pilihan semua jenis, '
      + 'lokasi yang bertumpuk digabung dan popup menyebut jenis yang cocok; Konservasi & Rehabilitasi Pesisir hanya '
      + 'tampil bila jenis itu dipilih. Pada tampilan seluruh Indonesia yang tampil adalah lokasi dengan persentase '
      + 'tertinggi; perbesar peta untuk melihat lokasi lainnya. Kriteria finansial (NPV, IRR, payback) tidak ikut; '
      + 'penilaian proyek tetap dilakukan lewat Analisis lokasi ini.',
    popup: (p) => {
      const jenis = p.jenis?.length ? p.jenis : [p.sektor_kode];
      const nama = p.jenis_nama?.length ? p.jenis_nama : [p.sektor || ''];
      const warna = warnaJenisInvestasi(jenis[0]);
      const persen = Math.max(0, Math.min(100, Number(p.persen_sesuai) || 0));
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
             <span class="${kelasTanda} font-bold shrink-0 w-3">${tanda}</span>
             <span>${aman(label)}${ket}</span>
           </li>`;
        })
        .join('');
      // Lokasi hasil hitungan sebelum syarat dasar dipisah belum memiliki syarat_dasar; bloknya tidak ditampilkan.
      const dasar = Object.entries(p.syarat_dasar || {});
      const dasarKosong = dasar.filter(([, v]) => v === null).map(([label]) => label);
      const blokDasar = dasar.length
        ? `<div class="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
            <p class="text-[10.5px] font-semibold text-emerald-800">&check; Syarat dasar terpenuhi (${dasar.length - dasarKosong.length} dari ${dasar.length})</p>
            <p class="mt-0.5 text-[10px] leading-snug text-emerald-900/80">${dasar.filter(([, v]) => v !== null).map(([label]) => aman(label)).join(' &middot; ')}</p>
            ${dasarKosong.length
              ? `<p class="mt-0.5 text-[10px] leading-snug text-amber-700">? Belum terukur, dianggap terpenuhi: ${dasarKosong.map((l) => aman(l.charAt(0).toLowerCase() + l.slice(1))).join(', ')}</p>`
              : ''}
          </div>`
        : '';
      const nilaiParameter = Object.values(p.parameter || {});
      const kelengkapan = kelengkapanScreening({
        parameter: nilaiParameter.map((v) => ({ nilai: v === null ? null : true })),
      });

      return `<div class="font-sans w-[18.5rem] max-w-full">
        <div class="flex items-center gap-2.5">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-sm" style="background:${warna}">${lambangSvg(IKON_JENIS_INVESTASI[jenis[0]], 18)}</span>
          <div class="min-w-0">
            <h3 class="text-[14px] font-bold leading-tight text-slate-900">${nama.length > 1 ? `Cocok untuk ${nama.length} jenis investasi` : `Lokasi potensial ${aman(nama[0])}`}</h3>
            <p class="text-[11px] text-slate-500 leading-snug">${aman(p.nama || '-')} &middot; ${aman(p.provinsi || '-')}</p>
          </div>
        </div>
        ${nama.length > 1
          ? `<div class="mt-2 flex flex-wrap gap-1">${jenis.map((kode, i) => `<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700"><span class="h-2 w-2 rounded-full" style="background:${warnaJenisInvestasi(kode)}"></span>${aman(nama[i])}</span>`).join('')}</div>`
          : ''}
        <div class="mt-2 flex items-center gap-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <span class="text-lg font-bold tabular-nums leading-none" style="color:${warna}">${persen}%</span>
          <div class="min-w-0 flex-1">
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-200"><div class="h-full rounded-full" style="width:${persen}%;background:${warna}"></div></div>
            <p class="mt-0.5 text-[10px] text-slate-500 leading-tight">parameter dinilai sangat sesuai &middot; ${aman(luas)} ha</p>
          </div>
        </div>
        ${p.luas_wilayah_ha > p.luas_ha
          ? `<p class="mt-1 text-[10px] text-slate-500 leading-snug">Inti terbaik dari wilayah sesuai seluas &plusmn;${aman(Number(p.luas_wilayah_ha).toLocaleString('id-ID'))} ha: persentase tertinggi, lalu paling dekat infrastruktur.</p>`
          : ''}
        ${blokDasar}
        <p class="mt-2 text-[10.5px] font-semibold text-slate-600">Parameter dinilai</p>
        <ul class="mt-0.5 text-[11px] space-y-px text-slate-700">${butir}</ul>
        ${kelengkapan
          ? `<p class="mt-1 text-[10.5px] leading-snug ${kelengkapan.indikatif ? 'font-semibold text-amber-700' : 'text-slate-500'}">Data tersedia untuk ${kelengkapan.terukur} dari ${kelengkapan.total} parameter${kelengkapan.indikatif ? ' &middot; <span class="rounded bg-amber-500 px-1 text-[9.5px] font-bold uppercase text-white">Indikatif</span>' : ''}</p>`
          : ''}
        ${p.status_tata_ruang === 'BERSYARAT'
          ? `<p class="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800 leading-snug">Diizinkan bersyarat oleh ${rencana}; syaratnya tercantum di Analisis lokasi ini.</p>`
          : ''}
        <p class="text-[10px] text-slate-500 mt-1.5 leading-snug">${p.perlu_dinilai?.length ? 'Parameter bertanda ! atau ?, serta' : 'Parameter yang belum terukur di aplikasi, seperti'} kualitas air dan substrat, perlu dinilai langsung di lapangan.</p>
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
