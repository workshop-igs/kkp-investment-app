const MINIMAL_PARAMETER = 3;
const AMBANG_KELENGKAPAN = 0.75;

export const CATATAN_DASAR =
  'Hasil ini adalah penyaringan awal berbasis data spasial, bukan pengganti Persetujuan KKPRL. Kesesuaian akhir '
  + 'ditetapkan KKP melalui penilaian dokumen permohonan dan verifikasi lapangan.';

export const kelengkapanScreening = (s) => {
  if (!s) return null;
  if (s.kelengkapan !== undefined) return s.kelengkapan;
  const parameter = s.parameter || [];
  if (!parameter.length) return null;
  const tidak = parameter.filter((p) => p.nilai === null).map((p) => p.label);
  const terukur = parameter.length - tidak.length;
  const alasan = [];
  if (terukur < MINIMAL_PARAMETER) {
    alasan.push(`hanya ${terukur} parameter terukur, kurang dari batas minimal ${MINIMAL_PARAMETER}`);
  }
  if (terukur < AMBANG_KELENGKAPAN * parameter.length) {
    alasan.push(`${tidak.length} dari ${parameter.length} parameter tidak memiliki data di lokasi ini`);
  }
  return {
    terukur, total: parameter.length, tidak_terukur: tidak, indikatif: alasan.length > 0, alasan_indikatif: alasan,
  };
};

export const statusIndikatif = (screening, skor) => {
  const kelengkapan = kelengkapanScreening(screening);
  const alasan = [...(kelengkapan?.alasan_indikatif || [])];
  const total = Number(skor?.total) || 0;
  const spasial = Number(skor?.berbasisSpasial) || 0;
  if (total && spasial < AMBANG_KELENGKAPAN * total) {
    alasan.push(`${total - spasial} dari ${total} skor penilaian memakai nilai bawaan karena data spasialnya tidak tersedia`);
  }
  return { indikatif: alasan.length > 0, alasan, kelengkapan };
};

export const catatanSkala = (s) => (s?.catatan_skala?.length ? s.catatan_skala : [CATATAN_DASAR]);

export const ringkasKelengkapan = (k) => {
  if (!k) return '';
  const kosong = k.tidak_terukur.length
    ? `; data tidak tersedia: ${k.tidak_terukur.map((t) => t.charAt(0).toLowerCase() + t.slice(1)).join(', ')}`
    : '';
  return `${k.terukur} dari ${k.total} parameter tersedia${kosong}`;
};
