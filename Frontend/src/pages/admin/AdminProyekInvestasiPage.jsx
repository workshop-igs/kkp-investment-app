import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertTriangle, Edit2, Loader2, Map as IkonPeta, MapPin, Search, Trash2, X } from 'lucide-react';
import { api, ambilDaftar } from '../../api/klien';
import { labelKbli, rupiahMiliar } from '../../utils/pemformat';
import { LABEL_TAHAPAN, TAHAPAN_PROYEK } from '../../utils/konstanta';

const KELAS_ISIAN = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kkp-700/20 focus:border-kkp-700';
const KELAS_SARING = 'bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-sky-500 text-slate-700';

const pesanGalat = (err, cadangan) => {
  const data = err.response?.data;
  if (data?.detail) return data.detail;
  const pertama = data && Object.entries(data)[0];
  return pertama ? `${pertama[0]}: ${[pertama[1]].flat()[0]}` : cadangan;
};

const Dialog = ({ judul, onTutup, children, lebar = 'max-w-lg' }) => createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={judul}>
    <div className="absolute inset-0 bg-slate-900/50" onClick={onTutup} />
    <div className={`relative w-full ${lebar} max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl`}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
        <h2 className="font-bold text-slate-900">{judul}</h2>
        <button type="button" onClick={onTutup} aria-label="Tutup" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>,
  document.body,
);

const isianDari = (p) => ({
  nama: p.nama || '',
  deskripsi: p.deskripsi || '',
  investor: p.investor || '',
  sektor: p.sektor ?? '',
  sub_sektor: p.sub_sektor || '',
  provinsi: p.provinsi ?? '',
  kabupaten_kota: p.kabupaten_kota ?? '',
  lokasi_detail: p.lokasi_detail || '',
  nilai_investasi_miliar: p.nilai_investasi_miliar ?? 0,
  nilai_realisasi_miliar: p.nilai_realisasi_miliar ?? 0,
  status: p.status,
  progress_pct: p.progress_pct ?? 0,
  tanggal_mulai: p.tanggal_mulai || '',
  tanggal_target_selesai: p.tanggal_target_selesai || '',
  proyeksi_tenaga_kerja: p.proyeksi_tenaga_kerja ?? 0,
  realisasi_tenaga_kerja: p.realisasi_tenaga_kerja ?? 0,
});

const UbahProyek = ({ proyek, sektor, provinsi, onTutup, onSelesai }) => {
  const [isian, setIsian] = useState(() => isianDari(proyek));
  const [kabupaten, setKabupaten] = useState([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    if (!isian.provinsi) { setKabupaten([]); return; }
    api.get('/inti/kabupaten-kota/', { params: { provinsi: isian.provinsi, page_size: 100 } })
      .then(({ data }) => setKabupaten(ambilDaftar(data)))
      .catch(() => setKabupaten([]));
  }, [isian.provinsi]);

  const atur = (medan, nilai) => setIsian((s) => ({ ...s, [medan]: nilai }));
  const subJenis = sektor.find((s) => String(s.id) === String(isian.sektor))?.sub_jenis || [];

  const simpan = async (e) => {
    e.preventDefault();
    setMenyimpan(true);
    setGalat(null);
    const kosongJadiNull = (v) => (v === '' ? null : v);
    try {
      await api.patch(`/inti/admin/proyek/${proyek.id}/`, {
        ...isian,
        sektor: kosongJadiNull(isian.sektor),
        provinsi: kosongJadiNull(isian.provinsi),
        kabupaten_kota: kosongJadiNull(isian.kabupaten_kota),
        tanggal_mulai: kosongJadiNull(isian.tanggal_mulai),
        tanggal_target_selesai: kosongJadiNull(isian.tanggal_target_selesai),
      });
      onSelesai(`Proyek ${isian.nama} berhasil diperbarui.`);
    } catch (err) {
      setGalat(pesanGalat(err, 'Gagal menyimpan perubahan.'));
      setMenyimpan(false);
    }
  };

  const medan = (label, nama, props = {}) => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      <input value={isian[nama]} onChange={(e) => atur(nama, e.target.value)} className={KELAS_ISIAN} {...props} />
    </label>
  );
  const pilihan = (label, nama, opsi, props = {}) => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      <select value={isian[nama]} onChange={(e) => atur(nama, e.target.value)} className={KELAS_ISIAN} {...props}>
        {opsi}
      </select>
    </label>
  );

  return (
    <Dialog judul={`Ubah Proyek ${proyek.nama}`} onTutup={() => !menyimpan && onTutup()} lebar="max-w-3xl">
      <form onSubmit={simpan} className="p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{medan('Nama proyek', 'nama', { required: true, maxLength: 255 })}</div>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi</span>
            <textarea value={isian.deskripsi} onChange={(e) => atur('deskripsi', e.target.value)} rows={3} className={KELAS_ISIAN} />
          </label>
          {medan('Investor', 'investor', { maxLength: 255 })}
          {pilihan('Tahap', 'status', TAHAPAN_PROYEK.map((t) => <option key={t.kode} value={t.kode}>{t.label}</option>))}
          {pilihan('Jenis investasi', 'sektor', [
            <option key="" value="">Tanpa jenis</option>,
            ...sektor.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>),
          ], { onChange: (e) => setIsian((s) => ({ ...s, sektor: e.target.value, sub_sektor: '' })) })}
          {pilihan('Sub-jenis', 'sub_sektor', [
            <option key="" value="">Tanpa sub-jenis</option>,
            ...subJenis.map((s) => <option key={s.kode} value={s.kode}>{s.nama}{s.kbli ? ` (KBLI ${s.kbli.kode})` : ''}</option>),
          ], { disabled: !subJenis.length })}
          {pilihan('Provinsi', 'provinsi', [
            <option key="" value="">Belum ditentukan</option>,
            ...provinsi.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>),
          ], { onChange: (e) => setIsian((s) => ({ ...s, provinsi: e.target.value, kabupaten_kota: '' })) })}
          {pilihan('Kabupaten/kota', 'kabupaten_kota', [
            <option key="" value="">Belum ditentukan</option>,
            ...kabupaten.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>),
          ], { disabled: !isian.provinsi })}
          <div className="sm:col-span-2">{medan('Detail lokasi', 'lokasi_detail', { maxLength: 255 })}</div>
          {medan('Nilai rencana (Rp miliar)', 'nilai_investasi_miliar', { type: 'number', min: 0, step: 'any' })}
          {medan('Nilai realisasi (Rp miliar)', 'nilai_realisasi_miliar', { type: 'number', min: 0, step: 'any' })}
          {medan('Tanggal mulai', 'tanggal_mulai', { type: 'date' })}
          {medan('Target selesai', 'tanggal_target_selesai', { type: 'date' })}
          {medan('Progres (%)', 'progress_pct', { type: 'number', min: 0, max: 100, step: 'any' })}
          <div />
          {medan('Proyeksi tenaga kerja (orang)', 'proyeksi_tenaga_kerja', { type: 'number', min: 0, step: 1 })}
          {medan('Realisasi tenaga kerja (orang)', 'realisasi_tenaga_kerja', { type: 'number', min: 0, step: 1 })}
        </div>
        <p className="text-xs text-slate-500">Batas lokasi (poligon) diubah dari halaman detail proyek.</p>
        {galat && <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">{galat}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onTutup} disabled={menyimpan} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Batal
          </button>
          <button type="submit" disabled={menyimpan} className="inline-flex items-center gap-2 px-4 py-2 bg-kkp-700 hover:bg-kkp-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {menyimpan && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </Dialog>
  );
};

const HapusProyek = ({ proyek, onTutup, onSelesai }) => {
  const [menghapus, setMenghapus] = useState(false);
  const [galat, setGalat] = useState(null);

  const hapus = async () => {
    setMenghapus(true);
    setGalat(null);
    try {
      await api.delete(`/inti/admin/proyek/${proyek.id}/`);
      onSelesai(`Proyek ${proyek.nama} telah dihapus.`);
    } catch (err) {
      setGalat(pesanGalat(err, 'Proyek gagal dihapus. Periksa koneksi lalu coba lagi.'));
      setMenghapus(false);
    }
  };

  return (
    <Dialog judul="Hapus Proyek" onTutup={() => !menghapus && onTutup()}>
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-600 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
          <div className="text-sm text-slate-700 space-y-2">
            <p>Hapus proyek <b>{proyek.nama}</b> ({labelKbli(proyek.sub_sektor_kbli)})?</p>
            <p className="text-xs text-slate-500">
              Proyek beserta riwayat tahapnya terhapus permanen dan hilang dari daftar Proyek Investasi, dashboard, dan peta.
            </p>
          </div>
        </div>
        {galat && <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">{galat}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onTutup} disabled={menghapus} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Batal
          </button>
          <button type="button" onClick={hapus} disabled={menghapus} className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {menghapus && <Loader2 className="w-4 h-4 animate-spin" />}
            Ya, Hapus Proyek
          </button>
        </div>
      </div>
    </Dialog>
  );
};

const AdminProyekInvestasiPage = () => {
  const [projects, setProjects] = useState([]);
  const [sektor, setSektor] = useState([]);
  const [provinsi, setProvinsi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [diedit, setDiedit] = useState(null);
  const [dihapus, setDihapus] = useState(null);
  const [berhasil, setBerhasil] = useState(null);
  const [saring, setSaring] = useState({ cari: '', status: '', sektor: '', provinsi: '' });

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inti/admin/proyek/');
      setProjects(ambilDaftar(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    api.get('/inti/admin/sektor/').then(({ data }) => setSektor(ambilDaftar(data))).catch(() => {});
    api.get('/inti/provinsi/').then(({ data }) => setProvinsi(ambilDaftar(data))).catch(() => {});
  }, []);

  const selesai = (pesan) => {
    setDiedit(null);
    setDihapus(null);
    setBerhasil(pesan);
    fetchProjects();
  };

  const tersaring = useMemo(() => {
    const kata = saring.cari.trim().toLowerCase();
    return projects.filter((p) =>
      (!kata || [p.nama, p.sub_sektor_kbli?.kode, p.investor, p.investor_nama].some((t) => t?.toLowerCase().includes(kata)))
      && (!saring.status || p.status === saring.status)
      && (!saring.sektor || String(p.sektor) === saring.sektor)
      && (!saring.provinsi || String(p.provinsi) === saring.provinsi));
  }, [projects, saring]);

  const total = (medan) => tersaring.reduce((n, p) => n + (Number(p[medan]) || 0), 0);
  const aturSaring = (medan) => (e) => setSaring((s) => ({ ...s, [medan]: e.target.value }));

  if (loading && projects.length === 0) return <div className="p-8 text-slate-500">Memuat daftar proyek...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Proyek Investasi</h1>
        <p className="text-slate-500 text-sm mt-1">Ubah data, tahap, dan realisasi proyek, atau hapus proyek yang tidak diperlukan.</p>
      </div>

      {berhasil && (
        <div role="status" className="flex items-center justify-between gap-2 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm">
          {berhasil}
          <button type="button" onClick={() => setBerhasil(null)} aria-label="Tutup" className="p-1 rounded hover:bg-emerald-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Proyek', tersaring.length.toLocaleString('id-ID')],
          ['Nilai rencana', rupiahMiliar(total('nilai_investasi_miliar'))],
          ['Nilai realisasi', rupiahMiliar(total('nilai_realisasi_miliar'))],
        ].map(([label, nilai]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{nilai}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={saring.cari}
            onChange={aturSaring('cari')}
            placeholder="Cari nama proyek, kode KBLI, atau investor…"
            className="w-full bg-white border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-sky-500 text-slate-800"
          />
        </div>
        <select value={saring.status} onChange={aturSaring('status')} className={KELAS_SARING} aria-label="Saring tahap">
          <option value="">Semua tahap</option>
          {TAHAPAN_PROYEK.map((t) => <option key={t.kode} value={t.kode}>{t.label}</option>)}
        </select>
        <select value={saring.sektor} onChange={aturSaring('sektor')} className={KELAS_SARING} aria-label="Saring jenis investasi">
          <option value="">Semua jenis</option>
          {sektor.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
        <select value={saring.provinsi} onChange={aturSaring('provinsi')} className={KELAS_SARING} aria-label="Saring provinsi">
          <option value="">Semua provinsi</option>
          {provinsi.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Proyek & Jenis</th>
                <th className="px-6 py-4">Investor</th>
                <th className="px-6 py-4">Rencana</th>
                <th className="px-6 py-4">Realisasi</th>
                <th className="px-6 py-4">Tahap</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tersaring.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{p.nama}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{labelKbli(p.sub_sektor_kbli)} • {p.sektor_nama || 'Tanpa jenis'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">{p.investor || p.investor_nama || '-'}</div>
                    <div className="text-[11px] flex items-center gap-1 text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" /> {p.provinsi_nama || 'Provinsi belum ditentukan'}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono whitespace-nowrap">{rupiahMiliar(p.nilai_investasi_miliar)}</td>
                  <td className="px-6 py-4 font-mono font-medium text-teal-600 whitespace-nowrap">{rupiahMiliar(p.nilai_realisasi_miliar)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-full">
                      {LABEL_TAHAPAN[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Link to={`/pipeline/${p.id}`} title="Lihat lokasi di peta" className="p-1.5 text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100">
                        <IkonPeta className="w-4 h-4" />
                      </Link>
                      <button type="button" onClick={() => { setDiedit(p); setBerhasil(null); }} title="Ubah proyek" className="p-1.5 text-sky-600 bg-sky-50 rounded hover:bg-sky-100">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => { setDihapus(p); setBerhasil(null); }} title="Hapus proyek" className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tersaring.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    {projects.length ? 'Tidak ada proyek yang cocok dengan penyaring ini.' : 'Belum ada proyek investasi.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {diedit && (
        <UbahProyek key={diedit.id} proyek={diedit} sektor={sektor} provinsi={provinsi} onTutup={() => setDiedit(null)} onSelesai={selesai} />
      )}
      {dihapus && <HapusProyek key={dihapus.id} proyek={dihapus} onTutup={() => setDihapus(null)} onSelesai={selesai} />}
    </div>
  );
};

export default AdminProyekInvestasiPage;
