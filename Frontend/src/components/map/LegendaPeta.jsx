import { useEffect, useState } from 'react';
import { List, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  KATEGORI_ZONA,
  KELAS_KELAYAKAN,
  KELAS_RISIKO,
  URUTAN_KATEGORI,
  URUTAN_KATEGORI_DARAT,
  URUTAN_KELAS_RISIKO,
} from '../../utils/simbologiPeta';
import { GARIS_KAWASAN, KATEGORI_RTRL, URUTAN_RTRL, WARNA_JENIS_INVESTASI, garisKelasKelayakan } from '../../utils/simbologiPeta';
import { SECTORS } from '../../utils/konstanta';
import { buatIkon } from './ikonPeta';
import { api } from '../../api/klien';

const ISTILAH = {
  KKPRL_AR: 'Kesesuaian Ruang Laut — Wilayah',
  KKPRL_LN: 'Kesesuaian Ruang Laut — Garis',
  KKPRL_PT: 'Kesesuaian Ruang Laut — Titik',
  PKKPRL_AR: 'Persetujuan Ruang Laut — Wilayah',
  PKKPRL_LN: 'Persetujuan Ruang Laut — Garis',
  PKKPRL_PT: 'Persetujuan Ruang Laut — Titik',
  POLA_AR: 'Pola Ruang — Wilayah',
  POLA_LN: 'Pola Ruang — Garis',
  POLA_PT: 'Pola Ruang — Titik',
  STRUKTUR_AR: 'Struktur Ruang — Wilayah',
  STRUKTUR_LN: 'Struktur Ruang — Garis',
  STRUKTUR_PT: 'Struktur Ruang — Titik',
  KSNT_LH_AR: 'Kawasan Strategis Nasional Tertentu (Lingkungan Hidup)',
  KSN_AR: 'Kawasan Strategis Nasional',
  ALKI_LN: 'Alur Laut Kepulauan Indonesia',

  'Opaque Raster': 'Area terpetakan',
  'Grey Polygon': 'Wilayah pemanfaatan ruang laut',
  'Blue Line': 'Batas / alur pemanfaatan',
  'Red Square Point': 'Titik lokasi kegiatan',
  'Transparent Polygon': 'Wilayah (tanpa isian)',
  KONFIRMASI: 'Konfirmasi Kesesuaian Ruang Laut',
  PERSETUJUAN: 'Persetujuan Kesesuaian Ruang Laut',
};

const rapikan = (teks) => {
  if (!teks) return '';
  if (ISTILAH[teks]) return ISTILAH[teks];
  const bersih = teks.replace(/_/g, ' ').trim();
  if (bersih === bersih.toUpperCase() && bersih.length > 3) {
    return bersih
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\b(Dan|Atau|Di|Ke|Yang|Untuk)\b/g, (m) => m.toLowerCase());
  }
  return bersih;
};

const Simbol = ({ symbolizer }) => {
  const jenis = Object.keys(symbolizer || {})[0];
  const s = symbolizer?.[jenis] || {};

  if (jenis === 'Polygon') {
    return (
      <span
        className="inline-block w-5 h-4 rounded-sm shrink-0 border"
        style={{
          backgroundColor: s.fill || '#cbd5e1',
          opacity: s['fill-opacity'] ?? 1,
          borderColor: s.stroke || '#64748b',
        }}
      />
    );
  }
  if (jenis === 'Line') {
    return (
      <span className="inline-flex w-5 h-4 items-center shrink-0">
        <span
          className="w-full rounded-full"
          style={{ height: Math.max(2, Number(s['stroke-width']) || 2), backgroundColor: s.stroke || '#64748b' }}
        />
      </span>
    );
  }
  if (jenis === 'Point') {
    const g = s.graphics?.[0] || {};
    const bulat = (g.mark || '').includes('circle');
    return (
      <span className="inline-flex w-5 h-4 items-center justify-center shrink-0">
        <span
          className={`w-3 h-3 ${bulat ? 'rounded-full' : 'rounded-[2px]'}`}
          style={{ backgroundColor: g.fill || '#ef4444', border: `1px solid ${g.stroke || '#7f1d1d'}` }}
        />
      </span>
    );
  }
  return (
    <span
      className="inline-block w-5 h-4 rounded-sm shrink-0 border border-slate-300"
      style={{ background: 'linear-gradient(135deg,#e2e8f0 25%,#cbd5e1 25%,#cbd5e1 50%,#e2e8f0 50%,#e2e8f0 75%,#cbd5e1 75%)', backgroundSize: '6px 6px' }}
    />
  );
};

const LegendaJSON = ({ data }) => (
  <div className="space-y-3">
    {data.map((grup, i) => (
      <div key={i}>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 leading-tight">
          {rapikan(grup.layerName)}
        </p>
        <ul className="space-y-1.5">
          {(grup.rules || []).map((r, j) => (
            <li key={j} className="flex items-start gap-2.5">
              <span className="mt-0.5">
                <Simbol symbolizer={(r.symbolizers || [])[0]} />
              </span>
              <span className="text-[13px] text-slate-700 leading-snug">{rapikan(r.title || r.name)}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

let janjiOseanografi = null;
export const ambilOseanografi = () => {
  janjiOseanografi ||= api.get('/analitik/oseanografi/').then(({ data }) => data).catch((e) => {
    janjiOseanografi = null;
    throw e;
  });
  return janjiOseanografi;
};

const angkaLegenda = (v) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const LegendaGradasi = ({ kode, keterangan }) => {
  const [info, setInfo] = useState(undefined);
  useEffect(() => {
    let batal = false;
    ambilOseanografi()
      .then((d) => { if (!batal) setInfo(d.parameter[kode] || null); })
      .catch(() => { if (!batal) setInfo(null); });
    return () => { batal = true; };
  }, [kode]);

  if (info === undefined) {
    return (
      <p className="flex items-center gap-2 text-[12px] text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat legenda…
      </p>
    );
  }
  if (info === null) return <p className="text-[12px] text-slate-500">Data lapisan ini belum tersedia di server.</p>;

  const posisi = info.skala.map(([v]) => (info.log ? Math.log10(v) : v));
  const awal = posisi[0];
  const rentang = posisi[posisi.length - 1] - awal;
  const gradien = info.skala.map(([, w], i) => `${w} ${(((posisi[i] - awal) / rentang) * 100).toFixed(1)}%`).join(', ');
  const tengah = info.log ? 10 ** (awal + rentang / 2) : info.skala[0][0] + rentang / 2;
  return (
    <div className="space-y-2">
      <div className="h-2.5 rounded-sm border border-black/10" style={{ background: `linear-gradient(to right, ${gradien})` }} />
      <div className="flex justify-between text-[11px] text-slate-600 tabular-nums">
        <span>{angkaLegenda(info.skala[0][0])}</span>
        <span>{angkaLegenda(tengah)}</span>
        <span>{angkaLegenda(info.skala[info.skala.length - 1][0])} {info.satuan}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug pt-2 border-t border-slate-100">
        {keterangan}
        {info.periode && ` Periode data: ${info.periode}.`}
      </p>
    </div>
  );
};

const LegendaJenis = ({ keterangan }) => (
  <div className="space-y-2">
    <ul className="grid grid-cols-1 gap-y-1">
      {[...SECTORS.map((s) => [s.id, s.label]), ['LAINNYA', 'Kegiatan lain']].map(([kode, label]) => (
        <li key={kode} className="flex items-start gap-2">
          <span
            className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border border-black/10 shrink-0"
            style={{ backgroundColor: WARNA_JENIS_INVESTASI[kode], opacity: 0.85 }}
          />
          <span className="text-[12px] text-slate-700 leading-snug">{label}</span>
        </li>
      ))}
    </ul>
    <p className="text-[11px] text-slate-500 leading-snug pt-2 border-t border-slate-100">{keterangan}</p>
  </div>
);

const LegendaLokal = ({ urutan = URUTAN_KATEGORI, garis = true }) => (
  <div className="space-y-3">
    <div>
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Warna = peruntukan zona</p>
      <ul className="grid grid-cols-1 gap-y-1">
        {urutan.map((kode) => {
          const k = KATEGORI_ZONA[kode];
          return (
            <li key={kode} className="flex items-start gap-2">
              <span
                className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border border-black/10 shrink-0"
                style={{ backgroundColor: k.warna, opacity: 0.85 }}
              />
              <span className="text-[12px] text-slate-700 leading-snug">{k.label}</span>
            </li>
          );
        })}
      </ul>
    </div>

    {garis && <div className="pt-2 border-t border-slate-100">
      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Garis tepi = jenis kawasan</p>
      <ul className="space-y-1">
        {GARIS_KAWASAN.map(({ label, tebal, pola, warna }) => (
          <li key={label} className="flex items-center gap-2">
            <span className="w-8 shrink-0" style={{ borderTop: `${tebal}px ${pola} ${warna}` }} />
            <span className="text-[12px] text-slate-700 leading-snug">{label}</span>
          </li>
        ))}
      </ul>
    </div>}
  </div>
);

const LegendaUnsurRtrl = () => (
  <div>
    <p className="text-[11px] font-semibold text-slate-500 mb-2">
      Warna &amp; pola garis = jenis unsur
    </p>
    <ul className="space-y-2">
      {URUTAN_RTRL.map((kode) => {
        const k = KATEGORI_RTRL[kode];
        return (
          <li key={kode} className="flex items-start gap-2">
            <svg width="22" height="14" className="mt-[2px] shrink-0" aria-hidden="true">
              <line
                x1="1"
                y1="7"
                x2="21"
                y2="7"
                stroke={k.warna}
                strokeWidth={Math.max(2, k.tebal)}
                strokeDasharray={k.garis || undefined}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[12px] text-slate-700 leading-snug">
              <span className="font-semibold">{k.label}</span>
              <span className="block text-[11px] text-slate-500">{k.catatan}</span>
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);


const AMBANG_KELAS = { TINGGI: '≥75% dari ≥5 parameter terukur' };

const LegendaDisarankan = ({ def }) => (
  <ul className="space-y-1.5">
    {def.params.kelas.split(',').map((kode) => (
      <li key={kode} className="flex items-center gap-2">
        <span
          className="w-3.5 shrink-0 flex justify-center"
          dangerouslySetInnerHTML={{ __html: buatIkon(def.ikon, KELAS_KELAYAKAN[kode].warna, 0.55).options.html }}
        />
        <span className="text-[12px] text-slate-700 leading-snug">
          {KELAS_KELAYAKAN[kode].label} <span className="text-slate-400">({AMBANG_KELAS[kode]})</span>
        </span>
      </li>
    ))}
    <li className="flex items-start gap-2">
      <span
        className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border shrink-0"
        style={{ backgroundColor: KELAS_KELAYAKAN.TINGGI.warna, borderColor: garisKelasKelayakan('TINGGI'), opacity: 0.85 }}
      />
      <span className="text-[12px] text-slate-700 leading-snug">Batas lokasi, tampak setelah peta diperbesar</span>
    </li>
  </ul>
);

const LegendaRisiko = () => (
  <div>
    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
      Warna = kelas risiko
    </p>
    <ul className="space-y-1">
      {URUTAN_KELAS_RISIKO.map((kode) => {
        const k = KELAS_RISIKO[kode];
        return (
          <li key={kode} className="flex items-start gap-2">
            <span
              className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border border-black/10 shrink-0"
              style={{ backgroundColor: k.warna, opacity: 0.85 }}
            />
            <span className="text-[12px] text-slate-700 leading-snug">{k.label}</span>
          </li>
        );
      })}
    </ul>
    <p className="mt-2 text-[11px] text-slate-500 leading-snug">
      Ambang mengikuti InaRISK: di bawah 0,33 rendah, di bawah 0,67 sedang,
      selebihnya tinggi. Angka menerusnya ada di kartu laporan.
    </p>
  </div>
);

const LegendaPeta = ({ wmsUrl, daftarLayer, layerAktif, daftarLokal = {}, sektorLapisan = {} }) => {
  const [terbuka, setTerbuka] = useState(() => window.innerWidth >= 1024);
  const [dataJson, setDataJson] = useState({});
  const [memuat, setMemuat] = useState({});

  const aktif = layerAktif.filter((id) => daftarLayer[id]);
  const aktifLokal = layerAktif.filter((id) => daftarLokal[id]);
  const namaSektor = (kode) => (kode === 'SEMUA' ? 'Semua jenis investasi' : SECTORS.find((s) => s.id === kode)?.label || kode);

  const urlLegenda = (id, format) => {
    const l = daftarLayer[id];
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      VERSION: '1.3.0',
      REQUEST: 'GetLegendGraphic',
      FORMAT: format,
      LAYER: l.layers,
    });
    if (format === 'image/png') {
      params.set('LEGEND_OPTIONS', 'forceLabels:on;fontName:Arial;fontSize:12;fontAntiAliasing:true');
      if (l.style) params.set('STYLE', l.style);
    }
    return `${wmsUrl}?${params.toString()}`;
  };

  useEffect(() => {
    if (!terbuka) return;
    aktif.forEach((id) => {
      if (dataJson[id] !== undefined || memuat[id]) return;
      setMemuat((m) => ({ ...m, [id]: true }));

      const pembatal = new AbortController();
      const waktuHabis = setTimeout(() => pembatal.abort(), 8000);

      fetch(urlLegenda(id, 'application/json'), { signal: pembatal.signal })
        .then((r) => r.text())
        .then((t) => {
          const hasil = t.trim().startsWith('<') ? null : JSON.parse(t).Legend || null;
          setDataJson((d) => ({ ...d, [id]: hasil }));
        })
        .catch(() => setDataJson((d) => ({ ...d, [id]: null })))
        .finally(() => {
          clearTimeout(waktuHabis);
          setMemuat((m) => ({ ...m, [id]: false }));
        });
    });
  }, [terbuka, aktif.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (aktif.length === 0 && aktifLokal.length === 0) return null;

  return (
    <div data-tur="legenda" className="absolute left-4 top-24 z-[1100] w-[min(20rem,calc(100vw-2rem))] max-w-full">
      <button
        onClick={() => setTerbuka((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg text-sm font-semibold text-slate-700 hover:text-kkp-700 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <List className="w-4 h-4 shrink-0" />
          <span className="truncate">Legenda Peta</span>
          <span className="text-[11px] font-normal text-slate-400 shrink-0">
            ({aktif.length + aktifLokal.length})
          </span>
        </span>
        {terbuka ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>

      {terbuka && (
        <div
          className="mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-y-auto custom-scrollbar
                     max-h-[calc(100vh-22rem)] min-h-[8rem]"
        >
          {aktifLokal.map((id) => (
            <div key={`lokal-${id}`} className="p-4 border-b border-slate-100 last:border-0">
              <h4 className="text-xs font-bold text-kkp-800 uppercase tracking-wider mb-2.5 leading-tight">
                {daftarLokal[id].label}
              </h4>
              {'sektor' in (daftarLokal[id].params || {}) && (
                <p className="-mt-1 mb-2.5 text-[12px] text-slate-600">
                  Jenis investasi:{' '}
                  <b className="text-kkp-900">{namaSektor(sektorLapisan[id] || daftarLokal[id].params.sektor)}</b>
                </p>
              )}
              {daftarLokal[id].legenda === 'disarankan' ? (
                <LegendaDisarankan def={daftarLokal[id]} />
              ) : daftarLokal[id].legenda === 'jenis' ? (
                <LegendaJenis keterangan={daftarLokal[id].keteranganLegenda} />
              ) : daftarLokal[id].legenda === 'zona' ? (
                <LegendaLokal />
              ) : daftarLokal[id].legenda === 'zona_darat' ? (
                <LegendaLokal urutan={URUTAN_KATEGORI_DARAT} garis={false} />
              ) : daftarLokal[id].legenda === 'risiko' ? (
                <LegendaRisiko />
              ) : daftarLokal[id].legenda === 'rtrl' ? (
                <LegendaUnsurRtrl />
              ) : daftarLokal[id].legenda === 'gradasi' ? (
                <LegendaGradasi kode={daftarLokal[id].citra} keterangan={daftarLokal[id].keteranganLegenda} />
              ) : (
                <div className="flex items-start gap-2">
                  <span
                    className="mt-[3px] w-3.5 h-3.5 rounded-[3px] border border-black/10 shrink-0"
                    style={{ backgroundColor: daftarLokal[id].warnaContoh, opacity: 0.85 }}
                  />
                  <span className="text-[12px] text-slate-700 leading-snug">
                    {daftarLokal[id].keteranganLegenda}
                  </span>
                </div>
              )}
            </div>
          ))}

          {aktif.map((id) => (
            <div key={id} className="p-4 border-b border-slate-100 last:border-0">
              <h4 className="text-xs font-bold text-kkp-800 uppercase tracking-wider mb-2.5 leading-tight">
                {daftarLayer[id].label}
              </h4>

              {memuat[id] && (
                <p className="flex items-center gap-2 text-[12px] text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat legenda…
                </p>
              )}

              {!memuat[id] && dataJson[id] && <LegendaJSON data={dataJson[id]} />}

              {!memuat[id] && dataJson[id] === null && (
                <div className="overflow-x-auto custom-scrollbar">
                  <img
                    src={urlLegenda(id, 'image/png')}
                    alt={`Legenda ${daftarLayer[id].label}`}
                    className="h-auto max-w-none"
                  />
                </div>
              )}
            </div>
          ))}
          <p className="px-4 py-2.5 text-[10px] text-slate-400 bg-slate-50 sticky bottom-0">
            {aktifLokal.length > 0 && aktif.length > 0
              ? 'Simbol lapisan lokal disusun sendiri; sisanya dari GeoServer Portal Satu Data KKP.'
              : aktifLokal.length > 0
                ? `Data ${
                  aktifLokal.every((id) => daftarLokal[id].citra)
                    ? 'NOAA (lewat ERDDAP)'
                    : aktifLokal.some((id) => daftarLokal[id].citra) ? 'Portal Satu Data KKP dan NOAA' : 'Portal Satu Data KKP'
                }, disimpan dan disimbolkan di server sendiri.`
                : 'Simbol bersumber dari GeoServer Portal Satu Data KKP.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LegendaPeta;
