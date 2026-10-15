const SUMBU_PANJANG = 6378137.0;
const PEMIPIHAN = 1 / 298.257223563;
const SUMBU_PENDEK = (1 - PEMIPIHAN) * SUMBU_PANJANG;

const RAD = Math.PI / 180;

const CAKUPAN_INDONESIA = { latMin: -11.5, latMaks: 6.5, lngMin: 94.0, lngMaks: 141.5 };

const diDalamIndonesia = (lat, lng) =>
  lat >= CAKUPAN_INDONESIA.latMin &&
  lat <= CAKUPAN_INDONESIA.latMaks &&
  lng >= CAKUPAN_INDONESIA.lngMin &&
  lng <= CAKUPAN_INDONESIA.lngMaks;

const ARAH = {
  N: { sumbu: 'lat', tanda: 1 },
  S: { sumbu: 'lat', tanda: -1 },
  E: { sumbu: 'lng', tanda: 1 },
  W: { sumbu: 'lng', tanda: -1 },
  LU: { sumbu: 'lat', tanda: 1 },
  LS: { sumbu: 'lat', tanda: -1 },
  BT: { sumbu: 'lng', tanda: 1 },
  BB: { sumbu: 'lng', tanda: -1 },
};

const POLA_ARAH = /(?:^|[^A-Z])(LU|LS|BT|BB|[NSEW])(?![A-Z])/g;

const belahDua = (teks) => {
  const jumlahKoma = (teks.match(/,/g) || []).length;
  if (teks.includes(';')) return teks.split(';');
  if (jumlahKoma === 1) return teks.split(',');

  POLA_ARAH.lastIndex = 0;
  const besar = teks.toUpperCase();
  const arah = [];
  let m;
  while ((m = POLA_ARAH.exec(besar)) !== null) {
    arah.push({ mulai: m.index + m[0].length - m[1].length, akhir: m.index + m[0].length });
    POLA_ARAH.lastIndex = m.index + m[0].length;
  }

  if (arah.length === 2) {
    const adaAngkaSebelum = /\d/.test(teks.slice(0, arah[0].mulai));
    const potong = adaAngkaSebelum ? arah[0].akhir : arah[1].mulai;
    return [teks.slice(0, potong), teks.slice(potong)];
  }

  if (jumlahKoma >= 2) return teks.split(/[;/]/);
  return teks.split(/\s+/);
};

const uraiBagian = (potongan) => {
  const t = potongan.trim().toUpperCase();
  if (!t) return null;

  let sumbu = null;
  let tanda = 1;
  const cocokArah = t.match(/(^|[^A-Z])(LU|LS|BT|BB|[NSEW])([^A-Z]|$)/);
  if (cocokArah) {
    const a = ARAH[cocokArah[2]];
    sumbu = a.sumbu;
    tanda = a.tanda;
  }

  const angka = (t.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (!angka.length) return null;

  const negatifEksplisit = angka[0] < 0;
  const d = Math.abs(angka[0]);
  const m = angka.length > 1 ? angka[1] : 0;
  const s = angka.length > 2 ? angka[2] : 0;

  if (m < 0 || m >= 60 || s < 0 || s >= 60) return { galat: 'Menit dan detik harus 0–59.' };

  let nilai = d + m / 60 + s / 3600;
  if (negatifEksplisit) nilai = -nilai;
  else nilai *= tanda;

  return { nilai, sumbu };
};

export function uraiKoordinat(teks) {
  if (!teks || !String(teks).trim()) return { galat: 'Masukkan koordinat terlebih dahulu.' };

  const bagian = belahDua(String(teks).trim()).filter((b) => b && b.trim());
  if (bagian.length !== 2) {
    return { galat: 'Format tidak dikenali. Contoh: -6.2, 106.8 atau 6°12\'30"S 106°48\'15"E' };
  }

  const a = uraiBagian(bagian[0]);
  const b = uraiBagian(bagian[1]);
  if (!a || !b) return { galat: 'Angka koordinat tidak terbaca.' };
  if (a.galat || b.galat) return { galat: a.galat || b.galat };

  let lat;
  let lng;
  if (a.sumbu === 'lng' || b.sumbu === 'lat') {
    lat = b.nilai;
    lng = a.nilai;
  } else {
    lat = a.nilai;
    lng = b.nilai;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { galat: 'Angka koordinat tidak terbaca.' };
  if (Math.abs(lat) > 90) return { galat: `Lintang ${lat} di luar rentang −90 s.d. 90.` };
  if (Math.abs(lng) > 180) return { galat: `Bujur ${lng} di luar rentang −180 s.d. 180.` };

  return { lat, lng, diIndonesia: diDalamIndonesia(lat, lng) };
}

const angkaID = (n, desimal = 0) =>
  n.toLocaleString('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal });

export function keDMS(nilai, sumbu) {
  const arah = sumbu === 'lat' ? (nilai < 0 ? 'LS' : 'LU') : nilai < 0 ? 'BB' : 'BT';
  const abs = Math.abs(nilai);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}'${angkaID(s, 1).padStart(4, '0')}" ${arah}`;
}

export const keDesimal = (nilai) => angkaID(nilai, 6);

export const barisTitikSudut = (titikSudut) => {
  const banyak = (titikSudut || []).length > 1;
  return (titikSudut || []).flatMap((b) =>
    b.titik.map(([x, y], i) => ({ no: banyak ? `${b.bagian}.${i + 1}` : `${i + 1}`, x, y }))
  );
};

function jarakHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371008.8;
  const dLat = (lat2 - lat1) * RAD;
  const dLng = (lng2 - lng1) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function jarakGeodesik(lat1, lng1, lat2, lng2) {
  if (lat1 === lat2 && lng1 === lng2) return 0;

  const L = (lng2 - lng1) * RAD;
  const U1 = Math.atan((1 - PEMIPIHAN) * Math.tan(lat1 * RAD));
  const U2 = Math.atan((1 - PEMIPIHAN) * Math.tan(lat2 * RAD));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaLama;
  let putaran = 0;
  let sinSigma;
  let cosSigma;
  let sigma;
  let cos2Alpha;
  let cos2SigmaM;

  do {
    const sinL = Math.sin(lambda);
    const cosL = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinL) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosL) ** 2
    );
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinL) / sinSigma;
    cos2Alpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cos2Alpha === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cos2Alpha;
    const C = (PEMIPIHAN / 16) * cos2Alpha * (4 + PEMIPIHAN * (4 - 3 * cos2Alpha));
    lambdaLama = lambda;
    lambda =
      L +
      (1 - C) *
        PEMIPIHAN *
        sinAlpha *
        (sigma +
          C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    putaran += 1;
  } while (Math.abs(lambda - lambdaLama) > 1e-12 && putaran < 200);

  if (putaran >= 200) return jarakHaversine(lat1, lng1, lat2, lng2);

  const uKuadrat =
    (cos2Alpha * (SUMBU_PANJANG ** 2 - SUMBU_PENDEK ** 2)) / SUMBU_PENDEK ** 2;
  const A =
    1 + (uKuadrat / 16384) * (4096 + uKuadrat * (-768 + uKuadrat * (320 - 175 * uKuadrat)));
  const B = (uKuadrat / 1024) * (256 + uKuadrat * (-128 + uKuadrat * (74 - 47 * uKuadrat)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma ** 2) *
            (-3 + 4 * cos2SigmaM ** 2)));

  return SUMBU_PENDEK * A * (sigma - deltaSigma);
}

export const jarakLatLng = (a, b) => jarakGeodesik(a.lat, a.lng, b.lat, b.lng);

export const keLatLng = (geometry) => {
  const g = geometry?.geometry || geometry;
  if (!g?.coordinates) return null;
  const cincin = g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : g.coordinates[0];
  return Array.isArray(cincin) ? cincin.map(([lng, lat]) => [lat, lng]) : null;
};

const MIL_LAUT = 1852;

export function formatJarak(meter) {
  if (!Number.isFinite(meter)) return { utama: '—', kedua: '' };
  if (meter < 1000) {
    return { utama: `${angkaID(meter, 1)} m`, kedua: `${angkaID(meter / MIL_LAUT, 3)} NM` };
  }
  return {
    utama: `${angkaID(meter / 1000, 3)} km`,
    kedua: `${angkaID(meter / MIL_LAUT, 2)} NM`,
  };
}

export function azimut(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2 * RAD);
  const x =
    Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) -
    Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos(dLng);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
