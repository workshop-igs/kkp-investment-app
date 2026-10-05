import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Check, Ruler, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { azimut, formatJarak, jarakLatLng } from '../../utils/koordinat';

const WARNA = '#dc2626';

const ikonLabel = (teks) =>
  L.divIcon({
    className: 'label-ukur',
    html: `<span>${teks}</span>`,
    iconSize: null,
  });

const AlatUkur = ({ aktif, onTutup }) => {
  const map = useMap();
  const [titik, setTitik] = useState([]);
  const [pratinjau, setPratinjau] = useState(null);
  const [terkunci, setTerkunci] = useState(false);

  const bersihkan = useCallback(() => {
    setTitik([]);
    setPratinjau(null);
    setTerkunci(false);
  }, []);

  const selesai = useCallback(() => {
    setPratinjau(null);
    setTerkunci(true);
  }, []);

  const batalTitik = useCallback(() => {
    setTitik((t) => t.slice(0, -1));
    setTerkunci(false);
  }, []);

  useEffect(() => {
    if (!aktif) return undefined;

    const wadah = map.getContainer();
    wadah.classList.add('mode-ukur');
    map.closePopup();
    map.doubleClickZoom.disable();

    const klik = (e) => {
      if (terkunci) return;
      setTitik((t) => [...t, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    };
    const gerak = (e) => {
      if (terkunci) return;
      setPratinjau({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    const klikGanda = () => {
      setTitik((t) => (t.length > 1 ? t.slice(0, -1) : t));
      selesai();
    };
    const keluar = () => setPratinjau(null);

    const tombol = (e) => {
      if (e.key === 'Escape') {
        bersihkan();
        onTutup?.();
      } else if (e.key === 'Enter') {
        selesai();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        batalTitik();
      }
    };

    map.on('click', klik);
    map.on('mousemove', gerak);
    map.on('dblclick', klikGanda);
    map.on('mouseout', keluar);
    document.addEventListener('keydown', tombol);

    return () => {
      wadah.classList.remove('mode-ukur');
      map.doubleClickZoom.enable();
      map.off('click', klik);
      map.off('mousemove', gerak);
      map.off('dblclick', klikGanda);
      map.off('mouseout', keluar);
      document.removeEventListener('keydown', tombol);
    };
  }, [aktif, map, terkunci, selesai, bersihkan, batalTitik, onTutup]);

  useEffect(() => {
    if (!aktif) bersihkan();
  }, [aktif, bersihkan]);

  const ruas = useMemo(() => {
    const daftar = [];
    for (let i = 1; i < titik.length; i += 1) {
      const a = titik[i - 1];
      const b = titik[i];
      daftar.push({
        ke: i,
        meter: jarakLatLng(a, b),
        arah: azimut(a.lat, a.lng, b.lat, b.lng),
        tengah: { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 },
      });
    }
    return daftar;
  }, [titik]);

  const total = useMemo(() => ruas.reduce((n, r) => n + r.meter, 0), [ruas]);
  const totalDenganPratinjau = useMemo(() => {
    if (!pratinjau || !titik.length) return total;
    return total + jarakLatLng(titik[titik.length - 1], pratinjau);
  }, [total, pratinjau, titik]);

  if (!aktif) return null;

  const tampil = formatJarak(terkunci ? total : totalDenganPratinjau);
  const garis = titik.map((t) => [t.lat, t.lng]);
  const garisPratinjau =
    !terkunci && pratinjau && titik.length
      ? [[titik[titik.length - 1].lat, titik[titik.length - 1].lng], [pratinjau.lat, pratinjau.lng]]
      : null;

  return (
    <>
      {garis.length > 1 && (
        <Polyline positions={garis} pathOptions={{ color: WARNA, weight: 3, opacity: 0.95 }} />
      )}
      {garisPratinjau && (
        <Polyline
          positions={garisPratinjau}
          pathOptions={{ color: WARNA, weight: 2, opacity: 0.6, dashArray: '6,6' }}
        />
      )}
      {titik.map((t, i) => (
        <CircleMarker
          key={`simpul-${i}`}
          center={[t.lat, t.lng]}
          radius={i === 0 || i === titik.length - 1 ? 5.5 : 4}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: WARNA, fillOpacity: 1 }}
        />
      ))}
      {ruas.map((r) => (
        <Marker
          key={`label-${r.ke}`}
          position={[r.tengah.lat, r.tengah.lng]}
          icon={ikonLabel(formatJarak(r.meter).utama)}
          interactive={false}
        />
      ))}

      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-[19.5rem] max-w-[calc(100vw-6.5rem)] z-[1200]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[calc(100vh-11rem)]">
          <div className="flex items-center gap-2 px-4 py-3 bg-kkp-800 text-white shrink-0">
            <Ruler className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-bold tracking-wide uppercase">Ukur Jarak</span>
          </div>

          <div className="px-4 py-3 bg-kkp-100 border-b border-kkp-200 shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-kkp-700 font-bold mb-0.5">
              {terkunci ? 'Jarak total' : 'Jarak berjalan'}
            </div>
            <div className="text-2xl font-bold text-kkp-800 font-mono-custom leading-tight">
              {tampil.utama}
            </div>
            <div className="text-[12px] text-slate-500 font-mono-custom">{tampil.kedua}</div>
            {titik.length > 0 && (
              <div className="text-[11px] text-slate-400 mt-1">
                {titik.length} titik · {ruas.length} ruas
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {titik.length === 0 && (
              <p className="px-4 py-4 text-[11.5px] text-slate-500 leading-relaxed">
                Klik di peta untuk menaruh titik pertama, lalu klik lagi untuk menambah
                ruas. Klik ganda atau <b>Enter</b> untuk mengakhiri, <b>Esc</b> untuk keluar.
              </p>
            )}

            {ruas.map((r) => {
              const f = formatJarak(r.meter);
              return (
                <div
                  key={r.ke}
                  className="flex items-baseline gap-2 px-3.5 py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="text-[10px] font-bold text-slate-400 w-8 shrink-0">R{r.ke}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] text-slate-700 font-semibold font-mono-custom">
                      {f.utama}
                    </span>
                    <span className="block text-[10.5px] text-slate-400 font-mono-custom">
                      {f.kedua} · azimut {r.arah.toFixed(1)}°
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50 shrink-0 grid grid-cols-3 gap-1.5">
            <button
              onClick={batalTitik}
              disabled={!titik.length}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold
                         border border-slate-200 bg-white text-slate-600 hover:text-kkp-700 hover:border-kkp-200
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Batal
            </button>
            <button
              onClick={bersihkan}
              disabled={!titik.length}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold
                         border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus
            </button>
            {terkunci ? (
              <button
                onClick={bersihkan}
                className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold
                           bg-kkp-700 text-white hover:bg-kkp-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ulangi
              </button>
            ) : (
              <button
                onClick={selesai}
                disabled={ruas.length === 0}
                className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold
                           bg-kkp-700 text-white hover:bg-kkp-800 transition-colors
                           disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AlatUkur;
