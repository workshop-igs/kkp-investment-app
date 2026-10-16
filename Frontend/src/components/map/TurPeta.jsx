import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/KonteksAuth';

const LANGKAH = [
  {
    judul: 'Selamat datang di Peta Spasial',
    isi: 'Temukan dan uji lokasi investasi kelautan dalam 3 langkah:',
    poin: ['Tentukan area proyek', 'Isi parameter analisis', 'Dapatkan laporan kelayakan'],
  },
  {
    pilih: '[data-tur="legenda"]',
    judul: 'Lokasi indikatif',
    isi: 'Setiap titik adalah lokasi indikatif yang lolos penyaringan awal; warnanya menunjukkan jenis investasi. Klik sebuah titik lalu "Analisis lokasi ini".',
  },
  {
    peraga: true,
    judul: 'Info provinsi',
    isi: 'Klik sebuah provinsi untuk melihat ringkasan dan mengunduh profil investasinya.',
  },
  {
    pilih: '[data-tur="lapisan"]',
    judul: 'Layer data',
    isi: 'Nyalakan data tata ruang, KKPRL, infrastruktur, atau risiko bencana. Klik zona di peta untuk rinciannya.',
  },
  {
    pilih: '[data-tur="alat"]',
    judul: 'Alat peta',
    isi: 'Zoom, layer, peta dasar, koordinat, cari lokasi, ukur jarak, dan unduh PDF peta.',
  },
  {
    pilih: '[data-aksi-peta]',
    langkah: 1,
    judul: 'Tentukan area proyek',
    isi: 'Gambar area langsung di peta, atau unggah file SHP (.zip), KML, maupun GeoJSON.',
  },
  {
    langkah: 2,
    judul: 'Isi parameter analisis',
    isi: 'Tekan "Isi Parameter Analisis", lalu lengkapi identitas proyek. Sistem memeriksa kesesuaian ruang, kemudian menghitung kelayakan finansial.',
  },
  {
    langkah: 3,
    judul: 'Lihat laporan',
    isi: 'Unduh laporan lengkap (PDF) atau simpan ke Proyek Investasi.',
  },
  {
    pilih: '[data-tur="asisten"]',
    judul: 'Butuh bantuan?',
    isi: 'Tanyakan apa saja seputar aplikasi ke Asisten KKP.',
  },
  {
    pilih: '[data-tur="ulang-tur"]',
    judul: 'Buka tur lagi',
    isi: 'Tekan tombol ini kapan saja untuk mengulang tur.',
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
  const tengahX = k.left + k.width / 2 - w / 2;
  const tengahY = k.top + k.height / 2 - h / 2;
  const muatX = (left) => left >= TEPI && left + w <= W - TEPI;
  const muatY = (top) => top >= TEPI && top + h <= H - TEPI;
  const sisiKiri = { left: k.left - JARAK - w, top: tengahY };
  const sisiKanan = { left: k.right + JARAK, top: tengahY };
  const bawah = { left: tengahX, top: k.bottom + JARAK };
  const atas = { left: tengahX, top: k.top - JARAK - h };
  // Target tinggi (mis. panel legenda) tidak menyisakan ruang di atas/bawah:
  // taruh kartu di sampingnya agar tidak menutupi target.
  const pilihan = (k.left > W / 2 && muatX(sisiKiri.left) && sisiKiri)
    || (muatY(bawah.top) && bawah)
    || (muatY(atas.top) && atas)
    || (muatX(sisiKanan.left) && sisiKanan)
    || (muatX(sisiKiri.left) && sisiKiri)
    || atas;
  return { left: batasi(pilihan.left, TEPI, W - w - TEPI), top: batasi(pilihan.top, TEPI, H - h - TEPI) };
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
  const kunci = `kkp-tur-peta-v2:${user?.id ?? 'tamu'}`;
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
        {langkah.langkah && (
          <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">Langkah {langkah.langkah} dari 3</p>
        )}
        <h2 id="tur-judul" className="text-base font-bold text-slate-900 mt-1">{langkah.judul}</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{langkah.isi}</p>
        {langkah.poin && (
          <ol className="mt-3 space-y-2">
            {langkah.poin.map((teks, n) => (
              <li key={teks} className="flex items-center gap-2.5 text-sm font-medium text-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
                  {n + 1}
                </span>
                {teks}
              </li>
            ))}
          </ol>
        )}
        <div className="flex gap-1 mt-4" aria-label={`Langkah tur ${i + 1} dari ${daftar.length}`}>
          {daftar.map((l, n) => (
            <span key={l.judul} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-sky-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 mt-3">
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
              {i === 0 ? 'Mulai' : terakhir ? 'Selesai' : 'Lanjut'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TurPeta;
