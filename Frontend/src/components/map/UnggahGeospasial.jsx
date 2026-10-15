import { useRef, useState } from 'react';
import shp from 'shpjs';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

export async function bacaGeospasial(file) {
  const nama = file.name.toLowerCase();
  let geojson;
  if (nama.endsWith('.zip')) {
    geojson = await shp(await file.arrayBuffer());
  } else if (nama.endsWith('.geojson') || nama.endsWith('.json')) {
    geojson = JSON.parse(await file.text());
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
  return { type: 'FeatureCollection', features: poligon };
}

export default function UnggahGeospasial({ onUploadSuccess, onError, disabled, className, buttonText, icon }) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    onError(null);

    try {
      const { features } = await bacaGeospasial(file);
      onUploadSuccess(features[0].geometry);
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
