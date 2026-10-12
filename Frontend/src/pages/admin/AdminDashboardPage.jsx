import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowUpRight, Briefcase, CheckCircle2,
  Database, ShieldAlert, Users,
} from 'lucide-react';
import { api, ambilDaftar } from '../../api/klien';
import { formatNumber, rupiahMiliar } from '../../utils/pemformat';

const Kartu = ({ judul, nilai, catatan, icon: Icon, warna }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
    <div className={`p-3.5 rounded-xl shrink-0 ${warna}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-500 leading-tight">{judul}</p>
      <h3 className="text-xl xl:text-2xl font-bold text-slate-900 mt-1 tabular-nums whitespace-nowrap">
        {nilai}
      </h3>
      {catatan && <p className="text-xs text-slate-400 mt-1 leading-tight">{catatan}</p>}
    </div>
  </div>
);

const Panel = ({ judul, keterangan, tautan, tautanTeks, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{judul}</h2>
        {keterangan && <p className="text-xs text-slate-400 mt-0.5">{keterangan}</p>}
      </div>
      {tautan && (
        <Link
          to={tautan}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1 shrink-0 mt-0.5"
        >
          {tautanTeks} <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
    {children}
  </div>
);

const tanggalPendek = (iso) => {
  if (!iso) return 'belum pernah';
  const d = new Date(iso);
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
};

const jamPendek = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const WARNA_AKSI = {
  MASUK: 'bg-sky-100 text-sky-700',
  KELUAR: 'bg-slate-100 text-slate-600',
  DAFTAR: 'bg-indigo-100 text-indigo-700',
  BUAT: 'bg-emerald-100 text-emerald-700',
  UBAH: 'bg-amber-100 text-amber-700',
  HAPUS: 'bg-rose-100 text-rose-700',
  ANALISIS: 'bg-teal-100 text-teal-700',
  DITOLAK: 'bg-red-100 text-red-700',
};

const PETUNJUK_ADMIN = [
  'Manajemen Pengguna: menambah administrator dan mengatur akses pengguna.',
  'Sektor Investasi: menambah jenis investasi baru, lalu melalui tombol daftar-periksa pada barisnya menetapkan ketentuan pemanfaatan per sub-zona dan kompetensi tenaga kerja yang dibutuhkan. Tanpa ketentuan, hasil screening jenis itu berstatus belum terverifikasi.',
  'Sumber Data dan Log Aktivitas: memantau sinkronisasi data dan jejak aktivitas pengguna.',
];

const PEMBARUAN = [
  ['tarik_kkprl_wfs', 'KKPRL terbit dari Portal Satu Data KKP, termasuk klasifikasi jenis investasi (--klasifikasi)'],
  ['tarik_rtrw_provinsi', 'Zona laut dari geodatabase RTRW Provinsi (folder Google Drive KKP); acuan tata ruang utama, beserta ketentuan kegiatan dari lampiran matriks KKPRL Perda untuk provinsi yang sudah diverifikasi'],
  ['tarik_pola_ruang_wfs, tarik_rzwp3k_wfs', 'Pola ruang RTRW/PKKPRL dan RZWP-3-K'],
  ['tarik_ekosistem_wfs', 'Mangrove Portal Satu Data KKP'],
  ['tarik_ekosistem_sidako', 'Terumbu karang dan padang lamun 2025 dari Sidako Ekosistem KKP'],
  ['tarik_oseanografi', 'Kedalaman laut, suhu permukaan dan anomalinya (NOAA Coral Reef Watch, juga ditayangkan Sidako KKP), klorofil-a, dan gelombang dari NOAA'],
  ['tarik_risiko_bencana', 'Indeks risiko bencana pesisir BNPB InaRISK'],
  ['tarik_statistik_bps', 'Pengangguran BPS per provinsi dan per kabupaten/kota'],
  ['hitung_skor_zona', 'Menghitung ulang skor kelayakan zona setelah data di atas diperbarui'],
];

const AdminDashboardPage = () => {
  const [ringkas, setRingkas] = useState(null);
  const [perStatus, setPerStatus] = useState([]);
  const [sumber, setSumber] = useState([]);
  const [pengguna, setPengguna] = useState([]);
  const [log, setLog] = useState([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    const ambil = async () => {
      const tugas = [
        api.get('/inti/dashboard/').then(({ data }) => {
          setRingkas(data.summary || null);
          setPerStatus(data.proyek_per_status || []);
        }),
        api.get('/inti/admin/data-sources/').then(({ data }) => setSumber(ambilDaftar(data))),
        api.get('/inti/admin/users/').then(({ data }) => setPengguna(ambilDaftar(data))),
        api.get('/inti/admin/log-aktivitas/').then(({ data }) => setLog(ambilDaftar(data).slice(0, 8))),
      ];
      await Promise.allSettled(tugas);
      setMemuat(false);
    };
    ambil();
  }, []);

  if (memuat) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Memuat ikhtisar platform…</div>;
  }

  const perluSinkron = sumber.filter((s) => s.perlu_disinkronkan);
  const sumberBermasalah = sumber.filter((s) => s.status === 'ERROR' || s.status === 'INACTIVE');
  const ditolak = log.filter((l) => l.aksi === 'DITOLAK');

  const peran = pengguna.reduce((akum, u) => {
    const nama = u.role_display || u.profil?.role || 'Tanpa peran';
    akum[nama] = (akum[nama] || 0) + 1;
    return akum;
  }, {});
  const takAktif = pengguna.filter((u) => !u.is_active).length;

  const totalTahap = perStatus.reduce((a, s) => a + (s.count || 0), 0) || 1;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-syne">Panel Administrasi Platform</h1>
        <p className="text-slate-500 text-sm mt-1">
          Keadaan sistem, kesegaran data, dan tata kelola akses — Modul Manajemen Investasi Ruang
          Laut, Kementerian Kelautan dan Perikanan.
        </p>
      </div>

      {(perluSinkron.length > 0 || sumberBermasalah.length > 0 || ditolak.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-1">
              <p className="font-bold">Perlu perhatian</p>
              {perluSinkron.length > 0 && (
                <p>
                  {perluSinkron.length} sumber data telah melewati selang pembaruannya:{' '}
                  <span className="font-semibold">{perluSinkron.map((s) => s.nama).join(', ')}</span>
                </p>
              )}
              {sumberBermasalah.length > 0 && (
                <p>
                  {sumberBermasalah.length} sumber data berstatus tidak aktif atau bergalat:{' '}
                  <span className="font-semibold">{sumberBermasalah.map((s) => s.kode).join(', ')}</span>
                </p>
              )}
              {ditolak.length > 0 && (
                <p>
                  {ditolak.length} upaya akses ditolak pada aktivitas terkini —{' '}
                  <Link to="/admin/log-aktivitas" className="underline font-semibold">
                    periksa jejak audit
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-6">
        <Kartu
          judul="Proyek Terpantau"
          nilai={formatNumber(ringkas?.total_proyek || 0, 0)}
          catatan={`Tersebar di ${ringkas?.total_sektor || 0} sektor`}
          icon={Briefcase}
          warna="bg-sky-100 text-sky-600"
        />
        <Kartu
          judul="Nilai Rencana"
          nilai={rupiahMiliar(ringkas?.total_investasi_miliar || 0)}
          catatan={`Realisasi ${ringkas?.pct_realisasi ?? 0}% · ${rupiahMiliar(ringkas?.total_realisasi_miliar || 0)}`}
          icon={Activity}
          warna="bg-indigo-100 text-indigo-600"
        />
        <Kartu
          judul="Serapan Tenaga Kerja"
          nilai={formatNumber(ringkas?.total_tenaga_kerja || 0, 0)}
          catatan="Proyeksi dari proyek terpantau"
          icon={CheckCircle2}
          warna="bg-emerald-100 text-emerald-600"
        />
        <Kartu
          judul="Akun Terdaftar"
          nilai={formatNumber(pengguna.length, 0)}
          catatan={takAktif > 0 ? `${takAktif} akun nonaktif` : 'Seluruh akun aktif'}
          icon={Users}
          warna="bg-amber-100 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          judul="Tahap Proyek"
          keterangan="Sebaran proyek menurut tahap, dari perencanaan sampai operasi"
          tautan="/admin/pipeline"
          tautanTeks="Kelola proyek"
        >
          <div className="px-6 py-5 space-y-3">
            {perStatus.map((s) => (
              <div key={s.status}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">{s.label}</span>
                  <span className="text-slate-500 tabular-nums">
                    {s.count} proyek · {rupiahMiliar(s.total_miliar || 0)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${((s.count || 0) / totalTahap) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {perStatus.length === 0 && (
              <p className="text-sm text-slate-400">Belum ada proyek tercatat.</p>
            )}
          </div>
        </Panel>

        <Panel
          judul="Komposisi Peran Pengguna"
          keterangan="Peran Pusat dan Daerah hanya dapat ditetapkan administrator"
          tautan="/admin/users"
          tautanTeks="Kelola pengguna"
        >
          <div className="px-6 py-5 space-y-2.5">
            {Object.entries(peran)
              .sort((a, b) => b[1] - a[1])
              .map(([nama, n]) => (
                <div key={nama} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{nama}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{n}</span>
                </div>
              ))}
            {Object.keys(peran).length === 0 && (
              <p className="text-sm text-slate-400">Belum ada akun terdaftar.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        judul="Kesegaran Sumber Data Eksternal"
        keterangan="Penarikan dari portal KKP, BPS, dan BNPB beserta selang pembaruannya"
        tautan="/admin/data-sources"
        tautanTeks="Kelola sumber data"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Sumber</th>
                <th className="px-6 py-3">Jenis</th>
                <th className="px-6 py-3">Terakhir Ditarik</th>
                <th className="px-6 py-3 text-center">Selang</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sumber.map((s) => (
                <tr key={s.id} className={s.perlu_disinkronkan ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}>
                  <td className="px-6 py-3">
                    <div className="font-semibold text-slate-900">{s.nama}</div>
                    <div className="font-mono text-[10px] text-slate-400">{s.kode}</div>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">{s.tipe}</td>
                  <td className="px-6 py-3 text-slate-600 text-xs">
                    {tanggalPendek(s.last_sync)}
                    {s.perlu_disinkronkan && (
                      <span className="ml-2 text-amber-700 font-semibold">jatuh tempo</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center text-slate-500 text-xs tabular-nums">
                    {s.sync_interval_days} hari
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'ERROR'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {sumber.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                    Belum ada sumber data terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        judul="Aktivitas Terkini"
        keterangan="Delapan kejadian terakhir; upaya yang ditolak ikut tercatat"
        tautan="/admin/log-aktivitas"
        tautanTeks="Jejak audit lengkap"
      >
        <div className="divide-y divide-slate-100">
          {log.map((l) => (
            <div key={l.id} className="px-6 py-3 flex items-center gap-4 text-sm">
              <span className="text-[11px] text-slate-400 tabular-nums w-12 shrink-0">
                {jamPendek(l.waktu)}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                  WARNA_AKSI[l.aksi] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {l.aksi_label || l.aksi}
              </span>
              <span className={`shrink-0 ${l.nama_pengguna ? 'font-semibold text-slate-800' : 'text-slate-400 italic'}`}>
                {l.nama_pengguna || 'tanpa akun'}
              </span>
              <span className="text-slate-500 truncate">{l.objek || l.ringkasan || l.jalur}</span>
              {l.aksi === 'DITOLAK' && (
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 ml-auto" />
              )}
            </div>
          ))}
          {log.length === 0 && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              Belum ada aktivitas tercatat.
            </div>
          )}
        </div>
      </Panel>

      <Panel judul="Petunjuk Administrator" keterangan="Fungsi setiap menu administrator">
        <ul className="px-6 py-5 pl-11 space-y-2 text-sm text-slate-700 leading-relaxed list-disc">
          {PETUNJUK_ADMIN.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Panel>

      <Panel judul="Pembaruan Data" keterangan="Perintah teknis, dijalankan di server dengan manage.py">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {PEMBARUAN.map(([perintah, isi]) => (
                <tr key={perintah} className="align-top">
                  <td className="px-6 py-2.5 font-mono text-xs text-slate-800">{perintah}</td>
                  <td className="pr-6 py-2.5 text-slate-600">{isi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {(ringkas?.potensi?.total_titik ?? 0) === 0 && (
        <div className="flex items-start gap-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <Database className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <p className="leading-relaxed">
            Tabel lokasi potensi investasi kosong. Lapisan <b>Wilayah Disarankan per Jenis</b> di
            peta tidak bergantung padanya — ia disusun dari 280.280 skor kelayakan zona yang
            dihitung <span className="font-mono">hitung_skor_zona</span> atas 28.028 zona RZWP-3-K
            nyata untuk sepuluh sektor.
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
