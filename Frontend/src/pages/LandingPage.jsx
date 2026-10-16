import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Anchor, ArrowRight, ArrowUpRight, Briefcase, Check, Clock3, Construction, Download, Factory, FileCheck2, FileStack,
  FileText, FlaskConical, Fish, Gem, Landmark, Layers, LayoutGrid, Loader2, Map, MapPin, Palmtree, Search, Shell,
  SquareDashedMousePointer, Sprout, Upload, Waves, Waypoints, Zap,
} from 'lucide-react';
import { api } from '../api/klien';
import { LAYER_LOKAL } from '../components/map/katalogLapisan';
import { usePencarian } from '../components/map/PanelPencarian';
import { useAuth } from '../context/KonteksAuth';
import { warnaJenisInvestasi } from '../utils/simbologiPeta';
import { formatNumber } from '../utils/pemformat';
import { SECTORS } from '../utils/konstanta';

const IKON_JENIS = {
  PERIKANAN_TANGKAP: Fish,
  PERIKANAN_BUDIDAYA: Shell,
  PENGOLAHAN_HASIL_LAUT: Factory,
  PARIWISATA_BAHARI: Palmtree,
  JASA_MARITIM: Anchor,
  INFRASTRUKTUR_LAUT: Construction,
  ENERGI_KELAUTAN: Zap,
  GARAM: Gem,
  BIOTEKNOLOGI_KELAUTAN: FlaskConical,
  KONSERVASI_PESISIR: Sprout,
};

const TOSKA_MUDA = '#D3F0F8';

const GERAK = 'transition-transform duration-300 ease-out';
const GERAK_IKON = `${GERAK} group-hover:-translate-y-1 group-hover:-rotate-6 group-hover:scale-110`;
const GERAK_KECIL = `${GERAK} group-hover:-translate-y-0.5 group-hover:scale-110`;
const GERAK_PANAH = `${GERAK} group-hover:translate-x-1`;
const FOKUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-900';

const SUMBER = ['Portal Satu Data KKP', 'RTRW Provinsi', 'Sidako KKP', 'BNPB InaRISK', 'BPS', 'NOAA'];

const TANTANGAN = [
  {
    ikon: Layers,
    lencana: '?',
    judul: 'Data tersebar di banyak sumber',
    isi: 'Tata ruang, izin KKPRL, risiko bencana, dan kondisi perairan tersimpan di sistem yang berbeda-beda.',
  },
  {
    ikon: FileStack,
    lencana: '!',
    judul: 'Aturan ruang yang berlapis',
    isi: 'Satu lokasi dapat diatur RTRW provinsi, rencana zonasi kawasan, dan RTRWN sekaligus.',
  },
  {
    ikon: Map,
    lencana: <Clock3 className="h-5 w-5" />,
    judul: 'Analisis manual yang lambat',
    isi: 'Menumpangkan peta dan menghitung kelayakan satu per satu bisa memakan waktu berhari-hari.',
  },
];

const FITUR = [
  {
    ikon: Map,
    judul: 'Peta spasial terpadu',
    isi: 'Tata ruang, KKPRL, infrastruktur, risiko bencana, dan oseanografi dalam satu peta.',
  },
  {
    ikon: SquareDashedMousePointer,
    judul: 'Analisis wilayah otomatis',
    isi: 'Gambar atau unggah area, lalu baca kesesuaian ruang dan kelayakan finansialnya.',
  },
  {
    ikon: FileText,
    judul: 'Profil investasi provinsi',
    isi: 'PDF per provinsi dan per jenis investasi, disusun dari data publik.',
  },
  {
    ikon: Briefcase,
    judul: 'Pemantauan proyek investasi',
    isi: 'Pantau proyek investasi dari tahap perencanaan sampai beroperasi.',
  },
];

const CONTOH_JENIS = [
  ['PERIKANAN_TANGKAP', 'Perikanan tangkap'],
  ['PERIKANAN_BUDIDAYA', 'Perikanan budidaya'],
  ['PARIWISATA_BAHARI', 'Wisata bahari'],
  ['JASA_MARITIM', 'Jasa maritim'],
  ['ENERGI_KELAUTAN', 'Energi kelautan'],
  ['GARAM', 'Produksi garam'],
];

const BAGIAN_LAPORAN = ['Tata ruang dan perizinan', 'Transportasi dan infrastruktur', 'Oseanografi', 'Risiko lingkungan dan sosial', 'Kelayakan investasi'];

const SUDUT_AREA = [[70, 62], [212, 42], [238, 138], [104, 158]];

const angka = (n) => (n === undefined || n === null ? '—' : formatNumber(n, 0));

const PitaKkp = () => (
  <div className="flex h-1.5" aria-hidden="true">
    <span className="w-[20%] bg-kkp-hijau" />
    <span className="w-[38%] bg-kkp-toska" />
    <span className="flex-1 bg-[#1B6A8A]" />
  </div>
);

const LatarLaut = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF8FC_55%,#DDF2F9_100%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_92%_0%,#BFE9F4_0%,transparent_50%),radial-gradient(ellipse_at_0%_100%,#E2F1CC_0%,transparent_40%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,34,66,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,34,66,0.07)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,#000,transparent_85%)]" />
    <svg viewBox="0 0 1440 160" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full sm:h-32">
      <path d="M0 78C240 34 480 122 720 88S1200 36 1440 70V160H0Z" fill="#40BFDB" fillOpacity="0.22" />
      <path d="M0 108C280 76 520 146 800 116S1240 86 1440 108V160H0Z" fill="#1B6A8A" fillOpacity="0.16" />
      <path d="M0 136C320 118 600 160 900 142S1280 126 1440 140V160H0Z" fill="#F6F8FB" />
    </svg>
  </div>
);

const LATAR_LABEL = { toska: 'bg-[#D3F0F8]', hijau: 'bg-[#E2F1CC]', putih: 'bg-white/85' };

const Label = ({ children, nada = 'toska' }) => (
  <span className={`inline-block px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-[0.24em] text-kkp-900 sm:text-[13px] ${LATAR_LABEL[nada]}`}>
    {children}
  </span>
);

const TombolUtama = ({ to, children }) => (
  <Link
    to={to}
    className={`group inline-flex items-center gap-3 rounded-md bg-kkp-900 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-kkp-800 ${FOKUS}`}
  >
    {children}
    <ArrowRight className={`h-4 w-4 text-kkp-toska ${GERAK_PANAH}`} />
  </Link>
);

const TombolKedua = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-6 py-3.5 text-[15px] font-semibold text-kkp-900 transition-colors hover:border-kkp-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-900"
  >
    {children}
  </Link>
);

const KartuKecil = ({ to, judul, isi, ikon: Ikon, tanpaIsi }) => (
  <Link to={to} className={`group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-kkp-900 ${FOKUS}`}>
    <span className="text-[15px] font-semibold leading-snug text-kkp-900">{judul}</span>
    <span className="mt-0.5 text-xs leading-snug text-slate-500">{isi}</span>
    <Ikon className={`mt-4 h-8 w-8 text-kkp-900 ${GERAK_IKON}`} strokeWidth={1.5} fill={tanpaIsi ? 'none' : TOSKA_MUDA} aria-hidden="true" />
  </Link>
);

const DATA_PETA = [
  ['Zona tata ruang laut', '/peta?lapisan=polaruang,polaruang_kaw', Map],
  ['Izin KKPRL terbit', '/peta?lapisan=kkprl', FileCheck2],
  ['Pelabuhan perikanan', '/peta?lapisan=infra_pelabuhan_perikanan', Anchor],
  ['Risiko tsunami', '/peta?lapisan=risiko_tsunami', AlertTriangle],
];

const KartuDataPeta = () => (
  <div className="rounded-2xl border border-[#9ADCEC] bg-[#D3F0F8] p-4">
    <Link to="/peta" className={`group inline-flex items-center gap-1.5 text-[15px] font-semibold text-kkp-900 ${FOKUS}`}>
      Lihat data ruang laut di peta
      <ArrowRight className={`h-4 w-4 text-kkp-700 ${GERAK_PANAH}`} aria-hidden="true" />
    </Link>
    <p className="mt-0.5 text-xs text-slate-600">Pilih data yang ingin ditampilkan:</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      {DATA_PETA.map(([judul, ke, Ikon]) => (
        <Link
          key={judul}
          to={ke}
          className={`group flex items-center gap-2 rounded-lg border border-white bg-white/80 px-2.5 py-2 text-xs font-semibold leading-tight text-kkp-900 transition-colors hover:border-kkp-900 ${FOKUS}`}
        >
          <Ikon className={`h-4 w-4 shrink-0 text-kkp-700 ${GERAK_KECIL}`} aria-hidden="true" />
          {judul}
        </Link>
      ))}
    </div>
  </div>
);

const PEMERIKSAAN = [
  'Kesesuaian dengan rencana tata ruang laut',
  'Tumpang tindih dengan izin KKPRL yang sudah terbit',
  'Risiko bencana dan kelayakan finansial',
];

const KartuCekLokasi = () => (
  <Link
    to="/peta?mulai=gambar"
    className={`group flex flex-col rounded-xl border border-slate-200 bg-[#F6F8FB] p-4 transition-colors hover:border-kkp-900 ${FOKUS}`}
  >
    <span className="flex items-center gap-2 text-[15px] font-semibold text-kkp-900">
      <SquareDashedMousePointer className={`h-5 w-5 text-kkp-700 ${GERAK_KECIL}`} aria-hidden="true" />
      Cek kelayakan lokasi
    </span>
    <span className="mt-1 text-xs leading-snug text-slate-500">Gambar atau unggah area rencana investasi, lalu aplikasi memeriksa:</span>
    <ul className="mt-3 space-y-2">
      {PEMERIKSAAN.map((teks) => (
        <li key={teks} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden="true" />
          {teks}
        </li>
      ))}
    </ul>
    <span className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-md bg-kkp-900 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-kkp-800">
      Mulai di Peta Spasial
      <ArrowRight className={`h-3.5 w-3.5 text-kkp-toska ${GERAK_PANAH}`} aria-hidden="true" />
    </span>
  </Link>
);

const Ilustrasi = ({ ikon: Ikon, lencana }) => (
  <div className="relative mx-auto h-36 w-52" aria-hidden="true">
    <div className="absolute inset-x-2 inset-y-0 rounded-[2rem] bg-[radial-gradient(#40BFDB_1.3px,transparent_1.6px)] [background-size:10px_10px] [mask-image:radial-gradient(closest-side,#000_40%,transparent)]" />
    <Ikon className={`absolute inset-0 m-auto h-28 w-28 text-kkp-900 ${GERAK_IKON}`} strokeWidth={1.1} fill={TOSKA_MUDA} />
    <span className={`absolute right-9 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-kkp-900 text-lg font-bold text-white ${GERAK} group-hover:rotate-12 group-hover:scale-110`}>
      {lencana}
    </span>
  </div>
);

const ContohArea = () => (
  <div className="relative h-full overflow-hidden rounded-xl bg-[#D3F0F8]">
    <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <polygon points={SUDUT_AREA.join(' ')} fill="rgba(0,86,165,0.14)" stroke="#002242" strokeWidth="2" strokeDasharray="6 5" />
      {SUDUT_AREA.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#fff" stroke="#002242" strokeWidth="2" />
      ))}
    </svg>
    <div className="absolute bottom-3 left-3 flex gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-kkp-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">
        <SquareDashedMousePointer className={`h-3.5 w-3.5 ${GERAK_KECIL}`} /> Gambar area
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-kkp-900">
        <Upload className={`h-3.5 w-3.5 ${GERAK_KECIL}`} /> Unggah berkas
      </span>
    </div>
  </div>
);

const ContohJenis = () => (
  <div className="h-full rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-sm font-semibold text-kkp-900">Jenis investasi</p>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {CONTOH_JENIS.map(([kode, label], i) => {
        const Ikon = IKON_JENIS[kode];
        return (
          <span
            key={kode}
            className={`flex flex-col gap-2 rounded-lg p-2.5 text-[11px] font-medium leading-tight text-kkp-900 ${
              i === 1 ? 'border-2 border-kkp-900 bg-[#D3F0F8]' : 'border border-slate-200'
            }`}
          >
            <Ikon className={`h-5 w-5 ${GERAK_KECIL}`} style={{ color: warnaJenisInvestasi(kode) }} />
            {label}
          </span>
        );
      })}
    </div>
  </div>
);

const ContohLaporan = () => (
  <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-sm font-semibold text-kkp-900">Laporan analisis</p>
    <ul className="mt-1 flex-1 divide-y divide-slate-100">
      {BAGIAN_LAPORAN.map((b) => (
        <li key={b} className="flex items-center gap-2 py-1.5 text-xs text-slate-700">
          <Check className={`h-3.5 w-3.5 shrink-0 text-emerald-600 ${GERAK_KECIL}`} strokeWidth={3} />
          {b}
        </li>
      ))}
    </ul>
    <span className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-kkp-900 py-2 text-xs font-semibold text-white">
      <Download className={`h-3.5 w-3.5 ${GERAK} group-hover:translate-y-0.5`} /> Unduh PDF
    </span>
  </div>
);

const LANGKAH = [
  { contoh: ContohArea, judul: 'Tentukan area', isi: 'Gambar poligon di peta atau unggah berkas SHP, KML, atau GeoJSON.' },
  { contoh: ContohJenis, judul: 'Pilih jenis investasi', isi: 'Skor kelayakan dihitung untuk jenis investasi yang dipilih.' },
  { contoh: ContohLaporan, judul: 'Baca laporan, unduh PDF', isi: 'Setiap bagian laporan mencantumkan sumber dan tahun datanya.' },
];

const MIN_HURUF = 2;
const BATAS_TETAP = 5;

const CONTOH_CARI = ['Pelabuhan perikanan', 'Tambakrejo', 'KKPRL', 'Suhu permukaan laut', 'Nusa Tenggara Barat'];

const IKON_KELOMPOK = {
  Halaman: LayoutGrid,
  'Layer Peta': Layers,
  'Profil Investasi': FileText,
  'Wilayah Administratif': Landmark,
  'Infrastruktur & Transportasi': Anchor,
  'Lokasi Potensi Investasi': MapPin,
  'Perizinan Ruang Laut': FileCheck2,
  'Zona Tata Ruang Laut': Map,
  'Unsur Ruang Laut': Waypoints,
};

const ENTRI_TETAP = [
  ...[
    ['Peta Spasial', 'Peta interaktif seluruh layer data ruang laut', '/peta', 'peta spasial'],
    ['Analisis wilayah', 'Gambar atau unggah area untuk dianalisis', '/peta?mulai=gambar', 'analisis kelayakan gambar poligon unggah shp kml geojson'],
    ['Profil Investasi', 'Profil investasi per provinsi dalam PDF', '/profil-investasi', 'profil investasi pdf'],
    ['Proyek investasi', 'Proyek dari perencanaan sampai beroperasi, perlu akun', '/pipeline', 'proyek investasi pipeline tahap perencanaan penyiapan transaksi konstruksi operasi loi'],
    ['Dashboard', 'Ringkasan pemantauan, perlu akun', '/dashboard', 'dashboard pemantauan'],
  ].map(([nama, keterangan, ke, kunci]) => ({ kelompok: 'Halaman', nama, keterangan, ke, kunci })),
  ...Object.entries(LAYER_LOKAL).map(([id, d]) => ({
    kelompok: 'Layer Peta', nama: d.label, keterangan: d.keteranganLegenda || '', ke: `/peta?lapisan=${id}`,
  })),
  ...SECTORS.map((s) => ({
    kelompok: 'Jenis Investasi', kode: s.id, nama: s.label, keterangan: 'Profil investasi per provinsi untuk jenis ini',
    ke: `/profil-investasi?jenis=${s.id}`,
  })),
];

const lapisanHasil = (h) => {
  if (h.sumber === 'kkprl') return 'kkprl';
  if (h.sumber === 'zonasi') return h.kode === 'KAW' ? 'polaruang_kaw' : 'polaruang';
  const kunci = { infrastruktur: 'kategori', unsur: 'kelompok' }[h.sumber];
  return kunci ? Object.keys(LAYER_LOKAL).find((id) => LAYER_LOKAL[id].params?.[kunci] === h.kode) : undefined;
};

const keHasil = (h) => {
  const p = new URLSearchParams();
  const lapisan = lapisanHasil(h);
  if (lapisan) p.set('lapisan', lapisan);
  if (h.bbox) p.set('bbox', h.bbox.join(','));
  if (h.titik) {
    p.set('lat', h.titik[1]);
    p.set('lng', h.titik[0]);
  }
  p.set('label', h.nama);
  const keterangan = [h.jenis, h.keterangan].filter(Boolean).join(', ');
  if (keterangan) p.set('keterangan', keterangan);
  return `/peta?${p}`;
};

const PusatInformasi = () => {
  const navigate = useNavigate();
  const [kata, setKata] = useState('');
  const [terbuka, setTerbuka] = useState(false);
  const { hasil, status } = usePencarian(kata);
  const refWadah = useRef(null);
  const refMasukan = useRef(null);
  const refLangsung = useRef(false);

  const q = kata.trim();
  const siap = q.length >= MIN_HURUF && !status.memuat && status.untuk === q;

  const daftar = useMemo(() => {
    if (q.length < MIN_HURUF) return [];
    const kunci = q.toLowerCase().split(/\s+/);
    const hitung = {};
    const tetap = ENTRI_TETAP.filter((e) => {
      const teks = `${e.nama} ${e.kunci || ''}`.toLowerCase();
      if (!kunci.every((k) => teks.includes(k))) return false;
      hitung[e.kelompok] = (hitung[e.kelompok] || 0) + 1;
      return hitung[e.kelompok] <= BATAS_TETAP;
    });
    const data = (status.untuk === q ? hasil : []).flatMap((h) => {
      const baris = { kelompok: h.kelompok, nama: h.nama, keterangan: [h.jenis, h.keterangan].filter(Boolean).join(', '), ke: keHasil(h) };
      return h.sumber === 'provinsi'
        ? [baris, { kelompok: 'Profil Investasi', nama: `Profil investasi ${h.nama}`, keterangan: 'Seluruh jenis investasi di provinsi ini', ke: `/profil-investasi?provinsi=${h.kode}` }]
        : [baris];
    });
    return [...tetap, ...data];
  }, [q, hasil, status.untuk]);

  const kelompok = useMemo(() => {
    const peta = new globalThis.Map();
    daftar.forEach((e) => peta.set(e.kelompok, [...(peta.get(e.kelompok) || []), e]));
    return [...peta.entries()];
  }, [daftar]);

  useEffect(() => {
    const tutup = (e) => {
      if (!refWadah.current?.contains(e.target)) setTerbuka(false);
    };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, []);

  useEffect(() => {
    if (!refLangsung.current || !siap) return;
    refLangsung.current = false;
    if (daftar.length) navigate(daftar[0].ke);
  }, [siap, daftar, navigate]);

  const kirim = (e) => {
    e.preventDefault();
    setTerbuka(true);
    if (q.length < MIN_HURUF) return;
    if (siap && daftar.length) navigate(daftar[0].ke);
    else refLangsung.current = true;
  };

  const isiContoh = (teks) => {
    setKata(teks);
    setTerbuka(true);
    refMasukan.current?.focus();
  };

  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl rounded-3xl bg-[linear-gradient(115deg,#002242_0%,#003a70_55%,#0056A5_100%)] text-white">
        <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-12 lg:gap-12 lg:px-14 lg:py-16">
          <div className="lg:col-span-5">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.24em] text-kkp-toska sm:text-[13px]">Pusat informasi</p>
            <h2 className="mt-5 text-balance text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-4xl">
              Temukan data ruang laut yang Anda butuhkan
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/75">
              Telusuri pelabuhan, izin KKPRL, zona tata ruang, provinsi, layer peta, dan jenis investasi dalam satu
              pencarian.
            </p>
          </div>

          <div ref={refWadah} className="relative lg:col-span-7">
            <form
              role="search"
              onSubmit={kirim}
              className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]"
            >
              <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={refMasukan}
                type="search"
                value={kata}
                onChange={(e) => {
                  setKata(e.target.value);
                  setTerbuka(true);
                }}
                onFocus={() => setTerbuka(true)}
                onKeyDown={(e) => e.key === 'Escape' && setTerbuka(false)}
                aria-label="Cari data ruang laut"
                placeholder="Cari pelabuhan, izin KKPRL, zona, provinsi, atau layer..."
                className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-kkp-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                className={`group inline-flex shrink-0 items-center gap-2 rounded-xl bg-kkp-900 px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-kkp-800 sm:px-6 ${FOKUS}`}
              >
                Cari
                <ArrowRight className={`hidden h-4 w-4 text-kkp-toska sm:block ${GERAK_PANAH}`} aria-hidden="true" />
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-white/60">Contoh:</span>
              {CONTOH_CARI.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => isiContoh(c)}
                  className="rounded-full border border-white/25 px-3 py-1 text-white/85 transition-colors hover:border-white/60 hover:text-white"
                >
                  {c}
                </button>
              ))}
            </div>

            {terbuka && q.length >= MIN_HURUF && (
              <div
                aria-live="polite"
                className="custom-scrollbar absolute inset-x-0 top-[4.5rem] z-30 max-h-[26rem] overflow-y-auto rounded-2xl border border-slate-200 bg-white text-left text-slate-700 shadow-[0_30px_60px_-25px_rgba(0,20,45,0.6)]"
              >
                {kelompok.map(([nama, isi]) => (
                  <div key={nama}>
                    <p className="sticky top-0 bg-slate-50 px-4 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                      {nama}
                    </p>
                    <ul>
                      {isi.map((e, i) => {
                        const Ikon = (e.kode && IKON_JENIS[e.kode]) || IKON_KELOMPOK[e.kelompok] || MapPin;
                        return (
                          <li key={`${e.ke}-${i}`}>
                            <Link
                              to={e.ke}
                              className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[#F6F8FB] focus-visible:bg-[#F6F8FB] focus-visible:outline-none"
                            >
                              <Ikon className={`mt-0.5 h-4 w-4 shrink-0 text-kkp-700 ${GERAK_KECIL}`} aria-hidden="true" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-snug text-kkp-900">{e.nama}</span>
                                {e.keterangan && <span className="line-clamp-1 text-xs text-slate-500">{e.keterangan}</span>}
                              </span>
                              <ArrowRight className={`mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-kkp-700 ${GERAK_PANAH}`} aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {status.memuat && (
                  <p className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Mencari di data peta...
                  </p>
                )}
                {status.galat && (
                  <p className="flex items-center gap-2 px-4 py-3 text-xs text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {status.galat}
                  </p>
                )}
                {siap && !status.galat && daftar.length === 0 && (
                  <p className="px-4 py-5 text-center text-sm text-slate-500">
                    Tidak ada yang cocok dengan &ldquo;{q}&rdquo;. Coba nama pelabuhan, provinsi, zona, atau jenis investasi.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [ringkas, setRingkas] = useState(null);

  useEffect(() => {
    api.get('/inti/ringkasan-publik/').then(({ data }) => setRingkas(data)).catch(() => setRingkas({}));
  }, []);

  const peluang = ringkas?.peluang_per_jenis || [];
  const maksPeluang = Math.max(1, ...peluang.map((p) => p.lokasi));

  const ringkasanNasional = [
    [angka(ringkas?.kkprl_aktif), 'Izin KKPRL berlaku', '/peta?lapisan=kkprl'],
    [ringkas?.kkprl_luas_ha === undefined ? '—' : `${angka(ringkas.kkprl_luas_ha)} ha`, 'Ruang laut berizin', '/peta?lapisan=kkprl'],
    [angka(ringkas?.zona_tata_ruang), 'Zona tata ruang laut', '/peta?lapisan=polaruang,polaruang_kaw'],
  ];

  return (
    <div className="h-full overflow-y-auto bg-white pt-[72px] text-slate-800">
      <div className="border-b border-slate-200 bg-[#F6F8FB]">
        <div className="relative">
          <LatarLaut />
          <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-28 pt-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-32 lg:pt-20">
            <div className="lg:col-span-6">
              <Label>Analisis kelayakan ruang laut</Label>
              <h1 className="mt-7 text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-kkp-900 sm:text-6xl xl:text-[4.25rem]">
                Platform Manajemen Investasi Ruang Laut
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
                Sistem informasi terpadu untuk mewujudkan investasi ruang laut yang tepat lokasi, sesuai tata ruang,
                layak secara ekonomi, dan berkelanjutan.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <TombolUtama to="/peta">Buka Peta Spasial</TombolUtama>
                <TombolKedua to="/profil-investasi">Profil Investasi</TombolKedua>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-6">
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <KartuCekLokasi />
                <div className="mt-5 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-kkp-900">Ringkasan nasional</p>
                  <span className="bg-[#D3F0F8] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-kkp-900">
                    Data terkini
                  </span>
                </div>
                <div className="mt-2 flex flex-1 flex-col rounded-xl border border-slate-200 p-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-kkp-900">
                    <img src="/logo-kkp.png" alt="" className="h-6 w-6 shrink-0 object-contain" />
                    Seluruh Indonesia
                  </span>
                  <ul className="mt-3 flex flex-1 flex-col justify-around divide-y divide-slate-200 rounded-lg bg-[#F6F8FB] px-2 text-center">
                    {ringkasanNasional.map(([nilai, label, ke], i) => (
                      <li key={label}>
                        <Link to={ke} className={`group my-1 flex flex-col items-center rounded-md py-1.5 transition-colors hover:bg-white ${FOKUS}`}>
                          <span className="flex items-center gap-2 text-lg font-bold text-kkp-900 tabular-nums transition-colors group-hover:text-kkp-700">
                            {i === 0 && <span className={`h-2 w-2 rounded-full bg-kkp-hijau ${GERAK} group-hover:scale-150`} aria-hidden="true" />}
                            {nilai}
                          </span>
                          <span className="text-xs text-slate-500">{label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 content-start gap-3">
                <div className="col-span-2">
                  <KartuDataPeta />
                </div>
                <KartuKecil to="/pipeline" judul="Pantau proyek" isi="Dari perencanaan sampai beroperasi" ikon={Briefcase} />
                <KartuKecil to="/peta?lapisan=osea_suhu" judul="Oseanografi" isi="Suhu dan gelombang" ikon={Waves} tanpaIsi />
                <Link
                  to="/peta?lapisan=potensi"
                  className={`group col-span-2 block rounded-2xl bg-kkp-900 p-5 text-white transition-colors hover:bg-kkp-800 ${FOKUS}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="bg-kkp-toska px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-kkp-900">
                      Peluang investasi
                    </span>
                    <ArrowUpRight className={`h-5 w-5 text-kkp-toska ${GERAK} group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:scale-110`} aria-hidden="true" />
                  </span>
                  <span className="mt-5 block text-5xl font-extrabold tracking-[-0.03em] text-[#BFE9F4] tabular-nums sm:text-6xl">
                    {angka(ringkas?.lokasi_potensial)}
                  </span>
                  <span className="mt-3 block text-sm text-white/80">Lokasi indikatif lolos penyaringan untuk minimal satu jenis investasi: syarat dasar terpenuhi (di luar konservasi, ekosistem sensitif, kabel/pipa/alur pelayaran, KKPRL, dan bangunan) dan sedikitnya 75% parameter dinilai sangat sesuai</span>
                </Link>
                <KartuKecil to="/peta?mulai=gambar" judul="Analisis Wilayah" isi="Gambar atau unggah area" ikon={SquareDashedMousePointer} />
                <KartuKecil to="/profil-investasi" judul="Profil Investasi" isi="PDF per provinsi" ikon={FileText} />
              </div>
            </div>
          </section>
        </div>

        <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 text-center sm:px-6 lg:px-8 lg:pb-28">
          <Label nada="hijau">Tantangan</Label>
          <h2 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-kkp-900 sm:text-5xl">
            Mengapa menilai ruang laut untuk investasi tidak pernah sederhana.
          </h2>
          <ul className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            {TANTANGAN.map(({ ikon, lencana, judul, isi }) => (
              <li key={judul} className="group">
                <Ilustrasi ikon={ikon} lencana={lencana} />
                <h3 className="mt-6 text-lg font-semibold text-kkp-900">{judul}</h3>
                <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">{isi}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <figure className="overflow-hidden rounded-2xl border-[3px] border-kkp-900 shadow-[0_30px_70px_-35px_rgba(0,34,66,0.5)]">
            <img
              src="/beranda/aplikasi-peta.webp"
              alt="Tampilan Peta Spasial: zona pola ruang laut dan izin KKPRL di sekitar Selat Makassar, dengan legenda dan kontrol peta"
              width="1440"
              height="900"
              loading="lazy"
              className="block h-auto w-full"
            />
          </figure>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FITUR.map(({ ikon: Ikon, judul, isi }) => (
              <li key={judul} className="group rounded-2xl border border-slate-200 p-6">
                <Ikon className={`h-10 w-10 text-kkp-900 ${GERAK_IKON}`} strokeWidth={1.4} fill={TOSKA_MUDA} aria-hidden="true" />
                <h3 className="mt-6 text-xl font-bold tracking-[-0.01em] text-kkp-900">{judul}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{isi}</p>
              </li>
            ))}
          </ul>

          <div className="mt-14 flex flex-col items-center gap-5 lg:flex-row lg:justify-between">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Bersumber dari data resmi</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {SUMBER.map((s) => (
                <li key={s} className="text-base font-bold text-slate-400">{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#F6F8FB] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Label>Cara kerja</Label>
            <h2 className="mt-6 text-balance text-4xl font-extrabold leading-[1.06] tracking-[-0.03em] text-kkp-900 sm:text-5xl">
              Dari satu area di peta menjadi laporan kelayakan.
            </h2>
            <div className="mt-10">
              <TombolUtama to={isAuthenticated ? '/peta' : '/login'}>
                {isAuthenticated ? 'Mulai Analisis Lokasi' : 'Masuk ke Aplikasi'}
              </TombolUtama>
            </div>
          </div>
          <ol
            tabIndex={0}
            aria-label="Langkah analisis wilayah"
            className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kkp-900 sm:mx-0 sm:px-0 lg:col-span-8"
          >
            {LANGKAH.map(({ contoh: Contoh, judul, isi }, i) => (
              <li key={judul} className="group w-[18.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-[21rem]">
                <div className="h-72 p-5">
                  <Contoh />
                </div>
                <div className="border-t border-slate-200 px-6 py-5">
                  <p className="font-mono text-xs font-medium uppercase tracking-[0.24em] text-kkp-700">Langkah {i + 1}</p>
                  <h3 className="mt-2 text-lg font-bold text-kkp-900">{judul}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="peluang" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl text-center">
          <Label>Peluang investasi</Label>
          <h2 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-kkp-900 sm:text-5xl">
            Lokasi indikatif lolos penyaringan untuk setiap jenis investasi.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-600">
            Ruang laut dan darat pesisir dinilai per sel 250 m untuk tiap jenis investasi: peruntukan tata ruang dan
            matriks Perda, karakter lokasi, risiko bencana, dan kriteria per jenis dari data publik. Yang dihitung hanya
            lokasi di luar kawasan konservasi, ekosistem sensitif, jarak aman kabel/pipa/alur pelayaran, KKPRL terbit, dan
            bangunan, dengan satu titik terbaik per radius 10 km. Hasilnya indikatif, bukan pengganti Persetujuan KKPRL.
            Pilih satu jenis untuk membuka profil investasinya per provinsi.
          </p>
          <Link to="/peta?lapisan=potensi" className="mt-5 inline-block text-sm font-bold text-kkp-700 underline-offset-4 hover:underline">
            Lihat sebarannya di peta
          </Link>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {peluang.map(({ kode, nama, lokasi }) => {
            const Ikon = IKON_JENIS[kode] || Layers;
            const warna = warnaJenisInvestasi(kode);
            return (
              <Link
                key={kode}
                to={`/profil-investasi?jenis=${kode}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-kkp-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kkp-900 sm:p-5"
              >
                <Ikon className={`h-8 w-8 ${GERAK_IKON}`} style={{ color: warna }} strokeWidth={1.6} aria-hidden="true" />
                <span className="mt-4 min-h-[2.5rem] text-[15px] font-bold leading-snug text-kkp-900">{nama}</span>
                <span className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-kkp-900 tabular-nums">{angka(lokasi)}</span>
                <span className="text-xs text-slate-500">lokasi indikatif</span>
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full" style={{ width: `${(lokasi / maksPeluang) * 100}%`, backgroundColor: warna }} />
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-kkp-700 group-hover:underline">
                  Pilih provinsi <ArrowRight className={`h-3.5 w-3.5 ${GERAK_PANAH}`} />
                </span>
              </Link>
            );
          })}
          {ringkas && peluang.length === 0 && <p className="text-sm text-slate-500">Lokasi indikatif belum dihitung.</p>}
        </div>
      </section>

      <PusatInformasi />

      <footer className="bg-kkp-900 text-white">
        <PitaKkp />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="flex items-start gap-4 sm:col-span-2 lg:col-span-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              <img src="/logo-kkp.png" alt="Logo Kementerian Kelautan dan Perikanan" className="h-12 w-12 object-contain" />
            </span>
            <span>
              <span className="block text-base font-bold">Kementerian Kelautan dan Perikanan</span>
              <span className="block text-sm text-white/70">Republik Indonesia</span>
              <span className="mt-3 block max-w-sm text-sm leading-relaxed text-white/60">
                Platform Manajemen Investasi Ruang Laut
              </span>
            </span>
          </div>
          <nav aria-label="Tautan kaki" className="lg:col-span-3">
            <p className="text-sm font-semibold text-white/60">Menu</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[['Beranda', '/'], ['Peta Spasial', '/peta'], ['Profil Investasi', '/profil-investasi']].map(([label, ke]) => (
                <li key={ke}><Link to={ke} className="text-white/85 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold text-white/60">Alamat</p>
            <p className="mt-3 text-sm leading-relaxed text-white/85">Jl. Medan Merdeka Timur No. 16, Jakarta Pusat</p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/55 sm:px-6 lg:px-8">
            © {new Date().getFullYear()} Kementerian Kelautan dan Perikanan Republik Indonesia
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
