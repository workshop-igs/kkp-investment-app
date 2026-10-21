import { useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import { AlertTriangle, Crosshair, Keyboard, MapPin } from 'lucide-react';
import { keDMS, keDesimal, uraiKoordinat } from '../../utils/koordinat';
import PanelAlat from './PanelAlat';

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
    <PanelAlat
      ikon={Keyboard}
      warnaIkon="bg-kkp-900"
      judul="Input koordinat"
      keterangan="Desimal atau derajat-menit-detik, LU/LS dan BT/BB"
      kepala={(
        <form id="form-koordinat" onSubmit={kirim} className="space-y-1.5">
          <input
            type="text"
            autoFocus
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="Lintang, bujur"
            aria-label="Koordinat lintang dan bujur"
            className="w-full text-[13px] font-mono-custom bg-slate-100 border border-transparent rounded-lg px-3 py-2
                       text-slate-800 placeholder:text-slate-400 placeholder:font-sans transition-colors
                       focus:bg-white focus:border-kkp-700 focus:outline-none focus:ring-2 focus:ring-kkp-700/15"
          />
          <button
            type="button"
            onClick={pakaiTengahPeta}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-kkp-700 hover:text-kkp-900"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Pakai titik tengah peta
          </button>
        </form>
      )}
      kaki={(
        <div className="p-3 border-t border-slate-100 shrink-0">
          <button
            type="submit"
            form="form-koordinat"
            disabled={!sah}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold
                       bg-kkp-700 text-white hover:bg-kkp-800 transition-colors
                       disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <MapPin className="w-4 h-4" />
            Menuju lokasi
          </button>
        </div>
      )}
    >
      <div className="p-3.5 space-y-3">
        {hasil?.galat && (
          <p className="text-[12px] text-rose-600 flex items-start gap-1.5 leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{hasil.galat}</span>
          </p>
        )}

        {sah ? (
          <div className="rounded-xl bg-kkp-900 px-3.5 py-3 text-white">
            <p className="text-[11px] text-white/60">Terbaca sebagai</p>
            <dl className="mt-1.5 space-y-1 font-mono-custom text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-sans text-[11.5px] text-white/60">Lintang</dt>
                <dd>{keDMS(hasil.lat, 'lat')}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-sans text-[11.5px] text-white/60">Bujur</dt>
                <dd>{keDMS(hasil.lng, 'lng')}</dd>
              </div>
            </dl>
            <p className="mt-2 border-t border-white/10 pt-2 font-mono-custom text-[11.5px] text-kkp-toska">
              {keDesimal(hasil.lat)}, {keDesimal(hasil.lng)}
            </p>
          </div>
        ) : (
          !hasil?.galat && (
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Tempel atau ketik koordinat, lalu periksa hasil bacaannya di sini sebelum menuju lokasi.
            </p>
          )
        )}

        {sah && !hasil.diIndonesia && (
          <p className="text-[12px] text-amber-700 flex items-start gap-1.5 leading-snug">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Titik ini di luar wilayah Indonesia. Periksa arah LU/LS dan BT/BB.</span>
          </p>
        )}

        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-kkp-900">Contoh format yang diterima</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTOH.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTeks(c)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-left font-mono-custom text-[11px]
                           text-slate-600 hover:border-kkp-700 hover:text-kkp-800 transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </PanelAlat>
  );
};

export default PanelKoordinat;
