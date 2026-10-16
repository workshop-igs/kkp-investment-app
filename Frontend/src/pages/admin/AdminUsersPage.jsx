import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ambilDaftar } from '../../api/klien';
import { useAuth } from '../../context/KonteksAuth';
import {
  UserCheck, UserX, Pencil, Trash2, X, UserPlus, ShieldCheck, Loader2, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const ADMIN_KOSONG = {
  first_name: '', last_name: '', username: '', email: '', instansi: '', password: '', password_ulang: '',
};

const pesanGalat = (err, cadangan) => {
  const data = err.response?.data;
  if (data?.detail) return data.detail;
  const pertama = data && Object.values(data).flat()[0];
  return typeof pertama === 'string' ? pertama : cadangan;
};

const namaTampil = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;

const KELAS_ISIAN = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kkp-700/20 focus:border-kkp-700';

// Sama dengan RENTANG_AKTIF_MENIT di backend (inti/views_admin.py).
const RENTANG_AKTIF_MS = 3 * 60 * 1000;

const terakhirAktif = (iso) => {
  if (!iso) return { teks: 'Belum pernah', aktif: false };
  const selisih = Date.now() - new Date(iso).getTime();
  if (selisih < RENTANG_AKTIF_MS) return { teks: 'Aktif sekarang', aktif: true };
  const menit = Math.floor(selisih / 60000);
  if (menit < 60) return { teks: `${menit} menit lalu`, aktif: false };
  const jam = Math.floor(menit / 60);
  if (jam < 24) return { teks: `${jam} jam lalu`, aktif: false };
  return {
    teks: new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    aktif: false,
  };
};

const isianDari = (u) => ({
  first_name: u.first_name || '',
  last_name: u.last_name || '',
  email: u.email || '',
  instansi: u.profil?.instansi || '',
  telepon: u.profil?.telepon || '',
  provinsi: u.profil?.provinsi ?? '',
  is_active: u.is_active,
});

const Dialog = ({ judul, onTutup, children }) => createPortal(
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={judul}>
    <div className="absolute inset-0 bg-slate-900/50" onClick={onTutup} />
    <div className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-900">{judul}</h2>
        <button onClick={onTutup} className="p-1 text-slate-400 hover:text-slate-700 rounded" aria-label="Tutup">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>,
  document.body,
);

const AdminUsersPage = () => {
  const { user: saya } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [provinsi, setProvinsi] = useState([]);
  const [diedit, setDiedit] = useState(null);
  const [isianEdit, setIsianEdit] = useState({});
  const [galatEdit, setGalatEdit] = useState({});
  const [menyimpanEdit, setMenyimpanEdit] = useState(false);
  const [dihapus, setDihapus] = useState(null);
  const [menghapus, setMenghapus] = useState(false);
  const [galatHapus, setGalatHapus] = useState(null);
  const [error, setError] = useState(null);
  const [formAdmin, setFormAdmin] = useState(false);
  const [isianAdmin, setIsianAdmin] = useState(ADMIN_KOSONG);
  const [galatAdmin, setGalatAdmin] = useState({});
  const [menyimpanAdmin, setMenyimpanAdmin] = useState(false);
  const [berhasil, setBerhasil] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inti/admin/users/');
      setUsers(ambilDaftar(data));
      setError(null);
    } catch (err) {
      setError('Gagal memuat data pengguna. Pastikan Anda memiliki akses admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    api.get('/inti/provinsi/').then(({ data }) => setProvinsi(ambilDaftar(data))).catch(() => {});
  }, []);

  const bukaEdit = (u) => {
    setDiedit(u);
    setIsianEdit(isianDari(u));
    setGalatEdit({});
    setBerhasil(null);
  };

  const simpanEdit = async (e) => {
    e.preventDefault();
    setMenyimpanEdit(true);
    setGalatEdit({});
    const { instansi, telepon, provinsi: idProvinsi, ...akun } = isianEdit;
    try {
      await api.patch(`/inti/admin/users/${diedit.id}/`, {
        ...akun,
        profil: { instansi, telepon, provinsi: idProvinsi === '' ? null : Number(idProvinsi) },
      });
      setBerhasil(`Profil ${namaTampil({ ...diedit, ...akun })} berhasil diperbarui.`);
      setDiedit(null);
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      const rata = data && typeof data === 'object' ? { ...data, ...(data.profil || {}) } : {};
      setGalatEdit(Object.keys(rata).length ? rata : { detail: pesanGalat(err, 'Gagal menyimpan perubahan.') });
    } finally {
      setMenyimpanEdit(false);
    }
  };

  const hapusPengguna = async () => {
    setMenghapus(true);
    setGalatHapus(null);
    try {
      await api.delete(`/inti/admin/users/${dihapus.id}/`);
      setBerhasil(`Akun ${namaTampil(dihapus)} (@${dihapus.username}) telah dihapus.`);
      setDihapus(null);
      fetchUsers();
    } catch (err) {
      setGalatHapus(pesanGalat(err, 'Akun gagal dihapus. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMenghapus(false);
    }
  };

  const medanEdit = (label, medan, props = {}) => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      <input
        name={medan}
        value={isianEdit[medan]}
        onChange={(e) => setIsianEdit((s) => ({ ...s, [medan]: e.target.value }))}
        className={`${KELAS_ISIAN} ${galatEdit[medan] ? 'border-rose-400' : ''}`}
        {...props}
      />
      {galatEdit[medan] && (
        <span className="block mt-1 text-[11px] text-rose-600">{[].concat(galatEdit[medan])[0]}</span>
      )}
    </label>
  );

  const tambahAdmin = async (e) => {
    e.preventDefault();
    setMenyimpanAdmin(true);
    setGalatAdmin({});
    setBerhasil(null);
    try {
      const { data } = await api.post('/inti/admin/users/', isianAdmin);
      setBerhasil(`Akun administrator ${data.username} berhasil ditambahkan.`);
      setIsianAdmin(ADMIN_KOSONG);
      setFormAdmin(false);
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      setGalatAdmin(data && typeof data === 'object' ? data : { detail: 'Akun gagal ditambahkan. Periksa koneksi lalu coba lagi.' });
    } finally {
      setMenyimpanAdmin(false);
    }
  };

  const medanAdmin = (label, medan, props = {}) => (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      <input
        name={medan}
        value={isianAdmin[medan]}
        onChange={(e) => setIsianAdmin((s) => ({ ...s, [medan]: e.target.value }))}
        className={`${KELAS_ISIAN} ${galatAdmin[medan] ? 'border-rose-400' : ''}`}
        {...props}
      />
      {galatAdmin[medan] && (
        <span className="block mt-1 text-[11px] text-rose-600">{[].concat(galatAdmin[medan])[0]}</span>
      )}
    </label>
  );

  if (loading && users.length === 0) return <div className="p-8 text-slate-500 animate-pulse">Memuat data pengguna...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-syne">Manajemen Pengguna</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola akses, peran, dan status akun pengguna platform.</p>
        </div>
        {!formAdmin && (
          <button
            onClick={() => { setFormAdmin(true); setBerhasil(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-kkp-700 hover:bg-kkp-800 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Administrator
          </button>
        )}
      </div>

      {berhasil && (
        <div role="status" className="flex items-center gap-2 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {berhasil}
        </div>
      )}

      {formAdmin && (
        <form onSubmit={tambahAdmin} className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-200">
            <div className="w-9 h-9 rounded-lg bg-kkp-100 text-kkp-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tambah Akun Administrator</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Akses administrator hanya diberikan lewat akun baru yang ditambahkan di sini. Akun yang mendaftar
                sendiri tidak dapat dinaikkan menjadi administrator.
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {medanAdmin('Nama depan *', 'first_name', { required: true, maxLength: 150 })}
              {medanAdmin('Nama belakang', 'last_name', { maxLength: 150 })}
              {medanAdmin('Nama pengguna *', 'username', { required: true, minLength: 3, maxLength: 150, autoComplete: 'off' })}
              {medanAdmin('Surel *', 'email', { required: true, type: 'email', autoComplete: 'off' })}
              <div className="sm:col-span-2">
                {medanAdmin('Instansi / unit kerja', 'instansi', { maxLength: 255, placeholder: 'Kementerian Kelautan dan Perikanan' })}
              </div>
              {medanAdmin('Kata sandi awal *', 'password', { required: true, type: 'password', autoComplete: 'new-password' })}
              {medanAdmin('Ulangi kata sandi awal *', 'password_ulang', { required: true, type: 'password', autoComplete: 'new-password' })}
            </div>
            <p className="text-[11px] text-slate-500">
              Serahkan kata sandi awal langsung kepada pemilik akun dan minta ia menggantinya di halaman Profil Saya
              setelah masuk pertama kali. Kata sandi minimal 8 karakter, tidak seluruhnya angka, dan tidak umum dipakai.
            </p>
            {galatAdmin.detail && (
              <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">
                {galatAdmin.detail}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setFormAdmin(false); setIsianAdmin(ADMIN_KOSONG); setGalatAdmin({}); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={menyimpanAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 bg-kkp-700 hover:bg-kkp-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {menyimpanAdmin && <Loader2 className="w-4 h-4 animate-spin" />}
                Tambahkan Administrator
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-4">Pengguna</th>
                <th className="px-4 py-4">Email</th>
                <th className="px-4 py-4">Peran</th>
                <th className="px-4 py-4">Instansi</th>
                <th className="px-4 py-4">Terakhir Aktif</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-900 whitespace-nowrap">{namaTampil(u)}</div>
                    <div className="text-xs text-slate-400">@{u.username}</div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{u.email}</td>
                  
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      u.is_staff ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {u.is_staff && <ShieldCheck className="w-3 h-3" />}
                      {u.role_display}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4">
                    <span className="text-slate-600 truncate block max-w-[160px]" title={u.profil?.instansi}>
                      {u.profil?.instansi || '-'}
                    </span>
                    {u.provinsi_nama && <span className="text-xs text-slate-400">{u.provinsi_nama}</span>}
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    {(() => {
                      const t = terakhirAktif(u.profil?.terakhir_aktif);
                      return (
                        <span className={`inline-flex items-center gap-1.5 text-xs ${t.aktif ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>
                          {t.aktif && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                          {t.teks}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-4 py-4 text-center">
                    {u.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <UserCheck className="w-4 h-4" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                        <UserX className="w-4 h-4" /> Nonaktif
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => bukaEdit(u)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-sky-700 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Profil
                      </button>
                      <button
                        onClick={() => { setDihapus(u); setGalatHapus(null); setBerhasil(null); }}
                        disabled={u.id === saya?.id}
                        title={u.id === saya?.id ? 'Anda tidak dapat menghapus akun Anda sendiri' : 'Hapus pengguna'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {diedit && (
        <Dialog judul={`Edit Profil — @${diedit.username}`} onTutup={() => setDiedit(null)}>
          <form onSubmit={simpanEdit} className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {medanEdit('Nama depan *', 'first_name', { required: true, maxLength: 150 })}
              {medanEdit('Nama belakang', 'last_name', { maxLength: 150 })}
              <div className="sm:col-span-2">
                {medanEdit('Surel *', 'email', { required: true, type: 'email' })}
              </div>
              <div className="sm:col-span-2">
                {medanEdit('Instansi / unit kerja', 'instansi', { maxLength: 255 })}
              </div>
              {medanEdit('Telepon', 'telepon', { maxLength: 20, type: 'tel' })}
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">Provinsi wilayah kerja</span>
                <select
                  value={isianEdit.provinsi}
                  onChange={(e) => setIsianEdit((s) => ({ ...s, provinsi: e.target.value }))}
                  className={KELAS_ISIAN}
                >
                  <option value="">— Tidak ada —</option>
                  {provinsi.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2 block">
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">Status akun</span>
                <select
                  value={isianEdit.is_active ? 'true' : 'false'}
                  onChange={(e) => setIsianEdit((s) => ({ ...s, is_active: e.target.value === 'true' }))}
                  disabled={diedit.id === saya?.id}
                  className={`${KELAS_ISIAN} disabled:bg-slate-100`}
                >
                  <option value="true">Aktif — dapat masuk ke aplikasi</option>
                  <option value="false">Nonaktif — tidak dapat masuk</option>
                </select>
                {galatEdit.is_active && (
                  <span className="block mt-1 text-[11px] text-rose-600">{[].concat(galatEdit.is_active)[0]}</span>
                )}
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Nama pengguna (@{diedit.username}) dan peran tidak dapat diubah. Kata sandi diganti sendiri oleh pemilik
              akun di halaman Profil Saya.
            </p>
            {galatEdit.detail && (
              <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">
                {[].concat(galatEdit.detail)[0]}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDiedit(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={menyimpanEdit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-kkp-700 hover:bg-kkp-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {menyimpanEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Perubahan
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {dihapus && (
        <Dialog judul="Hapus Pengguna" onTutup={() => !menghapus && setDihapus(null)}>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-sm text-slate-700 space-y-2">
                <p>
                  Hapus akun <b>{namaTampil(dihapus)}</b> (@{dihapus.username}){dihapus.is_staff ? ', seorang administrator' : ''}?
                </p>
                <p className="text-xs text-slate-500">
                  Akun tidak dapat dipulihkan dan pemiliknya tidak bisa masuk lagi. Proyek investasi dan log aktivitas
                  yang pernah dibuat akun ini tetap tersimpan. Bila hanya ingin memblokir sementara, ubah statusnya
                  menjadi Nonaktif melalui Edit Profil.
                </p>
              </div>
            </div>
            {galatHapus && (
              <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">
                {galatHapus}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDihapus(null)}
                disabled={menghapus}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={hapusPengguna}
                disabled={menghapus}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {menghapus && <Loader2 className="w-4 h-4 animate-spin" />}
                Ya, Hapus Akun
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default AdminUsersPage;
