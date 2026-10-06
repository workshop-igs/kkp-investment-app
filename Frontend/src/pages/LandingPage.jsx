import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Anchor, ArrowRight, ArrowUpRight, Briefcase, Check, Eye, KeyRound, Clock3, Construction, Download, Factory, FileStack, FileText, FlaskConical,
  Fish, Gem, Layers, Map, MapPin, Palmtree, Shell, SquareDashedMousePointer, Sprout, Upload, Waves, Zap,
} from 'lucide-react';
import { api } from '../api/klien';
import { useAuth } from '../context/KonteksAuth';
import { warnaJenisInvestasi } from '../utils/simbologiPeta';
import { formatNumber } from '../utils/pemformat';

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

const KE_TAMBAKREJO = `/peta?${new URLSearchParams({
  lapisan: 'infra_pelabuhan_perikanan',
  lat: '-8.3164',
  lng: '112.1451',
  label: 'Pelabuhan Perikanan Tambakrejo',
  keterangan: 'Pelabuhan Perikanan Pantai, Blitar, Jawa Timur',
})}`;

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
    judul: 'Pipeline investasi',
    isi: 'Pantau proyek investasi dari LOI sampai operasional.',
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

const AKSES = [
  {
    ikon: Eye,
    judul: 'Tanpa masuk',
    isi: ['Peta Spasial dan seluruh layer data', 'Profil investasi provinsi dalam PDF', 'Cetak tampilan peta dalam PDF'],
  },
  {
    ikon: KeyRound,
    judul: 'Dengan akun',
    isi: ['Analisis kelayakan wilayah dan laporannya', 'Pipeline investasi dari LOI sampai operasional', 'Dashboard pemantauan'],
  },
];

const SUDUT_AREA = [[70, 62], [212, 42], [238, 138], [104, 158]];

const angka = (n) => (n === undefined || n === null ? '—' : formatNumber(n, 0));

const GarisKontur = ({ className }) => (
  <svg viewBox="0 0 800 800" fill="none" stroke="currentColor" strokeWidth="1.2" className={className} aria-hidden="true">
    {[380, 330, 280, 232, 186, 142, 100, 62].map((r, i) => (
      <ellipse key={r} cx="400" cy="400" rx={r} ry={r * (0.78 + (i % 3) * 0.05)} transform={`rotate(${-18 + i * 7} 400 400)`} />
    ))}
  </svg>
);

const PitaKkp = () => (
  <div className="flex h-1.5" aria-hidden="true">
    <span className="w-[20%] bg-kkp-hijau" />
    <span className="w-[38%] bg-kkp-toska" />
    <span className="flex-1 bg-[#1B6A8A]" />
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

const IlustrasiArea = () => (
  <Link
    to="/peta?mulai=gambar"
    aria-label="Gambar area analisis di Peta Spasial"
    className={`group relative block h-44 overflow-hidden rounded-2xl border border-[#9ADCEC] bg-[#D3F0F8] transition-colors hover:border-kkp-900 ${FOKUS}`}
  >
    <GarisKontur className="absolute -right-24 -top-28 h-96 w-96 text-kkp-900/20" />
    <svg viewBox="0 0 300 180" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <polygon points="70,52 190,34 222,118 96,138" fill="rgba(0,34,66,0.08)" stroke="#002242" strokeWidth="1.8" strokeDasharray="6 5" />
      {[[70, 52], [190, 34], [222, 118], [96, 138]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="#fff" stroke="#002242" strokeWidth="1.8" />
      ))}
    </svg>
    <MapPin className={`absolute left-[44%] top-[30%] h-9 w-9 text-kkp-900 ${GERAK} group-hover:-translate-y-2`} strokeWidth={1.5} fill="#fff" aria-hidden="true" />
    <MapPin className={`absolute bottom-5 right-8 h-7 w-7 text-kkp-900 ${GERAK} delay-75 group-hover:-translate-y-1.5`} strokeWidth={1.5} fill={TOSKA_MUDA} aria-hidden="true" />
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
    <GarisKontur className="absolute -left-24 -top-28 h-[440px] w-[440px] text-kkp-900/15" />
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

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [ringkas, setRingkas] = useState(null);

  useEffect(() => {
    api.get('/inti/ringkasan-publik/').then(({ data }) => setRingkas(data)).catch(() => setRingkas({}));
  }, []);

  const peluang = ringkas?.peluang_per_jenis || [];
  const maksPeluang = Math.max(1, ...peluang.map((p) => p.zona));

  const ringkasanNasional = [
    [angka(ringkas?.kkprl_aktif), 'Izin KKPRL berlaku', '/peta?lapisan=kkprl'],
    [ringkas?.kkprl_luas_ha === undefined ? '—' : `${angka(ringkas.kkprl_luas_ha)} ha`, 'Ruang laut berizin', '/peta?lapisan=kkprl'],
    [angka(ringkas?.proyek), 'Proyek investasi terpantau', '/pipeline'],
  ];

  return (
    <div className="h-full overflow-y-auto bg-white pt-[72px] text-slate-800">
      <div className="border-b border-slate-200 bg-[#F6F8FB]">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-6">
            <Label>Analisis kelayakan ruang laut</Label>
            <h1 className="mt-7 text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-kkp-900 sm:text-6xl xl:text-[4.25rem]">
              Platform Manajemen Investasi Ruang Laut
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
              Alat kerja KKP untuk menilai kelayakan ruang laut bagi investasi: kesesuaian lokasi dengan rencana
              tata ruang laut, tumpang tindih dengan KKPRL yang sudah terbit, dan kelayakan finansialnya.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <TombolUtama to="/peta">Buka Peta Spasial</TombolUtama>
              <TombolKedua to="/profil-investasi">Profil Investasi</TombolKedua>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-6">
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <Link
                to={KE_TAMBAKREJO}
                className={`group block rounded-xl border border-slate-200 bg-[#F6F8FB] p-3 transition-colors hover:border-kkp-900 ${FOKUS}`}
              >
                <figure>
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src="/beranda/pelabuhan-tambakrejo.webp"
                      alt="Perahu nelayan berlabuh di Pelabuhan Perikanan Tambakrejo, Blitar"
                      width="1200"
                      height="900"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="mt-3 text-center">
                    <span className="block text-[15px] font-semibold text-kkp-900">Pelabuhan Perikanan Tambakrejo</span>
                    <span className="flex items-center justify-center gap-1 font-mono text-xs text-slate-500">
                      <MapPin className={`h-3.5 w-3.5 text-kkp-700 ${GERAK_KECIL}`} aria-hidden="true" />
                      Blitar, Jawa Timur
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">Foto: DKP Provinsi Jawa Timur</span>
                  </figcaption>
                </figure>
              </Link>
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
                <IlustrasiArea />
              </div>
              <KartuKecil to="/peta?lapisan=polaruang,kkprl" judul="Peta Spasial" isi="Tata ruang dan izin" ikon={Map} />
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
                  {angka(ringkas?.zona_peluang_tinggi)}
                </span>
                <span className="mt-3 block text-sm text-white/80">Zona laut berpeluang tinggi untuk minimal satu jenis investasi</span>
              </Link>
              <KartuKecil to="/peta?mulai=gambar" judul="Analisis Wilayah" isi="Gambar atau unggah area" ikon={SquareDashedMousePointer} />
              <KartuKecil to="/profil-investasi" judul="Profil Investasi" isi="PDF per provinsi" ikon={FileText} />
            </div>
          </div>
        </section>

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
            Zona laut berpeluang tinggi untuk setiap jenis investasi.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-600">
            Setiap zona laut diberi skor untuk tiap jenis investasi dari kesesuaian tata ruang, potensi sumber daya,
            aksesibilitas, kondisi sosial ekonomi, dan risikonya. Pilih satu jenis untuk membuka profil investasinya
            per provinsi.
          </p>
          <Link to="/peta?lapisan=potensi" className="mt-5 inline-block text-sm font-bold text-kkp-700 underline-offset-4 hover:underline">
            Lihat sebarannya di peta
          </Link>
        </div>

        <div className="mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {peluang.map(({ kode, nama, zona }) => {
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
                <span className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-kkp-900 tabular-nums">{angka(zona)}</span>
                <span className="text-xs text-slate-500">zona berpeluang tinggi</span>
                <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full" style={{ width: `${(zona / maksPeluang) * 100}%`, backgroundColor: warna }} />
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-kkp-700 group-hover:underline">
                  Pilih provinsi <ArrowRight className={`h-3.5 w-3.5 ${GERAK_PANAH}`} />
                </span>
              </Link>
            );
          })}
          {ringkas && peluang.length === 0 && <p className="text-sm text-slate-500">Skor zona belum dihitung.</p>}
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-[#F6F8FB]">
          <div className="grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-14 lg:py-16">
            <div className="lg:col-span-5">
              <Label>Akses aplikasi</Label>
              <h2 className="mt-6 text-balance text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-kkp-900 sm:text-4xl">
                Digunakan oleh unit kerja di lingkungan Kementerian Kelautan dan Perikanan.
              </h2>
              <p className="mt-5 max-w-lg leading-relaxed text-slate-600">
                Peta spasial dan profil investasi dapat dibuka tanpa masuk. Analisis kelayakan wilayah, pipeline
                investasi, dan dashboard memerlukan akun yang terdaftar.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <>
                    <TombolUtama to="/dashboard">Buka Dashboard</TombolUtama>
                    <TombolKedua to="/pipeline">Pipeline Investasi</TombolKedua>
                  </>
                ) : (
                  <>
                    <TombolUtama to="/login">Masuk</TombolUtama>
                    <TombolKedua to="/register">Daftar Akun</TombolKedua>
                  </>
                )}
              </div>
            </div>
            <ul className="grid items-start gap-4 sm:grid-cols-2 lg:col-span-7">
              {AKSES.map(({ ikon: Ikon, judul, isi }) => (
                <li key={judul} className="group rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D3F0F8] text-kkp-900">
                      <Ikon className={`h-5 w-5 ${GERAK_IKON}`} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="text-lg font-bold text-kkp-900">{judul}</span>
                  </span>
                  <ul className="mt-5 space-y-3">
                    {isi.map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-[15px] leading-snug text-slate-700">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 text-kkp-700 ${GERAK_KECIL}`} strokeWidth={2.6} aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
