import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, LandPlot, Loader2, Map as IkonPeta, MapPin, ScrollText, Search, Target, Waypoints, X,
} from 'lucide-react';
import { api } from '../../api/klien';
import PanelAlat from './PanelAlat';

const JEDA_KETIK = 300;
const MIN_HURUF = 2;
const IKON_KELOMPOK = {
  'Wilayah Administratif': IkonPeta,
  'Infrastruktur & Transportasi': Building2,
  'Lokasi Potensi Investasi': Target,
  'Zona Tata Ruang Laut': LandPlot,
  'Unsur Ruang Laut': Waypoints,
  'Perizinan Ruang Laut': ScrollText,
};
const CONTOH_CARI = ['Nusa Tenggara Barat', 'Bitung', 'Pelabuhan Benoa', 'Teluk Saleh'];

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
    <PanelAlat
      ikon={Search}
      warnaIkon="bg-kkp-700"
      judul="Cari lokasi"
      keterangan="Provinsi, pelabuhan, kawasan, zona, dan izin KKPRL"
      kepala={(
        <form onSubmit={kirim} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            autoFocus
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            placeholder="Ketik nama tempat"
            aria-label="Nama lokasi yang dicari"
            className="w-full text-[13px] bg-slate-100 border border-transparent rounded-lg pl-8 pr-8 py-2
                       text-slate-700 placeholder:text-slate-400 transition-colors
                       focus:bg-white focus:border-kkp-700 focus:outline-none focus:ring-2 focus:ring-kkp-700/15"
          />
          {kata && (
            <button
              type="button"
              onClick={() => setKata('')}
              aria-label="Kosongkan pencarian"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      )}
      kaki={(
        <p className="px-4 py-2 text-[10.5px] text-slate-400 bg-slate-50 border-t border-slate-100 shrink-0 leading-snug">
          Wilayah administratif baru sampai tingkat provinsi; kabupaten, kecamatan, dan kelurahan belum tersedia.
        </p>
      )}
    >
      {status.memuat && (
        <p className="px-4 py-4 text-[12px] text-slate-500 flex items-center gap-2">
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
        <p className="px-4 py-5 text-[12px] text-slate-500 leading-relaxed">
          Tidak ada yang cocok dengan “{kata.trim()}”. Coba ejaan lain atau nama yang lebih umum, misalnya nama provinsinya.
        </p>
      )}

      {!status.sudahCari && (
        <div className="px-3.5 py-3.5 space-y-2.5">
          <p className="text-[12px] text-slate-500 leading-relaxed">
            Ketik sedikitnya {MIN_HURUF} huruf, atau coba salah satu contoh:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CONTOH_CARI.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setKata(c)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600
                           hover:border-kkp-700 hover:text-kkp-800 transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {kelompok.map(([nama, isi]) => {
        const Ikon = IKON_KELOMPOK[nama] || MapPin;
        return (
          <section key={nama} className="pb-1.5 border-b border-slate-100 last:border-0">
            <h3 className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-white/95 backdrop-blur-sm px-3.5 pt-2.5 pb-1.5
                           text-[12px] font-semibold text-kkp-900">
              {nama}
              <span className="text-[11px] font-medium tabular-nums text-slate-400">{isi.length}</span>
            </h3>
            {isi.map((h, i) => (
              <button
                key={`${nama}-${i}`}
                type="button"
                onClick={() => pilih(h)}
                className="mx-1.5 w-[calc(100%-0.75rem)] flex items-start gap-2.5 rounded-lg px-2 py-2 text-left
                           hover:bg-kkp-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/30 transition-colors"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-kkp-100 text-kkp-700">
                  <Ikon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] text-slate-800 font-semibold leading-snug">{h.nama}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug">
                    {[h.jenis, h.keterangan].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </PanelAlat>
  );
};

export default PanelPencarian;
