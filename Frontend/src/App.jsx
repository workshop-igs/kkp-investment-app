import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import HeaderPeta from './components/layout/HeaderPeta';
import { PenyediaAutentikasi } from './context/KonteksAutentikasi';
import BatasGalat from './components/BatasGalat';
import RuteTerlindung from './components/RuteTerlindung';
import OverlayMemuat from './components/OverlayMemuat';
import AsistenMengambang from './components/AsistenMengambang';

import BerandaPage from './pages/BerandaPage';
import AnalisisPage from './pages/AnalisisPage';
import ProfilInvestasiPage from './pages/ProfilInvestasiPage';
import ProyekInvestasiPage from './pages/ProyekInvestasiPage';
import DetailProyekPage from './pages/DetailProyekPage';
import DashboardPage from './pages/DashboardPage';
import LaporanAnalisisPage from './pages/LaporanAnalisisPage';
import MasukPage from './pages/MasukPage';
import DaftarPage from './pages/DaftarPage';
import ProfilPage from './pages/ProfilPage';
import UnduhDataPage from './pages/UnduhDataPage';
import LayananPetaPage from './pages/LayananPetaPage';

import TataLetakAdmin from './layouts/TataLetakAdmin';
import AdminPanelPage from './pages/admin/AdminPanelPage';
import AdminPenggunaPage from './pages/admin/AdminPenggunaPage';
import AdminProyekInvestasiPage from './pages/admin/AdminProyekInvestasiPage';
import AdminJenisInvestasiPage from './pages/admin/AdminJenisInvestasiPage';
import AdminLogAktivitasPage from './pages/admin/AdminLogAktivitasPage';
import AdminPengaturanAnalisisPage from './pages/admin/AdminPengaturanAnalisisPage';
import AdminParameterTambahanPage from './pages/admin/AdminParameterTambahanPage';
import AdminPembaruanDataPage from './pages/admin/AdminPembaruanDataPage';

const AppLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isAdminPage) {
    return (
      <BatasGalat judul="Halaman admin gagal ditampilkan">
      <Routes>
        <Route path="/admin" element={<RuteTerlindung><TataLetakAdmin /></RuteTerlindung>}>
          <Route index element={<AdminPanelPage />} />
          <Route path="users" element={<AdminPenggunaPage />} />
          <Route path="pipeline" element={<AdminProyekInvestasiPage />} />
          <Route path="sectors" element={<AdminJenisInvestasiPage />} />
          <Route path="log-aktivitas" element={<AdminLogAktivitasPage />} />
          <Route path="pengaturan-analisis" element={<AdminPengaturanAnalisisPage />} />
          <Route path="parameter-tambahan" element={<AdminParameterTambahanPage />} />
          <Route path="pembaruan-data" element={<AdminPembaruanDataPage />} />
          <Route path="pengaturan-profil" element={<AdminPengaturanAnalisisPage key="profil" halaman="profil" />} />
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
          <Route path="/" element={<BerandaPage />} />
          <Route path="/peta" element={<AnalisisPage />} />
          <Route path="/profil-investasi" element={<ProfilInvestasiPage />} />
          <Route path="/unduh-data" element={<UnduhDataPage />} />
          <Route path="/rest/services" element={<LayananPetaPage />} />
          <Route path="/rest/services/:kode/MapServer" element={<LayananPetaPage />} />
          <Route path="/rest/services/:kode/MapServer/:nomor" element={<LayananPetaPage />} />
          <Route path="/rest/services/:kode/MapServer/:nomor/:aksi" element={<LayananPetaPage />} />
          <Route path="/dashboard" element={<RuteTerlindung portofolio><DashboardPage /></RuteTerlindung>} />
          <Route path="/pipeline" element={<RuteTerlindung portofolio><ProyekInvestasiPage /></RuteTerlindung>} />
          <Route path="/pipeline/:id" element={<RuteTerlindung portofolio><DetailProyekPage /></RuteTerlindung>} />
          <Route path="/analysis-report" element={<RuteTerlindung><LaporanAnalisisPage /></RuteTerlindung>} />
          <Route path="/profil" element={<RuteTerlindung><ProfilPage /></RuteTerlindung>} />
          <Route path="/login" element={<MasukPage />} />
          <Route path="/register" element={<DaftarPage />} />
        </Routes>
        </BatasGalat>
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <PenyediaAutentikasi>
        <AppLayout />
        <OverlayMemuat />
        <AsistenMengambang />
      </PenyediaAutentikasi>
    </Router>
  );
}

export default App;
