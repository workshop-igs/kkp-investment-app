import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { api } from '../api/klien';
import { useAuth } from '../context/KonteksAuth';

const SARAN_HALAMAN = {
  '/peta': ['Bagaimana cara menggambar area proyek?', 'Bagaimana kesesuaian ruang diperiksa?'],
  '/dashboard': ['Bagaimana cara ekspor CSV?', 'Apa arti kartu Eksplorasi Potensi?'],
  '/pipeline': ['Bagaimana cara memperbarui status proyek?'],
  '/profil-investasi': ['Bagaimana lokasi prioritas ditentukan?'],
  '/admin': ['Apa saja isi menu Administrator?'],
};
const SARAN_UMUM = ['Apa saja menu di aplikasi ini?', 'Bagaimana skor AHP dihitung?'];

const saranUntuk = (pathname) => {
  const kunci = Object.keys(SARAN_HALAMAN).find((h) => pathname === h || pathname.startsWith(`${h}/`));
  return [...(kunci ? SARAN_HALAMAN[kunci] : []), ...SARAN_UMUM];
};

const AsistenMengambang = () => {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState([]);
  const [teks, setTeks] = useState('');
  const [memuat, setMemuat] = useState(false);
  const ujung = useRef(null);
  const terakhir = useRef(null);
  const masukan = useRef(null);
  const diPeta = pathname.startsWith('/peta');

  useEffect(() => {
    (memuat ? ujung : terakhir).current?.scrollIntoView({ block: memuat ? 'end' : 'start' });
  }, [pesan, memuat]);

  useEffect(() => {
    if (!buka) return undefined;
    masukan.current?.focus();
    const tutup = (e) => e.key === 'Escape' && setBuka(false);
    window.addEventListener('keydown', tutup);
    return () => window.removeEventListener('keydown', tutup);
  }, [buka]);

  const tanya = async (pertanyaan) => {
    const q = pertanyaan.trim();
    if (!q || memuat) return;
    setTeks('');
    setPesan((p) => [...p, { dari: 'pengguna', teks: q }]);
    setMemuat(true);
    try {
      const { data } = await api.post('/inti/asisten/alat/panduan_aplikasi/', {
        argumen: { pertanyaan: q, halaman: pathname },
      });
      const bagian = data.hasil?.bagian || [];
      setPesan((p) => [...p, {
        dari: 'asisten',
        bagian,
        teks: bagian.length ? '' : 'Belum ada bagian panduan yang cocok. Coba sebut nama menu, tombol, atau fitur yang dimaksud.',
      }]);
    } catch {
      setPesan((p) => [...p, { dari: 'asisten', teks: 'Asisten tidak dapat dihubungi. Coba lagi sebentar lagi.' }]);
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="print:hidden">
      {buka && (
        <section
          role="dialog"
          aria-label="Asisten KKP"
          className={`fixed right-4 sm:right-6 z-[1500] flex w-[calc(100vw-2rem)] sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-12px_rgba(0,34,66,0.45)] ${
            diPeta ? 'bottom-[172px] h-[min(520px,calc(100vh-17rem))]' : 'bottom-24 h-[min(520px,calc(100vh-11rem))]'
          }`}
        >
          <header className="flex items-center justify-between gap-3 bg-kkp-700 px-4 py-3 text-white">
            <div>
              <h2 className="text-[14px] font-bold leading-tight">Asisten KKP</h2>
              <p className="text-[11.5px] text-white/80">Panduan memakai aplikasi</p>
            </div>
            <button
              type="button"
              onClick={() => setBuka(false)}
              aria-label="Tutup asisten"
              className="rounded-full p-1.5 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {!isAuthenticated ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] leading-relaxed text-slate-600">
                Masuk terlebih dahulu untuk bertanya kepada asisten.
              </p>
              <Link
                to="/login"
                onClick={() => setBuka(false)}
                className="rounded-lg bg-kkp-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-kkp-800"
              >
                Masuk
              </Link>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
                <div className="rounded-xl bg-white p-3 text-[13px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
                  Tanyakan cara memakai fitur atau cara kerja perhitungan di aplikasi ini. Untuk saat ini jawaban
                  diambil langsung dari panduan aplikasi.
                </div>

                {pesan.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {saranUntuk(pathname).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => tanya(s)}
                        className="rounded-full border border-kkp-200 bg-white px-3 py-1.5 text-left text-[12px] text-kkp-800 hover:border-kkp-700 hover:bg-kkp-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {pesan.map((m, i) =>
                  m.dari === 'pengguna' ? (
                    <div key={i} ref={i === pesan.length - 1 ? terakhir : undefined} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-kkp-700 px-3 py-2 text-[13px] text-white">
                      {m.teks}
                    </div>
                  ) : (
                    <div key={i} ref={i === pesan.length - 1 ? terakhir : undefined} className="max-w-[92%] space-y-2">
                      {m.teks && (
                        <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px] text-slate-700 ring-1 ring-slate-200">
                          {m.teks}
                        </div>
                      )}
                      {m.bagian?.map((b) => (
                        <article key={b.id} className="rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 ring-1 ring-slate-200">
                          <h3 className="text-[13px] font-bold text-kkp-900">{b.judul}</h3>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{b.isi}</p>
                        </article>
                      ))}
                    </div>
                  )
                )}

                {memuat && (
                  <div className="flex items-center gap-2 text-[12px] text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Mencari di panduan…
                  </div>
                )}
                <div ref={ujung} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  tanya(teks);
                }}
                className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
              >
                <input
                  ref={masukan}
                  value={teks}
                  onChange={(e) => setTeks(e.target.value)}
                  placeholder="Tulis pertanyaan…"
                  aria-label="Pertanyaan untuk asisten"
                  maxLength={500}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
                />
                <button
                  type="submit"
                  disabled={!teks.trim() || memuat}
                  aria-label="Kirim pertanyaan"
                  className="rounded-lg bg-kkp-700 p-2 text-white hover:bg-kkp-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-label={buka ? 'Tutup asisten' : 'Buka asisten'}
        aria-expanded={buka}
        title="Asisten KKP"
        className={`fixed right-4 sm:right-6 z-[1500] flex h-14 w-14 items-center justify-center rounded-full bg-kkp-700 text-white shadow-[0_10px_28px_-8px_rgba(0,34,66,0.6)] transition-transform hover:scale-105 hover:bg-kkp-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-900 ${
          diPeta ? 'bottom-[104px]' : 'bottom-6'
        }`}
      >
        {buka ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default AsistenMengambang;
