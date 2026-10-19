import { useRef, useState } from 'react';
import shp from 'shpjs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

export const LUAS_MIN_HA = 0.01;
export const LUAS_MAKS_HA = 50000;
const INDONESIA = { barat: 90, timur: 145, selatan: -15, utara: 10 };
const JARI_BUMI = 6378137;

const ha = (n, d = 2) => n.toLocaleString('id-ID', { maximumFractionDigits: d });

const titikSemua = (geom) => {
  const hasil = [];
  const jelajah = (k) => {
    if (typeof k?.[0] === 'number') hasil.push(k);
    else k?.forEach(jelajah);
  };
  jelajah(geom?.coordinates);
  return hasil;
};

const luasCincin = (cincin) => {
  let jumlah = 0;
  for (let i = 0; i < cincin.length - 1; i += 1) {
    const [x1, y1] = cincin[i];
    const [x2, y2] = cincin[i + 1];
    jumlah += ((x2 - x1) * Math.PI / 180) * (2 + Math.sin(y1 * Math.PI / 180) + Math.sin(y2 * Math.PI / 180));
  }
  return Math.abs(jumlah * JARI_BUMI * JARI_BUMI / 2);
};

export const luasHa = (geom) => {
  const poligon = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return poligon.reduce((n, [luar, ...lubang]) => n + luasCincin(luar) - lubang.reduce((m, c) => m + luasCincin(c), 0), 0) / 10000;
};

const periksaKoordinat = (geojson, fitur) => {
  const crs = geojson?.crs?.properties?.name;
  if (crs && !/4326|CRS84/i.test(crs)) {
    throw new Error(`File memakai sistem koordinat ${crs}. Ekspor ulang ke WGS 84 (EPSG:4326) dalam derajat.`);
  }
  const titik = fitur.flatMap((f) => titikSemua(f.geometry));
  if (titik.some(([, y]) => Math.abs(y) > 90) && titik.every(([x, y]) => Math.abs(x) <= 90 && Math.abs(y) <= 180)) {
    throw new Error('Urutan koordinat tampaknya tertukar (lintang, bujur). GeoJSON wajib berurutan bujur, lintang.');
  }
  if (titik.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90)) {
    throw new Error(
      'Koordinat file bukan derajat lintang/bujur (kemungkinan proyeksi UTM dalam meter). Untuk Shapefile sertakan '
      + 'berkas .prj di dalam .zip, atau ekspor ulang ke WGS 84 (EPSG:4326).'
    );
  }
  return titik;
};

export async function bacaGeospasial(file) {
  const nama = file.name.toLowerCase();
  let geojson;
  if (nama.endsWith('.zip')) {
    geojson = await shp(await file.arrayBuffer());
  } else if (nama.endsWith('.geojson') || nama.endsWith('.json')) {
    try {
      geojson = JSON.parse(await file.text());
    } catch {
      throw new Error('Isi file GeoJSON tidak dapat dibaca (format JSON rusak).');
    }
  } else if (nama.endsWith('.kml')) {
    geojson = kml(new DOMParser().parseFromString(await file.text(), 'text/xml'));
  } else {
    throw new Error('Format file tidak didukung. Harap unggah file .zip (Shapefile), .geojson, atau .kml');
  }
  const fitur = Array.isArray(geojson) ? geojson.flatMap((g) => g.features || [])
    : geojson?.type === 'FeatureCollection' ? geojson.features
      : geojson?.type === 'Feature' ? [geojson]
        : geojson?.type ? [{ type: 'Feature', properties: {}, geometry: geojson }] : [];
  if (!fitur.length) throw new Error('Tidak ada data poligon yang ditemukan dalam file ini.');
  const poligon = fitur.filter((f) => ['Polygon', 'MultiPolygon'].includes(f?.geometry?.type));
  if (!poligon.length) throw new Error('File tidak mengandung geometri Poligon yang valid.');
  periksaKoordinat(geojson, poligon);
  return { type: 'FeatureCollection', features: poligon, diabaikan: fitur.length - poligon.length };
}

export function areaProyek({ features, diabaikan = 0 }) {
  const peringatan = [];
  const geometry = features[0].geometry;
  const luas = luasHa(geometry);
  if (features.length > 1) {
    peringatan.push(
      `File berisi ${features.length} poligon; hanya poligon pertama (${ha(luas)} ha) yang dipakai. `
      + 'Unggah satu poligon per area proyek, atau gabungkan poligonnya lebih dulu bila memang satu area.'
    );
  }
  if (diabaikan) peringatan.push(`${diabaikan} fitur titik/garis di dalam file diabaikan.`);
  if (geometry.type === 'MultiPolygon' && geometry.coordinates.length > 1) {
    peringatan.push(`Poligon terdiri atas ${geometry.coordinates.length} bagian terpisah; semuanya dianalisis sebagai satu area.`);
  }
  if (luas < LUAS_MIN_HA) throw new Error(`Luas area ${ha(luas, 4)} ha terlalu kecil; paling kecil ${ha(LUAS_MIN_HA)} ha.`);
  if (luas > LUAS_MAKS_HA) {
    throw new Error(`Luas area ${ha(luas, 0)} ha melebihi batas ${ha(LUAS_MAKS_HA, 0)} ha; pecah menjadi beberapa area proyek.`);
  }
  const titik = titikSemua(geometry);
  const di = (x, y) => x >= INDONESIA.barat && x <= INDONESIA.timur && y >= INDONESIA.selatan && y <= INDONESIA.utara;
  const [x, y] = titik.reduce(([a, b], [p, q]) => [a + p / titik.length, b + q / titik.length], [0, 0]);
  if (!di(x, y)) {
    if (di(y, x)) {
      throw new Error('Urutan koordinat tampaknya tertukar (lintang, bujur). GeoJSON wajib berurutan bujur, lintang.');
    }
    peringatan.push('Area berada di luar wilayah Indonesia; data tata ruang dan perairan tidak tersedia di sana.');
  }
  return { geometry, peringatan };
}

export default function UnggahGeospasial({ onUploadSuccess, onError, onPeringatan, disabled, className, buttonText, icon }) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    onError(null);
    onPeringatan?.([]);

    try {
      const { geometry, peringatan } = areaProyek(await bacaGeospasial(file));
      onUploadSuccess(geometry);
      onPeringatan?.(peringatan);
    } catch (err) {
      console.error(err);
      onError(err.message || 'Gagal memproses file geospasial.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const defaultClassName = `flex items-center gap-2.5 px-5 py-2.5 rounded-lg font-syne text-sm font-bold transition-all duration-200 shadow-lg ${
    disabled || isProcessing
      ? 'bg-[#0e2647] text-slate-500 border border-[#1a4070]/50 cursor-not-allowed'
      : 'bg-[#0e2647] border border-blue-500/50 text-blue-300 hover:bg-blue-500/15 hover:border-blue-400 hover:text-blue-200 cursor-pointer active:scale-95'
  }`;

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".zip,.geojson,.json,.kml"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isProcessing}
        className={className || defaultClassName}
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Memproses...
          </>
        ) : (
          <>
            {icon || (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            {buttonText || 'Upload Area Proyek'}
          </>
        )}
      </button>
    </div>
  );
}
