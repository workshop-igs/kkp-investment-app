import { useEffect, useState } from 'react';
import { api, ambilDaftar } from '../../api/klien';
import { Edit2, Check, X, MapPin } from 'lucide-react';
import { rupiahMiliar } from '../../utils/pemformat';
import { LABEL_TAHAPAN, TAHAPAN_PROYEK } from '../../utils/konstanta';

const AdminPipelinePage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inti/admin/proyek/');
      setProjects(ambilDaftar(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleEditClick = (proyek) => {
    setEditingId(proyek.id);
    setEditForm({
      status: proyek.status,
      nilai_realisasi_miliar: proyek.nilai_realisasi_miliar || 0
    });
  };

  const handleSave = async (id) => {
    try {
      await api.patch(`/inti/admin/proyek/${id}/`, editForm);
      setEditingId(null);
      fetchProjects();
    } catch (err) {
      alert('Gagal menyimpan pembaruan.');
    }
  };

  if (loading && projects.length === 0) return <div className="p-8 text-slate-500">Memuat daftar proyek...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-syne">Kelola Proyek Investasi</h1>
        <p className="text-slate-500 text-sm mt-1">Perbarui nilai realisasi dan tahap seluruh proyek investasi ruang laut. Tahap mengikuti tahapan Proyek Strategis Nasional (KPPIP).</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Proyek & Sektor</th>
                <th className="px-6 py-4">Investor</th>
                <th className="px-6 py-4">Rencana</th>
                <th className="px-6 py-4">Realisasi</th>
                <th className="px-6 py-4">Tahap</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{p.nama}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{p.kode_proyek} • {p.sektor_nama}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">{p.investor || p.investor_nama}</div>
                    <div className="text-[11px] flex items-center gap-1 text-slate-400 mt-0.5">
                      <MapPin className="w-3 h-3" /> {p.provinsi_nama}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono">{rupiahMiliar(p.nilai_investasi_miliar)}</td>
                  
                  <td className="px-6 py-4">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Rp</span>
                        <input 
                          type="number" 
                          value={editForm.nilai_realisasi_miliar}
                          onChange={(e) => setEditForm({...editForm, nilai_realisasi_miliar: e.target.value})}
                          className="w-20 px-2 py-1 border rounded text-sm"
                        />
                        <span className="text-slate-400">miliar</span>
                      </div>
                    ) : (
                      <span className="font-mono font-medium text-teal-600">{rupiahMiliar(p.nilai_realisasi_miliar)}</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === p.id ? (
                      <select 
                        value={editForm.status}
                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        className="px-2 py-1 border rounded text-sm bg-white"
                      >
                        {TAHAPAN_PROYEK.map((t) => <option key={t.kode} value={t.kode}>{t.label}</option>)}
                      </select>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-full">
                        {LABEL_TAHAPAN[p.status] || p.status}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {editingId === p.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSave(p.id)} className="p-1 text-emerald-600 bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 bg-slate-100 rounded"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditClick(p)} className="p-1.5 text-sky-600 bg-sky-50 rounded hover:bg-sky-100">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Belum ada proyek investasi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPipelinePage;
