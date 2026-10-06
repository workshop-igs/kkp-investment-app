import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';
import { api } from '../api/klien';
import { RingkasanProvinsi, UnduhProfilProvinsi } from '../components/map/PanelDetailProvinsi';
import { BATAS_INDONESIA, BATAS_PETA, URL_PETA_DASAR } from '../components/map/PetaInteraktif';


const gayaProvinsi = (fitur, kode) => {
  if (!kode) return { color: '#fde047', weight: 1.2, opacity: 0.9, fillColor: '#38bdf8', fillOpacity: 0.14 };
  return fitur.properties.kode_bps === kode
    ? { color: '#fbbf24', weight: 3, opacity: 1, fillColor: '#fbbf24', fillOpacity: 0.22 }
    : { color: '#ffffff', weight: 0.6, opacity: 0.45, fillColor: '#ffffff', fillOpacity: 0 };
};

const Sorot = ({ refGeo, kode }) => {
  const map = useMap();
  useEffect(() => {
    const grup = refGeo.current;
    if (!grup) return;
    let target = null;
    grup.eachLayer((lapisan) => {
      lapisan.setStyle(gayaProvinsi(lapisan.feature, kode));
      if (kode && lapisan.feature.properties.kode_bps === kode) target = lapisan;
    });
    if (target) {
      target.bringToFront();
      map.flyToBounds(target.getBounds(), { padding: [40, 40], duration: 0.8 });
    } else {
      map.flyToBounds(BATAS_INDONESIA, { duration: 0.8 });
    }
  }, [map, refGeo, kode]);
  return null;
};

const PetaSatelit = ({ geo, kode, label, onPilih }) => {
  const refGeo = useRef(null);
  return (
    <div className="relative z-0 h-full w-full bg-slate-900">
      <MapContainer bounds={BATAS_INDONESIA} {...BATAS_PETA} preferCanvas zoomControl={false} className="h-full w-full" style={{ background: '#0b1a2e' }}>
        <TileLayer url={URL_PETA_DASAR.satellite} attribution="Citra satelit &copy; Esri" maxZoom={19} maxNativeZoom={18} />
        {geo && (
          <GeoJSON
            ref={refGeo}
            data={geo}
            style={(f) => gayaProvinsi(f, kode)}
            onEachFeature={(f, lapisan) => {
              lapisan.bindTooltip(f.properties.nama, { sticky: true, className: 'map-tooltip' });
              lapisan.on('click', () => onPilih(f.properties.kode_bps));
            }}
          />
        )}
        {geo && <Sorot refGeo={refGeo} kode={kode} />}
      </MapContainer>
      <div className="absolute top-4 left-4 z-[1000] rounded-lg bg-slate-900/80 backdrop-blur px-3 py-2 text-sm font-semibold text-white shadow-lg">
        {label}
      </div>
      {!geo && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center text-sm text-white/80">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat batas provinsi…
        </div>
      )}
    </div>
  );
};

const Pilihan = ({ label, value, onChange, children }) => (
  <label className="block">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
    >
      {children}
    </select>
  </label>
);

const ProfilProvinsi = ({ fitur, daftarProvinsi, pilihProvinsi, jenisAwal }) => {
  const p = fitur?.properties;
  return (
    <div className="space-y-5">
      <Pilihan label="Provinsi" value={p?.kode_bps || ''} onChange={pilihProvinsi}>
        <option value="">Pilih provinsi…</option>
        {daftarProvinsi.map((f) => (
          <option key={f.properties.kode_bps} value={f.properties.kode_bps}>{f.properties.nama}</option>
        ))}
      </Pilihan>
      {!p && (
        <p className="text-sm text-slate-500 leading-relaxed">
          Pilih provinsi dari daftar di atas atau klik provinsinya langsung di peta.
        </p>
      )}
      {p && (
        <>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5" /> Provinsi · Kode BPS {p.kode_bps}
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-kkp-900">{p.nama}</h2>
          </div>
          <div className="space-y-4">
            <RingkasanProvinsi p={p} />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <UnduhProfilProvinsi key={p.kode_bps} p={p} jenisAwal={jenisAwal} />
          </div>
        </>
      )}
    </div>
  );
};

const ProfilInvestasiPage = () => {
  const [cari, setCari] = useSearchParams();
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    let batal = false;
    api.get('/inti/provinsi/peta/')
      .then(({ data }) => { if (!batal) setGeo(data); })
      .catch(() => { if (!batal) setGeo({ type: 'FeatureCollection', features: [] }); });
    return () => { batal = true; };
  }, []);

  const kode = cari.get('provinsi') || '';

  const daftarProvinsi = useMemo(
    () => [...(geo?.features || [])].sort((a, b) => a.properties.nama.localeCompare(b.properties.nama, 'id')),
    [geo],
  );
  const fitur = daftarProvinsi.find((f) => f.properties.kode_bps === kode);

  const pilihProvinsi = useCallback((k) => setCari((sebelum) => {
    const baru = new URLSearchParams(sebelum);
    baru.set('provinsi', k || '');
    return baru;
  }), [setCari]);

  return (
    <div className="h-full pt-[72px] flex flex-col-reverse lg:flex-row bg-white">
      <aside className="flex-1 lg:flex-none lg:w-[27rem] min-h-0 overflow-y-auto border-r border-slate-200 custom-scrollbar">
        <div className="p-5 lg:p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-kkp-900">Profil Investasi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Dokumen profil investasi per provinsi: lengkap untuk seluruh jenis investasi, atau untuk satu jenis tertentu.
            </p>
          </div>
          <ProfilProvinsi fitur={fitur} daftarProvinsi={daftarProvinsi} pilihProvinsi={pilihProvinsi} jenisAwal={cari.get('jenis')} />
        </div>
      </aside>
      <div className="h-[42vh] lg:h-auto lg:flex-1 shrink-0">
        <PetaSatelit
          geo={geo}
          kode={kode}
          label={fitur?.properties.nama || 'Pilih provinsi di peta'}
          onPilih={pilihProvinsi}
        />
      </div>
    </div>
  );
};

export default ProfilInvestasiPage;
