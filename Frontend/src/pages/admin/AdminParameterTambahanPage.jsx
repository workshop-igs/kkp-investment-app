import { useCallback, useEffect, useState } from 'react';
import { Edit2, FilePlus2, Layers, Plus, Trash2, Upload, X } from 'lucide-react';
import { api, ambilDaftar } from '../../api/klien';
import { bacaGeospasial } from '../../components/map/UnggahGeospasial';
import { StatusHitungUlang, useStatusHitungUlang } from './AdminPengaturanAnalisisPage';

const URL = '/inti/admin/parameter-tambahan/';
const PERAN = [
  ['GERBANG', 'Gerbang wajib', 'Lokasi yang tidak memenuhi dinilai tidak sesuai dan tidak direkomendasikan.'],
  ['DINILAI', 'Parameter dinilai', 'Ikut dihitung dalam persentase parameter sangat sesuai, tanpa menggugurkan lokasi.'],
  ['INFORMASI', 'Informasi saja', 'Hanya ditampilkan di laporan analisis.'],
];
const LABEL_PERAN = Object.fromEntries(PERAN.map(([k, l]) => [k, l]));
const KOSONG = {
  nama: '', keterangan: '', tipe: 'AREA', peran: 'GERBANG', aktif: true, sektor: [], provinsi: [],
  kondisi: 'DI_DALAM', tingkat: 'KABUPATEN', nilai_min: null, nilai_maks: null, satuan: '', sumber: '',
};
const kelasInput = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

const pesanGalat = (e) => {
  const d = e.response?.data;
  if (!d) return 'Gagal menghubungi server.';
  if (d.detail) return d.detail;
  return Object.entries(d).map(([k, v]) => `${k}: ${[].concat(v).join(' ')}`).join(' · ');
};

const Pilihan = ({ daftar, terpilih, onUbah, kunci, label }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
    {daftar.map((d) => (
      <label key={d[kunci]} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
        <input type="checkbox" checked={terpilih.includes(d[kunci])}
          onChange={(e) => onUbah(e.target.checked ? [...terpilih, d[kunci]] : terpilih.filter((x) => x !== d[kunci]))} />
        {d[label]}
      </label>
    ))}
  </div>
);

const UnggahData = ({ parameter, onSelesai }) => {
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const area = parameter.tipe === 'AREA';

  const pilih = async (e) => {
    const berkas = e.target.files?.[0];
    e.target.value = '';
    if (!berkas) return;
    setProses(true);
    setGalat('');
    setHasil(null);
    try {
      if (area) {
        const { diabaikan, ...area_ } = await bacaGeospasial(berkas);
        const { data } = await api.post(`${URL}${parameter.id}/area/`, area_);
        setHasil(`${data.jumlah} poligon area tersimpan; berlaku di provinsi ${data.provinsi.join(', ') || '-'}.`);
      } else {
        const form = new FormData();
        form.append('berkas', berkas);
        const { data } = await api.post(`${URL}${parameter.id}/tabel/`, form);
        setHasil(`${data.cocok} wilayah cocok${data.jumlah_tidak_cocok ? `; ${data.jumlah_tidak_cocok} baris tidak cocok: ${data.tidak_cocok.join(', ')}` : ''}.`);
      }
      onSelesai();
    } catch (err) {
      setGalat(err.message && !err.response ? err.message : pesanGalat(err));
    } finally {
      setProses(false);
    }
  };

  return (
    <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1.5">
      <div className="font-semibold text-slate-700">
        {area ? 'Unggah area: Shapefile (.zip), KML, atau GeoJSON dalam derajat WGS84'
          : 'Unggah tabel: CSV atau Excel dengan kolom kode BPS atau nama wilayah, dan kolom nilai'}
      </div>
      <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 ${proses ? 'opacity-50' : 'cursor-pointer hover:bg-slate-100'}`}>
        <Upload className="w-3.5 h-3.5" /> {proses ? 'Memproses...' : 'Pilih berkas'}
        <input type="file" className="hidden" disabled={proses} onChange={pilih}
          accept={area ? '.zip,.kml,.geojson,.json' : '.csv,.xlsx,.xls'} />
      </label>
      {hasil && <p className="text-emerald-700">{hasil}</p>}
      {galat && <p className="text-rose-600">{galat}</p>}
    </div>
  );
};

const Formulir = ({ awal, sektor, provinsi, onBatal, onTersimpan }) => {
  const [isian, setIsian] = useState(awal);
  const [galat, setGalat] = useState('');
  const ubah = (k) => (v) => setIsian({ ...isian, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v });
  const angka = (k) => (e) => setIsian({ ...isian, [k]: e.target.value === '' ? null : Number(e.target.value) });

  const simpan = async () => {
    setGalat('');
    try {
      const { data } = isian.id ? await api.put(`${URL}${isian.id}/`, isian) : await api.post(URL, isian);
      onTersimpan(data);
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{isian.id ? 'Ubah parameter' : 'Parameter baru'}</h3>
        <button type="button" onClick={onBatal} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Nama parameter (tampil di laporan dan popup)
          <input value={isian.nama} onChange={ubah('nama')} className={`${kelasInput} mt-1 font-normal`} placeholder="mis. Area cadangan perikanan tangkap NTB" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Sumber data
          <input value={isian.sumber} onChange={ubah('sumber')} className={`${kelasInput} mt-1 font-normal`} placeholder="mis. DKP Provinsi NTB, 2026" />
        </label>
        <label className="text-xs font-semibold text-slate-600 md:col-span-2">Keterangan
          <textarea rows={2} value={isian.keterangan} onChange={ubah('keterangan')} className={`${kelasInput} mt-1 font-normal`} />
        </label>
        <div className="text-xs font-semibold text-slate-600">Bentuk data
          <div className="mt-1 flex gap-4 font-normal">
            {[['AREA', 'Area geospasial'], ['TABEL', 'Tabel per wilayah']].map(([k, l]) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" checked={isian.tipe === k} disabled={Boolean(isian.id)} onChange={() => setIsian({ ...isian, tipe: k })} /> {l}
              </label>
            ))}
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-600">Peran dalam analisis
          <select value={isian.peran} onChange={ubah('peran')} className={`${kelasInput} mt-1 font-normal`}>
            {PERAN.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <p className="mt-1 font-normal text-slate-400">{PERAN.find(([k]) => k === isian.peran)[2]}</p>
        </div>
        {isian.tipe === 'AREA' ? (
          <div className="text-xs font-semibold text-slate-600">Lokasi sesuai bila
            <select value={isian.kondisi} onChange={ubah('kondisi')} className={`${kelasInput} mt-1 font-normal`}>
              <option value="DI_DALAM">berada di dalam area</option>
              <option value="DI_LUAR">berada di luar area</option>
            </select>
          </div>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-600">Tingkat wilayah
              <select value={isian.tingkat} onChange={ubah('tingkat')} className={`${kelasInput} mt-1 font-normal`}>
                <option value="KABUPATEN">Kabupaten/kota</option>
                <option value="PROVINSI">Provinsi</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-600">
              <label>Nilai paling rendah<input type="number" step="any" value={isian.nilai_min ?? ''} onChange={angka('nilai_min')} className={`${kelasInput} mt-1 font-normal`} /></label>
              <label>Nilai paling tinggi<input type="number" step="any" value={isian.nilai_maks ?? ''} onChange={angka('nilai_maks')} className={`${kelasInput} mt-1 font-normal`} /></label>
              <label>Satuan<input value={isian.satuan} onChange={ubah('satuan')} className={`${kelasInput} mt-1 font-normal`} /></label>
            </div>
          </>
        )}
        <div className="text-xs font-semibold text-slate-600 md:col-span-2">Jenis investasi (kosongkan untuk semua jenis)
          <div className="mt-1 font-normal"><Pilihan daftar={sektor} terpilih={isian.sektor} onUbah={ubah('sektor')} kunci="kode" label="nama" /></div>
        </div>
        <div className="text-xs font-semibold text-slate-600 md:col-span-2">
          Provinsi (kosongkan untuk semua; untuk area, provinsi diisi otomatis dari zona yang beririsan saat diunggah)
          <div className="mt-1 font-normal"><Pilihan daftar={provinsi} terpilih={isian.provinsi} onUbah={ubah('provinsi')} kunci="kode_bps" label="nama" /></div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isian.aktif} onChange={ubah('aktif')} /> Aktif dipakai analisis
        </label>
      </div>
      {galat && <p className="text-xs font-medium text-rose-600">{galat}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBatal} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
        <button type="button" onClick={simpan} className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700">Simpan</button>
      </div>
    </div>
  );
};

const AdminParameterTambahanPage = () => {
  const [daftar, setDaftar] = useState(null);
  const [rujukan, setRujukan] = useState({ sektor: [], provinsi: [], hitung_ulang: null });
  const [form, setForm] = useState(null);
  const [status, setStatus, mulai] = useStatusHitungUlang(rujukan.hitung_ulang);

  const muat = useCallback(async () => {
    const [{ data: p }, { data: prov }, { data: atur }] = await Promise.all([
      api.get(URL), api.get('/inti/provinsi/', { params: { page_size: 100 } }), api.get('/inti/admin/pengaturan-analisis/'),
    ]);
    setDaftar(ambilDaftar(p));
    setRujukan({ sektor: atur.sektor, provinsi: ambilDaftar(prov), hitung_ulang: atur.hitung_ulang });
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const segarkanStatus = () => api.get('/inti/admin/pengaturan-analisis/hitung-ulang/').then(({ data }) => setStatus(data));
  const hapus = async (p) => {
    if (!window.confirm(`Hapus parameter "${p.nama}" beserta datanya?`)) return;
    await api.delete(`${URL}${p.id}/`);
    await muat();
    segarkanStatus();
  };
  const namaSektor = (kode) => rujukan.sektor.find((s) => s.kode === kode)?.nama || kode;

  if (!daftar) return <div className="p-8 text-slate-500">Memuat parameter analisis...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-50 rounded-xl text-sky-600"><Layers className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-syne">Parameter Analisis Tambahan</h1>
            <p className="text-slate-500 text-sm mt-1">
              Tambahkan area khusus (mis. area cadangan perikanan tangkap) atau nilai per wilayah sebagai parameter analisis area,
              Peta Sebaran Wilayah Potensial Investasi, dan laporan.
            </p>
          </div>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm(KOSONG)}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Parameter baru
          </button>
        )}
      </div>
      <StatusHitungUlang status={status} onMulai={mulai} />
      {form && (
        <Formulir key={form.id ?? "baru"} awal={form} sektor={rujukan.sektor} provinsi={rujukan.provinsi} onBatal={() => setForm(null)}
          onTersimpan={async () => { setForm(null); await muat(); segarkanStatus(); }} />
      )}
      {daftar.length === 0 && !form && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <FilePlus2 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          Belum ada parameter tambahan. Buat parameter, lalu unggah area atau tabel nilainya.
        </div>
      )}
      <div className="space-y-4">
        {daftar.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900">
                  {p.nama}
                  {!p.aktif && <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">nonaktif</span>}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.tipe === 'AREA' ? `Area · sesuai bila ${p.kondisi === 'DI_DALAM' ? 'di dalam' : 'di luar'} area · ${p.jumlah_area} poligon`
                    : `Tabel per ${p.tingkat === 'PROVINSI' ? 'provinsi' : 'kabupaten/kota'} · ${p.jumlah_nilai} wilayah · sesuai bila ${
                      [p.nilai_min != null && `≥ ${p.nilai_min}`, p.nilai_maks != null && `≤ ${p.nilai_maks}`].filter(Boolean).join(' dan ')} ${p.satuan}`}
                  {' · '}{LABEL_PERAN[p.peran]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Jenis: {p.sektor.length ? p.sektor.map(namaSektor).join(', ') : 'semua'}
                  {' · '}Provinsi: {p.provinsi.length ? p.provinsi.join(', ') : 'semua'}
                  {p.sumber && ` · Sumber: ${p.sumber}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" title="Ubah" onClick={() => setForm(p)} className="p-1.5 text-sky-600 bg-sky-50 rounded hover:bg-sky-100"><Edit2 className="w-4 h-4" /></button>
                <button type="button" title="Hapus" onClick={() => hapus(p)} className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <UnggahData parameter={p} onSelesai={async () => { await muat(); segarkanStatus(); }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminParameterTambahanPage;
