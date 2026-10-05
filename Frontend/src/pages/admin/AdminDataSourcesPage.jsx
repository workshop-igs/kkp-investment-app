import { useEffect, useState } from 'react';
import { api, ambilDaftar } from '../../api/klien';
import { Database, Edit2, Check, X, RefreshCw } from 'lucide-react';


const STATUS_OPTIONS = ['ACTIVE', 'MOCK', 'INACTIVE', 'ERROR'];

const AdminDataSourcesPage = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchSources = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inti/admin/data-sources/');
      setSources(ambilDaftar(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleEditClick = (s) => {
    setEditingId(s.id);
    setEditForm({
      status: s.status,
      base_url: s.base_url
    });
  };

  const handleSave = async (id) => {
    try {
      await api.patch(`/inti/admin/data-sources/${id}/`, editForm);
      setEditingId(null);
      fetchSources();
    } catch (err) {
      alert('Gagal menyimpan pembaruan.');
    }
  };

  if (loading && sources.length === 0) return <div className="p-8 text-slate-500">Memuat data sources...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-syne">Sumber Data & Integrasi</h1>
          <p className="text-slate-500 text-sm mt-1">Kelola koneksi API ke BIG, BMKG, dan instansi lain.</p>
        </div>
        <button onClick={fetchSources} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium shadow-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Sistem / Instansi</th>
                <th className="px-6 py-4">Tipe Data</th>
                <th className="px-6 py-4">Endpoint URL</th>
                <th className="px-6 py-4">Status API</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sources.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                        <Database className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{s.nama}</div>
                        <div className="text-[11px] text-slate-500">{s.kode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{s.tipe}</td>
                  
                  <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500">
                    {editingId === s.id ? (
                      <input 
                        type="url" 
                        value={editForm.base_url}
                        onChange={(e) => setEditForm({...editForm, base_url: e.target.value})}
                        className="w-full px-2 py-1 border rounded"
                      />
                    ) : (
                      <span title={s.base_url}>{s.base_url || '-'}</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === s.id ? (
                      <select 
                        value={editForm.status}
                        onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        className="px-2 py-1 border rounded bg-white text-xs"
                      >
                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'MOCK' ? 'bg-amber-100 text-amber-700' :
                        s.status === 'ERROR' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    {editingId === s.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSave(s.id)} className="p-1 text-emerald-600 bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-500 bg-slate-100 rounded"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditClick(s)} className="p-1.5 text-sky-600 bg-sky-50 rounded hover:bg-sky-100">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDataSourcesPage;
