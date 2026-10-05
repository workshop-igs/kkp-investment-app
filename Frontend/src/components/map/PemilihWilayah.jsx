import { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../../api/klien';

const simpanan = new Map();

const ambilWilayah = (urlWilayah, params, kunci) => {
  if (simpanan.has(kunci)) return simpanan.get(kunci);
  const janji = api
    .get(urlWilayah, { params })
    .then(({ data }) => data?.wilayah || [])
    .catch((galat) => {
      simpanan.delete(kunci);
      throw galat;
    });
  simpanan.set(kunci, janji);
  return janji;
};

const PemilihWilayah = ({ urlWilayah, params, nilai, onPilih }) => {
  const [wilayah, setWilayah] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const kunciParams = JSON.stringify(params || {});

  useEffect(() => {
    let batal = false;
    setMemuat(true);
    ambilWilayah(urlWilayah, params, `${urlWilayah}|${kunciParams}`)
      .then((daftar) => {
        if (!batal) setWilayah(daftar);
      })
      .catch(() => {
        if (!batal) setWilayah([]);
      })
      .finally(() => {
        if (!batal) setMemuat(false);
      });
    return () => {
      batal = true;
    };
  }, [urlWilayah, kunciParams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (memuat) {
    return (
      <p className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Memuat daftar wilayah…
      </p>
    );
  }

  if (!wilayah || wilayah.length === 0) return null;

  const total = wilayah.reduce((n, w) => n + (w.jumlah || 0), 0);

  return (
    <div className="px-4 pb-2.5 -mt-1">
      <div className="relative">
        <select
          value={nilai || ''}
          onChange={(e) => onPilih(e.target.value || null)}
          className="w-full appearance-none text-[12px] leading-tight bg-white border border-slate-200 rounded-md
                     pl-2.5 pr-7 py-1.5 text-slate-700 cursor-pointer
                     hover:border-kkp-200 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
        >
          <option value="">Seluruh Indonesia ({total.toLocaleString('id-ID')})</option>
          {wilayah.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nama} ({w.jumlah.toLocaleString('id-ID')})
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {!nilai && (
        <p className="mt-1 text-[10px] text-slate-400 leading-snug">
          Tampilan se-Indonesia hanya memuat sebagian; pilih wilayah untuk melihatnya utuh.
        </p>
      )}
    </div>
  );
};

export default PemilihWilayah;
