import { ambilOseanografi } from '../components/map/LegendaPeta';
import { SECTORS } from './konstanta';
import { bersih, siapkanAsetPdf } from './pdfLaporan';
import { BAWAH, C, Dek, TEPI, W, rgb } from './pdfProfilInvestasi';
import { gambarSkala, gambarUtara } from './petaLaporan';
import {
  GARIS_KAWASAN,
  KATEGORI_RTRL,
  KATEGORI_ZONA,
  KELAS_KELAYAKAN,
  KELAS_RISIKO,
  URUTAN_KATEGORI,
  URUTAN_KATEGORI_DARAT,
  URUTAN_KELAS_RISIKO,
  URUTAN_RTRL,
  WARNA_JENIS_INVESTASI,
} from './simbologiPeta';

const SKALA = 2;
const LEBAR_LEGENDA = 60;
const JARAK_KOLOM = 6;

const muatGambar = (src) =>
  new Promise((selesai, gagal) => {
    const g = new Image();
    g.onload = () => selesai(g);
    g.onerror = gagal;
    g.src = src;
  });

const zIndeks = (el) => Number.parseInt(getComputedStyle(el).zIndex, 10) || 0;

const asing = (img) => img.crossOrigin === null && new URL(img.src, location.href).origin !== location.origin;

async function gambarElemen(ctx, el, wadah, alfa, cacheSvg) {
  if (el.classList.contains('leaflet-popup-pane')) return;
  const gaya = getComputedStyle(el);
  if (gaya.display === 'none' || gaya.visibility === 'hidden') return;
  const a = alfa * Number(gaya.opacity);
  if (!a) return;

  const r = el.getBoundingClientRect();
  const x = r.left - wadah.left;
  const y = r.top - wadah.top;
  const daun = el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || el instanceof SVGSVGElement;
  if (daun && (x > wadah.width || y > wadah.height || x + r.width < 0 || y + r.height < 0)) return;
  ctx.globalAlpha = a;

  if (el instanceof HTMLImageElement) {
    if (el.complete && el.naturalWidth && !asing(el)) ctx.drawImage(el, x, y, r.width, r.height);
    return;
  }
  if (el instanceof HTMLCanvasElement) {
    ctx.drawImage(el, x, y, r.width, r.height);
    return;
  }
  if (el instanceof SVGSVGElement) {
    const kopi = el.cloneNode(true);
    kopi.removeAttribute('style');
    const isi = new XMLSerializer().serializeToString(kopi);
    if (!cacheSvg.has(isi)) {
      const url = URL.createObjectURL(new Blob([isi], { type: 'image/svg+xml' }));
      cacheSvg.set(isi, muatGambar(url).finally(() => URL.revokeObjectURL(url)));
    }
    const g = await cacheSvg.get(isi).catch(() => null);
    ctx.globalAlpha = a;
    if (g) ctx.drawImage(g, x, y, r.width, r.height);
    return;
  }

  const garis = Number.parseFloat(gaya.borderTopWidth) || 0;
  if (gaya.backgroundColor !== 'rgba(0, 0, 0, 0)' || garis) {
    ctx.beginPath();
    ctx.roundRect(x, y, r.width, r.height, Number.parseFloat(gaya.borderTopLeftRadius) || 0);
    ctx.fillStyle = gaya.backgroundColor;
    ctx.fill();
    if (garis) {
      ctx.lineWidth = garis;
      ctx.strokeStyle = gaya.borderTopColor;
      ctx.stroke();
    }
  }
  el.childNodes.forEach((n) => {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent.trim()) return;
    const rentang = document.createRange();
    rentang.selectNodeContents(n);
    const k = rentang.getBoundingClientRect();
    ctx.font = `${gaya.fontWeight} ${gaya.fontSize} ${gaya.fontFamily}`;
    ctx.fillStyle = gaya.color;
    ctx.textBaseline = 'middle';
    ctx.fillText(n.textContent.trim(), k.left - wadah.left, k.top - wadah.top + k.height / 2);
  });

  const anak = [...el.children].map((c, i) => [c, zIndeks(c), i]).sort((p, q) => p[1] - q[1] || p[2] - q[2]);
  for (const [c] of anak) await gambarElemen(ctx, c, wadah, a, cacheSvg);
}

export async function potretPeta(map) {
  const elemen = map.getContainer();
  const wadah = elemen.getBoundingClientRect();
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(wadah.width * SKALA);
  kanvas.height = Math.round(wadah.height * SKALA);
  const ctx = kanvas.getContext('2d');
  ctx.scale(SKALA, SKALA);
  ctx.fillStyle = getComputedStyle(elemen).backgroundColor;
  ctx.fillRect(0, 0, wadah.width, wadah.height);

  await gambarElemen(ctx, map.getPane('mapPane'), wadah, 1, new Map());

  ctx.globalAlpha = 1;
  gambarSkala(ctx, 360 / (256 * 2 ** map.getZoom()), map.getCenter().lat, wadah.width, wadah.height);
  gambarUtara(ctx, wadah.width);
  return { data: kanvas.toDataURL('image/jpeg', 0.9), lebar: wadah.width, tinggi: wadah.height };
}

const angka = (v) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const derajat = (v, positif, negatif) => `${angka(Math.abs(v))}° ${v < 0 ? negatif : positif}`;

const kotak = (urutan, kamus) => urutan.map((k) => ({ warna: kamus[k].warna, label: kamus[k].label }));

function itemLegenda(def, osea) {
  switch (def.legenda) {
    case 'zona':
      return [
        ...kotak(URUTAN_KATEGORI, KATEGORI_ZONA),
        ...GARIS_KAWASAN.map(({ label, tebal, pola, warna }) => ({
          label, warna, garis: { tebal, putus: { dashed: [1.4, 0.9], dotted: [0.35, 0.7] }[pola] },
        })),
      ];
    case 'zona_darat':
      return kotak(URUTAN_KATEGORI_DARAT, KATEGORI_ZONA);
    case 'risiko':
      return kotak(URUTAN_KELAS_RISIKO, KELAS_RISIKO);
    case 'rtrl':
      return URUTAN_RTRL.map((k) => {
        const r = KATEGORI_RTRL[k];
        return { label: r.label, warna: r.warna, garis: { tebal: r.tebal, putus: r.garis?.split(',').map((v) => v * 0.25) } };
      });
    case 'jenis':
      return [...SECTORS.map((s) => [s.id, s.label]), ['LAINNYA', 'Kegiatan lain']]
        .map(([k, label]) => ({ warna: WARNA_JENIS_INVESTASI[k], label }));
    case 'disarankan':
      return [
        ...def.params.kelas.split(',').map((k) => ({ warna: KELAS_KELAYAKAN[k].warna, label: KELAS_KELAYAKAN[k].label, bulat: true })),
        { warna: KELAS_KELAYAKAN.TINGGI.warna, label: 'Batas zona, tampak setelah peta diperbesar' },
      ];
    case 'gradasi':
      return osea?.parameter?.[def.citra]
        ? [{ gradasi: osea.parameter[def.citra], label: def.keteranganLegenda }]
        : [{ label: 'Data lapisan ini belum tersedia di server.' }];
    default:
      return [{ warna: def.warnaContoh, label: def.keteranganLegenda }];
  }
}

function batangGradasi(dek, info, x, y, lebar) {
  const d = dek.doc;
  const posisi = info.skala.map(([v]) => (info.log ? Math.log10(v) : v));
  const awal = posisi[0];
  const rentang = posisi[posisi.length - 1] - awal;
  const ruas = 60;
  for (let i = 0; i < ruas; i += 1) {
    const p = awal + (rentang * (i + 0.5)) / ruas;
    const j = Math.max(1, posisi.findIndex((q) => q >= p));
    const t = (p - posisi[j - 1]) / (posisi[j] - posisi[j - 1] || 1);
    const a = rgb(info.skala[j - 1][1]);
    const b = rgb(info.skala[j][1]);
    d.setFillColor(...a.map((c, k) => Math.round(c + (b[k] - c) * t)));
    d.rect(x + (lebar * i) / ruas, y, lebar / ruas + 0.05, 2.4, 'F');
  }
  const tengah = info.log ? 10 ** (awal + rentang / 2) : info.skala[0][0] + rentang / 2;
  dek.gaya(5.8, C.teks);
  d.text(angka(info.skala[0][0]), x, y + 5);
  d.text(angka(tengah), x + lebar / 2, y + 5, { align: 'center' });
  d.text(`${angka(info.skala[info.skala.length - 1][0])} ${bersih(info.satuan)}`, x + lebar, y + 5, { align: 'right' });
}

function susunLegenda(dek, lapisan, osea, x0, y0) {
  const d = dek.doc;
  let x = x0;
  let y = y0;
  let atas = y0;
  const ruang = (tinggi) => {
    if (y + tinggi <= BAWAH - 3) return;
    x += LEBAR_LEGENDA + JARAK_KOLOM;
    if (x + LEBAR_LEGENDA > W - TEPI) {
      atas = dek.slide({ alis: 'Cetak Peta', judul: 'Legenda (lanjutan)' });
      x = TEPI;
    }
    y = atas;
  };

  if (!lapisan.length) {
    dek.teks(x, y + 2.4, LEBAR_LEGENDA, 'Tidak ada layer data yang aktif; peta hanya menampilkan peta dasar.', { ukuran: 6.4, warna: C.abu });
    return;
  }

  lapisan.forEach(({ def, sektor }) => {
    dek.gaya(6.6, C.navy, true);
    const judul = d.splitTextToSize(bersih(def.label).toUpperCase(), LEBAR_LEGENDA);
    ruang(judul.length * 2.9 + 6);
    dek.gaya(6.6, C.navy, true);
    d.text(judul, x, y + 2.4);
    y += judul.length * 2.9 + 1.4;

    if ('sektor' in (def.params || {})) {
      const kode = sektor || def.params.sektor;
      dek.gaya(6.2, C.teks);
      d.text(bersih(`Jenis investasi: ${SECTORS.find((s) => s.id === kode)?.label || kode}`), x, y + 2.2);
      y += 3.6;
    }

    itemLegenda(def, osea).forEach((it) => {
      if (it.gradasi) {
        dek.gaya(5.8, C.abu);
        const ket = d.splitTextToSize(bersih(`${it.label || ''} Periode data: ${it.gradasi.periode}.`), LEBAR_LEGENDA);
        ruang(9 + ket.length * 2.4);
        batangGradasi(dek, it.gradasi, x, y + 0.6, LEBAR_LEGENDA);
        y += 8;
        dek.gaya(5.8, C.abu);
        d.text(ket, x, y + 1.8);
        y += ket.length * 2.4 + 1;
        return;
      }
      dek.gaya(6.2, C.teks);
      const geser = it.warna ? 6 : 0;
      const baris = d.splitTextToSize(bersih(it.label), LEBAR_LEGENDA - geser);
      const tinggi = baris.length * 2.6 + 1.2;
      ruang(tinggi);
      dek.gaya(6.2, C.teks);
      if (it.garis) {
        d.setDrawColor(...rgb(it.warna));
        d.setLineWidth(Math.max(0.25, it.garis.tebal * 0.22));
        d.setLineDashPattern(it.garis.putus || [], 0);
        d.line(x, y + 1.6, x + 4.6, y + 1.6);
        d.setLineDashPattern([], 0);
      } else if (it.warna) {
        d.setFillColor(...rgb(it.warna));
        if (it.bulat) d.circle(x + 1.6, y + 1.5, 1.4, 'F');
        else d.roundedRect(x, y, 3.2, 3.2, 0.7, 0.7, 'F');
      }
      d.text(baris, x + geser, y + 2.4);
      y += tinggi;
    });
    y += 2.6;
  });
}

export async function unduhPdfPeta(map, { lapisan, petaDasar }) {
  const [, citra, osea] = await Promise.all([
    siapkanAsetPdf(),
    potretPeta(map),
    lapisan.some(({ def }) => def.legenda === 'gradasi') ? ambilOseanografi().catch(() => null) : null,
  ]);

  const b = map.getBounds();
  const waktu = new Date();
  const dek = new Dek('Peta Spasial');
  const atas = dek.slide({
    alis: 'Cetak Peta',
    judul: 'Peta Spasial Ruang Laut',
    sub: `Diunduh ${waktu.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} | cakupan `
      + `${derajat(b.getWest(), 'BT', 'BB')} - ${derajat(b.getEast(), 'BT', 'BB')}, `
      + `${derajat(b.getSouth(), 'LU', 'LS')} - ${derajat(b.getNorth(), 'LU', 'LS')} | peta dasar ${petaDasar.name}`,
  });

  const maksLebar = W - TEPI * 2 - LEBAR_LEGENDA - JARAK_KOLOM;
  const maksTinggi = BAWAH - 3 - atas;
  const rasio = citra.lebar / citra.tinggi;
  const lebar = Math.min(maksLebar, maksTinggi * rasio);
  const tinggi = lebar / rasio;
  dek.gambar(citra.data, TEPI, atas, lebar, tinggi);
  dek.doc.setDrawColor(...C.garis);
  dek.doc.setLineWidth(0.3);
  dek.doc.rect(TEPI, atas, lebar, tinggi, 'S');

  const sumberData = [...new Set(lapisan.map(({ def }) => (def.citra ? 'NOAA (lewat ERDDAP)' : 'Portal Satu Data KKP')))];
  dek.sumber(`Sumber: ${sumberData.length ? `${sumberData.join(' dan ')}; ` : ''}peta dasar ${petaDasar.sumber}. Isi peta sama dengan tampilan layar saat diunduh.`);

  susunLegenda(dek, lapisan, osea, TEPI + lebar + JARAK_KOLOM, atas);

  const cap = waktu.toLocaleString('sv-SE').slice(0, 16).replace(/[ :]/g, '-');
  dek.doc.save(`peta-spasial-${cap}.pdf`);
}
