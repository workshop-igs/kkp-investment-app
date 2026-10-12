import { Kanvas, siapkanAsetPdf } from './pdfLaporan';
import { rupiahRingkas } from './pemformat';
import { LABEL_TAHAPAN, TAHAPAN_PROYEK } from './konstanta';

const angka = (v, d = 0) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

const persen = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? '—'
    : `${Number(v).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const bagianRealisasi = (rencana, realisasi) => {
  const r = Number(rencana) || 0;
  if (r <= 0) return null;
  return ((Number(realisasi) || 0) / r) * 100;
};

export function buatPdfPipeline({ ringkas, perStatus, perSektor, perProvinsi, proyek, cakupan }) {
  const s = ringkas || {};
  const k = new Kanvas(
    'Laporan Proyek Investasi Ruang Laut',
    'Rekapitulasi proyek investasi ruang laut yang tercatat di aplikasi beserta tahap perkembangannya.',
    { keteranganKop: 'Laporan Proyek Investasi' }
  );
  k.blokJudul([
    cakupan ? `Cakupan: ${cakupan}` : 'Cakupan: seluruh proyek',
    'Disusun dari basis data aplikasi pada saat penerbitan',
  ]);

  k.tema(
    'Ringkasan Portofolio',
    'Rekapitulasi proyek investasi ruang laut yang tercatat di aplikasi, '
      + 'dari tahap perencanaan sampai beroperasi.'
  );

  k.angkaBesar([
    { nilai: angka(s.total_proyek), satuan: 'proyek tercatat' },
    { nilai: rupiahRingkas(s.total_investasi_miliar * 1e9), satuan: 'nilai rencana' },
    { nilai: rupiahRingkas(s.total_realisasi_miliar * 1e9), satuan: 'terealisasi' },
    { nilai: persen(s.pct_realisasi), satuan: 'capaian realisasi' },
  ]);

  k.angkaBesar([
    { nilai: angka(s.total_tenaga_kerja), satuan: 'perkiraan tenaga kerja' },
    { nilai: `${angka(s.total_luas_ha, 1)} ha`, satuan: 'luas area proyek' },
    { nilai: angka(s.total_provinsi), satuan: 'provinsi tercakup' },
    { nilai: angka(s.total_sektor), satuan: 'jenis investasi tersedia' },
  ]);

  if (cakupan) {
    k.peringatan(
      `Cakupan dokumen ini: ${cakupan}. Daftar proyek di bawah mengikuti penyaring tersebut, `
        + 'sedangkan angka ringkasan dan rekapitulasi di atas dihitung atas SELURUH proyek.'
    );
  }

  if (perStatus?.length) {
    const totalProyek = perStatus.reduce((a, r) => a + (r.count || 0), 0) || 1;
    k.tema(
      'Sebaran menurut Tahap Proyek',
      'Tahap mengikuti tahapan Proyek Strategis Nasional (PP 42/2021, KPPIP Kemenko Perekonomian): '
        + `${TAHAPAN_PROYEK.map((t) => t.label.toLowerCase()).join(', ')}.`
    );
    k.tabel(
      ['Tahap', 'Proyek', 'Bagian', 'Nilai Rencana'],
      perStatus.map((r) => [
        LABEL_TAHAPAN[r.status] || r.label || r.status,
        angka(r.count),
        persen(((r.count || 0) / totalProyek) * 100),
        rupiahRingkas((r.total_miliar || 0) * 1e9),
      ]),
      [78, 26, 30, 44]
    );
  }

  if (perSektor?.length) {
    k.tema(
      'Rekapitulasi menurut Jenis Investasi',
      'Hanya jenis investasi yang sudah memiliki proyek tercatat yang muncul di sini; '
        + 'jenis tanpa proyek bukan berarti tertutup bagi investasi.'
    );
    k.tabel(
      ['Jenis Investasi', 'Proyek', 'Rencana', 'Realisasi', 'Capaian'],
      perSektor.map((r) => [
        r.sektor_nama || '—',
        angka(r.count),
        rupiahRingkas((r.total_rencana_miliar || 0) * 1e9),
        rupiahRingkas((r.total_realisasi_miliar || 0) * 1e9),
        persen(bagianRealisasi(r.total_rencana_miliar, r.total_realisasi_miliar)),
      ]),
      [62, 22, 32, 32, 30]
    );
  }

  if (perProvinsi?.length) {
    k.tema(
      'Rekapitulasi menurut Wilayah',
      'Provinsi ditentukan dari geometri proyek, bukan dari isian teks lokasinya. '
        + 'Proyek di luar 12 mil laut berada di perairan nasional dan tidak bertuan provinsi.'
    );
    k.tabel(
      ['Provinsi', 'Proyek', 'Rencana', 'Realisasi', 'Tenaga Kerja'],
      perProvinsi.map((r) => [
        r.provinsi_nama || 'Perairan nasional',
        angka(r.count),
        rupiahRingkas((r.total_rencana_miliar || 0) * 1e9),
        rupiahRingkas((r.total_realisasi_miliar || 0) * 1e9),
        angka(r.total_tk),
      ]),
      [58, 22, 32, 32, 34]
    );
  }

  if (proyek?.length) {
    k.tema(
      'Daftar Proyek',
      cakupan
        ? `Proyek yang tercakup penyaring aktif (${proyek.length} baris).`
        : `Seluruh proyek tercatat (${proyek.length} baris).`
    );
    k.tabel(
      ['Nama Proyek', 'Jenis Investasi', 'Provinsi', 'Tahap', 'Nilai'],
      proyek.map((p) => [
        `${p.kode_proyek ? `${p.kode_proyek} · ` : ''}${p.nama || '—'}`,
        p.sektor_nama || '—',
        p.provinsi_nama || '—',
        LABEL_TAHAPAN[p.status] || p.status || '—',
        rupiahRingkas((p.nilai_investasi_miliar || 0) * 1e9),
      ]),
      [62, 38, 34, 18, 26]
    );
  } else {
    k.peringatan('Tidak ada proyek yang tercakup penyaring aktif, sehingga daftarnya kosong.');
  }

  k.tema('Catatan Penyusunan', null);
  k.teks(
    'Seluruh angka pada dokumen ini dibaca langsung dari basis data aplikasi pada saat '
      + 'dokumen diterbitkan; tidak ada nilai yang disalin atau diasumsikan. Nilai '
      + 'rupiah disajikan ringkas (T = triliun, M = miliar, Jt = juta) mengikuti besarannya.'
  );
  k.teks(
    'Capaian realisasi adalah nilai terealisasi dibagi nilai rencana. Jenis investasi atau wilayah '
      + 'yang rencananya nol ditulis "—", bukan 0%, karena keduanya berbeda arti: yang '
      + 'pertama belum punya rencana, yang kedua punya rencana tetapi belum terealisasi.'
  );
  k.teks(
    'Perkiraan tenaga kerja adalah perkiraan serapan, bukan lapangan kerja yang sudah '
      + 'tercipta. Angkanya tersimpan bersama proyek saat analisis kelayakannya dijalankan.'
  );

  return k.selesaikan();
}

export async function unduhPdfPipeline(opsi) {
  await siapkanAsetPdf();
  const doc = buatPdfPipeline(opsi);
  const tgl = new Date().toISOString().slice(0, 10);
  doc.save(`Laporan-Proyek-Investasi-${tgl}.pdf`);
}

export default unduhPdfPipeline;
