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
