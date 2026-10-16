import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { api } from '../../api/klien';

const URL = '/inti/admin/pengaturan-analisis/';

const waktu = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export const StatusHitungUlang = ({ status, onMulai }) => {
  if (!status) return null;
  const { berjalan, menunggu, tahap, ke, dari, selesai, galat } = status;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3 ${
      galat ? 'bg-rose-50 border-rose-200 text-rose-800'
        : berjalan || menunggu ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }`}>
      <div>
        <div className="font-semibold">
          {berjalan ? 'Peta Sebaran dan skor sedang dihitung ulang di latar'
            : menunggu ? 'Hitung ulang menunggu antrean'
              : 'Peta Sebaran dan skor sudah memakai pengaturan terbaru'}
        </div>
        <div className="text-xs mt-0.5">
          {berjalan && tahap ? `${tahap}${dari ? ` (${ke}/${dari})` : ''}` : selesai ? `Terakhir selesai ${waktu(selesai)}` : ''}
          {galat && ` · Galat terakhir: ${galat}`}
        </div>
      </div>
      {onMulai && !berjalan && (
        <button type="button" onClick={onMulai}
          className="px-3 py-1.5 rounded-lg bg-white border border-current/20 text-xs font-semibold hover:bg-white/70 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Hitung ulang sekarang
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
    }, 15000);
    return () => clearInterval(t);
  }, [status?.berjalan, status?.menunggu]);
  const mulai = () => api.post(`${URL}hitung-ulang/`).then(({ data }) => setStatus(data));
  return [status, setStatus, mulai];
};

const kelasInput = 'w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-sky-500 focus:outline-none';

const Angka = ({ nilai, onUbah, kosong = false, readOnly = false }) => (
  <input
    type="number"
    step="any"
    value={nilai ?? ''}
    readOnly={readOnly}
    placeholder={kosong ? 'tanpa batas' : ''}
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

const SyaratEditor = ({ syarat, onUbah, pilihan, ekosistem, label }) => {
  const sisa = pilihan.filter((k) => !(k in syarat));
  const bawaan = (k) => (k === 'kedalaman' ? [null, null] : k.includes('ekosistem') ? [ekosistem[0]] : 0);
  return (
    <div className="space-y-2">
      {Object.entries(syarat).map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-center gap-2">
          <span className="w-56 text-xs font-medium text-slate-600">{label[k] || k}</span>
          {k === 'kedalaman' ? (
            <div className="flex gap-2 w-60">
              <Angka nilai={v[0]} kosong onUbah={(x) => onUbah({ ...syarat, kedalaman: [x, v[1]] })} />
              <Angka nilai={v[1]} kosong onUbah={(x) => onUbah({ ...syarat, kedalaman: [v[0], x] })} />
            </div>
          ) : Array.isArray(v) ? (
            <div className="flex flex-wrap gap-3">
              {ekosistem.map((e) => (
                <label key={e} className="inline-flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={v.includes(e)}
                    onChange={(ev) => onUbah({ ...syarat, [k]: ev.target.checked ? [...v, e] : v.filter((x) => x !== e) })} />
                  {e.replace(/_/g, ' ').toLowerCase()}
                </label>
              ))}
            </div>
          ) : (
            <div className="w-28"><Angka nilai={v} onUbah={(x) => onUbah({ ...syarat, [k]: x })} /></div>
          )}
          <button type="button" title="Hapus syarat" onClick={() => {
            const { [k]: _, ...lain } = syarat;
            onUbah(lain);
          }} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {sisa.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onUbah({ ...syarat, [e.target.value]: bawaan(e.target.value) })}
          className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 bg-white">
          <option value="">+ Tambah syarat</option>
          {sisa.map((k) => <option key={k} value={k}>{label[k] || k}</option>)}
        </select>
      )}
    </div>
  );
};

const KarakterEditor = ({ nilai, onUbah, data, tambahan }) => {
  const [kode, setKode] = useState(data.sektor[0]?.kode);
  const aturan = nilai[kode] || (tambahan ? {} : { uraian: '' });
  const ubahJenis = (baru) => onUbah({ ...nilai, [kode]: baru });
  const RANAH = [['LAUT', 'Perairan'], ['DARAT', 'Darat pesisir']];
  return (
    <div className="space-y-3">
      <select value={kode} onChange={(e) => setKode(e.target.value)} className={`${kelasInput} max-w-sm`}>
        {data.sektor.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
      </select>
      {!tambahan && (
        <label className="block text-xs font-semibold text-slate-600">
          Uraian kebutuhan (tampil di laporan dan profil)
          <textarea rows={2} value={aturan.uraian || ''} onChange={(e) => ubahJenis({ ...aturan, uraian: e.target.value })}
            className={`${kelasInput} mt-1 font-normal`} />
        </label>
      )}
      {RANAH.map(([ranah, nama]) => (
        <div key={ranah} className="rounded-lg border border-slate-100 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={ranah in aturan} onChange={(e) => {
              if (e.target.checked) ubahJenis({ ...aturan, [ranah]: tambahan ? {} : [{}] });
              else {
                const { [ranah]: _, ...lain } = aturan;
                ubahJenis(lain);
              }
            }} />
            {nama}
          </label>
          {ranah in aturan && (tambahan ? (
            <div className="mt-2">
              <SyaratEditor syarat={aturan[ranah]} pilihan={data.syarat_tambahan} ekosistem={data.ekosistem}
                label={data.label_bagian} onUbah={(s) => ubahJenis({ ...aturan, [ranah]: s })} />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {aturan[ranah].map((syarat, i) => (
                <div key={i} className="rounded-md bg-slate-50 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Alternatif {i + 1}{aturan[ranah].length > 1 ? ' (cukup salah satu terpenuhi)' : ''}
                    </span>
                    {aturan[ranah].length > 1 && (
                      <button type="button" onClick={() => ubahJenis({ ...aturan, [ranah]: aturan[ranah].filter((_, j) => j !== i) })}
                        className="text-xs text-rose-600 hover:underline">Hapus alternatif</button>
                    )}
                  </div>
                  <SyaratEditor syarat={syarat} pilihan={data.syarat_karakter} ekosistem={data.ekosistem} label={data.label_bagian}
                    onUbah={(s) => ubahJenis({ ...aturan, [ranah]: aturan[ranah].map((x, j) => (j === i ? s : x)) })} />
                </div>
              ))}
              <button type="button" onClick={() => ubahJenis({ ...aturan, [ranah]: [...aturan[ranah], {}] })}
                className="text-xs font-semibold text-sky-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tambah alternatif</button>
            </div>
          ))}
        </div>
      ))}
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

  const khusus = ['KARAKTER_LOKASI', 'PARAMETER_TAMBAHAN'].includes(item.kunci);
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
        ? <KarakterEditor nilai={nilai} onUbah={setNilai} data={data} tambahan={item.kunci === 'PARAMETER_TAMBAHAN'} />
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
            Ambang, bobot, dan skor yang dipakai analisis area, Peta Sebaran Lokasi Indikatif Lolos Penyaringan, analisis finansial, dan skor AHP.
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
