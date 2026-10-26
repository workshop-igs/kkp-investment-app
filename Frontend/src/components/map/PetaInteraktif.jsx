import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay, ScaleControl, useMap } from 'react-leaflet';
import { useSearchParams } from 'react-router-dom';
import { Crosshair, Move } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import KontrolPeta from './KontrolPeta';
import { BATAS_TITIK_UBAH, DrawingLayer, MapOverlayLayers } from './AlatGambar';
import UnggahGeospasial from './UnggahGeospasial';
import PetaMini from './PetaMini';
import PanelDetailProvinsi from './PanelDetailProvinsi';
import LegendaPeta from './LegendaPeta';
import LapisanVektorBBox from './LapisanVektorBBox';
import TurPeta from './TurPeta';
import { BATAS_OSEANOGRAFI, LAYER_LOKAL, LAYER_WMS, WMS_KKP, urlCitraOseanografi } from './katalogLapisan';

import { api } from '../../api/klien';


const PROFIL_BATAS = {
  terang: {
    halo: '#ffffff',
    opasitasHalo: 0.9,
    garis: '#1f3d5c',
    garisAktif: '#0056A5',
    isi: '#0056A5',
    isiAktif: 0.3,
    isiDiam: 0.06,
  },
  gelap: {
    halo: '#0f172a',
    opasitasHalo: 0.7,
    garis: '#fde047',
    garisAktif: '#fbbf24',
    isi: '#7dd3fc',
    isiAktif: 0.28,
    isiDiam: 0.05,
  },
};

export const URL_PETA_DASAR = {
  topo: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
};

export const BATAS_INDONESIA = [[-11.5, 94.5], [6.5, 141.5]];

export const BATAS_PETA = { minZoom: 4, maxBounds: [[-25.0, 81.0], [21.0, 155.0]], maxBoundsViscosity: 0.7 };

const PROFIL_PETA_DASAR = { topo: 'terang', street: 'terang', satellite: 'gelap' };

const PANE_HALO = 'batas-halo';

const PANE_PROVINSI = 'batas-provinsi';

const ZOOM_BATAS_DETAIL = 9;

const JARAK_POPUP = { atas: 72 + 16, kanan: 72, bawah: 100 };

const LEBAR_HALO = 2;
const TEBAL_BATAS = { diam: 1.8, aktif: 3.2 };

const profilBatas = (petaDasar) =>
  PROFIL_BATAS[PROFIL_PETA_DASAR[petaDasar] || 'terang'];

const provinsiAktif = (feature, terpilih) =>
  !!terpilih && terpilih.properties?.kode_bps === feature?.properties?.kode_bps;

const gayaHaloProvinsi = (feature, terpilih, profil) => {
  const aktif = provinsiAktif(feature, terpilih);
  return {
    color: profil.halo,
    weight: TEBAL_BATAS.aktif + LEBAR_HALO,
    opacity: aktif ? 1 : 0,
    fill: false,
  };
};

const gayaBatasProvinsi = (feature, terpilih, profil) => {
  const aktif = provinsiAktif(feature, terpilih);
  return {
    color: profil.garisAktif,
    weight: aktif ? TEBAL_BATAS.aktif : 0,
    opacity: aktif ? 1 : 0,
    fillColor: profil.isi,
    fillOpacity: aktif ? profil.isiAktif : 0,
  };
};

const KunciLapisanSaatMenggambar = ({ menggambar }) => {
  const map = useMap();
  useEffect(() => {
    const wadah = map.getContainer();
    wadah.classList.toggle('mode-gambar', menggambar);
    return () => wadah.classList.remove('mode-gambar');
  }, [map, menggambar]);
  return null;
};

const PaneBatas = ({ onSiap }) => {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(PANE_HALO)) {
      const pane = map.createPane(PANE_HALO);
      pane.style.zIndex = 350;
      pane.style.pointerEvents = 'none';
    }
    if (!map.getPane(PANE_PROVINSI)) {
      map.createPane(PANE_PROVINSI).style.zIndex = 360;
    }
    onSiap({
      halo: L.canvas({ pane: PANE_HALO, padding: 0.5 }),
      batas: L.canvas({ pane: PANE_PROVINSI, padding: 0.5 }),
    });
  }, [map, onSiap]);
  return null;
};

const PemantauZoom = ({ ambang, onUbah }) => {
  const map = useMap();
  useEffect(() => {
    const cek = () => onUbah(map.getZoom() >= ambang);
    cek();
    map.on('zoomend', cek);
    return () => map.off('zoomend', cek);
  }, [map, ambang, onUbah]);
  return null;
};

const MouseTracker = ({ onMouseMove }) => {
  const map = useMap();
  useEffect(() => {
    if (typeof onMouseMove !== 'function') return undefined;
    const handler = (e) => onMouseMove(e.latlng);
    map.on('mousemove', handler);
    return () => map.off('mousemove', handler);
  }, [map, onMouseMove]);
  return null;
};

const PetaInteraktif = ({ 
  setMousePosition, 
  onPolygonCompleted, 
  onPilihSektor,
  panelOpen, 
  setPanelOpen,
  mapLayers = [],
  fokus,
}) => {
  const [basemap, setBasemap] = useState('satellite');
  
  const drawerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [vertexCount, setVertexCount] = useState(0);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [modeUbah, setModeUbah] = useState(false);

  const [provinsiRingkas, setProvinsiRingkas] = useState(null);
  const [provinsiDetail, setProvinsiDetail] = useState(null);
  const [zoomDekat, setZoomDekat] = useState(false);
  const provinsiGeo = zoomDekat && provinsiDetail ? provinsiDetail : provinsiRingkas;
  const [provinsiTerpilih, setProvinsiTerpilih] = useState(null);
  const [error, setError] = useState(null);
  const [peringatanUnggah, setPeringatanUnggah] = useState([]);
  const [layerVisibility, setLayerVisibility] = useState({});
  
  const [cari] = useSearchParams();
  const lapisanAwal = (cari.get('lapisan') || '').split(',').filter((id) => LAYER_LOKAL[id]);
  const [activeDataLayers, setActiveDataLayers] = useState(() => (lapisanAwal.length ? lapisanAwal : ['potensi']));
  const [petaSiap, setPetaSiap] = useState(false);
  const [wilayahLapisan, setWilayahLapisan] = useState({});

  const [sektorLapisan, setSektorLapisan] = useState({});

  const pilihWilayahLapisan = (idLapisan, idProvinsi) =>
    setWilayahLapisan((sebelum) => ({ ...sebelum, [idLapisan]: idProvinsi }));

  const pilihSektorLapisan = (idLapisan, kodeSektor) =>
    setSektorLapisan((sebelum) => ({ ...sebelum, [idLapisan]: kodeSektor }));

  const [statusLapisan, setStatusLapisan] = useState({});
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

  const [modeUkur, setModeUkur] = useState(false);
  const [turAktif, setTurAktif] = useState(false);
  const [kanvasBatas, setKanvasBatas] = useState(null);
  const refPeta = useRef(null);
  const refProvinsi = useRef(null);
  const refHaloProvinsi = useRef(null);
  const refTerpilih = useRef(null);
  const refProfil = useRef(profilBatas('satellite'));

  const profil = profilBatas(basemap);
  refTerpilih.current = provinsiTerpilih;
  refProfil.current = profil;

  const peragakanProvinsi = useCallback((bebas, setKotak) => {
    const peta = refPeta.current;
    const grup = refProvinsi.current;
    if (!peta || !grup) return undefined;
    const wadah = peta.getContainer().getBoundingClientRect();
    const calon = [];
    grup.eachLayer((lapisan) => {
      const b = lapisan.getBounds();
      const a = peta.latLngToContainerPoint(b.getNorthWest());
      const z = peta.latLngToContainerPoint(b.getSouthEast());
      const kotak = new DOMRect(wadah.left + a.x, wadah.top + a.y, z.x - a.x, z.y - a.y);
      if (bebas(kotak)) calon.push([lapisan, kotak]);
    });
    if (!calon.length) return undefined;
    calon.sort((p, q) => p[1].x - q[1].x);
    const loncat = Math.ceil(calon.length / 5);
    const urutan = calon.filter((_, k) => k % loncat === 0);
    let n = 0;
    let disorot = null;
    const berikut = () => {
      disorot?.fire('mouseout');
      const [lapisan, kotak] = urutan[n % urutan.length];
      lapisan.fire('mouseover', { latlng: lapisan.getBounds().getCenter() });
      disorot = lapisan;
      setKotak(kotak);
      n += 1;
    };
    berikut();
    const jeda = setInterval(berikut, 1600);
    return () => {
      clearInterval(jeda);
      disorot?.fire('mouseout');
    };
  }, []);

  const gayaProvinsi = (feature) => gayaBatasProvinsi(feature, provinsiTerpilih, profil);

  useEffect(() => {
    const grup = refProvinsi.current;
    if (!grup) return;
    const kodeAktif = provinsiTerpilih?.properties?.kode_bps;
    grup.eachLayer((lapisan) => {
      lapisan.setStyle(gayaBatasProvinsi(lapisan.feature, provinsiTerpilih, profil));
      if (kodeAktif && lapisan.feature?.properties?.kode_bps === kodeAktif) {
        lapisan.bringToFront();
      }
    });
    refHaloProvinsi.current?.eachLayer((lapisan) =>
      lapisan.setStyle(gayaHaloProvinsi(lapisan.feature, provinsiTerpilih, profil))
    );
  }, [provinsiTerpilih, basemap, provinsiGeo, profil]);
  const toggleDataLayer = (layerId) => {
    setActiveDataLayers((aktif) =>
      aktif.includes(layerId) ? aktif.filter((id) => id !== layerId) : [...aktif, layerId]
    );
  };

  useEffect(() => {
    let batal = false;
    api.get('/inti/provinsi/peta/', { params: { ringkas: 1 } })
      .then(({ data }) => { if (!batal) setProvinsiRingkas(data); })
      .catch(err => console.error('Gagal memuat batas provinsi', err));
    return () => { batal = true; };
  }, []);

  const perluDetail = zoomDekat && !provinsiDetail;
  useEffect(() => {
    if (!perluDetail) return undefined;
    let batal = false;
    api.get('/inti/provinsi/peta/')
      .then(({ data }) => { if (!batal) setProvinsiDetail(data); })
      .catch(err => console.error('Gagal memuat batas provinsi', err));
    return () => { batal = true; };
  }, [perluDetail]);

  const kodeTerpilih = provinsiTerpilih?.properties?.kode_bps;
  const haloGeo = useMemo(() => {
    const fitur = kodeTerpilih && provinsiGeo?.features.find((f) => f.properties?.kode_bps === kodeTerpilih);
    return fitur ? { type: 'FeatureCollection', features: [fitur] } : null;
  }, [provinsiGeo, kodeTerpilih]);
  const versiBatas = provinsiGeo === provinsiDetail ? 'detail' : 'ringkas';

  useEffect(() => {
    if (!mapLayers.length) return;
    const init = {};
    mapLayers.forEach(l => { init[l.id] = true });
    setLayerVisibility(init);
  }, [mapLayers]);

  const handlePolygonCompletedInternal = (geometry, poly) => {
    setIsDrawing(false);
    setVertexCount(0);
    if (geometry && poly) {
      setHasPolygon(true);
      onPolygonCompleted(geometry);
    } else {
      setHasPolygon(false);
    }
  };

  const handleStartDrawing = () => {
    setModeUkur(false);
    setModeUbah(false);
    drawerRef.current?.startDrawing();
    setIsDrawing(true);
    setHasPolygon(false);
    setPeringatanUnggah([]);
    setVertexCount(0);
    setLayerVisibility({});
    setError(null);
    setPanelOpen(false);
  };

  useEffect(() => {
    if (!petaSiap) return;
    if (cari.get('mulai') === 'gambar') handleStartDrawing();
    const lokasi = cari.get('lokasi');
    if (lokasi) {
      api.get(`${LAYER_LOKAL.potensi.url.replace(/peta\/$/, '')}${encodeURIComponent(lokasi)}/`)
        .then(({ data }) => {
          if (data?.sektor_kode) onPilihSektor?.(data.sektor_kode, data.sub_sektor_kode || null);
          drawerRef.current?.loadGeometry(data?.geometry);
        })
        .catch(() => setError('Batas lokasi potensial tidak dapat dimuat.'));
    }
  }, [petaSiap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = () => drawerRef.current?.finish();
  const handleUndo = () => drawerRef.current?.undo();
  const handleCancel = () => { drawerRef.current?.cancel(); setIsDrawing(false); setVertexCount(0); };
  
  const handleReset = () => {
    drawerRef.current?.removePolygon();
    setHasPolygon(false);
    setModeUbah(false);
    setLayerVisibility({});
    setError(null);
    setPeringatanUnggah([]);
    setPanelOpen(false);
  };

  const mulaiUbah = () => {
    setError(null);
    if (drawerRef.current?.ubahTitik()) setModeUbah(true);
    else setError(`Area ini memiliki lebih dari ${BATAS_TITIK_UBAH} titik sehingga tidak dapat digeser satu per satu. Gambar ulang atau unggah ulang berkasnya.`);
  };
  const selesaiUbah = () => { setModeUbah(false); drawerRef.current?.selesaiUbah(); };
  const batalUbah = () => { setModeUbah(false); drawerRef.current?.batalUbah(); };

  const canFinish = vertexCount >= 3;

  return (
    <div className="w-full h-full absolute inset-0 z-0 flex">
      <div className="flex-1 relative h-full">
        <MapContainer
          ref={refPeta}
          whenReady={() => setPetaSiap(true)}
          center={[-2.5489, 118.0149]}
          zoom={5}
          {...BATAS_PETA}
          maxZoom={19}
          zoomControl={false}
          className="w-full h-full"
          style={{ background: '#F8F8FB' }}
        >
          <TileLayer
            url={URL_PETA_DASAR[basemap]}
            attribution='&copy; KKP RI - Sistem Informasi Spasial'
            maxZoom={19}
            maxNativeZoom={18}
            crossOrigin
          />

          <PaneBatas onSiap={setKanvasBatas} />
          <KunciLapisanSaatMenggambar menggambar={isDrawing || modeUbah} />

          {activeDataLayers
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

          {activeDataLayers
            .filter((id) => LAYER_LOKAL[id]?.url)
            .map((id) => (
              <LapisanVektorBBox
                key={`lokal-${id}`}
                url={LAYER_LOKAL[id].url}
                params={{
                  ...(LAYER_LOKAL[id].params || {}),
                  ...(sektorLapisan[id] ? { [LAYER_LOKAL[id].pilihan?.param || 'sektor']: sektorLapisan[id] } : {}),
                  ...(wilayahLapisan[id] ? { provinsi: wilayahLapisan[id] } : {}),
                }}
                style={LAYER_LOKAL[id].gaya}
                gayaTitik={LAYER_LOKAL[id].titik}
                ikon={LAYER_LOKAL[id].ikon}
                warnaIkon={LAYER_LOKAL[id].warnaIkon}
                warnaTitik={LAYER_LOKAL[id].warnaTitik}
                zoomPin={LAYER_LOKAL[id].zoomPin}
                onStatus={(st) => catatStatus(id, st)}
                onEachFeature={(feature, layer) => {
                  const p = feature?.properties || {};
                  layer.bindPopup(() => LAYER_LOKAL[id].popup(p), {
                    maxHeight: Math.max(220, window.innerHeight - JARAK_POPUP.atas - JARAK_POPUP.bawah - 40),
                    autoPanPaddingTopLeft: [16, JARAK_POPUP.atas],
                    autoPanPaddingBottomRight: [JARAK_POPUP.kanan, JARAK_POPUP.bawah],
                  });
                  const judul = LAYER_LOKAL[id].tooltip?.(p) || p.nama || p.pemohon;
                  if (judul) layer.bindTooltip(judul, { sticky: true, className: 'map-tooltip' });
                  layer.on('popupopen', (e) => {
                    e.popup
                      .getElement()
                      ?.querySelector('[data-analisis-lokasi]')
                      ?.addEventListener('click', async () => {
                        layer.closePopup();
                        let geometri = feature.geometry;
                        let sektor = p.sektor_kode || p.jenis?.[0] || null;
                        let sub = p.sub_sektor_kode || null;
                        if (feature.id !== undefined && feature.id !== null) {
                          try {
                            const { data } = await api.get(LAYER_LOKAL[id].url.replace(/peta\/$/, `${feature.id}/`));
                            geometri = data?.geometry || geometri;
                            sektor = data?.sektor_kode || sektor;
                            sub = data?.sub_sektor_kode || sub;
                          } catch {
                            geometri = feature.geometry;
                          }
                        }
                        if (sektor) onPilihSektor?.(sektor, sub);
                        drawerRef.current?.loadGeometry(geometri);
                      });
                  });
                }}
              />
            ))}

          <PemantauZoom ambang={ZOOM_BATAS_DETAIL} onUbah={setZoomDekat} />

          {haloGeo && kanvasBatas && (
            <GeoJSON
              key={`layer-provinsi-halo-${basemap}-${kodeTerpilih}-${versiBatas}`}
              ref={refHaloProvinsi}
              data={haloGeo}
              pane={PANE_HALO}
              renderer={kanvasBatas.halo}
              interactive={false}
              style={(feature) => gayaHaloProvinsi(feature, provinsiTerpilih, profil)}
            />
          )}
          {provinsiGeo && kanvasBatas && (
            <GeoJSON
              key={`layer-provinsi-${versiBatas}`}
              ref={refProvinsi}
              data={provinsiGeo}
              pane={PANE_PROVINSI}
              renderer={kanvasBatas.batas}
              style={gayaProvinsi}
              onEachFeature={(feature, layer) => {
                const nama = feature?.properties?.nama;
                if (nama) layer.bindTooltip(nama, { sticky: true, direction: 'top', className: 'map-tooltip' });
                layer.on({
                  click: () => setProvinsiTerpilih(feature),
                  mouseover: (e) => {
                    const p = refProfil.current;
                    e.target.setStyle({ fillOpacity: p.isiAktif * 0.8, weight: 2, opacity: 1 });
                    e.target.bringToFront();
                  },
                  mouseout: (e) => e.target.setStyle(gayaBatasProvinsi(feature, refTerpilih.current, refProfil.current)),
                });
              }}
            />
          )}

          <KontrolPeta
            fokus={fokus}
            currentBasemap={basemap}
            setBasemap={setBasemap}
            activeLayers={activeDataLayers}
            toggleLayer={toggleDataLayer}
            daftarLapisan={LAYER_LOKAL}
            wilayahLapisan={wilayahLapisan}
            sektorLapisan={sektorLapisan}
            setSektorLapisan={pilihSektorLapisan}
            setWilayahLapisan={pilihWilayahLapisan}
            statusLapisan={statusLapisan}
            modeUkur={modeUkur}
            setModeUkur={(nilai) => {
              if (nilai) {
                drawerRef.current?.cancel();
                setIsDrawing(false);
                setVertexCount(0);
              }
              setModeUkur(nilai);
            }}
            onTur={() => setTurAktif(true)}
            lapisanAwal={lapisanAwal}
          />
          
          <ScaleControl position="bottomleft" imperial={false} maxWidth={200} />
          <MouseTracker onMouseMove={setMousePosition} />

          <DrawingLayer ref={drawerRef} onPolygonCompleted={handlePolygonCompletedInternal} onVertexCountChange={setVertexCount} />
          
          <MapOverlayLayers layers={mapLayers} visibility={layerVisibility} />

          <PetaMini />
        </MapContainer>

        <LegendaPeta
          wmsUrl={WMS_KKP}
          daftarLayer={LAYER_WMS}
          daftarLokal={LAYER_LOKAL}
          layerAktif={activeDataLayers}
          sektorLapisan={sektorLapisan}
          setSektorLapisan={pilihSektorLapisan}
        />

        <PanelDetailProvinsi fitur={provinsiTerpilih} onTutup={() => setProvinsiTerpilih(null)} />

        <TurPeta aktif={turAktif} setAktif={setTurAktif} peraga={peragakanProvinsi} />

        {isDrawing && (
          <div className="absolute top-[9.5rem] left-4 right-[4.5rem] md:top-24 md:left-[22rem] xl:left-1/2 xl:right-auto xl:-translate-x-1/2 z-[1150] flex xl:w-max xl:max-w-[calc(100vw-10rem)] flex-col items-center gap-3">
            <div className="bg-white/95 backdrop-blur-md rounded-xl px-5 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-200">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-600 text-white hover:bg-sky-700" />
              </span>
              <span className="text-sky-600 font-bold text-sm uppercase tracking-wider">Mode Menggambar</span>
              <div className="w-px h-5 bg-slate-300" />
              <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-slate-800 text-lg font-bold">{vertexCount}</span>
                <span className="text-slate-500 text-xs">titik</span>
              </span>
              <div className="hidden sm:block w-px h-5 bg-slate-300" />
              <span className="text-slate-500 text-xs font-medium">Klik peta = tambah titik<span className="hidden sm:inline"> &nbsp;•&nbsp; seret titik = geser &nbsp;•&nbsp; Enter = selesai</span></span>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={handleUndo} disabled={vertexCount === 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${vertexCount > 0 ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-sky-600 shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Undo
              </button>
              <button onClick={handleCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 shadow-sm transition-all">
                Batal
              </button>
              <button onClick={handleFinish} disabled={!canFinish}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold border transition-all shadow-sm ${canFinish ? 'bg-sky-600 text-white hover:bg-sky-700 border-sky-600' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Selesai Menggambar {!canFinish && <span className="font-normal opacity-70 ml-1">(min. 3)</span>}
              </button>
            </div>
          </div>
        )}

        {modeUbah && (
          <div className="absolute top-[9.5rem] left-4 right-[4.5rem] md:top-24 md:left-[22rem] xl:left-1/2 xl:right-auto xl:-translate-x-1/2 z-[1150] flex xl:w-max xl:max-w-[calc(100vw-10rem)] flex-col items-center gap-3">
            <div className="bg-white/95 backdrop-blur-md rounded-xl px-5 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-slate-200">
              <Move className="w-4 h-4 text-sky-600" />
              <span className="text-sky-600 font-bold text-sm uppercase tracking-wider">Mode Ubah Titik</span>
              <div className="w-px h-5 bg-slate-300" />
              <span className="text-slate-500 text-xs font-medium">Seret titik putih untuk menggeser sudut area</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={batalUbah}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 bg-white hover:bg-red-50 shadow-sm transition-all">
                Batal
              </button>
              <button onClick={selesaiUbah}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold border transition-all shadow-sm bg-sky-600 text-white hover:bg-sky-700 border-sky-600">
                Selesai Mengubah
              </button>
            </div>
          </div>
        )}

        {!isDrawing && !modeUbah && (
          <div
            data-aksi-peta
            className="absolute bottom-24 left-4 right-[4.5rem] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[1000] flex flex-col gap-3 sm:w-max sm:max-w-[calc(100vw-10rem)]"
          >
            {!hasPolygon && (
              <div className="flex flex-wrap justify-center gap-3">
                <button data-tur="gambar" onClick={handleStartDrawing}
                  className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-sky-600 hover:opacity-90 transition-all whitespace-nowrap">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                  Gambar Area Proyek Baru
                </button>
                <UnggahGeospasial
                  onUploadSuccess={(geometry) => drawerRef.current?.loadGeometry(geometry)}
                  onError={setError}
                  onPeringatan={setPeringatanUnggah}
                  disabled={false}
                  buttonText="Upload File Geospasial"
                  className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-sky-600 hover:opacity-90 transition-all whitespace-nowrap"
                />
              </div>
            )}
            
            {hasPolygon && !panelOpen && !mapLayers.length && (
              <p className="self-center rounded-lg bg-white/95 backdrop-blur-md border border-slate-200 px-4 py-2 text-xs text-slate-600 shadow-lg text-center">
                Periksa batas area di peta. Bila sudah benar, lanjutkan dengan mengisi parameter analisis.
              </p>
            )}
            {hasPolygon && !panelOpen && (
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => setPanelOpen(true)}
                  className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white border transition-all shadow-lg whitespace-nowrap bg-sky-600 hover:bg-sky-700 border-amber-300/50 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:-translate-y-1">
                  Isi Parameter Analisis
                </button>
                <button onClick={() => drawerRef.current?.sorotPoligon()}
                  title="Bawa peta kembali ke area yang digambar"
                  className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 bg-white/95 backdrop-blur-md border border-slate-200 hover:text-sky-600 hover:border-sky-300 shadow-lg transition-all whitespace-nowrap">
                  <Crosshair className="w-4 h-4" />
                  Kembali ke Area
                </button>
                <button onClick={mulaiUbah}
                  title="Geser titik sudut area yang sudah digambar atau diunggah"
                  className="flex items-center gap-2.5 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 bg-white/95 backdrop-blur-md border border-slate-200 hover:text-sky-600 hover:border-sky-300 shadow-lg transition-all whitespace-nowrap">
                  <Move className="w-4 h-4" />
                  Ubah Titik
                </button>
                <UnggahGeospasial
                  onUploadSuccess={(geometry) => drawerRef.current?.loadGeometry(geometry)}
                  onError={setError}
                  onPeringatan={setPeringatanUnggah}
                  disabled={false}
                  buttonText="Upload Ulang"
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-sm border shadow-lg transition-all whitespace-nowrap text-slate-600 bg-white hover:bg-slate-50 border-slate-200"
                />
                <button onClick={handleReset}
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-sm text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 shadow-lg transition-all whitespace-nowrap">
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        {peringatanUnggah.length > 0 && !error && (
          <div className="absolute top-[9.5rem] left-4 right-[4.5rem] md:top-24 md:left-[22rem] xl:left-1/2 xl:right-auto xl:-translate-x-1/2 z-[1150] xl:w-full xl:max-w-md">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3 shadow-lg">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div className="min-w-0 flex-1">
                <span className="font-bold">Periksa file unggahan:</span>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  {peringatanUnggah.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
              <button onClick={() => setPeringatanUnggah([])} aria-label="Tutup peringatan" className="text-amber-700 hover:text-amber-900 font-bold">×</button>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-[9.5rem] left-4 right-[4.5rem] md:top-24 md:left-[22rem] xl:left-1/2 xl:right-auto xl:-translate-x-1/2 z-[1150] xl:w-full xl:max-w-md">
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-3 shadow-lg">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div><span className="font-bold">Error:</span> {error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetaInteraktif;