import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus, Compass, Layers, Download, Keyboard, Ruler, Search, X, CircleHelp } from 'lucide-react';
import PanelDaftarLapisan from './PanelDaftarLapisan';
import PanelKoordinat from './PanelKoordinat';
import PanelPencarian from './PanelPencarian';
import AlatUkur from './AlatUkur';
import PenandaTujuan from './PenandaTujuan';

const KontrolPeta = ({
  fokus,
  currentBasemap,
  setBasemap,
  activeLayers = [],
  toggleLayer,
  daftarLapisan = {},
  wilayahLapisan = {},
  setWilayahLapisan,
  sektorLapisan = {},
  setSektorLapisan,
  statusLapisan = {},
  modeUkur = false,
  setModeUkur,
  onTur,
  lapisanAwal = null,
}) => {
  const map = useMap();

  const [panelAktif, setPanelAktif] = useState(lapisanAwal ? 'layer' : null);
  const [tujuan, setTujuan] = useState(null);

  const bukaPanel = (nama) => {
    setPanelAktif((s) => (s === nama ? null : nama));
    if (modeUkur) setModeUkur?.(false);
  };

  const tujuLokasi = ({ lat, lng, bbox, label, keterangan, zoom = 13 }) => {
    if (bbox && bbox.length === 4) {
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [50, 50], animate: false });
      setTujuan(null);
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], Math.max(map.getZoom(), zoom), { animate: false });
    setTujuan({ lat, lng, label, keterangan });
  };

  useEffect(() => {
    if (fokus) tujuLokasi(fokus);
  }, [fokus]); // eslint-disable-line react-hooks/exhaustive-deps

  const refKontrol = useRef(null);
  const refKompas = useRef(null);
  useEffect(() => {
    const elemen = [refKontrol.current, refKompas.current].filter(Boolean);
    elemen.forEach((el) => {
      L.DomEvent.disableScrollPropagation(el);
      L.DomEvent.disableClickPropagation(el);
    });
  }, []);

  const handleZoomIn = () => map.setZoom(map.getZoom() + 1, { animate: false });
  const handleZoomOut = () => map.setZoom(map.getZoom() - 1, { animate: false });

  const handlePan = (direction) => {
    const panAmount = 150;
    const geser = {
      U: [0, -panAmount],
      S: [0, panAmount],
      T: [panAmount, 0],
      B: [-panAmount, 0],
    }[direction];
    if (geser) map.panBy(geser, { animate: false });
  };

  const handleExport = () => {
    alert("Fitur Export Excel akan mengunduh data dari area terpilih di peta.");
  };

  const basemaps = [
    { id: 'satellite', name: 'Satelit' },
    { id: 'street', name: 'Jalan' },
    { id: 'topo', name: 'Topografi' },
  ];

  return (
    <>
      <div
        ref={refKontrol}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-[1100] flex flex-col gap-4"
      >
        
        <div data-tur="zoom" className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-1 shadow-sm flex flex-col">
          <button onClick={handleZoomIn} className="p-2 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded transition-colors" title="Zoom In">
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-full h-px bg-slate-200 my-1"></div>
          <button onClick={handleZoomOut} className="p-2 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded transition-colors" title="Zoom Out">
            <Minus className="w-5 h-5" />
          </button>
        </div>

      <div className="relative">
        <button 
          data-tur="basemap"
          onClick={() => bukaPanel('basemap')} 
          className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-2.5 shadow-sm text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-all flex items-center justify-center"
          title="Basemap Gallery"
        >
          <Layers className="w-5 h-5" />
        </button>
        
        {panelAktif === 'basemap' && (
          <div className="absolute right-full mr-3 bottom-0 bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg shadow-lg w-32 overflow-hidden animate-fade-in border-r-2 border-r-kkp-700">
            {basemaps.map((bg) => (
              <button
                key={bg.id}
                onClick={() => {
                  setBasemap(bg.id);
                  setPanelAktif(null);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  currentBasemap === bg.id 
                    ? 'bg-sky-50 text-sky-700 font-medium border-l-2 border-sky-500' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-sky-600'
                }`}
              >
                {bg.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button 
          data-tur="lapisan"
          onClick={() => bukaPanel('layer')} 
          className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-2.5 shadow-sm text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-all flex items-center justify-center"
          title="Data Layers"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
        </button>
        
        {panelAktif === 'layer' && (
          <PanelDaftarLapisan
            activeLayers={activeLayers}
            toggleLayer={toggleLayer}
            daftarLapisan={daftarLapisan}
            wilayahLapisan={wilayahLapisan}
            setWilayahLapisan={setWilayahLapisan}
            sektorLapisan={sektorLapisan}
            setSektorLapisan={setSektorLapisan}
            statusLapisan={statusLapisan}
            lapisanAwal={lapisanAwal}
          />
        )}
      </div>

      <div className="relative">
        <button
          data-tur="koordinat"
          onClick={() => bukaPanel('koordinat')}
          className={`backdrop-blur-md border rounded-lg p-2.5 shadow-sm transition-all flex items-center justify-center ${
            panelAktif === 'koordinat'
              ? 'bg-kkp-700 border-kkp-700 text-white'
              : 'bg-white/90 border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300'
          }`}
          title="Input Koordinat"
        >
          <Keyboard className="w-5 h-5" />
        </button>
        {panelAktif === 'koordinat' && <PanelKoordinat onTuju={tujuLokasi} />}
      </div>

      <div className="relative">
        <button
          data-tur="cari"
          onClick={() => bukaPanel('cari')}
          className={`backdrop-blur-md border rounded-lg p-2.5 shadow-sm transition-all flex items-center justify-center ${
            panelAktif === 'cari'
              ? 'bg-kkp-700 border-kkp-700 text-white'
              : 'bg-white/90 border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300'
          }`}
          title="Cari Lokasi"
        >
          <Search className="w-5 h-5" />
        </button>
        {panelAktif === 'cari' && <PanelPencarian onTuju={tujuLokasi} />}
      </div>

      <div className="relative">
        <button
          data-tur="ukur"
          onClick={() => {
            setPanelAktif(null);
            setModeUkur?.(!modeUkur);
          }}
          className={`backdrop-blur-md border rounded-lg p-2.5 shadow-sm transition-all flex items-center justify-center ${
            modeUkur
              ? 'bg-rose-600 border-rose-600 text-white'
              : 'bg-white/90 border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300'
          }`}
          title={modeUkur ? 'Keluar dari mode ukur' : 'Ukur Jarak'}
        >
          {modeUkur ? <X className="w-5 h-5" /> : <Ruler className="w-5 h-5" />}
        </button>
        <AlatUkur aktif={modeUkur} onTutup={() => setModeUkur?.(false)} />
      </div>

      <button 
        onClick={handleExport}
        className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-2.5 shadow-sm text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-all flex items-center justify-center"
        title="Export Data"
      >
        <Download className="w-5 h-5" />
      </button>

      {onTur && (
        <button
          data-tur="ulang-tur"
          onClick={() => {
            setPanelAktif(null);
            if (modeUkur) setModeUkur?.(false);
            onTur();
          }}
          className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-2.5 shadow-sm text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-all flex items-center justify-center"
          title="Tur Peta"
        >
          <CircleHelp className="w-5 h-5" />
        </button>
      )}

      </div>

      <PenandaTujuan tujuan={tujuan} onTutup={() => setTujuan(null)} />

      <div ref={refKompas} data-tur="kompas" className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 rounded-full p-2 shadow-sm w-16 h-16 flex items-center justify-center">
        <Compass className="w-5 h-5 text-sky-600 absolute drop-shadow-sm" />
        
        <button onClick={() => handlePan('U')} className="absolute top-0 text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:-translate-y-0.5 transition-all p-1" title="Utara">U</button>
        <button onClick={() => handlePan('S')} className="absolute bottom-0 text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:translate-y-0.5 transition-all p-1" title="Selatan">S</button>
        <button onClick={() => handlePan('T')} className="absolute right-1 text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:translate-x-0.5 transition-all p-1" title="Timur">T</button>
        <button onClick={() => handlePan('B')} className="absolute left-1 text-[10px] font-bold text-slate-500 hover:text-sky-600 hover:-translate-x-0.5 transition-all p-1" title="Barat">B</button>
      </div>
    </>
  );
};

export default KontrolPeta;
