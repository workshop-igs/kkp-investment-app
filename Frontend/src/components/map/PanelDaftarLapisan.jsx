import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Anchor, ArrowDownToLine, BadgeDollarSign, BarChart3, Building2, ChevronDown, CloudRain,
  CloudSun, Compass, Container, Droplets, Eye, Factory, FileCheck, Fish, Flower2, FlaskConical, GitFork, GraduationCap, Info,
  LandPlot, Layers, Layers3, Leaf, Loader2, Map as IkonPeta, MapPinned, Moon, Mountain, MoveDownRight, Navigation,
  Navigation2, Plane, Plug, PlugZap, Route, ScrollText, Search, Shell, ShieldAlert, Ship, Shrink, Sprout, Sun,
  SunMedium, Target, Thermometer, ThermometerSnowflake, ThermometerSun, Timer, Trees, TrendingDown, Users,
  TreePalm, UtilityPole, Waves, Waypoints, Wind, X, Zap, ZoomIn,
} from 'lucide-react';
import { useMap } from 'react-leaflet';
import { api } from '../../api/klien';
import PanelAlat from './PanelAlat';
import PemilihSektor from './PemilihSektor';
import PemilihWilayah from './PemilihWilayah';

const KATEGORI = [
  {
    judul: 'Rencana Tata Ruang & Zonasi',
    ikon: IkonPeta,
    layer: [
      { id: 'polaruang', nama: 'RTRW Provinsi (Perda RTRW, PKKPRL & RZWP-3-K)', warna: '#0056A5', ikon: LandPlot },
      { id: 'polaruang_darat', nama: 'Pola Ruang Darat Pesisir (RTRW Provinsi)', warna: '#65a30d', ikon: Trees },
      { id: 'polaruang_kaw', nama: 'Rencana Zonasi Kawasan Antarwilayah (KAW)', warna: '#7c3aed', ikon: Waypoints },
      { id: 'rtrl', nama: 'Rencana Tata Ruang Laut', warna: '#1d4ed8', ikon: Compass },
      { id: 'wilayah_adat', nama: 'Wilayah Kelola Masyarakat Hukum Adat', warna: '#b45309', ikon: Users },
    ],
  },
  {
    judul: 'Perizinan Pemanfaatan Ruang Laut',
    ikon: FileCheck,
    layer: [
      { id: 'kkprl', nama: 'KKPRL Nasional', warna: '#10b981', ikon: ScrollText },
    ],
  },
  {
    judul: 'Sebaran Transportasi & Infrastruktur',
    ikon: Building2,
    layer: [
      { id: 'infra_pelabuhan_perikanan', nama: 'Pelabuhan Perikanan', warna: '#0e7490', ikon: Fish },
      { id: 'infra_pelabuhan_umum', nama: 'Pelabuhan Umum', warna: '#1e40af', ikon: Anchor },
      { id: 'infra_pelabuhan_penyeberangan', nama: 'Pelabuhan Penyeberangan', warna: '#7e22ce', ikon: Ship },
      { id: 'infra_terminal_khusus', nama: 'Terminal Khusus', warna: '#c2410c', ikon: Container },
      { id: 'infra_jalan_nasional', nama: 'Jalan Nasional', warna: '#78350f', ikon: Route },
      { id: 'infra_jaringan_listrik', nama: 'Jaringan Listrik', warna: '#a16207', ikon: Zap },
      { id: 'infra_pembangkit_listrik', nama: 'Pembangkit Listrik', warna: '#b91c1c', ikon: PlugZap },
      { id: 'infra_kawasan_industri', nama: 'Kawasan Industri', warna: '#44403c', ikon: Factory },
      { id: 'infra_kpbpb', nama: 'Kawasan Perdagangan Bebas', warna: '#15803d', ikon: BadgeDollarSign },
      { id: 'infra_bandara', nama: 'Bandar Udara', warna: '#0f766e', ikon: Plane },
      { id: 'infra_gardu_induk', nama: 'Gardu Induk', warna: '#9a3412', ikon: Plug },
      { id: 'infra_listrik_tm', nama: 'Jaringan Listrik 20 kV', warna: '#ca8a04', ikon: UtilityPole },
      { id: 'infra_kampus_riset', nama: 'Kampus & Lembaga Riset', warna: '#4338ca', ikon: GraduationCap },
      { id: 'infra_muara', nama: 'Muara Sungai Besar', warna: '#0284c7', ikon: GitFork },
    ],
  },
  {
    judul: 'Risiko Bencana',
    ikon: ShieldAlert,
    layer: [
      { id: 'risiko_tsunami', nama: 'Risiko Tsunami', warna: '#dc2626', ikon: Waves },
      { id: 'risiko_abrasi', nama: 'Risiko Gelombang Ekstrem & Abrasi', warna: '#ea580c', ikon: TrendingDown },
      { id: 'risiko_banjir', nama: 'Risiko Banjir', warna: '#2563eb', ikon: Droplets },
      { id: 'risiko_pga', nama: 'Percepatan Tanah Gempa (PGA)', warna: '#f03b20', ikon: Activity },
      { id: 'risiko_laju_abrasi', nama: 'Laju Abrasi Garis Pantai', warna: '#e31a1c', ikon: Shrink },
    ],
  },
  {
    judul: 'Ekosistem Pesisir',
    ikon: Flower2,
    layer: [
      { id: 'eko_karang', nama: 'Terumbu Karang', warna: '#f43f5e', ikon: Flower2 },
      { id: 'eko_lamun', nama: 'Padang Lamun', warna: '#16a34a', ikon: Sprout },
      { id: 'eko_mangrove', nama: 'Mangrove', warna: '#065f46', ikon: TreePalm },
    ],
  },
  {
    judul: 'Oseanografi',
    ikon: Waves,
    layer: [
      { id: 'osea_suhu', nama: 'Suhu Permukaan Laut', warna: '#f46d43', ikon: Thermometer },
      { id: 'osea_anomali', nama: 'Anomali Suhu Permukaan Laut', warna: '#b2182b', ikon: ThermometerSun },
      { id: 'osea_klorofil', nama: 'Klorofil-a', warna: '#21918c', ikon: Leaf },
      { id: 'osea_gelombang', nama: 'Tinggi Gelombang Signifikan', warna: '#4575b4', ikon: Waves },
      { id: 'osea_kedalaman', nama: 'Kedalaman Laut', warna: '#0369a1', ikon: ArrowDownToLine },
      { id: 'osea_kd490', nama: 'Kecerahan Perairan (Kd490)', warna: '#2171b5', ikon: Eye },
      { id: 'osea_periode', nama: 'Periode Gelombang', warna: '#4575b4', ikon: Timer },
      { id: 'osea_kemiringan_dasar', nama: 'Kemiringan Dasar Laut', warna: '#fc8d59', ikon: MoveDownRight },
      { id: 'osea_arus', nama: 'Kecepatan Arus Permukaan', warna: '#2171b5', ikon: Navigation2 },
      { id: 'osea_salinitas', nama: 'Salinitas Permukaan Laut', warna: '#41ab5d', ikon: FlaskConical },
      { id: 'osea_arus_dasar', nama: 'Kecepatan Arus Dasar', warna: '#2171b5', ikon: Navigation },
      { id: 'osea_gelombang_ekstrem', nama: 'Gelombang Ekstrem 50 Tahunan', warna: '#d73027', ikon: AlertTriangle },
      { id: 'osea_pasut', nama: 'Tunggang Pasang Surut', warna: '#2c7fb8', ikon: Moon },
      { id: 'osea_beda_suhu', nama: 'Beda Suhu Permukaan dan 1.000 m', warna: '#f46d43', ikon: ThermometerSnowflake },
      { id: 'osea_shannon', nama: 'Keanekaragaman Hayati Laut (Shannon)', warna: '#238b45', ikon: Shell },
    ],
  },
  {
    judul: 'Iklim & Lahan Pesisir',
    ikon: CloudSun,
    layer: [
      { id: 'iklim_hujan', nama: 'Curah Hujan Bulanan', warna: '#238443', ikon: CloudRain },
      { id: 'iklim_kering', nama: 'Bulan Kering Berturut-turut', warna: '#ec7014', ikon: Sun },
      { id: 'iklim_kemiringan', nama: 'Kemiringan Lahan', warna: '#fc8d59', ikon: Mountain },
      { id: 'iklim_liat', nama: 'Kandungan Tanah Liat', warna: '#d95f0e', ikon: Layers3 },
      { id: 'iklim_angin', nama: 'Kecepatan Angin 100 m', warna: '#238b45', ikon: Wind },
      { id: 'iklim_ghi', nama: 'Iradiasi Surya (GHI)', warna: '#fd8d3c', ikon: SunMedium },
      { id: 'pesisir_eks_mangrove', nama: 'Eks-Mangrove 1996-2020', warna: '#b45309', ikon: Sprout },
      { id: 'pesisir_produksi_kab', nama: 'Perkiraan Produksi Ikan Kabupaten', warna: '#2171b5', ikon: BarChart3 },
    ],
  },
  {
    judul: 'Analisis Investasi',
    ikon: Target,
    layer: [
      { id: 'potensi', nama: 'Peta Sebaran Wilayah Potensial Investasi', warna: '#15803d', ikon: MapPinned },
    ],
  },
];

const StatusLapisan = ({ status }) => {
  if (status.memuat) {
    return (
      <p className="pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        Memuat data…
      </p>
    );
  }

  if (status.galat) {
    return (
      <p className="pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] text-rose-600 flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>{status.galat}</span>
      </p>
    );
  }

  if (status.jumlah === undefined || status.jumlah === null) {
    return (
      <p
        className={`pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] ${
          status.catatan ? 'text-amber-600' : 'text-emerald-700'
        }`}
      >
        {status.catatan || 'Peta bahaya tergambar.'}
      </p>
    );
  }

  if (status.jumlah === 0) {
    return (
      <p className="pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] text-amber-600">
        Tidak ada data di tampilan peta saat ini — geser atau perkecil peta.
      </p>
    );
  }

  if (status.dipangkas) {
    return (
      <p className="pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] text-amber-600">
        Menampilkan {status.jumlah.toLocaleString('id-ID')} objek
        {status.pemilihan === 'terbesar'
          ? ' terbesar saja'
          : ` sebagai sampel ${status.pemilihan}`}.
        Perbesar peta atau pilih provinsi untuk melihat seluruhnya.
      </p>
    );
  }

  return (
    <p className="pl-[3.25rem] pr-3.5 pt-0.5 pb-2 text-[11px] text-emerald-700">
      {status.jumlah.toLocaleString('id-ID')} objek tergambar.
    </p>
  );
};

const PanelDaftarLapisan = ({
  activeLayers,
  toggleLayer,
  daftarLapisan,
  wilayahLapisan,
  setWilayahLapisan,
  sektorLapisan = {},
  setSektorLapisan,
  statusLapisan = {},
  lapisanAwal = [],
}) => {
  const map = useMap();
  const [cari, setCari] = useState('');
  const [dibuka, setDibuka] = useState(() =>
    Object.fromEntries(KATEGORI.filter((k) => k.layer.some((l) => lapisanAwal.includes(l.id))).map((k) => [k.judul, true]))
  );
  const [keterangan, setKeterangan] = useState(null);
  const [sedangZoom, setSedangZoom] = useState(null);

  const kataKunci = cari.trim().toLowerCase();

  const kategoriTampil = useMemo(
    () =>
      KATEGORI.map((k) => ({
        ...k,
        layer: kataKunci ? k.layer.filter((l) => l.nama.toLowerCase().includes(kataKunci)) : k.layer,
      })).filter((k) => k.layer.length > 0),
    [kataKunci]
  );

  const zoomKeLapisan = async (idLapisan) => {
    const def = daftarLapisan[idLapisan];
    if (!def?.url) return;
    const urlCakupan = def.url.replace(/peta\/$/, 'cakupan/');
    setSedangZoom(idLapisan);
    try {
      const { data } = await api.get(urlCakupan, {
        params: {
          ...(def.params || {}),
          ...(sektorLapisan[idLapisan] ? { [def.pilihan?.param || 'sektor']: sektorLapisan[idLapisan] } : {}),
          ...(wilayahLapisan[idLapisan] ? { provinsi: wilayahLapisan[idLapisan] } : {}),
        },
      });
      const c = data?.cakupan;
      if (c && c.length === 4) {
        map.fitBounds(
          [
            [c[1], c[0]],
            [c[3], c[2]],
          ],
          { padding: [40, 40], animate: false }
        );
      }
    } catch {
    } finally {
      setSedangZoom(null);
    }
  };

  const idSemua = KATEGORI.flatMap((k) => k.layer.map((l) => l.id));
  const jumlahAktif = idSemua.filter((id) => activeLayers.includes(id)).length;

  return (
    <PanelAlat
      ikon={Layers}
      judul="Daftar layer"
      keterangan={jumlahAktif ? `${jumlahAktif} layer tampil di peta` : 'Nyalakan layer untuk menampilkannya di peta'}
      kepala={(
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari layer, misalnya pelabuhan"
              aria-label="Cari nama layer"
              className="w-full text-[13px] bg-slate-100 border border-transparent rounded-lg pl-8 pr-8 py-2
                         text-slate-700 placeholder:text-slate-400 transition-colors
                         focus:bg-white focus:border-kkp-700 focus:outline-none focus:ring-2 focus:ring-kkp-700/15"
            />
            {cari && (
              <button
                type="button"
                onClick={() => setCari('')}
                aria-label="Kosongkan pencarian"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
      )}
      kaki={(
        <p className="px-4 py-2 text-[10.5px] text-slate-400 bg-slate-50 border-t border-slate-100 shrink-0">
          Sumber: Portal Satu Data KKP
        </p>
      )}
    >
      {kategoriTampil.length === 0 && (
        <p className="px-4 py-6 text-[12px] text-slate-400 text-center">
          Tidak ada layer bernama “{cari}”.
        </p>
      )}

      {kategoriTampil.map((kategori) => {
        const dilipat = !kataKunci && !dibuka[kategori.judul];
        const aktifDiKategori = kategori.layer.filter((l) => activeLayers.includes(l.id)).length;
        const IkonGrup = kategori.ikon;
        return (
          <section key={kategori.judul} className="border-b border-slate-100 last:border-0">
            <button
              type="button"
              aria-expanded={!dilipat}
              onClick={() =>
                setDibuka((s) => ({ ...s, [kategori.judul]: !s[kategori.judul] }))
              }
              className="sticky top-0 z-[1] w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-white/95 backdrop-blur-sm
                         text-left transition-colors hover:bg-slate-50
                         focus-visible:outline-none focus-visible:bg-kkp-100/60"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-kkp-100 text-kkp-800">
                <IkonGrup className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0 text-[13px] font-semibold leading-snug text-kkp-900">
                {kategori.judul}
              </span>
              {aktifDiKategori > 0 && (
                <span
                  className="shrink-0 rounded-full bg-kkp-toska/20 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-kkp-800"
                  title={`${aktifDiKategori} dari ${kategori.layer.length} layer tampil`}
                >
                  {aktifDiKategori}/{kategori.layer.length}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${dilipat ? '-rotate-90' : ''}`}
              />
            </button>

            {!dilipat && (
              <div className="pb-1.5">
                {kategori.layer.map((layer) => {
                  const aktif = activeLayers.includes(layer.id);
                  const def = daftarLapisan[layer.id] || {};
                  const Ikon = layer.ikon;
                  return (
                    <div key={layer.id}>
                      <div
                        className={`mx-1.5 flex items-center gap-1 rounded-lg pr-1.5 transition-colors ${
                          aktif ? 'bg-kkp-100/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={aktif}
                          onClick={() => toggleLayer(layer.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 pl-2 text-left
                                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/30"
                        >
                          <span
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors"
                            style={aktif ? { backgroundColor: layer.warna, color: '#fff' } : { backgroundColor: `${layer.warna}1A`, color: layer.warna }}
                          >
                            <Ikon className="h-4 w-4" />
                          </span>
                          <span
                            className={`text-[12.5px] leading-snug ${
                              aktif ? 'text-kkp-900 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            {layer.nama}
                          </span>
                        </button>

                        {def.url && (
                          <button
                            type="button"
                            onClick={() => zoomKeLapisan(layer.id)}
                            title="Zoom ke sebaran layer"
                            aria-label={`Zoom ke sebaran ${layer.nama}`}
                            className={`shrink-0 p-1.5 rounded-md text-slate-400 hover:text-kkp-700 hover:bg-white
                                        transition-colors ${sedangZoom === layer.id ? 'animate-pulse text-kkp-700' : ''}`}
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setKeterangan((k) => (k === layer.id ? null : layer.id))
                          }
                          title="Keterangan layer"
                          aria-label={`Keterangan ${layer.nama}`}
                          aria-expanded={keterangan === layer.id}
                          className={`shrink-0 p-1.5 rounded-md transition-colors hover:bg-white ${
                            keterangan === layer.id
                              ? 'text-kkp-700 bg-white'
                              : 'text-slate-400 hover:text-kkp-700'
                          }`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-hidden="true"
                          onClick={() => toggleLayer(layer.id)}
                          className="shrink-0 py-2 pl-1"
                        >
                          <span
                            className={`relative block h-4 w-7 rounded-full transition-colors ${
                              aktif ? 'bg-kkp-700' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                                aktif ? 'translate-x-3' : ''
                              }`}
                            />
                          </span>
                        </button>
                      </div>

                      {aktif && statusLapisan[layer.id] && (
                        <StatusLapisan status={statusLapisan[layer.id]} />
                      )}

                      {keterangan === layer.id && (
                        <p className="pl-[3.25rem] pr-3.5 pt-1 pb-2 text-[11px] text-slate-500 leading-snug">
                          {def.keteranganLegenda ||
                            'Data Portal Satu Data KKP yang disimpan dan digambar dari server aplikasi ini.'}
                        </p>
                      )}

                      {aktif && def.params && 'sektor' in def.params && (
                        <PemilihSektor
                          nilai={def.semuaJenis ? sektorLapisan[layer.id] : sektorLapisan[layer.id] || def.params.sektor}
                          onPilih={(kode) => setSektorLapisan && setSektorLapisan(layer.id, kode)}
                          label={def.semuaJenis ? 'Jenis investasi' : undefined}
                          semua={def.semuaJenis}
                        />
                      )}

                      {aktif && def.pilihan && (
                        <PemilihSektor
                          nilai={sektorLapisan[layer.id]}
                          onPilih={(kode) => setSektorLapisan && setSektorLapisan(layer.id, kode)}
                          label={def.pilihan.label}
                          opsi={def.pilihan.opsi}
                          semua={def.pilihan.semua}
                        />
                      )}

                      {aktif && def.urlWilayah && (
                        <PemilihWilayah
                          urlWilayah={def.urlWilayah}
                          params={sektorLapisan[layer.id]
                            ? { ...(def.params || {}), [def.pilihan?.param || 'sektor']: sektorLapisan[layer.id] }
                            : def.params}
                          nilai={wilayahLapisan[layer.id]}
                          onPilih={(id) => setWilayahLapisan(layer.id, id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </PanelAlat>
  );
};

export default PanelDaftarLapisan;
