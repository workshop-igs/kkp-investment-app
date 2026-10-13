import api from '../api/klien';
import { warnaInfrastruktur } from '../components/map/katalogLapisan';
import { KATEGORI_RTRL, kategoriZona, warnaKelasRisiko, warnaZona } from './simbologiPeta';

const LEBAR_PX = 1370;
const TINGGI_PX = 669;

export const RASIO_PANEL = TINGGI_PX / LEBAR_PX;

const CAKUPAN_MIN = 0.004;
const KELIPATAN_AOI = 3;

const LAUT = '#eef6fb';
const CITRA_URL = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export';
export const ATRIBUSI_CITRA = 'Citra dasar: Esri World Imagery';
const ALAS_ISI = 'rgba(147, 183, 211, 0.30)';
const AOI_GARIS = 'rgba(185, 28, 28, 0.6)';
const AOI_HALO = 'rgba(255, 255, 255, 0.4)';
const AOI_ISI = 'rgba(185, 28, 28, 0.14)';

const PANEL = {
  tata_ruang: {
    url: '/inventarisasi/zonasi/peta/',
    params: { ranah: 'SEMUA' },
    warna: (p) => warnaZona(p.kategori),
    label: (p) => kategoriZona(p.kategori).label,
    isi: 0.38,
  },
  kkprl: {
    url: '/inventarisasi/kkprl/peta/',
    warna: () => '#10b981',
    label: () => 'Izin KKPRL terbit',
    isi: 0.45,
  },
  bencana: {
    url: '/analitik/zona-risiko/peta/',
    warna: (p) => warnaKelasRisiko(p.kelas),
    label: (p) => `${p.jenis_label || 'Bahaya'} - ${p.kelas_label || p.kelas || '-'}`,
    isi: 0.45,
  },
  unsur: {
    url: '/inventarisasi/unsur-ruang/peta/',
    params: { kelompok: 'RTRL' },
    warna: (p) => (KATEGORI_RTRL[p.jenis_kode] || KATEGORI_RTRL.LAINNYA).warna,
    label: (p) => (KATEGORI_RTRL[p.jenis_kode] || KATEGORI_RTRL.LAINNYA).label,
    isi: 0.18,
  },
  infrastruktur: {
    url: '/inventarisasi/infrastruktur/peta/',
    warna: (p) => warnaInfrastruktur(p.kategori),
    label: (p) => p.kategori_label || 'Infrastruktur',
    isi: 0.3,
  },
};

function kotak(koordinat) {
  const k = [Infinity, Infinity, -Infinity, -Infinity];
  const telusuri = (c) => {
    if (typeof c[0] === 'number') {
      k[0] = Math.min(k[0], c[0]);
      k[1] = Math.min(k[1], c[1]);
      k[2] = Math.max(k[2], c[0]);
      k[3] = Math.max(k[3], c[1]);
      return;
    }
    c.forEach(telusuri);
  };
  telusuri(koordinat);
  return k;
}

function cakupan(kotakAoi) {
  const [x0, y0, x1, y1] = kotakAoi;
  const pusatX = (x0 + x1) / 2;
  const pusatY = (y0 + y1) / 2;
  const kos = Math.max(0.1, Math.cos((pusatY * Math.PI) / 180));

  const tinggi = Math.max(CAKUPAN_MIN, (y1 - y0) * KELIPATAN_AOI, ((x1 - x0) * kos * KELIPATAN_AOI * TINGGI_PX) / LEBAR_PX);
  const lebar = (tinggi * LEBAR_PX) / TINGGI_PX / kos;

  return [pusatX - lebar / 2, pusatY - tinggi / 2, pusatX + lebar / 2, pusatY + tinggi / 2];
}

export function muatCitra(ext, lebar = LEBAR_PX, tinggi = TINGGI_PX) {
  const url = `${CITRA_URL}?bbox=${ext.join(',')}&bboxSR=4326&size=${lebar},${tinggi}`
    + '&imageSR=4326&format=jpg&f=image';
  return new Promise((selesai) => {
    const g = new Image();
    g.crossOrigin = 'anonymous';
    g.onload = () => selesai(g);
    g.onerror = () => selesai(null);
    g.src = url;
  });
}

export function gambarGeometri(ctx, geom, proyeksi, gaya) {
  if (!geom) return;
  const { type, coordinates } = geom;
  const cincin = (simpul) => {
    simpul.forEach((titik, i) => {
      const [x, y] = proyeksi(titik);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  };

  const poligon = (poly) => {
    ctx.beginPath();
    poly.forEach(cincin);
    ctx.closePath();
    if (gaya.isi) {
      ctx.fillStyle = gaya.isi;
      ctx.fill('evenodd');
    }
    ctx.strokeStyle = gaya.garis;
    ctx.lineWidth = gaya.tebal;
    ctx.stroke();
  };

  const garis = (line) => {
    ctx.beginPath();
    cincin(line);
    ctx.strokeStyle = gaya.garis;
    ctx.lineWidth = Math.max(2, gaya.tebal);
    ctx.stroke();
  };

  const titik = (pt) => {
    const [x, y] = proyeksi(pt);
    ctx.beginPath();
    ctx.arc(x, y, gaya.radius || 5, 0, Math.PI * 2);
    ctx.fillStyle = gaya.garis;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  if (type === 'Polygon') poligon(coordinates);
  else if (type === 'MultiPolygon') coordinates.forEach(poligon);
  else if (type === 'LineString') garis(coordinates);
  else if (type === 'MultiLineString') coordinates.forEach(garis);
  else if (type === 'Point') titik(coordinates);
  else if (type === 'MultiPoint') coordinates.forEach(titik);
}

function labelSkala(km) {
  return km < 1
    ? `${Math.round(km * 1000).toLocaleString('id-ID')} m`
    : `${km.toLocaleString('id-ID')} km`;
}

export function gambarSkala(ctx, derajatPerPx, lintang, lebar = LEBAR_PX, tinggi = TINGGI_PX) {
  const kmPerPx = derajatPerPx * 111.32 * Math.cos((lintang * Math.PI) / 180);
  const maksKm = kmPerPx * lebar * 0.3;
  const pangkat = 10 ** Math.floor(Math.log10(maksKm));
  const km = [5, 2, 1].map((m) => m * pangkat).find((v) => v <= maksKm) || pangkat;
  const px = km / kmPerPx;

  const x = 24;
  const y = tinggi - 26;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(x - 10, y - 24, px + 20, 40);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + px, y);
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + 6);
  ctx.moveTo(x + px, y - 6);
  ctx.lineTo(x + px, y + 6);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(labelSkala(km), x, y - 10);
}

export function gambarUtara(ctx, lebar = LEBAR_PX) {
  const x = lebar - 46;
  const y = 40;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(x - 22, y - 18, 44, 72);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 9, y + 24);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x - 9, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('U', x, y + 44);
  ctx.textAlign = 'left';
}

function susunPanel(fitur, panel, geomAoi, ext, fiturAlas, citra) {
  const [x0, y0, x1, y1] = ext;
  const kanvas = document.createElement('canvas');
  kanvas.width = LEBAR_PX;
  kanvas.height = TINGGI_PX;
  const ctx = kanvas.getContext('2d');

  if (citra) {
    ctx.drawImage(citra, 0, 0, LEBAR_PX, TINGGI_PX);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, LEBAR_PX, TINGGI_PX);
  } else {
    ctx.fillStyle = LAUT;
    ctx.fillRect(0, 0, LEBAR_PX, TINGGI_PX);
  }

  const proyeksi = ([lon, lat]) => [
    ((lon - x0) / (x1 - x0)) * LEBAR_PX,
    ((y1 - lat) / (y1 - y0)) * TINGGI_PX,
  ];

  if (!citra) {
    (fiturAlas || []).forEach((f) => {
      gambarGeometri(ctx, f.geometry, proyeksi, { garis: 'rgba(0,0,0,0)', isi: ALAS_ISI, tebal: 0 });
    });
  }

  const legenda = new Map();
  fitur.forEach((f) => {
    const p = f.properties || {};
    const warna = panel.warna(p) || '#64748b';
    legenda.set(panel.label(p), warna);
    gambarGeometri(ctx, f.geometry, proyeksi, {
      garis: warna,
      isi: panel.isi ? warnaTransparan(warna, panel.isi) : null,
      tebal: citra ? 2.4 : 1.6,
    });
  });

  if (citra) {
    gambarGeometri(ctx, geomAoi, proyeksi, { garis: AOI_HALO, isi: null, tebal: 8 });
  }
  gambarGeometri(ctx, geomAoi, proyeksi, { garis: AOI_GARIS, isi: AOI_ISI, tebal: 3.5 });

  gambarSkala(ctx, (y1 - y0) / TINGGI_PX, (y0 + y1) / 2);
  gambarUtara(ctx);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, LEBAR_PX - 2, TINGGI_PX - 2);

  return {
    gambar: citra ? kanvas.toDataURL('image/jpeg', 0.85) : kanvas.toDataURL('image/png'),
    format: citra ? 'JPEG' : 'PNG',
    citra: !!citra,
    legenda: [...legenda].map(([label, warna]) => ({ label, warna })),
    jumlah: fitur.length,
  };
}

function warnaTransparan(hex, alfa) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return `rgba(100, 116, 139, ${alfa})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

export async function siapkanPetaLaporan(geometry) {
  if (!geometry?.coordinates || typeof document === 'undefined') return {};

  const ext = cakupan(kotak(geometry.coordinates));
  const bbox = ext.map((v) => v.toFixed(4)).join(',');

  const [citra, terambil] = await Promise.all([
    muatCitra(ext),
    Promise.all(
      Object.entries(PANEL).map(async ([kunci, panel]) => {
        try {
          const { data } = await api.get(panel.url, { params: { ...panel.params, bbox } });
          return [kunci, (data?.features || []).filter((f) => f.geometry)];
        } catch {
          return [kunci, null];
        }
      })
    ),
  ]);

  const fitur = Object.fromEntries(terambil);
  const alas = fitur.tata_ruang || [];

  return Object.fromEntries(
    Object.entries(PANEL).map(([kunci, panel]) => [
      kunci,
      fitur[kunci] === null
        ? null
        : susunPanel(fitur[kunci], panel, geometry, ext, kunci === 'tata_ruang' ? null : alas, citra),
    ])
  );
}

export default siapkanPetaLaporan;
