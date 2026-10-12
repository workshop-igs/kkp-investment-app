export const SECTORS = [
  { id: "PERIKANAN_TANGKAP", label: "Perikanan Tangkap" },
  { id: "PERIKANAN_BUDIDAYA", label: "Perikanan Budidaya" },
  { id: "PENGOLAHAN_HASIL_LAUT", label: "Pengolahan & Hilirisasi Hasil Laut" },
  { id: "PARIWISATA_BAHARI", label: "Wisata Bahari" },
  { id: "JASA_MARITIM", label: "Jasa Maritim & Kepelabuhanan" },
  { id: "INFRASTRUKTUR_LAUT", label: "Infrastruktur & Bangunan Laut" },
  { id: "ENERGI_KELAUTAN", label: "Energi & Sumber Daya Non-Hayati" },
  { id: "GARAM", label: "Produksi Garam" },
  { id: "BIOTEKNOLOGI_KELAUTAN", label: "Bioteknologi Kelautan" },
  { id: "KONSERVASI_PESISIR", label: "Konservasi & Rehabilitasi Pesisir" },
];

export const WARNA_AKSI = {
  MASUK: 'bg-sky-100 text-sky-700',
  KELUAR: 'bg-slate-100 text-slate-600',
  DAFTAR: 'bg-indigo-100 text-indigo-700',
  BUAT: 'bg-emerald-100 text-emerald-700',
  UBAH: 'bg-amber-100 text-amber-700',
  HAPUS: 'bg-rose-100 text-rose-700',
  ANALISIS: 'bg-teal-100 text-teal-700',
  DITOLAK: 'bg-red-100 text-red-700 ring-1 ring-red-300',
};


export const TAHAPAN_PROYEK = [
  { kode: 'PERENCANAAN', label: 'Perencanaan', desc: 'Investor menyatakan minat; lokasi dan rencana kegiatan masih dijajaki.' },
  { kode: 'PENYIAPAN', label: 'Penyiapan', desc: 'Studi kelayakan, pengurusan izin termasuk KKPRL, dan penyiapan lahan.' },
  { kode: 'TRANSAKSI', label: 'Transaksi', desc: 'Kesepakatan kerja sama dan pembiayaan disusun sampai dana siap dipakai (financial close).' },
  { kode: 'KONSTRUKSI', label: 'Konstruksi', desc: 'Pembangunan fisik berjalan sejak peletakan batu pertama.' },
  { kode: 'OPERASI', label: 'Operasi', desc: 'Fasilitas sudah berjalan dan melayani kegiatan usaha.' },
];

export const LABEL_TAHAPAN = Object.fromEntries(TAHAPAN_PROYEK.map((t) => [t.kode, t.label]));
