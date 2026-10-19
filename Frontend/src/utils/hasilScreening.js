const LABEL_FISIK = new Set([
  'Ranah lokasi sesuai jenis investasi',
  'Dekat infrastruktur pendukung',
  'Kedalaman perairan sesuai',
  'Tinggi gelombang sesuai',
  'Daya gelombang memadai',
  'Suhu permukaan laut sesuai',
  'Jarak ke pantai sesuai',
  'Ada ekosistem pendukung',
]);

export const JENIS_PERINGATAN = {
  FISIK: 'Kecocokan fisik',
  BATAS: 'Perlu verifikasi batas',
  BELUM_TERVERIFIKASI: 'Belum terverifikasi',
  ADAT: 'Dekat wilayah adat',
};

export const fisikScreening = (s) => {
  if (s.kecocokan_fisik) return s.kecocokan_fisik;
  if (!s.karakter) return null;
  return {
    ...s.karakter,
    label: s.karakter.cocok ? 'Cocok' : 'Tidak cocok',
    syarat: (s.syarat_dasar || []).filter((d) => LABEL_FISIK.has(d.label)),
  };
};

export const pengecualianScreening = (s) => (s.syarat_dasar || []).filter((d) => !LABEL_FISIK.has(d.label));

export const peringatanScreening = (s) => s.peringatan || [];

export const teksLanjut = (s) => {
  if (!s.lanjut) return 'analisis berhenti di Tahap 1';
  return s.status === 'BELUM_TERVERIFIKASI'
    ? 'dilanjutkan ke Tahap 2 dengan label belum terverifikasi'
    : 'dilanjutkan ke Tahap 2';
};
