import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';
import { api } from '../api/klien';
import { useAutentikasi } from '../context/KonteksAutentikasi';

const KOSONG = { sandi_lama: '', sandi_baru: '', sandi_ulang: '' };

const MEDAN = [
  ['sandi_lama', 'Kata sandi saat ini', 'current-password', 'Kata sandi yang Anda pakai untuk masuk tadi.'],
  ['sandi_baru', 'Kata sandi baru', 'new-password', 'Minimal 8 karakter, tidak seluruhnya angka, dan tidak mirip nama pengguna.'],
  ['sandi_ulang', 'Ulangi kata sandi baru', 'new-password', null],
];

const GantiSandiWajib = () => {
  const { user, perbaruiUser, logout } = useAutentikasi();
  const [isian, setIsian] = useState(KOSONG);
  const [galat, setGalat] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [terlihat, setTerlihat] = useState({});

  if (!user?.wajib_ganti_sandi) return null;

  const simpan = async (e) => {
    e.preventDefault();
    setMenyimpan(true);
    setGalat(null);
    try {
      await api.post('/inti/auth/ganti-sandi/', isian);
      setIsian(KOSONG);
      perbaruiUser({ ...user, wajib_ganti_sandi: false });
    } catch (err) {
      setGalat(err.response?.data?.detail || 'Kata sandi gagal diganti. Periksa koneksi lalu coba lagi.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center overflow-y-auto bg-kkp-900/95 p-4" role="dialog" aria-modal="true" aria-label="Buat kata sandi baru">
      <form onSubmit={simpan} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kkp-100 text-kkp-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Buat kata sandi baru</h2>
            <p className="mt-1 text-sm text-slate-600">
              Administrator meminta akun <b>@{user.username}</b> memakai kata sandi baru. Buat kata sandi yang hanya
              Anda ketahui sebelum melanjutkan.
            </p>
          </div>
        </div>
        {MEDAN.map(([medan, label, isiOtomatis, catatan]) => (
          <div key={medan}>
            <label htmlFor={`wajib-${medan}`} className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
            <div className="relative">
              <input
                id={`wajib-${medan}`}
                type={terlihat[medan] ? 'text' : 'password'}
                name={medan}
                value={isian[medan]}
                onChange={(e) => setIsian((s) => ({ ...s, [medan]: e.target.value }))}
                autoComplete={isiOtomatis}
                required
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-kkp-700 focus:outline-none focus:ring-2 focus:ring-kkp-700/20"
              />
              <button
                type="button"
                onClick={() => setTerlihat((s) => ({ ...s, [medan]: !s[medan] }))}
                aria-label={terlihat[medan] ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {terlihat[medan] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {catatan && <span className="mt-1 block text-[11px] text-slate-500">{catatan}</span>}
          </div>
        ))}
        {galat && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{galat}</div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
          <button
            type="submit"
            disabled={menyimpan}
            className="inline-flex items-center gap-2 rounded-lg bg-kkp-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kkp-800 disabled:opacity-50"
          >
            {menyimpan && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan dan Lanjutkan
          </button>
        </div>
      </form>
    </div>
  );
};

export default GantiSandiWajib;
