import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, ambilDaftar } from '../../api/klien';
import { AlertTriangle, Edit2, Check, X, Plus, ListChecks, Loader2, Trash2 } from 'lucide-react';

const KELAS = 'w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-kkp-700/20 focus:border-kkp-700';

const ubahDi = (obj, jalur, nilai) => {
  if (!jalur.length) return nilai;
  const [kepala, ...ekor] = jalur;
  const salin = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  salin[kepala] = ubahDi(salin[kepala], ekor, nilai);
  return salin;
};

const Kelompok = ({ judul, keterangan, aksi, children }) => (
  <section className="bg-white rounded-xl border border-slate-200">
    <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-slate-100">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{judul}</h3>
        {keterangan && <p className="text-xs text-slate-500 mt-0.5">{keterangan}</p>}
      </div>
      {aksi}
    </div>
    <div className="p-5 space-y-3">{children}</div>
  </section>
);

const TombolKecil = ({ children, ...sisa }) => (
  <button type="button" {...sisa} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-kkp-700 border border-kkp-200 rounded-md hover:bg-kkp-100">
    {children}
  </button>
);

const SelMedan = ({ m, nilai, onUbah }) => {
  if (m.jenis === 'area') return <textarea rows={2} className={KELAS} value={nilai} onChange={(e) => onUbah(e.target.value)} />;
  if (m.jenis === 'pilih') {
    return (
      <select className={KELAS} value={nilai} onChange={(e) => onUbah(e.target.value)}>
        <option value="">—</option>
        {m.pilihan.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    );
  }
  return <input className={KELAS} inputMode={m.jenis === 'angka' ? 'decimal' : undefined} value={nilai} onChange={(e) => onUbah(e.target.value)} />;
};

const DaftarObjek = ({ nilai = [], onUbah, medan, maks }) => (
  <div className="space-y-2">
    {nilai.length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-slate-500 text-left">
            <tr>
              {medan.map((m) => <th key={m.kunci} className="font-semibold pb-1 pr-2" style={{ minWidth: m.lebar || 90 }}>{m.label}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {nilai.map((baris, i) => (
              <tr key={i} className="align-top">
                {medan.map((m) => (
                  <td key={m.kunci} className="pr-2 pb-2">
                    <SelMedan m={m} nilai={baris[m.kunci] ?? ''} onUbah={(v) => onUbah(ubahDi(nilai, [i, m.kunci], v))} />
                  </td>
                ))}
                <td className="pb-2">
                  <button type="button" onClick={() => onUbah(nilai.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {nilai.length < maks && (
      <TombolKecil onClick={() => onUbah([...nilai, Object.fromEntries(medan.map((m) => [m.kunci, '']))])}>
        <Plus className="w-3.5 h-3.5" /> Tambah baris
      </TombolKecil>
    )}
  </div>
);

const PILIHAN_KETENTUAN = [['DIIZINKAN', 'Diizinkan'], ['BERSYARAT', 'Diizinkan bersyarat'], ['TIDAK_DIIZINKAN', 'Tidak diizinkan']];

const MEDAN_KOMPETENSI = [
  { kunci: 'nama_posisi', label: 'Posisi / kompetensi', lebar: 180 },
  { kunci: 'persen', label: 'Porsi TK (%)', jenis: 'angka', lebar: 70 },
  { kunci: 'prioritas', label: 'Prioritas', jenis: 'pilih', pilihan: [['TINGGI', 'Tinggi'], ['SEDANG', 'Sedang'], ['RENDAH', 'Rendah']], lebar: 90 },
  { kunci: 'lembaga_pelatihan_rekomendasi', label: 'Lembaga pelatihan', lebar: 150 },
  { kunci: 'skema_sertifikasi', label: 'Skema sertifikasi', lebar: 150 },
  { kunci: 'durasi_pelatihan_bulan', label: 'Durasi (bulan)', jenis: 'angka', lebar: 70 },
  { kunci: 'estimasi_biaya_per_orang_juta', label: 'Biaya/orang (juta Rp)', jenis: 'angka', lebar: 80 },
];

const keKode = (nama) => nama.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);

const pesanGalat = (e) => {
  const d = e.response?.data;
  return d?.detail || (d ? JSON.stringify(d) : e.message);
};

const PengaturanSektor = ({ sektor, onTutup }) => {
  const [ketentuan, setKetentuan] = useState(null);
  const [kompetensi, setKompetensi] = useState(null);
  const [bawaan, setBawaan] = useState(false);
  const [pesan, setPesan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const dasar = `/inti/admin/sektor/${sektor.id}`;

  const terimaKompetensi = (data) => {
    setBawaan(data.bawaan);
    setKompetensi(data.baris.map(({ pct_demand, ...b }) => ({ ...b, persen: String(Math.round(pct_demand * 1000) / 10) })));
  };

  useEffect(() => {
    api.get(`${dasar}/ketentuan/`).then(({ data }) => setKetentuan(data));
    api.get(`${dasar}/kompetensi/`).then(({ data }) => terimaKompetensi(data));
  }, [dasar]);

  const ubahKetentuan = (i, kunci, nilai) => setKetentuan(ketentuan.map((k, j) => (j === i ? { ...k, [kunci]: nilai } : k)));

  const simpan = async () => {
    setMenyimpan(true);
    setPesan('');
    try {
      const k = await api.put(`${dasar}/ketentuan/`, ketentuan.map(({ sub_zona, status, syarat }) => ({
        sub_zona, status, syarat: status === 'BERSYARAT' ? syarat : '',
      })));
      setKetentuan(k.data);
      const m = await api.put(`${dasar}/kompetensi/`, kompetensi.map(({ persen, ...b }) => ({
        ...b,
        prioritas: b.prioritas || 'SEDANG',
        pct_demand: Number(persen || 0) / 100,
        durasi_pelatihan_bulan: Number(b.durasi_pelatihan_bulan || 1),
        estimasi_biaya_per_orang_juta: Number(b.estimasi_biaya_per_orang_juta || 0),
      })));
      terimaKompetensi(m.data);
      setPesan('Tersimpan.');
    } catch (e) {
      setPesan(`Gagal menyimpan: ${pesanGalat(e)}`);
    } finally {
      setMenyimpan(false);
    }
  };

  if (!ketentuan || !kompetensi) return <div className="p-6 text-sm text-slate-500">Memuat pengaturan {sektor.nama}...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">Ketentuan & kompetensi: {sektor.nama}</h2>
        <div className="flex items-center gap-2">
          {pesan && <span className="text-xs text-slate-500">{pesan}</span>}
          <button type="button" onClick={onTutup} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Tutup</button>
          <button type="button" onClick={simpan} disabled={menyimpan} className="px-4 py-1.5 text-sm font-bold text-white bg-kkp-700 rounded-lg hover:bg-kkp-800 disabled:opacity-60">
            {menyimpan ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <Kelompok
        judul="Ketentuan pemanfaatan per sub-zona"
        keterangan="Dipakai screening Tahap 1 dan informasi ruang laut. Sub-zona yang belum ditetapkan membuat hasil screening berstatus belum terverifikasi."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="font-semibold pb-1 pr-2">Sub-zona</th>
                <th className="font-semibold pb-1 pr-2">Ketentuan</th>
                <th className="font-semibold pb-1">Syarat (bila bersyarat)</th>
              </tr>
            </thead>
            <tbody>
              {ketentuan.map((k, i) => (
                <tr key={k.sub_zona} className="align-top">
                  <td className="pr-2 pb-2 pt-1.5 text-slate-700 min-w-[180px]">
                    {k.label}
                    {k.sumber && <div className="text-[10.5px] text-slate-400">{k.sumber}</div>}
                  </td>
                  <td className="pr-2 pb-2 min-w-[170px]">
                    <select className={KELAS} value={k.status} onChange={(e) => ubahKetentuan(i, 'status', e.target.value)}>
                      <option value="">Belum ditetapkan</option>
                      {PILIHAN_KETENTUAN.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </td>
                  <td className="pb-2 min-w-[220px]">
                    <input className={KELAS} value={k.syarat} disabled={k.status !== 'BERSYARAT'} onChange={(e) => ubahKetentuan(i, 'syarat', e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kelompok>

      <Kelompok
        judul="Kompetensi tenaga kerja"
        keterangan={bawaan
          ? 'Belum diisi untuk jenis ini; baris di bawah adalah daftar bawaan sistem. Simpan untuk menetapkannya.'
          : 'Dipakai kartu kebutuhan pelatihan di laporan. Jumlah porsi tenaga kerja seluruh baris paling banyak 100%.'}
      >
        <DaftarObjek nilai={kompetensi} onUbah={setKompetensi} medan={MEDAN_KOMPETENSI} maks={20} />
      </Kelompok>
    </div>
  );
};


const HapusJenis = ({ sektor, onTutup, onSelesai }) => {
  const [dampak, setDampak] = useState(null);
  const [ketik, setKetik] = useState('');
  const [menghapus, setMenghapus] = useState(false);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    api.get(`/inti/admin/sektor/${sektor.id}/dampak/`)
      .then(({ data }) => setDampak(data))
      .catch((err) => setGalat(pesanGalat(err)));
  }, [sektor.id]);

  const hapus = async () => {
    setMenghapus(true);
    setGalat(null);
    try {
      await api.delete(`/inti/admin/sektor/${sektor.id}/`);
      onSelesai();
    } catch (err) {
      setGalat(`Gagal menghapus: ${pesanGalat(err)}`);
      setMenghapus(false);
    }
  };

  const cocok = ketik.trim().toLowerCase() === sektor.nama.trim().toLowerCase();
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Hapus jenis investasi">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !menghapus && onTutup()} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-100 text-rose-600 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
          <div className="text-sm text-slate-700 space-y-2">
            <p className="font-bold text-slate-900">Hapus jenis investasi {sektor.nama}?</p>
            <p className="text-xs text-slate-500">Penghapusan permanen dan tidak dapat dibatalkan. Data berikut ikut terhapus:</p>
          </div>
        </div>
        {!dampak && !galat && (
          <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung data yang terdampak…</p>
        )}
        {dampak && (
          <ul className="text-sm rounded-lg border border-slate-200 divide-y divide-slate-100">
            {dampak.terhapus.map((d) => (
              <li key={d.nama} className="flex justify-between gap-3 px-3 py-2">
                <span className="text-slate-600">{d.nama}</span>
                <span className="font-semibold tabular-nums text-rose-700">{d.jumlah.toLocaleString('id-ID')}</span>
              </li>
            ))}
            {dampak.terhapus.length === 0 && <li className="px-3 py-2 text-slate-500">Tidak ada data lain yang terhubung.</li>}
            {dampak.proyek > 0 && (
              <li className="px-3 py-2 text-xs text-amber-700 bg-amber-50">
                {dampak.proyek.toLocaleString('id-ID')} proyek investasi tidak ikut terhapus, tetapi menjadi tanpa jenis investasi.
              </li>
            )}
          </ul>
        )}
        <label className="block">
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">Ketik <b>{sektor.nama}</b> untuk mengonfirmasi</span>
          <input
            type="text"
            value={ketik}
            onChange={(e) => setKetik(e.target.value)}
            disabled={menghapus}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-rose-500"
          />
        </label>
        {galat && <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs">{galat}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onTutup} disabled={menghapus} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Batal
          </button>
          <button
            type="button"
            onClick={hapus}
            disabled={!cocok || !dampak || menghapus}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
          >
            {menghapus && <Loader2 className="w-4 h-4 animate-spin" />}
            {menghapus ? 'Menghapus…' : 'Hapus permanen'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};


const AdminSectorsPage = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [baru, setBaru] = useState(null);
  const [pengaturan, setPengaturan] = useState(null);
  const [dihapus, setDihapus] = useState(null);

  const simpanBaru = async () => {
    try {
      await api.post('/inti/admin/sektor/', { ...baru, urutan: sectors.length + 1 });
      setBaru(null);
      fetchSectors();
    } catch (err) {
      alert(`Gagal menambah jenis investasi: ${pesanGalat(err)}`);
    }
  };

  const fetchSectors = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/inti/admin/sektor/');
      setSectors(ambilDaftar(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectors();
  }, []);

  const handleEditClick = (s) => {
    setEditingId(s.id);
    setEditForm({
      nama: s.nama,
      warna: s.warna,
      aktif: s.aktif,
      rasio_tk_per_miliar: s.rasio_tk_per_miliar
    });
  };

  const handleSave = async (id) => {
    try {
      await api.patch(`/inti/admin/sektor/${id}/`, editForm);
      setEditingId(null);
      fetchSectors();
    } catch (err) {
      alert('Gagal menyimpan pembaruan.');
    }
  };

  if (loading && sectors.length === 0) return <div className="p-8 text-slate-500">Memuat jenis investasi...</div>;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jenis Investasi</h1>
          <p className="text-slate-500 text-sm mt-1">Jenis investasi yang bisa dipilih saat menganalisis lokasi.</p>
        </div>
        {!baru && (
          <button
            type="button"
            onClick={() => setBaru({ nama: '', kode: '', warna: '#0056A5', rasio_tk_per_miliar: 5, aktif: true })}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-kkp-700 rounded-lg hover:bg-kkp-800 shrink-0"
          >
            <Plus className="w-4 h-4" /> Tambah jenis investasi
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nama Jenis</th>
                <th className="px-6 py-4">Warna UI</th>
                <th className="px-6 py-4">Rasio Naker / Miliar</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {baru && (
                <tr className="bg-kkp-100/40">
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={baru.nama}
                      placeholder="Nama jenis investasi"
                      onChange={(e) => setBaru({ ...baru, nama: e.target.value, kode: keKode(e.target.value) })}
                      className="px-2 py-1 border rounded w-full"
                    />
                    <input
                      type="text"
                      value={baru.kode}
                      placeholder="KODE_JENIS"
                      onChange={(e) => setBaru({ ...baru, kode: keKode(e.target.value) })}
                      className="mt-1 px-2 py-1 border rounded w-full font-mono text-xs"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="color"
                      value={baru.warna}
                      onChange={(e) => setBaru({ ...baru, warna: e.target.value })}
                      className="p-0 border-0 rounded h-8 w-12 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={baru.rasio_tk_per_miliar}
                      onChange={(e) => setBaru({ ...baru, rasio_tk_per_miliar: e.target.value })}
                      className="px-2 py-1 border rounded w-20"
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={baru.aktif}
                      onChange={(e) => setBaru({ ...baru, aktif: e.target.checked })}
                      className="w-4 h-4 text-sky-600 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={simpanBaru} disabled={!baru.nama.trim()} className="p-1 text-emerald-600 bg-emerald-50 rounded disabled:opacity-40"><Check className="w-4 h-4"/></button>
                      <button onClick={() => setBaru(null)} className="p-1 text-slate-500 bg-slate-100 rounded"><X className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              )}
              {sectors.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.warna }}></div>
                      {editingId === s.id ? (
                        <input 
                          type="text" 
                          value={editForm.nama}
                          onChange={(e) => setEditForm({...editForm, nama: e.target.value})}
                          className="px-2 py-1 border rounded w-full"
                        />
                      ) : (
                        <div className="font-bold text-slate-900">{s.nama}</div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {editingId === s.id ? (
                      <input 
                        type="color" 
                        value={editForm.warna}
                        onChange={(e) => setEditForm({...editForm, warna: e.target.value})}
                        className="p-0 border-0 rounded h-8 w-12 cursor-pointer"
                      />
                    ) : (
                      <span className="font-mono text-xs text-slate-500">{s.warna}</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {editingId === s.id ? (
                      <input 
                        type="number" 
                        value={editForm.rasio_tk_per_miliar}
                        onChange={(e) => setEditForm({...editForm, rasio_tk_per_miliar: e.target.value})}
                        className="px-2 py-1 border rounded w-20"
                      />
                    ) : (
                      <span className="font-mono">{s.rasio_tk_per_miliar}</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-center">
                    {editingId === s.id ? (
                      <input 
                        type="checkbox"
                        checked={editForm.aktif}
                        onChange={(e) => setEditForm({...editForm, aktif: e.target.checked})}
                        className="w-4 h-4 text-sky-600 rounded"
                      />
                    ) : (
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        s.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.aktif ? 'Aktif' : 'Nonaktif'}
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
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setPengaturan(s)} title="Ketentuan sub-zona & kompetensi tenaga kerja" className="p-1.5 text-kkp-700 bg-kkp-100 rounded hover:bg-kkp-200">
                          <ListChecks className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditClick(s)} title="Ubah" className="p-1.5 text-sky-600 bg-sky-50 rounded hover:bg-sky-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDihapus(s)} title="Hapus jenis investasi" className="p-1.5 text-rose-600 bg-rose-50 rounded hover:bg-rose-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pengaturan && <PengaturanSektor key={pengaturan.id} sektor={pengaturan} onTutup={() => setPengaturan(null)} />}
      {dihapus && (
        <HapusJenis
          key={dihapus.id}
          sektor={dihapus}
          onTutup={() => setDihapus(null)}
          onSelesai={() => { setDihapus(null); fetchSectors(); }}
        />
      )}
    </div>
  );
};

export default AdminSectorsPage;
