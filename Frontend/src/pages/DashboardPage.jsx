import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, Users, MapPin, DollarSign, 
  Layers, Filter, Download, ArrowUpRight, 
  RefreshCw, BarChart3, PieChart as PieIcon, 
  ChevronRight, Compass, 
  Globe, Building2, Anchor, Maximize2, Minimize2
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatNumber, rupiahMiliar, rupiahRingkas } from '../utils/pemformat';
import {
  RAMP_BIRU, SERI, TINTA, gayaBatang, opsiDasar, potong, sumbuKategori,
  sumbuNilai, warnaSeri,
} from '../utils/temaGrafik';
import { LABEL_TAHAPAN, TAHAPAN_PROYEK } from '../utils/konstanta';

const TAHAPAN_WARNA = [RAMP_BIRU[1], RAMP_BIRU[2], RAMP_BIRU[3], RAMP_BIRU[4], RAMP_BIRU[6]];

const URUTAN_TAHAPAN = TAHAPAN_PROYEK.map((t) => t.kode);
const WARNA_TAHAPAN = Object.fromEntries(
  URUTAN_TAHAPAN.map((kode, i) => [kode, TAHAPAN_WARNA[i]]),
);
import { api } from '../api/klien';
import { BATAS_INDONESIA } from '../components/map/PetaInteraktif';

const DIAMETER_PENANDA = 15;

const SEL_GUGUS_PIKSEL = 44;

const createMarkerIcon = (warna) => {
  const d = DIAMETER_PENANDA;
  return L.divIcon({
    className: 'custom-dashboard-marker',
    html: `<div style="width:${d}px;height:${d}px;border-radius:50%;background:${warna};border:2.5px solid #ffffff;box-shadow:0 1px 3px rgba(15,23,42,.45)"></div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    popupAnchor: [0, -d / 2],
  });
};

const createGugusIcon = (jumlah) => {
  const d = jumlah >= 50 ? 46 : jumlah >= 10 ? 40 : 34;
  const hrf = jumlah >= 100 ? 11 : 12;
  return L.divIcon({
    className: 'custom-dashboard-cluster',
    html: `<div style="width:${d}px;height:${d}px;border-radius:50%;background:rgba(2,132,199,.92);border:3px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${hrf}px/1 ui-sans-serif,system-ui,sans-serif">${jumlah}</div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
    popupAnchor: [0, -d / 2],
  });
};

const gugusPenanda = (map, markers, zoom) => {
  const sel = new Map();
  markers.forEach((m) => {
    if (m.lat === null || m.lat === undefined) return;
    if (m.lng === null || m.lng === undefined) return;
    const p = map.project([m.lat, m.lng], zoom);
    const kunci = `${Math.floor(p.x / SEL_GUGUS_PIKSEL)}:${Math.floor(p.y / SEL_GUGUS_PIKSEL)}`;
    const isi = sel.get(kunci);
    if (isi) isi.push(m);
    else sel.set(kunci, [m]);
  });
  return [...sel.values()];
};
const LapisanGugus = ({ markers, children }) => {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const gugus = useMemo(
    () => gugusPenanda(map, markers, zoom),
    [map, markers, zoom],
  );

  return (
    <>
      {gugus.map((isi) => {
        if (isi.length === 1) return children(isi[0]);

        const lat = isi.reduce((t, m) => t + m.lat, 0) / isi.length;
        const lng = isi.reduce((t, m) => t + m.lng, 0) / isi.length;
        const nilai = isi.reduce((t, m) => t + (m.nilai_investasi_miliar || 0), 0);
        const kunci = `gugus-${isi.map((m) => m.id).join("-")}`;

        return (
          <Marker
            key={kunci}
            position={[lat, lng]}
            icon={createGugusIcon(isi.length)}
            eventHandlers={{
              click: () => map.flyTo([lat, lng], Math.min(map.getZoom() + 3, 18)),
            }}
          >
            <Popup className="custom-popup" maxWidth={260}>
              <div className="p-1 font-sans">
                <p className="font-bold text-sm text-slate-900">
                  {isi.length} proyek di sekitar sini
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total rencana {rupiahMiliar(nilai)}
                </p>
                <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {isi.slice(0, 6).map((m) => (
                    <li key={m.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: WARNA_TAHAPAN[m.status] || "#64748b" }}
                      />
                      <span className="truncate">{m.nama}</span>
                    </li>
                  ))}
                </ul>
                {isi.length > 6 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    +{isi.length - 6} lainnya — perbesar peta untuk melihat semuanya
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

const MapResizeHandler = ({ pemicu }) => {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map?.invalidateSize(), 220);
    return () => clearTimeout(t);
  }, [map, pemicu]);
  return null;
};

const KunciBatasIndonesia = () => {
  const map = useMap();
  useEffect(() => {
    const batas = L.latLngBounds(BATAS_INDONESIA);
    const atur = () => {
      map.setMinZoom(map.getBoundsZoom(batas));
      map.setMaxBounds(batas.pad(0.15));
    };
    atur();
    map.on('resize', atur);
    return () => {
      map.off('resize', atur);
    };
  }, [map]);
  return null;
};

const sumbuRupiah = () => sumbuNilai('Rupiah', (v) => `Rp ${rupiahRingkas(v * 1e9)}`);

const MapBoundsFitter = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (map && markers && markers.length > 0) {
      try {
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
        }
      } catch (e) {
        console.error("Bounds fit error:", e);
      }
    }
  }, [map, markers]);
  return null;
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const [selectedSektor, setSelectedSektor] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedProvinsi, setSelectedProvinsi] = useState('all');
  const [mapBaseLayer, setMapBaseLayer] = useState('carto');
  const [layarPenuh, setLayarPenuh] = useState(false);
  const wadahPetaRef = useRef(null);

  const alihkanLayarPenuh = useCallback(() => {
    const el = wadahPetaRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onChange = () => setLayarPenuh(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result } = await api.get('/inti/dashboard/');
      setData(result);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      const kode = err.response?.status;
      setError(
        kode === 401 || kode === 403
          ? 'Sesi Anda tidak lagi berlaku. Masuk kembali untuk melihat dashboard.'
          : kode
            ? `Gagal memuat data (${kode}).`
            : err.message || 'Terjadi kesalahan saat memuat dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const filteredMarkers = useMemo(() => {
    if (!data?.map_markers) return [];
    return data.map_markers.filter(m => {
      const matchSektor = selectedSektor === 'all' || m.sektor_nama === selectedSektor;
      const matchStatus = selectedStatus === 'all' || m.status === selectedStatus;
      const matchProv = selectedProvinsi === 'all' || m.provinsi_nama === selectedProvinsi;
      return matchSektor && matchStatus && matchProv;
    });
  }, [data, selectedSektor, selectedStatus, selectedProvinsi]);

  const dynamicKPI = useMemo(() => {
    if (!data?.summary) return null;
    if (selectedSektor === 'all' && selectedStatus === 'all' && selectedProvinsi === 'all') {
      return data.summary;
    }

    const count = filteredMarkers.length;
    const totalInvestasi = filteredMarkers.reduce((acc, m) => acc + (m.nilai_investasi_miliar || 0), 0);
    const totalRealisasi = filteredMarkers.reduce((acc, m) => acc + (m.nilai_realisasi_miliar || 0), 0);
    const totalLuas = filteredMarkers.reduce((acc, m) => acc + (m.luas_ha || 0), 0);
    const totalTk = filteredMarkers.reduce((acc, m) => acc + (m.proyeksi_tenaga_kerja || 0), 0);
    const pctRealisasi = totalInvestasi > 0 ? Math.round((totalRealisasi / totalInvestasi) * 1000) / 10 : 0;
    
    return {
      ...data.summary,
      total_proyek: count,
      total_investasi_miliar: Math.round(totalInvestasi * 10) / 10,
      total_realisasi_miliar: Math.round(totalRealisasi * 10) / 10,
      pct_realisasi: pctRealisasi,
      total_luas_ha: Math.round(totalLuas * 10) / 10,
      total_tenaga_kerja: totalTk
    };
  }, [data, filteredMarkers, selectedSektor, selectedStatus, selectedProvinsi]);

  const availableSektors = useMemo(() => {
    if (!data?.proyek_per_sektor) return [];
    return data.proyek_per_sektor.map(s => s.sektor_nama).filter(Boolean);
  }, [data]);

  const availableProvinces = useMemo(() => {
    if (!data?.proyek_per_provinsi) return [];
    return data.proyek_per_provinsi.map(p => p.provinsi_nama).filter(Boolean);
  }, [data]);

  const sektorBarChartData = useMemo(() => {
    const sectors = data?.proyek_per_sektor || [];
    return {
      labels: sectors.map(s => potong(s.sektor_nama, 26)),
      namaPenuh: sectors.map(s => s.sektor_nama),
      datasets: [
        { label: 'Rencana', data: sectors.map(s => s.total_rencana_miliar), ...gayaBatang(warnaSeri(0)) },
        { label: 'Realisasi', data: sectors.map(s => s.total_realisasi_miliar), ...gayaBatang(warnaSeri(2)) },
      ],
    };
  }, [data]);

  const sektorDoughnutData = useMemo(() => {
    const semua = [...(data?.proyek_per_sektor || [])]
      .sort((a, b) => (b.total_rencana_miliar || 0) - (a.total_rencana_miliar || 0));
    const utama = semua.slice(0, 6);
    const sisa = semua.slice(6);
    const potongan = [...utama];
    if (sisa.length) {
      potongan.push({
        sektor_nama: `Lainnya (${sisa.length} sektor)`,
        total_rencana_miliar: sisa.reduce((a, s) => a + (s.total_rencana_miliar || 0), 0),
      });
    }
    return {
      labels: potongan.map(s => s.sektor_nama),
      datasets: [
        {
          data: potongan.map(s => s.total_rencana_miliar),
          backgroundColor: potongan.map((_, i) =>
            i < 6 ? warnaSeri(i) : '#cbd5e1'),
          borderWidth: 2,
          borderColor: TINTA.permukaan,
          hoverOffset: 6,
        },
      ],
    };
  }, [data]);

  const provinsiBarData = useMemo(() => {
    const provinces = (data?.proyek_per_provinsi || []).slice(0, 7);
    return {
      labels: provinces.map(p => p.provinsi_nama),
      datasets: [
        {
          label: 'Total Investasi',
          data: provinces.map(p => p.total_rencana_miliar),
          ...gayaBatang(warnaSeri(0), { barPercentage: 0.78, categoryPercentage: 0.82 }),
        }
      ]
    };
  }, [data]);

  const statusChartData = useMemo(() => {
    const statuses = data?.proyek_per_status || [];
    return {
      labels: statuses.map(s => s.label),
      datasets: [
        {
          label: 'Nilai Portofolio',
          data: statuses.map(s => s.total_miliar),
          ...gayaBatang(SERI[0]),
          backgroundColor: TAHAPAN_WARNA,
          borderColor: TAHAPAN_WARNA,
        }
      ]
    };
  }, [data]);

  const urutanSektor = useMemo(() => {
    return [...(data?.proyek_per_sektor || [])]
      .sort((a, b) => (b.total_rencana_miliar || 0) - (a.total_rencana_miliar || 0));
  }, [data]);

  const tenagaKerjaChartData = useMemo(() => ({
    labels: urutanSektor.map(s => potong(s.sektor_nama, 26)),
    datasets: [
      {
        label: 'Serapan tenaga kerja',
        data: urutanSektor.map(s => s.total_tk),
        ...gayaBatang(warnaSeri(3)),
      },
    ],
  }), [urutanSektor]);

  const investasiSektorChartData = useMemo(() => ({
    labels: urutanSektor.map(s => potong(s.sektor_nama, 26)),
    datasets: [
      {
        label: 'Nilai investasi',
        data: urutanSektor.map(s => s.total_rencana_miliar),
        ...gayaBatang(warnaSeri(0)),
      },
    ],
  }), [urutanSektor]);

  const handleExportCSV = () => {
    if (!filteredMarkers.length) return;
    const sel = (v) => (typeof v === 'number'
      ? v.toLocaleString('id-ID', { useGrouping: false, maximumFractionDigits: 2 })
      : `"${String(v ?? '').replace(/"/g, '""')}"`);
    const baris = [
      ['Kode Proyek', 'Nama Proyek', 'Investor', 'Sektor', 'Provinsi', 'Tahap', 'Nilai Investasi (Miliar Rp)',
        'Realisasi (Miliar Rp)', 'Luas (Ha)', 'Tenaga Kerja (Orang)', 'Skor Kelayakan (%)'],
      ...filteredMarkers.map((m) => [
        m.kode_proyek, m.nama, m.investor, m.sektor_nama, m.provinsi_nama, LABEL_TAHAPAN[m.status] || m.status,
        m.nilai_investasi_miliar || 0, m.nilai_realisasi_miliar || 0, m.luas_ha || 0, m.proyeksi_tenaga_kerja || 0,
        m.skor_kelayakan == null ? '' : m.skor_kelayakan * 100,
      ]),
    ];
    const isi = `\ufeff${baris.map((r) => r.map(sel).join(';')).join('\r\n')}`;
    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    tautan.download = `KKP_Portofolio_Investasi_Nasional_${new Date().toISOString().slice(0, 10)}.csv`;
    tautan.click();
    setTimeout(() => URL.revokeObjectURL(tautan.href), 1000);
  };

  return (
    <div className="pt-24 p-4 lg:p-8 lg:pt-28 h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans">
      <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-8 pb-16">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-100/50 via-teal-50/40 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                <Globe className="w-3 h-3 text-sky-600 animate-pulse" />
                Executive Dashboard
              </span>
              <span className="text-xs text-slate-400">
                Update: {lastRefreshed.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-sky-950 tracking-tight">
              Dashboard Nasional Portofolio Investasi
            </h1>
            <p className="text-slate-500 text-sm max-w-2xl">
              Ikhtisar terpadu kelayakan investasi ruang laut dan sebaran portofolio nasional.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!data?.map_markers?.length}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Ekspor CSV</span>
            </button>

            <Link
              to="/pipeline"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-all shadow-sm shadow-sky-700/20"
            >
              <span>Semua Proyek</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/peta"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-sm shadow-teal-600/20"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Analisis Baru di Peta</span>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Filter Portofolio:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
            <select
              value={selectedSektor}
              onChange={(e) => setSelectedSektor(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-kkp-700"
            >
              <option value="all">Semua Sektor ({availableSektors.length})</option>
              {availableSektors.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-kkp-700"
            >
              <option value="all">Semua Tahap Proyek</option>
              {TAHAPAN_PROYEK.map((t) => (
                <option key={t.kode} value={t.kode}>{t.label}</option>
              ))}
            </select>

            <select
              value={selectedProvinsi}
              onChange={(e) => setSelectedProvinsi(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-kkp-700"
            >
              <option value="all">Seluruh Indonesia (Nasional)</option>
              {availableProvinces.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>

            {(selectedSektor !== 'all' || selectedStatus !== 'all' || selectedProvinsi !== 'all') && (
              <button
                onClick={() => {
                  setSelectedSektor('all');
                  setSelectedStatus('all');
                  setSelectedProvinsi('all');
                }}
                className="text-xs text-sky-600 hover:text-sky-800 font-medium underline px-1"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          
          <div className="bg-white border border-slate-200/80 shadow-sm p-5 rounded-2xl relative overflow-hidden group hover:border-sky-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-sky-100 text-sky-700 rounded-xl flex items-center justify-center border border-sky-200 shadow-inner">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Portofolio</span>
                <span className="text-xs font-bold text-slate-700">Rencana Investasi</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-sky-950">
              {rupiahMiliar(dynamicKPI?.total_investasi_miliar || 0)}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Realisasi:</span>
              <span className="font-semibold text-emerald-600">{rupiahMiliar(dynamicKPI?.total_realisasi_miliar || 0)}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-sm p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-200 shadow-inner">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Capaian</span>
                <span className="text-xs font-bold text-slate-700">Tingkat Realisasi</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-950">
              {dynamicKPI?.pct_realisasi || 0}% <span className="text-xs font-normal text-slate-500">terserap</span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, dynamicKPI?.pct_realisasi || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-sm p-5 rounded-2xl relative overflow-hidden group hover:border-blue-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center border border-blue-200 shadow-inner">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Proyek</span>
                <span className="text-xs font-bold text-slate-700">Total Proyek</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-950">
              {dynamicKPI?.total_proyek || 0} <span className="text-xs font-normal text-slate-500">proyek</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Tahap Operasi:</span>
              <span className="font-semibold text-blue-600">
                {data?.proyek_per_status?.find(s => s.status === 'OPERASI')?.count || 0} proyek
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-sm p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-cyan-100 text-cyan-700 rounded-xl flex items-center justify-center border border-cyan-200 shadow-inner">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Spasial</span>
                <span className="text-xs font-bold text-slate-700">Luas Area Laut</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-cyan-950">
              {formatNumber(dynamicKPI?.total_luas_ha || 0, 1)} <span className="text-xs font-normal text-slate-500">Ha</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Setara:</span>
              <span className="font-semibold text-cyan-700">
                {((dynamicKPI?.total_luas_ha || 0) / 100).toFixed(1)} km²
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-sm p-5 rounded-2xl relative overflow-hidden group hover:border-amber-300 transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6 group-hover:scale-125 transition-transform"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center border border-amber-200 shadow-inner">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Sosial</span>
                <span className="text-xs font-bold text-slate-700">Tenaga Kerja</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-950">
              {formatNumber(dynamicKPI?.total_tenaga_kerja || 0, 0)} <span className="text-xs font-normal text-slate-500">orang</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Rata-rata Skor AHP:</span>
              <span className="font-semibold text-amber-700">
                {((dynamicKPI?.avg_skor_kelayakan || 0.79) * 100).toFixed(0)}%
              </span>
            </div>
          </div>

        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Compass className="w-5 h-5 text-sky-600" />
                <h2 className="font-bold text-lg text-slate-800">
                  Peta Sebaran Portofolio Investasi Ruang Laut
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Klik penanda proyek untuk melihat profil ringkas, status tahapan, dan link evaluasi detail.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-white text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMapBaseLayer('carto')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    mapBaseLayer === 'carto'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Peta Terang
                </button>
                <button
                  type="button"
                  onClick={() => setMapBaseLayer('satellite')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    mapBaseLayer === 'satellite'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Satelit
                </button>
              </div>

              <span className="text-xs bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg font-semibold">
                {filteredMarkers.length} Titik Terpetakan
              </span>
            </div>
          </div>

          <div
            ref={wadahPetaRef}
            className={`w-full relative z-0 bg-white ${layarPenuh ? 'h-screen' : 'h-[440px]'}`}
          >
            <button
              type="button"
              onClick={alihkanLayarPenuh}
              title={layarPenuh ? 'Keluar dari layar penuh' : 'Lihat peta layar penuh'}
              className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 rounded-lg p-2.5 shadow-sm text-slate-600 hover:text-kkp-700 hover:border-kkp-200 transition-all"
            >
              {layarPenuh ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <MapContainer
              center={[-2.5, 118.0]}
              zoom={5}
              maxBoundsViscosity={1}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              {mapBaseLayer === 'carto' ? (
                <TileLayer
                  attribution='&copy; Esri &mdash; Sumber: Esri, DeLorme, NAVTEQ'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              ) : (
                <TileLayer
                  attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={18}
                />
              )}

              <MapResizeHandler pemicu={layarPenuh} />
              <KunciBatasIndonesia />
              <MapBoundsFitter markers={filteredMarkers} />

              <LapisanGugus markers={filteredMarkers}>
                {(marker) => {
                  const warnaTahap = WARNA_TAHAPAN[marker.status] || '#64748b';
                  const statusInfo = { label: LABEL_TAHAPAN[marker.status] || marker.status, color: warnaTahap };

                return (
                  <Marker
                    key={marker.id}
                    position={[marker.lat, marker.lng]}
                    icon={createMarkerIcon(warnaTahap)}
                  >
                    <Popup className="custom-popup" maxWidth={320}>
                      <div className="p-1 space-y-2 font-sans">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            {marker.kode_proyek || `PRJ-${marker.id}`}
                          </span>
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-tight">
                            {marker.nama}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {marker.provinsi_nama} {marker.lokasi_detail ? `• ${marker.lokasi_detail}` : ''}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Nilai Rencana</span>
                            <span className="font-bold text-slate-800">{rupiahMiliar(marker.nilai_investasi_miliar)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Luas Area</span>
                            <span className="font-bold text-slate-800">{marker.luas_ha} Ha</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Tenaga Kerja</span>
                            <span className="font-bold text-amber-700">{marker.proyeksi_tenaga_kerja} org</span>
                          </div>
                        </div>

                        <Link
                          to={`/pipeline/${marker.id}`}
                          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 !text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <span>Buka Detail Proyek</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                  );
                }}
              </LapisanGugus>

            </MapContainer>
          </div>

          <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-slate-700">Tahapan Proyek:</span>
              {URUTAN_TAHAPAN.map((kode) => (
                <div key={kode} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full border border-white"
                    style={{
                      backgroundColor: WARNA_TAHAPAN[kode],
                      boxShadow: '0 0 0 1px rgba(15,23,42,.15)',
                    }}
                  />
                  <span className="text-slate-600">
                    {LABEL_TAHAPAN[kode]}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-slate-500 italic">
              Data spasial berbasis proyeksi koordinat WGS84 / EPSG:4326
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-600" />
                  Rencana vs Realisasi Investasi per Sektor
                </h3>
                <p className="text-xs text-slate-500">
                  Komparasi alokasi rencana modal investasi dan realisasi aktual.
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <Bar 
                data={sektorBarChartData}
                options={{
                  ...opsiDasar(),
                  indexAxis: 'y',
                  plugins: {
                    ...opsiDasar().plugins,
                    tooltip: {
                      ...opsiDasar().plugins.tooltip,
                      callbacks: {
                        title: (item) => sektorBarChartData.namaPenuh?.[item[0].dataIndex]
                          || item[0].label,
                        label: (ctx) =>
                          `${ctx.dataset.label}: ${rupiahMiliar(ctx.raw)}`,
                      },
                    },
                  },
                  scales: {
                    x: sumbuRupiah(),
                    y: sumbuKategori(),
                  },
                }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2 mb-1">
                <PieIcon className="w-4 h-4 text-teal-600" />
                Proporsi Portofolio Sektor
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Porsi pembagian nilai investasi kelautan.
              </p>
              <div className="h-56 w-full flex items-center justify-center">
                <Doughnut 
                  data={sektorDoughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      ...opsiDasar().plugins,
                      tooltip: {
                        ...opsiDasar().plugins.tooltip,
                        callbacks: {
                          label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const persen = total ? (ctx.raw / total) * 100 : 0;
                            return `${ctx.label}: ${rupiahMiliar(ctx.raw)} (${persen.toFixed(1)}%)`;
                          },
                        },
                      },
                    },
                    cutout: '68%'
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Total Sektor Aktif:</span>
              <span className="font-bold text-slate-800">{availableSektors.length} Sektor</span>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-sky-600" />
              Top 7 Sebaran Wilayah / Provinsi
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Provinsi dengan nilai investasi kelautan tertinggi.
            </p>
            <div className="h-64 w-full">
              <Bar 
                data={provinsiBarData}
                options={{
                  ...opsiDasar(),
                  indexAxis: 'y',
                  plugins: {
                    ...opsiDasar().plugins,
                    legend: { display: false },
                    tooltip: {
                      ...opsiDasar().plugins.tooltip,
                      callbacks: {
                        label: (ctx) => rupiahMiliar(ctx.raw),
                      },
                    },
                  },
                  scales: {
                    x: sumbuRupiah(),
                    y: sumbuKategori(),
                  },
                }}
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-purple-600" />
              Distribusi per Tahap Proyek
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Nilai kumulatif proyek di setiap fase perizinan.
            </p>
            <div className="h-64 w-full flex items-center justify-center">
              <Bar
                data={statusChartData}
                options={{
                  ...opsiDasar(),
                  indexAxis: 'y',
                  plugins: {
                    ...opsiDasar().plugins,
                    legend: { display: false },
                    tooltip: {
                      ...opsiDasar().plugins.tooltip,
                      callbacks: {
                        label: (ctx) => rupiahMiliar(ctx.raw),
                      },
                    },
                  },
                  scales: {
                    x: sumbuRupiah(),
                    y: sumbuKategori(),
                  },
                }}
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-sky-900 via-sky-950 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl -mr-12 -mt-12"></div>
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5" />
                  Cadangan Potensi
                </span>
                <span className="text-xs text-slate-400">Database RTR/RZ</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Eksplorasi Potensi Ruang Laut Belum Teralokasi
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed mb-6">
                Zona ruang laut berkelas kelayakan tinggi untuk sedikitnya satu jenis investasi, belum memiliki izin KKPRL di dalamnya, dan belum terbangun.
              </p>

              <div className="space-y-3">
                <div className="bg-white/10 backdrop-blur border border-white/10 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-300">Zona Kelayakan Tinggi:</span>
                  <span className="font-bold text-teal-300 text-base">
                    {formatNumber(data?.summary?.potensi?.total_zona || 0, 0)} Zona
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur border border-white/10 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-300">Sebaran Wilayah:</span>
                  <span className="font-bold text-sky-300 text-base">
                    {formatNumber(data?.summary?.potensi?.total_provinsi || 0, 0)} Provinsi
                  </span>
                </div>
                <div className="bg-white/10 backdrop-blur border border-white/10 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-300">Luas Cadangan Laut:</span>
                  <span className="font-bold text-emerald-300 text-base">
                    {formatNumber(data?.summary?.potensi?.total_luas_ha || 0, 0)} Hektar
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/peta?lapisan=potensi"
              className="mt-6 w-full py-2.5 px-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs text-center transition-colors shadow-lg shadow-teal-500/20"
            >
              Eksplorasi Potensi di Peta Spasial &rarr;
            </Link>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            {
              judul: 'Nilai Investasi per Sektor',
              catatan: 'Rencana modal investasi yang tercatat pada tiap sektor kelautan.',
              data: investasiSektorChartData,
              sumbu: sumbuRupiah(),
              tip: (ctx) => `Nilai investasi: ${rupiahMiliar(ctx.raw)}`,
            },
            {
              judul: 'Serapan Tenaga Kerja per Sektor',
              catatan: 'Proyeksi lapangan kerja langsung dari proyek yang terdaftar.',
              data: tenagaKerjaChartData,
              sumbu: sumbuNilai('Orang', (v) => v.toLocaleString('id-ID')),
              tip: (ctx) => `Tenaga kerja: ${ctx.raw.toLocaleString('id-ID')} orang`,
            },
          ].map((g) => (
            <div key={g.judul} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-kkp-700" />
                {g.judul}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-4">{g.catatan}</p>
              <div className="h-72 w-full">
                <Bar
                  data={g.data}
                  options={{
                    ...opsiDasar(),
                    indexAxis: 'y',
                    plugins: {
                      ...opsiDasar().plugins,
                      legend: { display: false },
                      tooltip: {
                        ...opsiDasar().plugins.tooltip,
                        callbacks: { label: g.tip },
                      },
                    },
                    scales: {
                      x: g.sumbu,
                      y: sumbuKategori(),
                    },
                  }}
                />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
