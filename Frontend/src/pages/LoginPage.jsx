import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LogIn, User, Lock, Eye, EyeOff, 
  ArrowLeft, CheckCircle2, AlertCircle, Sparkles, 
  Building2, ArrowRight,
  Globe, Compass, Check
} from 'lucide-react';
import { useAuth } from '../context/KonteksAuth';

const DEMO_ACCOUNTS = [
  {
    username: 'analis_kkp',
    name: 'Budi Santoso, M.Si',
    role: 'Analis Kelautan KKP',
    instansi: 'Ditjen Pengelolaan Ruang Laut (DJPRL)',
    icon: Building2,
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200'
  },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, demoLogin, loading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
      setError('Harap masukkan username/email dan kata sandi.');
      return;
    }

    try {
      const res = await login(username, password);
      setSuccessMsg(`Selamat datang, ${res.user.full_name}! Mengalihkan ke dashboard...`);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 700);
    } catch (err) {
      setError(err.message || 'Gagal masuk. Periksa kembali username dan kata sandi Anda.');
    }
  };

  const handleQuickDemo = async (demoUsername) => {
    setError(null);
    setSuccessMsg(null);
    setUsername(demoUsername);
    setPassword('password123');

    try {
      const res = await demoLogin(demoUsername);
      setSuccessMsg(`Login berhasil sebagai ${res.user.full_name}! Mengalihkan...`);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 700);
    } catch (err) {
      setError(err.message || 'Demo login gagal.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100 relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8">
      
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/60 via-slate-900 to-slate-950 pointer-events-none"></div>
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 -right-48 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="absolute top-6 left-6 z-20">
        <Link 
          to="/peta" 
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold backdrop-blur-md transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Peta Spasial</span>
        </Link>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 my-auto pt-14 lg:pt-0">
        
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-sky-950/80 via-slate-900/80 to-slate-950/90 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-3.5 mb-8">
              <img src="/logo-kkp.png" alt="Logo KKP" className="w-12 h-12 object-contain" />
              <div>
                <span className="text-white font-bold text-sm leading-tight tracking-wider block font-syne">
                  KEMENTERIAN KELAUTAN
                </span>
                <span className="text-sky-400 text-xs font-medium">
                  DAN PERIKANAN REPUBLIK INDONESIA
                </span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold font-syne text-white tracking-tight leading-snug mb-3">
              Platform Manajemen Investasi Ruang Laut
            </h2>
            
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              Sistem terpadu evaluasi kelayakan spasial dan finansial investasi ruang laut Indonesia.
            </p>

            <div className="space-y-3.5">
              {[
                { title: 'Analisis Spasial Multi-Kriteria (MCDA)', desc: 'Validasi otomatis kesesuaian RZWP-3-K dan izin KKPRL.' },
                { title: 'Kalkulator Finansial DCF 20 Tahun', desc: 'Estimasi arus kas, NPV, IRR, dan analisis sensitivitas pasar.' },
                { title: 'Proyek Investasi Nasional', desc: 'Pemantauan proyek ruang laut dari perencanaan sampai beroperasi.' },
              ].map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white/5 border border-white/5 p-3 rounded-2xl">
                  <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">{feat.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Sistem Informasi Terenkripsi SSL</span>
            <span className="text-teal-400 font-semibold font-mono">v1.0.0 Live</span>
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 sm:py-10 shadow-2xl text-slate-800 border border-slate-100 flex flex-col justify-between">
          
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold font-syne text-slate-900">
                  Masuk ke Akun Anda
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Masukkan kredensial Anda untuk mengakses dashboard dan pipeline.
                </p>
              </div>

              <Link
                to="/register"
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 transition-colors flex items-center gap-1"
              >
                <span>Daftar Akun Baru</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{successMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Username atau Alamat Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: analis_kkp atau nama@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kata Sandi (Password)
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); alert('Untuk reset kata sandi, silakan hubungi administrator sistem KKP.'); }} className="text-[11px] font-semibold text-sky-600 hover:text-sky-700">
                    Lupa kata sandi?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-kkp-700"
                  />
                  <span>Ingat saya di perangkat ini</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-sky-700/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Akun</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {import.meta.env.DEV && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Uji Coba Cepat (Akun Demo KKP):
              </span>
              <span className="text-[10px] text-slate-400">1-Click Login</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleQuickDemo(acc.username)}
                    className="flex items-center gap-2.5 p-2.5 text-left rounded-xl bg-slate-50 hover:bg-sky-50/80 border border-slate-200 hover:border-sky-300 transition-all group shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-sky-700 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-sky-900">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {acc.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default LoginPage;
