import { jsPDF } from 'jspdf';
import {
  ASPEK_AHP,
  KETERANGAN_SKOR_BAGIAN,
  PENJELASAN_RISIKO,
  pilihKonteksBps,
  itemSerapan,
  ringkasKkprlZona,
  skorBagian,
  warnaStatus,
} from './normalisasiAnalisis';
import { angkaRingkas as angkaRingkasUmum, rupiahRingkas as rupiahRingkasUmum } from './pemformat';
import { ATRIBUSI_CITRA, RASIO_PANEL, siapkanPetaLaporan } from './petaLaporan';
import { barisTitikSudut, keDMS } from './koordinat';

const AKSEN = [0, 86, 165];
const GELAP = [15, 23, 42];
const ABU = [100, 116, 139];
const ABU_MUDA = [148, 163, 184];
const GARIS = [226, 232, 240];
const SELANG = [248, 250, 252];
const AMBER_ISI = [255, 251, 235];
const AMBER_GARIS = [253, 230, 138];
const AMBER_TEKS = [146, 64, 14];
const HIJAU_TEKS = [4, 120, 87];
const MERAH_TEKS = [190, 18, 60];

const PITA_HIJAU = [140, 198, 63];
const PITA_CYAN = [64, 191, 219];
const PITA_BIRU = [27, 106, 138];
const PITA_BAGIAN = [0.204, 0.376, 0.42];

const HAL_W = 210;
const HAL_H = 297;
const TEPI = 14;
const LEBAR = HAL_W - TEPI * 2;

const ZONA_KOP = 22;
const ZONA_KAKI = 16;

const T = {
  judul: 19,
  bagian: 7.5,
  kartu: 10.5,
  angka: 15,
  isi: 8,
  tabel: 7.2,
  kecil: 6.4,
};

const RITME = 4;

let FONT = 'helvetica';
let LOGO = null;
let janjiAset = null;
let FONT_400 = null;
let FONT_700 = null;

async function _muatLogo() {
  const gambar = await new Promise((selesai, gagal) => {
    const g = new Image();
    g.onload = () => selesai(g);
    g.onerror = gagal;
    g.src = '/logo-kkp.png';
  });
  const sisi = 160;
  const kanvas = document.createElement('canvas');
  kanvas.width = sisi;
  kanvas.height = Math.round((sisi * gambar.height) / gambar.width) || sisi;
  const ctx = kanvas.getContext('2d');
  ctx.drawImage(gambar, 0, 0, kanvas.width, kanvas.height);
  return { data: kanvas.toDataURL('image/png'), w: kanvas.width, h: kanvas.height };
}

export function siapkanAsetPdf() {
  if (janjiAset) return janjiAset;
  janjiAset = (async () => {
    try {
      const { PUBLIC_SANS_400, PUBLIC_SANS_700 } = await import('./fontPublicSans');
      FONT_400 = PUBLIC_SANS_400;
      FONT_700 = PUBLIC_SANS_700;
    } catch (e) {
      console.error('[PDF] Public Sans gagal dimuat, memakai Helvetica', e);
      FONT_400 = FONT_700 = null;
    }
    try {
      LOGO = await _muatLogo();
    } catch (e) {
      console.error('[PDF] Logo KKP gagal dimuat; kop tetap digambar tanpa logo', e);
      LOGO = null;
    }
  })();
  return janjiAset;
}

export const bersih = (t) =>
  String(t ?? '')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, '|')
    .replace(/…/g, '...')
    .replace(/ /g, ' ');

const hexKeRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return ABU;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const nf = (v, d = 0) => angkaRingkasUmum(v, d, '-');
const rupiahRingkas = (v) => rupiahRingkasUmum(v, '-');

export function pasangFontPdf(doc) {
  FONT = 'helvetica';
  if (FONT_400 && FONT_700) {
    try {
      doc.addFileToVFS('PublicSans-Regular.ttf', FONT_400);
      doc.addFont('PublicSans-Regular.ttf', 'PublicSans', 'normal');
      doc.addFileToVFS('PublicSans-Bold.ttf', FONT_700);
      doc.addFont('PublicSans-Bold.ttf', 'PublicSans', 'bold');
      FONT = 'PublicSans';
    } catch (e) {
      console.error('[PDF] Pendaftaran Public Sans gagal, memakai Helvetica', e);
    }
  }
  return FONT;
}

export const logoPdf = () => LOGO;

export class Kanvas {
  constructor(judul, subjudul, { keteranganKop = '' } = {}) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    pasangFontPdf(this.doc);

    this.judul = judul;
    this.subjudul = subjudul;
    this.keteranganKop = keteranganKop || subjudul || '';
    this.halaman = 0;
    this.kartuMulai = null;
    this.halamanBaru();
  }

  _pita(y, tinggi) {
    const d = this.doc;
    let x = 0;
    const warna = [PITA_HIJAU, PITA_CYAN, PITA_BIRU];
    PITA_BAGIAN.forEach((bagian, i) => {
      const w = HAL_W * bagian;
      d.setFillColor(...warna[i]);
      d.rect(x, y, w + 0.2, tinggi, 'F');
      x += w;
    });
  }

  halamanBaru() {
    if (this.halaman > 0) this.doc.addPage();
    this.halaman += 1;

    const d = this.doc;

    if (LOGO) {
      const tinggiLogo = 8;
      const lebarLogo = (LOGO.w / LOGO.h) * tinggiLogo;
      d.addImage(LOGO.data, 'PNG', TEPI, 8, lebarLogo, tinggiLogo);
    }
    const xTeks = TEPI + (LOGO ? 11 : 0);

    d.setTextColor(...PITA_BIRU);
    d.setFont(FONT, 'bold');
    d.setFontSize(7.4);
    d.text('KEMENTERIAN KELAUTAN DAN PERIKANAN', xTeks, 11.6, { charSpace: 0.12 });

    d.setTextColor(...ABU_MUDA);
    d.setFont(FONT, 'normal');
    d.setFontSize(6);
    d.text('Modul Manajemen Investasi Ruang Laut', xTeks, 15.2);

    if (this.keteranganKop) {
      d.setFontSize(6);
      d.setTextColor(...ABU_MUDA);
      const baris = d.splitTextToSize(bersih(this.keteranganKop), 66);
      d.text(baris.slice(0, 2), HAL_W - TEPI, 11.6, { align: 'right' });
    }

    this._pita(ZONA_KOP - 3, 1);

    this.y = ZONA_KOP + RITME;
    this.kartuMulai = null;
  }

  blokJudul(meta) {
    const d = this.doc;
    this.ruang(34);

    d.setTextColor(...GELAP);
    d.setFont(FONT, 'bold');
    d.setFontSize(T.judul);
    const jb = d.splitTextToSize(bersih(this.judul), LEBAR);
    d.text(jb, TEPI, this.y + 6);
    this.y += jb.length * 7.4 + 1;

    if (this.subjudul) {
      d.setTextColor(...ABU);
      d.setFont(FONT, 'normal');
      d.setFontSize(T.isi);
      const sb = d.splitTextToSize(bersih(this.subjudul), LEBAR);
      d.text(sb, TEPI, this.y + 3);
      this.y += sb.length * 4 + 1;
    }

    this.y += 2;
    d.setFillColor(...AKSEN);
    d.rect(TEPI, this.y, 24, 0.8, 'F');
    this.y += RITME;

    if (meta?.length) {
      d.setTextColor(...ABU_MUDA);
      d.setFont(FONT, 'normal');
      d.setFontSize(T.kecil);
      meta.forEach((m) => {
        d.text(bersih(m), TEPI, this.y);
        this.y += 3.4;
      });
      this.y += 1;
    }
    this.y += RITME;
  }

  ruang(butuh) {
    if (this.y + butuh <= HAL_H - ZONA_KAKI) return;
    if (this.kartuMulai !== null) {
      this._bingkai(this.kartuMulai, this.y);
      this.halamanBaru();
      this.kartuMulai = this.y;
      this._garisAksen(this.y);
      this.y += 5;
    } else {
      this.halamanBaru();
    }
  }

  _garisAksen(y) {
    this.doc.setFillColor(...AKSEN);
    this.doc.rect(TEPI, y, LEBAR, 0.6, 'F');
  }

  _bingkai(atas, bawah) {
    this.doc.setDrawColor(...GARIS);
    this.doc.setLineWidth(0.2);
    this.doc.rect(TEPI, atas, LEBAR, bawah - atas, 'S');
  }

  tema(eyebrow, pengantar) {
    this.ruang(30);
    const d = this.doc;

    d.setTextColor(...AKSEN);
    d.setFont(FONT, 'bold');
    d.setFontSize(T.bagian);
    d.text(bersih(eyebrow).toUpperCase(), TEPI, this.y, { charSpace: 0.12 });
    this.y += 2.2;
    d.setFillColor(...AKSEN);
    d.rect(TEPI, this.y, 14, 0.5, 'F');
    this.y += RITME;

    if (pengantar) {
      d.setTextColor(...ABU);
      d.setFont(FONT, 'normal');
      d.setFontSize(T.isi);
      const baris = d.splitTextToSize(bersih(pengantar), LEBAR);
      d.text(baris, TEPI, this.y);
      this.y += baris.length * 3.8 + 3;
    }
  }

  bukaKartu(judul, pengantar) {
    this.ruang(30);
    this.kartuMulai = this.y;
    this._garisAksen(this.y);
    this.y += 6;

    const d = this.doc;
    d.setTextColor(...GELAP);
    d.setFont(FONT, 'bold');
    d.setFontSize(T.kartu);
    const jb = d.splitTextToSize(bersih(judul), LEBAR - 8);
    d.text(jb, TEPI + 4, this.y);
    this.y += jb.length * 4.6 + 1;

    if (pengantar) {
      d.setTextColor(...ABU);
      d.setFont(FONT, 'normal');
      d.setFontSize(7.4);
      const pb = d.splitTextToSize(bersih(pengantar), LEBAR - 8);
      d.text(pb, TEPI + 4, this.y);
      this.y += pb.length * 3.5 + 2;
    }
  }

  tutupKartu(catatan) {
    if (catatan) {
      this.ruang(10);
      const d = this.doc;
      this.y += 1;
      d.setDrawColor(...GARIS);
      d.setLineWidth(0.15);
      d.line(TEPI + 4, this.y, TEPI + LEBAR - 4, this.y);
      this.y += 3.5;
      d.setTextColor(...ABU_MUDA);
      d.setFont(FONT, 'normal');
      d.setFontSize(6.5);
      const cb = d.splitTextToSize(bersih(catatan), LEBAR - 8);
      d.text(cb, TEPI + 4, this.y);
      this.y += cb.length * 2.8;
    }
    this.y += 3;
    if (this.kartuMulai !== null) this._bingkai(this.kartuMulai, this.y);
    this.kartuMulai = null;
    this.y += 5;
  }

  angkaBesar(item) {
    if (!item?.length) return;
    this.ruang(22);
    const d = this.doc;
    const kolom = LEBAR / item.length;
    const muat = kolom - 3;
    const atas = this.y + 7;

    item.forEach((a, i) => {
      const x = TEPI + kolom * i + kolom / 2;
      const nilai = bersih(a.nilai);

      d.setFont(FONT, 'bold');
      let ukuran = T.angka;
      d.setFontSize(ukuran);
      while (ukuran > 8 && d.getTextWidth(nilai) > muat) {
        ukuran -= 0.5;
        d.setFontSize(ukuran);
      }
      d.setTextColor(...(a.warna || AKSEN));
      d.text(nilai, x, atas, { align: 'center' });

      d.setTextColor(...ABU_MUDA);
      d.setFont(FONT, 'normal');
      d.setFontSize(5.9);
      const sb = d.splitTextToSize(bersih(a.satuan).toUpperCase(), muat);
      d.text(sb.slice(0, 2), x, atas + 4.2, { align: 'center', charSpace: 0.14 });
    });
    this.y = atas + 4.2 + 3.2 * 2 + 2;
  }

  tabel(kolom, baris, lebarKolom) {
    if (!baris?.length) return;
    const d = this.doc;
    const lk = lebarKolom || kolom.map((_, i) => (i === 0 ? (LEBAR - 8) * 0.5 : (LEBAR - 8) * 0.5 / (kolom.length - 1)));

    const kepala = () => {
      this.ruang(13);
      d.setFillColor(...SELANG);
      d.rect(TEPI + 2, this.y - 3.4, LEBAR - 4, 5.6, 'F');
      d.setTextColor(...ABU);
      d.setFont(FONT, 'bold');
      d.setFontSize(5.9);
      let x = TEPI + 4;
      kolom.forEach((k, i) => {
        d.text(
          bersih(k).toUpperCase(),
          i === 0 ? x : x + lk[i],
          this.y,
          { align: i === 0 ? 'left' : 'right', charSpace: 0.12 }
        );
        x += lk[i];
      });
      this.y += 2.2;
      d.setDrawColor(...GARIS);
      d.setLineWidth(0.3);
      d.line(TEPI + 2, this.y, TEPI + LEBAR - 2, this.y);
      this.y += 4;
    };

    kepala();
    baris.forEach((r, idx) => {
      const sebelum = this.halaman;
      this.ruang(6.4);
      if (this.halaman !== sebelum) kepala();

      d.setFont(FONT, 'normal');
      d.setFontSize(T.tabel);
      let x = TEPI + 4;
      r.forEach((sel, i) => {
        d.setTextColor(...(i === 0 ? GELAP : ABU));
        const teks = bersih(sel ?? '-');
        const potong = i === 0 ? d.splitTextToSize(teks, lk[0] - 2)[0] : teks;
        d.text(potong, i === 0 ? x : x + lk[i], this.y, { align: i === 0 ? 'left' : 'right' });
        x += lk[i];
      });
      this.y += 2;

      if (idx < baris.length - 1) {
        d.setDrawColor(...GARIS);
        d.setLineWidth(0.1);
        d.line(TEPI + 4, this.y, TEPI + LEBAR - 4, this.y);
      }
      this.y += 3.4;
    });
    this.y += 1;
  }

  tabelDaftar(kolom, isi, warna = []) {
    const d = this.doc;
    const lebar = (LEBAR - 8) / kolom.length;
    d.setFont(FONT, 'normal');
    d.setFontSize(T.tabel);
    const sel = isi.map((daftar) => (daftar.length ? daftar : ['-']).flatMap((t) => d.splitTextToSize(bersih(t), lebar - 4)));
    const jumlah = Math.max(...sel.map((b) => b.length));
    const tinggi = jumlah * 3.2;
    const kepala = () => {
      d.setFillColor(...SELANG);
      d.rect(TEPI + 2, this.y - 3.4, LEBAR - 4, 5.6, 'F');
      d.setFont(FONT, 'bold');
      d.setFontSize(5.9);
      kolom.forEach((k, i) => {
        d.setTextColor(...(warna[i] || ABU));
        d.text(bersih(k).toUpperCase(), TEPI + 4 + i * lebar, this.y, { charSpace: 0.12 });
      });
      this.y += 2.2;
      d.setDrawColor(...GARIS);
      d.setLineWidth(0.3);
      d.line(TEPI + 2, this.y, TEPI + LEBAR - 2, this.y);
      this.y += 4;
      d.setFont(FONT, 'normal');
      d.setFontSize(T.tabel);
      d.setTextColor(...GELAP);
    };
    if (tinggi + 12 <= HAL_H - ZONA_KOP - ZONA_KAKI - 12) {
      this.ruang(tinggi + 12);
      kepala();
      sel.forEach((b, i) => b.forEach((t, j) => d.text(t, TEPI + 4 + i * lebar, this.y + j * 3.2)));
      this.y += tinggi + 1;
      return;
    }
    this.ruang(30);
    kepala();
    for (let j = 0; j < jumlah; j += 1) {
      if (this.y + 3.2 > HAL_H - ZONA_KAKI) {
        this.ruang(HAL_H);
        kepala();
      }
      sel.forEach((b, i) => b[j] && d.text(b[j], TEPI + 4 + i * lebar, this.y));
      this.y += 3.2;
    }
    this.y += 1;
  }

  peta(panel) {
    if (!panel?.gambar) return;
    const d = this.doc;
    const w = LEBAR - 8;
    const h = w * RASIO_PANEL;
    this.ruang(h + 10);
    d.addImage(panel.gambar, panel.format || 'PNG', TEPI + 4, this.y - 3, w, h, undefined, 'FAST');
    this.y += h + 2;

    const butir = [{ label: 'Area analisis', warna: '#b91c1c' }, ...(panel.legenda || [])];
    d.setFont(FONT, 'normal');
    d.setFontSize(6.2);
    let x = TEPI + 4;
    butir.slice(0, 14).forEach((it) => {
      const teks = bersih(it.label);
      const lebarButir = d.getTextWidth(teks) + 8;
      if (x + lebarButir > TEPI + LEBAR - 4) {
        x = TEPI + 4;
        this.y += 4;
        this.ruang(5);
      }
      d.setFillColor(...hexKeRgb(it.warna));
      d.rect(x, this.y - 1.9, 2.6, 2.6, 'F');
      d.setTextColor(...ABU);
      d.text(teks, x + 3.9, this.y);
      x += lebarButir;
    });
    this.y += 4;

    if (!panel.jumlah) {
      d.setFontSize(6);
      d.setTextColor(...AMBER_TEKS);
      d.text(
        'Tidak ada objek tema ini di dalam cakupan peta; objek terdekat beserta jaraknya ada pada tabel di bawah.',
        TEPI + 4,
        this.y
      );
      this.y += 3.4;
    }

    if (panel.citra) {
      d.setFontSize(5.6);
      d.setTextColor(...ABU_MUDA);
      d.text(`${ATRIBUSI_CITRA} - latar, bukan data KKP`, TEPI + 4, this.y);
      this.y += 3;
    }
    this.y += 2;
  }

  daftar(item) {
    if (!item?.length) return;
    const d = this.doc;
    item.forEach((t, i) => {
      d.setFont(FONT, 'normal');
      d.setFontSize(7.5);
      const baris = d.splitTextToSize(bersih(t), LEBAR - 14);
      this.ruang(baris.length * 3.4 + 3);
      d.setTextColor(...AKSEN);
      d.setFont(FONT, 'bold');
      d.text(`${i + 1}.`, TEPI + 4, this.y);
      d.setTextColor(...ABU);
      d.setFont(FONT, 'normal');
      d.text(baris, TEPI + 10, this.y);
      this.y += baris.length * 3.4 + 2;
    });
  }

  peringatan(teks) {
    const d = this.doc;
    d.setFont(FONT, 'normal');
    d.setFontSize(7);
    const baris = d.splitTextToSize(bersih(teks), LEBAR - 14);
    const tinggi = baris.length * 3.4 + 5;
    this.ruang(tinggi + 3);
    d.setFillColor(...AMBER_ISI);
    d.setDrawColor(...AMBER_GARIS);
    d.setLineWidth(0.2);
    d.rect(TEPI + 4, this.y - 3.5, LEBAR - 8, tinggi, 'FD');
    d.setTextColor(...AMBER_TEKS);
    d.text(baris, TEPI + 7, this.y);
    this.y += tinggi + 1;
  }

  teks(isi, { ukuran = 7.5, warna = ABU, tebal = false } = {}) {
    const d = this.doc;
    d.setFont(FONT, tebal ? 'bold' : 'normal');
    d.setFontSize(ukuran);
    const baris = d.splitTextToSize(bersih(isi), LEBAR - 8);
    this.ruang(baris.length * 3.4 + 2);
    d.setTextColor(...warna);
    d.text(baris, TEPI + 4, this.y);
    this.y += baris.length * 3.4 + 2;
  }

  selesaikan() {
    const d = this.doc;
    const total = d.getNumberOfPages();
    const tgl = new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    for (let i = 1; i <= total; i += 1) {
      d.setPage(i);

      d.setDrawColor(...GARIS);
      d.setLineWidth(0.2);
      d.line(TEPI, HAL_H - 12.5, HAL_W - TEPI, HAL_H - 12.5);

      d.setFont(FONT, 'bold');
      d.setFontSize(6.2);
      d.setTextColor(...PITA_BIRU);
      d.text('PLATFORM MANAJEMEN INVESTASI KKP', TEPI, HAL_H - 8.8, { charSpace: 0.12 });

      d.setFont(FONT, 'normal');
      d.setFontSize(T.kecil);
      d.setTextColor(...ABU_MUDA);
      d.text(`Halaman ${i} dari ${total}`, HAL_W - TEPI, HAL_H - 8.8, { align: 'right' });

      d.setFontSize(5.8);
      d.text(
        `Diterbitkan ${tgl} dari basis data aplikasi - bukan salinan manual`,
        TEPI,
        HAL_H - 5.6
      );

      this._pita(HAL_H - 3.2, 2.4);
    }
    return d;
  }
}

function buatPdfLaporan({ namaProyek, subjudul, analisis, spasial, bps, bencana, peta, jenisInvestasi }) {
  const k = new Kanvas(namaProyek || 'Laporan Analisis Ruang Laut', subjudul || '', {
    keteranganKop: 'Laporan Analisis Kelayakan Investasi Ruang Laut',
  });
  k.blokJudul([
    'Dokumen analisis kelayakan investasi berbasis poligon',
    'Disusun dari basis data aplikasi pada saat penerbitan',
  ]);
  const a = analisis;

  const kotakSkor = (...tema) => {
    const baris = tema.flatMap((t) => skorBagian(a.kelayakan?.perAspek, a.spasial?.sumber, t));
    if (!baris.length) return;
    k.bukaKartu('Skor untuk Penilaian AHP', KETERANGAN_SKOR_BAGIAN);
    k.tabel(['Kriteria', 'Skor', 'Aspek AHP'], baris, [(LEBAR - 8) * 0.52, (LEBAR - 8) * 0.14, (LEBAR - 8) * 0.34]);
    k.tutupKartu();
  };

  k.tema(
    'Informasi Umum',
    'Ukuran area yang dianalisis, letak geografisnya, dan wilayah administratif yang menaunginya.'
  );

  if (jenisInvestasi) {
    k.bukaKartu('Jenis Investasi');
    k.angkaBesar([{ nilai: jenisInvestasi, satuan: 'Sektor investasi' }]);
    k.tutupKartu();
  }

  const area = spasial?.area;
  if (area) {
    k.bukaKartu(
      'Luas Area Laporan',
      'Ukuran area tidak selalu menggambarkan luas dampak sebenarnya. Dampak kumulatif atau sementara dapat berada di dalam maupun jauh di luar batas ini.'
    );
    k.angkaBesar([
      { nilai: nf(area.luas_ha, 2), satuan: 'Hektare' },
      { nilai: nf(area.luas_m2), satuan: 'Meter persegi' },
    ]);
    const titik = barisTitikSudut(area.titik_sudut);
    if (titik.length) {
      k.tabel(
        ['Titik', 'Lintang', 'Bujur', 'Desimal (lintang, bujur)'],
        titik.map((t) => [t.no, keDMS(t.y, 'lat'), keDMS(t.x, 'lng'), `${nf(t.y, 6)}, ${nf(t.x, 6)}`]),
        [(LEBAR - 8) * 0.1, (LEBAR - 8) * 0.25, (LEBAR - 8) * 0.25, (LEBAR - 8) * 0.4]
      );
    }
    k.tutupKartu(
      `Luas dihitung pada elipsoid WGS84 (PostGIS ::geography), bukan pada proyeksi peta. Koordinat ${titik.length} titik sudut poligon dalam datum WGS84.`
    );
  } else if (a.luasHa) {
    k.bukaKartu('Luas Area Laporan');
    k.angkaBesar([{ nilai: nf(a.luasHa), satuan: 'Hektare' }]);
    k.tutupKartu('Rincian geometri tidak tersimpan pada analisis ini.');
  }

  const sc = a.screening;
  if (sc) {
    k.tema(
      'Tahap 1 - Screening Kesesuaian Ruang',
      'Kesesuaian lokasi terhadap acuan tata ruang berjenjang (RTRW Provinsi, Rencana Zonasi KAW, RTRWN), tumpang tindih dengan KKPRL yang sudah terbit, dan ketentuan ruang lainnya. Lokasi yang tidak sesuai tidak dilanjutkan ke analisis finansial.'
    );
    k.bukaKartu(
      `Hasil: ${sc.status_label}`,
      `${sc.sektor_nama} | cakupan acuan tata ruang ${nf(sc.cakupan_persen, 1)}% | ${
        sc.lanjut ? 'dilanjutkan ke Tahap 2' : 'analisis berhenti di Tahap 1'
      }`
    );
    if (sc.zona.length) {
      k.tabel(
        ['Zona', 'Sub-zona', 'Acuan', 'Porsi', 'Ketentuan'],
        sc.zona.map((z) => [z.nama, z.sub_zona_label, z.tingkat_label, `${nf(z.persen, 1)}%`, z.ketentuan_label]),
        [(LEBAR - 8) * 0.3, (LEBAR - 8) * 0.22, (LEBAR - 8) * 0.18, (LEBAR - 8) * 0.1, (LEBAR - 8) * 0.2]
      );
      const rincianJenis = [];
      sc.zona.forEach((z) => {
        if (!z.rincian) return;
        const kunci = JSON.stringify(z.rincian);
        const ada = rincianJenis.find((r) => r.kunci === kunci);
        if (ada) ada.nama.push(z.nama);
        else rincianJenis.push({ kunci, rincian: z.rincian, label: z.ketentuan_label, nama: [z.nama] });
      });
      if (rincianJenis.length) {
        k.teks(`Rincian kegiatan ${sc.sektor_nama.toLowerCase()} menurut matriks Perda`, { tebal: true, warna: GELAP, ukuran: 7.5 });
        rincianJenis.forEach((r) => {
          k.teks(`${r.nama.join(', ')}: ${r.label}`, { tebal: true, warna: GELAP, ukuran: 7 });
          k.tabelDaftar(
            [`Diperbolehkan (${r.rincian.DIIZINKAN.length})`, `Bersyarat (${r.rincian.BERSYARAT.length})`,
              `Tidak diperbolehkan (${r.rincian.TIDAK_DIIZINKAN.length})`],
            [r.rincian.DIIZINKAN, r.rincian.BERSYARAT, r.rincian.TIDAK_DIIZINKAN],
            [HIJAU_TEKS, AMBER_TEKS, MERAH_TEKS]
          );
        });
        k.teks(
          'Status jenis investasi di tiap zona diturunkan dari rincian ini: diizinkan bila seluruh rinciannya diperbolehkan, '
            + 'bersyarat bila sebagian rinciannya dibatasi atau dilarang, dan tidak diizinkan bila seluruhnya dilarang.',
          { ukuran: 6.2 }
        );
      }
    }
    if (sc.karakter) {
      k.teks(`Karakter lokasi ${sc.sektor_nama.toLowerCase()}`, { tebal: true, warna: GELAP, ukuran: 7.5 });
      k.tabel(
        ['Aspek', 'Keterangan'],
        [
          ['Kebutuhan', sc.karakter.kebutuhan || 'Tidak ada syarat karakter khusus.'],
          ['Kondisi area', sc.karakter.terukur],
          ['Kecocokan', sc.karakter.cocok ? 'Cocok' : 'Belum cocok'],
        ],
        [(LEBAR - 8) * 0.22, (LEBAR - 8) * 0.78]
      );
      if (sc.parameter?.length) {
        k.teks(`${nf(sc.persen_sangat_sesuai)}% dari ${sc.parameter.filter((p) => p.nilai !== null).length} parameter terukur sangat sesuai `
          + '(ambang Peta Sebaran Wilayah Potensial: 75% dari sedikitnya 5 parameter terukur)',
          { tebal: true, warna: GELAP, ukuran: 7 });
        k.tabel(
          ['Parameter', 'Penilaian'],
          sc.parameter.map((p) => [p.label,
            p.nilai === true ? 'Sangat sesuai' : p.nilai === false ? 'Perlu dinilai di lapangan' : 'Tidak terukur']),
          [(LEBAR - 8) * 0.65, (LEBAR - 8) * 0.35]
        );
      }
    }
    if (sc.zona.length) {
      if (sc.informasi_ruang?.length) {
        k.teks('Ketentuan kegiatan pada area analisis', { tebal: true, warna: GELAP, ukuran: 7.5 });
        const sudahTercetak = new Set();
        sc.informasi_ruang.forEach((z) => {
          k.teks(
            `${z.nama} (${z.jenis_label} / ${z.sub_zona_label})`
              + [z.persen != null && ` - ${nf(z.persen, 1)}% area`, z.dasar_zona && `; zona: ${z.dasar_zona}`]
                .filter(Boolean).join(''),
            { tebal: true, warna: GELAP, ukuran: 7 }
          );
          if (Object.values(z.kegiatan).some((d) => d.length)) {
            k.tabelDaftar(
              ['Diperbolehkan', 'Diperbolehkan bersyarat', 'Tidak diperbolehkan'],
              [z.kegiatan.DIIZINKAN, z.kegiatan.BERSYARAT, z.kegiatan.TIDAK_DIIZINKAN],
              [HIJAU_TEKS, AMBER_TEKS, MERAH_TEKS]
            );
          } else {
            k.teks('Ketentuan per jenis investasi belum ditetapkan untuk sub-zona ini.', { ukuran: 6.8 });
          }
          if (z.perda) {
            const p = z.perda;
            const kunciPerda = `${p.sumber}|${p.nama_zona}`;
            k.teks(
              `Rincian kegiatan menurut Perda${p.kode_zona.length ? ` (kode zona ${p.kode_zona.join(', ')})` : ''}`,
              { tebal: true, warna: GELAP, ukuran: 6.8 }
            );
            if (sudahTercetak.has(kunciPerda)) {
              k.teks('Sama dengan rincian zona sebelumnya di atas.', { ukuran: 6.5 });
            } else {
              k.tabelDaftar(
                [
                  `Diperbolehkan (${p.diperbolehkan.length})`,
                  `Bersyarat (${p.bersyarat.length})`,
                  `Tidak diperbolehkan (${p.tidak_diperbolehkan.length})`,
                ],
                [p.diperbolehkan, p.bersyarat, p.tidak_diperbolehkan],
                [HIJAU_TEKS, AMBER_TEKS, MERAH_TEKS]
              );
              if (p.ketentuan_khusus) k.teks(`Ketentuan khusus Perda: ${p.ketentuan_khusus}`, { ukuran: 6.2 });
              k.teks(`Sumber: ${p.sumber}.`, { ukuran: 6.2 });
              sudahTercetak.add(kunciPerda);
            }
          }
          k.teks(
            `Sumber aturan: ${z.sumber_aturan?.join('; ') || 'belum ditetapkan'}. `
              + `KKPRL terbit di zona ini: ${ringkasKkprlZona(z.kkprl_terbit)}.`,
            { ukuran: 6.5 }
          );
          (z.ketentuan_khusus || []).forEach((t) => {
            k.teks(sudahTercetak.has(t) ? 'Ketentuan khusus: sama dengan zona sebelumnya di atas.' : `Ketentuan khusus: ${t}`,
              { ukuran: 6.2 });
            sudahTercetak.add(t);
          });
        });
      }
    }
    if (sc.kkprl.length) {
      k.tabel(
        ['KKPRL tumpang tindih', 'Kegiatan', 'Irisan (m2)'],
        sc.kkprl.map((x) => [x.nomor_izin, x.kegiatan, nf(x.luas_m2)]),
        [(LEBAR - 8) * 0.4, (LEBAR - 8) * 0.4, (LEBAR - 8) * 0.2]
      );
    }
    k.daftar(sc.alasan);
    k.tutupKartu('Ketentuan kegiatan diambil dari matriks KKPRL Perda RTRW Provinsi bila tersedia; selain itu dari ketentuan yang dikelola administrator.');
  }

  const bagianSpasial = spasial?.bagian || [];
  const sudahAda = bagianSpasial.some((b) => b.kunci === 'bencana');
  const bagian = [...bagianSpasial, ...(bencana && !sudahAda ? [bencana] : [])];
  if (bagian.length) {
    k.tema(
      'Profil Lokasi, Tata Ruang, Perizinan & Infrastruktur',
      'Setiap tema dilaporkan dengan ukurannya sendiri: tema berbentuk area sebagai persen dari luas area analisis, tema berbentuk garis dan titik sebagai jarak ke objek terdekat, bahaya bencana sebagai indeks 0-1 dari raster BNPB, serta kondisi oseanografi dan karbon biru sebagai tabel parameter.'
    );

    bagian.forEach((b) => {
      if (peta?.[b.kunci]?.gambar) k.ruang(112);
      k.bukaKartu(b.judul, b.kosong ? '' : b.ringkas);
      k.peta(peta?.[b.kunci]);
      if (b.kosong) {
        k.peringatan(b.catatan_kosong);
      } else if (b.ukuran === 'irisan') {
        k.tabel(
          ['Peruntukan', 'Luas (ha)', '% area'],
          b.baris.map((r) => [r.nama, nf(r.luas_ha, 1), `${nf(r.persen, 2)}%`]),
          [(LEBAR - 8) * 0.54, (LEBAR - 8) * 0.26, (LEBAR - 8) * 0.2]
        );
      } else if (b.ukuran === 'tabel') {
        const lebar = LEBAR - 8;
        k.tabel(b.kolom, b.baris.map((r) => r.sel), b.kolom.map((_, i) => (i ? (lebar * 0.7) / (b.kolom.length - 1) : lebar * 0.3)));
      } else if (b.ukuran === 'indeks') {
        k.tabel(
          ['Bahaya', 'Kelas', 'Indeks rata-rata', 'Tertinggi'],
          b.baris.map((r) => [
            r.nama,
            r.indeks === null ? 'Tidak terpetakan' : r.kategori,
            r.indeks === null ? '—' : nf(r.indeks, 3),
            r.maks === null || r.maks === undefined ? '—' : nf(r.maks, 3),
          ]),
          [(LEBAR - 8) * 0.40, (LEBAR - 8) * 0.24, (LEBAR - 8) * 0.2, (LEBAR - 8) * 0.16]
        );
      } else {
        k.tabel(
          ['Objek terdekat', 'Kategori', 'Jarak (km)'],
          b.baris.map((r) => [r.nama, r.kategori, r.beririsan ? 'di dalam area' : nf(r.jarak_km, 2)]),
          [(LEBAR - 8) * 0.46, (LEBAR - 8) * 0.32, (LEBAR - 8) * 0.22]
        );
      }
      if (b.batimetri) {
        k.teks(`Kedalaman laut (batimetri): rata-rata ${b.batimetri.rata2}, rentang di dalam area ${b.batimetri.rentang} (terdangkal - terdalam). ${b.batimetri.catatan}`);
      }
      k.tutupKartu(
        `Sumber: ${b.sumber}${b.objek_diperiksa ? ` · ${nf(b.objek_diperiksa)} objek diperiksa` : ''}`
      );
    });
    kotakSkor('ruang', 'transportasi');
  }

  const rr = spasial?.risiko_ruang || {};
  const eko = rr.lingkungan;
  const sos = rr.sosial;
  const adat = rr.wilayah_adat || [];
  const adaNilai = (v) => v !== null && v !== undefined;

  if (eko || sos || adat.length) {
    k.tema(
      'Risiko Lingkungan & Sosial',
      PENJELASAN_RISIKO.tema
    );

    if (eko) {
      k.bukaKartu(
        'Risiko Lingkungan',
        `Risiko gabungan ${nf(eko.gabungan, 2)} — `
        + (adaNilai(eko.indeks)
          ? `indeks kesehatan ekosistem ${nf(eko.indeks, 2)} (bobot ${nf((eko.bobot?.ekosistem || 0) * 100)}%)`
          : 'TANPA indeks kesehatan ekosistem, karena belum ada ekosistem terdata yang beririsan')
        + (adaNilai(eko.tekanan_bencana)
          ? ` dan tekanan bencana ${nf(eko.tekanan_bencana, 2)} (bobot ${nf((eko.bobot?.bencana || 0) * 100)}%).`
          : ', dan tanpa tekanan bencana karena area di luar cakupan raster InaRISK.')
        + ` ${PENJELASAN_RISIKO.lingkungan}`
      );
      if (eko.rincian?.length) {
        k.tabel(
          ['Ekosistem', 'Kondisi', 'Objek', 'Luas (ha)'],
          eko.rincian.map((r) => [
            String(r.jenis || '').replace(/_/g, ' '),
            r.kondisi || 'Tidak tercatat',
            nf(r.jumlah),
            nf(r.luas_ha, 1),
          ]),
          [(LEBAR - 8) * 0.34, (LEBAR - 8) * 0.28, (LEBAR - 8) * 0.16, (LEBAR - 8) * 0.22]
        );
      } else if (!adaNilai(eko.indeks)) {
        k.peringatan(
          'Angka di atas berdiri di atas tekanan bencana saja. Jangan dibaca sebagai '
          + 'penilaian ekosistem.'
        );
      }
      k.tutupKartu(
        `Sumber: ${rr.sumber?.lingkungan || '—'} · ekosistem yang SEHAT menaikkan risiko, `
        + 'karena yang dipertaruhkan lebih besar. Terumbu karang dan padang lamun dari Sidako Ekosistem KKP (2025).'
      );
    }

    if (sos) {
      k.bukaKartu(
        'Risiko Sosial',
        `Risiko gabungan ${nf(sos.nilai, 2)} — kemiskinan ${nf(sos.nilai_kemiskinan, 2)} dan `
        + `konflik tenurial ${nf(sos.nilai_tenurial, 2)}, masing-masing berbobot sama. `
        + PENJELASAN_RISIKO.sosial
      );
      k.tabel(
        ['Indikator', 'Nilai'],
        [
          ['Kabupaten/kota penaung', sos.kabupaten_kota || '—'],
          [
            'Penduduk DTKS desil 1-4',
            adaNilai(sos.rasio_dtks)
              ? `${nf(sos.penduduk_dtks)} jiwa (${nf(sos.rasio_dtks * 100, 1)}%)`
              : '—',
          ],
          [
            'Nelayan',
            adaNilai(sos.rasio_nelayan)
              ? `${nf(sos.jumlah_nelayan)} orang (${nf(sos.rasio_nelayan * 100, 1)}%)`
              : '—',
          ],
          ['Wilayah adat beririsan', adat.length ? `${nf(adat.length)} wilayah` : 'Tidak ada tercatat'],
        ],
        [(LEBAR - 8) * 0.46, (LEBAR - 8) * 0.54]
      );
      k.tutupKartu(
        `Sumber: ${rr.sumber?.sosial || '—'}`
        + (sos.tahun_data ? ` · statistik ${sos.tahun_data}` : '')
        + ' · DTKS adalah pendataan kesejahteraan Kemensos, BUKAN angka kemiskinan BPS yang '
        + 'dihitung terhadap garis kemiskinan.'
      );
    }

    if (adat.length) {
      k.bukaKartu(
        'Wilayah Kelola Masyarakat Hukum Adat',
        'Ada pihak yang sudah memegang hak kelola atas perairan ini; statusnya memperberat '
        + 'perizinan dan menuntut kesepakatan dengan pemegang haknya.'
      );
      k.tabel(
        ['Wilayah adat', 'Jenis', 'Provinsi'],
        adat.map((x) => [x.nama || '—', x.jenis || '—', x.provinsi || '—']),
        [(LEBAR - 8) * 0.44, (LEBAR - 8) * 0.34, (LEBAR - 8) * 0.22]
      );
      k.tutupKartu(
        'Sumber: Sidako KKP, Portal Satu Data KKP, dan RTRW Provinsi · cakupan data wilayah adat baru enam provinsi, '
        + 'sehingga ketiadaan irisan berarti BELUM TERCATAT, bukan tidak ada klaim.'
      );
    }
    kotakSkor('risiko');
  }

  if (a.kerja) {
    k.tema(
      'Sosial & Ketenagakerjaan',
      'Perkiraan serapan tenaga kerja dan kebutuhan peningkatan kapasitas pada skala investasi ini.'
    );
    k.bukaKartu(
      'Perkiraan Serapan Tenaga Kerja',
      'Angka serapan berasal dari rencana operasional yang diisi penyusun analisis.'
    );

    if (a.kerja.total != null) {
      k.angkaBesar(itemSerapan(a.kerja.total, a.finansial?.capex));
    } else {
      k.peringatan(
        'Serapan tenaga kerja belum diisi pada analisis ini. Angka itu tidak dapat '
          + 'diturunkan dari nilai investasi, sehingga tidak dicantumkan.'
      );
    }

    if (a.kerja.pelatihan?.length) {
      k.teks(
        `Kebutuhan pelatihan - ${a.kerja.sektorNama || a.kerja.sektor || 'sektor tidak dikenal'}`,
        { tebal: true, warna: GELAP, ukuran: 8 }
      );
      k.teks(
        'Kompetensi yang dibutuhkan kategori investasi ini, beserta lembaga penyelenggara '
          + 'dan skema sertifikasinya.',
        { ukuran: 7 }
      );
      k.tabel(
        ['Kompetensi', 'Lembaga & skema sertifikasi'],
        a.kerja.pelatihan.map((p) => [
          p.keahlian,
          [p.lembaga, p.skema].filter(Boolean).join(' | '),
        ]),
        [(LEBAR - 8) * 0.4, (LEBAR - 8) * 0.6]
      );
    }
    k.tutupKartu();

    const konteksBps = pilihKonteksBps(bps);
    if (bps?.tersedia && konteksBps) {
      k.bukaKartu(
        'Konteks Ketenagakerjaan Wilayah (BPS)',
        'Angka serapan proyek baru bermakna bila dibandingkan dengan pasar kerja setempat.'
      );
      if (konteksBps.kosong) {
        k.peringatan(konteksBps.alasanKosong);
      } else {
        k.teks(
          `${konteksBps.wilayah} - ${konteksBps.tahun}`,
          { tebal: true, warna: GELAP, ukuran: 8 }
        );
        k.tabel(
          ['Indikator', 'Wilayah', 'Nilai', 'Tahun'],
          konteksBps.baris.map((b) => [b.label, b.wilayah, b.teks, b.tahun]),
          [(LEBAR - 8) * 0.4, (LEBAR - 8) * 0.32, (LEBAR - 8) * 0.16, (LEBAR - 8) * 0.12]
        );
        k.teks(konteksBps.catatan, { ukuran: 6.5 });
      }
      k.tutupKartu(`Sumber: ${bps.sumber} · domain ${bps.domain}`);
    }
    kotakSkor('sosial');
  }

  k.tema(
    'Metodologi & Asal Data',
    'Skor yang ditarik dari sumber data di luar aplikasi ini, beserta penyedianya.'
  );
  k.bukaKartu(
    'Asal Skor Penilaian',
    'Hanya skor bersumber luar yang didaftar. Skor yang masih memakai nilai bawaan tidak dicantumkan karena nilai bawaan bukan hasil pengukuran.'
  );

  const asalSkor = Object.entries(a.spasial?.sumber || {});
  const asalLuar = asalSkor.filter(([, v]) => v && v !== 'default');
  const jumlahBawaan = asalSkor.length - asalLuar.length;

  if (asalLuar.length) {
    k.tabel(
      ['Skor', 'Sumber'],
      asalLuar.map(([nama, v]) => [nama.replace(/_/g, ' '), String(v)])
    );
  } else if (asalSkor.length) {
    k.peringatan('Tidak ada skor pada analisis ini yang bersumber dari luar aplikasi.');
  } else {
    k.peringatan('Rincian asal data tidak tersimpan pada analisis ini.');
  }
  k.tutupKartu(
    jumlahBawaan > 0
      ? `${jumlahBawaan} skor lain memakai nilai bawaan dan tidak didaftar di sini.`
      : null
  );

  if (a.finansial) {
    k.tema(
      'Analisis Finansial',
      'Proyeksi arus kas terdiskonto beserta kepekaannya terhadap pergeseran asumsi.'
    );

    const f = a.finansial;
    k.bukaKartu(
      'Proyeksi Arus Kas (DCF)',
      f.wacc != null ? `Discount rate ${nf(f.wacc, 1)}% selama ${f.umur ?? '—'} tahun.` : ''
    );
    k.angkaBesar([
      { nilai: `Rp ${rupiahRingkas(f.npv)}`, satuan: 'Net Present Value' },
      { nilai: `${nf(f.irr, 1)}%`, satuan: 'IRR' },
      { nilai: f.paybackTercapai === false ? 'tidak tercapai' : `${nf(f.payback, 1)}`, satuan: 'Payback (tahun)' },
    ]);
    k.tabel(
      ['Parameter', 'Nilai'],
      [
        ['CapEx (Capital Expenditure)', `Rp ${rupiahRingkas(f.capex)}`],
        ['Pendapatan tahun pertama', `Rp ${rupiahRingkas(f.pendapatan)}`],
        ['OpEx (Operational Expenditure) tahun pertama', `Rp ${rupiahRingkas(f.opex)}`],
        ['Pertumbuhan pendapatan per tahun', f.tumbuhPendapatan != null ? `${nf(f.tumbuhPendapatan, 1)}%` : '—'],
        ['Pertumbuhan OpEx per tahun', f.tumbuhOpex != null ? `${nf(f.tumbuhOpex, 1)}%` : '—'],
        ['ROI', f.roi != null ? `${nf(f.roi, 0)}%` : '—'],
      ]
    );
    k.tutupKartu(
      'Angka finansial berasal dari parameter yang dimasukkan penyusun analisis, bukan dari survei lapangan.'
    );

    const seri = (baris) =>
      [...baris]
        .sort((x, y) => (y.perubahan_pct ?? 0) - (x.perubahan_pct ?? 0))
        .map((r) => {
          const pc = Number(r.perubahan_pct) || 0;
          return [
            pc === 0 ? '0% (dasar)' : `${pc > 0 ? '+' : ''}${nf(pc, pc % 1 ? 1 : 0)}%`,
            `Rp ${rupiahRingkas(r.npv)}`,
            r.irr != null ? `${nf(r.irr, 1)}%` : '—',
            r.payback_tercapai === false ? 'tidak tercapai' : nf(r.payback, 1),
          ];
        });

    const sen = f.sensitivitas || {};
    const kolomSen = ['Perubahan', 'NPV', 'IRR', 'Payback (th)'];
    const lebarSen = [(LEBAR - 8) * 0.26, (LEBAR - 8) * 0.3, (LEBAR - 8) * 0.2, (LEBAR - 8) * 0.24];
    if (sen.pendapatan?.length || sen.biaya?.length) {
      k.bukaKartu(
        'Analisis Sensitivitas',
        'Seberapa jauh hasilnya bergeser bila satu asumsi meleset, sementara asumsi lainnya tetap.'
      );
      if (sen.pendapatan?.length) {
        k.teks('Pendapatan tahunan bergeser', { tebal: true, warna: GELAP, ukuran: 8 });
        k.tabel(kolomSen, seri(sen.pendapatan), lebarSen);
      }
      if (sen.biaya?.length) {
        k.teks('Biaya operasional tahunan bergeser', { tebal: true, warna: GELAP, ukuran: 8 });
        k.tabel(kolomSen, seri(sen.biaya), lebarSen);
      }
      k.tutupKartu(
        'Satu variabel digeser pada satu waktu; CapEx, discount rate, dan umur proyek tetap pada nilai dasarnya.'
      );
    }
    kotakSkor('kelayakan');
  }

  if (a.kelayakan?.skor != null || a.penyaring.length) {
    k.tema(
      'Kelayakan Investasi',
      'Penilaian multi-kriteria atas seluruh aspek di atas: lokasi, risiko, finansial, dan prediksi.'
    );

    if (a.kelayakan?.skor != null) {
      k.bukaKartu(
        'Penilaian Multi-Kriteria (AHP)',
        [a.kelayakan.keputusan && `Keputusan ${a.kelayakan.keputusan.replace(/_/g, ' ')}`,
         a.kelayakan.prioritas && `prioritas ${a.kelayakan.prioritas}`,
         a.kelayakan.kelasRisiko && `kelas risiko ${a.kelayakan.kelasRisiko}`]
          .filter(Boolean).join(', ') + '.'
      );
      const wKeputusan = hexKeRgb(warnaStatus(a.kelayakan.keputusan));
      k.angkaBesar([
        { nilai: nf(a.kelayakan.skor, 2), satuan: 'Skor AHP', warna: wKeputusan },
        { nilai: (a.kelayakan.keputusan || '—').replace(/_/g, ' '), satuan: 'Keputusan', warna: wKeputusan },
        { nilai: a.kelayakan.prioritas || '—', satuan: 'Prioritas', warna: hexKeRgb(warnaStatus(a.kelayakan.prioritas)) },
      ]);
      const aspek = Object.entries(a.kelayakan.perAspek || {});
      if (aspek.length) {
        k.tabel(
          ['Aspek penilaian', 'Dihitung dari', 'Skor', 'Bobot'],
          aspek.map(([nama, v]) => [
            ASPEK_AHP[nama]?.nama || nama.charAt(0).toUpperCase() + nama.slice(1),
            ASPEK_AHP[nama]?.dari || '-',
            `${nf((v.skor || 0) * 100, 1)}%`,
            `${nf((v.bobot || 0) * 100, 1)}%`,
          ]),
          [(LEBAR - 8) * 0.27, (LEBAR - 8) * 0.47, (LEBAR - 8) * 0.13, (LEBAR - 8) * 0.13]
        );
      }
      k.tutupKartu(
        a.kelayakan.rasioKonsistensi != null
          ? `Rasio konsistensi ${nf(a.kelayakan.rasioKonsistensi, 4)} — ${
              a.kelayakan.konsisten ? 'matriks konsisten' : 'matriks TIDAK konsisten, bobot perlu ditinjau'
            }. Mesin AHP · analitik.services.ahp_engine`
          : 'Mesin AHP · analitik.services.ahp_engine'
      );
    }

    if (a.penyaring.length) {
      k.bukaKartu(
        'Hasil Mesin Penyaring',
        'Analisis ini tersimpan dalam format lama, yang mencatat hasil empat mesin penyaring alih-alih rincian bobot AHP.'
      );
      a.penyaring.forEach((f) => {
        k.teks(`${f.filter_name || f.name || 'Penyaring'} — ${f.status || (f.passed ? 'LULUS' : 'TIDAK LULUS')}`, {
          tebal: true,
          warna: GELAP,
          ukuran: 8,
        });
        if (typeof f.detail === 'string') {
          k.teks(f.detail, { ukuran: 7 });
        } else if (f.detail && typeof f.detail === 'object') {
          k.tabel(
            ['Indikator', 'Nilai'],
            Object.entries(f.detail).map(([nama, v]) => [
              nama.replace(/_/g, ' '),
              typeof v === 'number' ? nf(v, v % 1 ? 2 : 0) : String(v),
            ])
          );
        }
      });
      k.tutupKartu('Tersimpan pada analisis lama; tidak dihitung ulang.');
    }
  }

  if (a.kelayakan?.mitigasi?.length) {
    k.tema(
      'Temuan & Strategi Mitigasi',
      'Rangkuman hal yang perlu ditindaklanjuti sebelum investasi dijalankan.'
    );
    k.bukaKartu('Daftar Tindak Lanjut');
    k.daftar(a.kelayakan.mitigasi);
    k.tutupKartu('Temuan gabungan mesin spasial dan AHP.');
  }

  return k.selesaikan();
}

export async function unduhPdfLaporan(opsi) {
  const [, peta] = await Promise.all([
    siapkanAsetPdf(),
    siapkanPetaLaporan(opsi.analisis?.geometry),
  ]);
  const doc = buatPdfLaporan({ ...opsi, peta });
  const nama = (opsi.namaProyek || 'laporan-analisis')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  doc.save(`${nama}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default unduhPdfLaporan;
