import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Check, Ruler, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { azimut, formatJarak, jarakLatLng } from '../../utils/koordinat';
import PanelAlat from './PanelAlat';

const WARNA = '#dc2626';
const KBD = 'rounded border border-slate-300 bg-slate-50 px-1 py-px font-mono-custom text-[10.5px] text-slate-700';

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

      <PanelAlat
        ikon={Ruler}
        warnaIkon="bg-rose-600"
        judul="Ukur jarak"
        keterangan={terkunci ? 'Pengukuran selesai' : titik.length ? 'Klik lagi untuk menambah ruas' : 'Klik di peta untuk menaruh titik pertama'}
        kepala={(
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11.5px] text-slate-500">{terkunci ? 'Jarak total' : 'Jarak berjalan'}</p>
              <p className="font-mono-custom text-[28px] font-semibold leading-tight text-kkp-900 tabular-nums">{tampil.utama}</p>
              <p className="font-mono-custom text-[12px] text-slate-500">{tampil.kedua}</p>
            </div>
            {titik.length > 0 && (
              <p className="shrink-0 text-right text-[11.5px] leading-snug text-slate-500 tabular-nums">
                {titik.length} titik
                <br />
                {ruas.length} ruas
              </p>
            )}
          </div>
        )}
        kaki={(
          <div className="p-2.5 border-t border-slate-100 shrink-0 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={batalTitik}
              disabled={!titik.length}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 bg-white text-slate-600 hover:text-kkp-700 hover:border-kkp-200"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Batal titik
            </button>
            <button
              type="button"
              onClick={bersihkan}
              disabled={!titik.length}
              className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus
            </button>
            {terkunci ? (
              <button type="button" onClick={bersihkan} className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-kkp-700 text-white hover:bg-kkp-800">
                <RotateCcw className="w-3.5 h-3.5" />
                Ukur lagi
              </button>
            ) : (
              <button
                type="button"
                onClick={selesai}
                disabled={ruas.length === 0}
                className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-kkp-700 text-white hover:bg-kkp-800 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Check className="w-3.5 h-3.5" />
                Selesai
              </button>
            )}
          </div>
        )}
      >
        {titik.length === 0 ? (
          <ul className="px-4 py-3.5 space-y-2 text-[12px] leading-relaxed text-slate-600">
            <li>Klik di peta untuk menaruh titik, lalu klik lagi untuk menambah ruas.</li>
            <li>
              Klik ganda atau <kbd className={KBD}>Enter</kbd> untuk mengakhiri,{' '}
              <kbd className={KBD}>Ctrl</kbd>+<kbd className={KBD}>Z</kbd> untuk membatalkan titik terakhir.
            </li>
            <li><kbd className={KBD}>Esc</kbd> untuk keluar dari mode ukur.</li>
          </ul>
        ) : (
          <ol className="py-1.5">
            {ruas.map((r) => {
              const f = formatJarak(r.meter);
              return (
                <li key={r.ke} className="flex items-center gap-2.5 px-3.5 py-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-50 text-[11px] font-bold text-rose-600 tabular-nums">
                    {r.ke}
                  </span>
                  <span className="min-w-0 flex-1 font-mono-custom">
                    <span className="block text-[12.5px] font-semibold text-slate-800">{f.utama}</span>
                    <span className="block text-[11px] text-slate-500">{f.kedua}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] leading-snug text-slate-500">
                    azimut
                    <br />
                    <span className="font-mono-custom text-slate-700">{r.arah.toFixed(1)}°</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </PanelAlat>
    </>
  );
};

export default AlatUkur;
