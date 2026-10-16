import { AlertTriangle, Info } from 'lucide-react';
import { CATATAN_DASAR } from '../../utils/kelengkapanData';

// Ditampilkan di atas setiap laporan: label "indikatif" bila data kurang, dan catatan bahwa hasil
// hanyalah penyaringan awal (bukan pengganti Persetujuan KKPRL).
const BannerIndikatif = ({ status }) => (
  <div className="space-y-2">
    {status?.indikatif && (
      <div role="note" className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-[12.5px] leading-snug text-amber-900">
          <p>
            <span className="mr-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
              Indikatif
            </span>
            <b>Data lokasi belum lengkap</b>, jadi hasil ini hanya gambaran awal, bukan rekomendasi pasti.
          </p>
          <p className="mt-1 text-[11.5px] text-amber-800">Sebab: {status.alasan.join('; ')}.</p>
        </div>
      </div>
    )}
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-600">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      {CATATAN_DASAR}
    </div>
  </div>
);

export default BannerIndikatif;
