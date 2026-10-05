import { gayaUnsurRtrl } from '../../utils/simbologiPeta';
import { warnaKelasRisiko } from '../../utils/simbologiPeta';
import { garisKelasKelayakan, warnaKelasKelayakan } from '../../utils/simbologiPeta';
import { KATEGORI_ZONA, URUTAN_KATEGORI, gayaKawasan, kategoriZona, warnaJenisInvestasi, warnaZona } from '../../utils/simbologiPeta';
import { SECTORS } from '../../utils/konstanta';
import { API_V1_URL } from '../../api/alamat';

const catatanAdat = (sumberSosial) => {
  if (!sumberSosial || sumberSosial === 'NETRAL' || sumberSosial.includes('adat')) return '';
  return '<p class="text-[10px] text-amber-700 mt-1 leading-snug">Wilayah adat belum terdata di provinsi ini; sisi tenurialnya hanya bersandar pada ketergantungan penduduk pada perikanan.</p>';
};

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
  skor_zona: {
    url: '/analitik/skor-zona/peta/',
    urlWilayah: '/analitik/skor-zona/wilayah/',
    params: { sektor: 'PARIWISATA_BAHARI' },
    label: 'Skor Kelayakan per Zona',
    legenda: 'kelayakan',
    keteranganLegenda:
      'Skor 0-1 per zona ruang laut untuk sektor terpilih, disusun dari '
      + 'kesesuaian tata ruang, potensi sumber daya, aksesibilitas infrastruktur, '
      + 'kondisi sosial-ekonomi, serta risiko bencana dan regulasi. '
      + 'Risiko lingkungannya memakai indeks kesehatan ekosistem dari sebaran '
      + 'mangrove (dengan kondisi tutupan) Portal Satu Data KKP, '
      + 'dilengkapi sebaran mangrove Global Mangrove Watch v3.0 untuk perairan yang '
      + 'penarikan KKP-nya belum sampai — keduanya tidak pernah dijumlahkan, karena '
      + 'memetakan tegakan yang sama. Terumbu karang dan padang lamun 2025 diambil dari Sidako Ekosistem KKP. '
      + 'Risiko sosialnya memakai dua hal: bagian penduduk kabupaten yang terdaftar '
      + 'DTKS desil 1-4 — pendataan Kemensos, BUKAN angka kemiskinan BPS — dan '
      + 'konflik tenurial dari ketergantungan penduduk pada perikanan serta irisan '
      + 'dengan wilayah kelola masyarakat hukum adat. Data adat baru mencakup lima '
      + 'provinsi, jadi zona tanpa tanda adat berarti belum tercatat, bukan bebas klaim. '
      + 'BUKAN skor AHP proyek: kriteria finansial (NPV, IRR, payback, ROI) '
      + 'tidak ikut, karena keempatnya lahir dari CapEx satu proyek sedangkan '
      + 'zona tidak punya CapEx. Ambang kelasnya sama dengan ambang keputusan '
      + 'laporan — Tinggi mulai 0,70, sebagaimana proyek berstatus Layak.',
    gaya: (f) => {
      const kelas = f && f.properties ? f.properties.kelas : null;
      return {
        color: garisKelasKelayakan(kelas),
        weight: 0.8,
        fillColor: warnaKelasKelayakan(kelas),
        fillOpacity: 0.62,
        opacity: 0.9,
      };
    },
    popup: (p) => {
      const baris = (label, nilai) =>
        nilai === null || nilai === undefined ? '' : `<b>${label}:</b> ${aman(nilai)}<br/>`;
      return `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:${warnaKelasKelayakan(p.kelas)}">${aman(p.nama || 'Zona ruang laut')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.sub_zona || '-')} · ${aman(p.provinsi || '-')}</p>
        <div class="text-xs mb-1.5">
          <span class="font-bold text-base" style="color:${warnaKelasKelayakan(p.kelas)}">${(p.skor ?? 0).toFixed(2)}</span>
          <span class="text-slate-500"> skor kelayakan &middot; ${aman(p.kelas ? p.kelas.replace('_', ' ').toLowerCase() : '-')}</span>
        </div>
        <div class="text-xs border-t pt-1">
          ${baris('Sektor dinilai', p.sektor)}
          ${baris('Skor lokasi', p.skor_lokasi)}
          ${baris('Skor risiko', p.skor_risiko)}
          ${baris('Sesuai tata ruang', p.sesuai_tata_ruang ? 'Ya' : 'Tidak')}
          ${baris('Infrastruktur terdekat', p.jarak_infra_km === null ? null : `${p.jarak_infra_km} km`)}
          ${baris('Risiko bencana', p.risiko_bencana)}
          ${baris('Izin tumpang tindih', p.jumlah_kkprl)}
          ${baris('Indeks ekosistem', p.sensitivitas_ekosistem)}
          ${p.ekosistem ? `<b>Ekosistem:</b> ${aman(p.ekosistem)}<br/>` : ''}
          ${baris('Risiko sosial', p.risiko_sosial)}
          ${p.rasio_dtks === null || p.rasio_dtks === undefined
            ? ''
            : `<b>DTKS desil 1-4:</b> ${(p.rasio_dtks * 100).toFixed(1)}% penduduk<br/>`}
          ${p.rasio_nelayan === null || p.rasio_nelayan === undefined
            ? ''
            : `<b>Nelayan:</b> ${(p.rasio_nelayan * 100).toFixed(1)}% penduduk<br/>`}
          ${p.wilayah_adat
            ? '<b class="text-amber-700">Beririsan wilayah kelola masyarakat hukum adat</b><br/>'
            : ''}
        </div>
        ${p.sumber_sosek === 'NETRAL'
          ? '<p class="text-[10px] text-amber-700 mt-1.5 leading-snug">Kondisi sosial-ekonomi masih nilai netral &mdash; kabupaten/kota penaung zona ini belum berdata.</p>'
          : ''}
        ${p.sumber_sosial === 'NETRAL'
          ? '<p class="text-[10px] text-amber-700 mt-1.5 leading-snug">Risiko sosial belum berdata untuk zona ini; komponennya dilewati, bukan diisi angka netral.</p>'
          : ''}
        ${catatanAdat(p.sumber_sosial)}
      </div>`;
    },
  },
  potensi: {
    url: '/analitik/skor-zona/peta/',
    urlWilayah: '/analitik/skor-zona/wilayah/',
    params: { sektor: 'PERIKANAN_BUDIDAYA', kelas: 'TINGGI' },
    label: 'Wilayah Disarankan per Jenis',
    legenda: 'disarankan',
    ikon: 'bintang',
    warnaIkon: '#16a34a',
    keteranganLegenda:
      'Zona ruang laut yang berkelas kelayakan TINGGI untuk jenis investasi '
      + 'yang dipilih — 13.407 dari 280.280 baris skor (28.028 zona x 10 sektor). '
      + 'Ambangnya 0,70, sama dengan ambang proyek berstatus Layak pada laporan. '
      + 'Zonanya nyata: RZWP-3-K, PKKPRL, dan kawasan konservasi nasional dari '
      + 'Portal Satu Data KKP. Skornya dihitung lebih dulu oleh '
      + '`manage.py hitung_skor_zona`, bukan saat permintaan. '
      + 'Penandanya adalah titik wakil di dalam zona; poligonnya batas '
      + 'sebenarnya, terlihat begitu peta cukup dekat — banyak zona berskor '
      + 'tinggi hanya beberapa hektare dan tak terlihat pada tampilan nasional. '
      + 'BUKAN skor AHP proyek: kriteria finansial (NPV, IRR, payback, ROI) '
      + 'tidak ikut, karena keempatnya lahir dari CapEx satu proyek sedangkan '
      + 'zona tidak punya CapEx. '
      + 'Lapisan Skor Kelayakan per Zona menampilkan sebaran SELURUH kelas dari '
      + 'sumber yang sama, bila yang dicari perbandingan antarwilayah.',
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
      const angka = (v, d = 2) =>
        v === null || v === undefined ? null : Number(v).toFixed(d).replace('.', ',');

      const alasan = [];
      if (p.sesuai_tata_ruang) alasan.push([true, 'Sesuai peruntukan rencana tata ruang laut']);
      else alasan.push([false, 'Belum sesuai peruntukan tata ruang']);

      if (p.jarak_infra_km !== null && p.jarak_infra_km !== undefined) {
        const dekat = p.jarak_infra_km <= 25;
        alasan.push([dekat, `Infrastruktur pendukung ${angka(p.jarak_infra_km, 1)} km`]);
      }
      if (p.risiko_bencana !== null && p.risiko_bencana !== undefined) {
        const aman_bencana = p.risiko_bencana < 0.5;
        alasan.push([aman_bencana, `Risiko bencana ${angka(p.risiko_bencana)}${aman_bencana ? '' : ' — tergolong tinggi'}`]);
      }
      if (p.jumlah_kkprl !== null && p.jumlah_kkprl !== undefined) {
        alasan.push([
          p.jumlah_kkprl === 0,
          p.jumlah_kkprl === 0
            ? 'Tidak ada izin KKPRL yang tumpang tindih'
            : `${p.jumlah_kkprl} izin KKPRL tumpang tindih`,
        ]);
      }
      if (p.sensitivitas_ekosistem !== null && p.sensitivitas_ekosistem !== undefined) {
        const rendah = p.sensitivitas_ekosistem < 0.5;
        alasan.push([rendah, `Indeks ekosistem ${angka(p.sensitivitas_ekosistem)}${rendah ? '' : ' — ekosistem sensitif'}`]);
      }
      if (p.risiko_sosial !== null && p.risiko_sosial !== undefined) {
        const rendah = p.risiko_sosial < 0.5;
        alasan.push([rendah, `Risiko sosial ${angka(p.risiko_sosial)}${rendah ? '' : ' — perlu perhatian'}`]);
      }
      if (p.wilayah_adat) {
        alasan.push([false, 'Beririsan wilayah kelola masyarakat hukum adat']);
      }

      const butir = alasan
        .map(([baik, teks]) =>
          `<li class="flex gap-1.5 leading-snug">
             <span class="${baik ? 'text-emerald-600' : 'text-amber-600'} font-bold shrink-0">${baik ? '&check;' : '!'}</span>
             <span>${aman(teks)}</span>
           </li>`)
        .join('');

      return `<div class="font-sans">
        <h3 class="font-bold mb-1" style="color:${warna}">${aman(p.nama || 'Zona ruang laut')}</h3>
        <p class="text-xs text-slate-600 border-b pb-1 mb-1">${aman(p.sub_zona || '-')} &middot; ${aman(p.provinsi || '-')}</p>
        <div class="text-xs mb-1.5">
          <span class="font-bold text-base" style="color:${warna}">${angka(p.skor) || '-'}</span>
          <span class="text-slate-500"> skor kelayakan untuk ${aman(p.sektor || 'sektor terpilih')}</span>
        </div>
        <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Kenapa disarankan</p>
        <ul class="text-[11px] space-y-0.5 mb-1">${butir}</ul>
        <p class="text-[10px] text-slate-500 border-t pt-1">Lokasi ${angka(p.skor_lokasi)} &middot; risiko ${angka(p.skor_risiko)}</p>
        ${p.sumber_sosek === 'NETRAL'
          ? '<p class="text-[10px] text-amber-700 mt-1 leading-snug">Kondisi sosial-ekonomi masih nilai netral &mdash; kabupaten/kota penaung zona ini belum berdata.</p>'
          : ''}
        ${p.sumber_sosial === 'NETRAL'
          ? '<p class="text-[10px] text-amber-700 mt-1 leading-snug">Risiko sosial belum berdata untuk zona ini; komponennya dilewati, bukan diisi angka netral.</p>'
          : ''}
        ${catatanAdat(p.sumber_sosial)}
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
    url: '/inventarisasi/zonasi/peta/',
    urlWilayah: '/inventarisasi/zonasi/wilayah/',
    label: 'Pola Ruang Laut (RTRW Provinsi, PKKPRL & RZWP-3-K)',
    legenda: 'zona',
    pilihan: {
      param: 'kategori',
      label: 'Tampilkan peruntukan',
      semua: 'Semua peruntukan',
      opsi: URUTAN_KATEGORI.map((kode) => [kode, KATEGORI_ZONA[kode].label]),
    },
    keteranganLegenda:
      'Alokasi ruang laut provinsi dari tiga instrumen. Zona laut dari geodatabase '
      + 'Perda RTRW Provinsi (KKP) menjadi acuan utama; peta arahan PKKPRL dan '
      + 'RZWP-3-K yang lebih lama mengisi perairan yang belum diatur RTRW. Sejak UU '
      + 'Cipta Kerja zonasi laut diintegrasikan ke dalam RTRW provinsi, sehingga '
      + 'RTRWP sebelum 2021 tidak memuat zona laut. Ketiganya disajikan sebagai satu '
      + 'lapisan dan dapat bertumpuk; popup tiap zona menyebutkan instrumen dasarnya, '
      + 'dan screening memakai acuan teratas yang tersedia.',
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
        <b>Kawasan:</b> ${aman(p.jenis || '-')}<br/>
        <b>Sub-zona:</b> ${aman(p.sub_zona || '-')}<br/>
        <b>Instrumen:</b> ${
          { 'KKP-RTRW': 'Perda RTRW Provinsi', 'KKP-PKKPRL': 'PKKPRL pada RTRW Provinsi', 'KKP-WFS': 'Rencana Zonasi KAW' }[p.sumber] || 'RZWP-3-K'
        }<br/>
        <b>Dasar hukum:</b> ${aman(p.regulasi || '-')}<br/>
        <b>Provinsi:</b> ${aman(p.provinsi || '-')}</div>
        ${TOMBOL_ANALISIS}
      </div>`;
    },
  },
};
