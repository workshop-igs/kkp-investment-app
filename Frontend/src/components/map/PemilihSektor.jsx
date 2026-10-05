import { ChevronDown } from 'lucide-react';
import { SECTORS } from '../../utils/konstanta';

const OPSI_SEKTOR = SECTORS.map((s) => [s.id, s.label]);

const PemilihSektor = ({ nilai, onPilih, label = 'Skor dihitung untuk sektor', opsi = OPSI_SEKTOR, semua }) => (
  <div className="px-4 pb-2.5 -mt-1">
    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
      {label}
    </label>
    <div className="relative">
      <select
        value={nilai || (semua ? '' : opsi[0][0])}
        onChange={(e) => onPilih(e.target.value)}
        className="w-full appearance-none text-[12px] leading-tight bg-white border border-slate-200 rounded-md
                   pl-2.5 pr-7 py-1.5 text-slate-700 cursor-pointer
                   hover:border-kkp-200 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
      >
        {semua && <option value="">{semua}</option>}
        {opsi.map(([kode, teks]) => (
          <option key={kode} value={kode}>
            {teks}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  </div>
);

export default PemilihSektor;
