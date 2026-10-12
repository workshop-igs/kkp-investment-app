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
  ['/admin/data-sources', 'Sumber Data'],
  ['/admin/sectors', 'Sektor Investasi'],
  ['/admin/log-aktivitas', 'Log Aktivitas'],
  ['/admin', 'Dashboard Admin'],
];

const GELOMBANG = 'M0 16C20 6 40 6 60 16S100 26 120 16S160 6 180 16S220 26 240 16V40H0Z';
const LAPIS_OMBAK = [
  { warna: '#40BFDB', opasitas: 0.28, tinggi: 46, durasi: '7s' },
  { warna: '#1B6A8A', opasitas: 0.22, tinggi: 36, durasi: '5s' },
  { warna: '#0056A5', opasitas: 0.3, tinggi: 26, durasi: '3.6s' },
];

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
      <div className="absolute inset-0 bg-kkp-900/45 backdrop-blur-[2px]" />
      <div
        className={`relative w-full max-w-[22rem] overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_-25px_rgba(0,34,66,0.55)] ring-1 ring-kkp-900/10 transition-transform duration-200 ${
          tampil ? 'translate-y-0' : 'translate-y-2'
        }`}
      >
        <div className="relative h-24 overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF8FC_45%,#D3F0F8_100%)]">
          <div className="absolute inset-x-0 top-[22px] flex justify-center">
            <img
              src="/logo-kkp.png"
              alt=""
              className={`h-12 w-12 object-contain drop-shadow-[0_6px_8px_rgba(0,34,66,0.25)] ${
                tampil ? 'animate-[apung_2.6s_ease-in-out_infinite] motion-reduce:animate-none' : ''
              }`}
            />
          </div>
          {LAPIS_OMBAK.map(({ warna, opasitas, tinggi, durasi }) => (
            <svg
              key={warna + durasi}
              viewBox="0 0 240 40"
              preserveAspectRatio="none"
              aria-hidden="true"
              className={`absolute bottom-0 left-0 w-[200%] ${tampil ? 'animate-[ombak_linear_infinite] motion-reduce:animate-none' : ''}`}
              style={{ height: tinggi, animationDuration: durasi }}
            >
              <path d={GELOMBANG} fill={warna} fillOpacity={opasitas} />
            </svg>
          ))}
        </div>
        <div className="px-6 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-kkp-700">
              {jenis === 'halaman' ? 'Memuat' : 'Sedang diproses'}
            </span>
            {detik >= 3 && <span className="font-mono text-[11px] tabular-nums text-slate-400">{detik} dtk</span>}
          </div>
          <p className="mt-1.5 text-[16px] font-bold leading-snug text-kkp-900">{judul}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{keterangan}</p>
        </div>
      </div>
    </div>
  );
};

export default OverlayMemuat;
