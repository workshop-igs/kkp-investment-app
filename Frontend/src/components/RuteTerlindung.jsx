import { Link, Navigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAutentikasi } from '../context/KonteksAutentikasi';

const RuteTerlindung = ({ children, portofolio = false, admin = false }) => {
  const { isAuthenticated, bolehPortofolio, user } = useAutentikasi();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if ((portofolio && !bolehPortofolio) || (admin && !user?.is_staff)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 pt-24">
        <div className="max-w-md text-center bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Halaman ini memerlukan izin administrator</h1>
          <p className="mt-2 text-sm text-slate-500">
            {admin
              ? 'Unduh Data dan Direktori Layanan Peta hanya dapat dibuka oleh administrator aplikasi.'
              : 'Dashboard Nasional dan Proyek Investasi hanya dapat dibuka setelah administrator memberi izin akses untuk akun Anda.'}
          </p>
          <Link to="/peta" className="mt-5 inline-flex rounded-lg bg-kkp-700 px-4 py-2 text-sm font-semibold text-white hover:bg-kkp-800">
            Buka Peta Spasial
          </Link>
        </div>
      </div>
    );
  }

  return children;
};

export default RuteTerlindung;
