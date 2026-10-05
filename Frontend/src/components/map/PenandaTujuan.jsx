import { useEffect, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { buatIkon } from './ikonPeta';
import { keDMS, keDesimal } from '../../utils/koordinat';

const PenandaTujuan = ({ tujuan, onTutup }) => {
  const refPenanda = useRef(null);

  useEffect(() => {
    if (!tujuan) return undefined;
    const t = setTimeout(() => refPenanda.current?.openPopup(), 0);
    return () => clearTimeout(t);
  }, [tujuan]);

  if (!tujuan) return null;

  return (
    <Marker
      ref={refPenanda}
      position={[tujuan.lat, tujuan.lng]}
      icon={buatIkon('bintang', '#dc2626', 1.05)}
      zIndexOffset={1000}
      riseOnHover
    >
      <Popup>
        <div className="font-sans">
          <h3 className="font-bold text-slate-800 text-[13px] mb-1 leading-snug">{tujuan.label}</h3>
          {tujuan.keterangan && (
            <p className="text-[11px] text-slate-500 mb-1.5 leading-snug">{tujuan.keterangan}</p>
          )}
          <p className="text-[11px] text-slate-600 font-mono-custom border-t border-slate-100 pt-1.5">
            {keDesimal(tujuan.lat)} , {keDesimal(tujuan.lng)}
            <br />
            {keDMS(tujuan.lat, 'lat')} · {keDMS(tujuan.lng, 'lng')}
          </p>
          <button
            onClick={onTutup}
            className="mt-1.5 text-[11px] font-semibold text-kkp-700 hover:underline"
          >
            Hapus penanda
          </button>
        </div>
      </Popup>
    </Marker>
  );
};

export default PenandaTujuan;
