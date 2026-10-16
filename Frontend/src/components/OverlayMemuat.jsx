import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/klien';

const JEDA_TAMPIL = 300;
const JEDA_TENANG = 250;
const MIN_TAMPIL = 400;
const BATAS_TRANSISI = 12000;

const NAMA_HALAMAN = [
  ['/peta', 'Peta Spasial'],
  ['/profil-investasi', 'Profil Investasi'],
  ['/dashboard', 'Dashboard Nasional'],
  ['/pipeline/', 'Detail Proyek'],
  ['/pipeline', 'Proyek Investasi'],
  ['/analysis-report', 'Laporan Analisis'],
  ['/profil', 'Profil Saya'],
  ['/login', 'Halaman Masuk'],
  ['/register', 'Pendaftaran'],
  ['/admin/users', 'Manajemen Pengguna'],
  ['/admin/pipeline', 'Proyek Investasi'],
  ['/admin/sectors', 'Sektor Investasi'],
  ['/admin/log-aktivitas', 'Log Aktivitas'],
  ['/admin', 'Dashboard Admin'],
];

const OMBAK = 'M0 6q20-7 40 0' + 't40 0'.repeat(12) + 'V90H0z';
const FONT_TANDA = "'Public Sans', ui-sans-serif, system-ui, sans-serif";
const IKAN = [[66, 'lm-ikan', 1.25], [75, 'lm-ikan-b', 1], [60, 'lm-ikan-c', 0.9]];
const GELEMBUNG = [[64, 0], [118, -0.9], [172, -1.7], [236, -0.4], [298, -2.1]];
const RUMPUT = [[40, 22, '#8CC63F'], [96, 28, '#4E8A2E'], [150, 20, '#8CC63F'], [214, 26, '#4E8A2E'], [268, 24, '#8CC63F'], [322, 20, '#4E8A2E']];
const rumput = (h) => `M0 0c-4 ${-h / 4} 4 ${-h / 4} 0 ${-h / 2}s-4 ${-h / 4} 0 ${-h / 2}`;

const TandaLaut = ({ className }) => (
  <svg viewBox="0 0 360 136" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="lm-langit" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9ADFEC" />
        <stop offset="1" stopColor="#5BBFD6" />
      </linearGradient>
      <linearGradient id="lm-air" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="40">
        <stop offset="0" stopColor="#40BFDB" />
        <stop offset=".45" stopColor="#1B6A8A" />
        <stop offset=".75" stopColor="#0056A5" />
        <stop offset="1" stopColor="#002242" />
      </linearGradient>
      <clipPath id="lm-huruf">
        <text x="180" y="84" textAnchor="middle" textLength="330" lengthAdjust="spacingAndGlyphs" fontFamily={FONT_TANDA} fontWeight="800" fontSize="68">
          ruang laut
        </text>
      </clipPath>
    </defs>
    <g clipPath="url(#lm-huruf)">
      <rect width="360" height="136" fill="url(#lm-langit)" />
      <g className="lm-pasang">
        <g transform="translate(-40 50)">
          <path className="lm-ombak-b" d={OMBAK} fill="#7FD3E6" />
        </g>
        <g transform="translate(0 54)">
          <path className="lm-ombak" d={OMBAK} fill="url(#lm-air)" />
        </g>
      </g>
      {IKAN.map(([y, kelas, skala]) => (
        <g key={kelas} transform={`translate(0 ${y}) scale(${skala})`}>
          <path className={kelas} d="M0 0q8-6 15 0q-7 6-15 0zM14 0l6-4.5v9z" fill="#E7F7FB" fillOpacity=".9" />
        </g>
      ))}
      {GELEMBUNG.map(([x, jeda]) => (
        <g key={x} transform={`translate(${x} 92)`}>
          <circle className="lm-gelembung" r="1.8" fill="#fff" fillOpacity=".85" style={{ animationDelay: `${jeda}s` }} />
        </g>
      ))}
      {RUMPUT.map(([x, tinggi, warna]) => (
        <g key={x} transform={`translate(${x} 92)`}>
          <path className="lm-rumput" d={rumput(tinggi)} stroke={warna} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      ))}
      {[128, 250].map((x) => (
        <g key={x} transform={`translate(${x} 92)`}>
          <path d="M0 0V-12M0-5L-5-11M0-8L4-14M-5-11L-7-14M4-14L7-15" stroke="#F2994A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
    <text x="184.5" y="122" textAnchor="middle" fontFamily={FONT_TANDA} fontWeight="700" fontSize="19" letterSpacing="9" fill="#1E3A5F">
      investasi
    </text>
  </svg>
);

const namaHalaman = (path) => (NAMA_HALAMAN.find(([awalan]) => path.startsWith(awalan)) || [null, 'Beranda'])[1];

let urutan = 0;
let keadaan = { transisi: null, tugas: [] };
const pendengar = new Set();
const langgan = (f) => {
  pendengar.add(f);
  return () => pendengar.delete(f);
};
const ubah = (baru) => {
  keadaan = { ...keadaan, ...baru };
  pendengar.forEach((f) => f());
};
const ubahTransisi = (id, sebagian) => {
  if (keadaan.transisi?.id === id) ubah({ transisi: { ...keadaan.transisi, ...sebagian } });
};
const akhiriTransisi = (id) => {
  if (keadaan.transisi?.id === id) ubah({ transisi: null });
};

let timerTenang = null;
const tungguTenang = (id) => {
  clearTimeout(timerTenang);
  timerTenang = setTimeout(() => {
    if (keadaan.transisi?.id === id && keadaan.transisi.permintaan === 0) akhiriTransisi(id);
  }, JEDA_TENANG);
};

const mulaiTransisi = (nama, segera) => {
  urutan += 1;
  const id = urutan;
  ubah({ transisi: { id, nama, permintaan: 0, dipakai: false, matang: segera } });
  if (!segera) setTimeout(() => ubahTransisi(id, { matang: true }), JEDA_TAMPIL);
  setTimeout(() => akhiriTransisi(id), BATAS_TRANSISI);
  tungguTenang(id);
};

api.interceptors.request.use((config) => {
  const t = keadaan.transisi;
  if (t && (config.method || 'get').toLowerCase() === 'get') {
    config.idTransisi = t.id;
    ubahTransisi(t.id, { permintaan: t.permintaan + 1, dipakai: true });
  }
  return config;
});

const lepas = (config) => {
  const t = keadaan.transisi;
  if (!config?.idTransisi || !t || t.id !== config.idTransisi) return;
  const sisa = Math.max(0, t.permintaan - 1);
  ubahTransisi(t.id, { permintaan: sisa });
  if (sisa === 0) tungguTenang(t.id);
};

api.interceptors.response.use(
  (resp) => {
    lepas(resp.config);
    return resp;
  },
  (err) => {
    lepas(err.config);
    return Promise.reject(err);
  },
);

export const mulaiMemuat = (judul) => {
  urutan += 1;
  const tugas = { id: urutan, judul };
  ubah({ tugas: [...keadaan.tugas, tugas] });
  return () => ubah({ tugas: keadaan.tugas.filter((t) => t !== tugas) });
};

const ambilKeadaan = () => keadaan;

const OverlayMemuat = () => {
  const { pathname } = useLocation();
  const pertama = useRef(true);
  useLayoutEffect(() => {
    mulaiTransisi(namaHalaman(pathname), pertama.current);
    pertama.current = false;
  }, [pathname]);

  const { transisi, tugas } = useSyncExternalStore(langgan, ambilKeadaan);
  const kerja = tugas[tugas.length - 1];
  const isiAktif = kerja
    ? { judul: kerja.judul, jenis: 'tugas' }
    : transisi?.matang && transisi.dipakai
      ? { judul: `Memuat ${transisi.nama}`, jenis: 'halaman' }
      : null;

  const aktif = !!isiAktif;
  const [tampil, setTampil] = useState(true);
  const isi = useRef({ judul: 'Memuat aplikasi', jenis: 'halaman' });
  const sejak = useRef(0);
  if (isiAktif) isi.current = isiAktif;

  useEffect(() => {
    if (aktif) {
      if (!tampil) {
        sejak.current = Date.now();
        setTampil(true);
      }
      return undefined;
    }
    if (!tampil) return undefined;
    const t = setTimeout(() => setTampil(false), Math.max(0, MIN_TAMPIL - (Date.now() - sejak.current)));
    return () => clearTimeout(t);
  }, [aktif, tampil]);

  const [detik, setDetik] = useState(0);
  useEffect(() => {
    if (!tampil) return undefined;
    setDetik(0);
    const mulai = Date.now();
    const jam = setInterval(() => setDetik(Math.floor((Date.now() - mulai) / 1000)), 1000);
    return () => clearInterval(jam);
  }, [tampil]);

  const { judul, jenis } = isi.current;
  const keterangan =
    jenis === 'halaman'
      ? 'Mengambil data terbaru dari server…'
      : detik >= 10
        ? 'Area besar atau dokumen panjang perlu waktu lebih lama. Jangan tutup halaman ini.'
        : 'Mohon tunggu, proses ini dapat memerlukan beberapa detik.';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={tampil}
      aria-hidden={!tampil}
      className={`fixed inset-0 z-[4000] flex items-center justify-center p-6 transition-[opacity,visibility] duration-200 ${
        tampil ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-white/85 backdrop-blur-[3px]" />
      <div
        className={`relative flex w-full max-w-sm flex-col items-center text-center transition-transform duration-300 ${
          tampil ? 'translate-y-0' : 'translate-y-2'
        }`}
      >
        <TandaLaut className={`w-[300px] max-w-full ${tampil ? '' : 'lm-diam'}`} />
        <div className="mt-3 flex items-center gap-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-kkp-700">
          <span>{jenis === 'halaman' ? 'Memuat' : 'Sedang diproses'}</span>
          {detik >= 3 && <span className="tabular-nums text-slate-400">· {detik} dtk</span>}
        </div>
        <p className="mt-1.5 text-[15px] font-bold leading-snug text-kkp-900">{judul}</p>
        <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-slate-500">{keterangan}</p>
      </div>
    </div>
  );
};

export default OverlayMemuat;
