import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Bot, CircleHelp, Download, Keyboard, Layers, Loader2, Map as IkonPeta, Minus, Plus, Ruler, Search, X } from 'lucide-react';
import PanelDaftarLapisan from './PanelDaftarLapisan';
import PanelKoordinat from './PanelKoordinat';
import PanelPencarian from './PanelPencarian';
import AlatUkur from './AlatUkur';
import PenandaTujuan from './PenandaTujuan';
import { mulaiMemuat } from '../OverlayMemuat';
import { unduhPdfPeta } from '../../utils/pdfPetaSpasial';

const TOMBOL = 'grid h-11 w-11 [@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9 shrink-0 place-items-center '
  + 'rounded-xl border shadow-sm backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/40';
const TOMBOL_ZOOM = 'grid h-9 [@media(max-height:760px)]:h-7 w-full place-items-center rounded-lg text-slate-600 hover:text-kkp-700 '
  + 'hover:bg-kkp-100/60 transition-colors';
const kelasTombol = (aktif, warnaAktif = 'bg-kkp-800 border-kkp-800') => `${TOMBOL} ${
  aktif ? `${warnaAktif} text-white` : 'bg-white/95 border-slate-200 text-slate-600 hover:text-kkp-700 hover:border-kkp-200'
}`;
const asisten = (buka) => window.dispatchEvent(new CustomEvent('kkp:asisten', { detail: buka }));

const ARAH = [
  ['U', 'Utara', 'top-1 left-1/2 -translate-x-1/2', 'text-kkp-800'],
  ['T', 'Timur', 'right-1 top-1/2 -translate-y-1/2', 'text-slate-500'],
  ['S', 'Selatan', 'bottom-1 left-1/2 -translate-x-1/2', 'text-slate-500'],
  ['B', 'Barat', 'left-1 top-1/2 -translate-y-1/2', 'text-slate-500'],
];

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
  lapisanAwal = [],
}) => {
  const map = useMap();

  const [panelAktif, setPanelAktif] = useState(lapisanAwal.length ? 'layer' : null);
  const [tujuan, setTujuan] = useState(null);
  const [mengunduh, setMengunduh] = useState(false);
  const [asistenBuka, setAsistenBuka] = useState(false);

  useEffect(() => {
    const catat = (e) => setAsistenBuka(Boolean(e.detail));
    window.addEventListener('kkp:asisten-status', catat);
    return () => window.removeEventListener('kkp:asisten-status', catat);
  }, []);

  const bukaPanel = (nama) => {
    setPanelAktif((s) => (s === nama ? null : nama));
    if (modeUkur) setModeUkur?.(false);
    asisten(false);
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

  const basemaps = [
    {
      id: 'satellite', name: 'Satelit', sumber: 'Esri World Imagery',
      pratinjau: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/9/268/420',
    },
    { id: 'street', name: 'Jalan', sumber: 'OpenStreetMap', pratinjau: 'https://tile.openstreetmap.org/9/420/268.png' },
    {
      id: 'topo', name: 'Topografi', sumber: 'Esri World Topographic Map',
      pratinjau: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/9/268/420',
    },
  ];

  const handleExport = async () => {
    setMengunduh(true);
    const selesai = mulaiMemuat('Menyusun PDF peta');
    try {
      await unduhPdfPeta(map, {
        lapisan: activeLayers.filter((id) => daftarLapisan[id]).map((id) => ({ def: daftarLapisan[id], sektor: sektorLapisan[id] })),
        petaDasar: basemaps.find((b) => b.id === currentBasemap) || basemaps[0],
      });
    } catch (e) {
      alert(`PDF peta gagal disusun: ${e.message}`);
    } finally {
      selesai();
      setMengunduh(false);
    }
  };

  return (
    <>
      <div className="pointer-events-none absolute right-4 sm:right-6 top-20 bottom-[104px] z-[1100] flex items-center">
      <div
        ref={refKontrol}
        data-tur="alat"
        className="pointer-events-auto flex max-h-full flex-col flex-wrap-reverse gap-4 [@media(max-height:760px)]:gap-1.5"
      >

        <div data-tur="zoom" className="flex w-11 [@media(max-height:760px)]:w-9 shrink-0 flex-col rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur-md">
          <button onClick={handleZoomIn} className={TOMBOL_ZOOM} title="Perbesar peta">
            <Plus className="w-5 h-5" />
          </button>
          <div className="mx-1 h-px bg-slate-200 my-0.5"></div>
          <button onClick={handleZoomOut} className={TOMBOL_ZOOM} title="Perkecil peta">
            <Minus className="w-5 h-5" />
          </button>
        </div>

      <div>
        <button
          data-tur="lapisan"
          onClick={() => bukaPanel('layer')}
          className={kelasTombol(panelAktif === 'layer')}
          title="Daftar layer"
        >
          <Layers className="w-5 h-5" />
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
          data-tur="basemap"
          onClick={() => bukaPanel('basemap')}
          className={kelasTombol(panelAktif === 'basemap')}
          title="Peta dasar"
        >
          <IkonPeta className="w-5 h-5" />
        </button>

        {panelAktif === 'basemap' && (
          <div className="absolute right-full mr-3 bottom-0 animate-fade-in rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl">
            <p className="px-1 pb-2 text-[13px] font-bold text-kkp-900">Peta dasar</p>
            <div className="flex gap-2">
              {basemaps.map((bg) => {
                const aktif = currentBasemap === bg.id;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    title={bg.sumber}
                    onClick={() => {
                      setBasemap(bg.id);
                      setPanelAktif(null);
                    }}
                    className={`w-24 rounded-xl p-1 text-left transition ${aktif ? 'bg-kkp-100 ring-2 ring-kkp-700' : 'hover:bg-slate-100'}`}
                  >
                    <img src={bg.pratinjau} alt={`Pratinjau peta dasar ${bg.name}`} loading="lazy" className="h-16 w-full rounded-md bg-slate-100 object-cover" />
                    <span className={`mt-1 block px-0.5 text-xs ${aktif ? 'font-semibold text-kkp-800' : 'text-slate-600'}`}>{bg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <button
          data-tur="koordinat"
          onClick={() => bukaPanel('koordinat')}
          className={kelasTombol(panelAktif === 'koordinat')}
          title="Input koordinat"
        >
          <Keyboard className="w-5 h-5" />
        </button>
        {panelAktif === 'koordinat' && <PanelKoordinat onTuju={tujuLokasi} />}
      </div>

      <div>
        <button
          data-tur="cari"
          onClick={() => bukaPanel('cari')}
          className={kelasTombol(panelAktif === 'cari')}
          title="Cari lokasi"
        >
          <Search className="w-5 h-5" />
        </button>
        {panelAktif === 'cari' && <PanelPencarian onTuju={tujuLokasi} />}
      </div>

      <div>
        <button
          data-tur="ukur"
          onClick={() => {
            setPanelAktif(null);
            asisten(false);
            setModeUkur?.(!modeUkur);
          }}
          className={kelasTombol(modeUkur, 'bg-rose-600 border-rose-600')}
          title={modeUkur ? 'Keluar dari mode ukur' : 'Ukur jarak'}
        >
          {modeUkur ? <X className="w-5 h-5" /> : <Ruler className="w-5 h-5" />}
        </button>
        <AlatUkur aktif={modeUkur} onTutup={() => setModeUkur?.(false)} />
      </div>

      <button
        onClick={handleExport}
        disabled={mengunduh}
        className={kelasTombol(false)}
        title="Unduh PDF peta"
      >
        {mengunduh ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
      </button>

      {onTur && (
        <button
          data-tur="ulang-tur"
          onClick={() => {
            setPanelAktif(null);
            if (modeUkur) setModeUkur?.(false);
            asisten(false);
            onTur();
          }}
          className={kelasTombol(false)}
          title="Tur peta"
        >
          <CircleHelp className="w-5 h-5" />
        </button>
      )}

      <button
        type="button"
        data-tur="asisten"
        onClick={() => {
          setPanelAktif(null);
          if (modeUkur) setModeUkur?.(false);
          asisten(!asistenBuka);
        }}
        aria-label={asistenBuka ? 'Tutup asisten' : 'Buka asisten'}
        aria-expanded={asistenBuka}
        title="Asisten KKP"
        className={`relative ${TOMBOL} ${asistenBuka ? 'bg-kkp-900 border-kkp-900' : 'bg-kkp-800 border-kkp-800 hover:bg-kkp-900'} text-white`}
      >
        {asistenBuka ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        {!asistenBuka && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-kkp-toska ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      </div>
      </div>

      <PenandaTujuan tujuan={tujuan} onTutup={() => setTujuan(null)} />

      <div
        ref={refKompas}
        data-tur="kompas"
        className="absolute bottom-6 right-4 sm:right-6 z-[1000] h-[72px] w-[72px] rounded-full bg-white/95 shadow-md ring-1 ring-slate-200 backdrop-blur-md"
      >
        <svg viewBox="0 0 72 72" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="36" cy="36" r="22" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="1.2 4.56" />
          <circle cx="36" cy="36" r="22" fill="none" stroke="#e7effa" strokeWidth="5" opacity="0.6" />
          <path d="M36 17 L40.5 36 L31.5 36 Z" fill="#004584" />
          <path d="M36 55 L40.5 36 L31.5 36 Z" fill="#cbd5e1" />
          <circle cx="36" cy="36" r="2.6" fill="#ffffff" stroke="#004584" strokeWidth="1.4" />
        </svg>
        {ARAH.map(([huruf, nama, posisi, warna]) => (
          <button
            key={huruf}
            type="button"
            onClick={() => handlePan(huruf)}
            title={`Geser peta ke ${nama.toLowerCase()}`}
            aria-label={`Geser peta ke ${nama.toLowerCase()}`}
            className={`absolute ${posisi} grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${warna}
                        hover:bg-kkp-100 hover:text-kkp-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/40`}
          >
            {huruf}
          </button>
        ))}
      </div>
    </>
  );
};

export default KontrolPeta;
