import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Anchor, Briefcase, Check, CheckCircle2, Construction, Database, Factory, FileCheck2, FileText, Fish,
  FlaskConical, Gem, Layers, Map, MapPinned, Palmtree, Shell, ShieldCheck, Sprout, Zap,
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

const KEMAMPUAN = ['Cek kesesuaian ruang', 'Hitung NPV dan IRR', 'Pantau pipeline proyek'];

const SUMBER = ['Portal Satu Data KKP', 'RTRW Provinsi', 'Sidako KKP', 'BNPB InaRISK', 'BPS', 'NOAA'];

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

const Poin = ({ children }) => (
  <li className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-700">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kkp-100 text-kkp-700">
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
    {children}
  </li>
);

const TombolUtama = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center rounded-full bg-kkp-700 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-kkp-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-700"
  >
    {children}
  </Link>
);

const KartuMelayang = ({ ikon: Ikon, warna, judul, isi, className }) => (
  <div className={`absolute hidden items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-[0_18px_40px_-12px_rgba(0,20,45,0.45)] sm:flex ${className}`}>
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${warna}`}>
      <Ikon className="h-[18px] w-[18px]" />
    </span>
    <span>
      <span className="block text-sm font-bold text-kkp-900">{judul}</span>
      <span className="block text-xs text-slate-500">{isi}</span>
    </span>
  </div>
);

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const [ringkas, setRingkas] = useState(null);

  useEffect(() => {
    api.get('/inti/ringkasan-publik/').then(({ data }) => setRingkas(data)).catch(() => setRingkas({}));
  }, []);

  const peluang = ringkas?.peluang_per_jenis || [];
  const maksPeluang = Math.max(1, ...peluang.map((p) => p.zona));

  const statistik = [
    { ikon: Briefcase, nilai: angka(ringkas?.proyek), label: 'Proyek investasi terpantau', catatan: 'Dari LOI sampai operasional' },
    {
      ikon: FileCheck2,
      nilai: angka(ringkas?.kkprl_aktif),
      label: 'Izin KKPRL berlaku',
      catatan: ringkas?.kkprl_luas_ha !== undefined ? `${angka(ringkas.kkprl_luas_ha)} ha ruang laut` : 'Ruang laut yang sudah berizin',
    },
    { ikon: MapPinned, nilai: angka(ringkas?.zona_peluang_tinggi), label: 'Zona laut berpeluang tinggi', catatan: 'Untuk minimal satu jenis investasi' },
    { ikon: Layers, nilai: ringkas ? angka(peluang.length) : '—', label: 'Jenis investasi dinilai', catatan: 'Skor kelayakan untuk setiap zona' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-white pt-[72px] text-slate-800">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#001a33_0%,#002242_38%,#004584_76%,#0056a5_100%)] text-white">
        <GarisKontur className="pointer-events-none absolute -right-48 -top-56 h-[880px] w-[880px] text-white/[0.07]" />
        <GarisKontur className="pointer-events-none absolute -bottom-72 -left-64 h-[640px] w-[640px] text-white/[0.05]" />
        <div className="pointer-events-none absolute right-[12%] top-[28%] h-80 w-80 rounded-full bg-kkp-toska/25 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-40 pt-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-44 lg:pt-20">
          <div className="lg:col-span-6">
            <h1 className="text-4xl font-extrabold leading-[1.06] tracking-[-0.02em] sm:text-5xl xl:text-[3.5rem]">
              Platform Manajemen Investasi Ruang Laut
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Alat kerja KKP untuk menilai kelayakan ruang laut bagi investasi: kesesuaian lokasi dengan rencana
              tata ruang laut, tumpang tindih dengan KKPRL yang sudah terbit, dan kelayakan finansialnya.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/peta"
                className="inline-flex items-center rounded-full bg-white px-6 py-3.5 text-sm font-bold text-kkp-800 shadow-lg shadow-black/20 transition-colors hover:bg-kkp-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Buka Peta Spasial
              </Link>
              <Link
                to="/profil-investasi"
                className="inline-flex items-center rounded-full border border-white/35 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Profil Investasi
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-white/80">
              {KEMAMPUAN.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-kkp-toska" />
                  {k}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative lg:col-span-6">
            <div className="overflow-hidden rounded-2xl ring-1 ring-white/20 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.65)]">
              <img
                src="/beranda/hero-peta.webp"
                alt="Peta Spasial menampilkan zona pola ruang laut dan izin KKPRL di Nusa Tenggara Barat"
                width="1200"
                height="882"
                className="block h-auto w-full"
              />
            </div>
            <KartuMelayang
              ikon={Layers}
              warna="bg-kkp-100 text-kkp-700"
              judul="Pola ruang laut dan KKPRL"
              isi="Nusa Tenggara Barat"
              className="-left-6 top-8"
            />
            <KartuMelayang
              ikon={ShieldCheck}
              warna="bg-emerald-50 text-emerald-600"
              judul="Kesesuaian ruang"
              isi="Diperiksa terhadap RTRW Provinsi"
              className="-bottom-7 right-6"
            />
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-24 px-4 sm:px-6 lg:px-8">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-28px_rgba(0,34,66,0.4)] ring-1 ring-slate-900/5 lg:grid-cols-4">
          {statistik.map(({ ikon: Ikon, nilai, label, catatan }, i) => (
            <div
              key={label}
              className={`px-5 py-7 sm:px-8 ${i % 2 ? 'border-l border-slate-100' : ''} ${i >= 2 ? 'border-t border-slate-100 lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kkp-100 text-kkp-700">
                <Ikon className="h-5 w-5" />
              </span>
              <dd className="mt-4 text-3xl font-extrabold tracking-tight text-kkp-900 tabular-nums">{nilai}</dd>
              <dt className="mt-1 text-sm font-semibold text-slate-700">{label}</dt>
              <dd className="mt-0.5 text-xs text-slate-500">{catatan}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="peluang" className="scroll-mt-24 px-4 pt-20 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold tracking-[-0.015em] text-kkp-900 sm:text-4xl">
                Zona berpeluang tinggi per jenis investasi
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Setiap zona laut diberi skor untuk tiap jenis investasi dari kesesuaian tata ruang, potensi sumber
                daya, aksesibilitas, kondisi sosial ekonomi, dan risikonya. Pilih satu jenis untuk membuka profil
                investasinya per provinsi.
              </p>
            </div>
            <Link to="/peta?lapisan=potensi" className="text-sm font-bold text-kkp-700 underline-offset-4 hover:underline">
              Lihat sebarannya di peta
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {peluang.map(({ kode, nama, zona }) => {
              const Ikon = IKON_JENIS[kode] || Layers;
              const warna = warnaJenisInvestasi(kode);
              return (
                <Link
                  key={kode}
                  to={`/profil-investasi?jenis=${kode}`}
                  className="group flex flex-col rounded-2xl bg-white p-4 ring-1 sm:p-5 ring-slate-200 transition-shadow hover:shadow-[0_18px_40px_-20px_rgba(0,34,66,0.35)] hover:ring-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kkp-700"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${warna}1a`, color: warna }}>
                    <Ikon className="h-5 w-5" />
                  </span>
                  <span className="mt-4 min-h-[2.5rem] text-sm font-bold leading-snug text-kkp-900">{nama}</span>
                  <span className="mt-3 text-2xl font-extrabold text-kkp-900 tabular-nums">{angka(zona)}</span>
                  <span className="text-xs text-slate-500">zona berpeluang tinggi</span>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full" style={{ width: `${(zona / maksPeluang) * 100}%`, backgroundColor: warna }} />
                  </span>
                  <span className="mt-4 text-xs font-bold text-kkp-700 group-hover:underline">Pilih provinsi</span>
                </Link>
              );
            })}
            {ringkas && peluang.length === 0 && <p className="text-sm text-slate-500">Skor zona belum dihitung.</p>}
          </div>
        </div>
      </section>

      <section className="px-4 pt-24 sm:px-6 lg:px-8 lg:pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-kkp-700 text-white">
              <Map className="h-5 w-5" />
            </span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.015em] text-kkp-900 sm:text-4xl">
              Seluruh data ruang laut dalam satu peta
            </h2>
            <p className="mt-5 leading-relaxed text-slate-600">
              KKPRL yang sudah terbit tampil langsung per jenis investasi. Layer lain dapat dinyalakan sesuai
              kebutuhan, dan setiap zona dapat diklik untuk melihat ketentuannya atau dijadikan area analisis.
            </p>
            <ul className="mt-6 space-y-3">
              <Poin>Pola ruang laut dari RTRW Provinsi, Rencana Zonasi KAW, dan RTRWN</Poin>
              <Poin>Infrastruktur pendukung, ekosistem, dan risiko bencana pesisir</Poin>
              <Poin>Skor kelayakan zona untuk setiap jenis investasi</Poin>
            </ul>
            <div className="mt-8">
              <TombolUtama to="/peta">Buka Peta Spasial</TombolUtama>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl ring-1 ring-slate-900/10 shadow-[0_30px_70px_-30px_rgba(0,34,66,0.45)]">
              <img
                src="/beranda/fitur-peta.webp"
                alt="Tampilan Peta Spasial dengan legenda pola ruang laut dan pin izin KKPRL"
                width="1400"
                height="805"
                loading="lazy"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-24 sm:px-6 lg:px-8 lg:pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="relative pb-10 pr-8 sm:pb-14 sm:pr-14 lg:col-span-7">
            <img
              src="/beranda/fitur-profil-zona.webp"
              alt=""
              width="1100"
              height="618"
              loading="lazy"
              className="absolute bottom-0 right-0 w-[88%] rounded-xl ring-1 ring-slate-900/10 shadow-[0_24px_50px_-28px_rgba(0,34,66,0.45)]"
            />
            <img
              src="/beranda/fitur-profil-sampul.webp"
              alt="Sampul dan halaman zona dari PDF profil investasi Provinsi Nusa Tenggara Barat"
              width="1100"
              height="618"
              loading="lazy"
              className="relative w-[88%] rounded-xl ring-1 ring-slate-900/10 shadow-[0_30px_70px_-30px_rgba(0,34,66,0.55)]"
            />
          </div>
          <div className="lg:col-span-5 lg:order-first">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-kkp-700 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.015em] text-kkp-900 sm:text-4xl">
              Profil investasi setiap provinsi
            </h2>
            <p className="mt-5 leading-relaxed text-slate-600">
              Setiap provinsi punya profil investasi berisi ringkasan potensi, tata ruang dan perizinan,
              komoditas unggulan, lokasi yang paling sesuai, serta kondisi sosial dan pasar kerjanya.
            </p>
            <ul className="mt-6 space-y-3">
              <Poin>Profil lengkap provinsi untuk seluruh jenis investasi</Poin>
              <Poin>Profil provinsi untuk satu jenis investasi tertentu</Poin>
              <Poin>Disusun otomatis dari data publik dan siap diunduh dalam PDF</Poin>
            </ul>
            <div className="mt-8">
              <TombolUtama to="/profil-investasi">Buka Profil Investasi</TombolUtama>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-7xl border-y border-slate-200 py-10">
          <p className="text-center text-sm font-semibold text-slate-500">Bersumber dari data resmi</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {SUMBER.map((s) => (
              <li key={s} className="flex items-center gap-2 text-base font-bold text-slate-400">
                <Database className="h-4 w-4" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#002242_0%,#004584_60%,#0056a5_100%)] px-6 py-16 text-center text-white sm:px-10">
          <GarisKontur className="pointer-events-none absolute -right-40 -top-64 h-[700px] w-[700px] text-white/[0.08]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-[-0.015em] sm:text-4xl">Mulai dari satu titik di peta.</h2>
            <p className="mt-4 text-white/75">
              Hasil kesesuaian ruang keluar dalam hitungan detik, lengkap dengan sumber aturannya.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to={isAuthenticated ? '/peta' : '/login'}
                className="inline-flex items-center rounded-full bg-white px-6 py-3.5 text-sm font-bold text-kkp-800 shadow-lg shadow-black/20 transition-colors hover:bg-kkp-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {isAuthenticated ? 'Mulai Analisis Lokasi' : 'Masuk ke Aplikasi'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-kkp-900 text-white">
        <PitaKkp />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="flex items-start gap-3 lg:col-span-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
              <img src="/logo-kkp.png" alt="Logo KKP" className="h-9 w-9 object-contain" />
            </span>
            <span>
              <span className="block text-sm font-bold">Kementerian Kelautan dan Perikanan</span>
              <span className="block text-xs text-white/60">Platform Manajemen Investasi Ruang Laut</span>
            </span>
          </div>
          <nav aria-label="Tautan kaki">
            <p className="text-sm font-semibold text-white/60">Menu</p>
            <ul className="mt-3 space-y-2 text-sm">
              {[['Beranda', '/'], ['Peta Spasial', '/peta'], ['Profil Investasi', '/profil-investasi']].map(([label, ke]) => (
                <li key={ke}><Link to={ke} className="text-white/80 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-sm font-semibold text-white/60">Alamat</p>
            <p className="mt-3 text-sm leading-relaxed text-white/80">Jl. Medan Merdeka Timur No. 16, Jakarta Pusat</p>
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
