import { useCallback, useEffect, useState } from 'react';
import { ImageOverlay, MapContainer, Polygon, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import { Crosshair } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import KontrolPeta from './KontrolPeta';
import LapisanVektorBBox from './LapisanVektorBBox';
import LegendaPeta from './LegendaPeta';
import { BATAS_OSEANOGRAFI, LAYER_LOKAL, LAYER_WMS, WMS_KKP, urlCitraOseanografi } from './katalogLapisan';

const PenyesuaiUkuran = () => {
  const map = useMap();
  useEffect(() => {
    const wadah = map.getContainer();
    const pengamat = new ResizeObserver(() => map.invalidateSize());
    pengamat.observe(wadah);
    return () => pengamat.disconnect();
  }, [map]);
  return null;
};

const TombolKeArea = ({ batas }) => {
  const map = useMap();
  if (!batas) return null;
  return (
    <button
      type="button"
      onClick={() => map.flyToBounds(batas, { padding: [60, 60], duration: 0.8 })}
      title="Kembali ke area proyek"
      className="absolute bottom-9 left-3 z-[1000] inline-flex items-center gap-1.5 px-2.5 py-2
                 rounded-lg bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm
                 text-[12px] font-semibold text-slate-600
                 hover:text-sky-600 hover:border-sky-300 transition-all print:hidden"
    >
      <Crosshair className="w-4 h-4" />
      Area Proyek
    </button>
  );
};

const PetaProyek = ({ posisi, tampilkanPerkakas = false }) => {
  const [basemap, setBasemap] = useState('satellite');
  const [lapisanAktif, setLapisanAktif] = useState([]);
  const [wilayahLapisan, setWilayahLapisan] = useState({});
  const [statusLapisan, setStatusLapisan] = useState({});
  const [modeUkur, setModeUkur] = useState(false);

  const basemapUrl = {
    topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  const alihkanLapisan = (id) =>
    setLapisanAktif((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const pilihWilayah = (idLapisan, idProvinsi) =>
    setWilayahLapisan((s) => ({ ...s, [idLapisan]: idProvinsi }));

  const catatStatus = useCallback((idLapisan, status) => {
    setStatusLapisan((sebelum) => {
      if (status === null) {
        if (!(idLapisan in sebelum)) return sebelum;
        const { [idLapisan]: _dibuang, ...sisa } = sebelum;
        return sisa;
      }
      const lama = sebelum[idLapisan];
      if (
        lama &&
        lama.memuat === status.memuat &&
        lama.galat === status.galat &&
        lama.jumlah === status.jumlah &&
        lama.dipangkas === status.dipangkas
      ) {
        return sebelum;
      }
      return { ...sebelum, [idLapisan]: status };
    });
  }, []);

  useEffect(() => {
    if (!tampilkanPerkakas) setModeUkur(false);
  }, [tampilkanPerkakas]);

  if (!posisi) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-400">
        Proyek ini tidak menyimpan geometri area.
      </div>
    );
  }

  return (
    <>
    <MapContainer
      bounds={posisi}
      boundsOptions={{ padding: [60, 60] }}
      zoomControl={false}
      scrollWheelZoom
      className="absolute inset-0"
    >
      <PenyesuaiUkuran />
      <TileLayer url={basemapUrl[basemap]} maxZoom={19} maxNativeZoom={18} />

      {lapisanAktif
        .filter((id) => LAYER_LOKAL[id]?.citra)
        .map((id) => (
          <ImageOverlay
            key={`citra-${id}`}
            url={urlCitraOseanografi(LAYER_LOKAL[id].citra)}
            bounds={BATAS_OSEANOGRAFI}
            pane="tilePane"
            zIndex={2}
            opacity={0.8}
          />
        ))}

      {lapisanAktif
        .filter((id) => LAYER_LOKAL[id]?.url)
        .map((id) => (
          <LapisanVektorBBox
            key={`lokal-${id}`}
            url={LAYER_LOKAL[id].url}
            params={{
              ...(LAYER_LOKAL[id].params || {}),
              ...(wilayahLapisan[id] ? { provinsi: wilayahLapisan[id] } : {}),
            }}
            style={LAYER_LOKAL[id].gaya}
            gayaTitik={LAYER_LOKAL[id].titik}
            ikon={LAYER_LOKAL[id].ikon}
            warnaIkon={LAYER_LOKAL[id].warnaIkon}
            warnaTitik={LAYER_LOKAL[id].warnaTitik}
            zoomPin={LAYER_LOKAL[id].zoomPin}
            zoomBidang={LAYER_LOKAL[id].zoomBidang}
            onStatus={(st) => catatStatus(id, st)}
            onEachFeature={(feature, layer) => {
              const p = feature?.properties || {};
              layer.bindPopup(() => LAYER_LOKAL[id].popup(p));
              const judul = p.nama || p.pemohon;
              if (judul) layer.bindTooltip(judul, { sticky: true, className: 'map-tooltip' });
            }}
          />
        ))}

      <Polygon
        positions={posisi}
        pathOptions={{ color: '#0056A5', fillColor: '#0056A5', fillOpacity: 0.25, weight: 2.5 }}
      />

      <ScaleControl position="bottomleft" imperial={false} maxWidth={160} />
      <TombolKeArea batas={posisi} />

      {tampilkanPerkakas && (
        <KontrolPeta
          currentBasemap={basemap}
          setBasemap={setBasemap}
          activeLayers={lapisanAktif}
          toggleLayer={alihkanLapisan}
          daftarLapisan={LAYER_LOKAL}
          wilayahLapisan={wilayahLapisan}
          setWilayahLapisan={pilihWilayah}
          statusLapisan={statusLapisan}
          modeUkur={modeUkur}
          setModeUkur={setModeUkur}
        />
      )}
    </MapContainer>

    <LegendaPeta
      wmsUrl={WMS_KKP}
      daftarLayer={LAYER_WMS}
      daftarLokal={LAYER_LOKAL}
      layerAktif={lapisanAktif}
    />
    </>
  );
};

export default PetaProyek;
