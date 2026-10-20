import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, Loader2, RefreshCw, RotateCcw, Save, SlidersHorizontal, Trash2,
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
                  <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-sky-600" style={{ animationDelay: `${i * 150}ms` }} />
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
                <div className="hitung-garis h-full rounded-full bg-sky-600 transition-[width] duration-700 ease-out"
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
                      lalu ? 'bg-emerald-100 text-emerald-800' : kini ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
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

const Angka = ({ nilai, onUbah, kosong = false, readOnly = false, petunjuk }) => (
  <input
    type="number"
    step="any"
    value={nilai ?? ''}
    readOnly={readOnly}
    placeholder={petunjuk ?? (kosong ? 'tanpa batas' : '')}
    onChange={(e) => onUbah(e.target.value === '' ? (kosong ? null : '') : Number(e.target.value))}
    className={`${kelasInput} tabular-nums ${readOnly ? 'bg-slate-50 text-slate-500' : ''}`}
  />
);

const Editor = ({ nilai, onUbah, meta, label }) => {
  const sebut = (k) => label[k] || k.replace(/_/g, ' ');
  if (typeof nilai === 'boolean') {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={nilai} onChange={(e) => onUbah(e.target.checked)} /> {nilai ? 'Ya' : 'Tidak'}
      </label>
    );
  }
  if (typeof nilai === 'number' || nilai === '') return <div className="max-w-[12rem]"><Angka nilai={nilai} onUbah={onUbah} /></div>;
  if (Array.isArray(nilai) && nilai.every((v) => !Array.isArray(v) && typeof v !== 'object')) {
    return (
      <div className="flex flex-wrap gap-3">
        {nilai.map((v, i) => (
          <label key={i} className="w-36 text-xs text-slate-500">
            {meta.kolom?.[i] || `Nilai ${i + 1}`}
            <Angka nilai={v} onUbah={(x) => onUbah(nilai.map((y, j) => (j === i ? x : y)))} />
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
                  <td key={j} className="px-1 py-0.5 min-w-[7rem]">
                    {typeof v === 'string' ? <span className="text-xs font-medium text-slate-700">{sebut(v)}</span> : (
                      <Angka nilai={v} readOnly={Boolean(meta.baris) && i === j}
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
          <Editor nilai={v} meta={meta} label={label} onUbah={(x) => onUbah({ ...nilai, [k]: x })} />
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
  const ubahSub = (sub, baru) => onUbah({ ...nilai, [kode]: { ...subs, [sub]: baru } });
  return (
    <div className="space-y-3">
      <select value={kode} onChange={(e) => setKode(e.target.value)} className={`${kelasInput} max-w-sm`}>
        {data.sektor.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
      </select>
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
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pr-3 pb-1 font-semibold">Kriteria</th>
                    <th className="px-1 pb-1 font-semibold">Batas bawah</th>
                    <th className="px-1 pb-1 font-semibold">Batas atas</th>
                    <th className="px-1 pb-1 font-semibold text-kkp-700" title="Dipakai Peta Sebaran; kosongkan untuk memakai batas layak">Unggulan bawah</th>
                    <th className="px-1 pb-1 font-semibold text-kkp-700" title="Dipakai Peta Sebaran; kosongkan untuk memakai batas layak">Unggulan atas</th>
                    <th />
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
                      <td className="px-1 py-0.5 w-32"><Angka nilai={ubawah} kosong petunjuk="ikut layak" onUbah={(x) => ubahUnggulan(k, [x, uatas])} /></td>
                      <td className="px-1 py-0.5 w-32"><Angka nilai={uatas} kosong petunjuk="ikut layak" onUbah={(x) => ubahUnggulan(k, [ubawah, x])} /></td>
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

const KartuPengaturan = ({ item, data, onTersimpan }) => {
  const [nilai, setNilai] = useState(item.nilai);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
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

  const khusus = item.kunci === 'KRITERIA_JENIS';
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">{item.label}{item.satuan && <span className="font-normal text-slate-400"> · {item.satuan}</span>}</h3>
          {item.keterangan && <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{item.keterangan}</p>}
          <p className="text-[11px] mt-1 text-slate-400">
            {item.diubah ? `Diubah ${item.diubah_oleh || 'administrator'} pada ${waktu(item.diubah_pada)}` : 'Memakai nilai bawaan'}
            {item.dampak.length > 0 && ' · menyimpan memicu hitung ulang Peta Sebaran'}
            {item.dampak.includes('skor') && ' dan skor zona'}
          </p>
        </div>
        <div className="flex gap-2">
          {item.diubah && (
            <button type="button" disabled={proses} onClick={() => kirim(true)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke bawaan
            </button>
          )}
          <button type="button" disabled={!berubah || proses} onClick={() => kirim(false)}
            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-40 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> Simpan
          </button>
        </div>
      </div>
      {khusus
        ? <KriteriaEditor nilai={nilai} onUbah={setNilai} data={data} />
        : <Editor nilai={nilai} onUbah={setNilai} meta={item} label={data.label_bagian} />}
      {galat && <p className="mt-3 text-xs font-medium text-rose-600">{galat}</p>}
    </div>
  );
};

const AdminPengaturanAnalisisPage = () => {
  const [data, setData] = useState(null);
  const [kelompok, setKelompok] = useState('karakter');
  const [status, setStatus, mulai] = useStatusHitungUlang(data?.hitung_ulang);

  const muat = useCallback(() => api.get(URL).then(({ data: d }) => setData(d)), []);
  useEffect(() => { muat(); }, [muat]);

  if (!data) return <div className="p-8 text-slate-500">Memuat pengaturan analisis...</div>;

  const tersimpan = ({ hitung_ulang: hu, ...item }) => {
    setData({ ...data, daftar: data.daftar.map((d) => (d.kunci === item.kunci ? item : d)) });
    setStatus(hu);
  };

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-50 rounded-xl text-sky-600"><SlidersHorizontal className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-syne">Pengaturan Analisis</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ambang, bobot, dan skor yang dipakai analisis area, Peta Sebaran Wilayah Potensial Investasi, analisis finansial, dan skor AHP.
            Setiap perubahan langsung berlaku dan tercatat di Log Aktivitas.
          </p>
        </div>
      </div>
      <StatusHitungUlang status={status} onMulai={mulai} />
      <div className="flex flex-wrap gap-2">
        {data.kelompok.map((k) => (
          <button key={k.kode} type="button" onClick={() => setKelompok(k.kode)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              kelompok === k.kode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {data.daftar.filter((d) => d.kelompok === kelompok).map((item) => (
          <KartuPengaturan key={item.kunci} item={item} data={data} onTersimpan={tersimpan} />
        ))}
      </div>
    </div>
  );
};

export default AdminPengaturanAnalisisPage;
