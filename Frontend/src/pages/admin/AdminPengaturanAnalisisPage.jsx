import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, Loader2, Plus, RefreshCw, RotateCcw, Save, Search,
  SlidersHorizontal, Trash2,
} from 'lucide-react';
import { api } from '../../api/klien';

const URL = '/inti/admin/pengaturan-analisis/';

const waktu = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');

const TAHAP_HITUNG = [
  { kunci: 'Menyiapkan', label: 'Menyiapkan' },
  { kunci: 'Lokasi potensial', label: 'Peta Sebaran Wilayah Potensial Investasi' },
  { kunci: 'Skor kelayakan zona', label: 'Skor kelayakan zona' },
];

const durasi = (detik) => {
  const d = Math.max(0, Math.round(detik));
  if (d < 60) return `${d} dtk`;
  const m = Math.floor(d / 60);
  if (m < 60) return `${m} mnt ${d % 60} dtk`;
  return `${Math.floor(m / 60)} jam ${m % 60} mnt`;
};

const useDetik = (aktif) => {
  const [sekarang, setSekarang] = useState(Date.now());
  useEffect(() => {
    if (!aktif) return undefined;
    const t = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aktif]);
  return sekarang;
};

const Putar = () => (
  <span className="relative grid h-11 w-11 shrink-0 place-items-center">
    <span className="absolute inset-0 rounded-full border-4 border-sky-100" />
    <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-sky-600 border-r-sky-600" />
    <RefreshCw className="h-4 w-4 text-sky-700" />
  </span>
);

export const StatusHitungUlang = ({ status, onMulai }) => {
  const berjalan = !!status?.berjalan;
  const menunggu = !!status?.menunggu && !berjalan;
  const sekarang = useDetik(berjalan || menunggu);
  const [baruSelesai, setBaruSelesai] = useState(false);
  const [memulai, setMemulai] = useState(false);
  const tadiBerjalan = useRef(false);

  useEffect(() => {
    if (tadiBerjalan.current && !berjalan && !menunggu) {
      setBaruSelesai(true);
      const t = setTimeout(() => setBaruSelesai(false), 10000);
      tadiBerjalan.current = false;
      return () => clearTimeout(t);
    }
    if (berjalan || menunggu) tadiBerjalan.current = true;
    return undefined;
  }, [berjalan, menunggu]);

  if (!status) return null;
  const { tahap = '', ke = 0, dari = 0, mulai, selesai, galat } = status;

  const mulaiKlik = async () => {
    setMemulai(true);
    try {
      await onMulai();
    } finally {
      setMemulai(false);
    }
  };

  if (berjalan || menunggu) {
    const [namaTahap, wilayah] = tahap.includes(': ') ? tahap.split(': ') : [tahap || 'Menyiapkan', ''];
    const indeks = Math.max(0, TAHAP_HITUNG.findIndex((t) => t.kunci === namaTahap));
    const rampung = Math.max(0, ke - 1);
    const persen = dari ? Math.min(100, Math.round((rampung / dari) * 100)) : null;
    const lewat = mulai ? (sekarang - new Date(mulai).getTime()) / 1000 : 0;
    const sisa = dari && rampung >= 2 ? (lewat / rampung) * (dari - rampung) : null;
    return (
      <div role="status" aria-live="polite" className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white px-4 py-4 text-sm shadow-sm">
        <div className="flex items-start gap-3">
          <Putar />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">
              {menunggu ? 'Hitung ulang menunggu antrean' : 'Menghitung ulang Peta Sebaran dan skor zona'}
              <span className="ml-1 inline-flex gap-0.5 align-middle" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-kkp-800" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-600">
              {menunggu
                ? 'Proses akan mulai begitu pekerja latar siap.'
                : (
                  <>
                    {TAHAP_HITUNG[indeks]?.label || namaTahap}
                    {wilayah && <> · sedang memproses <b className="text-slate-800">{wilayah}</b></>}
                  </>
                )}
            </div>

            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-sky-100" role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={persen ?? undefined}>
              {persen === null ? (
                <div className="hitung-tak-tentu h-full w-2/5 rounded-full bg-sky-500" />
              ) : (
                <div className="hitung-garis h-full rounded-full bg-kkp-800 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(persen, 3)}%` }} />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                {persen === null ? 'Menyiapkan data…' : (
                  <><b className="text-slate-700">{persen}%</b> · {rampung} dari {dari} provinsi selesai, provinsi ke-{ke} sedang diproses</>
                )}
              </span>
              <span>
                {mulai && <>Berjalan {durasi(lewat)}</>}
                {sisa !== null
                  ? <> · perkiraan sisa ±{durasi(sisa)}</>
                  : persen !== null && <> · perkiraan sisa muncul setelah 2 provinsi selesai</>}
              </span>
            </div>

            <ol className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              {TAHAP_HITUNG.map((t, i) => {
                const lalu = i < indeks;
                const kini = i === indeks && !menunggu;
                return (
                  <li key={t.kunci} className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                      lalu ? 'bg-emerald-100 text-emerald-800' : kini ? 'bg-kkp-800 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {lalu ? <Check className="h-3 w-3" /> : kini ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      {t.label}
                    </span>
                    {i < TAHAP_HITUNG.length - 1 && <span className="h-px w-4 bg-slate-300" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-[11px] text-slate-400">
              Proses berjalan di server; halaman ini boleh ditinggalkan dan progres diperbarui otomatis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const gagal = !!galat;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3 ${
      gagal ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    } ${baruSelesai ? 'animate-fade-in ring-2 ring-emerald-300' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${gagal ? 'bg-rose-100' : 'bg-emerald-100'}`}>
          {gagal ? <AlertTriangle className="h-4 w-4" /> : (
            <span className="relative grid place-items-center">
              {baruSelesai && <span className="absolute h-7 w-7 animate-ping rounded-full bg-emerald-300 opacity-60" />}
              <CheckCircle2 className="relative h-5 w-5" />
            </span>
          )}
        </span>
        <div>
          <div className="font-semibold">
            {gagal ? 'Hitung ulang terakhir gagal'
              : baruSelesai ? 'Selesai! Peta Sebaran dan skor sudah diperbarui'
                : 'Peta Sebaran dan skor sudah memakai pengaturan terbaru'}
          </div>
          <div className="text-xs mt-0.5">
            {selesai ? `Terakhir selesai ${waktu(selesai)}` : ''}
            {gagal && ` · Galat: ${galat}`}
          </div>
        </div>
      </div>
      {onMulai && (
        <button type="button" onClick={mulaiKlik} disabled={memulai}
          className="px-3 py-1.5 rounded-lg bg-white border border-current/20 text-xs font-semibold hover:bg-white/70 flex items-center gap-1.5 disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${memulai ? 'animate-spin' : ''}`} /> {memulai ? 'Memulai…' : 'Hitung ulang sekarang'}
        </button>
      )}
    </div>
  );
};

export const useStatusHitungUlang = (awal) => {
  const [status, setStatus] = useState(awal);
  useEffect(() => setStatus(awal), [awal]);
  useEffect(() => {
    if (!status?.berjalan && !status?.menunggu) return undefined;
    const t = setInterval(() => {
      api.get(`${URL}hitung-ulang/`).then(({ data }) => setStatus(data)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [status?.berjalan, status?.menunggu]);
  const mulai = () => api.post(`${URL}hitung-ulang/`).then(({ data }) => setStatus(data));
  return [status, setStatus, mulai];
};

const kelasInput = 'w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none';

const angkaId = (v, persen) =>
  `${Number(persen ? v * 100 : v).toLocaleString('id-ID', { maximumFractionDigits: 4 })}${persen ? '%' : ''}`;

const Angka = ({ nilai, onUbah, kosong = false, readOnly = false, petunjuk, persen = false }) => (
  <input
    type="number"
    step="any"
    value={(persen && typeof nilai === 'number' ? Number((nilai * 100).toFixed(6)) : nilai) ?? ''}
    readOnly={readOnly}
    placeholder={petunjuk ?? (kosong ? 'tanpa batas' : '')}
    onChange={(e) => {
      const v = e.target.value;
      if (v === '') onUbah(kosong ? null : '');
      else onUbah(persen ? Number((Number(v) / 100).toFixed(10)) : Number(v));
    }}
    className={`${kelasInput} tabular-nums ${readOnly ? 'bg-slate-50 text-slate-500' : ''}`}
  />
);

const Bawaan = ({ nilai, persen }) => (typeof nilai === 'number'
  ? <span className="whitespace-nowrap text-[11px] text-slate-400">bawaan {angkaId(nilai, persen)}</span>
  : null);

const Editor = ({ nilai, bawaan, onUbah, meta, label }) => {
  const sebut = (k) => label[k] || k.replace(/_/g, ' ');
  if (typeof nilai === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={nilai} onChange={(e) => onUbah(e.target.checked)} /> {nilai ? 'Ya' : 'Tidak'}
      </label>
    );
  }
  if (typeof nilai === 'number' || nilai === '') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-36"><Angka nilai={nilai} onUbah={onUbah} persen={meta.persen} /></div>
        {meta.satuan && <span className="text-sm text-slate-500">{meta.satuan}</span>}
        <Bawaan nilai={bawaan} persen={meta.persen} />
      </div>
    );
  }
  if (Array.isArray(nilai) && nilai.every((v) => !Array.isArray(v) && typeof v !== 'object')) {
    return (
      <div className="flex flex-wrap gap-3">
        {nilai.map((v, i) => (
          <label key={i} className="w-36 text-xs text-slate-500">
            {meta.kolom?.[i] || `Nilai ${i + 1}`}{meta.satuan ? ` (${meta.satuan})` : ''}
            <Angka nilai={v} persen={meta.persen} onUbah={(x) => onUbah(nilai.map((y, j) => (j === i ? x : y)))} />
            <Bawaan nilai={bawaan?.[i]} persen={meta.persen} />
          </label>
        ))}
      </div>
    );
  }
  if (Array.isArray(nilai)) {
    return (
      <div className="overflow-x-auto">
        <table className="text-sm">
          {meta.kolom && (
            <thead>
              <tr>
                {meta.baris && <th />}
                {meta.kolom.map((k) => <th key={k} className="px-2 pb-1 text-left text-xs font-semibold text-slate-500">{k}</th>)}
              </tr>
            </thead>
          )}
          <tbody>
            {nilai.map((baris, i) => (
              <tr key={i}>
                {meta.baris && <td className="pr-2 text-xs font-semibold text-slate-500">{meta.baris[i]}</td>}
                {baris.map((v, j) => (
                  <td key={j} className="px-1 py-0.5 min-w-[7rem]"
                    title={typeof bawaan?.[i]?.[j] === 'number' ? `bawaan ${angkaId(bawaan[i][j], meta.persen)}` : undefined}>
                    {typeof v === 'string' ? <span className="text-xs font-medium text-slate-700">{sebut(v)}</span> : (
                      <Angka nilai={v} persen={meta.persen} readOnly={Boolean(meta.baris) && i === j}
                        onUbah={(x) => onUbah(nilai.map((b, a) => (a === i ? b.map((y, c) => (c === j ? x : y)) : b)))} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(nilai).map(([k, v]) => (
        <div key={k} className={typeof v === 'object' ? 'sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-100 p-3' : ''}>
          <div className="text-xs font-semibold text-slate-600 mb-1">{sebut(k)}</div>
          <Editor nilai={v} bawaan={bawaan?.[k]} meta={meta} label={label} onUbah={(x) => onUbah({ ...nilai, [k]: x })} />
        </div>
      ))}
    </div>
  );
};

const RANAH = [['LAUT', 'Perairan'], ['DARAT', 'Darat pesisir']];

const KriteriaEditor = ({ nilai, onUbah, data }) => {
  const [kode, setKode] = useState(data.sektor[0]?.kode);
  const parameter = data.parameter_kriteria;
  const subs = nilai[kode] || {};
  const bawaan = data.daftar.find((d) => d.kunci === 'KRITERIA_JENIS')?.bawaan?.[kode] || {};
  const ubahSub = (sub, baru) => onUbah({ ...nilai, [kode]: { ...subs, [sub]: baru } });
  const tambahSub = () => {
    const terpakai = new Set(Object.values(nilai).flatMap((s) => Object.keys(s)));
    const awalan = kode.toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 30);
    let n = 1;
    while (terpakai.has(`${awalan}_BARU_${n}`)) n += 1;
    ubahSub(`${awalan}_BARU_${n}`, { nama: 'Sub-jenis baru', ranah: ['LAUT'], kriteria: {} });
  };
  const hapusSub = (sub) => {
    const { [sub]: _, ...lain } = subs;
    const { [kode]: __, ...jenisLain } = nilai;
    onUbah(Object.keys(lain).length ? { ...nilai, [kode]: lain } : jenisLain);
  };
  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-xs text-slate-500">
        <b className="text-slate-700">Layak</b> dipakai saat pengguna menganalisis area.{' '}
        <b className="text-kkp-700">Unggulan</b> adalah batas yang lebih ketat untuk lokasi di Peta Sebaran; kosongkan bila
        sama dengan batas layak. Kosongkan &quot;dari&quot; atau &quot;sampai&quot; bila tidak ada batas.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={kode} onChange={(e) => setKode(e.target.value)} className={`${kelasInput} max-w-sm`}>
          {data.sektor.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
        </select>
        <button type="button" onClick={tambahSub}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <Plus className="w-3.5 h-3.5" /> Tambah sub-jenis
        </button>
      </div>
      {Object.entries(subs).map(([sub, isi]) => {
        const unggulan = isi.unggulan || {};
        const ubahKriteria = (k, ambang) => ubahSub(sub, { ...isi, kriteria: { ...isi.kriteria, [k]: ambang } });
        const ubahUnggulan = (k, ambang) => {
          const { [k]: _, ...lain } = unggulan;
          ubahSub(sub, { ...isi, unggulan: ambang.every((x) => x === null) ? lain : { ...unggulan, [k]: ambang } });
        };
        const kunci = [...new Set([...Object.keys(isi.kriteria), ...Object.keys(unggulan)])];
        const sisa = Object.keys(parameter).filter((k) => !kunci.includes(k));
        return (
          <div key={sub} className="rounded-lg border border-slate-100 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input value={isi.nama} onChange={(e) => ubahSub(sub, { ...isi, nama: e.target.value })}
                className={`${kelasInput} max-w-xs font-semibold`} />
              {RANAH.map(([r, n]) => (
                <label key={r} className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={isi.ranah.includes(r)}
                    onChange={(e) => ubahSub(sub, { ...isi, ranah: e.target.checked ? [...isi.ranah, r] : isi.ranah.filter((x) => x !== r) })} />
                  {n}
                </label>
              ))}
              {!bawaan[sub] && (
                <button type="button" onClick={() => hapusSub(sub)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" /> Hapus sub-jenis
                </button>
              )}
            </div>
            {!kunci.length && <p className="text-xs text-amber-700">Tambahkan sedikitnya satu kriteria sebelum menyimpan.</p>}
            <div className={`overflow-x-auto ${kunci.length ? '' : 'hidden'}`}>
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th rowSpan={2} className="pr-3 pb-1 align-bottom font-semibold">Kriteria</th>
                    <th colSpan={2} className="px-1 font-semibold text-slate-700">Layak (analisis area)</th>
                    <th colSpan={2} className="px-1 font-semibold text-kkp-700">Unggulan (Peta Sebaran)</th>
                    <th rowSpan={2} />
                  </tr>
                  <tr className="text-left text-[11px] text-slate-500">
                    <th className="px-1 pb-1 font-medium">dari</th>
                    <th className="px-1 pb-1 font-medium">sampai</th>
                    <th className="px-1 pb-1 font-medium">dari</th>
                    <th className="px-1 pb-1 font-medium">sampai</th>
                  </tr>
                </thead>
                <tbody>
                  {kunci.map((k) => {
                    const [bawah, atas] = isi.kriteria[k] || [null, null];
                    const [ubawah, uatas] = unggulan[k] || [null, null];
                    return (
                    <tr key={k}>
                      <td className="pr-3 py-0.5 text-xs font-medium text-slate-600">
                        {parameter[k]?.label || k}{parameter[k]?.satuan ? ` (${parameter[k].satuan})` : ''}
                      </td>
                      <td className="px-1 py-0.5 w-32"><Angka nilai={bawah} kosong onUbah={(x) => ubahKriteria(k, [x, atas])} /></td>
                      <td className="px-1 py-0.5 w-32"><Angka nilai={atas} kosong onUbah={(x) => ubahKriteria(k, [bawah, x])} /></td>
                      <td className="px-1 py-0.5 w-32"><Angka nilai={ubawah} kosong petunjuk="= layak" onUbah={(x) => ubahUnggulan(k, [x, uatas])} /></td>
                      <td className="px-1 py-0.5 w-32"><Angka nilai={uatas} kosong petunjuk="= layak" onUbah={(x) => ubahUnggulan(k, [ubawah, x])} /></td>
                      <td>
                        <button type="button" title="Hapus kriteria" onClick={() => {
                          const { [k]: _, ...lain } = isi.kriteria;
                          const { [k]: __, ...lainUnggulan } = unggulan;
                          ubahSub(sub, { ...isi, kriteria: lain, unggulan: lainUnggulan });
                        }} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sisa.length > 0 && (
              <select value="" onChange={(e) => e.target.value && ubahKriteria(e.target.value, [null, null])}
                className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 bg-white">
                <option value="">+ Tambah kriteria</option>
                {sisa.map((k) => <option key={k} value={k}>{parameter[k].label}</option>)}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
};

const LABEL_VOLUME = { riil: 'Kondisi riil', s1: 'Sangat sesuai (S1)', s2: 'Sesuai (S2)' };
const URUTAN_MODEL = [
  'riil', 's1', 's2', 'Peralatan', 'Sarana dan prasarana', 'Lahan dan bangunan', 'Perizinan KKPRL', 'Perizinan lain',
  'Benih, bibit, atau bahan baku', 'Pakan, BBM, atau energi', 'Operasional alat', 'Tenaga kerja', 'Lain-lain',
];
const urutModel = (k) => (URUTAN_MODEL.includes(k) ? URUTAN_MODEL.indexOf(k) : URUTAN_MODEL.length);

const GrupAngka = ({ judul, isi, label = {}, onUbah, petunjuk }) => (
  <div>
    <div className="text-xs font-semibold text-slate-600 mb-1">{judul}</div>
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {Object.entries(isi).sort(([a], [b]) => urutModel(a) - urutModel(b)).map(([k, v]) => (
        <label key={k} className="text-[11px] text-slate-500">
          {label[k] || k}
          <Angka nilai={v} kosong petunjuk={petunjuk} onUbah={(x) => onUbah(k, x)} />
        </label>
      ))}
    </div>
  </div>
);

const ModelUsahaEditor = ({ nilai, onUbah, data }) => {
  const kriteria = data.daftar.find((d) => d.kunci === 'KRITERIA_JENIS')?.nilai || {};
  const [kode, setKode] = useState(data.sektor[0]?.kode);
  return (
    <div className="space-y-3">
      <select value={kode} onChange={(e) => setKode(e.target.value)} className={`${kelasInput} max-w-sm`}>
        {data.sektor.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
      </select>
      {Object.entries(kriteria[kode] || {}).map(([sub, isi]) => {
        const m = nilai[sub] || data.templat_model_usaha[kode];
        const ubah = (baru) => onUbah({ ...nilai, [sub]: { ...m, ...baru } });
        const isian = (bagian) => (k, x) => ubah({ [bagian]: { ...m[bagian], [k]: x } });
        const ada = (o) => Object.values(o).some((v) => v);
        const lengkap = (m.harga_per_satuan || m.satuan_produk === 'kg') && ada(m.volume_per_tahun) && ada(m.investasi);
        return (
          <div key={sub} className="rounded-lg border border-slate-100 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{isi.nama}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${lengkap ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {lengkap ? 'Siap dihitung' : 'Belum lengkap'}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-slate-500">
                Satuan usaha
                <input value={m.satuan_usaha} onChange={(e) => ubah({ satuan_usaha: e.target.value })} className={kelasInput} />
              </label>
              <label className="text-[11px] text-slate-500">
                Satuan produk
                <input value={m.satuan_produk} onChange={(e) => ubah({ satuan_produk: e.target.value })} className={kelasInput} />
              </label>
              <label className="text-[11px] text-slate-500">
                Harga per {m.satuan_produk || 'satuan'} (Rp)
                <Angka nilai={m.harga_per_satuan} kosong petunjuk={m.satuan_produk === 'kg' ? 'harga BPS provinsi' : 'wajib diisi'}
                  onUbah={(x) => ubah({ harga_per_satuan: x })} />
              </label>
            </div>
            <GrupAngka judul={`Volume produksi per tahun (${m.satuan_produk || 'satuan'})`} isi={m.volume_per_tahun}
              label={LABEL_VOLUME} petunjuk="kosong" onUbah={isian('volume_per_tahun')} />
            <GrupAngka judul="Investasi awal (Rp)" isi={m.investasi} petunjuk="kosong" onUbah={isian('investasi')} />
            <GrupAngka judul="Biaya operasional per tahun (Rp)" isi={m.operasional_per_tahun} petunjuk="kosong"
              onUbah={isian('operasional_per_tahun')} />
          </div>
        );
      })}
    </div>
  );
};

const STATUS_SUMBER = {
  BERLAKU: ['Berlaku', 'bg-emerald-50 text-emerald-700'],
  SEBAGIAN: ['Sebagian lewat', 'bg-amber-50 text-amber-700'],
  LEWAT: ['Lewat masa berlaku', 'bg-rose-50 text-rose-700'],
  TANPA_BATAS: ['Tanpa batas', 'bg-slate-100 text-slate-500'],
  TIDAK_DIKETAHUI: ['Tahun tidak diketahui', 'bg-slate-100 text-slate-500'],
};

const tanggal = (iso) => new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' });

const MasaBerlakuEditor = ({ nilai, onUbah, data }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th className="px-3 py-2 font-semibold">Data</th>
          <th className="px-3 py-2 font-semibold">Isi saat ini</th>
          <th className="px-3 py-2 font-semibold">Pembaruan otomatis</th>
          <th className="px-3 py-2 font-semibold w-28">Masa berlaku (tahun)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {data.sumber_data.map((s) => {
          const [teks, kelas] = STATUS_SUMBER[s.status];
          return (
            <tr key={s.kode} className="align-top">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-700">{s.label}</div>
                <div className="text-slate-500">{s.sumber}</div>
              </td>
              <td className="px-3 py-2 text-slate-600">
                {s.data}
                <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${kelas}`}>{teks}</span>
                {s.catatan && <div className="mt-0.5 text-amber-700">{s.catatan}</div>}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {s.jadwal.length ? s.jadwal.map((j) => (
                  <div key={j.nama}>
                    {j.nama}: {j.terakhir ? `terakhir ${tanggal(j.terakhir)}` : 'belum pernah'}
                    {j.berikutnya && `, berikutnya setelah ${tanggal(j.berikutnya)}`}
                    {j.gagal && <div className="text-rose-600">Gagal: {j.gagal}</div>}
                  </div>
                )) : <span className="text-slate-400">Manual</span>}
              </td>
              <td className="px-3 py-2">
                <Angka nilai={nilai[s.kode]} onUbah={(x) => onUbah({ ...nilai, [s.kode]: x })} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const satuanTeks = (item) => (item.persen ? item.satuan.replace(/^%\s*/, '') : item.satuan);

const ringkas = (item) => {
  const n = item.nilai;
  if (item.kunci === 'KRITERIA_JENIS') return `${Object.values(n).reduce((a, sub) => a + Object.keys(sub).length, 0)} sub-jenis`;
  if (item.kunci === 'MODEL_USAHA') return `${Object.keys(n).length} sub-jenis`;
  if (item.kunci === 'MASA_BERLAKU_DATA') return `${Object.keys(n).length} kelompok data`;
  const isi = typeof n === 'number' ? [n] : Array.isArray(n) ? n : Object.values(n);
  if (isi.length <= 4 && isi.every((v) => typeof v === 'number')) {
    return [isi.map((v) => angkaId(v, item.persen)).join(' · '), satuanTeks(item)].filter(Boolean).join(' ');
  }
  return Array.isArray(n) && Array.isArray(n[0]) ? `${n.length} baris` : `${isi.length} isian`;
};

const DAMPAK = { peta: 'Peta Sebaran', skor: 'skor kelayakan zona' };

const KartuPengaturan = ({ item, data, tampil, onTersimpan }) => {
  const [nilai, setNilai] = useState(item.nilai);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const [terbuka, setTerbuka] = useState(false);
  const [pernah, setPernah] = useState(false);
  useEffect(() => setNilai(item.nilai), [item.nilai]);
  const berubah = JSON.stringify(nilai) !== JSON.stringify(item.nilai);

  const kirim = async (hapus) => {
    setProses(true);
    setGalat('');
    try {
      const { data: hasil } = hapus ? await api.delete(`${URL}${item.kunci}/`) : await api.put(`${URL}${item.kunci}/`, { nilai });
      onTersimpan(hasil);
    } catch (e) {
      setGalat(e.response?.data?.detail || 'Gagal menyimpan pengaturan.');
    } finally {
      setProses(false);
    }
  };

  const EditorKhusus = {
    KRITERIA_JENIS: KriteriaEditor, MODEL_USAHA: ModelUsahaEditor, MASA_BERLAKU_DATA: MasaBerlakuEditor,
  }[item.kunci];
  const [teksStatus, kelasStatus] = berubah
    ? ['Belum disimpan', 'bg-rose-50 text-rose-700']
    : item.diubah ? ['Diubah', 'bg-amber-50 text-amber-700'] : ['Bawaan', 'bg-slate-100 text-slate-500'];
  return (
    <div hidden={!tampil} className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={terbuka}
        onClick={() => { setTerbuka((v) => !v); setPernah(true); }}
        className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50
                   focus-visible:outline-none focus-visible:bg-kkp-100/50"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
          {item.istilah && <span className="block text-[11px] text-slate-400">{item.istilah}</span>}
        </span>
        <span className="hidden sm:block shrink-0 max-w-[14rem] truncate text-right text-sm tabular-nums text-slate-600">
          {ringkas(item)}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${kelasStatus}`}>{teksStatus}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${terbuka ? '' : '-rotate-90'}`} />
      </button>
      {pernah && (
        <div hidden={!terbuka} className="px-5 pb-5 pt-1">
          {item.keterangan && <p className="mb-3 max-w-3xl text-sm text-slate-600">{item.keterangan}</p>}
          {EditorKhusus
            ? <EditorKhusus nilai={nilai} onUbah={setNilai} data={data} />
            : <Editor nilai={nilai} bawaan={item.bawaan} onUbah={setNilai} meta={item} label={data.label_bagian} />}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {item.diubah && `Diubah ${item.diubah_oleh || 'administrator'} pada ${waktu(item.diubah_pada)}. `}
              {item.dampak.length
                ? `Menyimpan akan menghitung ulang ${item.dampak.map((d) => DAMPAK[d]).join(' dan ')} otomatis.`
                : 'Perubahan langsung berlaku.'}
            </p>
            <div className="flex gap-2">
              {item.diubah && (
                <button type="button" disabled={proses} onClick={() => kirim(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke bawaan
                </button>
              )}
              <button type="button" disabled={!berubah || proses} onClick={() => kirim(false)}
                className="px-3 py-1.5 rounded-lg bg-kkp-800 text-white text-xs font-semibold hover:bg-kkp-900 disabled:opacity-40 flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Simpan
              </button>
            </div>
          </div>
          {galat && <p className="mt-3 text-xs font-medium text-rose-600">{galat}</p>}
        </div>
      )}
    </div>
  );
};

const AdminPengaturanAnalisisPage = () => {
  const [data, setData] = useState(null);
  const [cari, setCari] = useState('');
  const [dibuka, setDibuka] = useState({ syarat_lokasi: true });
  const [status, setStatus, mulai] = useStatusHitungUlang(data?.hitung_ulang);

  const muat = useCallback(() => api.get(URL).then(({ data: d }) => setData(d)), []);
  useEffect(() => { muat(); }, [muat]);

  if (!data) return <div className="p-8 text-slate-500">Memuat pengaturan analisis...</div>;

  const tersimpan = ({ hitung_ulang: hu, ...item }) => {
    setData({ ...data, daftar: data.daftar.map((d) => (d.kunci === item.kunci ? item : d)) });
    setStatus(hu);
    if (item.kunci === 'MASA_BERLAKU_DATA') {
      api.get(URL).then(({ data: d }) => setData((lama) => ({ ...lama, sumber_data: d.sumber_data })));
    }
  };

  const kata = cari.trim().toLowerCase();
  const cocok = (d) => !kata || `${d.label} ${d.istilah} ${d.keterangan} ${d.kunci}`.toLowerCase().includes(kata);
  const adaHasil = data.daftar.some(cocok);

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-kkp-100 rounded-xl text-kkp-800"><SlidersHorizontal className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengaturan Analisis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Angka yang dipakai analisis dan Peta Sebaran. Klik sebuah pengaturan untuk membaca penjelasan dan mengubahnya.
          </p>
        </div>
      </div>
      <StatusHitungUlang status={status} onMulai={mulai} />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari pengaturan, misalnya kabel"
          aria-label="Cari pengaturan"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-kkp-700 focus:outline-none"
        />
      </div>
      <div className="space-y-3">
        {data.kelompok.map((k) => {
          const isi = data.daftar.filter((d) => d.kelompok === k.kode);
          const cocokDiSini = isi.filter(cocok);
          const terbuka = kata ? true : Boolean(dibuka[k.kode]);
          const diubah = isi.filter((d) => d.diubah).length;
          return (
            <section key={k.kode} hidden={!cocokDiSini.length}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                type="button"
                aria-expanded={terbuka}
                onClick={() => setDibuka((s) => ({ ...s, [k.kode]: !s[k.kode] }))}
                className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50
                           focus-visible:outline-none focus-visible:bg-kkp-100/50"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-slate-900">{k.label}</span>
                  {k.keterangan && <span className="mt-0.5 block text-xs text-amber-700">{k.keterangan}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {kata ? `${cocokDiSini.length} cocok` : `${isi.length} pengaturan`}{diubah ? ` · ${diubah} diubah` : ''}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${terbuka ? '' : '-rotate-90'}`} />
              </button>
              <div hidden={!terbuka} className="border-t border-slate-100">
                {isi.map((item) => (
                  <KartuPengaturan key={item.kunci} item={item} data={data} tampil={cocok(item)} onTersimpan={tersimpan} />
                ))}
              </div>
            </section>
          );
        })}
        {!adaHasil && <p className="py-6 text-center text-sm text-slate-400">Tidak ada pengaturan yang cocok dengan “{cari}”.</p>}
      </div>
    </div>
  );
};

export default AdminPengaturanAnalisisPage;
