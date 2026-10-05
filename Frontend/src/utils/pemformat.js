export const formatRupiah = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "Rp 0";

  const n = Number(value);
  const besar = Math.abs(n);
  const tulis = (bagi, satuan) =>
    `Rp ${(n / bagi).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${satuan}`;

  if (besar >= 1_000_000_000_000) return tulis(1_000_000_000_000, 'Triliun');
  if (besar >= 1_000_000_000) return tulis(1_000_000_000, 'Miliar');
  if (besar >= 1_000_000) return tulis(1_000_000, 'Juta');
  return `Rp ${n.toLocaleString('id-ID')}`;
};

export const rupiahMiliar = (nilaiMiliar) => {
  if (nilaiMiliar === undefined || nilaiMiliar === null || Number.isNaN(Number(nilaiMiliar))) {
    return 'Rp 0';
  }
  return formatRupiah(Number(nilaiMiliar) * 1_000_000_000);
};

export const rupiahRingkas = (v, kosong = '—') => {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return kosong;
  const n = Number(v);
  const besar = Math.abs(n);
  const angka = (bagi, desimal) =>
    (n / bagi).toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });

  if (besar >= 1e12) return `${angka(1e12, 2)} T`;
  if (besar >= 1e9) return `${angka(1e9, 1)} M`;
  if (besar >= 1e6) return `${angka(1e6, 1)} Jt`;
  return n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const formatNumber = (value, decimals = 1) => {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const angkaRingkas = (v, d = 0, kosong = '—') => {
  if (v === undefined || v === null || Number.isNaN(Number(v))) return kosong;
  const n = Number(v);
  const desimal =
    n !== 0 && Math.abs(n) < 0.5 * 10 ** -d
      ? Math.min(6, 1 - Math.floor(Math.log10(Math.abs(n))))
      : d;
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  });
};

export const hanyaDigit = (teks) => String(teks ?? '').replace(/\D/g, '');

export const formatRibuan = (nilai) => {
  const mentah = hanyaDigit(nilai);
  if (!mentah) return '';
  return Number(mentah).toLocaleString('id-ID');
};

export const waktuPanjang = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export const inisialNama = (user) =>
  ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '') || user?.username?.[0] || '?').toUpperCase();
