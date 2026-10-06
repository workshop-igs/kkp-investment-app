import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, Search } from 'lucide-react';
import { api } from '../../api/klien';

const JEDA_KETIK = 300;
const MIN_HURUF = 2;

export const usePencarian = (kata) => {
  const [hasil, setHasil] = useState([]);
  const [status, setStatus] = useState({ memuat: false, galat: null, sudahCari: false, untuk: '' });
  const pembatal = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    const q = kata.trim();
    if (timer.current) clearTimeout(timer.current);

    if (q.length < MIN_HURUF) {
      if (pembatal.current) pembatal.current.abort();
      setHasil([]);
      setStatus({ memuat: false, galat: null, sudahCari: false, untuk: '' });
      return undefined;
    }

    timer.current = setTimeout(() => {
      if (pembatal.current) pembatal.current.abort();
      const kontrol = new AbortController();
      pembatal.current = kontrol;
      setStatus({ memuat: true, galat: null, sudahCari: true, untuk: '' });

      api
        .get('/inti/cari/', { params: { q }, signal: kontrol.signal })
        .then(({ data }) => {
          setHasil(data?.hasil || []);
          setStatus({ memuat: false, galat: null, sudahCari: true, untuk: q });
        })
        .catch((err) => {
          if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
          const kode = err.response?.status;
          setHasil([]);
          setStatus({
            memuat: false,
            sudahCari: true,
            untuk: q,
            galat:
              kode === 429
                ? 'Terlalu banyak permintaan — tunggu sebentar'
                : kode >= 500
                ? 'Server sedang bermasalah'
                : 'Tidak dapat menghubungi server',
          });
        });
    }, JEDA_KETIK);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kata]);

  useEffect(() => () => pembatal.current?.abort(), []);

  return { hasil, status };
};

const PanelPencarian = ({ onTuju }) => {
  const [kata, setKata] = useState('');
  const { hasil, status } = usePencarian(kata);

  const kelompok = useMemo(() => {
    const peta = new Map();
    hasil.forEach((h) => {
      if (!peta.has(h.kelompok)) peta.set(h.kelompok, []);
      peta.get(h.kelompok).push(h);
    });
    return [...peta.entries()];
  }, [hasil]);

  const pilih = (h) =>
    onTuju({
      lat: h.titik ? h.titik[1] : null,
      lng: h.titik ? h.titik[0] : null,
      bbox: h.bbox,
      label: h.nama,
      keterangan: [h.jenis, h.keterangan].filter(Boolean).join(' · '),
      zoom: 13,
    });

  const kirim = (e) => {
    e.preventDefault();
    if (hasil.length) pilih(hasil[0]);
  };

  return (
    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-[19.5rem] max-w-[calc(100vw-6.5rem)]">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[calc(100vh-11rem)]">
        <div className="flex items-center gap-2 px-4 py-3 bg-kkp-800 text-white shrink-0">
          <Search className="w-4 h-4 shrink-0" />
          <span className="text-[13px] font-bold tracking-wide uppercase">Cari Lokasi</span>
        </div>

        <form onSubmit={kirim} className="px-3 py-2.5 bg-kkp-100 border-b border-kkp-200 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-kkp-700 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={kata}
              onChange={(e) => setKata(e.target.value)}
              placeholder="Nama pelabuhan, kawasan, provinsi…"
              className="w-full text-[13px] bg-white border border-kkp-200 rounded-lg pl-8 pr-3 py-2
                         text-slate-700 placeholder:text-slate-400
                         focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
            />
          </div>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {status.memuat && (
            <p className="px-4 py-4 text-[12px] text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Mencari…
            </p>
          )}

          {!status.memuat && status.galat && (
            <p className="px-4 py-4 text-[12px] text-rose-600 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{status.galat}</span>
            </p>
          )}

          {!status.memuat && !status.galat && status.sudahCari && hasil.length === 0 && (
            <p className="px-4 py-5 text-[12px] text-slate-400 text-center leading-relaxed">
              Tidak ada yang cocok dengan “{kata.trim()}”.
            </p>
          )}

          {!status.sudahCari && (
            <p className="px-4 py-5 text-[11.5px] text-slate-400 leading-relaxed">
              Ketik minimal {MIN_HURUF} huruf. Pencarian mencakup provinsi, pelabuhan,
              kawasan industri, jaringan listrik, izin KKPRL, zona tata ruang, dan unsur ruang laut.
            </p>
          )}

          {kelompok.map(([nama, isi]) => (
            <div key={nama}>
              <div className="px-3.5 py-1.5 bg-kkp-700 text-white text-[10px] font-bold uppercase tracking-wider">
                {nama}
              </div>
              {isi.map((h, i) => (
                <button
                  key={`${nama}-${i}`}
                  onClick={() => pilih(h)}
                  className="w-full text-left px-3.5 py-2.5 border-b border-slate-100 last:border-0
                             hover:bg-kkp-100/60 transition-colors flex items-start gap-2.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-kkp-700 shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-slate-700 font-semibold leading-snug">
                      {h.nama}
                    </span>
                    <span className="block text-[11px] text-slate-400 leading-snug">
                      {[h.jenis, h.keterangan].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <p className="px-4 py-2 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100 shrink-0 leading-snug">
          Wilayah administratif baru sampai tingkat provinsi. Kabupaten, kecamatan,
          dan kelurahan belum tersedia di basis data.
        </p>
      </div>
    </div>
  );
};

export default PanelPencarian;
