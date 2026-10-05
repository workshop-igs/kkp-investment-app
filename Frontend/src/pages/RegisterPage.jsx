import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  UserPlus, User, Mail, Lock, Eye, EyeOff, 
  Building2, Phone, ArrowLeft, CheckCircle2,
  AlertCircle, Globe
} from 'lucide-react';
import { useAuth } from '../context/KonteksAuth';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, loading } = useAuth();

  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    instansi: '',
    telepon: '',
    agree_terms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.full_name.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!formData.username.trim() || formData.username.length < 3) {
      setError('Username minimal 3 karakter tanpa spasi.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Alamat email valid wajib diisi.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!formData.agree_terms) {
      setError('Anda harus menyetujui syarat & ketentuan penggunaan platform.');
      return;
    }

    try {
      const res = await register({
        full_name: formData.full_name,
        username: formData.username.toLowerCase(),
        email: formData.email.toLowerCase(),
        password: formData.password,
        instansi: formData.instansi,
        telepon: formData.telepon
      });

      setSuccessMsg(`Pendaftaran berhasil! Selamat datang, ${res.user.full_name}. Mengalihkan...`);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 900);
    } catch (err) {
      setError(err.message || 'Pendaftaran akun gagal. Silakan coba lagi.');
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full flex bg-white font-sans overflow-hidden">
      
      <div className="hidden lg:flex lg:w-5/12 relative bg-slate-900 flex-col justify-between p-12 overflow-x-hidden overflow-y-auto shadow-2xl z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-sky-900 via-slate-900 to-slate-950"></div>
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-sky-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/4 -right-24 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col items-start">
          <Link to="/peta" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sky-200 hover:text-white transition-all text-sm font-medium mb-12 border border-white/10 backdrop-blur-sm">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Peta
          </Link>
          
          <img src="/logo-kkp.png" alt="Logo KKP" className="w-20 h-20 object-contain mb-8 drop-shadow-xl" />
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight font-syne tracking-tight">
            Platform Investasi <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-300">Ruang Laut</span>
          </h1>
          <div className="w-12 h-1 bg-sky-500 rounded-full mb-6"></div>
          <p className="text-slate-300 text-lg leading-relaxed max-w-md font-light">
            Kementerian Kelautan dan Perikanan <br/>
            Republik Indonesia
          </p>
        </div>

        <div className="relative z-10">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
            <p className="text-slate-300 text-sm leading-relaxed italic">
              "Mewujudkan tata kelola ruang laut yang berkelanjutan untuk kesejahteraan bangsa dan kelestarian ekosistem maritim."
            </p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-7/12 h-screen overflow-y-auto bg-slate-50/50">
        <div className="min-h-full flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
          
          <div className="lg:hidden mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo-kkp.png" alt="Logo KKP" className="w-10 h-10 object-contain" />
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-900">KKP RI</div>
                <div className="text-[10px] text-slate-500">Investasi Ruang Laut</div>
              </div>
            </div>
            <Link to="/peta" className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>

          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2 font-syne tracking-tight">Pendaftaran Akun</h2>
              <p className="text-slate-500 text-sm">Lengkapi data di bawah ini untuk mengakses platform KKP.</p>
            </div>
            <div className="hidden sm:block text-sm text-right">
              <span className="text-slate-500">Sudah punya akun?</span><br/>
              <Link to="/login" className="font-bold text-sky-600 hover:text-sky-700 underline decoration-2 underline-offset-4">Masuk di sini</Link>
            </div>
          </div>

          {error && (
            <div className="mb-8 p-4 rounded-xl bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-sm flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-8 p-4 rounded-xl bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-sm flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold text-xs">1</div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Data Pribadi & Instansi</h3>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      placeholder="Contoh: Dr. Budi Santoso"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Alamat Email Resmi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="nama@instansi.co.id"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Username Akun <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="contoh: budi_kkp"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nomor Telepon / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      name="telepon"
                      value={formData.telepon}
                      onChange={handleChange}
                      placeholder="Contoh: 081234567890"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Perusahaan / Instansi / Lembaga
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      name="instansi"
                      value={formData.instansi}
                      onChange={handleChange}
                      placeholder="Contoh: PT Samudera Biru Nusantara / Dinas Kelautan Provinsi Bali"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold text-xs">2</div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Keamanan Akun</h3>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimal 6 karakter"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Konfirmasi Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      placeholder="Ulangi kata sandi"
                      required
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:bg-white transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="bg-sky-50/50 border border-sky-100 p-5 rounded-2xl">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    name="agree_terms"
                    checked={formData.agree_terms}
                    onChange={handleChange}
                    className="w-5 h-5 appearance-none border-2 border-sky-300 rounded-md checked:bg-sky-500 checked:border-sky-500 focus:outline-none focus:ring-2 focus:ring-kkp-700 focus:ring-offset-1 transition-all cursor-pointer peer"
                  />
                  <CheckCircle2 className="w-3.5 h-3.5 text-white absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                  Saya menyatakan bahwa data yang diisi adalah benar, dan menyetujui seluruh 
                  <a href="#" className="font-bold text-sky-600 hover:underline mx-1">Syarat & Ketentuan</a> 
                  serta kebijakan perlindungan data geospasial Kementerian Kelautan dan Perikanan RI.
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex-1 py-3.5 px-8 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-sm transition-all shadow-[0_8px_20px_rgba(2,132,199,0.25)] hover:shadow-[0_8px_25px_rgba(2,132,199,0.35)] hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memproses Data...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Daftar Akun Sekarang
                  </>
                )}
              </button>
              
              <div className="w-full sm:w-auto text-center sm:hidden text-sm mt-4">
                <span className="text-slate-500">Sudah punya akun?</span>{' '}
                <Link to="/login" className="font-bold text-sky-600">Masuk</Link>
              </div>
            </div>

          </form>
          
          <div className="mt-12 text-center text-[11px] text-slate-400">
            &copy; {new Date().getFullYear()} Kementerian Kelautan dan Perikanan Republik Indonesia
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
