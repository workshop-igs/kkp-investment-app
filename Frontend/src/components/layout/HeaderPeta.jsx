import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, ChevronDown, LogIn, UserPlus, LogOut,
  ShieldCheck, UserRound, KeyRound, X
} from 'lucide-react';
import { useAuth } from '../../context/KonteksAuth';
import { inisialNama } from '../../utils/pemformat';

const BERANDA = { label: 'Beranda', link: '/' };
const PETA = { label: 'Peta Spasial', link: '/peta' };
const PROFIL = { label: 'Profil Investasi', link: '/profil-investasi' };

const MENU_TAMU = [BERANDA, PETA, PROFIL];

const MENU_PENGGUNA = [
  BERANDA,
  { label: 'Dashboard Nasional', link: '/dashboard' },
  { label: 'Proyek Investasi', link: '/pipeline' },
  PETA,
  PROFIL,
];

const ADMIN_MENU = {
  label: 'Administrator',
  link: '/admin',
  icon: ShieldCheck,
  submenus: [
    { label: 'Dashboard Admin', link: '/admin' },
    { label: 'Manajemen Pengguna', link: '/admin/users' },
    { label: 'Proyek Investasi', link: '/admin/pipeline' },
    { label: 'Sumber Data', link: '/admin/data-sources' },
    { label: 'Sektor Investasi', link: '/admin/sectors' },
    { label: 'Pengaturan Analisis', link: '/admin/pengaturan-analisis' },
    { label: 'Parameter Tambahan', link: '/admin/parameter-tambahan' },
  ],
};

const HeaderPeta = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bolehAdmin = Boolean(user?.is_staff);
  const menuItems = useMemo(() => {
    if (!isAuthenticated) return MENU_TAMU;
    return bolehAdmin ? [...MENU_PENGGUNA, ADMIN_MENU] : MENU_PENGGUNA;
  }, [bolehAdmin, isAuthenticated]);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    setAdminMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const handleLogout = useCallback(() => {
    logout();
    setUserMenuOpen(false);
    navigate('/login');
  }, [logout, navigate]);

  return (
    <header className="absolute top-0 left-0 w-full z-50 pointer-events-none">
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs pointer-events-auto h-[72px]"></div>
      
      <div className="relative h-[72px] px-4 lg:px-8 flex items-center justify-between pointer-events-auto max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto">
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/logo-kkp.png" alt="Logo KKP" className="w-11 h-11 object-contain group-hover:scale-105 transition-transform" />
          <div className="flex flex-col">
            <span className="text-slate-900 font-bold text-sm sm:text-base leading-tight tracking-tight font-syne">
              KEMENTERIAN KELAUTAN DAN PERIKANAN
            </span>
            <span className="text-[11px] text-sky-700 font-medium hidden sm:block">
              Platform Manajemen Investasi Ruang Laut
            </span>
          </div>
        </Link>

        <nav data-tur="menu" className="hidden lg:flex items-center gap-1">
          {menuItems.map((item) => (
            item.submenus ? (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setAdminMenuOpen(true)}
                onMouseLeave={() => setAdminMenuOpen(false)}
              >
                <Link
                  to={item.link}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-kkp-700 text-white shadow-2xs font-bold'
                      : 'text-kkp-700 hover:bg-kkp-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                </Link>

                {adminMenuOpen && (
                  <div className="absolute top-full right-0 pt-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 border-t-2 border-t-kkp-700">
                      {item.submenus.map((sub) => (
                        <Link
                          key={sub.link}
                          to={sub.link}
                          onClick={() => setAdminMenuOpen(false)}
                          className={`block px-4 py-2.5 text-xs font-medium transition-colors ${
                            location.pathname === sub.link
                              ? 'bg-kkp-100 text-kkp-800 font-bold'
                              : 'text-slate-700 hover:bg-kkp-100 hover:text-kkp-800'
                          }`}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.link}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                  location.pathname === item.link
                    ? 'bg-kkp-100 text-kkp-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-kkp-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="flex items-center gap-3">
          
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1 pr-2.5 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="w-8 h-8 rounded-full bg-kkp-700 text-white font-bold text-xs flex items-center justify-center">
                  {inisialNama(user)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                    {user.full_name || user.username}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                    {user.role_display}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-4 bg-slate-50 border-b border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-kkp-700 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {inisialNama(user)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{user.full_name || user.username}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user.email || `@${user.username}`}</p>
                      <p className="text-[11px] font-semibold text-kkp-700 truncate mt-0.5">{user.role_display}</p>
                    </div>
                  </div>
                  {user.instansi && (
                    <p className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100 truncate" title={user.instansi}>
                      {user.instansi}
                    </p>
                  )}

                  <div className="p-1.5">
                    <Link
                      to="/profil"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-kkp-100 hover:text-kkp-800 rounded-lg transition-colors"
                    >
                      <UserRound className="w-4 h-4 text-slate-500" />
                      <span>Profil Saya</span>
                    </Link>
                    <Link
                      to="/profil#keamanan"
                      role="menuitem"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-kkp-100 hover:text-kkp-800 rounded-lg transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Ubah Kata Sandi</span>
                    </Link>
                  </div>

                  <div className="p-1.5 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/register"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-sky-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar</span>
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-sky-700/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors`}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-lg border-b border-slate-200 px-6 py-4 space-y-3 pointer-events-auto shadow-xl">
          {menuItems.map((item) => (
            item.submenus ? (
              <div key={item.label} className="pt-2 mt-1 border-t border-slate-100">
                <span className="flex items-center gap-1.5 text-xs font-bold text-kkp-700 uppercase tracking-wider mb-1.5">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </span>
                {item.submenus.map((sub) => (
                  <Link
                    key={sub.link}
                    to={sub.link}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block pl-5 py-1.5 text-sm font-medium text-slate-600 hover:text-kkp-700"
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.link}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-semibold text-slate-700 hover:text-kkp-700 py-1.5"
              >
                {item.label}
              </Link>
            )
          ))}

          <div className="flex flex-col gap-2 pt-3 border-t border-slate-200">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 bg-sky-700 text-white rounded-xl text-xs font-bold"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold"
                >
                  Daftar Akun Baru
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/profil"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold"
                >
                  Profil Saya
                </Link>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-center py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold"
                >
                  Keluar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default React.memo(HeaderPeta);
