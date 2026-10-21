import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, Search, BarChart3, TrendingUp, Users, Trash2, Eye, AlertTriangle, X, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { formatRupiah, formatNumber, rupiahMiliar } from '../utils/pemformat';
import { LABEL_TAHAPAN, SECTORS, TAHAPAN_PROYEK } from '../utils/konstanta';
import { unduhPdfPipeline } from '../utils/pdfPipeline';
import { api } from '../api/klien';
import { mulaiMemuat } from '../components/OverlayMemuat';

const GAYA_TAHAP = {
  PERENCANAAN: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  PENYIAPAN: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
  TRANSAKSI: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600',
  KONSTRUKSI: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
  OPERASI: 'bg-teal-500/10 border-teal-500/30 text-teal-600',
};

const PipelinePage = () => {
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [stats, setStats] = useState({
    total_investasi: 0,
    total_proyek: 0,
    tk_langsung: 0,
  });

  const [loading, setLoading] = useState(true);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [menyusunLaporan, setMenyusunLaporan] = useState(false);

  const eksporLaporan = async () => {
    setMenyusunLaporan(true);
    const selesai = mulaiMemuat('Menyusun laporan proyek investasi');
    try {
      const { data } = await api.get('/inti/dashboard/');
      const bagian = [];
      if (sectorFilter !== 'all') {
        bagian.push(`jenis ${SECTORS.find((s) => s.id === sectorFilter)?.label || sectorFilter}`);
      }
      if (statusFilter !== 'all') bagian.push(`tahap ${LABEL_TAHAPAN[statusFilter] || statusFilter}`);
      if (searchTerm.trim()) bagian.push(`pencarian "${searchTerm.trim()}"`);

      await unduhPdfPipeline({
        ringkas: data.summary,
        perStatus: data.proyek_per_status,
        perSektor: data.proyek_per_sektor,
        perProvinsi: data.proyek_per_provinsi,
        proyek: filteredProjects,
        cakupan: bagian.length ? bagian.join(', ') : null,
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Gagal menyusun laporan proyek investasi.' });
    } finally {
      selesai();
      setMenyusunLaporan(false);
    }
  };

  useEffect(() => {
    if (location.state?.notification) {
      setNotification({
        type: location.state.notification.type || 'success',
        message: location.state.notification.message
      });
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const recalculateStats = (projectList) => {
    const totalInvestasi = projectList.reduce((acc, p) => acc + (p.nilai_investasi_miliar || 0), 0) * 1_000_000_000;
    const totalProyek = projectList.length;
    const totalTk = projectList.reduce((acc, p) => acc + (p.proyeksi_tenaga_kerja || 0), 0);
    setStats({
      total_investasi: totalInvestasi,
      total_proyek: totalProyek,
      tk_langsung: totalTk,
    });
  };

  const fetchProjects = () => {
    setLoading(true);
    api.get('/pipeline/proyek/')
      .then(({ data }) => {
        const results = data.results || data;
        setProjects(results);
        recalculateStats(results);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load pipeline data:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    let filtered = [...projects];

    if (searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        (p.nama || "").toLowerCase().includes(searchLower) || 
        (p.provinsi_nama || p.lokasi_detail || "").toLowerCase().includes(searchLower)
      );
    }

    if (sectorFilter !== "all") {
      filtered = filtered.filter(p => p.sektor_kode === sectorFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    setFilteredProjects(filtered);
  }, [projects, searchTerm, sectorFilter, statusFilter]);

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/pipeline/proyek/${projectToDelete.id}/`);

      const updatedList = projects.filter(p => p.id !== projectToDelete.id);
      setProjects(updatedList);
      recalculateStats(updatedList);

      setNotification({
        type: 'success',
        message: `Proyek "${projectToDelete.nama}" (${projectToDelete.kode_proyek || `PRJ-${projectToDelete.id.toString().padStart(4, '0')}`}) berhasil dihapus.`
      });

      setProjectToDelete(null);
    } catch (err) {
      console.error("Delete project error:", err);
      setNotification({
        type: 'error',
        message: `Terjadi kesalahan: ${err.message || 'Gagal menghapus proyek'}`
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-4 lg:px-8 lg:pb-8 pt-[88px] lg:pt-[104px] h-full overflow-y-auto bg-slate-50">
      
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200 shadow-red-500/10'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10'
          }`}>
            {notification.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-syne font-bold text-slate-800 mb-2">Proyek Investasi</h1>
          <p className="text-slate-500">Daftar proyek investasi ruang laut dan perkembangannya, dari perencanaan sampai beroperasi.</p>
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>Tahap proyek mengikuti tahapan Proyek Strategis Nasional (KPPIP):</span>
            {TAHAPAN_PROYEK.map((t, i) => (
              <span key={t.kode} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">→</span>}
                <span title={t.desc} className={`cursor-help rounded border px-1.5 py-0.5 font-semibold ${GAYA_TAHAP[t.kode]}`}>{t.label}</span>
              </span>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={eksporLaporan}
            disabled={menyusunLaporan}
            className="flex items-center gap-2 bg-white border border-slate-300 hover:border-kkp-700 hover:text-kkp-700 text-slate-700 px-5 py-2.5 rounded-lg font-medium transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            {menyusunLaporan ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
            {menyusunLaporan ? 'Menyusun…' : 'Unduh Laporan PDF'}
          </button>
          <Link
            to="/peta"
            className="flex items-center gap-2 bg-[#2CA67A] hover:bg-[#238a64] text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-teal-600/20 hover:shadow-teal-500/30"
          >
            <Plus className="w-5 h-5" />
            Tambah Proyek
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-teal-500/20 text-teal-400 rounded-lg flex items-center justify-center border border-teal-500/30 shadow-inner">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-slate-500 font-medium">Total Nilai Investasi</h3>
          </div>
          <div className="text-3xl font-bold font-syne text-slate-800">{formatRupiah(stats.total_investasi)}</div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/30 shadow-inner">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-slate-500 font-medium">Jumlah Proyek</h3>
          </div>
          <div className="text-3xl font-bold font-syne text-slate-800">{stats.total_proyek} <span className="text-lg text-slate-500 font-normal">proyek</span></div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center border border-purple-500/30 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-slate-500 font-medium">Perkiraan Tenaga Kerja Terserap</h3>
          </div>
          <div className="text-3xl font-bold font-syne text-slate-800">{formatNumber(stats.tk_langsung, 0)} <span className="text-lg text-slate-500 font-normal">orang</span></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50/50">
          <h2 className="font-bold text-lg text-slate-800 font-syne">Daftar Proyek Investasi</h2>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama atau lokasi..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg text-sm pl-9 pr-3 py-2 focus:outline-none focus:border-teal-500 text-slate-800" 
              />
            </div>

            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-teal-500 text-slate-600"
            >
              <option value="all">Semua Jenis Investasi</option>
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-teal-500 text-slate-600"
            >
              <option value="all">Semua Tahap</option>
              {TAHAPAN_PROYEK.map((t) => (
                <option key={t.kode} value={t.kode}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              <span>Memuat daftar proyek...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-24 text-center text-slate-500">Tidak ada proyek yang ditemukan.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-semibold">Kode</th>
                  <th className="py-3.5 px-6 font-semibold">Nama Proyek</th>
                  <th className="py-3.5 px-6 font-semibold">Lokasi</th>
                  <th className="py-3.5 px-6 font-semibold">Jenis Investasi</th>
                  <th className="py-3.5 px-6 font-semibold">Tahap</th>
                  <th className="py-3.5 px-6 font-semibold">Nilai Investasi</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600 divide-y divide-slate-200">
                {filteredProjects.map((p) => {
                  const badge = { label: LABEL_TAHAPAN[p.status] || p.status, style: GAYA_TAHAP[p.status] || 'bg-slate-100 text-slate-600 border border-slate-200' };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-teal-600 font-semibold whitespace-nowrap">{p.kode_proyek || `PRJ-${p.id.toString().padStart(4, '0')}`}</td>
                      <td className="py-4 px-6 font-semibold text-slate-800">{p.nama}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">{p.provinsi_nama || p.lokasi_detail || '-'}</td>
                      <td className="py-4 px-6 text-slate-500 text-sm">{p.sektor_nama}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded border text-xs font-semibold ${badge.style}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-800 whitespace-nowrap">{rupiahMiliar(p.nilai_investasi_miliar)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            to={`/pipeline/${p.id}`} 
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-xs font-semibold transition-colors"
                            title="Lihat detail proyek"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail</span>
                          </Link>
                          <button
                            onClick={() => setProjectToDelete(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold transition-colors"
                            title="Hapus proyek ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold font-syne text-slate-900">Hapus Proyek Investasi</h3>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Apakah Anda yakin ingin menghapus proyek ini dari daftar Proyek Investasi?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5">
              <div className="text-xs font-mono text-teal-700 font-bold">
                {projectToDelete.kode_proyek || `PRJ-${projectToDelete.id.toString().padStart(4, '0')}`}
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {projectToDelete.nama}
              </div>
              <div className="text-xs text-slate-500">
                Jenis: {projectToDelete.sektor_nama || '-'} • Nilai: {rupiahMiliar(projectToDelete.nilai_investasi_miliar)}
              </div>
            </div>

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Tindakan ini permanen. Hasil analisis lokasi, kelayakan finansial, dan riwayat perubahan tahap proyek ini akan ikut terhapus.</span>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Proyek</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PipelinePage;
