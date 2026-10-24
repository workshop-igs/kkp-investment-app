import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import {
  Anchor, BarChart3, Briefcase, Compass, Fish, HandCoins, Landmark, Layers, Lightbulb, ListChecks, MapPin, ScanSearch, TrendingUp, Users,
  Wallet, Waves,
} from 'lucide-react';
import { api } from '../api/klien';
import { bersih, logoPdf, pasangFontPdf, siapkanAsetPdf } from './pdfLaporan';
import { formatRupiah, rupiahRingkas } from './pemformat';
import { ATRIBUSI_CITRA, gambarGeometri, gambarSkala, gambarUtara, muatCitra } from './petaLaporan';
import { KATEGORI_ZONA, warnaJenisInvestasi, warnaKelasKelayakan, warnaZona } from './simbologiPeta';

export const W = 297;
export const H = 167.0625;
export const TEPI = 14;
export const ATAS = 31;
export const BAWAH = H - 15;
const MM_PER_PT = 0.3528;
const SUDUT = 2.6;

export const C = {
  navy: [0, 34, 66],
  biru: [0, 86, 165],
  hijau: [140, 198, 63],
  toska: [64, 191, 219],
  pita: [27, 106, 138],
  teks: [51, 65, 85],
  abu: [100, 116, 139],
  abuMuda: [148, 163, 184],
  garis: [226, 232, 240],
  bayang: [222, 229, 238],
  latar: [244, 247, 251],
  selang: [248, 250, 252],
  jalur: [233, 238, 245],
  putih: [255, 255, 255],
  kuning: [254, 243, 199],
  coklat: [146, 64, 14],
  tinggi: [22, 163, 74],
  sedang: [202, 138, 4],
};

const PETA = { lebar: 1600, tinggi: 1180 };
const SAMPUL = { bagian: 0.58 };
const PETA_LOKASI = { lebar: 1000, tinggi: 482 };

const IKON = {
  zona: Layers, hukum: Landmark, komoditas: Fish, kajian: BarChart3, lokasi: MapPin, pasar: TrendingUp,
  finansial: Wallet, sosial: Users, keahlian: Briefcase, kesimpulan: Lightbulb, isi: ListChecks, cari: ScanSearch,
  laut: Waves, biru: Anchor, metode: Compass, csr: HandCoins,
};
let IKON_PNG = {};

const angka = (v, d = 0) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v))
    ? '-'
    : Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

const namaRapi = (t, maks = 60) => {
  const s = String(t || '-');
  const rapi = s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(/-])\p{L}/gu, (h) => h.toUpperCase()) : s;
  return rapi.length > maks ? `${rapi.slice(0, maks - 1)}…` : rapi;
};

const rupiah = (juta) => (juta == null ? '-' : rupiahRingkas(juta * 1e6));

const tanggalPanjang = (iso) =>
  new Date(iso || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export const rgb = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

const campur = (warna, kadar) => warna.map((c) => Math.round(255 - (255 - c) * kadar));

const gelap = (warna, kadar = 0.72) => warna.map((c) => Math.round(c * kadar));

const LABEL_KELAS = { TINGGI: 'Tinggi', SEDANG: 'Sedang', RENDAH: 'Rendah' };

const aksenBab = (b) => warnaJenisInvestasi(b.sektor);

function ikonPng(Ikon) {
  const wadah = document.createElement('div');
  const akar = createRoot(wadah);
  flushSync(() => akar.render(createElement(Ikon, { size: 96, color: '#ffffff', strokeWidth: 2.2 })));
  const svg = wadah.innerHTML;
  akar.unmount();
  return new Promise((selesai) => {
    const g = new Image();
    g.onload = () => {
      const k = document.createElement('canvas');
      k.width = 96;
      k.height = 96;
      k.getContext('2d').drawImage(g, 0, 0, 96, 96);
      selesai(k.toDataURL('image/png'));
    };
    g.onerror = () => selesai(null);
    g.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function siapkanIkon() {
  if (Object.keys(IKON_PNG).length) return;
  IKON_PNG = Object.fromEntries(await Promise.all(Object.entries(IKON).map(async ([n, I]) => [n, await ikonPng(I)])));
}

function luasPeta(cakupan, lebar, tinggi) {
  const [a0, b0, a1, b1] = cakupan;
  let lebarDer = (a1 - a0) * 1.08;
  let tinggiDer = (b1 - b0) * 1.08;
  if (lebarDer / tinggiDer > lebar / tinggi) tinggiDer = (lebarDer * tinggi) / lebar;
  else lebarDer = (tinggiDer * lebar) / tinggi;
  const x0 = (a0 + a1) / 2 - lebarDer / 2;
  const y0 = (b0 + b1) / 2 - tinggiDer / 2;
  return [x0, y0, x0 + lebarDer, y0 + tinggiDer];
}

function sudutBulat(ctx, lebar, tinggi, radius, warna = '#ffffff') {
  ctx.beginPath();
  ctx.rect(0, 0, lebar, tinggi);
  ctx.roundRect(0, 0, lebar, tinggi, radius);
  ctx.fillStyle = warna;
  ctx.fill('evenodd');
}

function kanvasPeta({ cakupan, batas, citra, lapisan = [], titik = [], lebar = PETA.lebar, tinggi = PETA.tinggi, bingkai = true }) {
  if (!cakupan || typeof document === 'undefined') return null;
  const [x0, y0, x1, y1] = luasPeta(cakupan, lebar, tinggi);
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  if (citra) ctx.drawImage(citra, 0, 0, lebar, tinggi);
  else {
    ctx.fillStyle = '#e6f1f8';
    ctx.fillRect(0, 0, lebar, tinggi);
  }
  const proyeksi = ([lon, lat]) => [((lon - x0) / (x1 - x0)) * lebar, ((y1 - lat) / (y1 - y0)) * tinggi];

  if (!citra) {
    [].concat(batas || []).forEach((b) => {
      gambarGeometri(ctx, b, proyeksi, { garis: '#64748b', isi: 'rgba(250, 247, 240, 0.95)', tebal: 1.6 });
    });
  }
  lapisan.forEach(({ fitur, warna, isi = 0.55, tebal = 1.2 }) => {
    fitur.forEach((f) => {
      const w = typeof warna === 'function' ? warna(f) : warna;
      gambarGeometri(ctx, f.geometry, proyeksi, { garis: rgba(w, 0.95), isi: isi ? rgba(w, isi) : null, tebal });
    });
  });
  if (citra) {
    [].concat(batas || []).forEach((b) => {
      gambarGeometri(ctx, b, proyeksi, { garis: 'rgba(255, 255, 255, 0.55)', isi: null, tebal: 6 });
      gambarGeometri(ctx, b, proyeksi, { garis: '#facc15', isi: null, tebal: 2.4 });
    });
  }
  titik.forEach(({ titik: t, warna, label }) => {
    const [x, y] = proyeksi(t);
    ctx.beginPath();
    ctx.arc(x, y, label ? 27 : 9, 0, Math.PI * 2);
    ctx.fillStyle = warna;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    if (label) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px "Public Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(label), x, y + 1);
    }
  });

  if (bingkai) {
    gambarSkala(ctx, (x1 - x0) / lebar, (y0 + y1) / 2, lebar, tinggi);
    gambarUtara(ctx, lebar);
    sudutBulat(ctx, lebar, tinggi, 26);
  }
  return kanvas;
}

const petaKanvas = (opsi) => kanvasPeta(opsi)?.toDataURL('image/jpeg', 0.88) || null;

function grafikKanvas(seri, kunci, warna, { label = 'tahun', desimal = 0, lebar = 1200, tinggi = 600 } = {}) {
  const data = seri.filter((s) => s[kunci] !== null && s[kunci] !== undefined);
  if (!data.length || typeof document === 'undefined') return null;
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lebar, tinggi);
  const kiri = 30;
  const kanan = lebar - 30;
  const atas = 70;
  const bawah = tinggi - 64;
  const maks = Math.max(...data.map((s) => Number(s[kunci]))) * 1.08 || 1;
  ctx.strokeStyle = '#e8edf3';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  for (let i = 1; i <= 3; i += 1) {
    const y = bawah - ((bawah - atas) * i) / 3;
    ctx.beginPath();
    ctx.moveTo(kiri, y);
    ctx.lineTo(kanan, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(kiri, bawah);
  ctx.lineTo(kanan, bawah);
  ctx.stroke();
  const langkah = (kanan - kiri) / data.length;
  const w = Math.min(120, langkah * 0.56);
  ctx.textAlign = 'center';
  data.forEach((s, i) => {
    const x = kiri + langkah * (i + 0.5);
    const y = bawah - ((bawah - atas) * Number(s[kunci])) / maks;
    const gradien = ctx.createLinearGradient(0, y, 0, bawah);
    gradien.addColorStop(0, warna);
    gradien.addColorStop(1, rgba(warna, 0.55));
    ctx.fillStyle = gradien;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y, w, Math.max(2, bawah - y), [14, 14, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#002242';
    ctx.font = '700 28px "Public Sans", sans-serif';
    ctx.fillText(angka(s[kunci], desimal), x, y - 18);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 24px "Public Sans", sans-serif';
    ctx.fillText(String(s[label]).slice(0, 18), x, bawah + 38);
  });
  return kanvas.toDataURL('image/png');
}

export class Dek {
  constructor(kaki) {
    this.doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'landscape', compress: true });
    this.font = pasangFontPdf(this.doc);
    this.logo = logoPdf();
    this.kaki = kaki;
    this.n = 0;
  }

  gaya(ukuran, warna = C.teks, tebal = false) {
    this.doc.setFont(this.font, tebal ? 'bold' : 'normal');
    this.doc.setFontSize(ukuran);
    this.doc.setTextColor(...warna);
  }

  pita(y, tinggi) {
    [[C.hijau, 0, 0.204], [C.toska, 0.204, 0.376], [C.pita, 0.58, 0.42]].forEach(([warna, mulai, bagian]) => {
      this.doc.setFillColor(...warna);
      this.doc.rect(W * mulai, y, W * bagian + 0.2, tinggi, 'F');
    });
  }

  halaman() {
    if (this.n) this.doc.addPage([W, H], 'landscape');
    this.n += 1;
  }

  transparan(kadar, gambar) {
    const d = this.doc;
    d.saveGraphicsState();
    d.setGState(new d.GState({ opacity: kadar }));
    gambar();
    d.restoreGraphicsState();
  }

  slide({ alis, judul, sub, aksen = '#0056A5', subBaris = 1 }) {
    this.halaman();
    const d = this.doc;
    const a = rgb(aksen);
    d.setFillColor(...C.latar);
    d.rect(0, 0, W, H, 'F');
    this.pita(0, 1.6);

    const teksAlis = bersih(alis).toUpperCase();
    this.gaya(6.2, gelap(a), true);
    const lebarAlis = d.getTextWidth(teksAlis) + teksAlis.length * 0.25 + 6;
    d.setFillColor(...campur(a, 0.14));
    d.roundedRect(TEPI, 6.4, lebarAlis, 5, 2.5, 2.5, 'F');
    d.text(teksAlis, TEPI + 3, 9.9, { charSpace: 0.25 });

    const teks = bersih(judul).toUpperCase();
    let ukuran = 17;
    this.gaya(ukuran, C.navy, true);
    while (ukuran > 11 && d.getTextWidth(teks) > W - TEPI * 2 - 40) {
      ukuran -= 0.5;
      d.setFontSize(ukuran);
    }
    d.text(d.splitTextToSize(teks, W - TEPI * 2 - 40).slice(0, 1), TEPI, 19.6);
    if (this.logo) d.addImage(this.logo.data, 'PNG', W - TEPI - 8.5, 7.5, 8.5, (this.logo.h / this.logo.w) * 8.5);
    if (sub) {
      this.gaya(8, C.abu);
      d.text(d.splitTextToSize(bersih(sub), W - TEPI * 2 - 12).slice(0, subBaris), TEPI, 25.4);
    }

    this.gaya(6.2, C.abu);
    d.text(bersih(`${this.kaki}  |  Kementerian Kelautan dan Perikanan`), TEPI, H - 5.2);
    this.gaya(6.4, C.putih, true);
    const nomor = String(this.n);
    const lebarNomor = d.getTextWidth(nomor) + 5;
    d.setFillColor(...C.navy);
    d.roundedRect(W - TEPI - lebarNomor, H - 8.6, lebarNomor, 4.8, 2.4, 2.4, 'F');
    d.text(nomor, W - TEPI - lebarNomor / 2, H - 5.3, { align: 'center' });
    this.pita(H - 1.4, 1.4);
    return ATAS + (subBaris - 1) * 3.6;
  }

  teks(x, y, lebar, isi, { ukuran = 8, warna = C.teks, tebal = false, jarak = 1.4, maks } = {}) {
    this.gaya(ukuran, warna, tebal);
    let baris = this.doc.splitTextToSize(bersih(isi), lebar);
    if (maks) baris = baris.slice(0, maks);
    this.doc.text(baris, x, y, { lineHeightFactor: jarak });
    return y + baris.length * ukuran * MM_PER_PT * jarak;
  }

  lencana(cx, cy, r, ikon, aksen, cincin = false) {
    const d = this.doc;
    if (cincin) {
      d.setFillColor(...C.putih);
      d.circle(cx, cy, r + 0.9, 'F');
    }
    d.setFillColor(...rgb(aksen));
    d.circle(cx, cy, r, 'F');
    if (IKON_PNG[ikon]) d.addImage(IKON_PNG[ikon], 'PNG', cx - r * 0.56, cy - r * 0.56, r * 1.12, r * 1.12);
  }

  kartu(x, y, w, h, { judul, ikon, aksen = '#0056A5' } = {}) {
    const d = this.doc;
    d.setFillColor(...C.bayang);
    d.roundedRect(x, y + 0.7, w, h, SUDUT, SUDUT, 'F');
    d.setFillColor(...C.putih);
    d.setDrawColor(...C.garis);
    d.setLineWidth(0.2);
    d.roundedRect(x, y, w, h, SUDUT, SUDUT, 'FD');
    if (!judul) return y + 5;
    this.lencana(x + 6.6, y + 6.8, 3.2, ikon, aksen);
    this.gaya(8.6, C.navy, true);
    d.text(bersih(judul), x + 12, y + 7.9);
    return y + 14.5;
  }

  angkaKartu(x, y, w, h, nilai, label, aksen = '#0056A5') {
    const d = this.doc;
    d.setFillColor(...C.bayang);
    d.roundedRect(x, y + 0.7, w, h, SUDUT, SUDUT, 'F');
    d.setFillColor(...rgb(aksen));
    d.roundedRect(x, y, w, h, SUDUT, SUDUT, 'F');
    d.setFillColor(...C.putih);
    d.rect(x, y + 1.4, w, h - 1.4 - SUDUT, 'F');
    d.roundedRect(x, y + h - SUDUT * 2, w, SUDUT * 2, SUDUT, SUDUT, 'F');
    this.gaya(14, C.navy, true);
    d.text(bersih(nilai), x + 4, y + h / 2 + 1);
    this.gaya(6.3, C.abu);
    d.text(d.splitTextToSize(bersih(label), w - 7).slice(0, 2), x + 4, y + h / 2 + 5.2);
  }

  pitaAngka(x, y, w, h, item, warna = C.navy) {
    const d = this.doc;
    const isi = item.filter(Boolean);
    d.setFillColor(...warna);
    d.roundedRect(x, y, w, h, 3.4, 3.4, 'F');
    const lebar = w / isi.length;
    isi.forEach(([nilai, label], i) => {
      const cx = x + i * lebar + 7;
      if (i) {
        d.setDrawColor(...campur(warna, 0.62));
        d.setLineWidth(0.25);
        d.line(x + i * lebar, y + 5, x + i * lebar, y + h - 5);
      }
      this.gaya(16, C.putih, true);
      d.text(bersih(nilai), cx, y + h / 2 + 0.6);
      this.gaya(6.6, [214, 228, 242]);
      d.text(d.splitTextToSize(bersih(label), lebar - 12).slice(0, 2), cx, y + h / 2 + 5.4);
    });
  }

  centang(x, y, lebar, daftar, { aksen = '#0056A5', ukuran = 7.8, batas = BAWAH - 2 } = {}) {
    const d = this.doc;
    const a = rgb(aksen);
    daftar.filter(Boolean).forEach((t) => {
      if (y > batas) return;
      const cy = y - ukuran * MM_PER_PT * 0.33;
      d.setFillColor(...campur(a, 0.16));
      d.circle(x + 1.9, cy, 1.9, 'F');
      d.setDrawColor(...gelap(a, 0.85));
      d.setLineWidth(0.38);
      d.line(x + 1.05, cy, x + 1.7, cy + 0.65);
      d.line(x + 1.7, cy + 0.65, x + 2.85, cy - 0.7);
      y = this.teks(x + 5.4, y, lebar - 5.4, t, { ukuran }) + 1.8;
    });
    return y;
  }

  nomor(x, y, lebar, daftar, { aksen = '#0056A5', ukuran = 7.8 } = {}) {
    const d = this.doc;
    daftar.filter(Boolean).forEach((t, i) => {
      const cy = y - ukuran * MM_PER_PT * 0.33;
      d.setFillColor(...rgb(aksen));
      d.circle(x + 2, cy, 2, 'F');
      this.gaya(5.8, C.putih, true);
      d.text(String(i + 1), x + 2, cy + 0.75, { align: 'center' });
      y = this.teks(x + 5.8, y, lebar - 5.8, t, { ukuran }) + 2;
    });
    return y;
  }

  pil(x, y, teks, latar, warna, ukuran = 5.8) {
    const d = this.doc;
    this.gaya(ukuran, warna, true);
    const t = bersih(teks);
    const w = d.getTextWidth(t) + 3.6;
    d.setFillColor(...latar);
    d.roundedRect(x, y - 3, w, 4.2, 2.1, 2.1, 'F');
    d.text(t, x + 1.8, y);
    return w;
  }

  deretPil(x, y, lebar, daftar, latar, warna) {
    let cx = x;
    daftar.forEach((t) => {
      this.gaya(5.8, warna, true);
      const w = this.doc.getTextWidth(bersih(t)) + 3.6;
      if (cx + w > x + lebar) {
        cx = x;
        y += 5.6;
      }
      cx += this.pil(cx, y, t, latar, warna) + 1.6;
    });
    return y + 5;
  }

  tanda(x, y, lebar, isi) {
    const d = this.doc;
    const baris = d.splitTextToSize(bersih(isi), lebar - 9);
    const tinggi = baris.length * 3.3 + 4.4;
    d.setFillColor(...C.kuning);
    d.roundedRect(x, y, lebar, tinggi, 2, 2, 'F');
    d.setFillColor(217, 119, 6);
    d.roundedRect(x, y, 1.6, tinggi, 0.8, 0.8, 'F');
    this.teks(x + 5, y + 4.8, lebar - 9, isi, { ukuran: 7, warna: C.coklat });
    return y + tinggi + 3;
  }

  gambar(data, x, y, w, h) {
    if (data) this.doc.addImage(data, data.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', x, y, w, h, undefined, 'FAST');
    else {
      this.doc.setFillColor(...C.latar);
      this.doc.roundedRect(x, y, w, h, 2, 2, 'F');
    }
  }

  legenda(x, y, lebar, item) {
    let cx = x;
    this.gaya(6.4, C.teks);
    item.forEach(({ label, warna }) => {
      const t = bersih(label);
      const w = this.doc.getTextWidth(t) + 6.5;
      if (cx + w > x + lebar) {
        cx = x;
        y += 4.4;
      }
      this.doc.setFillColor(...rgb(warna));
      this.doc.roundedRect(cx, y - 2.5, 3, 3, 0.8, 0.8, 'F');
      this.doc.text(t, cx + 4.2, y);
      cx += w + 2.5;
    });
    return y + 4.5;
  }

  batang(x, y, lebar, daftar, aksen) {
    const d = this.doc;
    const maks = Math.max(1, ...daftar.map((b) => b.nilai));
    daftar.forEach((b) => {
      this.gaya(6.8, b.sorot ? gelap(rgb(aksen)) : C.teks, !!b.sorot);
      d.text(bersih(b.label), x, y);
      this.gaya(6.6, b.sorot ? gelap(rgb(aksen)) : C.abu, !!b.sorot);
      d.text(bersih(b.teks), x + lebar, y, { align: 'right' });
      d.setFillColor(...C.jalur);
      d.roundedRect(x, y + 1.6, lebar, 2.2, 1.1, 1.1, 'F');
      d.setFillColor(...(b.sorot ? rgb(aksen) : campur(rgb(aksen), 0.45)));
      d.roundedRect(x, y + 1.6, Math.max(2.2, (lebar * b.nilai) / maks), 2.2, 1.1, 1.1, 'F');
      y += 8.6;
    });
    return y;
  }

  tabel(x, y, lebar, kolom, baris, { bagian, ukuran = 6.8, rataKanan = [], batas = BAWAH - 2, sorot = [], aksen = '#0056A5' } = {}) {
    const d = this.doc;
    const lebarKolom = (bagian || kolom.map(() => 1 / kolom.length)).map((b) => b * lebar);
    const tb = ukuran * MM_PER_PT * 1.3;
    const sel = (teks, i) => d.splitTextToSize(bersih(teks ?? '-'), lebarKolom[i] - 3);
    const tulisBaris = (isi, yy) => {
      let cx = x;
      isi.forEach((b, i) => {
        d.text(b, rataKanan.includes(i) ? cx + lebarKolom[i] - 1.8 : cx + 1.8, yy, { align: rataKanan.includes(i) ? 'right' : 'left' });
        cx += lebarKolom[i];
      });
    };

    this.gaya(ukuran - 0.4, C.putih, true);
    const kepala = kolom.map(sel);
    const tinggiKepala = Math.max(...kepala.map((b) => b.length)) * tb + 3.4;
    d.setFillColor(...C.navy);
    d.roundedRect(x, y, lebar, tinggiKepala, 1.8, 1.8, 'F');
    d.rect(x, y + tinggiKepala - 1.8, lebar, 1.8, 'F');
    tulisBaris(kepala, y + 2.2 + tb * 0.72);
    y += tinggiKepala;

    let tercetak = 0;
    for (const [r, isi] of baris.entries()) {
      const disorot = sorot.includes(r);
      this.gaya(ukuran, disorot ? gelap(rgb(aksen), 0.8) : C.teks, disorot);
      const isiSel = isi.map(sel);
      const tinggi = Math.max(...isiSel.map((b) => b.length)) * tb + 2.6;
      if (y + tinggi > batas - (r < baris.length - 1 ? 4 : 0)) break;
      if (disorot || r % 2) {
        d.setFillColor(...(disorot ? campur(rgb(aksen), 0.12) : C.selang));
        d.rect(x, y, lebar, tinggi, 'F');
      }
      tulisBaris(isiSel, y + 1.7 + tb * 0.72);
      d.setDrawColor(...C.garis);
      d.setLineWidth(0.15);
      d.line(x, y + tinggi, x + lebar, y + tinggi);
      y += tinggi;
      tercetak += 1;
    }
    if (tercetak < baris.length) {
      this.gaya(6, C.abu);
      d.text(`+ ${baris.length - tercetak} baris lainnya tidak dimuat pada halaman ini.`, x, y + 3.5);
      y += 4;
    }
    return y + 2;
  }

  sumber(t) {
    this.gaya(5.9, C.abuMuda);
    this.doc.text(this.doc.splitTextToSize(bersih(t), W - TEPI * 2).slice(0, 1), TEPI, H - 10.4);
  }
}

const SUMBER_BPS = (k) => `BPS, Produksi & Nilai Produksi ${k ? (k.kelompok === 'BUDIDAYA' ? 'Perikanan Budidaya' : 'Perikanan Tangkap di Laut') : 'Perikanan Budidaya dan Tangkap di Laut'} Menurut Komoditas Utama (data KKP)`;

const regulasiTeks = (z) => (z.regulasi
  ? `${z.regulasi.judul} tentang ${z.regulasi.tentang}`
  : `${z.label_data || z.sumber_label || 'Rencana tata ruang laut'} (${z.sumber_label || 'KKP'}); nomor peraturan daerah belum terverifikasi pada JDIH Badan Pemeriksa Keuangan`);

const perdaSingkat = (z) => (z.regulasi ? z.regulasi.judul.replace(/^Peraturan Daerah Provinsi .+? (Nomor)/, 'Perda $1') : '-');

const pertumbuhanTeks = (k) => {
  if (k.pertumbuhan_persen == null) return null;
  const arah = k.pertumbuhan_persen >= 0 ? 'tumbuh' : 'turun';
  return `Produksi ${arah} rata-rata ${angka(Math.abs(k.pertumbuhan_persen), 1)}% per tahun (${k.tahun_awal}–${k.tahun}).`;
};

const hargaTeks = (k) => {
  if (!k.harga_rp_kg) return null;
  const banding = k.harga_nasional_rp_kg
    ? `, ${k.harga_rp_kg >= k.harga_nasional_rp_kg ? 'di atas' : 'di bawah'} rata-rata nasional Rp ${angka(k.harga_nasional_rp_kg)}/kg`
    : '';
  return `Harga di tingkat produsen Rp ${angka(k.harga_rp_kg)}/kg${banding}.`;
};

const kelasS = (kelas) => ({ TINGGI: 'S1', SEDANG: 'S2' }[kelas] || null);
const WARNA_S = { S1: C.tinggi, S2: C.sedang };
const LABEL_S = { S1: 'Sangat sesuai (S1)', S2: 'Sesuai (S2)' };
const REKOMENDASI_S = {
  S1: 'Dapat direkomendasikan untuk dikembangkan dengan skala industri.',
  S2: 'Belum direkomendasikan untuk skala industri: ada faktor pembatas alami yang memerlukan biaya rekayasa lingkungan tinggi.',
};
const unik = (daftar) => [...new Map(daftar.map((x) => [x.id, x])).values()];
const lokasiSemua = (o) => unik(o.bab.flatMap((b) => b.lokasi));
const finansialUtama = (b) => b.finansial.find((f) => f.hasil) || null;
const komoditasBab = (o, b) => (b.komoditas ? o.komoditas.find((x) => x.kode === b.kode) : null);
const tangkap = (b) => b.sektor === 'PERIKANAN_TANGKAP';
const rpPenuh = (v) => (v == null ? '-' : formatRupiah(v));
const rp = (v) => (v == null ? '-' : `Rp ${rupiahRingkas(v)}`);
const tahunProduksi = (o) => o.komoditas.find((k) => k.unggulan)?.tahun;

const sebutZona = (daftar) => {
  const rapi = daftar.map((z) => namaRapi(z, 40).replace(/^Sub Zona /i, 'Sub-Zona '));
  if (rapi.length <= 2) return rapi.join(' & ');
  return `${rapi.slice(0, 2).join(', ')}, dan ${rapi.length - 2} sub-zona lain`;
};
const rincianTeks = (r) => `${namaRapi(r.kegiatan, 70)} (pada ${sebutZona(r.sub_zona)})`;

function donutKanvas(item, ukuran = 640) {
  const isi = item.filter((i) => i.nilai > 0);
  if (!isi.length || typeof document === 'undefined') return null;
  const k = document.createElement('canvas');
  k.width = ukuran;
  k.height = ukuran;
  const ctx = k.getContext('2d');
  const total = isi.reduce((n, i) => n + i.nilai, 0);
  const cx = ukuran / 2;
  const r = ukuran * 0.46;
  let sudut = -Math.PI / 2;
  isi.forEach((i) => {
    const besar = (i.nilai / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.arc(cx, cx, r, sudut, sudut + besar);
    ctx.closePath();
    ctx.fillStyle = i.warna;
    ctx.fill();
    if (besar > 0.32) {
      const tengah = sudut + besar / 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 44px "Public Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round((i.nilai / total) * 100)}%`, cx + Math.cos(tengah) * r * 0.78, cx + Math.sin(tengah) * r * 0.78);
    }
    sudut += besar;
  });
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  sudut = -Math.PI / 2;
  isi.forEach((i) => {
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(sudut) * r, cx + Math.sin(sudut) * r);
    ctx.stroke();
    sudut += (i.nilai / total) * Math.PI * 2;
  });
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cx, r * 0.56, 0, Math.PI * 2);
  ctx.fill();
  return k.toDataURL('image/png');
}

function garisKanvas(label, seri, { lebar = 1500, tinggi = 620, format = (v) => angka(v) } = {}) {
  const semua = seri.flatMap((s) => s.nilai);
  if (!semua.length || typeof document === 'undefined') return null;
  const k = document.createElement('canvas');
  k.width = lebar;
  k.height = tinggi;
  const ctx = k.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lebar, tinggi);
  const kiri = 150;
  const kanan = lebar - 40;
  const atas = 30;
  const bawah = tinggi - 70;
  let min = Math.min(0, ...semua);
  let maks = Math.max(0, ...semua);
  if (maks === min) maks = min + 1;
  const ruang = (maks - min) * 0.08;
  min -= min < 0 ? ruang : 0;
  maks += ruang;
  const y = (v) => bawah - ((v - min) / (maks - min)) * (bawah - atas);
  const x = (i) => kiri + (label.length > 1 ? (i / (label.length - 1)) * (kanan - kiri) : (kanan - kiri) / 2);
  ctx.font = '500 26px "Public Sans", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i += 1) {
    const v = min + ((maks - min) * i) / 4;
    ctx.strokeStyle = '#e8edf3';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(kiri, y(v));
    ctx.lineTo(kanan, y(v));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b';
    ctx.fillText(format(v), kiri - 16, y(v));
  }
  if (min < 0) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(kiri, y(0));
    ctx.lineTo(kanan, y(0));
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  label.forEach((l, i) => {
    ctx.fillStyle = '#64748b';
    ctx.fillText(String(l), x(i), tinggi - 24);
  });
  seri.forEach((s) => {
    ctx.strokeStyle = s.warna;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.nilai.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.stroke();
    s.nilai.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(v), 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.stroke();
    });
  });
  return k.toDataURL('image/png');
}

const skalaRupiah = (nilai) => {
  const maks = Math.max(1, ...nilai.map((v) => Math.abs(v)));
  if (maks >= 1e12) return [1e12, 'triliun', 2];
  if (maks >= 1e9) return [1e9, 'miliar', 1];
  return [1e6, 'juta', 0];
};

function sampulKanvas(o, citra) {
  const s = 5;
  const k = document.createElement('canvas');
  k.width = Math.round(W * s);
  k.height = Math.round(H * s);
  const ctx = k.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, k.width, k.height);
  g.addColorStop(0, '#001a33');
  g.addColorStop(0.6, '#00376b');
  g.addColorStop(1, '#0b4f7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, k.width, k.height);
  const lebarPeta = Math.round(k.width * SAMPUL.bagian);
  const peta = o.wilayah.cakupan && kanvasPeta({
    cakupan: o.wilayah.cakupan, batas: o.wilayah.batas, citra, lebar: lebarPeta, tinggi: k.height, bingkai: false,
  });
  if (peta) ctx.drawImage(peta, k.width - lebarPeta, 0);
  const tutup = ctx.createLinearGradient(k.width - lebarPeta, 0, k.width - lebarPeta * 0.4, 0);
  tutup.addColorStop(0, 'rgba(0,26,51,1)');
  tutup.addColorStop(1, 'rgba(0,26,51,0)');
  ctx.fillStyle = tutup;
  ctx.fillRect(k.width - lebarPeta - 2, 0, lebarPeta * 0.6, k.height);
  const bawah = ctx.createLinearGradient(0, k.height * 0.6, 0, k.height);
  bawah.addColorStop(0, 'rgba(0,26,51,0)');
  bawah.addColorStop(1, 'rgba(0,26,51,0.88)');
  ctx.fillStyle = bawah;
  ctx.fillRect(0, k.height * 0.6, k.width, k.height * 0.4);
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = `rgba(64,191,219,${0.22 - i * 0.03})`;
    ctx.beginPath();
    for (let x = 0; x <= k.width * 0.55; x += 16) {
      const y = k.height * (0.9 + i * 0.018) + Math.sin(x / 110 + i * 0.8) * 9;
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  return k.toDataURL('image/jpeg', 0.9);
}

class DekProfil extends Dek {
  slide({ alis, judul, sub, aksen = '#0056A5', subBaris = 1, bab = false }) {
    this.halaman();
    const d = this.doc;
    const a = rgb(aksen);
    d.setFillColor(...C.latar);
    d.rect(0, 0, W, H, 'F');
    this.pita(0, 1.6);
    if (bab) {
      d.setFillColor(...a);
      d.rect(0, 1.6, 2.4, H - 3, 'F');
    }
    const teksAlis = bersih(alis).toUpperCase();
    this.gaya(6, gelap(a), true);
    const lebarAlis = d.getTextWidth(teksAlis) + teksAlis.length * 0.22 + 6;
    d.setFillColor(...campur(a, 0.14));
    d.roundedRect(TEPI, 6.2, lebarAlis, 5, 2.5, 2.5, 'F');
    d.text(teksAlis, TEPI + 3, 9.7, { charSpace: 0.22 });

    const teks = bersih(judul);
    let ukuran = 17;
    this.gaya(ukuran, C.navy, true);
    while (ukuran > 12 && d.getTextWidth(teks) > W - TEPI * 2 - 30) {
      ukuran -= 0.5;
      d.setFontSize(ukuran);
    }
    d.text(d.splitTextToSize(teks, W - TEPI * 2 - 30).slice(0, 1), TEPI, 19.4);
    if (this.logo) d.addImage(this.logo.data, 'PNG', W - TEPI - 8.5, 7.5, 8.5, (this.logo.h / this.logo.w) * 8.5);
    if (sub) {
      this.gaya(7.8, C.abu);
      d.text(d.splitTextToSize(bersih(sub), W - TEPI * 2 - 12).slice(0, subBaris), TEPI, 25.2);
    }
    this.gaya(6.2, C.abu);
    d.text(bersih(`${this.kaki}  |  Kementerian Kelautan dan Perikanan`), TEPI, H - 5.2);
    this.gaya(6.4, C.putih, true);
    const nomor = String(this.n);
    const lebarNomor = d.getTextWidth(nomor) + 5;
    d.setFillColor(...C.navy);
    d.roundedRect(W - TEPI - lebarNomor, H - 8.6, lebarNomor, 4.8, 2.4, 2.4, 'F');
    d.text(nomor, W - TEPI - lebarNomor / 2, H - 5.3, { align: 'center' });
    this.pita(H - 1.4, 1.4);
    return ATAS + (subBaris - 1) * 3.6;
  }

  kosong(x, y, w, h, { ikon, aksen, judul, isi }) {
    const d = this.doc;
    this.kartu(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2 - 12;
    d.setFillColor(...campur(rgb(aksen), 0.14));
    d.circle(cx, cy, 9, 'F');
    this.lencana(cx, cy, 6, ikon, aksen);
    this.gaya(11, C.navy, true);
    d.text(bersih(judul), cx, cy + 17, { align: 'center' });
    this.gaya(7.4, C.abu);
    d.text(d.splitTextToSize(bersih(isi), Math.min(w - 30, 190)), cx, cy + 23, { align: 'center', lineHeightFactor: 1.45 });
  }

  pilKelas(x, y, kode, kanan = true) {
    if (!kode) return 0;
    this.gaya(5.6, gelap(WARNA_S[kode], 0.78), true);
    const lebar = this.doc.getTextWidth(kode) + 3.6;
    return this.pil(kanan ? x - lebar : x, y, kode, campur(WARNA_S[kode], 0.16), gelap(WARNA_S[kode], 0.78), 5.6);
  }
}

const KEBIJAKAN_NASIONAL = [
  ['Perpres No. 12 Tahun 2025', 'RPJMN 2025–2029', 'Ekonomi biru menjadi salah satu arah pembangunan nasional.'],
  ['UU No. 6 Tahun 2023', 'Cipta Kerja', 'Dasar penyederhanaan perizinan berusaha.'],
  ['PP No. 28 Tahun 2025', 'Perizinan Berusaha Berbasis Risiko', 'Perizinan melalui sistem OSS sesuai tingkat risiko usaha.'],
  ['PP No. 21 Tahun 2021', 'Penyelenggaraan Penataan Ruang', 'Dasar Kesesuaian Kegiatan Pemanfaatan Ruang Laut (KKPRL).'],
  ['Permen KP No. 28 Tahun 2021', 'Penyelenggaraan Penataan Ruang Laut', 'Tata cara persetujuan KKPRL dan rencana zonasi.'],
  ['PP No. 85 Tahun 2021', 'Jenis dan Tarif PNBP KKP', 'Tarif penerimaan negara bukan pajak sektor kelautan dan perikanan.'],
  ['Permen KP No. 10 Tahun 2021', 'Standar Kegiatan Usaha PBBR', 'Standar usaha dan produk sektor kelautan dan perikanan.'],
  ['Permen KP No. 35 Tahun 2021', 'Tarif Nol Rupiah/Nol Persen PNBP KKP', 'Keringanan PNBP untuk kegiatan tertentu.'],
];

function rencanaHalaman(o, perJenis) {
  const komoditas = komoditasDokumen(o);
  let n = 4 + (komoditas.length ? 1 : 0) + (perJenis ? 1 : 0);
  const bab = o.bab.map((b) => {
    const mulai = n + 1;
    n += 6 + (perJenis && b.lokasi.length ? 1 : 0);
    return mulai;
  });
  return { komoditas: komoditas.length ? 5 : null, bab, penutup: n + 1 };
}

function komoditasDokumen(o) {
  const jenis = o.jenis_dipilih;
  return jenis ? o.komoditas.filter((k) => k.sektor === jenis.kode) : o.komoditas;
}

function sampul(dek, o, citra) {
  dek.halaman();
  const d = dek.doc;
  dek.gambar(sampulKanvas(o, citra), 0, 0, W, H);

  d.setFillColor(...C.putih);
  d.roundedRect(TEPI, 13, 11, 11, 2.4, 2.4, 'F');
  if (dek.logo) d.addImage(dek.logo.data, 'PNG', TEPI + 1.3, 14.3, 8.4, (dek.logo.h / dek.logo.w) * 8.4);
  dek.gaya(8, C.putih, true);
  d.text('KEMENTERIAN KELAUTAN DAN PERIKANAN', TEPI + 14, 17.6);
  dek.gaya(6.6, [190, 212, 235]);
  d.text('Platform Manajemen Investasi Ruang Laut', TEPI + 14, 21.6);

  dek.transparan(0.16, () => {
    d.setFillColor(...C.putih);
    d.roundedRect(TEPI, 40, 58, 6, 3, 3, 'F');
  });
  dek.gaya(6.6, C.putih, true);
  d.text('PROFIL INVESTASI RUANG LAUT', TEPI + 3.4, 44, { charSpace: 0.3 });
  dek.gaya(30, C.putih, true);
  const judul = d.splitTextToSize(bersih(`Provinsi ${o.wilayah.nama}`), 135);
  d.text(judul, TEPI, 60, { lineHeightFactor: 1.05 });
  let y = 60 + judul.length * 11;
  dek.gaya(12.5, o.jenis_dipilih ? C.hijau : [150, 220, 240], true);
  d.text(bersih(o.jenis_dipilih ? o.jenis_dipilih.nama : 'Seluruh jenis investasi'), TEPI, y - 1.5);
  y += 5;
  dek.teks(TEPI, y, 125, 'Disusun otomatis dari data aplikasi: produksi perikanan BPS, pola ruang laut dan matriks KKPRL Perda RTRW, '
    + 'Peta Sebaran Wilayah Potensial Investasi, oseanografi NOAA, risiko bencana BNPB InaRISK, dan statistik ketenagakerjaan BPS.',
  { ukuran: 7.8, warna: [205, 222, 240] });

  const kartu = [
    [angka(o.bab.length), o.jenis_dipilih ? 'komoditas dan jenis dikaji' : 'komoditas dan jenis unggulan'],
    [angka(lokasiSemua(o).length), 'lokasi prioritas'],
    [perdaSingkat(o.zona), 'acuan tata ruang laut'],
  ];
  kartu.forEach(([nilai, label], i) => {
    const x = TEPI + i * 44;
    dek.transparan(0.14, () => {
      d.setFillColor(...C.putih);
      d.roundedRect(x, H - 43, 41, 23, 3, 3, 'F');
    });
    d.setFillColor(...[C.hijau, C.toska, C.putih][i]);
    d.roundedRect(x, H - 43, 41, 1.4, 0.7, 0.7, 'F');
    dek.gaya(i === 2 ? 8.6 : 17, C.putih, true);
    d.text(d.splitTextToSize(bersih(nilai), 35).slice(0, 2), x + 4, H - 33);
    dek.gaya(6.3, [190, 212, 235]);
    d.text(bersih(label), x + 4, H - 24);
  });
  dek.gaya(6.8, [190, 212, 235]);
  d.text(`Diterbitkan ${tanggalPanjang(o.disusun)}`, TEPI, H - 9);
  dek.pita(H - 2, 2);
}

function ringkasan(dek, o, rencana) {
  const jenis = o.jenis_dipilih;
  const y = dek.slide({
    alis: 'Ringkasan',
    judul: `Gambaran umum investasi ${jenis ? `${jenis.nama.toLowerCase()} ` : ''}Provinsi ${o.wilayah.nama}`,
    sub: 'Potensi ekonomi biru, kerangka investasi berkelanjutan, dan ringkasan setiap bab.',
  });
  const tpt = o.sosial.ketenagakerjaan?.indikator?.tpt;
  const lokasi = lokasiSemua(o);
  dek.pitaAngka(TEPI, y, W - TEPI * 2, 21, [
    [angka(o.wilayah.luas_laut_km2), 'km² luas wilayah laut'],
    [`${o.wilayah.jumlah_kabkota_pesisir}/${o.wilayah.jumlah_kabkota}`, 'kabupaten/kota pesisir'],
    [angka(o.zona.total_ha), jenis ? `ha zona yang mengizinkan ${jenis.nama.toLowerCase()}` : 'ha zona pola ruang laut'],
    [angka(lokasi.length), 'lokasi prioritas'],
    tpt?.nilai != null && [`${angka(tpt.nilai, 2)}%`, `pengangguran terbuka (${tpt.tahun})`],
  ]);

  const yk = y + 25;
  const kiri = 176;
  const inf = o.infrastruktur || {};
  const eko = o.ekosistem || {};
  const unggulan = komoditasDokumen(o).filter((k) => (jenis ? true : k.unggulan));
  const nilaiUnggulan = unggulan.reduce((n, k) => n + (k.nilai_juta_rp || 0), 0);
  let yy = dek.kartu(TEPI, yk, kiri, 40, { judul: 'Potensi ekonomi biru', ikon: 'biru', aksen: '#1B6A8A' });
  const lebarUbin = (kiri - 10 - 8) / 3;
  [
    ['Koridor maritim', angka((inf.PELABUHAN_UMUM || 0) + (inf.PELABUHAN_PENYEBERANGAN || 0) + (inf.TERMINAL_KHUSUS || 0)),
      'pelabuhan umum, penyeberangan, dan terminal khusus', o.alki ? 'Dilalui Alur Laut Kepulauan Indonesia' : null],
    ['Hilirisasi dan rantai dingin', angka(inf.PELABUHAN_PERIKANAN || 0), 'pelabuhan perikanan sebagai simpul rantai dingin',
      inf.KAWASAN_INDUSTRI ? `${angka(inf.KAWASAN_INDUSTRI)} kawasan industri` : null],
    ['Sumber daya laut', nilaiUnggulan ? rp(nilaiUnggulan * 1e6) : '-', `nilai produksi komoditas unggulan${tahunProduksi(o) ? ` ${tahunProduksi(o)}` : ''}`,
      eko.MANGROVE || eko.TERUMBU_KARANG ? `Mangrove ${angka(eko.MANGROVE || 0)} ha | karang ${angka(eko.TERUMBU_KARANG || 0)} ha` : null],
  ].forEach(([judul, nilai, label, catatan], i) => {
    const x = TEPI + 5 + i * (lebarUbin + 4);
    dek.doc.setFillColor(...C.selang);
    dek.doc.roundedRect(x, yy - 3.4, lebarUbin, 24, 2, 2, 'F');
    dek.gaya(6.4, C.abu, true);
    dek.doc.text(bersih(judul.toUpperCase()), x + 3, yy + 0.6, { charSpace: 0.15 });
    dek.gaya(13, C.navy, true);
    dek.doc.text(bersih(nilai), x + 3, yy + 7.6);
    dek.teks(x + 3, yy + 11.2, lebarUbin - 6, label, { ukuran: 5.9, warna: C.abu, maks: 2 });
    if (catatan) dek.teks(x + 3, yy + 18.4, lebarUbin - 6, catatan, { ukuran: 5.9, warna: gelap(C.toska, 0.7), tebal: true, maks: 1 });
  });

  const yb = yk + 44;
  yy = dek.kartu(TEPI, yb, kiri, BAWAH - yb, { judul: 'Ringkasan per bab', ikon: 'kesimpulan' });
  const kolom = o.bab.length > 3 ? 2 : 1;
  const lebarKolom = (kiri - 10 - (kolom - 1) * 5) / kolom;
  const perKolom = Math.ceil(o.bab.length / kolom);
  const yAwal = yy;
  o.bab.forEach((b, n) => {
    if (n % perKolom === 0) yy = yAwal;
    const xk = TEPI + 5 + Math.floor(n / perKolom) * (lebarKolom + 5);
    const j = o.jenis[b.sektor];
    const k = komoditasBab(o, b);
    const f = finansialUtama(b);
    const isi = [
      k && `${angka(k.produksi_ton)} ton (${k.tahun}), peringkat ${k.peringkat_nasional} nasional`,
      `${b.lokasi.length} lokasi prioritas`,
      `${angka(j.tinggi_ha)} ha zona S1`,
      f && `NPV ${rp(f.hasil.skenario.find((s) => s.kode === f.hasil.dasar).npv)}`,
    ].filter(Boolean).join('; ');
    dek.doc.setFillColor(...rgb(aksenBab(b)));
    dek.doc.roundedRect(xk, yy - 2.8, 1.3, 6.4, 0.65, 0.65, 'F');
    dek.gaya(7, C.navy, true);
    dek.doc.text(bersih(namaRapi(b.nama, 44)), xk + 3.6, yy);
    yy = dek.teks(xk + 3.6, yy + 3.4, lebarKolom - 4, isi, { ukuran: 6.1, warna: C.abu, maks: 2 }) + 1.6;
  });

  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  const tinggiPilar = 47;
  yy = dek.kartu(x, yk, lebar, tinggiPilar, { judul: 'Tiga pilar kelayakan', ikon: 'metode', aksen: '#0E7490' });
  const model = o.bab.filter((b) => finansialUtama(b));
  const layak = model.filter((b) => {
    const h = finansialUtama(b).hasil;
    return h.skenario.find((s) => s.kode === h.dasar).layak;
  });
  const berS1 = o.bab.filter((b) => o.jenis[b.sektor].tinggi_ha > 0).length;
  [
    ['Kelayakan ekonomi', model.length ? `${layak.length} dari ${model.length} model usaha layak finansial` : 'Model usaha belum ditetapkan administrator',
      nilaiUnggulan ? `Nilai produksi unggulan ${rp(nilaiUnggulan * 1e6)}` : null, C.biru],
    ['Daya dukung lingkungan', `Zona kelas tinggi (S1) tersedia untuk ${berS1} dari ${o.bab.length} komoditas atau jenis`, `${lokasi.length} lokasi prioritas lolos Perda dan kriteria fisik`, C.tinggi],
    ['Daya dukung sosial', tpt?.nilai != null ? `Pengangguran terbuka ${angka(tpt.nilai, 2)}% (${tpt.tahun})` : 'Data ketenagakerjaan belum tersedia',
      `${angka(o.wilayah.nelayan)} nelayan di ${o.wilayah.jumlah_kabkota_pesisir} kabupaten/kota pesisir`, C.toska],
  ].forEach(([judul, baris1, baris2, warna]) => {
    dek.doc.setFillColor(...warna);
    dek.doc.circle(x + 6.4, yy - 1, 1.3, 'F');
    dek.gaya(7, C.navy, true);
    dek.doc.text(judul, x + 9.4, yy);
    yy = dek.teks(x + 9.4, yy + 3.3, lebar - 14, [baris1, baris2].filter(Boolean).join('. '), { ukuran: 6, warna: C.teks, maks: 2 }) + 1.6;
  });

  yy = dek.kartu(x, yk + tinggiPilar + 4, lebar, BAWAH - yk - tinggiPilar - 4, { judul: 'Isi dokumen', ikon: 'isi' });
  const pembuka = [
    ['Tata ruang laut', 3, '#0056A5'],
    ['Kebijakan', 4, '#0056A5'],
    rencana.komoditas && ['Komoditas', rencana.komoditas, '#0056A5'],
    ['Penutup', rencana.penutup, '#1B6A8A'],
  ].filter(Boolean);
  const lebarIsi = (lebar - 13) / 2;
  const tinggiBaris = Math.min(4.2, (BAWAH - yy - 1) / Math.max(pembuka.length, o.bab.length));
  [pembuka, o.bab.map((b, i) => [`${i + 1}. ${b.nama}`, rencana.bab[i], aksenBab(b)])].forEach((daftar, c) => {
    const xc = x + 5 + c * (lebarIsi + 3);
    daftar.forEach(([nama, hal, warna], n) => {
      const yb = yy + n * tinggiBaris;
      dek.doc.setFillColor(...rgb(warna));
      dek.doc.circle(xc + 1, yb - 1, 0.9, 'F');
      dek.gaya(6, C.teks);
      dek.doc.text(bersih(namaRapi(nama, c ? 24 : 20)), xc + 3.2, yb);
      dek.gaya(5.8, C.abu);
      dek.doc.text(String(hal), xc + lebarIsi, yb, { align: 'right' });
    });
  });
  dek.sumber('Sumber: infrastruktur Satu Data KKP dan OpenStreetMap; ekosistem Sidako KKP dan Global Mangrove Watch; produksi BPS; ketenagakerjaan BPS; rincian di halaman berikutnya.');
}

const OSEANOGRAFI_PDF = [
  ['SUHU', 'suhu permukaan laut', 1],
  ['ANOMALI_SUHU', 'anomali suhu permukaan', 2],
  ['KLOROFIL', 'klorofil-a', 2],
  ['GELOMBANG', 'tinggi gelombang signifikan', 2],
];
const WARNA_LAUT = [14, 116, 144];

function kartuOseanografi(dek, os, x, y, lebar, tinggi) {
  const yy = dek.kartu(x, y, lebar, tinggi, { judul: 'Kondisi oseanografi perairan', ikon: 'laut', aksen: '#0E7490' });
  const ada = OSEANOGRAFI_PDF.filter(([k]) => os?.[k]);
  if (!ada.length) {
    dek.teks(x + 5, yy - 1, lebar - 10, 'Data oseanografi untuk perairan provinsi ini belum tersedia.', { ukuran: 6.6, maks: 2 });
    return;
  }
  const kolom = (lebar - 10) / 2;
  ada.forEach(([k, label, d], i) => {
    const v = os[k];
    const xx = x + 5 + (i % 2) * kolom;
    const y0 = yy - 1 + Math.floor(i / 2) * 7.6;
    dek.gaya(8.6, C.navy, true);
    dek.doc.text(bersih(`${k === 'ANOMALI_SUHU' && v.rata2 > 0 ? '+' : ''}${angka(v.rata2, d)} ${v.satuan}`), xx, y0);
    dek.gaya(5.8, C.abu);
    dek.doc.text(label, xx, y0 + 2.9);
  });
}

function zonaRuang(dek, o, citra) {
  const z = o.zona;
  const jenis = o.jenis_dipilih;
  const y = dek.slide({
    alis: 'Tata ruang laut',
    judul: jenis ? `Zona yang mengizinkan ${jenis.nama.toLowerCase()}` : 'Zona pemanfaatan ruang laut',
    sub: regulasiTeks(z),
    subBaris: 2,
  });
  const lebarPeta = 150;
  const tinggiPeta = lebarPeta * (PETA.tinggi / PETA.lebar);
  dek.kartu(TEPI, y, lebarPeta + 6, tinggiPeta + 6);
  dek.gambar(petaKanvas({
    cakupan: o.wilayah.cakupan,
    batas: o.wilayah.batas,
    citra,
    lapisan: [{ fitur: z.peta, warna: (f) => warnaZona(f.sub_zona), isi: 0.5 }],
  }), TEPI + 3, y + 3, lebarPeta, tinggiPeta);

  const x = TEPI + lebarPeta + 12;
  const lebar = W - TEPI - x;
  let yy = dek.kartu(x, y, lebar, 34, { judul: 'Dasar hukum', ikon: 'hukum', aksen: '#1B6A8A' });
  if (z.regulasi) {
    yy = dek.teks(x + 5, yy, lebar - 10, z.regulasi.judul, { ukuran: 7.4, tebal: true, warna: C.navy, maks: 2 });
    yy = dek.teks(x + 5, yy, lebar - 10, `tentang ${z.regulasi.tentang}`, { ukuran: 7, maks: 2 });
    dek.gaya(6.4, C.biru);
    dek.doc.textWithLink('peraturan.bpk.go.id', x + 5, Math.min(yy + 0.6, y + 31.5), { url: z.regulasi.tautan });
  } else {
    dek.teks(x + 5, yy, lebar - 10, regulasiTeks(z), { ukuran: 7, maks: 4 });
  }

  const yt = y + 38;
  const tinggiLaut = 27;
  const tinggiLuas = tinggiPeta + 6 - 38 - tinggiLaut - 4;
  kartuOseanografi(dek, o.oseanografi, x, yt + tinggiLuas + 4, lebar, tinggiLaut);
  yy = dek.kartu(x, yt, lebar, tinggiLuas, { judul: 'Luas per zona', ikon: 'zona' });
  if (!z.baris.length) {
    dek.tanda(x + 5, yy, lebar - 10, jenis
      ? `Belum ada zona pola ruang laut yang mengizinkan ${jenis.nama.toLowerCase()} di provinsi ini.`
      : 'Data pola ruang laut provinsi ini belum tersedia.');
    return;
  }
  const maks = Math.max(...z.baris.map((b) => b.persen));
  z.baris.slice(0, 4).forEach((b) => {
    const warna = warnaZona(b.sub_zona);
    dek.doc.setFillColor(...rgb(warna));
    dek.doc.roundedRect(x + 5, yy - 2.6, 3, 3, 0.8, 0.8, 'F');
    dek.gaya(6.8, C.teks);
    dek.doc.text(bersih(namaRapi(KATEGORI_ZONA[b.sub_zona]?.label || b.label, 34)), x + 9.6, yy);
    dek.gaya(6.6, C.navy, true);
    dek.doc.text(`${angka(b.persen, 1)}%`, x + lebar - 5, yy, { align: 'right' });
    dek.gaya(6, C.abu);
    dek.doc.text(`${angka(b.luas_ha)} ha`, x + lebar - 15, yy, { align: 'right' });
    dek.doc.setFillColor(...C.jalur);
    dek.doc.roundedRect(x + 9.6, yy + 1.3, lebar - 14.6, 1.5, 0.75, 0.75, 'F');
    dek.doc.setFillColor(...rgb(warna));
    dek.doc.roundedRect(x + 9.6, yy + 1.3, Math.max(1.5, ((lebar - 14.6) * b.persen) / maks), 1.5, 0.75, 0.75, 'F');
    yy += 8.4;
  });
  dek.gaya(6.2, C.abu);
  dek.doc.text(`Total ${angka(z.total_ha)} ha | ${z.peta.length} zona terluas di peta`, x + 5, yt + tinggiLuas - 3.4);
  dek.sumber(`Sumber: pola ruang laut ${z.sumber_label}; dasar hukum: JDIH BPK (peraturan.bpk.go.id); oseanografi perairan ±22 km dari pantai: NOAA Coral Reef Watch (juga ditayangkan Sidako KKP), MODIS-Aqua, WaveWatch III via NOAA ERDDAP; ${ATRIBUSI_CITRA}.`);
}

function kebijakan(dek, o) {
  const y = dek.slide({
    alis: 'Kebijakan dan regulasi',
    judul: 'Kebijakan pendukung investasi pusat dan daerah',
    sub: 'Peraturan yang menjadi dasar perizinan, penataan ruang laut, dan penerimaan negara untuk investasi ruang laut.',
  });
  const daftar = [
    ...KEBIJAKAN_NASIONAL.map(([nomor, judul, peran]) => ({ nomor, judul, peran, daerah: false })),
    {
      nomor: perdaSingkat(o.zona) === '-' ? (o.zona.label_data || 'Perda RTRW Provinsi') : perdaSingkat(o.zona),
      judul: o.zona.regulasi ? o.zona.regulasi.tentang : `Rencana tata ruang wilayah Provinsi ${o.wilayah.nama}`,
      peran: 'Acuan zona dan matriks KKPRL yang menjadi gerbang pertama analisis aplikasi.',
      daerah: true,
    },
  ];
  const kolom = 3;
  const lebar = (W - TEPI * 2 - (kolom - 1) * 4) / kolom;
  const tinggi = (BAWAH - y - 2 * 4) / 3;
  daftar.forEach((k, i) => {
    const x = TEPI + (i % kolom) * (lebar + 4);
    const yk = y + Math.floor(i / kolom) * (tinggi + 4);
    const aksen = k.daerah ? '#8CC63F' : '#0056A5';
    dek.kartu(x, yk, lebar, tinggi);
    dek.doc.setFillColor(...rgb(aksen));
    dek.doc.roundedRect(x, yk, 1.6, tinggi, 0.8, 0.8, 'F');
    dek.gaya(5.6, gelap(rgb(aksen), 0.8), true);
    dek.doc.text(k.daerah ? 'REGULASI PROVINSI' : `REGULASI NASIONAL ${i + 1}`, x + 5, yk + 5.6, { charSpace: 0.2 });
    dek.gaya(8.4, C.navy, true);
    dek.doc.text(dek.doc.splitTextToSize(bersih(k.nomor), lebar - 10).slice(0, 1), x + 5, yk + 10.6);
    let yy = dek.teks(x + 5, yk + 14.6, lebar - 10, k.judul, { ukuran: 6.8, tebal: true, warna: C.teks, maks: 2 });
    yy = dek.teks(x + 5, yy + 0.6, lebar - 10, k.peran, { ukuran: 6.2, warna: C.abu, maks: 2 });
  });
  dek.sumber('Sumber: daftar kebijakan nasional mengacu laporan profil investasi perikanan NTB (KKP dan WCS, 2026); peraturan daerah dari basis data aplikasi (JDIH BPK).');
}

function komoditasUnggulan(dek, o) {
  const jenis = o.jenis_dipilih;
  const semua = komoditasDokumen(o);
  const y = dek.slide({
    alis: 'Komoditas',
    judul: jenis ? `Komoditas ${jenis.nama.toLowerCase()} ${o.wilayah.nama}` : `Komoditas unggulan ${o.wilayah.nama}`,
    sub: 'Hasil kelautan dan perikanan provinsi menurut produksi, nilai, dan ketersediaan ruang yang sesuai.',
  });
  const sorot = jenis ? semua.slice(0, 4) : semua.filter((k) => k.unggulan);
  const lebarKartu = (W - TEPI * 2 - 3 * 4) / 4;
  sorot.forEach((k, i) => {
    const x = TEPI + i * (lebarKartu + 4);
    const aksen = warnaJenisInvestasi(k.sektor);
    const a = rgb(aksen);
    dek.angkaKartu(x, y, lebarKartu, 48, '', '', aksen);
    dek.pil(x + 4, y + 7.6, k.ranah_label.toUpperCase(), a, C.putih, 5.4);
    dek.gaya(10, C.navy, true);
    dek.doc.text(bersih(k.nama), x + 4, y + 15.5);
    dek.gaya(16, C.navy, true);
    dek.doc.text(angka(k.produksi_ton), x + 4, y + 26);
    dek.gaya(6.2, C.abu);
    dek.doc.text(`ton produksi ${k.tahun}`, x + 4, y + 30);
    dek.gaya(6.6, C.teks, true);
    dek.doc.text(bersih(`Rp ${rupiah(k.nilai_juta_rp)}  |  #${k.peringkat_nasional} nasional`), x + 4, y + 36);
    dek.doc.setFillColor(...C.jalur);
    dek.doc.roundedRect(x + 4, y + 39.6, lebarKartu - 8, 2, 1, 1, 'F');
    dek.doc.setFillColor(...a);
    dek.doc.roundedRect(x + 4, y + 39.6, Math.max(2, (lebarKartu - 8) * k.skor_unggulan), 2, 1, 1, 'F');
    dek.gaya(5.6, C.abu);
    dek.doc.text(`skor unggulan ${angka(k.skor_unggulan, 2)}`, x + 4, y + 45);
  });

  const yb = y + 53;
  const kiri = 172;
  let yy = dek.kartu(TEPI, yb, kiri, BAWAH - yb, { judul: jenis ? `Komoditas ${jenis.nama.toLowerCase()}` : 'Seluruh komoditas laut dan pesisir', ikon: 'komoditas' });
  dek.tabel(TEPI + 4, yy - 1, kiri - 8, ['Komoditas', 'Ranah', 'Tahun', 'Produksi (ton)', 'Nilai (Rp)', 'Pangsa', 'Peringkat'],
    semua.slice(0, 10).map((k) => [k.nama, k.ranah_label, k.tahun, angka(k.produksi_ton), rupiah(k.nilai_juta_rp),
      `${angka(k.pangsa_nasional_persen, 1)}%`, `${k.peringkat_nasional}/${k.jumlah_provinsi}`]),
    { bagian: [0.2, 0.17, 0.09, 0.16, 0.14, 0.11, 0.13], rataKanan: [2, 3, 4, 5, 6], ukuran: 6.5, batas: BAWAH - 3,
      sorot: jenis ? [] : semua.slice(0, 10).map((k, i) => (k.unggulan ? i : -1)).filter((i) => i >= 0) });
  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  if (jenis) {
    yy = dek.kartu(x, yb, lebar, BAWAH - yb, { judul: 'Sub-jenis yang dikaji', ikon: 'zona', aksen: warnaJenisInvestasi(jenis.kode) });
    const sub = [...new Map(o.bab.flatMap((b) => b.sub_jenis.map((s) => [s.kode, s]))).values()];
    sub.forEach((s) => {
      const n = unik(o.bab.flatMap((b) => b.lokasi)).filter((l) => l.sub_sektor_kode === s.kode).length;
      dek.gaya(6.9, C.navy, true);
      dek.doc.text(bersih(namaRapi(s.nama, 40)), x + 5, yy);
      dek.gaya(6.2, C.abu);
      dek.doc.text(`${n} lokasi`, x + lebar - 5, yy, { align: 'right' });
      yy += 6;
    });
  } else {
    yy = dek.kartu(x, yb, lebar, BAWAH - yb, { judul: 'Jenis investasi lain', ikon: 'zona', aksen: '#1B6A8A' });
    const dipakai = new Set(o.bab.map((b) => b.kode));
    dek.batang(x + 5, yy, lebar - 10, o.jenis_lain.slice(0, 5).map((j) => ({
      label: namaRapi(j.nama, 30), nilai: j.tinggi_ha, teks: `${angka(j.tinggi_ha)} ha`, sorot: dipakai.has(j.kode),
    })), '#1B6A8A');
  }
  dek.sumber(`Sumber: ${SUMBER_BPS()}. Unggulan (disorot) = 50% nilai produksi + 50% luas zona sesuai. Udang dipisah menjadi udang laut (tangkap) dan udang vaname (budidaya tambak).`);
}

function metode(dek, o) {
  const a = o.asumsi_finansial;
  const jenis = o.jenis_dipilih;
  const aksen = warnaJenisInvestasi(jenis.kode);
  const y = dek.slide({
    alis: 'Metode',
    judul: `Metode analisis kelayakan ${jenis.nama.toLowerCase()}`,
    sub: 'Kriteria kelayakan finansial dan alur penilaian kesesuaian ruang yang dipakai seluruh bab.',
  });
  const kiri = 140;
  let yy = dek.kartu(TEPI, y, kiri, BAWAH - y, { judul: 'Kriteria kelayakan finansial', ikon: 'finansial', aksen });
  [
    ['NPV lebih dari 0', 'Nilai bersih sekarang seluruh arus kas, didiskonto dengan tingkat diskonto.'],
    [`IRR lebih dari ${angka(a.diskonto_persen, 1)}%`, 'Tingkat pengembalian internal melampaui tingkat diskonto (MARR).'],
    ['BCR lebih dari 1', 'Nilai sekarang manfaat dibanding nilai sekarang seluruh biaya.'],
    [`Masa kembali paling lama ${angka(a.batas_pbp_tahun)} tahun`, 'Waktu yang diperlukan arus kas bersih menutup investasi awal.'],
  ].forEach(([judul, isi]) => {
    dek.doc.setFillColor(...campur(rgb(aksen), 0.14));
    dek.doc.roundedRect(TEPI + 5, yy - 3.6, kiri - 10, 10, 2, 2, 'F');
    dek.gaya(7.4, C.navy, true);
    dek.doc.text(judul, TEPI + 8, yy);
    dek.teks(TEPI + 8, yy + 3.6, kiri - 16, isi, { ukuran: 6.2, warna: C.abu, maks: 1 });
    yy += 12;
  });
  yy += 2;
  const tahap = [['Inception', 'Tahun 1-2'], ['Growth', 'Tahun 3-5'], ['Maturity', `Tahun 6-${angka(a.umur_tahun)}`]];
  const lebarTahap = (kiri - 10 - 8) / 3;
  tahap.forEach(([nama, rentang], i) => {
    const x = TEPI + 5 + i * (lebarTahap + 4);
    dek.doc.setFillColor(...gelap(rgb(aksen), 0.6 + i * 0.15));
    dek.doc.roundedRect(x, yy, lebarTahap, 11, 2, 2, 'F');
    dek.gaya(7.2, C.putih, true);
    dek.doc.text(nama, x + lebarTahap / 2, yy + 5, { align: 'center' });
    dek.gaya(5.8, [214, 228, 242]);
    dek.doc.text(rentang, x + lebarTahap / 2, yy + 8.6, { align: 'center' });
  });
  yy += 17;
  dek.gaya(6.6, C.navy, true);
  dek.doc.text('Asumsi yang berlaku', TEPI + 5, yy);
  dek.teks(TEPI + 5, yy + 3.8, kiri - 10, `Horizon proyeksi ${angka(a.umur_tahun)} tahun; tingkat diskonto ${angka(a.diskonto_persen, 1)}%; kenaikan harga ${angka(a.kenaikan_harga_persen, 1)}% dan biaya ${angka(a.kenaikan_biaya_persen, 1)}% per tahun; potensi CSR ${angka(a.csr_persen, 1)}% dari pendapatan bersih tahun sebelumnya. Model usaha per sub-jenis ditetapkan administrator di Pengaturan Analisis.`, { ukuran: 6.3, maks: 4 });

  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  yy = dek.kartu(x, y, lebar, BAWAH - y, { judul: 'Alur penilaian kesesuaian ruang', ikon: 'metode', aksen });
  dek.nomor(x + 5, yy, lebar - 10, [
    'Gerbang Perda: zona RTRW Provinsi dan matriks KKPRL menentukan rincian kegiatan diperbolehkan, bersyarat, atau tidak.',
    'Pengecualian: KKPRL terbit, wilayah masyarakat hukum adat, alur pelayaran dan ALKI, jarak aman kabel dan pipa, ekosistem sensitif, serta bangunan eksisting.',
    'Kecocokan fisik per sub-jenis: setiap layer dibandingkan dengan batas layak dan batas unggulan sub-jenis.',
    'Kelas kesesuaian: zona berkelas tinggi menjadi sangat sesuai (S1), berkelas sedang menjadi sesuai (S2); lokasi prioritas diambil dari Peta Sebaran.',
    'Kelayakan finansial: model usaha sub-jenis dihitung untuk kondisi riil, S1, dan S2, lengkap dengan proyeksi dan sensitivitas.',
  ], { aksen, ukuran: 7.2 });
  dek.sumber('Sumber: kriteria kelayakan usaha mengacu laporan profil investasi perikanan NTB (KKP dan WCS, 2026); alur kesesuaian ruang adalah mesin analisis aplikasi.');
}

const alisBab = (i, b, n, nama) => `Bab ${i + 1}  |  ${namaRapi(b.nama, 40)}  |  ${i + 1}.${n} ${nama}`;

function ketentuanRinci(dek, j, x, y, lebar, maksBaris = 2) {
  let yy = y;
  const r = j.rincian_matriks;
  if (!r) return yy;
  dek.gaya(7, C.navy, true);
  dek.doc.text('Rincian kegiatan menurut matriks Perda', x, yy);
  yy = dek.teks(x, yy + 3.4, lebar, `${r.sumber}: diizinkan penuh di ${angka(r.blok.DIIZINKAN || 0)} blok zona, bersyarat di ${angka(r.blok.BERSYARAT || 0)}, dilarang di ${angka(r.blok.TIDAK_DIIZINKAN || 0)}.`, { ukuran: 6.2, warna: C.abu, maks: 2 });
  [['Diperbolehkan penuh', r.DIIZINKAN, C.tinggi], ['Diperbolehkan bersyarat', r.BERSYARAT, C.sedang], ['Tidak diperbolehkan', r.TIDAK_DIIZINKAN, [185, 28, 28]]]
    .filter(([, daftar]) => daftar?.length)
    .forEach(([label, daftar, warna]) => {
      yy = dek.teks(x, yy + 0.8, lebar, `${label}: ${daftar.slice(0, 2).map(rincianTeks).join('; ')}`, { ukuran: 6, warna: gelap(warna, 0.78), maks: maksBaris });
    });
  return yy + 1.5;
}

function kajian(dek, o, b, i) {
  const j = o.jenis[b.sektor];
  const k = komoditasBab(o, b);
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 1, k ? 'Kajian produksi dan pasar' : 'Kajian ruang'),
    judul: k ? `Kajian produksi dan pasar ${b.nama.toLowerCase()}` : `Kajian ruang ${b.nama.toLowerCase()}`,
    sub: k ? `${k.ranah_label} di Provinsi ${o.wilayah.nama}; sub-jenis ${b.sub_jenis.map((s) => s.nama.toLowerCase()).join(', ')}.`
      : `Sub-jenis: ${b.sub_jenis.map((s) => s.nama).join(', ')}.`,
    aksen,
    bab: true,
  });
  const kiri = 120;
  const lebarKartu = (kiri - 4) / 2;
  if (k) {
    [
      [angka(k.produksi_ton), `ton produksi ${k.tahun}`],
      [k.nilai_juta_rp == null ? '-' : formatRupiah(k.nilai_juta_rp * 1e6), `nilai produksi ${k.tahun}`],
      [`${angka(k.pangsa_nasional_persen, 1)}%`, `pangsa nasional, peringkat ${k.peringkat_nasional}/${k.jumlah_provinsi}`],
      [k.pertumbuhan_persen == null ? '-' : `${angka(k.pertumbuhan_persen, 1)}%`, `pertumbuhan per tahun (${k.tahun_awal}–${k.tahun})`],
      [angka(k.harga_rp_kg), `Rp/kg di ${o.wilayah.nama}`],
      [angka(k.harga_nasional_rp_kg), 'Rp/kg rata-rata nasional'],
    ].forEach(([n, l], c) => dek.angkaKartu(TEPI + (c % 2) * (lebarKartu + 4), y + Math.floor(c / 2) * 26, lebarKartu, 23, n, l, c === 5 ? '#94a3b8' : aksen));
    const yr = y + 79;
    let yy = dek.kartu(TEPI, yr, kiri, BAWAH - yr, { judul: 'Ruang laut dan ketentuan Perda', ikon: 'zona', aksen });
    dek.gaya(7.4, C.navy, true);
    dek.doc.text(`${angka(j.sesuai_ha)} ha zona sesuai | ${angka(j.tinggi_ha)} ha kelas tinggi (S1)`, TEPI + 5, yy);
    ketentuanRinci(dek, j, TEPI + 5, yy + 5, kiri - 10, 1);

    const x = TEPI + kiri + 5;
    const lebar = W - TEPI - x;
    yy = dek.kartu(x, y, lebar, 66, { judul: 'Produksi per tahun (ton)', ikon: 'kajian', aksen });
    dek.gambar(grafikKanvas(k.seri, 'produksi_ton', aksen), x + 4, yy - 2.5, lebar - 8, (lebar - 8) * 0.4);
    yy = dek.kartu(x, y + 70, lebar, BAWAH - y - 70, { judul: `Provinsi produsen utama ${k.tahun}`, ikon: 'pasar', aksen });
    const milik = k.provinsi_teratas.some((p) => p.provinsi.toLowerCase() === o.wilayah.nama.toLowerCase());
    dek.batang(x + 5, yy, lebar - 10, [
      ...k.provinsi_teratas.map((p) => ({
        label: p.provinsi, nilai: p.produksi_ton, teks: `${angka(p.produksi_ton)} t  |  ${angka(p.pangsa_persen, 1)}%`,
        sorot: p.provinsi.toLowerCase() === o.wilayah.nama.toLowerCase(),
      })),
    ].slice(0, milik ? 5 : 4).concat(milik ? [] : [{
      label: `${o.wilayah.nama} (#${k.peringkat_nasional})`, nilai: k.produksi_ton, teks: `${angka(k.produksi_ton)} t  |  ${angka(k.pangsa_nasional_persen, 1)}%`, sorot: true,
    }]), aksen);
    dek.sumber(`Sumber: ${SUMBER_BPS(k)}, ${k.tahun_awal}–${k.tahun}; harga = nilai produksi dibagi volume; matriks KKPRL Perda RTRW Provinsi.`);
    return;
  }
  [
    [angka(j.sesuai_ha), 'ha zona sesuai tata ruang'],
    [angka(j.tinggi_ha), 'ha zona kelas tinggi (S1)'],
    [angka(j.sedang_ha), 'ha zona kelas sedang (S2)'],
    [angka(b.lokasi.length), 'lokasi prioritas'],
  ].forEach(([n, l], c) => dek.angkaKartu(TEPI + (c % 2) * (lebarKartu + 4), y + Math.floor(c / 2) * 26, lebarKartu, 23, n, l, aksen));
  let yy = dek.kartu(TEPI, y + 53, kiri, 24, { judul: 'Deskripsi', ikon: 'kajian', aksen });
  dek.teks(TEPI + 5, yy - 0.6, kiri - 10, j.deskripsi || `Pemanfaatan ruang laut untuk kegiatan ${j.nama.toLowerCase()}.`, { ukuran: 7, maks: 2 });
  yy = dek.kartu(TEPI, y + 81, kiri, BAWAH - y - 81, { judul: 'Komposisi kelas kesesuaian', ikon: 'zona', aksen });
  const rendah = Math.max(0, j.sesuai_ha - j.tinggi_ha - j.sedang_ha);
  [['Sangat sesuai (S1)', j.tinggi_ha, C.tinggi], ['Sesuai (S2)', j.sedang_ha, C.sedang], ['Kelas rendah', rendah, [220, 38, 38]]].forEach(([label, ha, warna]) => {
    const persen = j.sesuai_ha ? (ha / j.sesuai_ha) * 100 : 0;
    dek.gaya(6.8, C.teks);
    dek.doc.text(label, TEPI + 5, yy);
    dek.gaya(6.6, C.navy, true);
    dek.doc.text(`${angka(ha)} ha  |  ${angka(persen, 1)}%`, TEPI + kiri - 5, yy, { align: 'right' });
    dek.doc.setFillColor(...C.jalur);
    dek.doc.roundedRect(TEPI + 5, yy + 1.5, kiri - 10, 2, 1, 1, 'F');
    dek.doc.setFillColor(...warna);
    dek.doc.roundedRect(TEPI + 5, yy + 1.5, Math.max(2, ((kiri - 10) * persen) / 100), 2, 1, 1, 'F');
    yy += 7.4;
  });
  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  yy = dek.kartu(x, y, lebar, BAWAH - y, { judul: 'Ketentuan pemanfaatan ruang', ikon: 'hukum', aksen });
  if (j.sub_zona_diizinkan.length) {
    dek.gaya(7, C.navy, true);
    dek.doc.text('Diizinkan pada', x + 5, yy);
    yy = dek.deretPil(x + 5, yy + 5.4, lebar - 10, j.sub_zona_diizinkan, campur(C.tinggi, 0.14), gelap(C.tinggi, 0.8)) + 2;
  }
  if (j.sub_zona_bersyarat.length) {
    dek.gaya(7, C.navy, true);
    dek.doc.text('Diizinkan bersyarat pada', x + 5, yy);
    yy = dek.deretPil(x + 5, yy + 5.4, lebar - 10, j.sub_zona_bersyarat, campur(C.sedang, 0.16), gelap(C.sedang, 0.75)) + 2;
  }
  ketentuanRinci(dek, j, x + 5, yy + 2, lebar - 10, 2);
  dek.sumber('Sumber: analisis kesesuaian ruang laut aplikasi; ketentuan pemanfaatan ruang per sub-zona; rincian kegiatan dari matriks KKPRL Perda RTRW Provinsi.');
}

function lokasiSesuai(dek, o, b, i, citra) {
  const j = o.jenis[b.sektor];
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 2, 'Lokasi dan daya dukung lingkungan'),
    judul: `Lokasi paling sesuai ${b.nama.toLowerCase()}`,
    sub: `Peta kelas kesesuaian ${j.nama.toLowerCase()} dan lokasi prioritas sub-jenis ${b.sub_jenis.map((s) => s.nama.toLowerCase()).join(', ')} dari Peta Sebaran Wilayah Potensial Investasi.`,
    subBaris: 2,
    aksen,
    bab: true,
  });
  const lebarPeta = 140;
  const tinggiPeta = lebarPeta * (PETA.tinggi / PETA.lebar);
  dek.kartu(TEPI, y, lebarPeta + 6, BAWAH - y);
  dek.gambar(petaKanvas({
    cakupan: o.wilayah.cakupan,
    batas: o.wilayah.batas,
    citra,
    lapisan: [{ fitur: j.peta, warna: (f) => warnaKelasKelayakan(f.kelas), isi: 0.7 }],
    titik: b.lokasi.map((l, n) => ({ titik: l.titik, warna: aksen, label: n + 1 })),
  }), TEPI + 3, y + 3, lebarPeta, tinggiPeta);
  dek.legenda(TEPI + 5, y + tinggiPeta + 8.2, lebarPeta, [
    { label: 'Sangat sesuai (S1)', warna: warnaKelasKelayakan('TINGGI') },
    { label: 'Sesuai (S2)', warna: warnaKelasKelayakan('SEDANG') },
    { label: 'Nomor lokasi prioritas', warna: aksen },
  ]);

  const x = TEPI + lebarPeta + 11;
  const lebar = W - TEPI - x;
  let yy = dek.kartu(x, y, lebar, BAWAH - y, { judul: 'Lokasi prioritas dan daya dukung', ikon: 'lokasi', aksen });
  if (!b.lokasi.length) {
    dek.teks(x + 5, yy, lebar - 10, `Belum ada lokasi unggulan ${b.sub_jenis.map((s) => s.nama.toLowerCase()).join(', ')} di provinsi ini pada Peta Sebaran Wilayah Potensial Investasi. Peta di samping menunjukkan zona berkelas S1 dan S2 untuk ${j.nama.toLowerCase()} sebagai arahan awal.`, { ukuran: 7.2, maks: 6 });
    dek.sumber(`Sumber: analisis kesesuaian ruang aplikasi; ${ATRIBUSI_CITRA}.`);
    return;
  }
  const d = dek.doc;
  const rapat = b.lokasi.length > 4;
  b.lokasi.forEach((l, n) => {
    const kelas = kelasS(l.kelas);
    d.setFillColor(...rgb(aksen));
    d.circle(x + 7, yy - 0.2, 2.6, 'F');
    dek.gaya(6.8, C.putih, true);
    d.text(String(n + 1), x + 7, yy + 0.8, { align: 'center' });
    dek.gaya(7.2, C.navy, true);
    d.text(bersih(namaRapi(l.nama, 36)), x + 11.6, yy);
    dek.pilKelas(x + lebar - 5, yy, kelas);
    dek.gaya(6.2, C.abu);
    d.text(bersih(`${l.kabupaten || '-'}  |  LP ${angka(l.luas_ha, 1)} ha${l.luas_wilayah_ha ? ` dari area potensial ${angka(l.luas_wilayah_ha)} ha` : ''}${b.sub_jenis.length > 1 && l.sub_sektor ? `  |  ${namaRapi(l.sub_sektor, 28)}` : ''}`), x + 11.6, yy + 3.4);
    let yb = yy + 3.4;
    const laut = l.oseanografi || {};
    const teksLaut = [
      laut.KEDALAMAN != null && `kedalaman ${angka(laut.KEDALAMAN)} m`,
      laut.SUHU != null && `suhu ${angka(laut.SUHU, 1)} °C`,
      laut.GELOMBANG != null && `gelombang ${angka(laut.GELOMBANG, 1)} m`,
      laut.KLOROFIL != null && `klorofil ${angka(laut.KLOROFIL, 2)} mg/m³`,
    ].filter(Boolean).join('  |  ');
    if (teksLaut) {
      yb += 2.9;
      dek.gaya(5.9, WARNA_LAUT);
      d.text(d.splitTextToSize(bersih(teksLaut), lebar - 18)[0], x + 11.6, yb);
    }
    if (kelas) {
      yb += 2.9;
      dek.gaya(5.9, gelap(WARNA_S[kelas], 0.75));
      d.text(d.splitTextToSize(bersih(REKOMENDASI_S[kelas]), lebar - 18)[0], x + 11.6, yb);
    }
    if (!rapat && (l.pembatas[0] || l.peringatan[0])) {
      yb += 2.9;
      dek.gaya(5.9, [185, 28, 28]);
      d.text(d.splitTextToSize(bersih(`! ${l.peringatan[0] || l.pembatas[0]}`), lebar - 18)[0], x + 11.6, yb);
    }
    yy = yb + (rapat ? 4.6 : 5.4);
    if (n < b.lokasi.length - 1) {
      d.setDrawColor(...C.garis);
      d.setLineWidth(0.15);
      d.line(x + 5, yy - 3.2, x + lebar - 5, yy - 3.2);
    }
  });
  dek.sumber(`Sumber: Peta Sebaran Wilayah Potensial Investasi aplikasi (lolos matriks Perda, pengecualian, dan batas unggulan sub-jenis); kelas S1/S2 dari kelas kesesuaian zona; oseanografi NOAA; ${ATRIBUSI_CITRA}. Hasil indikatif, bukan pengganti Persetujuan KKPRL.`);
}

function lokasiDetail(dek, o, b, i, citraLokasi) {
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 2, 'Lokasi prioritas per kawasan'),
    judul: `Lokasi prioritas ${b.nama.toLowerCase()} per kawasan`,
    sub: 'Peta perbesaran setiap lokasi prioritas dengan kelas kesesuaian, luas, dan rekomendasi skala usaha.',
    aksen,
    bab: true,
  });
  const f = finansialUtama(b);
  const kolom = 3;
  const lebar = (W - TEPI * 2 - (kolom - 1) * 4) / kolom;
  const tinggiPeta = (lebar - 4) * (PETA_LOKASI.tinggi / PETA_LOKASI.lebar);
  const tinggiSel = (BAWAH - y - 4) / 2;
  b.lokasi.slice(0, 6).forEach((l, n) => {
    const x = TEPI + (n % kolom) * (lebar + 4);
    const yk = y + Math.floor(n / kolom) * (tinggiSel + 4);
    const kelas = kelasS(l.kelas);
    dek.kartu(x, yk, lebar, tinggiSel);
    dek.gambar(petaKanvas({
      cakupan: l.cakupanPeta,
      batas: null,
      citra: citraLokasi[l.id],
      ...PETA_LOKASI,
      lapisan: [
        { fitur: o.jenis[b.sektor].peta, warna: (fz) => warnaKelasKelayakan(fz.kelas), isi: 0.4, tebal: 1 },
        { fitur: [{ geometry: l.batas }], warna: '#FACC15', isi: 0.3, tebal: 5 },
      ],
      titik: [{ titik: l.titik, warna: aksen, label: n + 1 }],
    }), x + 2, yk + 2, lebar - 4, tinggiPeta);
    let yy = yk + tinggiPeta + 6;
    dek.gaya(7, C.navy, true);
    dek.doc.text(bersih(`${n + 1}. ${namaRapi(l.nama, 34)}`), x + 4, yy);
    dek.pilKelas(x + lebar - 4, yy, kelas);
    dek.gaya(5.9, C.abu);
    dek.doc.text(bersih(`${l.kabupaten || '-'} | LP ${angka(l.luas_ha, 1)} ha | area ${angka(l.luas_wilayah_ha)} ha`), x + 4, yy + 3.2);
    yy += 3.2;
    const vol = f?.hasil?.skenario.find((s) => s.kode === (kelas === 'S2' ? 's2' : 's1'));
    if (vol) {
      yy += 2.8;
      dek.gaya(5.9, C.teks);
      dek.doc.text(bersih(`Produktivitas ${kelas || 'S1'}: ${angka(vol.volume)} ${f.hasil.satuan_produk}/tahun per ${f.hasil.satuan_usaha}`), x + 4, yy);
    }
    if (kelas) dek.teks(x + 4, yy + 2.8, lebar - 8, REKOMENDASI_S[kelas], { ukuran: 5.8, warna: gelap(WARNA_S[kelas], 0.75), maks: 2 });
  });
  dek.sumber(`Sumber: Peta Sebaran Wilayah Potensial Investasi aplikasi; produktivitas dari model usaha administrator; ${ATRIBUSI_CITRA}.`);
}

const RANTAI_INTI = {
  PERIKANAN_TANGKAP: ['Penyedia BBM, es, dan umpan', 'Nelayan', 'TPI dan pengepul', 'Pengolah dan cold storage', 'Pedagang besar dan eksportir', 'Pasar lokal dan ekspor'],
  PERIKANAN_BUDIDAYA: ['Penyedia benih dan pakan', 'Pembudidaya', 'Pengepul desa', 'Pengumpul besar dan pabrik', 'Eksportir', 'Pasar lokal dan ekspor'],
  PENGOLAHAN_HASIL_LAUT: ['Nelayan dan pembudidaya', 'Pengepul bahan baku', 'Unit pengolahan', 'Distributor dan eksportir', 'Ritel dan pasar ekspor'],
  GARAM: ['Petambak garam', 'Pengepul', 'Pabrik pemurnian', 'Industri dan distributor', 'Pasar konsumsi dan industri'],
  PARIWISATA_BAHARI: ['Operator dan pemandu lokal', 'Akomodasi dan kuliner', 'Agen perjalanan', 'Wisatawan domestik dan mancanegara'],
  JASA_MARITIM: ['Pemilik dan operator kapal', 'Galangan, bunker, dan terminal', 'Jasa pelabuhan dan logistik', 'Pengguna jasa pelayaran'],
  INFRASTRUKTUR_LAUT: ['Perencana dan kontraktor', 'Pemasok material', 'Operator infrastruktur', 'Pengguna dan masyarakat pesisir'],
  ENERGI_KELAUTAN: ['Pengembang pembangkit', 'Pemasok teknologi', 'Transmisi dan gardu PLN', 'Pelanggan listrik'],
  BIOTEKNOLOGI_KELAUTAN: ['Penyedia bahan baku hayati', 'Riset dan pengembangan', 'Pabrik bioproduk', 'Distributor', 'Pasar farmasi, kosmetik, dan pakan'],
  KONSERVASI_PESISIR: ['Kelompok pengelola masyarakat', 'Restorasi dan pemantauan', 'Verifikasi dan sertifikasi', 'Pembeli kredit karbon dan wisatawan'],
};
const PENDUKUNG = [
  ['Pelabuhan perikanan', ['PELABUHAN_PERIKANAN']],
  ['Pelabuhan umum', ['PELABUHAN_UMUM']],
  ['Terminal khusus', ['TERMINAL_KHUSUS']],
  ['Penyeberangan', ['PELABUHAN_PENYEBERANGAN']],
  ['Bandar udara', ['BANDARA']],
  ['Kawasan industri', ['KAWASAN_INDUSTRI', 'KAWASAN_PERDAGANGAN_BEBAS']],
  ['Jaringan dan pembangkit listrik', ['JARINGAN_LISTRIK', 'JARINGAN_LISTRIK_TM', 'GARDU_INDUK', 'PEMBANGKIT_LISTRIK']],
  ['Jalan nasional', ['JALAN_NASIONAL']],
  ['Kampus dan lembaga riset', ['KAMPUS_RISET']],
];
const LINGKUNGAN_BISNIS = {
  PERIKANAN_TANGKAP: ['Perizinan kapal dan penangkapan', 'Cara Penanganan Ikan yang Baik', 'HACCP', 'Karantina dan mutu ekspor', 'Kuota penangkapan'],
  PERIKANAN_BUDIDAYA: ['PKKPRL atau PKKPR', 'Cara Budi Daya Ikan yang Baik', 'SPPL, UKL-UPL, atau AMDAL', 'Karantina dan mutu ekspor', 'Tata kelola lahan'],
  PENGOLAHAN_HASIL_LAUT: ['PKKPR', 'HACCP', 'Sertifikasi halal', 'SPPL, UKL-UPL, atau AMDAL', 'Mutu ekspor'],
};
const LINGKUNGAN_UMUM = ['PKKPRL atau PKKPR', 'SPPL, UKL-UPL, atau AMDAL', 'Perizinan berusaha OSS', 'Standar mutu produk', 'Kemitraan masyarakat'];

function rantaiPasar(dek, o, b, i) {
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 3, 'Peta rantai pasar'),
    judul: `Peta rantai pasar ${b.nama.toLowerCase()}`,
    sub: 'Rantai nilai dari hulu ke hilir; garis biru menandai fasilitas pendukung yang tercatat di provinsi, garis oranye yang belum tercatat.',
    aksen,
    bab: true,
  });
  const d = dek.doc;
  const inf = o.infrastruktur || {};
  const inti = RANTAI_INTI[b.sektor] || RANTAI_INTI.PENGOLAHAN_HASIL_LAUT;
  const pendukung = PENDUKUNG.map(([label, kat]) => ({ label, n: kat.reduce((s, k) => s + (inf[k] || 0), 0) }));
  const BIRU = [37, 99, 235];
  const ORANYE = [234, 88, 12];
  const lebarIsi = W - TEPI * 2;
  const pita = (yy, tinggi, judul, warnaLatar, bawah = false) => {
    d.setFillColor(...warnaLatar);
    d.roundedRect(TEPI, yy, lebarIsi, tinggi, 3, 3, 'F');
    dek.gaya(6, C.abu, true);
    d.text(judul.toUpperCase(), TEPI + 4, bawah ? yy + tinggi - 2.2 : yy + 4.6, { charSpace: 0.25 });
  };

  const yA = y;
  pita(yA, 30, 'Fungsi pendukung', campur(C.biru, 0.06));
  const yI = yA + 38;
  pita(yI, 32, 'Rantai nilai inti', campur(rgb(aksen), 0.12), true);
  const yL = yI + 40;
  pita(yL, BAWAH - 9 - yL, 'Lingkungan pendukung bisnis: nilai dan regulasi', campur(C.hijau, 0.12));

  const lebarInti = (lebarIsi - 8 - (inti.length - 1) * 7) / inti.length;
  const pusat = inti.map((nama, n) => {
    const x = TEPI + 4 + n * (lebarInti + 7);
    d.setFillColor(...C.putih);
    d.setDrawColor(...rgb(aksen));
    d.setLineWidth(0.5);
    d.roundedRect(x, yI + 8, lebarInti, 19, 2.6, 2.6, 'FD');
    dek.gaya(7, C.navy, true);
    const baris = d.splitTextToSize(bersih(nama), lebarInti - 5).slice(0, 3);
    d.text(baris, x + lebarInti / 2, yI + 17.5 - (baris.length - 1) * 1.6, { align: 'center', lineHeightFactor: 1.15 });
    if (n < inti.length - 1) {
      d.setFillColor(...rgb(aksen));
      const ax = x + lebarInti + 1.2;
      d.triangle(ax, yI + 15, ax, yI + 20, ax + 4.4, yI + 17.5, 'F');
    }
    return x + lebarInti / 2;
  });

  const lebarDukung = (lebarIsi - 8 - (pendukung.length - 1) * 3) / pendukung.length;
  pendukung.forEach((p, n) => {
    const x = TEPI + 4 + n * (lebarDukung + 3);
    const warna = p.n ? BIRU : ORANYE;
    d.setFillColor(...C.putih);
    d.setDrawColor(...warna);
    d.setLineWidth(0.45);
    d.roundedRect(x, yA + 8, lebarDukung, 18, 2.2, 2.2, 'FD');
    dek.gaya(6, C.navy, true);
    d.text(d.splitTextToSize(bersih(p.label), lebarDukung - 4).slice(0, 2), x + lebarDukung / 2, yA + 13.6, { align: 'center', lineHeightFactor: 1.1 });
    dek.gaya(5.6, gelap(warna, 0.85), true);
    d.text(p.n ? `${angka(p.n)} tercatat` : 'belum tercatat', x + lebarDukung / 2, yA + 23.6, { align: 'center' });
    const tujuan = pusat[Math.min(pusat.length - 1, Math.round((n / (pendukung.length - 1)) * (pusat.length - 1)))];
    d.setDrawColor(...warna);
    d.setLineWidth(0.35);
    if (!p.n) d.setLineDashPattern([1.2, 1], 0);
    d.line(x + lebarDukung / 2, yA + 26, tujuan, yI + 8);
    d.setLineDashPattern([], 0);
  });

  const regulasi = LINGKUNGAN_BISNIS[b.sektor] || LINGKUNGAN_UMUM;
  const lebarReg = (lebarIsi - 8 - (regulasi.length - 1) * 4) / regulasi.length;
  regulasi.forEach((r, n) => {
    const x = TEPI + 4 + n * (lebarReg + 4);
    d.setFillColor(...C.putih);
    d.setDrawColor(...gelap(C.hijau, 0.75));
    d.setLineWidth(0.35);
    d.roundedRect(x, yL + 8, lebarReg, 11, 2.2, 2.2, 'FD');
    dek.gaya(6.4, C.navy, true);
    d.text(d.splitTextToSize(bersih(r), lebarReg - 4).slice(0, 2), x + lebarReg / 2, yL + 12.6, { align: 'center', lineHeightFactor: 1.1 });
  });
  dek.legenda(TEPI + 4, BAWAH - 2, 200, [
    { label: 'Fasilitas tercatat di provinsi', warna: '#2563EB' },
    { label: 'Belum tercatat di basis data: peluang investasi pendukung', warna: '#EA580C' },
  ]);
  dek.sumber('Sumber: kerangka rantai nilai Hendratmo dkk. (2017) sebagaimana dipakai laporan profil investasi perikanan NTB; jumlah fasilitas dari Satu Data KKP dan OpenStreetMap pada basis data aplikasi.');
}

const irrTeks = (irr) => (irr <= -99 ? 'tidak terhitung' : `${angka(irr, 1)}%`);
const WARNA_KOMPONEN = ['#0056A5', '#40BFDB', '#8CC63F', '#F59E0B', '#94A3B8'];
const WARNA_PROYEKSI = { pendapatan: '#0056A5', pengeluaran: '#EA580C', bersih: '#16A34A', kumulatif: '#7C3AED' };

function finansial(dek, o, b, i, perJenis) {
  const aksen = aksenBab(b);
  const f = finansialUtama(b);
  const k = komoditasBab(o, b);
  const y = dek.slide({
    alis: alisBab(i, b, 4, 'Struktur investasi dan analisis finansial'),
    judul: `Analisis finansial ${f ? f.nama.toLowerCase() : b.nama.toLowerCase()}`,
    sub: f ? `Model usaha per ${f.hasil.satuan_usaha}; harga ${f.hasil.harga_dari_bps ? 'produsen BPS provinsi' : 'menurut model usaha'} Rp ${angka(f.hasil.harga)}/${f.hasil.satuan_produk}; diskonto ${angka(f.hasil.asumsi.diskonto_persen, 1)}%, horizon ${angka(f.hasil.asumsi.umur_tahun)} tahun.`
      : `Provinsi ${o.wilayah.nama}`,
    aksen,
    bab: true,
  });
  if (!f) {
    dek.kosong(TEPI, y, W - TEPI * 2, BAWAH - y, {
      ikon: 'finansial',
      aksen,
      judul: `Model usaha ${b.sub_jenis.map((s) => s.nama.toLowerCase()).join(', ')} belum ditetapkan`,
      isi: `Analisis finansial (struktur investasi, proyeksi ${angka(o.asumsi_finansial.umur_tahun)} tahun, NPV, IRR, BCR, dan masa pengembalian) dihitung otomatis setelah administrator mengisi volume produksi, harga, investasi awal, dan biaya operasional di Pengaturan Analisis, kelompok Model usaha Profil Investasi.${k?.harga_rp_kg ? ` Harga produsen BPS di provinsi ini Rp ${angka(k.harga_rp_kg)}/kg akan dipakai bila harga tidak diisi.` : ''}`,
    });
    return;
  }
  const h = f.hasil;
  const kiri = 118;
  const tinggiAtas = perJenis ? 55 : 64;
  let yy = dek.kartu(TEPI, y, kiri, tinggiAtas, { judul: 'Struktur investasi', ikon: 'finansial', aksen });
  const ukuranDonut = Math.min(tinggiAtas - 26, 29);
  [[h.investasi, `Investasi awal ${rp(h.investasi_total)}`], [h.operasional, `Operasional per tahun ${rp(h.operasional_total)}`]].forEach(([komponen, judul], n) => {
    const x = TEPI + 5 + n * ((kiri - 10) / 2);
    const item = Object.entries(komponen).sort((a1, a2) => a2[1] - a1[1])
      .map(([label, nilai], c) => ({ label, nilai, warna: WARNA_KOMPONEN[c % WARNA_KOMPONEN.length] }));
    dek.gaya(6.4, C.navy, true);
    dek.doc.text(bersih(judul), x, yy);
    dek.gambar(donutKanvas(item), x, yy + 2, ukuranDonut, ukuranDonut);
    let yl = yy + 5;
    item.slice(0, 5).forEach((it) => {
      dek.doc.setFillColor(...rgb(it.warna));
      dek.doc.roundedRect(x + ukuranDonut + 2, yl - 2.2, 2.4, 2.4, 0.6, 0.6, 'F');
      yl = dek.teks(x + ukuranDonut + 5.4, yl, (kiri - 10) / 2 - ukuranDonut - 6, it.label, { ukuran: 5.4, jarak: 1.2, maks: 2 }) + 1.6;
    });
  });
  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  const [bagi, satuan] = skalaRupiah(h.proyeksi.flatMap((p) => [p.pendapatan, p.kumulatif]));
  yy = dek.kartu(x, y, lebar, tinggiAtas, { judul: `Proyeksi keuangan ${h.asumsi.umur_tahun} tahun (Rp ${satuan})`, ikon: 'pasar', aksen });
  const seri = [
    ['pendapatan', 'Pendapatan'], ['pengeluaran', 'Pengeluaran'], ['bersih', 'Pendapatan bersih'], ['kumulatif', 'Arus kas kumulatif'],
  ].map(([kunci, label]) => ({ label, warna: WARNA_PROYEKSI[kunci], nilai: h.proyeksi.map((p) => p[kunci] / bagi) }));
  const tinggiGrafik = tinggiAtas - 22;
  dek.gambar(garisKanvas(h.proyeksi.map((p) => p.tahun), seri, { tinggi: Math.round((1500 * tinggiGrafik) / (lebar - 8)), format: (v) => angka(v, bagi >= 1e9 ? 1 : 0) }),
    x + 4, yy - 3, lebar - 8, tinggiGrafik);
  dek.legenda(x + 5, y + tinggiAtas - 3, lebar - 10, seri.map((s) => ({ label: s.label, warna: s.warna })));

  const yt = y + tinggiAtas + 4;
  const lp = (kode) => [...new Set(b.lokasi.filter((l) => kelasS(l.kelas) === kode.toUpperCase())
    .map((l) => `${namaRapi(l.nama, 26)} (${l.kabupaten || '-'})`))];
  const yAkhir = dek.tabel(TEPI, yt, W - TEPI * 2,
    ['Kondisi', `Volume/tahun (${h.satuan_produk})`, 'Pendapatan/tahun', 'NPV', 'IRR', 'BCR', 'Masa kembali', 'Biaya KKPRL', 'Lokasi prioritas'],
    h.skenario.map((s) => [s.label, angka(s.volume), rp(s.pendapatan), rp(s.npv), irrTeks(s.irr), angka(s.bcr, 2),
      s.pbp == null ? 'tidak tercapai' : `${angka(s.pbp, 1)} th`, rp(h.biaya_kkprl), s.kode === 'riil' ? '-' : (lp(s.kode).join(', ') || '-')]),
    { bagian: [0.12, 0.1, 0.1, 0.1, 0.06, 0.06, 0.08, 0.09, 0.29], rataKanan: [1, 2, 3, 4, 5, 6, 7], ukuran: 6.2,
      sorot: h.skenario.map((s, n) => (s.layak ? n : -1)).filter((n) => n >= 0), aksen });
  if (perJenis) {
    dek.tabel(TEPI, yAkhir + 1, W - TEPI * 2, ['Analisis sensitivitas', 'NPV', 'IRR', 'BCR', 'Masa kembali', 'Status'],
      h.sensitivitas.map((s) => [s.label, rp(s.npv), irrTeks(s.irr), angka(s.bcr, 2), s.pbp == null ? 'tidak tercapai' : `${angka(s.pbp, 1)} th`, s.layak ? 'Layak' : 'Tidak layak']),
      { bagian: [0.3, 0.16, 0.12, 0.12, 0.14, 0.16], rataKanan: [1, 2, 3, 4], ukuran: 6.2, aksen });
  }
  const lain = b.finansial.filter((x2) => x2 !== f);
  dek.sumber(`Baris disorot = layak (NPV > 0, IRR > ${angka(h.asumsi.diskonto_persen, 1)}%, BCR > 1, masa kembali paling lama ${angka(h.asumsi.batas_pbp_tahun)} tahun). Model usaha: Pengaturan Analisis aplikasi${lain.length ? `; sub-jenis lain ${lain.map((x2) => `${x2.nama.toLowerCase()} (${x2.hasil ? 'ada model' : 'belum ada model'})`).join(', ')}` : ''}.`);
}

function sosial(dek, o, b, i) {
  const j = o.jenis[b.sektor];
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 5, 'Sosial dan tenaga kerja'),
    judul: `Sosial dan tenaga kerja ${b.nama.toLowerCase()}`,
    sub: `Kondisi sosial pesisir Provinsi ${o.wilayah.nama} dan kebutuhan keahlian ${j.nama.toLowerCase()}.`,
    aksen,
    bab: true,
  });
  const bps = o.sosial.ketenagakerjaan?.indikator || {};
  dek.pitaAngka(TEPI, y, W - TEPI * 2, 22, [
    bps.tpt?.nilai != null && [`${angka(bps.tpt.nilai, 2)}%`, `tingkat pengangguran terbuka (${bps.tpt.tahun})`],
    bps.pengangguran?.nilai != null && [angka(bps.pengangguran.nilai), `orang menganggur (${bps.pengangguran.tahun})`],
    tangkap(b) ? [angka(o.wilayah.nelayan), 'nelayan di kabupaten/kota'] : [`${o.wilayah.jumlah_kabkota_pesisir}`, 'kabupaten/kota pesisir'],
    [angka(j.rasio_tk_per_miliar, 1), 'tenaga kerja per Rp1 miliar investasi'],
  ], gelap(rgb(aksen), 0.8));
  const yk = y + 26;
  const kiri = 150;
  let yy = dek.kartu(TEPI, yk, kiri, BAWAH - yk, { judul: 'Kabupaten/kota pesisir', ikon: 'sosial', aksen });
  const lp = (nama) => b.lokasi.filter((l) => l.kabupaten === nama).length;
  const kab = o.sosial.kabupaten.slice(0, 10);
  const [kolom, isi, bagian, catatan] = tangkap(b)
    ? [['Kabupaten/kota', 'Penduduk', 'Nelayan', 'RTP tangkap', 'DTKS (%)'],
      kab.map((kb) => [kb.nama, angka(kb.penduduk), angka(kb.nelayan), angka(kb.rtp_tangkap), angka(kb.rasio_dtks, 1)]),
      [0.34, 0.19, 0.16, 0.17, 0.14], 'RTP tangkap: rumah tangga perikanan tangkap. DTKS: Data Terpadu Kesejahteraan Sosial, persentase penduduk terdaftar.']
    : [['Kabupaten/kota', 'Penduduk', 'DTKS (%)', 'Lokasi prioritas'],
      kab.map((kb) => [kb.nama, angka(kb.penduduk), angka(kb.rasio_dtks, 1), angka(lp(kb.nama))]),
      [0.4, 0.22, 0.18, 0.2], 'DTKS: Data Terpadu Kesejahteraan Sosial, persentase penduduk terdaftar. Lokasi prioritas: jumlah lokasi bab ini di kabupaten/kota tersebut.'];
  const ySosial = dek.tabel(TEPI + 4, yy - 1, kiri - 8, kolom, isi, { bagian, rataKanan: kolom.map((_, c) => c).slice(1), ukuran: 6.5, batas: BAWAH - 6, aksen });
  dek.teks(TEPI + 4, ySosial + 2, kiri - 8, catatan, { ukuran: 5.9, warna: C.abu, maks: 2 });

  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  yy = dek.kartu(x, yk, lebar, BAWAH - yk, { judul: 'Keahlian yang dibutuhkan', ikon: 'keahlian', aksen });
  const d = dek.doc;
  j.keahlian.slice(0, 7).forEach((kh) => {
    if (yy > BAWAH - 6) return;
    dek.gaya(7.2, C.navy, true);
    d.text(d.splitTextToSize(bersih(kh.posisi), lebar - 30)[0], x + 5, yy);
    const warna = kh.prioritas === 'TINGGI' ? [220, 38, 38] : kh.prioritas === 'SEDANG' ? C.sedang : C.abu;
    const label = LABEL_KELAS[kh.prioritas] || kh.prioritas || '-';
    dek.gaya(5.6, gelap(warna, 0.8), true);
    dek.pil(x + lebar - 5 - (d.getTextWidth(label) + 3.6), yy, label, campur(warna, 0.14), gelap(warna, 0.8), 5.6);
    dek.gaya(6.2, C.abu);
    d.text(bersih(`${angka(kh.pct * 100, 0)}% kebutuhan tenaga kerja  |  pelatihan ${angka(kh.bulan)} bulan`), x + 5, yy + 3.6);
    yy += 9.2;
  });
  dek.sumber('Sumber: BPS (ketenagakerjaan provinsi), data sosial kabupaten/kota (BPS dan KKP) pada basis data aplikasi, matriks keahlian per jenis investasi.');
}

const KEBUTUHAN_TEKNOLOGI = {
  PERIKANAN_TANGKAP: 'rantai dingin di kapal dan pelabuhan, palka berpendingin, serta ketertelusuran hasil tangkapan',
  PERIKANAN_BUDIDAYA: 'benih unggul, biosekuriti, pemantauan kualitas air, dan penanganan pascapanen',
  PENGOLAHAN_HASIL_LAUT: 'pendinginan, mesin pengolahan berstandar mutu, dan pengemasan',
  GARAM: 'geomembran, pencucian dan pemurnian, serta fortifikasi yodium',
  PARIWISATA_BAHARI: 'fasilitas ramah lingkungan, pengelolaan sampah, dan pemantauan daya dukung kunjungan',
  JASA_MARITIM: 'peralatan galangan, sistem bunker aman, dan digitalisasi layanan pelabuhan',
  INFRASTRUKTUR_LAUT: 'rekayasa pantai, material tahan korosi, dan pemantauan struktur',
  ENERGI_KELAUTAN: 'turbin atau konverter energi laut dan sambungan ke jaringan PLN',
  BIOTEKNOLOGI_KELAUTAN: 'laboratorium ekstraksi, kultur mikroalga, dan standar produk',
  KONSERVASI_PESISIR: 'pemantauan karbon dan ekosistem, pembibitan, dan transplantasi',
};

function nilaiRisiko(o, b) {
  const k = komoditasBab(o, b);
  const s1 = b.lokasi.filter((l) => kelasS(l.kelas) === 'S1').length;
  const s2 = b.lokasi.filter((l) => kelasS(l.kelas) === 'S2').length;
  const j = o.jenis[b.sektor];
  const hasil = [{
    risiko: 'Produktivitas tidak mencapai target di lokasi S2',
    peluang: !b.lokasi.length || s2 > s1 ? 'Tinggi' : s2 ? 'Sedang' : 'Rendah',
    mitigasi: 'Prioritaskan lokasi S1; uji coba skala kecil; pantau kondisi perairan dan target produktivitas minimum.',
  }];
  const harga = (k?.seri || []).map((s) => s.harga_rp_kg).filter(Boolean);
  if (harga.length > 2) {
    const rata = harga.reduce((n, v) => n + v, 0) / harga.length;
    const kv = Math.sqrt(harga.reduce((n, v) => n + (v - rata) ** 2, 0) / harga.length) / rata;
    hasil.push({
      risiko: 'Fluktuasi harga dan mutu hasil',
      peluang: kv >= 0.2 ? 'Tinggi' : kv >= 0.1 ? 'Sedang' : 'Rendah',
      mitigasi: 'Standardisasi mutu dan grading; kontrak pembelian; diversifikasi produk dan hilirisasi.',
    });
  }
  const bencana = b.lokasi.some((l) => l.keunggulan.some((t) => /^Risiko/i.test(t)));
  hasil.push({
    risiko: 'Gangguan perairan dan cuaca ekstrem',
    peluang: bencana ? 'Sedang' : 'Rendah',
    mitigasi: 'Pantau peringatan dini BMKG dan risiko InaRISK; desain fasilitas tahan gelombang; asuransi usaha.',
  });
  const adat = b.lokasi.some((l) => l.peringatan.length);
  const bersyarat = b.lokasi.filter((l) => !l.peruntukan_utama).length;
  hasil.push({
    risiko: 'Konflik pemanfaatan ruang',
    peluang: adat || bersyarat > b.lokasi.length / 2 ? 'Tinggi' : (j.rincian_matriks?.blok?.BERSYARAT ? 'Sedang' : 'Rendah'),
    mitigasi: 'Penataan ruang partisipatif; libatkan masyarakat dan pengguna ruang sejak awal; mekanisme penyelesaian konflik.',
  });
  return hasil;
}

function barisPestel(o, b) {
  const j = o.jenis[b.sektor];
  const k = komoditasBab(o, b);
  const f = finansialUtama(b);
  const dasar = f && f.hasil.skenario.find((s) => s.kode === f.hasil.dasar);
  const tpt = o.sosial.ketenagakerjaan?.indikator?.tpt;
  const r = j.rincian_matriks;
  const s1 = b.lokasi.filter((l) => kelasS(l.kelas) === 'S1').length;
  const kurang = PENDUKUNG.filter(([, kat]) => !kat.some((x) => o.infrastruktur?.[x])).map(([label]) => label.toLowerCase());
  return [
    ['Politik', `${angka(j.sesuai_ha)} ha zona sesuai menurut ${perdaSingkat(o.zona)}${r ? `; matriks: penuh di ${angka(r.blok.DIIZINKAN || 0)} blok, bersyarat di ${angka(r.blok.BERSYARAT || 0)}` : ''}.`,
      'Utamakan lokasi di zona yang mengizinkan penuh; lokasi bersyarat memerlukan kajian tambahan.'],
    ['Ekonomi', [k && pertumbuhanTeks(k), k && hargaTeks(k), dasar && `NPV ${rp(dasar.npv)}, IRR ${angka(dasar.irr, 1)}%.`].filter(Boolean).join(' ') || 'Data pasar publik untuk jenis ini terbatas.',
      dasar ? (dasar.layak ? 'Model usaha layak pada kondisi dasar.' : 'Model usaha belum layak pada kondisi dasar; perlu efisiensi biaya atau peningkatan produktivitas.') : 'Tetapkan model usaha di Pengaturan Analisis untuk menilai kelayakan finansial.'],
    ['Sosial', `${tpt?.nilai != null ? `Pengangguran terbuka ${angka(tpt.nilai, 2)}%; ` : ''}${angka(j.rasio_tk_per_miliar, 1)} tenaga kerja per Rp1 miliar investasi.`,
      b.lokasi.some((l) => l.peringatan.length) ? 'Ada lokasi dekat wilayah adat; libatkan masyarakat adat sejak awal.' : 'Prioritaskan tenaga kerja lokal dan pelatihan keahlian berprioritas tinggi.'],
    ['Teknologi', `Kebutuhan utama: ${KEBUTUHAN_TEKNOLOGI[b.sektor] || 'teknologi produksi dan standar mutu'}.`,
      kurang.length ? `Fasilitas belum tercatat (${kurang.slice(0, 3).join(', ')}) menjadi peluang investasi pendukung.` : 'Fasilitas pendukung utama sudah tercatat di provinsi.'],
    ['Lingkungan', `${angka(j.tinggi_ha)} ha zona S1 dan ${angka(j.sedang_ha)} ha zona S2; ${b.lokasi.length ? `${s1} dari ${b.lokasi.length} lokasi prioritas berkelas S1` : 'belum ada lokasi prioritas pada Peta Sebaran'}.`,
      'Lokasi S2 memiliki faktor pembatas alami; tidak boleh menutup ekosistem sensitif (mangrove, lamun, terumbu karang).'],
    ['Legal', 'NIB dan perizinan berusaha sesuai KBLI, PKKPRL atau PKKPR, dokumen lingkungan (SPPL, UKL-UPL, atau AMDAL), dan sertifikasi mutu.',
      'Proses perizinan melalui OSS; persetujuan kawasan konservasi diperlukan bila berada di dalamnya.'],
  ];
}

function pestel(dek, o, b, i) {
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: alisBab(i, b, 6, 'PESTEL, risiko, dan langkah lanjut'),
    judul: `Analisis PESTEL dan mitigasi risiko ${b.nama.toLowerCase()}`,
    sub: 'Rangkuman halaman-halaman bab ini ke dalam enam aspek, potensi risiko, dan langkah lanjut.',
    aksen,
    bab: true,
  });
  const kiri = 168;
  dek.tabel(TEPI, y, kiri, ['Aspek', 'Isu utama', 'Implikasi investasi'], barisPestel(o, b),
    { bagian: [0.13, 0.47, 0.4], ukuran: 7, aksen });
  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  const yr = dek.tabel(x, y, lebar, ['Potensi risiko', 'Peluang', 'Mitigasi'], nilaiRisiko(o, b).map((r) => [r.risiko, r.peluang, r.mitigasi]),
    { bagian: [0.33, 0.17, 0.5], ukuran: 6.2, aksen });
  const yy = dek.kartu(x, yr + 2, lebar, BAWAH - yr - 2, { judul: 'Langkah lanjut', ikon: 'isi', aksen });
  dek.nomor(x + 5, yy, lebar - 10, [
    'Verifikasi lapangan lokasi prioritas; pastikan tidak tumpang tindih KKPRL terbit maupun bangunan yang sudah ada.',
    b.lokasi.some((l) => l.pembatas.length) && 'Nilai di lapangan parameter yang belum terukur sebelum penetapan lokasi.',
    finansialUtama(b) ? 'Perbarui model usaha dengan data biaya terbaru sebelum promosi investasi.' : `Tetapkan model usaha ${b.nama.toLowerCase()} di Pengaturan Analisis.`,
    'Siapkan pelatihan untuk posisi berprioritas tinggi pada matriks keahlian.',
  ], { aksen, ukuran: 6.4 });
  dek.sumber('Disusun otomatis dari halaman kajian, lokasi, rantai pasar, finansial, dan sosial bab ini; peluang risiko dinilai dari kelas lokasi, variasi harga BPS, InaRISK, dan matriks Perda.');
}

function csr(dek, o) {
  const ada = o.bab.filter((b) => finansialUtama(b));
  const y = dek.slide({
    alis: 'Penutup',
    judul: 'Proyeksi potensi dana CSR',
    sub: `Asumsi ${angka(o.asumsi_finansial.csr_persen, 1)}% dari pendapatan bersih tahun sebelumnya, per satuan usaha model.`,
  });
  const [bagi, satuan] = skalaRupiah(ada.flatMap((b) => finansialUtama(b).hasil.csr.map((c) => c.nilai)));
  const seri = ada.map((b) => ({ label: b.nama, warna: aksenBab(b), nilai: finansialUtama(b).hasil.csr.map((c) => c.nilai / bagi) }));
  const kiri = 178;
  const yy = dek.kartu(TEPI, y, kiri, BAWAH - y, { judul: `Potensi CSR per tahun (Rp ${satuan})`, ikon: 'csr' });
  dek.gambar(garisKanvas(finansialUtama(ada[0]).hasil.csr.map((c) => c.tahun), seri, { tinggi: 760, format: (v) => angka(v, 1) }),
    TEPI + 4, yy - 2, kiri - 8, (kiri - 8) * (760 / 1500));
  dek.legenda(TEPI + 5, BAWAH - 4, kiri - 10, seri.map((s) => ({ label: s.label, warna: s.warna })));
  const x = TEPI + kiri + 5;
  dek.tabel(x, y, W - TEPI - x, ['Komoditas atau jenis', 'Satuan usaha', `Total ${o.asumsi_finansial.umur_tahun} tahun`],
    ada.map((b) => {
      const h = finansialUtama(b).hasil;
      return [b.nama, h.satuan_usaha, rp(h.csr.reduce((n, c) => n + c.nilai, 0))];
    }), { bagian: [0.4, 0.3, 0.3], rataKanan: [2], ukuran: 6.4 });
  dek.teks(x, y + 12 + ada.length * 6.4, W - TEPI - x, `Potensi CSR tahun ke-n = ${angka(o.asumsi_finansial.csr_persen, 1)}% x pendapatan bersih tahun ke-(n-1); tahun pertama belum ada karena belum ada pendapatan tahun sebelumnya. Nilai dihitung per satuan usaha model dan berlipat sesuai skala investasi.`, { ukuran: 6.4, warna: C.abu });
  dek.sumber('Sumber: model usaha Pengaturan Analisis aplikasi; asumsi CSR mengacu laporan profil investasi perikanan NTB (KKP dan WCS, 2026).');
}

function izinUntuk(b) {
  const s = b.sektor;
  const subs = b.sub_jenis.map((x) => x.kode);
  const tambak = subs.includes('BUDIDAYA_TAMBAK');
  const darat = ['PENGOLAHAN_HASIL_LAUT', 'GARAM'].includes(s) || subs.some((x) => ['BUDIDAYA_PEMBENIHAN', 'WISATA_RESOR', 'BIOTEK_BIOPLASTIK', 'BIOTEK_PAKAN_ALAMI'].includes(x));
  const ekspor = (s === 'PERIKANAN_TANGKAP' || tambak || s === 'PENGOLAHAN_HASIL_LAUT');
  if (s === 'PERIKANAN_TANGKAP') {
    return ['Pas Kecil, NIB, e-BKP (mikro); Pas Besar, NIB, Perizinan Berusaha Subsektor Penangkapan Ikan', '-', '-',
      'Hanya kapal di bawah 10 GT*', 'PBG gudang atau cold storage, SLF*', 'Cara Penanganan Ikan yang Baik; HACCP', '-',
      'Dokumen karantina ikan; Sertifikat mutu dan keamanan hasil perikanan (ekspor)', 'Administrasi OSS atau konsultan*'];
  }
  return [
    s === 'PERIKANAN_BUDIDAYA' ? 'NIB, Perizinan Berusaha Subsektor Pembudidayaan Ikan' : 'NIB dan perizinan berusaha sesuai KBLI',
    tambak ? 'PKKPRL atau PKKPR' : darat ? 'PKKPR' : 'PKKPRL',
    'SPPL, UKL-UPL, atau AMDAL*',
    'Persetujuan pemanfaatan kawasan*',
    'PBG, SLF*',
    { PERIKANAN_BUDIDAYA: 'Cara Budi Daya Ikan yang Baik', PENGOLAHAN_HASIL_LAUT: 'HACCP' }[s] || '-',
    tambak ? 'ALSE*' : '-',
    ekspor ? 'Dokumen karantina ikan; Sertifikat mutu dan keamanan hasil perikanan (ekspor)' : '-',
    'Administrasi OSS atau konsultan*',
  ];
}

const KATEGORI_IZIN = ['Legalitas usaha', 'Tata ruang dan lokasi', 'Lingkungan', 'Kawasan konservasi', 'Bangunan dan infrastruktur',
  'Teknis produksi', 'Pemanfaatan sumber daya', 'Karantina dan perdagangan', 'Administrasi dan pendampingan'];

function perizinan(dek, o) {
  const y = dek.slide({
    alis: 'Penutup',
    judul: 'Matriks kebutuhan perizinan',
    sub: 'Pengelompokan perizinan menurut fungsi utama dan tahapan kegiatan usaha untuk setiap komoditas atau jenis yang dikaji.',
  });
  const bab = o.bab.slice(0, 7);
  const izin = bab.map(izinUntuk);
  const lebarLabel = 0.16;
  dek.tabel(TEPI, y, W - TEPI * 2, ['Kategori', ...bab.map((b) => namaRapi(b.nama, 26))],
    KATEGORI_IZIN.map((kat, r) => [kat, ...izin.map((daftar) => daftar[r])]),
    { bagian: [lebarLabel, ...bab.map(() => (1 - lebarLabel) / bab.length)], ukuran: bab.length > 4 ? 6.2 : 7 });
  dek.sumber('* Kondisional, bergantung lokasi, skala usaha, dan fasilitas. Mengacu matriks perizinan KKP dalam laporan profil investasi perikanan NTB (2026); verifikasi terhadap regulasi dan OSS terbaru.');
}

function kesimpulanAkhir(dek, o) {
  const y = dek.slide({
    alis: 'Penutup',
    judul: 'Matriks kesimpulan',
    sub: 'Kelayakan ruang, kelayakan finansial, risiko prioritas, dan fokus mitigasi untuk setiap komoditas atau jenis.',
  });
  const baris = o.bab.map((b) => {
    const s1 = b.lokasi.some((l) => kelasS(l.kelas) === 'S1');
    const ruang = s1 ? `Layak (${b.lokasi.length} lokasi)` : b.lokasi.length ? `Bersyarat (${b.lokasi.length} lokasi S2)` : 'Belum ada lokasi prioritas';
    const f = finansialUtama(b);
    const dasar = f && f.hasil.skenario.find((s) => s.kode === f.hasil.dasar);
    const risiko = nilaiRisiko(o, b).sort((a1, a2) => ['Tinggi', 'Sedang', 'Rendah'].indexOf(a1.peluang) - ['Tinggi', 'Sedang', 'Rendah'].indexOf(a2.peluang));
    return [b.nama, ruang, dasar ? (dasar.layak ? 'Layak' : 'Tidak layak') : 'Model usaha belum ditetapkan',
      risiko.slice(0, 3).map((r) => `${r.risiko.toLowerCase()} (${r.peluang.toLowerCase()})`).join('; '),
      risiko[0].mitigasi];
  });
  dek.tabel(TEPI, y, W - TEPI * 2, ['Komoditas atau jenis', 'Kelayakan ruang dan ekologi', 'Kelayakan finansial', 'Risiko prioritas', 'Fokus mitigasi'], baris,
    { bagian: [0.15, 0.15, 0.13, 0.3, 0.27], ukuran: 7.2 });
  dek.sumber('Kelayakan ruang: Layak bila ada lokasi prioritas berkelas S1; Bersyarat bila hanya S2. Kelayakan finansial dari kondisi dasar model usaha.');
}

export function buatProfil(o, citra = {}) {
  const jenis = o.jenis_dipilih;
  const perJenis = Boolean(jenis);
  const dek = new DekProfil(`Profil Investasi ${jenis ? `${jenis.nama} ` : ''}Provinsi ${o.wilayah.nama}`);
  const rencana = rencanaHalaman(o, perJenis);
  sampul(dek, o, citra.sampul);
  ringkasan(dek, o, rencana);
  zonaRuang(dek, o, citra.peta);
  kebijakan(dek, o);
  if (rencana.komoditas) komoditasUnggulan(dek, o);
  if (perJenis) metode(dek, o);
  o.bab.forEach((b, i) => {
    kajian(dek, o, b, i);
    lokasiSesuai(dek, o, b, i, citra.peta);
    if (perJenis && b.lokasi.length) lokasiDetail(dek, o, b, i, citra.lokasi || {});
    rantaiPasar(dek, o, b, i);
    finansial(dek, o, b, i, perJenis);
    sosial(dek, o, b, i);
    pestel(dek, o, b, i);
  });
  if (o.bab.some((b) => finansialUtama(b))) csr(dek, o);
  perizinan(dek, o);
  kesimpulanAkhir(dek, o);
  return dek.doc;
}

const cakupanLokasi = ([x0, y0, x1, y1]) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.max(0.025, (x1 - x0) * 0.9, (y1 - y0) * 0.9);
  return [cx - r, cy - r * 0.55, cx + r, cy + r * 0.55];
};

export async function unduhProfil(provinsiId, jenis) {
  const [{ data }] = await Promise.all([
    api.get(`/inti/provinsi/${provinsiId}/profil-investasi/`, { params: jenis ? { jenis } : {} }),
    siapkanAsetPdf(),
    siapkanIkon(),
    document.fonts?.load('700 28px "Public Sans"'),
  ]);
  const cakupan = data.wilayah.cakupan;
  const sampulPx = { lebar: Math.round(SAMPUL.bagian * W * 5), tinggi: Math.round(H * 5) };
  const [sampulCitra, peta] = cakupan
    ? await Promise.all([sampulPx, PETA].map(({ lebar, tinggi }) => muatCitra(luasPeta(cakupan, lebar, tinggi), lebar, tinggi)))
    : [];
  const lokasi = {};
  if (data.jenis_dipilih) {
    data.bab.forEach((b) => b.lokasi.forEach((l) => { l.cakupanPeta = cakupanLokasi(l.cakupan); }));
    const semua = unik(data.bab.flatMap((b) => b.lokasi));
    const { lebar, tinggi } = PETA_LOKASI;
    const citraLokasi = await Promise.all(semua.map((l) => muatCitra(luasPeta(l.cakupanPeta, lebar, tinggi), lebar, tinggi).catch(() => null)));
    semua.forEach((l, n) => { lokasi[l.id] = citraLokasi[n]; });
  }
  const doc = buatProfil(data, { sampul: sampulCitra, peta, lokasi });
  const nama = `${data.jenis_dipilih ? `${data.jenis_dipilih.nama}-` : ''}${data.wilayah.nama}`.toLowerCase().replace(/[^\w]+/g, '-');
  doc.save(`profil-investasi-${nama}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
