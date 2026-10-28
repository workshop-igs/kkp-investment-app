export const KATEGORI_ZONA = {
  PERIKANAN_TANGKAP: { label: 'Perikanan Tangkap', warna: '#0056A5' },
  PERIKANAN_BUDIDAYA: { label: 'Perikanan Budi Daya', warna: '#06b6d4' },
  PERIKANAN: { label: 'Perikanan (tangkap & budi daya)', warna: '#0284c7' },
  KONSERVASI: { label: 'Konservasi', warna: '#16a34a' },
  MANGROVE: { label: 'Mangrove', warna: '#4d7c0f' },
  PARIWISATA: { label: 'Pariwisata', warna: '#db2777' },
  PELAYARAN: { label: 'Pelayaran & Pelabuhan', warna: '#7c3aed' },
  PERTAMBANGAN: { label: 'Pertambangan & Migas', warna: '#92400e' },
  INDUSTRI: { label: 'Industri', warna: '#ea580c' },
  ENERGI: { label: 'Energi', warna: '#dc2626' },
  INFRASTRUKTUR: { label: 'Infrastruktur Laut', warna: '#f59e0b' },
  PERTAHANAN_KEAMANAN: { label: 'Pertahanan & Keamanan', warna: '#334155' },
  EKOSISTEM_PESISIR: { label: 'Pengelolaan Ekosistem Pesisir', warna: '#0d9488' },
  PERMUKIMAN: { label: 'Permukiman', warna: '#a16207' },
  PERGARAMAN: { label: 'Pergaraman', warna: '#65a30d' },
  DUMPING: { label: 'Dumping Area', warna: '#9333ea' },
  KAWASAN_SUCI: { label: 'Kawasan Suci Laut', warna: '#c026d3' },
  TIDAK_DIBAGI: { label: 'Tidak dibagi ke dalam jenis', warna: '#78716c' },
  BELUM_DIATUR: { label: 'Belum diatur dalam RZWP-3-K', warna: '#94a3b8' },
  LAINNYA: { label: 'Peruntukan lain', warna: '#cbd5e1' },
  DARAT_PERGARAMAN: { label: 'Kawasan Pergaraman (darat)', warna: '#65a30d' },
  DARAT_PERIKANAN: { label: 'Kawasan Perikanan (darat)', warna: '#0284c7' },
  DARAT_INDUSTRI: { label: 'Kawasan Peruntukan Industri (darat)', warna: '#ea580c' },
  DARAT_PARIWISATA: { label: 'Kawasan Pariwisata (darat)', warna: '#db2777' },
  DARAT_TRANSPORTASI: { label: 'Kawasan Transportasi (darat)', warna: '#7c3aed' },
  DARAT_PERMUKIMAN: { label: 'Kawasan Permukiman (darat)', warna: '#a16207' },
  DARAT_PERTANIAN: { label: 'Kawasan Pertanian (darat)', warna: '#ca8a04' },
  DARAT_PERKEBUNAN: { label: 'Kawasan Perkebunan (darat)', warna: '#84cc16' },
  DARAT_HUTAN_PRODUKSI: { label: 'Kawasan Hutan Produksi (darat)', warna: '#166534' },
  DARAT_PERTAMBANGAN: { label: 'Kawasan Pertambangan dan Energi (darat)', warna: '#92400e' },
  DARAT_PERTAHANAN: { label: 'Kawasan Pertahanan dan Keamanan (darat)', warna: '#334155' },
  DARAT_MANGROVE: { label: 'Kawasan Ekosistem Mangrove (darat)', warna: '#4d7c0f' },
  DARAT_LINDUNG: { label: 'Kawasan Lindung (darat)', warna: '#16a34a' },
  DARAT_LAINNYA: { label: 'Kawasan darat lainnya', warna: '#cbd5e1' },
};

export const URUTAN_KATEGORI = [
  'PERIKANAN_TANGKAP',
  'PERIKANAN_BUDIDAYA',
  'PERIKANAN',
  'PARIWISATA',
  'PELAYARAN',
  'INDUSTRI',
  'ENERGI',
  'PERTAMBANGAN',
  'INFRASTRUKTUR',
  'PERGARAMAN',
  'PERMUKIMAN',
  'KONSERVASI',
  'MANGROVE',
  'EKOSISTEM_PESISIR',
  'PERTAHANAN_KEAMANAN',
  'DUMPING',
  'KAWASAN_SUCI',
  'TIDAK_DIBAGI',
  'BELUM_DIATUR',
  'LAINNYA',
];

export const URUTAN_KATEGORI_DARAT = [
  'DARAT_PERGARAMAN',
  'DARAT_PERIKANAN',
  'DARAT_INDUSTRI',
  'DARAT_PARIWISATA',
  'DARAT_TRANSPORTASI',
  'DARAT_PERMUKIMAN',
  'DARAT_PERTANIAN',
  'DARAT_PERKEBUNAN',
  'DARAT_HUTAN_PRODUKSI',
  'DARAT_PERTAMBANGAN',
  'DARAT_PERTAHANAN',
  'DARAT_MANGROVE',
  'DARAT_LINDUNG',
  'DARAT_LAINNYA',
];

const CADANGAN = KATEGORI_ZONA.LAINNYA;

export const kategoriZona = (kode) => KATEGORI_ZONA[kode] || CADANGAN;

export const warnaZona = (kode) => kategoriZona(kode).warna;

const GAYA_KAWASAN = {
  ZL: { weight: 1.6, dashArray: null },
  KSN: { weight: 1.6, dashArray: '5,3' },
  KST: { weight: 1.6, dashArray: '5,3' },
  ALKI: { weight: 1.4, dashArray: '2,3' },
  ZU: { weight: 1, dashArray: null },
};

export const gayaKawasan = (kode) => GAYA_KAWASAN[kode] || GAYA_KAWASAN.ZU;

export const GARIS_KAWASAN = [
  { label: 'Kawasan pemanfaatan umum', tebal: 1, pola: 'solid', warna: '#64748b' },
  { label: 'Kawasan konservasi', tebal: 2, pola: 'solid', warna: '#16a34a' },
  { label: 'Kawasan strategis nasional', tebal: 2, pola: 'dashed', warna: '#7c3aed' },
  { label: 'Alur laut', tebal: 2, pola: 'dotted', warna: '#0056A5' },
];

export const KATEGORI_RTRL = {
  ALUR_PELAYARAN: {
    label: 'Alur Pelayaran & ALKI',
    warna: '#0056A5',
    garis: null,
    tebal: 2.6,
    catatan: 'Membatasi penempatan bangunan dan budi daya di badan alur',
  },
  KABEL: {
    label: 'Kabel Bawah Laut',
    warna: '#7c3aed',
    garis: '7,5',
    tebal: 2,
    catatan: 'Sekitarnya tidak boleh untuk jangkar, keramba, atau pengerukan',
  },
  PIPA: {
    label: 'Pipa Bawah Laut',
    warna: '#b45309',
    garis: '11,4,2,4',
    tebal: 2.2,
    catatan: 'Sekitarnya tidak boleh untuk jangkar, keramba, atau pengerukan',
  },
  MIGRASI_BIOTA: {
    label: 'Jalur Migrasi Satwa Laut',
    warna: '#16a34a',
    garis: '2,6',
    tebal: 2.4,
    catatan: 'Jalur migrasi penyu, paus, dan lumba-lumba',
  },
  KSNT: {
    label: 'Kawasan Strategis Nasional Tertentu',
    warna: '#dc2626',
    garis: null,
    tebal: 2,
    catatan: 'Titik KSNT: pengendalian lingkungan hidup & situs warisan dunia',
  },
  LAINNYA: {
    label: 'Unsur lain',
    warna: '#94a3b8',
    garis: '4,4',
    tebal: 1.6,
    catatan: 'Unsur RTRL yang belum terklasifikasi',
  },
};

export const gayaUnsurRtrl = (fitur) => {
  const k = KATEGORI_RTRL[fitur?.properties?.jenis_kode] || KATEGORI_RTRL.LAINNYA;
  return {
    color: k.warna,
    weight: k.tebal,
    opacity: 0.92,
    dashArray: k.garis || undefined,
    fillColor: k.warna,
    fillOpacity: 0.15,
  };
};


export const KELAS_RISIKO = {
  RENDAH: { label: 'Risiko Rendah', warna: '#16a34a' },
  SEDANG: { label: 'Risiko Sedang', warna: '#f59e0b' },
  TINGGI: { label: 'Risiko Tinggi', warna: '#dc2626' },
};

export const URUTAN_KELAS_RISIKO = ['TINGGI', 'SEDANG', 'RENDAH'];

export const warnaKelasRisiko = (kode) =>
  (KELAS_RISIKO[kode] || { warna: '#94a3b8' }).warna;

const WARNA_KELAS_KELAYAKAN = { SEDANG: '#84cc16', TINGGI: '#15803d' };

export const warnaKelasKelayakan = (kode) => WARNA_KELAS_KELAYAKAN[kode] || '#94a3b8';



export const WARNA_JENIS_INVESTASI = {
  PERIKANAN_TANGKAP: '#0056A5',
  PERIKANAN_BUDIDAYA: '#06b6d4',
  PENGOLAHAN_HASIL_LAUT: '#f59e0b',
  PARIWISATA_BAHARI: '#db2777',
  JASA_MARITIM: '#7c3aed',
  INFRASTRUKTUR_LAUT: '#ea580c',
  ENERGI_KELAUTAN: '#dc2626',
  GARAM: '#65a30d',
  BIOTEKNOLOGI_KELAUTAN: '#0d9488',
  KONSERVASI_PESISIR: '#16a34a',
  LAINNYA: '#94a3b8',
};

export const warnaJenisInvestasi = (kode) => WARNA_JENIS_INVESTASI[kode] || WARNA_JENIS_INVESTASI.LAINNYA;

export const IKON_JENIS_INVESTASI = {
  PERIKANAN_TANGKAP: 'ikan',
  PERIKANAN_BUDIDAYA: 'keramba',
  PENGOLAHAN_HASIL_LAUT: 'pabrik',
  PARIWISATA_BAHARI: 'ombak',
  JASA_MARITIM: 'jangkar',
  INFRASTRUKTUR_LAUT: 'jembatan',
  ENERGI_KELAUTAN: 'petir',
  GARAM: 'kristal',
  BIOTEKNOLOGI_KELAUTAN: 'labu',
  KONSERVASI_PESISIR: 'daun',
};
