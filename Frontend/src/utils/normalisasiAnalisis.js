import { angkaRingkas } from './pemformat.js';

const angka = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));

export const ASPEK_AHP = {
  lokasi: {
    nama: 'Lokasi & Potensi Wilayah',
    dari: 'Kesesuaian tata ruang, potensi SDA, aksesibilitas, kondisi sosial-ekonomi',
  },
  risiko: {
    nama: 'Risiko Investasi',
    dari: 'Risiko pasar, operasional, regulasi, lingkungan, dan sosial',
  },
  finansial: {
    nama: 'Kelayakan Finansial',
    dari: 'NPV, IRR, payback, dan ROI dari proyeksi arus kas',
  },
  prediksi: {
    nama: 'Prediksi Keuntungan',
    dari: 'Rasio perkiraan laba terhadap nilai investasi',
  },
  rekomendasi: {
    nama: 'Rekomendasi Gabungan',
    dari: 'Gabungan berbobot keempat aspek di atas',
  },
};

export const namaAspek = (kunci) => {
  const k = String(kunci ?? '').toLowerCase();
  return ASPEK_AHP[k]?.nama || (k ? k.charAt(0).toUpperCase() + k.slice(1) : '-');
};

export const WARNA_STATUS = {
  hijau: '#15803D',
  kuning: '#B45309',
  merah: '#B91C1C',
  netral: '#0056A5',
};

export const warnaStatus = (nilai) => {
  const t = String(nilai ?? '').toUpperCase().replace(/[\s_-]+/g, '');
  if (t.startsWith('TIDAK') || t === 'RENDAH') return WARNA_STATUS.merah;
  if (t === 'LAYAK' || t === 'TINGGI' || t === 'LOLOS') return WARNA_STATUS.hijau;
  if (t === 'BERSYARAT' || t === 'SEDANG') return WARNA_STATUS.kuning;
  return WARNA_STATUS.netral;
};

export function normalkanAnalisis(mentah) {
  const aj = mentah && typeof mentah === 'object' ? mentah : {};
  const bentukBaru = !!aj.kelayakan;

  const kelayakan = bentukBaru
    ? {
        skor: angka(aj.kelayakan.skor_ahp_total),
        keputusan: aj.kelayakan.keputusan || null,
        prioritas: aj.kelayakan.prioritas || null,
        kelasRisiko: aj.kelayakan.kelas_risiko || null,
        bobot: aj.kelayakan.bobot_kriteria || {},
        perAspek: aj.kelayakan.skor_per_aspek || {},
        rasioKonsistensi: angka(aj.kelayakan.consistency_ratio),
        konsisten: aj.kelayakan.is_consistent,
        mitigasi: aj.kelayakan.strategi_mitigasi || [],
      }
    : {
        skor: angka(aj.ahp_score),
        keputusan: aj.overall_feasibility || null,
        prioritas: null,
        kelasRisiko: null,
        bobot: {},
        perAspek: {},
        rasioKonsistensi: null,
        konsisten: null,
        mitigasi: [],
      };

  const f = aj.finansial || {};
  const finansial = Object.keys(f).length
    ? {
        npv: angka(f.npv_idr),
        irr: angka(f.irr_pct),
        payback: angka(f.payback_period_tahun),
        paybackTercapai: f.payback_tercapai,
        roi: angka(f.roi_pct),
        capex: angka(f.capex_idr),
        pendapatan: angka(f.annual_revenue_idr),
        opex: angka(f.annual_opex_idr),
        tumbuhPendapatan: angka(f.revenue_growth_pct),
        tumbuhOpex: angka(f.opex_growth_pct),
        wacc: angka(f.wacc_pct),
        umur: angka(f.project_lifetime_yr),
        terbaik: f.skenario_terbaik || null,
        terburuk: f.skenario_terburuk || null,
        sensitivitas: f.sensitivitas || null,
      }
    : null;

  const k = aj.ketenagakerjaan || {};
  const kerja = Object.keys(k).length
    ? {
        total: angka(k.total_tenaga_kerja) ?? angka(k.total_lapangan_kerja),
        asalAngka: k.asal_angka || null,
        sektor: k.sektor || aj.sektor || null,
        sektorNama: k.sektor_nama || null,
        pelatihan: k.kebutuhan_pelatihan || [],
        biayaPelatihanJuta: angka(k.total_biaya_pelatihan_juta),
        bagianPosisiAsumsi: k.bagian_posisi_asumsi ?? null,
      }
    : null;

  const s = aj.spasial || {};
  const spasial = Object.keys(s).length
    ? {
        sumber: s.sumber || {},
        risiko: s.risiko || {},
        wilayah: s.wilayah || s.lokasi || {},
        catatan: s.catatan || [],
        skorSpasial: angka(s.skor_berbasis_spasial),
        totalSkor: angka(s.total_skor),
        detail: s.detail || {},
      }
    : null;

  return {
    bentuk: bentukBaru ? 'baru' : 'lama',
    ada: Object.keys(aj).length > 0,
    luasHa: angka(aj.area_ha) ?? angka(aj.area_hectares),
    investasiMiliar: angka(aj.investasi_miliar),
    sektor: aj.sektor || null,
    geometry: aj.geometry || null,
    screening: aj.screening || null,
    kelayakan,
    finansial,
    kerja,
    spasial,
    penyaring: Array.isArray(aj.filters) ? aj.filters : [],
    ringkasanLama: aj.summary || null,
    narasiLama: aj.narrative || null,
  };
}

const INDIKATOR_KONTEKS = [
  { kunci: 'tpt', label: 'Tingkat Pengangguran Terbuka', satuan: '%', desimal: 2 },
  { kunci: 'pengangguran', label: 'Penduduk Berusia 15 Tahun ke Atas yang Menganggur', satuan: ' orang', desimal: 0 },
];

export const pilihKonteksBps = (bps) => {
  if (!bps?.tersedia) return null;

  const baris = INDIKATOR_KONTEKS.map(({ kunci, label, satuan, desimal }) => {
    const ind = bps.indikator?.[kunci];
    if (!ind || typeof ind.nilai !== 'number' || ind.kemutakhiran === 'tidak diketahui') return null;
    return {
      kunci,
      label,
      wilayah: ind.wilayah || bps.wilayah || '',
      kabupaten: ind.tingkat === 'kabupaten',
      usang: ind.kemutakhiran === 'usang',
      teks: `${angkaRingkas(ind.nilai, desimal)}${satuan}`,
      tahun: ind.tahun,
      pembanding: ind.provinsi
        ? `${label} Provinsi ${ind.provinsi.wilayah}: ${angkaRingkas(ind.provinsi.nilai, desimal)}${satuan} (${ind.provinsi.tahun}).`
        : '',
    };
  }).filter(Boolean);

  if (!baris.length) {
    const ada = INDIKATOR_KONTEKS.filter(({ kunci }) => bps.indikator?.[kunci]);
    return {
      kosong: true,
      alasanKosong: ada.length
        ? `Data ketenagakerjaan ${bps.wilayah || 'provinsi ini'} yang tersedia `
          + `(${ada.map((i) => i.label).join(', ')}) tidak mencantumkan tahun dan tidak ditampilkan.`
        : `BPS belum memuat Tingkat Pengangguran Terbuka untuk ${bps.wilayah || 'provinsi ini'}.`,
    };
  }

  const kabupaten = baris.filter((b) => b.kabupaten);
  const usang = baris.filter((b) => b.usang);
  const catatan = [
    kabupaten.length
      ? `${kabupaten.map((b) => b.label).join(', ')} memakai angka ${kabupaten[0].wilayah}, kabupaten/kota terdekat dari area; `
        + 'indikator yang tidak diterbitkan BPS per kabupaten/kota memakai angka provinsi.'
      : 'Angka tingkat provinsi: BPS belum menerbitkan angka kabupaten/kota untuk wilayah terdekat dari area.'
        + (baris.length > 1 ? ' Jumlah penganggur dibagi angkatan kerja provinsi menghasilkan tepat tingkat di atasnya.' : ''),
    ...kabupaten.map((b) => b.pembanding),
    usang.length
      ? `Angka tahun ${[...new Set(usang.map((b) => b.tahun))].join(' / ')} bukan tahun terbaru; dipakai karena itu angka terakhir yang diterbitkan BPS.`
      : '',
  ].filter(Boolean).join(' ');

  return {
    kosong: false,
    wilayah: [...new Set(baris.map((b) => b.wilayah))].join(' · '),
    tahun: [...new Set(baris.map((b) => b.tahun))].sort().reverse().join(' / '),
    baris,
    catatan,
  };
};

export const ringkasKkprlZona = (daftar) => {
  const total = daftar.reduce((n, k) => n + k.jumlah, 0);
  const n = (v) => v.toLocaleString('id-ID');
  return total ? `${n(total)} izin (${daftar.map((k) => `${k.jenis} ${n(k.jumlah)}`).join(', ')})` : 'Belum ada';
};

export const itemSerapan = (total, capexIdr) => {
  const rasio = total > 0 && capexIdr > 0 ? total / (capexIdr / 1e9) : null;
  return [
    { nilai: angkaRingkas(total), satuan: 'Tenaga kerja' },
    ...(rasio === null ? [] : [{ nilai: angkaRingkas(rasio, 1), satuan: 'Tenaga kerja per Rp 1 miliar investasi' }]),
  ];
};

export const PENJELASAN_RISIKO = {
  tema:
    'Risiko lingkungan dan sosial yang melekat pada lokasi proyek, bukan pada pemrakarsanya. '
    + 'Angkanya dihitung dari geometri area proyek terhadap data ekosistem, bencana, kemiskinan, '
    + 'dan nelayan yang berlaku saat laporan dibuka.',
  lingkungan:
    'Angka risiko lingkungan berasal dari kepekaan ekosistem pesisir yang beririsan dengan area, '
    + 'yaitu mangrove dan terumbu karang, serta indeks risiko bencana BNPB InaRISK; ekosistem yang '
    + 'sehat justru menaikkan risiko karena pembangunan di atasnya menimbulkan kerusakan dan '
    + 'kewajiban lingkungan yang lebih besar.',
  sosial:
    'Angka kemiskinan berasal dari persentase penduduk kabupaten/kota yang terdaftar dalam DTKS '
    + 'desil 1–4, dan angka konflik tenurial dari persentase penduduk yang bekerja sebagai '
    + 'nelayan; keduanya dibandingkan dengan 281 kabupaten/kota pesisir lain sehingga bernilai 0 '
    + '(terendah) hingga 1 (tertinggi).',
};

const SKOR_BAGIAN = {
  ruang: [
    ['lokasi', 'tata_ruang', 'tata_ruang', 'Kesesuaian tata ruang'],
    ['lokasi', 'potensi_sda', 'potensi_sda', 'Potensi sumber daya'],
    ['risiko', 'regulasi', 'regulasi', 'Risiko regulasi'],
    ['risiko', 'operasional', 'operasional', 'Risiko bencana'],
  ],
  transportasi: [['lokasi', 'aksesibilitas', 'aksesibilitas', 'Aksesibilitas']],
  sosial: [['lokasi', 'sosial_ekonomi', 'kondisi_sosek', 'Kondisi sosial-ekonomi']],
  risiko: [
    ['risiko', 'lingkungan', 'lingkungan', 'Risiko lingkungan'],
    ['risiko', 'sosial', 'sosial', 'Risiko sosial'],
  ],
  kelayakan: [
    ['finansial', 'npv_score', null, 'NPV'],
    ['finansial', 'irr_score', null, 'IRR'],
    ['finansial', 'payback_score', null, 'Payback'],
    ['finansial', 'roi_score', null, 'ROI'],
    ['prediksi', 'score', null, 'Prediksi keuntungan'],
    ['risiko', 'pasar', 'pasar', 'Risiko pasar'],
  ],
};

export const KETERANGAN_SKOR_BAGIAN =
  'Skor bagian ini yang dipakai penilaian AHP pada bagian Kelayakan Investasi. Untuk risiko, '
  + 'skor adalah kebalikan nilai risikonya: makin tinggi skor, makin aman.';

export const skorBagian = (perAspek, sumber, tema) =>
  (SKOR_BAGIAN[tema] || [])
    .filter(([aspek, kunci]) => perAspek?.[aspek]?.detail?.[kunci] != null)
    .map(([aspek, kunci, kunciSumber, label]) => {
      const skor = perAspek[aspek].detail[kunci];
      const risiko = aspek === 'risiko' ? ` (nilai risiko ${angkaRingkas(1 - skor, 2)})` : '';
      const bawaan = kunciSumber && sumber?.[kunciSumber] === 'default' ? ' - nilai bawaan' : '';
      return [`${label}${risiko}${bawaan}`, `${angkaRingkas(skor * 100, 1)}%`, namaAspek(aspek)];
    });

export default normalkanAnalisis;
