import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import {
  BarChart3, Briefcase, Fish, Landmark, Layers, Lightbulb, ListChecks, MapPin, ScanSearch, TrendingUp, Users, Wallet, Waves,
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
const SAMPUL = { x: 166, y: 16, w: 117, h: 122, lebar: 1130, tinggi: 1180 };

const IKON = {
  zona: Layers, hukum: Landmark, komoditas: Fish, kajian: BarChart3, lokasi: MapPin, pasar: TrendingUp,
  finansial: Wallet, sosial: Users, keahlian: Briefcase, kesimpulan: Lightbulb, isi: ListChecks, cari: ScanSearch,
  laut: Waves,
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

const senilai = (k) => (k.nilai_juta_rp == null ? '' : ` senilai ${formatRupiah(k.nilai_juta_rp * 1e6)}`);

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

function petaKanvas({ cakupan, batas, citra, lapisan = [], titik = [], lebar = PETA.lebar, tinggi = PETA.tinggi }) {
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

  gambarSkala(ctx, (x1 - x0) / lebar, (y0 + y1) / 2, lebar, tinggi);
  gambarUtara(ctx, lebar);
  sudutBulat(ctx, lebar, tinggi, 26);
  return kanvas.toDataURL('image/jpeg', 0.88);
}

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

function latarSampul() {
  const s = 5;
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(W * s);
  kanvas.height = Math.round(H * s);
  const ctx = kanvas.getContext('2d');
  const gradien = ctx.createLinearGradient(0, 0, kanvas.width, kanvas.height);
  gradien.addColorStop(0, '#002242');
  gradien.addColorStop(0.55, '#0056A5');
  gradien.addColorStop(1, '#1B6A8A');
  ctx.fillStyle = gradien;
  ctx.fillRect(0, 0, kanvas.width, kanvas.height);
  [[0.66, 0.18, 0.62, 'rgba(255,255,255,0.06)'], [0.42, 1.08, 0.42, 'rgba(64,191,219,0.20)'], [1.0, 0.98, 0.3, 'rgba(140,198,63,0.18)']]
    .forEach(([cx, cy, r, warna]) => {
      ctx.beginPath();
      ctx.arc(cx * kanvas.width, cy * kanvas.height, r * kanvas.height, 0, Math.PI * 2);
      ctx.fillStyle = warna;
      ctx.fill();
    });
  const { x, y, w, h } = SAMPUL;
  ctx.save();
  ctx.translate((x + w / 2) * s, (y + h / 2) * s);
  ctx.rotate((-3.2 * Math.PI) / 180);
  const bingkai = ctx.createLinearGradient((-w / 2) * s, (-h / 2) * s, (w / 2) * s, (h / 2) * s);
  bingkai.addColorStop(0, 'rgba(64,191,219,0.95)');
  bingkai.addColorStop(1, 'rgba(140,198,63,0.95)');
  ctx.fillStyle = bingkai;
  ctx.beginPath();
  ctx.roundRect((-w / 2 - 5) * s, (-h / 2 - 5) * s, (w + 10) * s, (h + 10) * s, 7 * s);
  ctx.fill();
  ctx.restore();
  return kanvas.toDataURL('image/jpeg', 0.9);
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
  return `Nilai produksi per kilogram di tingkat produsen Rp ${angka(k.harga_rp_kg)}/kg${banding}.`;
};

const jumlahLokasi = (o, bab) => [...new Set(bab.map((b) => b.sektor))].reduce((n, kode) => n + o.jenis[kode].lokasi.length, 0);

function sampul(dek, o, bab, citra) {
  dek.halaman();
  const d = dek.doc;
  dek.gambar(latarSampul(), 0, 0, W, H);

  d.setFillColor(...C.putih);
  d.roundedRect(TEPI, 13, 11, 11, 2.4, 2.4, 'F');
  if (dek.logo) d.addImage(dek.logo.data, 'PNG', TEPI + 1.3, 14.3, 8.4, (dek.logo.h / dek.logo.w) * 8.4);
  dek.gaya(8, C.putih, true);
  d.text('KEMENTERIAN KELAUTAN DAN PERIKANAN', TEPI + 14, 17.6);
  dek.gaya(6.6, [190, 212, 235]);
  d.text('Platform Manajemen Investasi Ruang Laut', TEPI + 14, 21.6);

  dek.transparan(0.16, () => {
    d.setFillColor(...C.putih);
    d.roundedRect(TEPI, 42, 58, 6, 3, 3, 'F');
  });
  dek.gaya(6.6, C.putih, true);
  d.text('PROFIL INVESTASI RUANG LAUT', TEPI + 3.4, 46, { charSpace: 0.3 });

  dek.gaya(27, C.putih, true);
  const judul = d.splitTextToSize(bersih(`Provinsi ${o.wilayah.nama}`), 140);
  d.text(judul, TEPI, 62, { lineHeightFactor: 1.08 });
  let y = 62 + judul.length * 10.2;
  dek.gaya(12, o.jenis_dipilih ? C.hijau : [150, 220, 240], true);
  d.text(bersih(o.jenis_dipilih ? o.jenis_dipilih.nama : 'Seluruh jenis investasi'), TEPI, y - 1);
  y += 6;
  dek.teks(TEPI, y, 132, 'Disusun otomatis dari data publik: produksi perikanan BPS (data KKP), pola ruang laut KKP, '
    + 'peraturan daerah tata ruang (JDIH Badan Pemeriksa Keuangan), risiko bencana BNPB InaRISK, dan statistik ketenagakerjaan BPS.',
  { ukuran: 8.2, warna: [205, 222, 240] });

  const kartu = [
    [C.hijau, angka(bab.length), o.jenis_dipilih ? 'komoditas / jenis dikaji' : 'komoditas & jenis unggulan'],
    [C.toska, angka(jumlahLokasi(o, bab)), 'lokasi prioritas'],
    [C.putih, o.zona.regulasi ? o.zona.regulasi.judul.replace(/^Peraturan Daerah Provinsi .+? (Nomor)/, 'Perda $1') : '-', 'acuan tata ruang laut'],
  ];
  kartu.forEach(([warna, nilai, label], i) => {
    const x = TEPI + i * 46;
    d.setFillColor(...warna);
    d.roundedRect(x, H - 42, 43, 22, 3, 3, 'F');
    dek.gaya(i === 2 ? 8.4 : 15, C.navy, true);
    d.text(d.splitTextToSize(bersih(nilai), 37).slice(0, 2), x + 4, H - 33.5);
    dek.gaya(6.4, i === 2 ? C.abu : gelap(C.navy, 1));
    d.text(bersih(label), x + 4, H - 24.4);
  });
  dek.gaya(7, [190, 212, 235]);
  d.text(`Diterbitkan ${tanggalPanjang(o.disusun)}`, TEPI, H - 9);

  const { x, y: yp, w, h } = SAMPUL;
  d.setFillColor(...C.putih);
  d.roundedRect(x, yp, w, h, 4, 4, 'F');
  dek.gambar(petaKanvas({ cakupan: o.wilayah.cakupan, batas: o.wilayah.batas, citra, lebar: SAMPUL.lebar, tinggi: SAMPUL.tinggi }),
    x + 2.4, yp + 2.4, w - 4.8, h - 4.8);
  dek.lencana(x + 8, yp + 1, 4.6, 'lokasi', '#40BFDB', true);
  dek.lencana(x + w - 4, yp + h - 7, 4.6, 'cari', '#0056A5', true);
  dek.pita(H - 2, 2);
}

function gambaranUmum(dek, o, bab) {
  const jenis = o.jenis_dipilih;
  const y = dek.slide({
    alis: 'Ringkasan',
    judul: `Gambaran Umum Investasi ${jenis ? `${jenis.nama} ` : ''}Provinsi ${o.wilayah.nama}`,
    sub: 'Kesimpulan dari keseluruhan isi dokumen ini.',
  });
  const tpt = o.sosial.ketenagakerjaan?.indikator?.tpt;
  dek.pitaAngka(TEPI, y, W - TEPI * 2, 25, [
    [angka(o.wilayah.luas_laut_km2), 'km² luas wilayah laut'],
    [`${o.wilayah.jumlah_kabkota_pesisir}/${o.wilayah.jumlah_kabkota}`, 'kabupaten/kota pesisir'],
    [angka(o.zona.total_ha), jenis ? `ha zona sesuai ${jenis.nama.toLowerCase()}` : 'ha zona pola ruang laut'],
    [angka(jumlahLokasi(o, bab)), 'lokasi prioritas diprofilkan'],
    tpt?.nilai != null && [`${angka(tpt.nilai, 2)}%`, `pengangguran terbuka (${tpt.tahun})`],
  ]);

  const yk = y + 30;
  const kiri = 168;
  const yAwal = dek.kartu(TEPI, yk, kiri, BAWAH - yk, { judul: 'Kesimpulan', ikon: 'kesimpulan' });
  const kolom = bab.length > 4 ? 2 : 1;
  const lebarKolom = (kiri - 10 - (kolom - 1) * 5) / kolom;
  const perKolom = Math.ceil(bab.length / kolom);
  let yy = yAwal;
  bab.forEach((b, n) => {
    if (n % perKolom === 0) yy = yAwal;
    const xk = TEPI + 5 + Math.floor(n / perKolom) * (lebarKolom + 5);
    const j = o.jenis[b.sektor];
    const k = b.komoditas && o.komoditas.find((x) => x.kode === b.kode);
    const ruang = `${angka(j.sesuai_ha)} ha zona sesuai (${angka(j.tinggi_ha)} ha kelas tinggi), ${j.lokasi.length} lokasi prioritas`;
    const isi = k
      ? `produksi ${k.tahun} ${angka(k.produksi_ton)} ton${senilai(k)}, peringkat ${k.peringkat_nasional} dari ${k.jumlah_provinsi} provinsi (${angka(k.pangsa_nasional_persen, 1)}% nasional); ${ruang}.`
      : `${ruang}.`;
    dek.doc.setFillColor(...rgb(aksenBab(b)));
    dek.doc.roundedRect(xk, yy - 3, 1.4, 6.6, 0.7, 0.7, 'F');
    dek.gaya(7.4, C.navy, true);
    dek.doc.text(bersih(b.nama), xk + 4, yy);
    yy = dek.teks(xk + 4, yy + 3.5, lebarKolom - 4, isi, { ukuran: 6.7, maks: kolom > 1 ? 3 : 2 }) + 2;
  });

  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  yy = dek.kartu(x, yk, lebar, 58, { judul: 'Isi dokumen', ikon: 'isi' });
  [['Zona pemanfaatan ruang laut', 3], ['Komoditas unggulan', 4], ...bab.map((b, i) => [b.nama, 5 + i * 5])].slice(0, 9).forEach(([nama, hal], i) => {
    const warna = i < 2 ? '#0056A5' : aksenBab(bab[i - 2]);
    dek.doc.setFillColor(...rgb(warna));
    dek.doc.circle(x + 6.2, yy - 1.1, 1.1, 'F');
    dek.gaya(7, C.teks, i >= 2);
    dek.doc.text(bersih(namaRapi(nama, 38)), x + 9.4, yy);
    dek.gaya(6.6, C.abu);
    dek.doc.text(`hal. ${hal}`, x + lebar - 5, yy, { align: 'right' });
    yy += 4.8;
  });
  yy = dek.kartu(x, yk + 62, lebar, BAWAH - yk - 62, { judul: 'Acuan tata ruang', ikon: 'hukum', aksen: '#1B6A8A' });
  dek.teks(x + 5, yy - 1, lebar - 10, regulasiTeks(o.zona), { ukuran: 6.8, maks: 3 });
  dek.sumber('Ringkasan ini merangkum halaman-halaman berikut; sumber setiap angka dicantumkan di kaki halaman masing-masing.');
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
    judul: jenis ? `Zona ${jenis.nama}` : 'Zona Pemanfaatan Ruang Laut',
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
      ? `Belum ada zona pola ruang laut yang sesuai untuk ${jenis.nama.toLowerCase()} di provinsi ini.`
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
  dek.doc.text(`Total ${angka(z.total_ha)} ha · ${z.peta.length} zona terluas di peta`.replace('·', '|'), x + 5, yt + tinggiLuas - 3.4);
  dek.sumber(`Sumber: pola ruang laut ${z.sumber_label}; dasar hukum: JDIH BPK (peraturan.bpk.go.id); oseanografi perairan ±22 km dari pantai: NOAA Coral Reef Watch (juga ditayangkan Sidako KKP), MODIS-Aqua, WaveWatch III via NOAA ERDDAP; ${ATRIBUSI_CITRA}.`);
}

function komoditasUnggulan(dek, o, bab) {
  const y = dek.slide({
    alis: 'Komoditas',
    judul: `Komoditas Unggulan ${o.wilayah.nama}`,
    sub: 'Hasil kelautan dan perikanan provinsi menurut produksi, nilai, dan ketersediaan ruang laut yang sesuai.',
  });
  const unggulan = o.komoditas.filter((k) => k.unggulan);
  if (!o.komoditas.length) {
    dek.tanda(TEPI, y, W - TEPI * 2, 'Data produksi perikanan BPS menurut komoditas untuk provinsi ini belum tersedia.');
  }
  const lebarKartu = (W - TEPI * 2 - 3 * 4) / 4;
  unggulan.forEach((k, i) => {
    const x = TEPI + i * (lebarKartu + 4);
    const aksen = warnaJenisInvestasi(k.sektor);
    const a = rgb(aksen);
    dek.angkaKartu(x, y, lebarKartu, 48, '', '', aksen);
    dek.pil(x + 4, y + 7.6, k.kelompok === 'BUDIDAYA' ? 'BUDIDAYA LAUT' : 'TANGKAP LAUT', a, C.putih, 5.4);
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

  const yb = y + (unggulan.length ? 53 : 14);
  const kiri = 172;
  let yy = dek.kartu(TEPI, yb, kiri, BAWAH - yb, { judul: 'Seluruh komoditas laut', ikon: 'komoditas' });
  if (o.komoditas.length) {
    dek.tabel(TEPI + 4, yy - 1, kiri - 8, ['Komoditas', 'Kelompok', 'Tahun', 'Produksi (ton)', 'Nilai (Rp)', 'Pangsa', 'Peringkat'],
      o.komoditas.slice(0, 10).map((k) => [k.nama, k.kelompok === 'BUDIDAYA' ? 'Budidaya laut' : 'Tangkap laut', k.tahun,
        angka(k.produksi_ton), rupiah(k.nilai_juta_rp), `${angka(k.pangsa_nasional_persen, 1)}%`, `${k.peringkat_nasional}/${k.jumlah_provinsi}`]),
      { bagian: [0.2, 0.17, 0.09, 0.16, 0.14, 0.11, 0.13], rataKanan: [2, 3, 4, 5, 6], ukuran: 6.5, batas: BAWAH - 3,
        sorot: o.komoditas.slice(0, 10).map((k, i) => (k.unggulan ? i : -1)).filter((i) => i >= 0) });
  }
  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  yy = dek.kartu(x, yb, lebar, BAWAH - yb, { judul: 'Jenis investasi lain', ikon: 'zona', aksen: '#1B6A8A' });
  const dipakai = new Set(bab.map((b) => b.kode));
  dek.batang(x + 5, yy, lebar - 10, o.jenis_lain.slice(0, 5).map((j) => ({
    label: namaRapi(j.nama, 30), nilai: j.tinggi_ha, teks: `${angka(j.tinggi_ha)} ha`, sorot: dipakai.has(j.kode),
  })), '#1B6A8A');
  if (o.komoditas.length) {
    dek.sumber(`Sumber: ${SUMBER_BPS()}. Unggulan (disorot) = 50% nilai produksi + 50% luas zona sesuai; hanya komoditas yang memanfaatkan ruang laut.`);
  }
}

function kajian(dek, o, b, i) {
  const j = o.jenis[b.sektor];
  const k = b.komoditas && o.komoditas.find((x) => x.kode === b.kode);
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: `Bab ${i + 1}  |  ${b.nama}`,
    judul: `Kajian ${b.nama}`,
    sub: k ? `${k.kelompok_label} di Provinsi ${o.wilayah.nama}` : `Jenis investasi di Provinsi ${o.wilayah.nama}`,
    aksen,
  });
  const kiri = 120;
  const lebarKartu = (kiri - 4) / 2;
  if (k) {
    [
      [angka(k.produksi_ton), `ton produksi ${k.tahun}`],
      [k.nilai_juta_rp == null ? '-' : formatRupiah(k.nilai_juta_rp * 1e6), `nilai produksi ${k.tahun}`],
      [`${angka(k.pangsa_nasional_persen, 1)}%`, 'pangsa produksi nasional'],
      [`${k.peringkat_nasional} / ${k.jumlah_provinsi}`, 'peringkat di antara provinsi produsen'],
      [k.pertumbuhan_persen == null ? '-' : `${angka(k.pertumbuhan_persen, 1)}%`, `pertumbuhan per tahun (${k.tahun_awal}–${k.tahun})`],
      [angka(k.harga_rp_kg), 'Rp/kg di tingkat produsen'],
    ].forEach(([n, l], c) => dek.angkaKartu(TEPI + (c % 2) * (lebarKartu + 4), y + Math.floor(c / 2) * 28, lebarKartu, 25, n, l, aksen));
    const yr = y + 84;
    let yy = dek.kartu(TEPI, yr, kiri, BAWAH - yr, { judul: 'Ruang laut tersedia', ikon: 'zona', aksen });
    dek.gaya(13, C.navy, true);
    dek.doc.text(angka(j.sesuai_ha), TEPI + 5, yy + 2);
    dek.doc.text(angka(j.tinggi_ha), TEPI + kiri / 2 + 2, yy + 2);
    dek.gaya(6.3, C.abu);
    dek.doc.text(`ha zona sesuai ${j.nama.toLowerCase()}`, TEPI + 5, yy + 6.2);
    dek.doc.text('ha berkelas kelayakan tinggi', TEPI + kiri / 2 + 2, yy + 6.2);

    const x = TEPI + kiri + 5;
    const lebar = W - TEPI - x;
    yy = dek.kartu(x, y, lebar, 74, { judul: 'Produksi per tahun (ton)', ikon: 'kajian', aksen });
    dek.gambar(grafikKanvas(k.seri, 'produksi_ton', aksen), x + 4, yy - 2, lebar - 8, (lebar - 8) * 0.43);
    yy = dek.kartu(x, y + 78, lebar, BAWAH - y - 78, { judul: 'Temuan', ikon: 'kesimpulan', aksen });
    dek.centang(x + 5, yy, lebar - 10, [
      `Produksi ${k.tahun} sebesar ${angka(k.produksi_ton)} ton atau ${angka(k.pangsa_nasional_persen, 1)}% produksi nasional, peringkat ${k.peringkat_nasional} dari ${k.jumlah_provinsi} provinsi.`,
      pertumbuhanTeks(k),
      hargaTeks(k),
    ], { aksen, ukuran: 7.3 });
    dek.sumber(`Sumber: ${SUMBER_BPS(k)}, ${k.tahun_awal}–${k.tahun}; analisis ruang laut aplikasi.`);
    return;
  }
  [
    [angka(j.sesuai_ha), 'ha zona sesuai tata ruang'],
    [angka(j.tinggi_ha), 'ha zona kelas kelayakan tinggi'],
    [angka(j.sedang_ha), 'ha zona kelas kelayakan sedang'],
    [angka(j.jumlah_zona_tinggi), 'zona berkelas kelayakan tinggi'],
  ].forEach(([n, l], c) => dek.angkaKartu(TEPI + (c % 2) * (lebarKartu + 4), y + Math.floor(c / 2) * 28, lebarKartu, 25, n, l, aksen));
  let yy = dek.kartu(TEPI, y + 56, kiri, 24, { judul: 'Deskripsi', ikon: 'kajian', aksen });
  dek.teks(TEPI + 5, yy - 0.6, kiri - 10, j.deskripsi || `Pemanfaatan ruang laut untuk kegiatan ${j.nama.toLowerCase()}.`, { ukuran: 7.4, maks: 2 });
  yy = dek.kartu(TEPI, y + 84, kiri, BAWAH - y - 84, { judul: 'Komposisi kelas kelayakan', ikon: 'zona', aksen });
  const rendah = Math.max(0, j.sesuai_ha - j.tinggi_ha - j.sedang_ha);
  [['Kelas tinggi', j.tinggi_ha, C.tinggi], ['Kelas sedang', j.sedang_ha, C.sedang], ['Kelas rendah', rendah, [220, 38, 38]]].forEach(([label, ha, warna]) => {
    const persen = j.sesuai_ha ? (ha / j.sesuai_ha) * 100 : 0;
    dek.gaya(6.8, C.teks);
    dek.doc.text(label, TEPI + 5, yy);
    dek.gaya(6.6, C.navy, true);
    dek.doc.text(`${angka(ha)} ha  |  ${angka(persen, 1)}%`, TEPI + kiri - 5, yy, { align: 'right' });
    dek.doc.setFillColor(...C.jalur);
    dek.doc.roundedRect(TEPI + 5, yy + 1.5, kiri - 10, 2, 1, 1, 'F');
    dek.doc.setFillColor(...warna);
    dek.doc.roundedRect(TEPI + 5, yy + 1.5, Math.max(2, ((kiri - 10) * persen) / 100), 2, 1, 1, 'F');
    yy += 7.6;
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
  dek.tanda(x + 5, yy + 2, lebar - 10, 'Statistik produksi publik untuk jenis investasi ini belum tersedia; kajian disusun dari ketersediaan ruang laut.');
  dek.sumber('Sumber: analisis kesesuaian ruang laut aplikasi; ketentuan pemanfaatan ruang per sub-zona.');
}

function lokasiSesuai(dek, o, b, i, citra) {
  const j = o.jenis[b.sektor];
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: `Bab ${i + 1}  |  ${b.nama}`,
    judul: `Lokasi Paling Sesuai: ${b.nama}`,
    sub: j.lokasi.length && !j.lokasi.some((l) => l.peruntukan_utama)
      ? `Rencana tata ruang laut Provinsi ${o.wilayah.nama} belum menetapkan zona peruntukan ${j.nama.toLowerCase()}; lokasi berikut zona yang membolehkannya secara bersyarat.`
      : `Zona ruang laut Provinsi ${o.wilayah.nama} yang sesuai untuk ${j.nama.toLowerCase()}, menurut kelas kelayakan.`,
    aksen,
  });
  const lebarPeta = 140;
  const tinggiPeta = lebarPeta * (PETA.tinggi / PETA.lebar);
  dek.kartu(TEPI, y, lebarPeta + 6, BAWAH - y);
  dek.gambar(petaKanvas({
    cakupan: o.wilayah.cakupan,
    batas: o.wilayah.batas,
    citra,
    lapisan: [{ fitur: j.peta, warna: (f) => warnaKelasKelayakan(f.kelas), isi: 0.7 }],
    titik: j.lokasi.map((l, n) => ({ titik: l.titik, warna: aksen, label: n + 1 })),
  }), TEPI + 3, y + 3, lebarPeta, tinggiPeta);
  dek.legenda(TEPI + 5, y + tinggiPeta + 8.4, lebarPeta, [
    { label: 'Kelas kelayakan tinggi', warna: warnaKelasKelayakan('TINGGI') },
    { label: 'Kelas kelayakan sedang', warna: warnaKelasKelayakan('SEDANG') },
    { label: 'Nomor lokasi', warna: aksen },
  ]);

  const x = TEPI + lebarPeta + 11;
  const lebar = W - TEPI - x;
  let yy = dek.kartu(x, y, lebar, BAWAH - y, { judul: 'Lokasi prioritas', ikon: 'lokasi', aksen });
  if (!j.lokasi.length) {
    dek.tanda(x + 5, yy, lebar - 10, `Belum ada zona sesuai berkelas kelayakan tinggi atau sedang untuk ${j.nama.toLowerCase()} di provinsi ini.`);
    return;
  }
  const d = dek.doc;
  j.lokasi.forEach((l, n) => {
    d.setFillColor(...rgb(aksen));
    d.circle(x + 7, yy - 0.2, 2.6, 'F');
    dek.gaya(6.8, C.putih, true);
    d.text(String(n + 1), x + 7, yy + 0.8, { align: 'center' });
    dek.gaya(7.4, C.navy, true);
    d.text(bersih(namaRapi(l.nama, 38)), x + 11.6, yy);
    const warnaKelas = l.kelas === 'TINGGI' ? C.tinggi : C.sedang;
    const teksKelas = LABEL_KELAS[l.kelas] || l.kelas;
    dek.gaya(5.6, gelap(warnaKelas, 0.8), true);
    const lebarPil = d.getTextWidth(teksKelas) + 3.6;
    dek.pil(x + lebar - 5 - lebarPil, yy, teksKelas, campur(warnaKelas, 0.16), gelap(warnaKelas, 0.8), 5.6);
    dek.gaya(6.4, C.abu);
    d.text(bersih(`${l.kabupaten || '-'}  |  ${angka(l.luas_ha, 1)} ha  |  skor ${angka(l.skor, 2)}${l.peruntukan_utama ? '' : '  |  kegiatan bersyarat'}`), x + 11.6, yy + 3.6);
    let yb = yy + 3.6;
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
    const catatan = [...l.keunggulan.slice(0, 1).map((t) => ['+', t]), ...l.pembatas.slice(0, 1).map((t) => ['-', t])];
    catatan.forEach(([tanda, t]) => {
      yb += 2.9;
      dek.gaya(6, tanda === '+' ? gelap(C.tinggi, 0.8) : [185, 28, 28]);
      d.text(d.splitTextToSize(bersih(`${tanda === '+' ? '+' : '!'} ${t}`), lebar - 18)[0], x + 11.6, yb);
    });
    yy = yb + 5.6;
    if (n < j.lokasi.length - 1) {
      d.setDrawColor(...C.garis);
      d.setLineWidth(0.15);
      d.line(x + 5, yy - 3.4, x + lebar - 5, yy - 3.4);
    }
  });
  dek.sumber(`Sumber: analisis kelayakan zona aplikasi (tata ruang KKP, KKPRL, infrastruktur, ekosistem, InaRISK, BPS); oseanografi NOAA${b.komoditas ? `; kesesuaian dinilai pada tingkat jenis ${j.nama.toLowerCase()}, belum syarat biofisik khusus ${b.nama.toLowerCase()}` : ''}; ${ATRIBUSI_CITRA}.`);
}

function finansialPasar(dek, o, b, i) {
  const k = b.komoditas && o.komoditas.find((x) => x.kode === b.kode);
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: `Bab ${i + 1}  |  ${b.nama}`,
    judul: `Analisis Finansial dan Pasar: ${b.nama}`,
    sub: `Provinsi ${o.wilayah.nama}`,
    aksen,
  });
  if (!k) {
    const d = dek.doc;
    dek.kartu(TEPI, y, W - TEPI * 2, BAWAH - y);
    const cx = W / 2;
    const yt = y + (BAWAH - y - 104) / 2;
    d.setFillColor(...campur(rgb(aksen), 0.14));
    d.circle(cx, yt + 18, 11, 'F');
    dek.lencana(cx, yt + 18, 7.4, 'finansial', aksen);
    dek.gaya(13, C.navy, true);
    d.text('Data pasar dan model usaha publik belum tersedia', cx, yt + 39, { align: 'center' });
    dek.gaya(8, C.abu);
    d.text(d.splitTextToSize(bersih(`Statistik produksi, harga, dan model usaha untuk ${b.nama.toLowerCase()} belum dipublikasikan dalam bentuk data terbuka yang dapat ditarik otomatis. Bagian ini akan terisi setelah acuan resmi tersedia.`), 170), cx, yt + 46, { align: 'center' });
    const lebar = 200;
    const x = cx - lebar / 2;
    const yy = dek.kartu(x, yt + 60, lebar, 38, { judul: 'Yang dibutuhkan untuk analisis finansial dan pasar', ikon: 'isi', aksen });
    dek.centang(x + 5, yy, lebar - 10, [
      'Data pasar: volume dan nilai permintaan, harga jual, dan tujuan pasar dari statistik resmi.',
      'Model usaha: biaya investasi awal, biaya operasional per tahun, dan pendapatan per satuan usaha.',
      'Asumsi kelayakan: umur proyek dan tingkat diskonto untuk menghitung nilai bersih sekarang (NPV), tingkat pengembalian internal (IRR), dan rasio manfaat-biaya (B/C).',
    ], { aksen, ukuran: 7.6 });
    return;
  }
  const kiri = 136;
  const [bagi, satuan, desimal] = k.seri.some((s) => s.nilai_juta_rp >= 1e6) ? [1e6, 'triliun', 2] : [1e3, 'miliar', 1];
  let yy = dek.kartu(TEPI, y, kiri, BAWAH - y, { judul: `Nilai produksi per tahun (Rp ${satuan})`, ikon: 'pasar', aksen });
  dek.gambar(grafikKanvas(k.seri.map((s) => ({ ...s, nilai: s.nilai_juta_rp == null ? null : s.nilai_juta_rp / bagi })), 'nilai', aksen, { desimal }),
    TEPI + 4, yy - 2, kiri - 8, (kiri - 8) * 0.43);
  dek.tabel(TEPI + 4, yy + (kiri - 8) * 0.43, kiri - 8, ['Tahun', 'Produksi (ton)', 'Nilai (Rp)', 'Rp/kg'],
    k.seri.slice(-5).map((s) => [s.tahun, angka(s.produksi_ton), rupiah(s.nilai_juta_rp), angka(s.harga_rp_kg)]),
    { bagian: [0.16, 0.3, 0.28, 0.26], rataKanan: [1, 2, 3], ukuran: 6.5, aksen });

  const x = TEPI + kiri + 5;
  const lebar = W - TEPI - x;
  const lebarHarga = (lebar - 4) / 2;
  dek.angkaKartu(x, y, lebarHarga, 24, angka(k.harga_rp_kg), `Rp/kg di ${o.wilayah.nama} (${k.tahun})`, aksen);
  dek.angkaKartu(x + lebarHarga + 4, y, lebarHarga, 24, angka(k.harga_nasional_rp_kg), `Rp/kg rata-rata nasional (${k.tahun})`, '#94a3b8');
  yy = dek.kartu(x, y + 28, lebar, 66, { judul: `Provinsi produsen utama ${k.tahun}`, ikon: 'pasar', aksen });
  const milik = k.provinsi_teratas.some((p) => p.provinsi.toLowerCase() === o.wilayah.nama.toLowerCase());
  yy = dek.batang(x + 5, yy, lebar - 10, [
    ...k.provinsi_teratas.map((p) => ({
      label: p.provinsi, nilai: p.produksi_ton, teks: `${angka(p.produksi_ton)} t  |  ${angka(p.pangsa_persen, 1)}%`,
      sorot: p.provinsi.toLowerCase() === o.wilayah.nama.toLowerCase(),
    })),
    !milik && { label: `${o.wilayah.nama} (#${k.peringkat_nasional})`, nilai: k.produksi_ton, teks: `${angka(k.produksi_ton)} t  |  ${angka(k.pangsa_nasional_persen, 1)}%`, sorot: true },
  ].filter(Boolean).slice(0, 6), aksen);
  dek.tanda(x, y + 98, lebar, 'Analisis finansial (biaya investasi, nilai bersih sekarang/NPV, tingkat pengembalian internal/IRR, rasio manfaat-biaya/B/C) memerlukan model usaha per komoditas dari sumber resmi; acuan tersebut belum tersedia di basis data.');
  dek.sumber(`Sumber: ${SUMBER_BPS(k)}; nilai per kilogram = nilai produksi dibagi volume produksi.`);
}

function sosialPekerja(dek, o, b, i) {
  const j = o.jenis[b.sektor];
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: `Bab ${i + 1}  |  ${b.nama}`,
    judul: `Sosial dan Tenaga Kerja: ${b.nama}`,
    sub: `Kondisi sosial pesisir Provinsi ${o.wilayah.nama} dan kebutuhan keahlian ${j.nama.toLowerCase()}.`,
    aksen,
  });
  const bps = o.sosial.ketenagakerjaan?.indikator || {};
  dek.pitaAngka(TEPI, y, W - TEPI * 2, 22, [
    bps.tpt?.nilai != null && [`${angka(bps.tpt.nilai, 2)}%`, `tingkat pengangguran terbuka (${bps.tpt.tahun})`],
    bps.pengangguran?.nilai != null && [angka(bps.pengangguran.nilai), `orang menganggur (${bps.pengangguran.tahun})`],
    [angka(o.wilayah.nelayan), 'nelayan di kabupaten/kota'],
    [angka(j.rasio_tk_per_miliar, 1), 'tenaga kerja per Rp1 miliar investasi'],
  ]);
  const yk = y + 26;
  const kiri = 150;
  let yy = dek.kartu(TEPI, yk, kiri, BAWAH - yk, { judul: 'Kabupaten/kota pesisir', ikon: 'sosial', aksen });
  const ySosial = dek.tabel(TEPI + 4, yy - 1, kiri - 8, ['Kabupaten/kota', 'Penduduk', 'Nelayan', 'RTP tangkap', 'DTKS (%)'],
    o.sosial.kabupaten.slice(0, 10).map((kb) => [kb.nama, angka(kb.penduduk), angka(kb.nelayan), angka(kb.rtp_tangkap), angka(kb.rasio_dtks, 1)]),
    { bagian: [0.34, 0.19, 0.16, 0.17, 0.14], rataKanan: [1, 2, 3, 4], ukuran: 6.5, batas: BAWAH - 2, aksen });
  dek.teks(TEPI + 4, ySosial + 2, kiri - 8,
    'RTP tangkap: rumah tangga perikanan tangkap. DTKS: Data Terpadu Kesejahteraan Sosial (Kementerian Sosial), persentase penduduk yang terdaftar.',
    { ukuran: 5.9, warna: C.abu });

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
  dek.sumber('Sumber: BPS (ketenagakerjaan provinsi), data sosial kabupaten/kota (BPS & KKP) pada basis data aplikasi, matriks keahlian per jenis investasi.');
}

function kesimpulanBab(dek, o, b, i) {
  const j = o.jenis[b.sektor];
  const k = b.komoditas && o.komoditas.find((x) => x.kode === b.kode);
  const aksen = aksenBab(b);
  const y = dek.slide({
    alis: `Bab ${i + 1}  |  ${b.nama}`,
    judul: `Kesimpulan: ${b.nama} Provinsi ${o.wilayah.nama}`,
    sub: 'Ringkasan bab dan langkah lanjut.',
    aksen,
  });
  const tpt = o.sosial.ketenagakerjaan?.indikator?.tpt;
  dek.pitaAngka(TEPI, y, W - TEPI * 2, 24, [
    k && [angka(k.produksi_ton), `ton produksi ${k.tahun}`],
    k && [`#${k.peringkat_nasional}`, `peringkat nasional dari ${k.jumlah_provinsi} provinsi`],
    [angka(j.sesuai_ha), 'ha zona ruang laut sesuai'],
    [angka(j.lokasi.length), 'lokasi prioritas'],
  ], gelap(rgb(aksen), 0.78));
  const yk = y + 28;
  const lebar = (W - TEPI * 2 - 5) / 2;
  let yy = dek.kartu(TEPI, yk, lebar, BAWAH - yk, { judul: 'Temuan', ikon: 'kesimpulan', aksen });
  dek.centang(TEPI + 5, yy, lebar - 10, [
    k && `Potensi: produksi ${k.tahun} ${angka(k.produksi_ton)} ton${senilai(k)}, ${angka(k.pangsa_nasional_persen, 1)}% produksi nasional.`,
    k && pertumbuhanTeks(k),
    `Ruang: ${angka(j.sesuai_ha)} ha zona sesuai untuk ${j.nama.toLowerCase()}, ${angka(j.tinggi_ha)} ha berkelas kelayakan tinggi${j.lokasi[0] ? `; terluas ${namaRapi(j.lokasi[0].nama, 36)} (${j.lokasi[0].kabupaten})` : ''}.`,
    k && hargaTeks(k),
    tpt?.nilai != null && `Tenaga kerja: pengangguran terbuka provinsi ${angka(tpt.nilai, 2)}% (${tpt.tahun}); setiap Rp1 miliar investasi menyerap sekitar ${angka(j.rasio_tk_per_miliar, 1)} tenaga kerja.`,
  ], { aksen, ukuran: 8.4 });
  const x = TEPI + lebar + 5;
  yy = dek.kartu(x, yk, lebar, BAWAH - yk, { judul: 'Langkah lanjut', ikon: 'isi', aksen });
  dek.nomor(x + 5, yy, lebar - 10, [
    'Verifikasi lapangan lokasi prioritas dan pastikan tidak tumpang tindih dengan izin kesesuaian kegiatan pemanfaatan ruang laut (KKPRL) yang telah terbit maupun bangunan atau struktur yang sudah berdiri.',
    j.lokasi.some((l) => l.pembatas.length) && 'Kaji faktor pembatas lokasi (risiko bencana, ekosistem sensitif, sosial) sebelum penetapan.',
    k ? `Lengkapi model usaha ${b.nama.toLowerCase()} dari sumber resmi untuk analisis finansial.` : 'Lengkapi data pasar dan model usaha dari sumber resmi untuk analisis finansial.',
    'Siapkan pelatihan untuk posisi berprioritas tinggi pada matriks keahlian.',
  ], { aksen, ukuran: 8.4 });
  dek.sumber('Kesimpulan disusun otomatis dari halaman kajian, lokasi, pasar, dan sosial pada bab ini; angka luas dan lokasi bersifat indikatif.');
}

export function buatProfil(o, citra = {}) {
  const jenis = o.jenis_dipilih;
  const dek = new Dek(`Profil Investasi ${jenis ? `${jenis.nama} ` : ''}Provinsi ${o.wilayah.nama}`);
  const bab = o.bab;
  sampul(dek, o, bab, citra.sampul);
  gambaranUmum(dek, o, bab);
  zonaRuang(dek, o, citra.peta);
  komoditasUnggulan(dek, o, bab);
  bab.forEach((b, i) => {
    kajian(dek, o, b, i);
    lokasiSesuai(dek, o, b, i, citra.peta);
    finansialPasar(dek, o, b, i);
    sosialPekerja(dek, o, b, i);
    kesimpulanBab(dek, o, b, i);
  });
  return dek.doc;
}

export async function unduhProfil(provinsiId, jenis) {
  const [{ data }] = await Promise.all([
    api.get(`/inti/provinsi/${provinsiId}/profil-investasi/`, { params: jenis ? { jenis } : {} }),
    siapkanAsetPdf(),
    siapkanIkon(),
    document.fonts?.load('700 28px "Public Sans"'),
  ]);
  const cakupan = data.wilayah.cakupan;
  const [sampulCitra, peta] = cakupan
    ? await Promise.all([SAMPUL, PETA].map(({ lebar, tinggi }) => muatCitra(luasPeta(cakupan, lebar, tinggi), lebar, tinggi)))
    : [];
  const doc = buatProfil(data, { sampul: sampulCitra, peta });
  const nama = `${data.jenis_dipilih ? `${data.jenis_dipilih.nama}-` : ''}${data.wilayah.nama}`.toLowerCase().replace(/[^\w]+/g, '-');
  doc.save(`profil-investasi-${nama}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
