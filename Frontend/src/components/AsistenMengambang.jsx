import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, CornerDownRight, Loader2, Send, X } from 'lucide-react';
import { api } from '../api/klien';
import { useAuth } from '../context/KonteksAuth';

const SARAN_HALAMAN = {
  '/peta': ['Bagaimana cara menggambar area proyek?', 'Bagaimana kesesuaian ruang diperiksa?'],
  '/dashboard': ['Bagaimana cara ekspor CSV?', 'Apa saja isi bagian Potensi ruang laut?'],
  '/pipeline': ['Bagaimana cara memperbarui tahap proyek?'],
  '/profil-investasi': ['Bagaimana lokasi prioritas ditentukan?'],
  '/admin': ['Apa saja isi menu Administrator?'],
};
const SARAN_UMUM = ['Apa saja menu di aplikasi ini?', 'Bagaimana skor AHP dihitung?'];

const SARAN_AREA = 'Apakah area yang saya gambar sesuai untuk perikanan budidaya?';

const saranUntuk = (pathname, adaArea) => {
  const kunci = Object.keys(SARAN_HALAMAN).find((h) => pathname === h || pathname.startsWith(`${h}/`));
  return [...(adaArea ? [SARAN_AREA] : []), ...(kunci ? SARAN_HALAMAN[kunci] : []), ...SARAN_UMUM];
};

const AvatarAsisten = () => (
  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-kkp-100 text-kkp-800" aria-hidden="true">
    <Bot className="h-4 w-4" />
  </span>
);

const AsistenMengambang = () => {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [buka, setBuka] = useState(false);
  const [pesan, setPesan] = useState([]);
  const [teks, setTeks] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [modeObrolan, setModeObrolan] = useState(true);
  const [area, setArea] = useState(null);
  const ujung = useRef(null);
  const terakhir = useRef(null);
  const masukan = useRef(null);
  const diPeta = pathname.startsWith('/peta');

  useEffect(() => {
    (memuat ? ujung : terakhir).current?.scrollIntoView({ block: memuat ? 'end' : 'start' });
  }, [pesan, memuat]);

  useEffect(() => {
    const atur = (e) => setBuka(Boolean(e.detail));
    window.addEventListener('kkp:asisten', atur);
    return () => window.removeEventListener('kkp:asisten', atur);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('kkp:asisten-status', { detail: buka }));
  }, [buka]);

  useEffect(() => {
    const simpan = (e) => setArea(e.detail || null);
    window.addEventListener('kkp:area', simpan);
    return () => window.removeEventListener('kkp:area', simpan);
  }, []);

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
    const riwayat = [...pesan, { dari: 'pengguna', teks: q }];
    setPesan(riwayat);
    setMemuat(true);
    if (modeObrolan) {
      try {
        const { data } = await api.post('/inti/asisten/obrolan/', {
          pesan: riwayat.filter((m) => m.teks).slice(-8).map((m) => ({ peran: m.dari, teks: m.teks })),
          halaman: pathname,
          geometri: area,
        }, { timeout: 180000 });
        setPesan((p) => [...p, { dari: 'asisten', teks: data.jawaban, alat: data.alat || [] }]);
        setMemuat(false);
        return;
      } catch (e) {
        if (e.response?.status !== 503) {
          setPesan((p) => [...p, { dari: 'asisten', teks: 'Asisten belum dapat menjawab saat ini. Coba lagi sebentar lagi.' }]);
          setMemuat(false);
          return;
        }
        setModeObrolan(false);
      }
    }
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
          className={`fixed z-[1500] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-12px_rgba(0,34,66,0.45)] animate-fade-in ${
            diPeta
              ? 'right-[80px] top-24 bottom-[104px] w-[380px] max-w-[calc(100vw-6.5rem)]'
              : 'right-4 sm:right-6 bottom-24 w-[calc(100vw-2rem)] sm:w-[380px] h-[min(560px,calc(100vh-11rem))]'
          }`}
        >
          <header className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kkp-800 text-white">
              <Bot className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-kkp-toska ring-2 ring-white" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-bold leading-tight text-kkp-900">Asisten KKP</h2>
              <p className="text-[11.5px] leading-snug text-slate-500">
                {modeObrolan ? 'Tanya jawab seputar aplikasi dan datanya' : 'Panduan memakai aplikasi'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBuka(false)}
              aria-label="Tutup asisten"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/40"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <>
              <div className="flex-1 space-y-4 overflow-y-auto px-3.5 py-4 custom-scrollbar">
                <div className="flex items-start gap-2.5">
                  <AvatarAsisten />
                  <p className="rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
                    {!modeObrolan
                      ? 'Tanyakan cara memakai fitur atau cara kerja perhitungan di aplikasi ini. Untuk saat ini jawaban diambil langsung dari panduan aplikasi.'
                      : isAuthenticated
                        ? 'Tanyakan cara memakai fitur, cara kerja perhitungan, atau data di aplikasi ini, misalnya proyek, lokasi, dan profil investasi provinsi.'
                        : 'Tanyakan cara memakai fitur, lokasi di peta, atau profil investasi provinsi.'}
                    {modeObrolan && area && isAuthenticated && ' Area yang sedang Anda gambar ikut diperiksa.'}
                    {!isAuthenticated && (
                      <>
                        {' '}Data proyek dan pemeriksaan area tersedia setelah Anda{' '}
                        <Link to="/login" onClick={() => setBuka(false)} className="font-semibold text-kkp-800 underline">
                          masuk
                        </Link>
                        .
                      </>
                    )}
                  </p>
                </div>

                {pesan.length === 0 && (
                  <div className="pl-[2.375rem]">
                    <p className="mb-1.5 text-[12px] font-semibold text-kkp-900">Coba tanyakan</p>
                    <div className="space-y-1">
                      {saranUntuk(pathname, modeObrolan && area && isAuthenticated).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => tanya(s)}
                          className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[12.5px] leading-snug text-slate-700
                                     hover:border-kkp-700 hover:text-kkp-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/30 transition-colors"
                        >
                          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-kkp-toska" aria-hidden="true" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pesan.map((m, i) =>
                  m.dari === 'pengguna' ? (
                    <div
                      key={i}
                      ref={i === pesan.length - 1 ? terakhir : undefined}
                      className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md bg-kkp-800 px-3 py-2 text-[13px] leading-relaxed text-white"
                    >
                      {m.teks}
                    </div>
                  ) : (
                    <div key={i} ref={i === pesan.length - 1 ? terakhir : undefined} className="flex items-start gap-2.5">
                      <AvatarAsisten />
                      <div className="min-w-0 max-w-[88%] space-y-2">
                        {m.teks && (
                          <div className="whitespace-pre-line rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
                            {m.teks}
                          </div>
                        )}
                        {m.bagian?.map((b) => (
                          <article key={b.id} className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3 py-2.5">
                            <h3 className="text-[13px] font-bold text-kkp-900">{b.judul}</h3>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{b.isi}</p>
                          </article>
                        ))}
                        {m.alat?.length > 0 && (
                          <p className="px-1 text-[11px] text-slate-400">Sumber: {m.alat.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  )
                )}

                {memuat && (
                  <div className="flex items-center gap-2.5" role="status">
                    <AvatarAsisten />
                    <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-3 py-3">
                      {[0, 150, 300].map((jeda) => (
                        <span
                          key={jeda}
                          className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce"
                          style={{ animationDelay: `${jeda}ms` }}
                        />
                      ))}
                      <span className="sr-only">
                        {modeObrolan ? 'Asisten sedang menyusun jawaban' : 'Mencari di panduan'}
                      </span>
                    </span>
                  </div>
                )}
                <div ref={ujung} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  tanya(teks);
                }}
                className="border-t border-slate-100 p-3"
              >
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 pl-3 pr-1.5 py-1.5 ring-kkp-700/15 focus-within:bg-white focus-within:ring-2">
                  <input
                    ref={masukan}
                    value={teks}
                    onChange={(e) => setTeks(e.target.value)}
                    placeholder="Tulis pertanyaan"
                    aria-label="Pertanyaan untuk asisten"
                    maxLength={500}
                    className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!teks.trim() || memuat}
                    aria-label="Kirim pertanyaan"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kkp-800 text-white hover:bg-kkp-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </form>
          </>
        </section>
      )}

      {!diPeta && (
        <button
          type="button"
          onClick={() => setBuka((v) => !v)}
          aria-label={buka ? 'Tutup asisten' : 'Buka asisten'}
          aria-expanded={buka}
          title="Asisten KKP"
          data-tur="asisten"
          className="fixed bottom-6 right-4 sm:right-6 z-[1500] inline-flex items-center gap-2 rounded-full bg-kkp-800 py-3 pl-3.5 pr-3.5 sm:pr-4
                     text-[13px] font-semibold text-white shadow-[0_10px_28px_-8px_rgba(0,34,66,0.6)] transition-colors hover:bg-kkp-900
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-900"
        >
          <span className="relative">
            {buka ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            {!buka && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-kkp-toska ring-2 ring-kkp-800" aria-hidden="true" />
            )}
          </span>
          <span className="hidden sm:inline">{buka ? 'Tutup' : 'Tanya asisten'}</span>
        </button>
      )}
    </div>
  );
};

export default AsistenMengambang;
