export const SERI = [
  '#0056A5',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
];

export const warnaSeri = (i) => SERI[i] || '#94a3b8';

export const RAMP_BIRU = [
  '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b',
];

export const TINTA = {
  utama: '#0b0b0b',
  kedua: '#52514e',
  redup: '#898781',
  garisBantu: '#e1e0d9',
  sumbu: '#c3c2b7',
  permukaan: '#ffffff',
};

const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const opsiDasar = () => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      align: 'start',
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        boxWidth: 8,
        boxHeight: 8,
        padding: 16,
        color: TINTA.kedua,
        font: { family: FONT, size: 11, weight: '500' },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(11,11,11,0.92)',
      titleFont: { family: FONT, size: 12, weight: '600' },
      bodyFont: { family: FONT, size: 12 },
      padding: 10,
      cornerRadius: 6,
      displayColors: true,
      boxWidth: 8,
      boxHeight: 8,
      usePointStyle: true,
    },
  },
});

export const sumbuNilai = (judul, format) => ({
  beginAtZero: true,
  border: { display: false },
  grid: { color: TINTA.garisBantu, drawTicks: false, lineWidth: 1 },
  ticks: {
    color: TINTA.redup,
    font: { family: FONT, size: 10 },
    padding: 8,
    maxTicksLimit: 6,
    callback: format,
  },
  title: judul
    ? { display: true, text: judul, color: TINTA.redup, font: { family: FONT, size: 10 } }
    : { display: false },
});

export const sumbuKategori = (opsi = {}) => ({
  border: { display: false },
  grid: { display: false },
  ticks: {
    color: TINTA.kedua,
    font: { family: FONT, size: 10 },
    padding: 6,
    autoSkip: false,
    maxRotation: 0,
    minRotation: 0,
    ...opsi,
  },
});

export const potong = (teks, batas = 16) => {
  const t = String(teks ?? '');
  return t.length > batas ? t.slice(0, batas - 1) + '…' : t;
};

export const gayaBatang = (warna, ekstra = {}) => ({
  backgroundColor: warna,
  borderColor: warna,
  borderWidth: 0,
  borderRadius: 4,
  borderSkipped: false,
  barPercentage: 0.72,
  categoryPercentage: 0.7,
  ...ekstra,
});
