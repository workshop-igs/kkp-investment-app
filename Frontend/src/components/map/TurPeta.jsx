import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/KonteksAuth';

const LANGKAH = [
  {
    judul: 'Selamat datang di Peta Spasial',
    isi: 'Di sini Anda menentukan area proyek, memeriksa kesesuaian ruangnya, lalu menilai kelayakan investasinya. Tur singkat ini menunjukkan setiap alat di peta.',
  },
  {
    pilih: '[data-tur="menu"]',
    judul: 'Menu utama',
    isi: 'Beranda kembali ke halaman depan, Peta Spasial adalah halaman ini, dan Profil Investasi menyajikan profil investasi per provinsi beserta PDF-nya. Setelah masuk, Dashboard Nasional merangkum potensi dan proyek seluruh Indonesia, dan Proyek Investasi berisi proyek yang sudah disimpan beserta tahapnya. Akun administrator juga melihat menu Administrator.',
  },
  {
    pilih: '[data-tur="legenda"]',
    judul: 'Legenda peta',
    isi: 'Arti warna setiap layer yang sedang menyala. Tampilan awal memuat Peta Sebaran Wilayah Potensial Investasi: setiap titik adalah lokasi dengan sedikitnya 5 parameter terukur yang 75% di antaranya sangat sesuai untuk sebuah jenis investasi, dan batas lokasinya tampak setelah peta diperbesar. Klik judulnya untuk membuka atau menutup legenda.',
  },
  {
    peraga: true,
    judul: 'Ringkasan provinsi',
    isi: 'Arahkan kursor ke sebuah provinsi: batasnya menyala dan namanya muncul, seperti contoh di peta. Klik provinsi untuk membuka ringkasannya; dari panel itu profil investasi provinsi dan profil per jenis investasi dapat diunduh sebagai PDF.',
  },
  {
    pilih: '[data-tur="zoom"]',
    judul: 'Perbesar dan perkecil',
    isi: 'Mengatur skala peta. Roda gulir tetikus juga bisa dipakai.',
  },
  {
    pilih: '[data-tur="basemap"]',
    judul: 'Peta dasar',
    isi: 'Mengganti latar peta: Satelit, Jalan, atau Topografi.',
  },
  {
    pilih: '[data-tur="lapisan"]',
    judul: 'Daftar layer',
    isi: 'Menyalakan data seperti KKPRL terbit, RTRW Provinsi, Rencana Zonasi KAW, infrastruktur, risiko bencana, dan sebaran wilayah potensial investasi. Pada KKPRL dan layer tata ruang bisa dipilih satu kategori saja, misalnya hanya perikanan tangkap. Klik sebuah zona di peta untuk rinciannya; pada layer tata ruang dan Peta Sebaran Wilayah Potensial Investasi tersedia tombol "Analisis lokasi ini" untuk menjadikan zona itu area proyek.',
  },
  {
    pilih: '[data-tur="koordinat"]',
    judul: 'Input koordinat',
    isi: 'Menuju titik lintang dan bujur tertentu.',
  },
  {
    pilih: '[data-tur="cari"]',
    judul: 'Cari lokasi',
    isi: 'Menemukan lokasi berdasarkan nama, misalnya pelabuhan, kawasan, atau provinsi.',
  },
  {
    pilih: '[data-tur="ukur"]',
    judul: 'Ukur jarak',
    isi: 'Klik titik-titik di peta untuk mengukur jarak. Klik ganda atau Enter untuk mengakhiri, Esc untuk keluar.',
  },
  {
    pilih: '[data-tur="kompas"]',
    judul: 'Geser peta',
    isi: 'Tombol U, S, T, dan B menggeser peta ke utara, selatan, timur, dan barat.',
  },
  {
    pilih: '.leaflet-control-minimap',
    judul: 'Peta mini',
    isi: 'Menunjukkan posisi tampilan saat ini di peta yang lebih luas. Tombol di pojoknya menyembunyikan peta mini.',
  },
  {
    pilih: '[data-tur="gambar"]',
    judul: 'Gambar area proyek',
    isi: 'Klik titik-titik sudut di peta (minimal 3), lalu tekan Enter, Selesai Menggambar, atau klik titik pertama. Undo menghapus titik terakhir. Menggambar tetap bisa di atas layer yang sedang menyala.',
  },
  {
    pilih: '[data-tur="gambar"] + div',
    judul: 'Unggah file geospasial',
    isi: 'Cara lain menentukan area: unggah shapefile (.zip), KML, atau GeoJSON.',
  },
  {
    pilih: '[data-aksi-peta]',
    judul: 'Setelah area terbentuk',
    isi: 'Periksa batas area di peta, lalu tekan Isi Parameter Analisis. Kembali ke Area memusatkan peta ke area, Upload Ulang mengganti area, dan Reset menghapusnya.',
  },
  {
    judul: 'Analisis tiga langkah',
    isi: '1) Identitas Proyek: nama proyek, jenis investasi, investor, dan lokasi detail; provinsi dan kabupaten/kota terisi otomatis dari area. 2) Analisis Ruang: kesesuaian terhadap rencana tata ruang, tumpang tindih dengan KKPRL terbit, dan tabel kegiatan diperbolehkan, bersyarat, dan tidak diperbolehkan beserta sumber aturannya. Lokasi yang tidak sesuai berhenti di sini, dan sistem menawarkan jenis investasi atau lokasi alternatif. 3) Analisis Finansial: CapEx, pendapatan, OpEx, pertumbuhan, tingkat diskonto, dan umur proyek.',
  },
  {
    judul: 'Laporan hasil analisis',
    isi: 'Laporan memuat informasi umum, tata ruang dan perizinan, transportasi dan infrastruktur, sosial dan ketenagakerjaan, risiko lingkungan dan sosial, serta kelayakan investasi, masing-masing dengan sumber dan tahun datanya. Lihat Laporan Lengkap (PDF) mengunduh laporan, dan Simpan ke Proyek Investasi menyimpan proyek.',
  },
  {
    pilih: '[data-tur="ulang-tur"]',
    judul: 'Buka tur lagi',
    isi: 'Tur ini dapat dibuka kembali kapan saja lewat tombol ini.',
  },
];

const JARAK = 12;
const TEPI = 16;

const tampak = (pilih) => {
  const el = document.querySelector(pilih);
  if (!el) return false;
  const k = el.getBoundingClientRect();
  return k.width > 0 && k.height > 0;
};

const sudahDilihat = (kunci) => {
  try {
    return localStorage.getItem(kunci) === '1';
  } catch {
    return true;
  }
};

const tandaiDilihat = (kunci) => {
  try {
    localStorage.setItem(kunci, '1');
  } catch {}
};

const batasi = (n, min, maks) => Math.max(min, Math.min(n, maks));

const letakKartu = (k, w, h) => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!k) return { left: (W - w) / 2, top: (H - h) / 2 };
  let left = k.left + k.width / 2 - w / 2;
  let top;
  if (k.left > W / 2 && k.left - JARAK - w >= TEPI) {
    left = k.left - JARAK - w;
    top = k.top + k.height / 2 - h / 2;
  } else if (k.bottom + JARAK + h <= H - TEPI) {
    top = k.bottom + JARAK;
  } else {
    top = k.top - JARAK - h;
  }
  return { left: batasi(left, TEPI, W - w - TEPI), top: batasi(top, TEPI, H - h - TEPI) };
};

const letakBawah = (w, h) => ({ left: (window.innerWidth - w) / 2, top: window.innerHeight - h - TEPI });

const kotakDari = (pilih) => (tampak(pilih) ? document.querySelector(pilih).getBoundingClientRect() : null);

const bertumpuk = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const areaBebas = (batasBawah) => {
  const atas = (kotakDari('header')?.bottom ?? 0) + JARAK;
  const kanan = (kotakDari('[data-tur="zoom"]')?.left ?? window.innerWidth) - JARAK;
  const legenda = kotakDari('[data-tur="legenda"]');
  return (k) => k.left >= TEPI && k.right <= kanan && k.top >= atas && k.bottom <= batasBawah
    && !(legenda && bertumpuk(k, legenda));
};

const TurPeta = ({ aktif, setAktif, peraga }) => {
  const { user } = useAuth();
  const kunci = `kkp-tur-peta:${user?.id ?? 'tamu'}`;
  const [daftar, setDaftar] = useState([]);
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState(null);
  const [posisi, setPosisi] = useState(null);
  const refKartu = useRef(null);
  const refLanjut = useRef(null);

  useEffect(() => {
    if (sudahDilihat(kunci)) return undefined;
    const t = setTimeout(() => setAktif(true), 800);
    return () => clearTimeout(t);
  }, [kunci, setAktif]);

  useEffect(() => {
    if (!aktif) return;
    setDaftar(LANGKAH.filter((l) => !l.pilih || tampak(l.pilih)));
    setI(0);
  }, [aktif]);

  const langkah = aktif ? daftar[i] : null;
  const terakhir = i === daftar.length - 1;

  const tutup = () => {
    tandaiDilihat(kunci);
    setI(0);
    setAktif(false);
  };

  useLayoutEffect(() => {
    if (!langkah) return undefined;
    if (langkah.peraga) {
      setKotak(null);
      return undefined;
    }
    const ukur = () => {
      setKotak(langkah.pilih ? kotakDari(langkah.pilih) : null);
    };
    ukur();
    window.addEventListener('resize', ukur);
    return () => window.removeEventListener('resize', ukur);
  }, [langkah]);

  useLayoutEffect(() => {
    const kartu = refKartu.current;
    if (!kartu) return;
    const letak = langkah?.peraga ? letakBawah : (w, h) => letakKartu(kotak, w, h);
    setPosisi(letak(kartu.offsetWidth, kartu.offsetHeight));
  }, [kotak, langkah]);

  useLayoutEffect(() => {
    refLanjut.current?.focus();
  }, [langkah]);

  useEffect(() => {
    if (!langkah?.peraga || !peraga) return undefined;
    return peraga(areaBebas(window.innerHeight - TEPI * 2 - refKartu.current.offsetHeight), setKotak);
  }, [langkah, peraga]);

  useEffect(() => {
    if (!langkah) return undefined;
    const tombol = (e) => {
      if (e.key === 'Escape') tutup();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, daftar.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', tombol);
    return () => document.removeEventListener('keydown', tombol);
  });

  if (!langkah) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000]" role="dialog" aria-modal="true" aria-labelledby="tur-judul">
      {kotak ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/90 pointer-events-none transition-all duration-200"
          style={{
            top: kotak.top - 6,
            left: kotak.left - 6,
            width: kotak.width + 12,
            height: kotak.height + 12,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.6)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}

      <div
        ref={refKartu}
        className="absolute w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
        style={posisi ?? { opacity: 0 }}
      >
        <p className="text-[11px] font-semibold text-kkp-700 tabular-nums">
          {i + 1} / {daftar.length}
        </p>
        <h2 id="tur-judul" className="text-base font-bold text-slate-900 mt-1">{langkah.judul}</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{langkah.isi}</p>
        <div className="flex items-center justify-between gap-2 mt-4">
          <button onClick={tutup} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            {terakhir ? 'Tutup' : 'Lewati tur'}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button
                onClick={() => setI(i - 1)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Kembali
              </button>
            )}
            <button
              ref={refLanjut}
              onClick={() => (terakhir ? tutup() : setI(i + 1))}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg"
            >
              {terakhir ? 'Selesai' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TurPeta;
