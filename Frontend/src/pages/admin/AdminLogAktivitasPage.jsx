import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { api, ambilDaftar } from '../../api/klien';
import { WARNA_AKSI } from '../../utils/konstanta';
import { waktuPanjang } from '../../utils/pemformat';

const AdminLogAktivitasPage = () => {
  const [baris, setBaris] = useState([]);
  const [pilihanAksi, setPilihanAksi] = useState([]);
  const [aksi, setAksi] = useState('all');
  const [cari, setCari] = useState('');
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    api
      .get('/inti/admin/log-aktivitas/pilihan-aksi/')
      .then(({ data }) => setPilihanAksi(Array.isArray(data) ? data : []))
      .catch(() => setPilihanAksi([]));
  }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const params = {};
      if (aksi !== 'all') params.aksi = aksi;
      if (cari.trim()) params.search = cari.trim();
      const { data } = await api.get('/inti/admin/log-aktivitas/', { params });
      setBaris(ambilDaftar(data));
    } catch (e) {
      setGalat(
        e.response?.status === 403
          ? 'Hanya administrator yang dapat membaca jejak audit.'
          : 'Gagal memuat jejak audit.'
      );
    } finally {
      setMemuat(false);
    }
  }, [aksi, cari]);

  useEffect(() => {
    const t = setTimeout(muat, 300);
    return () => clearTimeout(t);
  }, [muat]);

  const jumlahDitolak = baris.filter((b) => b.aksi === 'DITOLAK').length;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-syne">Log Aktivitas Pengguna</h1>
        <p className="text-slate-500 text-sm mt-1">
          Jejak audit: siapa melakukan apa, kapan, dan dari alamat mana. Upaya yang{' '}
          <span className="font-semibold text-red-700">ditolak</span> ikut tercatat — bukan hanya
          yang berhasil.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari pengguna, alamat IP, jalur, atau sasaran…"
            className="w-full bg-white border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-sky-500 text-slate-800"
          />
        </div>

        <select
          value={aksi}
          onChange={(e) => setAksi(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-sky-500 text-slate-600"
        >
          <option value="all">Semua Jenis Aksi</option>
          {pilihanAksi.map((p) => (
            <option key={p.kode} value={p.kode}>{p.label}</option>
          ))}
        </select>

        <button
          onClick={muat}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${memuat ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>

        <div className="text-xs text-slate-500 ml-auto tabular-nums">
          {baris.length} baris
          {jumlahDitolak > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-red-700 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              {jumlahDitolak} ditolak
            </span>
          )}
        </div>
      </div>

      {galat && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
          {galat}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Waktu</th>
                <th className="px-6 py-4">Pengguna</th>
                <th className="px-6 py-4">Aksi</th>
                <th className="px-6 py-4">Sasaran</th>
                <th className="px-6 py-4">Keterangan</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baris.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5 text-slate-500 text-xs whitespace-nowrap tabular-nums">
                    {waktuPanjang(b.waktu)}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={b.nama_pengguna ? 'font-semibold text-slate-900' : 'text-slate-400 italic'}>
                      {b.nama_pengguna || 'tanpa akun'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full whitespace-nowrap ${
                        WARNA_AKSI[b.aksi] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {b.aksi_label || b.aksi}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-700">{b.objek || '-'}</td>
                  <td className="px-6 py-3.5 text-slate-500 text-xs max-w-[22rem]">
                    <div className="truncate" title={b.ringkasan || b.jalur}>
                      {b.ringkasan || '-'}
                    </div>
                    <div className="truncate font-mono text-[10px] text-slate-400" title={b.jalur}>
                      {b.metode} {b.jalur}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span
                      className={`font-mono text-xs font-bold ${
                        b.kode_status >= 400 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {b.kode_status ?? '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{b.alamat_ip || '-'}</td>
                </tr>
              ))}

              {!memuat && baris.length === 0 && !galat && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Tidak ada aktivitas yang cocok dengan penyaring ini.
                  </td>
                </tr>
              )}
              {memuat && baris.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Memuat jejak audit…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
        Pembacaan peta yang berhasil tidak dicatat: lapisan peta menembakkan permintaan setiap kali
        bidang pandang berubah, dan mencatatnya akan menenggelamkan jejak yang penting. Yang dicatat
        adalah permintaan yang mengubah data, pintu masuk dan keluar, serta setiap upaya yang
        ditolak sistem — termasuk pembacaan yang ditolak.
      </p>
    </div>
  );
};

export default AdminLogAktivitasPage;
