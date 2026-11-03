import { useCallback, useEffect, useState } from 'react';
import { CircleHelp, DatabaseZap, Download, RefreshCw, Upload } from 'lucide-react';
import { api } from '../../api/klien';
import { STATUS_SUMBER, StatusHitungUlang, useStatusHitungUlang } from './AdminPengaturanAnalisisPage';

const URL = '/inti/admin/pembaruan-data/';
const kelasInput = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';
const kelasTombol = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50';
const tanggal = (iso) => new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' });
const pesanGalat = (e) => e.response?.data?.detail || 'Gagal menghubungi server.';

const UNGGAH_LAIN = 'Data tambahan dari KKP berupa area atau nilai per wilayah diunggah di menu Parameter Tambahan.';
const PANDUAN = {
  tata_ruang: 'Matriks KKPRL diunggah di bagian bawah halaman ini: isi templat Excel (satu baris per kegiatan per zona, kolom kode zona beserta koordinatnya bila ada), atau unggah PDF lampiran Perda yang tabelnya berupa teks (bukan hasil pindaian) dengan rentang halaman matriks. Poligon RTRW diperbarui dengan tombol Periksa pembaruan dari folder data KKP.',
  kkprl: 'Diperbarui otomatis dari Portal Satu Data KKP. Tekan Periksa pembaruan untuk menarik data terbaru sekarang.',
  izin_tambang: 'Diperbarui otomatis dari Geoportal ESDM. Tekan Periksa pembaruan untuk menarik data terbaru sekarang.',
  infrastruktur: 'Diperbarui otomatis dari Portal Satu Data KKP dan OpenStreetMap.',
  oseanografi: 'Diperbarui otomatis dari NOAA dan NASA (rata-rata 12 bulan terakhir).',
  aktivitas_tangkap: 'Diperbarui otomatis dari Global Fishing Watch.',
  kondisi_tetap: `Kondisi jangka panjang (kedalaman, pasang surut, curah hujan, angin) jarang berubah dan tidak ditarik ulang. ${UNGGAH_LAIN}`,
  ekosistem: 'Mangrove, lamun, dan terumbu karang ditarik dari Portal Satu Data KKP dan Sidako bila ditekan Periksa pembaruan.',
  bencana: `Risiko bencana InaRISK disimpan di dalam aplikasi dan tidak ditarik ulang. ${UNGGAH_LAIN}`,
  adat: 'Wilayah kelola masyarakat hukum adat ditarik dari Portal Satu Data KKP bila ditekan Periksa pembaruan.',
  bps_produksi: 'Diperbarui otomatis dari BPS setiap tahun data baru terbit.',
  bps_kerja: 'Diperbarui otomatis dari BPS setiap tahun data baru terbit.',
};

const Kelompok = ({ k, onTarik, proses }) => {
  const [panduan, setPanduan] = useState(false);
  const [teks, kelas] = STATUS_SUMBER[k.status];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800 text-sm">{k.label}</div>
          <div className="text-xs text-slate-500">{k.sumber} · {k.data}
            <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${kelas}`}>{teks}</span>
          </div>
          {k.catatan && <div className="text-xs text-amber-700 mt-0.5">{k.catatan}</div>}
        </div>
        <button type="button" className={kelasTombol} onClick={() => setPanduan(!panduan)}>
          <CircleHelp className="w-3.5 h-3.5" /> Panduan
        </button>
      </div>
      {panduan && <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900">{PANDUAN[k.kode]}</p>}
      {k.tarik.map((t) => (
        <div key={t.kode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div className="text-slate-600">
            <div className="font-medium text-slate-700">{t.nama}</div>
            {t.terakhir ? `Terakhir diperbarui ${tanggal(t.terakhir)}` : 'Belum pernah diperbarui'}
            {t.berikutnya && `, otomatis lagi setelah ${tanggal(t.berikutnya)}`}
            {t.gagal && <div className="text-rose-600">Pembaruan terakhir gagal: {t.gagal}</div>}
          </div>
          <button type="button" className={kelasTombol} disabled={t.berjalan || proses} onClick={() => onTarik(t)}>
            <RefreshCw className={`w-3.5 h-3.5 ${t.berjalan ? 'animate-spin' : ''}`} />
            {t.berjalan ? 'Sedang diperbarui...' : 'Periksa pembaruan'}
          </button>
        </div>
      ))}
    </div>
  );
};

const UnggahMatriks = ({ provinsi, onTerapkan }) => {
  const [berkas, setBerkas] = useState(null);
  const [halaman, setHalaman] = useState({ awal: '', akhir: '' });
  const [pratinjau, setPratinjau] = useState(null);
  const [tujuan, setTujuan] = useState({ provinsi: '', perda: '' });
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const [hasil, setHasil] = useState('');
  const pdf = berkas?.name.toLowerCase().endsWith('.pdf');

  const unduhTemplat = async () => {
    const { data } = await api.get(`${URL}templat-matriks/`, { responseType: 'blob' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(data);
    a.download = 'templat-matriks-kkprl.xlsx';
    a.click();
    window.URL.revokeObjectURL(a.href);
  };

  const jalankan = async (kerja) => {
    setProses(true);
    setGalat('');
    try {
      await kerja();
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setProses(false);
    }
  };

  const baca = () => jalankan(async () => {
    const form = new FormData();
    form.append('berkas', berkas);
    if (pdf) {
      form.append('halaman_awal', halaman.awal);
      form.append('halaman_akhir', halaman.akhir);
    }
    setPratinjau(null);
    setHasil('');
    setPratinjau((await api.post(`${URL}pratinjau-matriks/`, form)).data);
  });

  const terapkan = () => jalankan(async () => {
    const nama = provinsi.find((p) => p.kode === tujuan.provinsi)?.nama;
    if (!window.confirm(`Ganti seluruh matriks KKPRL Provinsi ${nama} dengan ${pratinjau.jumlah_blok} blok zona ini?`)) return;
    const { data } = await api.post(`${URL}terapkan-matriks/`, { ...tujuan, blok: pratinjau.blok });
    setHasil(data.pesan);
    setPratinjau(null);
    setBerkas(null);
    onTerapkan(data);
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800 text-sm">Unggah matriks KKPRL</div>
          <p className="text-xs text-slate-500">Matriks baru menggantikan matriks lama provinsi itu, lalu status zona di peta dihitung ulang.</p>
        </div>
        <button type="button" className={kelasTombol} onClick={unduhTemplat}><Download className="w-3.5 h-3.5" /> Unduh templat Excel</button>
      </div>
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className={`${kelasTombol} cursor-pointer`}>
          <Upload className="w-3.5 h-3.5" /> {berkas ? berkas.name : 'Pilih berkas Excel atau PDF'}
          <input type="file" className="hidden" accept=".xlsx,.pdf" disabled={proses}
            onChange={(e) => { setBerkas(e.target.files?.[0] || null); setPratinjau(null); e.target.value = ''; }} />
        </label>
        {pdf && ['awal', 'akhir'].map((k) => (
          <label key={k} className="text-slate-600">Halaman {k}
            <input type="number" min="1" value={halaman[k]} className={`${kelasInput} w-24`}
              onChange={(e) => setHalaman({ ...halaman, [k]: e.target.value })} />
          </label>
        ))}
        <button type="button" className={kelasTombol} disabled={!berkas || proses || (pdf && !(halaman.awal && halaman.akhir))} onClick={baca}>
          {proses && !pratinjau ? 'Membaca...' : 'Lihat pratinjau'}
        </button>
      </div>
      {pratinjau && (
        <div className="space-y-2">
          <p className="text-xs text-slate-700">
            Terbaca {pratinjau.jumlah_blok} blok zona, {pratinjau.jumlah_kode} kode zona, {pratinjau.jumlah_butir} butir kegiatan.
          </p>
          {pratinjau.peringatan.map((p) => <p key={p} className="text-xs text-amber-700">{p}</p>)}
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-semibold">Zona</th>
                  <th className="px-3 py-2 font-semibold">Kode zona</th>
                  <th className="px-3 py-2 font-semibold">Diperbolehkan</th>
                  <th className="px-3 py-2 font-semibold">Bersyarat</th>
                  <th className="px-3 py-2 font-semibold">Tidak diperbolehkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pratinjau.blok.map((b, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-slate-700">{b.nama_zona}</td>
                    <td className="px-3 py-1.5 text-slate-500">{Object.keys(b.kode_zona).slice(0, 4).join(', ') || '-'}
                      {Object.keys(b.kode_zona).length > 4 && ` +${Object.keys(b.kode_zona).length - 4}`}</td>
                    <td className="px-3 py-1.5">{b.diperbolehkan.length}</td>
                    <td className="px-3 py-1.5">{b.bersyarat.length}</td>
                    <td className="px-3 py-1.5">{b.tidak_diperbolehkan.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 sm:grid-cols-[14rem_1fr_auto] items-end text-xs">
            <label className="text-slate-600">Provinsi
              <select className={kelasInput} value={tujuan.provinsi} onChange={(e) => setTujuan({ ...tujuan, provinsi: e.target.value })}>
                <option value="">Pilih provinsi</option>
                {provinsi.map((p) => <option key={p.kode} value={p.kode}>{p.nama}</option>)}
              </select>
            </label>
            <label className="text-slate-600">Sumber matriks
              <input className={kelasInput} placeholder="mis. Perda Provinsi Maluku No. 2 Tahun 2025" value={tujuan.perda}
                onChange={(e) => setTujuan({ ...tujuan, perda: e.target.value })} />
            </label>
            <button type="button" disabled={proses || !tujuan.provinsi || !tujuan.perda.trim()} onClick={terapkan}
              className="px-4 py-2 rounded-lg bg-kkp-800 text-white text-sm font-semibold hover:bg-kkp-900 disabled:opacity-50">
              {proses ? 'Menerapkan...' : 'Terapkan'}
            </button>
          </div>
        </div>
      )}
      {hasil && <p className="text-xs text-emerald-700">{hasil}</p>}
      {galat && <p className="text-xs text-rose-600">{galat}</p>}
    </div>
  );
};

const AdminPembaruanDataPage = () => {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [proses, setProses] = useState(false);
  const [status, setStatus, mulai] = useStatusHitungUlang(data?.hitung_ulang);

  const muat = useCallback(() => api.get(URL).then(({ data: d }) => setData(d)).catch((e) => setGalat(pesanGalat(e))), []);
  useEffect(() => { muat(); }, [muat]);
  const berjalan = data?.kelompok.some((k) => k.tarik.some((t) => t.berjalan));
  useEffect(() => {
    if (!berjalan) return undefined;
    const t = setInterval(muat, 15000);
    return () => clearInterval(t);
  }, [berjalan, muat]);

  const tarik = async (t) => {
    if (!window.confirm(`Perbarui "${t.nama}" sekarang? Prosesnya berjalan di latar dan bisa memakan beberapa menit.`)) return;
    setProses(true);
    setGalat('');
    try {
      setData((await api.post(`${URL}tarik/`, { kode: t.kode })).data);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setProses(false);
    }
  };

  if (!data) return <div className="p-8 text-slate-500">{galat || 'Memuat sumber data...'}</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-sky-50 rounded-xl text-sky-600"><DatabaseZap className="w-5 h-5" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pembaruan Data</h1>
          <p className="text-slate-500 text-sm mt-1">Perbarui data dari sumbernya atau unggah matriks KKPRL terbaru.</p>
        </div>
      </div>
      <StatusHitungUlang status={status} onMulai={mulai} />
      {galat && <p className="text-sm text-rose-600">{galat}</p>}
      <UnggahMatriks provinsi={data.matriks} onTerapkan={(d) => { setData(d); setStatus(d.hitung_ulang); }} />
      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Provinsi</th>
              <th className="px-3 py-2 font-semibold">Blok matriks</th>
              <th className="px-3 py-2 font-semibold">Zona laut</th>
              <th className="px-3 py-2 font-semibold">Sumber matriks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.matriks.map((p) => (
              <tr key={p.kode}>
                <td className="px-3 py-1.5 text-slate-700">{p.nama}</td>
                <td className={`px-3 py-1.5 ${p.blok ? '' : 'text-amber-700'}`}>{p.blok || 'belum ada'}</td>
                <td className="px-3 py-1.5">{p.zona_laut}</td>
                <td className="px-3 py-1.5 text-slate-500">{p.sumber || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.kelompok.map((k) => <Kelompok key={k.kode} k={k} onTarik={tarik} proses={proses} />)}
      </div>
    </div>
  );
};

export default AdminPembaruanDataPage;
