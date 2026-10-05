import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Calculator, Check, ChevronLeft, ChevronRight, Database, Download, FileText,
  ImageIcon, Layers, Map, MapPin, ScanSearch, TrendingUp,
} from 'lucide-react';
import { api } from '../api/klien';
import { useAuth } from '../context/KonteksAuth';
import { warnaJenisInvestasi } from '../utils/simbologiPeta';
import { formatNumber } from '../utils/pemformat';

const KEMAMPUAN = [
  { ikon: ScanSearch, judul: 'Cek kesesuaian ruang', isi: 'terhadap RTRW Provinsi, Rencana Zonasi KAW, dan RTRWN' },
  { ikon: Calculator, judul: 'Hitung kelayakan', isi: 'NPV, IRR, dan risiko lokasi dalam satu laporan' },
  { ikon: TrendingUp, judul: 'Pantau investasi', isi: 'pipeline proyek dari LOI sampai operasional' },
];

const AKSI_CEPAT = [
  { ikon: Map, judul: 'Buka Peta Spasial', isi: 'KKPRL, pola ruang, risiko, dan skor zona dalam satu peta', ke: '/peta', warna: 'bg-kkp-hijau' },
  { ikon: FileText, judul: 'Profil Investasi', isi: 'Profil provinsi lengkap atau per jenis investasi, siap unduh PDF', ke: '/profil-investasi', warna: 'bg-kkp-toska' },
];

const SUMBER = ['Portal Satu Data KKP', 'RTRW Provinsi', 'Sidako KKP', 'BNPB InaRISK', 'BPS', 'NOAA'];

const FITUR = [
  {
    alis: 'Peta Spasial',
    judul: 'Seluruh data ruang laut dalam satu peta',
    isi: 'KKPRL yang sudah terbit tampil langsung per jenis investasi. Layer lain dapat dinyalakan sesuai kebutuhan, dan setiap zona dapat diklik untuk melihat ketentuannya atau dijadikan area analisis.',
    poin: [
      'Pola ruang laut dari RTRW Provinsi, Rencana Zonasi KAW, dan RTRWN',
      'Infrastruktur pendukung, ekosistem, dan risiko bencana pesisir',
      'Skor kelayakan zona untuk setiap jenis investasi',
    ],
    aksi: ['Buka Peta Spasial', '/peta'],
    lencana: [Layers, MapPin, ScanSearch],
    saranFoto: 'pemandangan perairan atau pesisir Indonesia',
  },
  {
    alis: 'Profil Investasi',
    judul: 'Profil investasi setiap provinsi',
    isi: 'Setiap provinsi punya profil investasi berisi ringkasan potensi, tata ruang dan perizinan, ekosistem, infrastruktur, dan pasar kerjanya. Profil dapat diunduh lengkap untuk seluruh jenis investasi, atau khusus satu jenis investasi di provinsi itu.',
    poin: [
      'Profil lengkap provinsi untuk seluruh jenis investasi',
      'Profil provinsi untuk satu jenis investasi tertentu',
      'Dokumen profil siap unduh dalam format PDF',
    ],
    aksi: ['Buka Profil Investasi', '/profil-investasi'],
    lencana: [FileText, BarChart3, Download],
    fotoKiri: true,
    saranFoto: 'kegiatan usaha kelautan, mis. pelabuhan atau pengolahan hasil laut',
  },
];

const angka = (n) => (n === undefined ? '—' : formatNumber(n, 0));

const PitaKkp = () => (
  <div className="flex h-1.5" aria-hidden="true">
    <span className="w-[20%] bg-kkp-hijau" />
    <span className="w-[38%] bg-kkp-toska" />
    <span className="flex-1 bg-[#1B6A8A]" />
  </div>
);

const Judul = ({ alis, children }) => (
  <div>
    <p className="text-sm font-semibold text-kkp-700">{alis}</p>
    <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-kkp-900">{children}</h2>
  </div>
);

const FotoPlaceholder = ({ saran, gelap = false, className = '' }) => (
  <div
    className={`rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-6 text-center ${
      gelap ? 'border-white/40 bg-white/10 text-white/80' : 'border-slate-300 bg-slate-100 text-slate-500'
    } ${className}`}
  >
    <ImageIcon className={`w-10 h-10 ${gelap ? 'text-white/60' : 'text-slate-400'}`} />
    <span className="text-base font-semibold">(placeholder foto)</span>
    <span className={`text-xs max-w-xs ${gelap ? 'text-white/60' : 'text-slate-400'}`}>Saran: {saran}</span>
  </div>
);

const TombolMasuk = ({ isAuthenticated }) => (
  <Link
    to={isAuthenticated ? '/peta' : '/login'}
    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-kkp-800 bg-white hover:bg-kkp-100 rounded-full shadow-lg shadow-kkp-900/20 transition-colors"
  >
    {isAuthenticated ? 'Mulai Analisis Lokasi' : 'Masuk ke Aplikasi'}
    <ArrowRight className="w-4 h-4" />
  </Link>
);

const SARAN_FOTO_HERO = 'foto ikonik perairan atau pesisir Indonesia; PNG tanpa latar agar objeknya bisa menjulang keluar dari kartu';

const KartuFitur = ({ alis, judul, isi, poin, aksi, lencana, fotoKiri, saranFoto }) => {
  const [L1, L2, L3] = lencana;
  return (
    <div className="relative rounded-3xl bg-white border border-slate-200 shadow-[0_24px_60px_-30px_rgba(0,34,66,0.35)] p-6 sm:p-10 lg:p-14 grid lg:grid-cols-2 gap-12 items-center">
      <span className="hidden sm:flex absolute -left-5 top-12 w-11 h-11 rounded-full bg-kkp-hijau text-white items-center justify-center shadow-lg">
        <L1 className="w-5 h-5" />
      </span>
      <div>
        <Judul alis={alis}>{judul}</Judul>
        <p className="mt-5 text-slate-600 leading-relaxed">{isi}</p>
        <ul className="mt-6 space-y-3">
          {poin.map((t) => (
            <li key={t} className="flex items-start gap-3 text-[15px] text-slate-700">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-kkp-100 text-kkp-700 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
              {t}
            </li>
          ))}
        </ul>
        <Link
          to={aksi[1]}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-kkp-700 hover:bg-kkp-800 rounded-full transition-colors"
        >
          {aksi[0]}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className={`relative ${fotoKiri ? 'lg:order-first' : ''}`}>
        <div className="absolute -inset-3 sm:-inset-5 rounded-[2.5rem] bg-gradient-to-br from-kkp-toska/30 via-kkp-700/10 to-kkp-hijau/30 rotate-2" aria-hidden="true" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-kkp-hijau/30" aria-hidden="true" />
        <FotoPlaceholder saran={saranFoto} className="relative aspect-[4/3] bg-slate-50" />
        {[
          [L2, 'bg-kkp-toska', '-top-5 left-10'],
          [L3, 'bg-kkp-700', '-bottom-5 right-12'],
        ].map(([Ikon, warna, letak]) => (
          <span key={letak} className={`absolute ${letak} w-12 h-12 rounded-full ${warna} text-white flex items-center justify-center shadow-lg ring-4 ring-white`}>
            <Ikon className="w-5 h-5" />
          </span>
        ))}
      </div>
    </div>
  );
};

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [ringkas, setRingkas] = useState(null);
  const refDeret = useRef(null);

  useEffect(() => {
    api.get('/inti/ringkasan-publik/').then(({ data }) => setRingkas(data)).catch(() => setRingkas({}));
  }, []);

  const peluang = ringkas?.peluang_per_jenis || [];
  const maksPeluang = Math.max(1, ...peluang.map((p) => p.zona));
  const geser = (arah) => refDeret.current?.scrollBy({ left: arah * 300, behavior: 'smooth' });

  const statistik = [
    { nilai: angka(ringkas?.proyek), label: 'Proyek investasi terpantau', catatan: 'dari LOI sampai operasional' },
    {
      nilai: angka(ringkas?.kkprl_aktif),
      label: 'Izin KKPRL berlaku',
      catatan: ringkas?.kkprl_luas_ha !== undefined && `${angka(ringkas.kkprl_luas_ha)} ha ruang laut`,
    },
    { nilai: angka(ringkas?.zona_peluang_tinggi), label: 'Zona laut berpeluang tinggi', catatan: 'untuk minimal satu jenis investasi' },
  ];

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-slate-50 text-slate-800 pt-[72px]">
      <section className="px-4 sm:px-6 lg:px-8 pt-8 lg:pt-14">
        <div className="relative max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-kkp-700 via-kkp-700 to-[#1B6A8A] text-white">
            <div className="absolute -right-24 -top-28 w-[30rem] h-[30rem] rounded-full bg-kkp-toska/25" aria-hidden="true" />
            <div className="absolute right-[30%] -bottom-40 w-80 h-80 rounded-full bg-kkp-hijau/20" aria-hidden="true" />
            <div className="relative grid lg:grid-cols-12 gap-10 px-6 sm:px-10 lg:px-14 pt-12 pb-32 lg:pt-16 lg:pb-36">
              <div className="lg:col-span-7">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08]">
                  Platform Manajemen Investasi Ruang Laut
                </h1>
                <p className="mt-5 text-lg text-white/80 leading-relaxed max-w-xl">
                  Alat kerja KKP untuk melihat kelayakan ruang laut bagi investasi: kesesuaian lokasi
                  dengan rencana tata ruang laut, tumpang tindih dengan KKPRL terbit, dan kelayakan
                  finansialnya.
                </p>
                <ul className="mt-8 space-y-3.5">
                  {KEMAMPUAN.map(({ ikon: Ikon, judul, isi }) => (
                    <li key={judul} className="flex items-start gap-3">
                      <span className="w-9 h-9 shrink-0 rounded-full bg-white/15 text-white flex items-center justify-center">
                        <Ikon className="w-[18px] h-[18px]" />
                      </span>
                      <span className="pt-1.5 text-[15px] text-white/75">
                        <b className="text-white">{judul}</b> {isi}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-9 flex flex-wrap gap-3">
                  <TombolMasuk isAuthenticated={isAuthenticated} />
                  <a href="#peluang" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white border border-white/40 hover:bg-white/10 rounded-full transition-colors">
                    Lihat Peluang Investasi
                  </a>
                </div>
                <FotoPlaceholder gelap saran={SARAN_FOTO_HERO} className="lg:hidden mt-10 aspect-[4/3]" />
              </div>
            </div>
          </div>
          <FotoPlaceholder
            gelap
            saran={SARAN_FOTO_HERO}
            className="hidden lg:flex absolute right-12 -top-10 bottom-24 w-[36%] bg-kkp-800/40 backdrop-blur-sm"
          />

          <div className="relative z-10 -mt-20 mx-4 sm:mx-10 lg:mx-14 grid sm:grid-cols-2 gap-4 max-w-2xl">
            {AKSI_CEPAT.map(({ ikon: Ikon, judul, isi, ke, warna }) => (
              <Link
                key={ke}
                to={ke}
                className={`group rounded-2xl ${warna} p-6 text-kkp-900 shadow-xl shadow-kkp-900/20 hover:-translate-y-1 transition-transform`}
              >
                <Ikon className="w-7 h-7" />
                <span className="mt-6 flex items-center gap-2 text-lg font-extrabold">
                  {judul}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="mt-1 block text-sm text-kkp-900/75">{isi}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 mt-14">
        <div className="max-w-7xl mx-auto rounded-3xl bg-kkp-900 text-white px-6 sm:px-10 py-10">
          <dl className="grid sm:grid-cols-3 gap-y-8 sm:divide-x sm:divide-white/15">
            {statistik.map(({ nilai, label, catatan }) => (
              <div key={label} className="sm:px-8 sm:first:pl-0">
                <dt className="sr-only">{label}</dt>
                <dd className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tabular-nums">{nilai}</dd>
                <dd className="mt-1 text-sm font-semibold text-white/90">{label}</dd>
                {catatan && <dd className="mt-0.5 text-xs text-white/55">{catatan}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="peluang" className="scroll-mt-20 px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Judul alis="Peluang investasi">Zona berpeluang tinggi per jenis investasi</Judul>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Setiap zona laut diberi skor untuk tiap jenis investasi dari kesesuaian tata ruang,
                potensi sumber daya, aksesibilitas, kondisi sosial ekonomi, dan risikonya. Angka di
                bawah adalah jumlah zona sesuai tata ruang dengan skor tertinggi; klik sebuah jenis
                untuk memilih provinsi dan mengunduh profil investasinya.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/peta?lapisan=potensi" className="px-4 py-2 rounded-full bg-kkp-900 hover:bg-kkp-800 text-white text-xs font-bold transition-colors">
                Lihat sebarannya di peta
              </Link>
              {[[-1, ChevronLeft, 'Geser ke kiri'], [1, ChevronRight, 'Geser ke kanan']].map(([arah, Ikon, label]) => (
                <button
                  key={arah}
                  type="button"
                  onClick={() => geser(arah)}
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-kkp-700 hover:bg-kkp-800 text-white flex items-center justify-center transition-colors"
                >
                  <Ikon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <div ref={refDeret} className="mt-10 -mx-1 px-1 pb-4 flex gap-4 overflow-x-auto snap-x snap-mandatory custom-scrollbar">
            {peluang.map(({ kode, nama, zona }) => (
              <Link
                key={kode}
                to={`/profil-investasi?jenis=${kode}`}
                className="group snap-start shrink-0 w-64 rounded-2xl bg-white border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col"
              >
                <span className="h-1.5" style={{ backgroundColor: warnaJenisInvestasi(kode) }} />
                <span className="p-5 flex-1 flex flex-col">
                  <span
                    className="self-start px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: warnaJenisInvestasi(kode) }}
                  >
                    Jenis investasi
                  </span>
                  <span className="mt-3 text-base font-bold text-kkp-900 leading-snug min-h-[2.75rem]">{nama}</span>
                  <span className="mt-4 text-3xl font-extrabold text-kkp-900 tabular-nums">{angka(zona)}</span>
                  <span className="text-xs text-slate-500">zona berpeluang tinggi</span>
                  <span className="mt-3 block h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${(zona / maksPeluang) * 100}%`, backgroundColor: warnaJenisInvestasi(kode) }} />
                  </span>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-kkp-700">
                    Pilih provinsi
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </span>
              </Link>
            ))}
            {ringkas && peluang.length === 0 && (
              <p className="text-sm text-slate-500">Skor zona belum dihitung.</p>
            )}
          </div>
        </div>
      </section>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-14 lg:space-y-20">
          {FITUR.map((f) => <KartuFitur key={f.judul} {...f} />)}
        </div>
      </div>

      <section className="px-4 sm:px-6 lg:px-8 pt-16">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Bersumber dari data resmi</p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {SUMBER.map((s) => (
            <li key={s} className="flex items-center gap-2 text-base font-bold text-slate-400">
              <Database className="w-4 h-4" />
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative max-w-7xl mx-auto overflow-hidden rounded-3xl bg-kkp-700 text-white text-center px-6 py-16">
          <div className="absolute -left-16 inset-y-0 w-1/2 bg-kkp-800/60 -skew-x-[20deg]" aria-hidden="true" />
          <div className="absolute -right-16 -bottom-24 w-72 h-72 rounded-full bg-kkp-toska/30" aria-hidden="true" />
          <div className="absolute right-1/4 -top-16 w-40 h-40 rounded-full bg-kkp-hijau/25" aria-hidden="true" />
          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Mulai dari satu titik di peta.</h2>
            <p className="mt-4 text-white/80">
              Hasil kesesuaian ruang keluar dalam hitungan detik, lengkap dengan sumber aturannya.
            </p>
            <div className="mt-8 flex justify-center">
              <TombolMasuk isAuthenticated={isAuthenticated} />
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-kkp-900 text-white">
        <PitaKkp />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-2 flex items-start gap-3">
            <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0">
              <img src="/logo-kkp.png" alt="Logo KKP" className="w-9 h-9 object-contain" />
            </span>
            <span>
              <span className="block text-sm font-bold">Kementerian Kelautan dan Perikanan</span>
              <span className="block text-xs text-white/60">Platform Manajemen Investasi Ruang Laut</span>
            </span>
          </div>
          <nav aria-label="Tautan kaki">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Menu</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[['Beranda', '/'], ['Peta Spasial', '/peta'], ['Profil Investasi', '/profil-investasi']].map(([label, ke]) => (
                <li key={ke}><Link to={ke} className="text-white/80 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Alamat</p>
            <p className="mt-3 text-sm text-white/80 leading-relaxed">Jl. Medan Merdeka Timur No. 16, Jakarta Pusat</p>
          </div>
        </div>
        <p className="border-t border-white/10 py-5 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Kementerian Kelautan dan Perikanan Republik Indonesia
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
