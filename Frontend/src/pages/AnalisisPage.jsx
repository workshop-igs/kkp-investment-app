import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import PetaInteraktif from '../components/map/PetaInteraktif';
import PanelAnalisis from '../components/layout/PanelAnalisis';
import { jalankanAnalisisKelayakan } from '../api/klien';
import { mulaiMemuat } from '../components/OverlayMemuat';

const AnalisisPage = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sektorAwal, setSektorAwal] = useState(null);
  const [subAwal, setSubAwal] = useState(null);
  const [cari] = useSearchParams();
  const [fokus, setFokus] = useState(() => {
    const lat = Number.parseFloat(cari.get('lat'));
    const lng = Number.parseFloat(cari.get('lng'));
    const bbox = (cari.get('bbox') || '').split(',').map(Number.parseFloat);
    const label = cari.get('label') || 'Lokasi';
    if (bbox.length === 4 && bbox.every(Number.isFinite)) return { bbox, label };
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, label, keterangan: cari.get('keterangan') || undefined }
      : null;
  });

  const lihatLokasi = (l) => {
    setPanelOpen(false);
    setFokus({
      lat: l.titik[1],
      lng: l.titik[0],
      label: l.nama,
      keterangan: `${l.sub_zona_label} · ${l.provinsi} · ${l.status_label}`,
    });
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kkp:area', { detail: geometry }));
    return () => window.dispatchEvent(new CustomEvent('kkp:area', { detail: null }));
  }, [geometry]);

  const handlePolygonCreated = (geoJsonGeometry) => {
    setGeometry(geoJsonGeometry);
    setResult(null);
  };

  const pilihSektor = (sektor, sub = null) => {
    setSektorAwal(sektor);
    setSubAwal(sub);
  };

  const handleAnalyze = async (sektor, subSektor, financialParams) => {
    if (!geometry) return null;
    setLoading(true);
    const selesai = mulaiMemuat('Menganalisis kelayakan lokasi');
    try {
      const data = await jalankanAnalisisKelayakan(geometry, sektor, subSektor, financialParams);
      setResult(data);
      return data;
    } catch (error) {
      console.error("Analysis Error:", error);
      const pesan = error.response?.data?.detail;
      alert(pesan || "Terjadi kesalahan saat memproses analisis.");
      return null;
    } finally {
      selesai();
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 min-w-0">
      <div className="flex-1 relative bg-slate-50 overflow-hidden">
        <PetaInteraktif 
          onPolygonCompleted={handlePolygonCreated} 
          onPilihSektor={pilihSektor}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          mapLayers={result?.map_layers}
          fokus={fokus}
        />
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-20 lg:p-8 lg:pt-24">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col w-full max-w-4xl max-h-[90vh] relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPanelOpen(false)}
              className="absolute top-6 right-6 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
            >
              ✕
            </button>
            <div className="flex-1 overflow-y-auto w-full h-full custom-scrollbar">
              <PanelAnalisis 
                result={result} 
                loading={loading} 
                onAnalyze={handleAnalyze} 
                hasGeometry={!!geometry} 
                geometry={geometry}
                sektorAwal={sektorAwal}
                subAwal={subAwal}
                onLihatLokasi={lihatLokasi}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalisisPage;
