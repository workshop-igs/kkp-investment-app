import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, ChevronDown, LogIn, UserPlus, LogOut, ShieldCheck, UserRound, KeyRound, X,
  Home, LayoutDashboard, BriefcaseBusiness, Map as IkonPeta, FileText,
} from 'lucide-react';
import { useAuth } from '../../context/KonteksAuth';
import { inisialNama } from '../../utils/pemformat';

const BERANDA = { label: 'Beranda', link: '/', ikon: Home };
const PETA = { label: 'Peta Spasial', link: '/peta', ikon: IkonPeta };
const PROFIL = { label: 'Profil Investasi', link: '/profil-investasi', ikon: FileText };

const MENU_TAMU = [BERANDA, PETA, PROFIL];

const MENU_PENGGUNA = [
  BERANDA,
  { label: 'Dashboard Nasional', link: '/dashboard', ikon: LayoutDashboard },
  { label: 'Proyek Investasi', link: '/pipeline', ikon: BriefcaseBusiness },
  PETA,
  PROFIL,
];

const ADMIN_MENU = {
  label: 'Administrator',
  link: '/admin',
  ikon: ShieldCheck,
  submenus: [
    { label: 'Dashboard Admin', link: '/admin' },
    { label: 'Manajemen Pengguna', link: '/admin/users' },
    { label: 'Proyek Investasi', link: '/admin/pipeline' },
    { label: 'Sektor Investasi', link: '/admin/sectors' },
    { label: 'Pengaturan Analisis', link: '/admin/pengaturan-analisis' },
    { label: 'Parameter Tambahan', link: '/admin/parameter-tambahan' },
  ],
};

const UBIN = 'rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_6px_20px_-12px_rgba(0,34,66,0.45)] backdrop-blur-md';
const FOKUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kkp-700/40';

const kelasMenu = (aktif) => `flex h-10 items-center gap-2 whitespace-nowrap rounded-xl px-2.5 2xl:px-3.5 text-[13px] 2xl:text-sm font-semibold transition-colors ${FOKUS} ${
  aktif ? 'bg-kkp-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-kkp-800'
}`;

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
  const diPeta = location.pathname === '/peta';
  const aktif = (item) => (item.submenus ? location.pathname.startsWith('/admin') : location.pathname === item.link);
  const sembunyiKecil = isAuthenticated ? 'xl:hidden' : 'lg:hidden';

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
      {!diPeta && (
        <div className="absolute inset-x-0 top-0 h-[72px] bg-white/85 backdrop-blur-md border-b border-slate-200/70 pointer-events-auto" />
      )}

      <div className="relative h-[72px] px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-3 max-w-[1800px] mx-auto">
        <Link
          to="/"
          className={`pointer-events-auto flex min-w-0 items-center gap-2.5 group ${FOKUS} ${diPeta ? `${UBIN} py-1.5 pl-1.5 pr-3.5` : 'rounded-xl'}`}
        >
          <img src="/logo-kkp.png" alt="Logo KKP" className="w-10 h-10 shrink-0 object-contain group-hover:scale-105 transition-transform" />
          <div className="flex min-w-0 flex-col">
            <span className="text-kkp-900 font-bold text-sm sm:text-base xl:text-sm 2xl:text-base leading-tight tracking-tight md:whitespace-nowrap">
              KEMENTERIAN KELAUTAN DAN PERIKANAN
            </span>
            <span className="text-[11px] text-kkp-700 font-medium hidden sm:block whitespace-nowrap">
              Platform Manajemen Investasi Ruang Laut
            </span>
          </div>
        </Link>

        <nav
          data-tur="menu"
          className={`${isAuthenticated ? 'hidden xl:flex' : 'hidden lg:flex'} pointer-events-auto items-center gap-0.5 p-1 ${
            diPeta ? UBIN : 'rounded-2xl border border-slate-200/70 bg-slate-100/80'
          }`}
        >
          {menuItems.map((item) => (
            item.submenus ? (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => setAdminMenuOpen(true)}
                onMouseLeave={() => setAdminMenuOpen(false)}
              >
                <Link to={item.link} className={kelasMenu(aktif(item))}>
                  <item.ikon className="w-4 h-4 shrink-0" />
                  {item.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} />
                </Link>

                {adminMenuOpen && (
                  <div className="absolute top-full right-0 pt-2 z-50">
                    <div className="w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5">
                      {item.submenus.map((sub) => (
                        <Link
                          key={sub.link}
                          to={sub.link}
                          onClick={() => setAdminMenuOpen(false)}
                          className={`block rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            location.pathname === sub.link
                              ? 'bg-kkp-100 text-kkp-800 font-bold'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-kkp-800'
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
              <Link key={item.label} to={item.link} className={kelasMenu(aktif(item))} aria-current={aktif(item) ? 'page' : undefined}>
                <item.ikon className="w-4 h-4 shrink-0 hidden 2xl:block" />
                {item.label}
              </Link>
            )
          ))}
        </nav>

        <div className="pointer-events-auto flex items-center gap-2">
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className={`flex h-12 items-center gap-2.5 pl-1.5 pr-2.5 transition-colors ${FOKUS} ${
                  diPeta ? `${UBIN} hover:bg-white` : 'rounded-2xl hover:bg-slate-100'
                }`}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label="Menu akun"
              >
                <div className="w-9 h-9 rounded-xl bg-kkp-800 text-white font-bold text-xs flex items-center justify-center">
                  {inisialNama(user)}
                </div>
                <div className="text-left hidden sm:block xl:hidden min-[1760px]:block">
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
                <div role="menu" className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-kkp-800 text-white font-bold text-sm flex items-center justify-center shrink-0">
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
            <div className={`flex items-center gap-1 ${diPeta ? `${UBIN} p-1` : ''}`}>
              <Link
                to="/register"
                className={`hidden sm:inline-flex h-10 items-center gap-1.5 px-3.5 text-xs font-semibold text-slate-700 hover:text-kkp-800 hover:bg-slate-100 rounded-xl transition-colors ${FOKUS}`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar</span>
              </Link>
              <Link
                to="/login"
                className={`inline-flex h-10 items-center gap-2 px-4 bg-kkp-800 hover:bg-kkp-900 text-white text-xs font-bold rounded-xl transition-colors ${FOKUS}`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`${sembunyiKecil} grid h-12 w-12 place-items-center text-slate-700 transition-colors ${FOKUS} ${
              diPeta ? `${UBIN} hover:bg-white` : 'rounded-2xl hover:bg-slate-100'
            }`}
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className={`${sembunyiKecil} pointer-events-auto mx-3 sm:mx-4 sm:ml-auto sm:max-w-sm ${UBIN} bg-white p-2 max-h-[calc(100dvh-84px)] overflow-y-auto`}>
          {menuItems.map((item) => (
            item.submenus ? (
              <div key={item.label} className="mt-1 border-t border-slate-100 pt-2">
                <span className="flex items-center gap-2 px-3 pb-1 text-xs font-bold text-kkp-800">
                  <item.ikon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.submenus.map((sub) => (
                  <Link
                    key={sub.link}
                    to={sub.link}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded-lg py-2 pl-9 pr-3 text-sm font-medium ${
                      location.pathname === sub.link ? 'bg-kkp-100 text-kkp-800' : 'text-slate-600 hover:bg-slate-100'
                    }`}
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
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  aktif(item) ? 'bg-kkp-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <item.ikon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          ))}

          <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 bg-kkp-800 text-white rounded-xl text-xs font-bold"
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
