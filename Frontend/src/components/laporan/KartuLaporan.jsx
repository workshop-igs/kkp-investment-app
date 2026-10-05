import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { KETERANGAN_SKOR_BAGIAN } from '../../utils/normalisasiAnalisis';
import { barisTitikSudut, keDesimal, keDMS } from '../../utils/koordinat';

const KartuLaporan = ({ judul, pengantar, catatan, keterangan, children }) => {
  const [bukaKeterangan, setBukaKeterangan] = useState(false);

  return (
    <div className="bg-white border border-slate-200 border-t-[1.6px] border-t-kkp-700 rounded-sm mb-4 break-inside-avoid">
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-3">
        <h3 className="text-[16px] font-bold text-slate-900 leading-snug">{judul}</h3>
        {keterangan && (
          <button
            onClick={() => setBukaKeterangan((v) => !v)}
            title="Keterangan dan sumber data"
            className={`p-1 rounded shrink-0 transition-colors ${
              bukaKeterangan ? 'text-kkp-700 bg-kkp-100' : 'text-slate-300 hover:text-kkp-700'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>
        )}
      </div>

      {bukaKeterangan && keterangan && (
        <p className="mx-4 mb-3 p-2.5 bg-kkp-100 border border-kkp-200 rounded text-[12px] text-slate-600 leading-relaxed">
          {keterangan}
        </p>
      )}

      {pengantar && (
        <p className="px-4 pb-3 text-[13px] text-slate-500 leading-relaxed">{pengantar}</p>
      )}

      <div className="px-4 pb-3">{children}</div>

      {catatan && (
        <p className="px-4 py-2.5 border-t border-slate-100 text-[11.5px] text-slate-400 leading-relaxed">
          {catatan}
        </p>
      )}
    </div>
  );
};

export const AngkaBesar = ({ item }) => (
  <div
    className={`grid gap-2 py-2 ${
      item.length === 1 ? 'grid-cols-1' : 'grid-cols-2 min-[420px]:grid-cols-3'
    }`}
  >
    {item.map((a) => (
      <div key={a.satuan} className="text-center min-w-0">
        <div
          className="text-[20px] sm:text-[26px] leading-none font-bold text-kkp-700 font-mono-custom break-words"
          style={a.warna ? { color: a.warna } : undefined}
        >
          {a.nilai}
        </div>
        <div className="text-[11.5px] text-slate-400 mt-1 leading-tight break-words">{a.satuan}</div>
      </div>
    ))}
  </div>
);

export const Donat = ({ data, palet, catatan }) => {
  const total = data.reduce((n, d) => n + (Math.abs(d.nilai) || 0), 0);
  if (!total) return null;

  const R = 42;
  const KELILING = 2 * Math.PI * R;
  let jalan = 0;

  return (
    <div className="py-2">
      <svg viewBox="0 0 120 120" className="w-40 h-40 mx-auto -rotate-90">
        {data.map((d, i) => {
          const bagian = (Math.abs(d.nilai) || 0) / total;
          const panjang = bagian * KELILING;
          const el = (
            <circle
              key={d.label}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={palet[i % palet.length]}
              strokeWidth="17"
              strokeDasharray={`${panjang} ${KELILING - panjang}`}
              strokeDashoffset={-jalan}
            />
          );
          jalan += panjang;
          return el;
        })}
      </svg>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-start gap-1.5 text-[11.5px] text-slate-600">
            <span
              className="w-2 h-2 rounded-full shrink-0 mt-1"
              style={{ backgroundColor: palet[i % palet.length] }}
            />
            <span className="leading-snug">
              {d.label} (
              {((Math.abs(d.nilai) / total) * 100).toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %)
            </span>
          </div>
        ))}
      </div>

      {catatan && (
        <p className="mt-2 text-[11px] text-slate-400 leading-snug">{catatan}</p>
      )}
    </div>
  );
};

export const TabelRingkas = ({ kolom, baris }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-slate-700 border-b border-slate-200">
          {kolom.map((k, i) => (
            <th
              key={k}
              className={`py-1.5 font-semibold ${i > 0 ? 'text-right pl-2' : 'pr-2'}`}
            >
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baris.map((r, i) => (
          <tr key={i} className={i % 2 ? 'bg-slate-50/70' : ''}>
            {r.map((sel, j) => (
              <td
                key={j}
                className={`py-1.5 align-top ${
                  j > 0 ? 'text-right pl-2 font-mono-custom text-slate-600' : 'pr-2 text-slate-700'
                }`}
              >
                {sel}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const BarisLipat = ({ judul, children }) => {
  const [buka, setBuka] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setBuka((v) => !v)}
        className="w-full flex items-center justify-between gap-2 py-2.5 text-left"
      >
        <span className="text-[13.5px] font-semibold text-slate-700">{judul}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${buka ? 'rotate-180' : ''}`}
        />
      </button>
      {buka && <div className="pb-3">{children}</div>}
    </div>
  );
};

export const KartuSkorBagian = ({ baris }) =>
  baris.length > 0 && (
    <KartuLaporan judul="Skor untuk Penilaian AHP" pengantar={KETERANGAN_SKOR_BAGIAN}>
      <TabelRingkas kolom={['Kriteria', 'Skor', 'Aspek AHP']} baris={baris} />
    </KartuLaporan>
  );

export default KartuLaporan;



export const TabelTitikSudut = ({ titikSudut }) => {
  const baris = barisTitikSudut(titikSudut);
  if (!baris.length) return null;
  return (
    <div className="pt-2 border-t border-slate-100">
      <div className="text-[11px] text-slate-400 mb-1.5">
        Koordinat {baris.length} titik sudut poligon (WGS84)
      </div>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="text-slate-400 text-left sticky top-0 bg-white">
            <tr>
              <th className="py-1 pr-2 font-semibold">Titik</th>
              <th className="py-1 pr-2 font-semibold">Lintang</th>
              <th className="py-1 font-semibold">Bujur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono-custom text-slate-700">
            {baris.map((t) => (
              <tr key={t.no}>
                <td className="py-1 pr-2 text-slate-500">{t.no}</td>
                <td className="py-1 pr-2">
                  {keDMS(t.y, 'lat')} <span className="text-slate-400">({keDesimal(t.y)})</span>
                </td>
                <td className="py-1">
                  {keDMS(t.x, 'lng')} <span className="text-slate-400">({keDesimal(t.x)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const KotakBatimetri = ({ data }) => {
  if (!data) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-slate-700">Kedalaman laut (batimetri)</span>
        <span className="text-[13px] font-bold tabular-nums text-slate-800">rata-rata {data.rata2}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Rentang di dalam area {data.rentang} (terdangkal - terdalam).</p>
      {data.catatan && <p className="mt-1 text-[11px] text-slate-500 leading-snug">{data.catatan}</p>}
    </div>
  );
};

export const KartuTabelSpasial = ({ bagian: b }) => {
  if (!b) return null;
  if (b.kosong) {
    return (
      <KartuLaporan judul={b.judul} catatan={`Sumber: ${b.sumber}`}>
        <p className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[13px] text-amber-800 leading-relaxed">
          {b.catatan_kosong}
        </p>
      </KartuLaporan>
    );
  }
  return (
    <KartuLaporan judul={b.judul} pengantar={b.ringkas} catatan={`Sumber: ${b.sumber}`}>
      {b.sorotan && <AngkaBesar item={[{ nilai: b.sorotan.nilai, satuan: b.sorotan.label }]} />}
      <TabelRingkas kolom={b.kolom} baris={b.baris.map((r) => r.sel)} />
    </KartuLaporan>
  );
};
