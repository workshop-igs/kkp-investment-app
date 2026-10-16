import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HeaderPeta from './components/layout/HeaderPeta';
import { PenyediaAuth } from './context/KonteksAuth';
import BatasGalat from './components/BatasGalat';
import RuteTerlindung from './components/RuteTerlindung';
import OverlayMemuat from './components/OverlayMemuat';
import AsistenMengambang from './components/AsistenMengambang';

import LandingPage from './pages/LandingPage';
import AnalisisPage from './pages/AnalisisPage';
import ProfilInvestasiPage from './pages/ProfilInvestasiPage';
import PipelinePage from './pages/PipelinePage';
import DetailProyekPage from './pages/DetailProyekPage';
import DashboardPage from './pages/DashboardPage';
import LaporanAnalisisPage from './pages/LaporanAnalisisPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilPage from './pages/ProfilPage';

import TataLetakAdmin from './layouts/TataLetakAdmin';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminPipelinePage from './pages/admin/AdminPipelinePage';
import AdminSectorsPage from './pages/admin/AdminSectorsPage';
import AdminLogAktivitasPage from './pages/admin/AdminLogAktivitasPage';
import AdminPengaturanAnalisisPage from './pages/admin/AdminPengaturanAnalisisPage';
import AdminParameterTambahanPage from './pages/admin/AdminParameterTambahanPage';

const AppLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isAdminPage) {
    return (
      <BatasGalat judul="Halaman admin gagal ditampilkan">
      <Routes>
        <Route path="/admin" element={<RuteTerlindung><TataLetakAdmin /></RuteTerlindung>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="pipeline" element={<AdminPipelinePage />} />
          <Route path="sectors" element={<AdminSectorsPage />} />
          <Route path="log-aktivitas" element={<AdminLogAktivitasPage />} />
          <Route path="pengaturan-analisis" element={<AdminPengaturanAnalisisPage />} />
          <Route path="parameter-tambahan" element={<AdminParameterTambahanPage />} />
        </Route>
      </Routes>
      </BatasGalat>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 overflow-hidden font-sans relative">
      {!isAuthPage && <HeaderPeta />}
      
      <main
        className={`flex-1 h-full w-full relative ${
          isAuthPage ? 'overflow-y-auto' : 'overflow-hidden'
        }`}
      >
        <BatasGalat key={location.pathname}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/peta" element={<AnalisisPage />} />
          <Route path="/profil-investasi" element={<ProfilInvestasiPage />} />
          <Route path="/dashboard" element={<RuteTerlindung><DashboardPage /></RuteTerlindung>} />
          <Route path="/pipeline" element={<RuteTerlindung><PipelinePage /></RuteTerlindung>} />
          <Route path="/pipeline/:id" element={<RuteTerlindung><DetailProyekPage /></RuteTerlindung>} />
          <Route path="/analysis-report" element={<RuteTerlindung><LaporanAnalisisPage /></RuteTerlindung>} />
          <Route path="/profil" element={<RuteTerlindung><ProfilPage /></RuteTerlindung>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
        </BatasGalat>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <PenyediaAuth>
        <AppLayout />
        <OverlayMemuat />
        <AsistenMengambang />
      </PenyediaAuth>
    </Router>
  );
}

export default App;
