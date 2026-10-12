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
      <div className="absolute inset-0 bg-kkp-900/55 backdrop-blur-[3px]" />
      <div
        className={`relative w-full max-w-xs rounded-2xl bg-white px-7 py-7 text-center shadow-2xl ring-1 ring-black/5 transition-transform duration-200 ${
          tampil ? 'scale-100' : 'scale-95'
        }`}
      >
        {detik >= 3 && (
          <span className="absolute right-4 top-3 font-mono text-[11px] text-slate-400">{detik} dtk</span>
        )}
        <div className="relative mx-auto h-20 w-20">
          <div
            className={`absolute inset-0 rounded-full ${tampil ? 'animate-spin [animation-duration:1.1s]' : ''}`}
            style={{
              background: 'conic-gradient(from 0deg, rgba(64,191,219,0) 0 30%, #40BFDB 65%, #0056A5 100%)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px))',
            }}
          />
          <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-kkp-100/60">
            <img src="/logo-kkp.png" alt="" className="h-11 w-11 object-contain" />
          </div>
        </div>
        <p className="mt-5 text-[15px] font-bold leading-snug text-kkp-900">{judul}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{keterangan}</p>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-kkp-100">
          <div
            className={`h-full w-2/5 rounded-full bg-gradient-to-r from-kkp-700 to-kkp-toska ${
              tampil ? 'animate-[geser-muat_1.3s_ease-in-out_infinite]' : ''
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default OverlayMemuat;
