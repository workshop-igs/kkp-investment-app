import { useEffect, useState } from 'react';
import { api, ambilDaftar } from '../../api/klien';
import { UserCheck, UserX, Edit2, Check, X, UserPlus, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';

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

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
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
  }, []);

  const handleEditClick = (user) => {
    setEditingId(user.id);
    setEditForm({
      is_active: user.is_active,
      instansi: user.profil?.instansi || ''
    });
  };

  const handleSave = async (userId) => {
    try {
      await api.patch(`/inti/admin/users/${userId}/`, {
        is_active: editForm.is_active,
        profil: {
          instansi: editForm.instansi
        }
      });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      alert(pesanGalat(err, 'Gagal menyimpan perubahan.'));
    }
  };

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
                <th className="px-6 py-4">Pengguna</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Peran</th>
                <th className="px-6 py-4">Instansi</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{namaTampil(u)}</div>
                    <div className="text-xs text-slate-400">@{u.username}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{u.email}</td>
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      u.is_staff ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {u.is_staff && <ShieldCheck className="w-3 h-3" />}
                      {u.role_display}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingId === u.id ? (
                      <input 
                        type="text" 
                        value={editForm.instansi}
                        onChange={(e) => setEditForm({...editForm, instansi: e.target.value})}
                        className="px-2 py-1.5 border rounded-lg text-sm w-full"
                      />
                    ) : (
                      <span className="text-slate-600 truncate block max-w-[150px]" title={u.profil?.instansi}>
                        {u.profil?.instansi || '-'}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {editingId === u.id ? (
                      <select 
                        value={editForm.is_active ? 'true' : 'false'}
                        onChange={(e) => setEditForm({...editForm, is_active: e.target.value === 'true'})}
                        className="px-2 py-1.5 border rounded-lg text-sm bg-white"
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
                    ) : (
                      u.is_active ? 
                        <UserCheck className="w-5 h-5 text-emerald-500 mx-auto" /> : 
                        <UserX className="w-5 h-5 text-rose-500 mx-auto" />
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {editingId === u.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleSave(u.id)} className="p-1.5 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-500 bg-slate-100 rounded hover:bg-slate-200">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditClick(u)} className="p-1.5 text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersPage;
