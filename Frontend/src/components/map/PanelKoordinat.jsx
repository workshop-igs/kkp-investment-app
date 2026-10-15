import { useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import { AlertTriangle, Crosshair, Keyboard, MapPin } from 'lucide-react';
import { keDMS, keDesimal, uraiKoordinat } from '../../utils/koordinat';

const CONTOH = [
  '-6.2088, 106.8456',
  '6°12\'31"S 106°50\'44"E',
  '6,2088 LS 106,8456 BT',
  '116° 3\' 25,888" BT, 8° 21\' 11,911" LS',
];

const PanelKoordinat = ({ onTuju }) => {
  const map = useMap();
  const [teks, setTeks] = useState('');

  const hasil = useMemo(() => (teks.trim() ? uraiKoordinat(teks) : null), [teks]);
  const sah = hasil && !hasil.galat;

  const kirim = (e) => {
    e.preventDefault();
    if (!sah) return;
    onTuju({
      lat: hasil.lat,
      lng: hasil.lng,
      label: 'Koordinat',
      keterangan: `${keDMS(hasil.lat, 'lat')} · ${keDMS(hasil.lng, 'lng')}`,
      zoom: 13,
    });
  };

  const pakaiTengahPeta = () => {
    const c = map.getCenter();
    setTeks(`${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`);
  };

  return (
    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 w-[19.5rem] max-w-[calc(100vw-6.5rem)]">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[calc(100vh-11rem)]">
        <div className="flex items-center gap-2 px-4 py-3 bg-kkp-800 text-white shrink-0">
          <Keyboard className="w-4 h-4 shrink-0" />
          <span className="text-[13px] font-bold tracking-wide uppercase">Input Koordinat</span>
        </div>

        <form onSubmit={kirim} className="p-3 flex flex-col gap-2.5 overflow-y-auto custom-scrollbar">
          <div>
            <input
              type="text"
              autoFocus
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="Lintang, Bujur"
              className="w-full text-[13px] font-mono-custom bg-white border border-kkp-200 rounded-lg px-3 py-2.5
                         text-slate-700 placeholder:text-slate-400 placeholder:font-sans
                         focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
            />
            <button
              type="button"
              onClick={pakaiTengahPeta}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-kkp-700 hover:underline font-semibold"
            >
              <Crosshair className="w-3 h-3" />
              Isi dengan titik tengah peta
            </button>
          </div>

          {hasil?.galat && (
            <p className="text-[11px] text-rose-600 flex items-start gap-1.5 leading-snug">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{hasil.galat}</span>
            </p>
          )}

          {sah && (
            <div className="rounded-lg bg-kkp-100 border border-kkp-200 px-3 py-2.5 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-kkp-700 font-bold">Terbaca sebagai</div>
              <div className="text-[12px] text-slate-700 font-mono-custom">
                {keDesimal(hasil.lat)} , {keDesimal(hasil.lng)}
              </div>
              <div className="text-[12px] text-slate-600">
                {keDMS(hasil.lat, 'lat')} · {keDMS(hasil.lng, 'lng')}
              </div>
              {!hasil.diIndonesia && (
                <p className="text-[11px] text-amber-600 flex items-start gap-1.5 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>Titik ini di luar wilayah Indonesia. Periksa arah LU/LS dan BT/BB.</span>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={!sah}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold
                       bg-kkp-700 text-white hover:bg-kkp-800 transition-colors
                       disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <MapPin className="w-4 h-4" />
            Menuju Lokasi
          </button>

          <div className="pt-1 border-t border-slate-100">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
              Format yang diterima
            </div>
            <div className="flex flex-col gap-1">
              {CONTOH.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTeks(c)}
                  className="text-left text-[11px] font-mono-custom text-slate-500 hover:text-kkp-700 hover:bg-kkp-100
                             rounded px-1.5 py-1 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PanelKoordinat;
