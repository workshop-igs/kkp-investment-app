import { useState } from 'react';

import PetaInteraktif from '../components/map/PetaInteraktif';
import PanelAnalisis from '../components/layout/PanelAnalisis';
import { jalankanAnalisisKelayakan } from '../api/klien';

const AnalisisPage = () => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geometry, setGeometry] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fokus, setFokus] = useState(null);

  const lihatLokasi = (l) => {
    setPanelOpen(false);
    setFokus({
      lat: l.titik[1],
      lng: l.titik[0],
      label: l.nama,
      keterangan: `${l.sub_zona_label} · ${l.provinsi} · ${l.status_label}`,
    });
  };

  const handlePolygonCreated = (geoJsonGeometry) => {
    setGeometry(geoJsonGeometry);
  };

  const handleAnalyze = async (sektor, financialParams) => {
    if (!geometry) return null;
    setLoading(true);
    try {
      const data = await jalankanAnalisisKelayakan(geometry, sektor, financialParams);
      setResult(data);
      return data;
    } catch (error) {
      console.error("Analysis Error:", error);
      const pesan = error.response?.data?.detail;
      alert(pesan || "Terjadi kesalahan saat memproses analisis.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 min-w-0">
      <div className="flex-1 relative bg-slate-50 overflow-hidden">
        <PetaInteraktif 
          onPolygonCompleted={handlePolygonCreated} 
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
