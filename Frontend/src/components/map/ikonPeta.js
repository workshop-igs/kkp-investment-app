import L from 'leaflet';

const LAMBANG = {
  jangkar:
    '<circle cx="12" cy="4.8" r="2.4"/>' +
    '<path d="M12 7.2V21"/>' +
    '<path d="M4.5 13.2a7.5 7.5 0 0 0 15 0"/>' +
    '<path d="M8 10.2h8"/>',

  ikan:
    '<path d="M20.5 12c-2 3.2-5 4.9-8.2 4.9S6 15.2 4 12c2-3.2 5-4.9 8.3-4.9S18.5 8.8 20.5 12z"/>' +
    '<path d="M4 12 1 8.2v7.6z"/>' +
    '<path d="M16.2 10.4h.01"/>',

  kapal:
    '<path d="M3 16.4h18l-2.2 4.6H5.2z"/>' +
    '<path d="M6.4 16.4V9.8h11.2v6.6"/>' +
    '<path d="M10.4 5.4h3.2v4.4h-3.2z"/>',

  kontainer:
    '<path d="M3.4 11.4h7v9.2h-7z"/>' +
    '<path d="M13.6 6.2h7v14.4h-7z"/>' +
    '<path d="M3.4 15.8h7M13.6 10.8h7M13.6 15.8h7"/>',

  petir: '<path d="M13.2 2.4 5.4 13.6h5.6l-1 8 8.6-11.2H13z"/>',

  pabrik:
    '<path d="M3 20.6V11.2l5.6 3.2v-3.2l5.6 3.2V9l6.4 3.8v7.8z"/>' +
    '<path d="M16.4 9V3.6h3.2v6.8"/>',

  simpul:
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4"/>',

  sertifikat:
    '<path d="M6.2 2.8h7.4l4.2 4.2v14.2H6.2z"/>' +
    '<path d="M13.6 2.8v4.2h4.2"/>' +
    '<path d="M9 13.8l2 2 4.2-4.2"/>',

  bintang:
    '<path d="M12 3.4 14.7 9l6.1.8-4.4 4.3 1.1 6.1L12 17.3 6.5 20.2l1.1-6.1L3.2 9.8 9.3 9z"/>',

  keramba:
    '<ellipse cx="12" cy="8" rx="8" ry="3"/>' +
    '<path d="M4 8v7c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/>' +
    '<path d="M9 10.8v7M15 10.8v7"/>',

  ombak:
    '<circle cx="12" cy="8.5" r="3.4"/>' +
    '<path d="M3 17c1.5 0 1.5-1.6 3-1.6s1.5 1.6 3 1.6 1.5-1.6 3-1.6 1.5 1.6 3 1.6 1.5-1.6 3-1.6 1.5 1.6 3 1.6"/>',

  jembatan:
    '<path d="M2.5 10h19"/>' +
    '<path d="M5 10v9M19 10v9"/>' +
    '<path d="M5 19c0-4.4 3.1-7 7-7s7 2.6 7 7"/>',

  kristal:
    '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/>' +
    '<path d="M4 7.5 12 12l8-4.5M12 12v9"/>',

  labu:
    '<path d="M9.5 3h5"/>' +
    '<path d="M10.5 3v6.2L5.2 18.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.6L13.5 9.2V3"/>' +
    '<path d="M7.6 15h8.8"/>',

  daun:
    '<path d="M5 19.5C5 11 10 5 19.5 4.5 19 14 13 19 5 19.5z"/>' +
    '<path d="M5 19.5 13.5 11"/>',

  rumah:
    '<path d="M3 12 12 4l9 8"/>' +
    '<path d="M6 10v10h12V10"/>' +
    '<path d="M10 20v-5h4v5"/>',

  koper:
    '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/>' +
    '<path d="M9 7.5V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6v1.9M3.5 12.5h17"/>',

  pesawat:
    '<path d="M21 15.5 13.5 11V5.5a1.5 1.5 0 0 0-3 0V11L3 15.5v2l7.5-2.2v3.7L8.5 20.5V22l3.5-1 3.5 1v-1.5' +
    'l-2-1.5v-3.7l7.5 2.2z"/>',

  gardu:
    '<rect x="4" y="5.5" width="16" height="14" rx="1.5"/>' +
    '<path d="M12.8 8.2 9.4 13h3l-.8 3.8 3.6-5H12z"/>',

  toga:
    '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/>' +
    '<path d="M6.5 11.5v4.3c1.5 1.4 3.4 2.2 5.5 2.2s4-.8 5.5-2.2v-4.3M21.5 9.5v5"/>',

  sungai:
    '<path d="M4 4c3 3 0 6 3 9s6 2 9 5"/>' +
    '<path d="M9 3c2.5 2.5.5 5 3 7.5s5 1.5 7.5 4"/>',
};

export const lambangSvg = (jenis, ukuran) =>
  `<svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4"` +
  ` stroke-linecap="round" stroke-linejoin="round">${LAMBANG[jenis] || LAMBANG.simpul}</svg>`;

export const ukuranTitik = (zoom) => Math.min(14, Math.max(11, Math.round(Number(zoom || 5) + 6)));

export const ikonTitik = (warna, ukuran) => {
  const ruas = 360 / warna.length;
  const pola = warna.length > 1
    ? `background-image:conic-gradient(${warna.map((w, i) => `${w} ${i * ruas}deg ${(i + 1) * ruas}deg`).join(',')});`
    : '';
  return L.divIcon({
    html: `<span style="width:${ukuran}px;height:${ukuran}px;background-color:${warna[0]};${pola}--halo:${warna[0]}"></span>`,
    className: 'titik-peta',
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2],
    tooltipAnchor: [0, -ukuran / 2],
  });
};

export const skalaIkon = (zoom) =>
  Math.min(1.1, Math.max(0.42, 0.42 + (Number(zoom || 5) - 4) * 0.06));

export const buatIkon = (jenis, warna, skala = 1) => {
  const lambang = LAMBANG[jenis] || LAMBANG.simpul;
  const lebar = Math.round(26 * skala);
  const tinggi = Math.round(34 * skala);
  const html =
    `<svg width="${lebar}" height="${tinggi}" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M13 33.2C13 33.2 1.4 20.6 1.4 12.6a11.6 11.6 0 0 1 23.2 0c0 8-11.6 20.6-11.6 20.6z"` +
    ` fill="${warna}" stroke="#ffffff" stroke-width="2"/>` +
    `<g transform="translate(5.2 4.6) scale(0.65)" fill="none" stroke="#ffffff"` +
    ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${lambang}</g>` +
    `</svg>`;

  return L.divIcon({
    html,
    className: 'ikon-peta',
    iconSize: [lebar, tinggi],
    iconAnchor: [lebar / 2, tinggi - 1],
    popupAnchor: [0, -(tinggi - 4)],
    tooltipAnchor: [0, -(tinggi - 6)],
  });
};

export default buatIkon;
