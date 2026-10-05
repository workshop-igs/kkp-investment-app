import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/klien';
import { warnaJenisInvestasi } from '../utils/simbologiPeta';
import { formatNumber } from '../utils/pemformat';
import { SECTORS } from '../utils/konstanta';

const BATAS = { barat: 94, timur: 142, utara: 7, selatan: -12 };
const LEBAR = 1200;
const SKALA = LEBAR / (BATAS.timur - BATAS.barat);
const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const TINGGI = (merc(BATAS.utara) - merc(BATAS.selatan)) * SKALA;
const keX = (lon) => (lon - BATAS.barat) * SKALA;
const keY = (lat) => (merc(BATAS.utara) - merc(lat)) * SKALA;
const TEPI = 46;
const PITA = 5;
const TINTA = '#002242';

const GARIS_BUJUR = [95, 100, 105, 110, 115, 120, 125, 130, 135, 140];
const GARIS_LINTANG = [5, 0, -5, -10];
const labelLintang = (lat) => (lat === 0 ? '0°' : `${Math.abs(lat)}°${lat > 0 ? 'LU' : 'LS'}`);

const NAMA_LAUT = [
  [100.6, -8.7, 'Samudra Hindia'],
  [110.6, -5.0, 'Laut Jawa'],
  [121.4, -7.4, 'Laut Flores'],
  [127.6, -6.2, 'Laut Banda'],
  [135.8, -10.4, 'Laut Arafura'],
  [121.2, 3.9, 'Laut Sulawesi'],
  [134.5, 3.0, 'Samudra Pasifik'],
  [108.6, 6.1, 'Laut Natuna Utara'],
  [101.4, 4.2, 'Selat Malaka', -42],
];

const NAMA_JENIS = { ...Object.fromEntries(SECTORS.map((s) => [s.id, s.label])), LAINNYA: 'Kegiatan lain' };

const ALUR = [
  ['Tentukan area', 'Gambar poligon di Peta Spasial, atau unggah Shapefile (.zip), GeoJSON, atau KML.'],
  ['Periksa kesesuaian ruang', 'Area dicocokkan dengan RTRW Provinsi, Rencana Zonasi KAW, atau RTRWN, serta dengan KKPRL yang sudah terbit.'],
  ['Hitung kelayakan', 'NPV, IRR, ROI, dan risiko lokasi untuk jenis investasi yang dipilih.'],
  ['Simpan dan laporkan', 'Simpan sebagai proyek di pipeline, lalu unduh laporan analisisnya dalam PDF.'],
];

const SUMBER = [
  ['Portal Satu Data KKP', 'KKPRL yang sudah terbit, pola ruang laut, kawasan konservasi, dan sebaran mangrove.'],
  ['JDIH BPK', 'Peraturan daerah RTRW dan rencana zonasi yang menjadi dasar hukum tiap zona.'],
  ['Sidako KKP', 'Terumbu karang, padang lamun, dan wilayah kelola masyarakat hukum adat.'],
  ['BNPB InaRISK', 'Indeks bahaya dan risiko tsunami, banjir, serta gelombang ekstrem dan abrasi.'],
  ['BPS', 'Produksi dan nilai perikanan per komoditas, serta data ketenagakerjaan.'],
  ['NOAA ERDDAP', 'Kedalaman laut, suhu permukaan laut, klorofil-a, dan tinggi gelombang.'],
];

const angka = (n) => (n === undefined || n === null ? '—' : formatNumber(n, 0));

const jalurDarat = (fc) => {
  const bagian = [];
  const cincin = (koordinat) => {
    const titik = [];
    let akhir = null;
    koordinat.forEach(([lon, lat]) => {
      const x = keX(lon);
      const y = keY(lat);
      if (akhir && Math.abs(x - akhir[0]) < 0.5 && Math.abs(y - akhir[1]) < 0.5) return;
      akhir = [x, y];
      titik.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    });
    if (titik.length >= 3) bagian.push(`M${titik.join('L')}Z`);
  };
  (fc?.features || []).forEach(({ geometry: g }) => {
    const poligon = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    poligon.forEach((p) => p.forEach(cincin));
  });
  return bagian.join('');
};

const PitaKkp = ({ className = 'h-1.5' }) => (
  <div className={`flex ${className}`} aria-hidden="true">
    <span className="w-[20%] bg-kkp-hijau" />
    <span className="w-[38%] bg-kkp-toska" />
    <span className="flex-1 bg-[#1B6A8A]" />
  </div>
);

const BingkaiKoordinat = () => (
  <g>
    {Array.from({ length: BATAS.timur - BATAS.barat }, (_, i) => {
      const lon = BATAS.barat + i;
      const isi = i % 2 ? '#ffffff' : TINTA;
      return [-PITA, TINGGI].map((y) => (
        <rect key={`${lon}-${y}`} x={keX(lon)} y={y} width={SKALA} height={PITA} fill={isi} />
      ));
    })}
    {Array.from({ length: BATAS.utara - BATAS.selatan }, (_, i) => {
      const lat = BATAS.selatan + i;
      const isi = i % 2 ? '#ffffff' : TINTA;
      return [-PITA, LEBAR].map((x) => (
        <rect key={`${lat}-${x}`} x={x} y={keY(lat + 1)} width={PITA} height={keY(lat) - keY(lat + 1)} fill={isi} />
      ));
    })}
    <rect x={-PITA} y={-PITA} width={LEBAR + 2 * PITA} height={TINGGI + 2 * PITA} fill="none" stroke={TINTA} strokeWidth="0.9" />
    <rect x="0" y="0" width={LEBAR} height={TINGGI} fill="none" stroke={TINTA} strokeWidth="0.6" />
    <g className="max-sm:hidden" fill={TINTA} fontSize="10.5" fontWeight="500" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {GARIS_BUJUR.map((lon) => (
        <g key={lon} textAnchor="middle">
          <text x={keX(lon)} y={-PITA - 6}>{lon}°BT</text>
          <text x={keX(lon)} y={TINGGI + PITA + 15}>{lon}°BT</text>
        </g>
      ))}
      {GARIS_LINTANG.map((lat) => (
        <g key={lat} dominantBaseline="middle">
          <text x={-PITA - 5} y={keY(lat)} textAnchor="end">{labelLintang(lat)}</text>
          <text x={LEBAR + PITA + 5} y={keY(lat)}>{labelLintang(lat)}</text>
        </g>
      ))}
    </g>
  </g>
);

const SkalaDanArah = () => {
  const per250 = (250 / (111.32 * Math.cos((5 * Math.PI) / 180))) * SKALA;
  const x0 = keX(95.6);
  const y0 = keY(-11.1);
  const xu = keX(140.6);
  const yu = keY(5.4);
  return (
    <g className="max-sm:hidden" fill={TINTA} fontSize="10" fontWeight="500">
      <rect x={x0} y={y0} width={per250} height="4" fill={TINTA} />
      <rect x={x0 + per250} y={y0} width={per250} height="4" fill="#ffffff" stroke={TINTA} strokeWidth="0.8" />
      <rect x={x0} y={y0} width={per250 * 2} height="4" fill="none" stroke={TINTA} strokeWidth="0.8" />
      <text x={x0} y={y0 - 5} textAnchor="middle">0</text>
      <text x={x0 + per250} y={y0 - 5} textAnchor="middle">250</text>
      <text x={x0 + per250 * 2} y={y0 - 5} textAnchor="middle">500 km</text>
      <path d={`M${xu} ${yu - 16} L${xu + 6} ${yu + 4} L${xu} ${yu} L${xu - 6} ${yu + 4} Z`} fill={TINTA} />
      <text x={xu} y={yu + 16} textAnchor="middle" fontWeight="700">U</text>
    </g>
  );
};

const LembarPeta = ({ darat, titik, sorot, jumlah }) => {
  const perJenis = useMemo(() => {
    const kelompok = {};
    titik.forEach(([lon, lat, kode]) => {
      if (lon < BATAS.barat || lon > BATAS.timur || lat < BATAS.selatan || lat > BATAS.utara) return;
      (kelompok[kode] ||= []).push([keX(lon), keY(lat)]);
    });
    return Object.entries(kelompok);
  }, [titik]);

  return (
    <svg
      viewBox={`${-TEPI} ${-TEPI} ${LEBAR + 2 * TEPI} ${TINGGI + 2 * TEPI}`}
      className="block h-auto w-full"
      role="img"
      aria-label={`Peta Indonesia dengan ${angka(jumlah)} titik izin KKPRL yang berlaku, diwarnai menurut jenis investasi`}
    >
      <rect x="0" y="0" width={LEBAR} height={TINGGI} fill="#DCE9F3" />
      <g stroke="#0056A5" strokeOpacity="0.14" strokeWidth="0.6">
        {GARIS_BUJUR.map((lon) => <line key={lon} x1={keX(lon)} x2={keX(lon)} y1="0" y2={TINGGI} />)}
        {GARIS_LINTANG.map((lat) => <line key={lat} x1="0" x2={LEBAR} y1={keY(lat)} y2={keY(lat)} />)}
      </g>
      <path d={darat} fill="#ffffff" fillRule="evenodd" stroke="#9FB4C7" strokeWidth="0.5" strokeLinejoin="round" />
      <g className="max-sm:hidden" fill="#3B6E9C" fontSize="11" fontStyle="italic" fontWeight="600" letterSpacing="2.4" textAnchor="middle">
        {NAMA_LAUT.map(([lon, lat, nama, putar]) => (
          <text key={nama} x={keX(lon)} y={keY(lat)} transform={putar ? `rotate(${putar} ${keX(lon)} ${keY(lat)})` : undefined}>
            {nama.toUpperCase()}
          </text>
        ))}
      </g>
      {perJenis.map(([kode, daftar]) => (
        <g
          key={kode}
          fill={warnaJenisInvestasi(kode)}
          stroke="#ffffff"
          strokeWidth="0.7"
          opacity={sorot && sorot !== kode ? 0.12 : 1}
          className="transition-opacity duration-200"
        >
          {daftar.map(([x, y], i) => (
            <circle
              key={i}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r="2.6"
              className="motion-safe:animate-[muncul-titik_0.6s_ease-out_both]"
              style={{ animationDelay: `${Math.round((x / LEBAR) * 1100)}ms` }}
            />
          ))}
        </g>
      ))}
      <SkalaDanArah />
      <BingkaiKoordinat />
    </svg>
  );
};

const LandingPage = () => {
  const [ringkas, setRingkas] = useState(null);
  const [darat, setDarat] = useState('');
  const [sorot, setSorot] = useState(null);

  useEffect(() => {
    api.get('/inti/ringkasan-publik/').then(({ data }) => setRingkas(data)).catch(() => setRingkas({}));
    api
      .get('/inti/provinsi/peta/', { params: { ringkas: 1 } })
      .then(({ data }) => setDarat(jalurDarat(data)))
      .catch(() => setDarat(''));
  }, []);

  const titik = useMemo(() => ringkas?.kkprl_titik || [], [ringkas]);
  const legenda = useMemo(() => {
    const izin = {};
    titik.forEach(([, , kode]) => { izin[kode] = (izin[kode] || 0) + 1; });
    const zona = Object.fromEntries((ringkas?.peluang_per_jenis || []).map((p) => [p.kode, p.zona]));
    return [...new Set([...Object.keys(izin), ...Object.keys(zona)])]
      .map((kode) => ({ kode, nama: NAMA_JENIS[kode] || kode, izin: izin[kode] || 0, zona: zona[kode] }))
      .sort((a, b) => (a.kode === 'LAINNYA') - (b.kode === 'LAINNYA') || b.izin - a.izin || (b.zona || 0) - (a.zona || 0));
  }, [titik, ringkas]);

  const tanpaGeometri = ringkas?.kkprl_aktif !== undefined ? ringkas.kkprl_aktif - titik.length : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#EEF3F7] pt-[72px] text-kkp-900">
      <section className="px-4 pt-10 sm:px-6 lg:px-8 lg:pt-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-[3.6rem]">
              Ruang laut Indonesia, dinilai untuk investasi.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
              Platform kerja KKP untuk memeriksa apakah sebuah lokasi sesuai dengan rencana tata ruang laut,
              apakah sudah dipegang KKPRL lain, dan apakah layak secara finansial.
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="flex flex-wrap gap-3">
              <Link
                to="/peta"
                className="inline-flex items-center rounded-md bg-kkp-700 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-kkp-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-700"
              >
                Buka Peta Spasial
              </Link>
              <Link
                to="/profil-investasi"
                className="inline-flex items-center rounded-md border border-kkp-900/20 bg-white px-5 py-3 text-sm font-bold text-kkp-900 transition-colors hover:border-kkp-700 hover:text-kkp-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-700"
              >
                Unduh profil investasi provinsi
              </Link>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
              Peta dan profil investasi dapat dibuka tanpa masuk. Analisis area dan pipeline proyek
              memerlukan akun KKP.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pt-10 sm:px-6 lg:px-8">
        <figure className="mx-auto max-w-7xl overflow-hidden rounded bg-white shadow-[0_1px_2px_rgba(0,34,66,0.06),0_18px_40px_-24px_rgba(0,34,66,0.35)] ring-1 ring-kkp-900/10">
          <PitaKkp className="h-1" />
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-5 sm:px-8">
            <span>
              <span className="block text-lg font-bold">Izin KKPRL yang berlaku</span>
              <span className="block text-sm text-slate-500">Satu titik untuk satu izin, diwarnai menurut jenis investasinya.</span>
            </span>
            <Link to="/peta" className="text-sm font-semibold text-kkp-700 underline-offset-4 hover:underline">
              Buka di Peta Spasial
            </Link>
          </figcaption>

          <div className="px-2 pb-2 pt-3 sm:px-5">
            <LembarPeta darat={darat} titik={titik} sorot={sorot} jumlah={titik.length} />
          </div>

          <div className="grid gap-8 border-t border-kkp-900/10 px-5 py-6 sm:px-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <h2 className="text-sm font-bold">Jenis investasi</h2>
              <p className="mt-0.5 text-sm text-slate-500">Arahkan untuk menyorot di peta, klik untuk membuka profil investasinya.</p>
              <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                {legenda.map(({ kode, nama, izin, zona }) => {
                  const isi = (
                    <>
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: warnaJenisInvestasi(kode), boxShadow: `0 0 0 3px ${warnaJenisInvestasi(kode)}33` }}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">{nama}</span>
                        <span className="block text-xs leading-relaxed text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {angka(izin)} izin KKPRL
                          {zona !== undefined && <><br />{angka(zona)} zona berpeluang tinggi</>}
                        </span>
                      </span>
                    </>
                  );
                  const kelas = `flex items-start gap-3 rounded px-2 py-2 transition-colors ${sorot === kode ? 'bg-kkp-100' : ''}`;
                  const sorotan = {
                    onMouseEnter: () => setSorot(kode),
                    onMouseLeave: () => setSorot(null),
                    onFocus: () => setSorot(kode),
                    onBlur: () => setSorot(null),
                  };
                  return (
                    <li key={kode}>
                      {kode === 'LAINNYA' ? (
                        <span tabIndex={0} className={`${kelas} outline-none focus-visible:ring-2 focus-visible:ring-kkp-700`} {...sorotan}>{isi}</span>
                      ) : (
                        <Link
                          to={`/profil-investasi?jenis=${kode}`}
                          className={`${kelas} hover:bg-kkp-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kkp-700`}
                          {...sorotan}
                        >
                          {isi}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="lg:col-span-4 lg:border-l lg:border-kkp-900/10 lg:pl-8">
              <h2 className="text-sm font-bold">Keterangan</h2>
              <dl className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div>
                  <dt className="font-bold text-kkp-900">{angka(ringkas?.kkprl_aktif)} izin KKPRL berlaku</dt>
                  <dd>
                    Seluas {angka(ringkas?.kkprl_luas_ha)} ha.
                    {tanpaGeometri > 0 && ` ${angka(tanpaGeometri)} izin belum bergeometri sehingga tidak tergambar.`}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-kkp-900">{angka(ringkas?.zona_peluang_tinggi)} zona laut berpeluang tinggi</dt>
                  <dd>Untuk minimal satu jenis investasi, dari skor kesesuaian tata ruang, sumber daya, akses, sosial ekonomi, dan risiko.</dd>
                </div>
                <div>
                  <dt className="font-bold text-kkp-900">{angka(ringkas?.proyek)} proyek investasi</dt>
                  <dd>Dipantau di pipeline dari LOI sampai operasional.</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs leading-relaxed text-slate-400">Sumber: Portal Satu Data KKP. Proyeksi Mercator.</p>
            </div>
          </div>
        </figure>
      </section>

      <section className="px-4 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-xl text-3xl font-extrabold tracking-[-0.015em]">Dari satu area sampai laporan kelayakan</h2>
            <Link to="/peta" className="text-sm font-semibold text-kkp-700 underline-offset-4 hover:underline">
              Mulai di Peta Spasial
            </Link>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-4 md:gap-6">
            {ALUR.map(([judul, isi], i) => (
              <li key={judul} className="relative flex gap-4 md:block">
                {i < ALUR.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-8 left-[15px] top-8 border-l border-dashed border-kkp-900/30 md:-right-6 md:bottom-auto md:left-8 md:top-[15px] md:border-l-0 md:border-t"
                  />
                )}
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-kkp-900 bg-[#EEF3F7] text-sm font-bold">
                  {i + 1}
                </span>
                <span className="block md:mt-5">
                  <span className="block font-bold">{judul}</span>
                  <span className="mt-1 block max-w-xs text-sm leading-relaxed text-slate-600">{isi}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-3xl font-extrabold tracking-[-0.015em]">Data yang dipakai</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              Lapisan peta ditarik dari sumber resmi lalu disimpan di basis data aplikasi, sehingga peta tetap
              tampil meski situs sumbernya sedang tidak bisa dihubungi.
            </p>
          </div>
          <dl className="grid gap-x-10 sm:grid-cols-2 lg:col-span-8">
            {SUMBER.map(([nama, isi]) => (
              <div key={nama} className="border-t border-kkp-900/15 py-4">
                <dt className="font-bold">{nama}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-600">{isi}</dd>
              </div>
            ))}
          </dl>
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
