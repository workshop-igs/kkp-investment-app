import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, Database,
  Map, LogOut, Menu, ShieldCheck, ArrowLeft, ScrollText
} from 'lucide-react';
import { useAuth } from '../context/KonteksAuth';

const TataLetakAdmin = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.is_staff) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navGroups = [
    {
      judul: 'Ikhtisar',
      items: [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard }],
    },
    {
      judul: 'Data & Master',
      items: [
        { name: 'Proyek Investasi', path: '/admin/pipeline', icon: Briefcase },
        { name: 'Sektor Investasi', path: '/admin/sectors', icon: Map },
        { name: 'Sumber Data', path: '/admin/data-sources', icon: Database },
      ],
    },
    {
      judul: 'Tata Kelola',
      items: [
        { name: 'Pengguna & Peran', path: '/admin/users', icon: Users },
        { name: 'Log Aktivitas', path: '/admin/log-aktivitas', icon: ScrollText },
      ],
    },
  ];

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <img src="/logo-kkp.png" alt="KKP" className="w-10 h-10 object-contain" />
        <div>
          <h2 className="font-bold text-sm leading-tight text-white">KKP Super Admin</h2>
          <p className="text-[10px] text-slate-400">Manajemen Investasi Ruang Laut</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        {navGroups.map((grup) => (
          <div key={grup.judul} className="mb-6 last:mb-0">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.12em] mb-2 px-2">
              {grup.judul}
            </div>
            <div className="space-y-1">
              {grup.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white font-medium'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800">
        <Link
          to="/peta"
          onClick={() => setSidebarOpen(false)}
          className="w-full flex items-center gap-3 px-3 py-2.5 mb-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Aplikasi
        </Link>

        <Link
          to="/profil"
          title="Profil Saya"
          className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 mb-3 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{user.role_display}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <SidebarContent />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-30">
          <div className="flex items-center gap-2">
            <img src="/logo-kkp.png" alt="KKP" className="w-8 h-8 object-contain" />
            <span className="font-bold text-slate-800 text-sm">Super Admin</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default TataLetakAdmin;
