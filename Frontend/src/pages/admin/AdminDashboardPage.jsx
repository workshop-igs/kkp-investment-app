import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowUpRight, Briefcase, CheckCircle2, Layers, Map as IkonPeta, ScrollText,
  ShieldAlert, SlidersHorizontal, UserCheck, Users, XOctagon,
} from 'lucide-react';
import { api, ambilDaftar } from '../../api/klien';
import { formatNumber, rupiahMiliar } from '../../utils/pemformat';

const SELANG_STATUS_MS = 30_000;

const Kartu = ({ judul, nilai, catatan, icon: Icon, warna, langsung }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
    <div className={`p-3.5 rounded-xl shrink-0 ${warna}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-500 leading-tight flex items-center gap-1.5">
        {langsung && (
          <span className="relative flex h-2 w-2" title="Diperbarui otomatis">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
        {judul}
      </p>
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
        <h2 className="text-[15px] font-bold text-slate-900">{judul}</h2>
        {keterangan && <p className="text-xs text-slate-400 mt-0.5">{keterangan}</p>}
      </div>
      {tautan && (
        <Link
          to={tautan}
          className="text-xs font-semibold text-kkp-700 hover:text-kkp-900 flex items-center gap-1 shrink-0 mt-0.5"
        >
          {tautanTeks} <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
    {children}
  </div>
);

const TEMA_KONDISI = {
  hijau: {
    judul: 'Aplikasi berjalan normal',
    sub: 'Seluruh pemeriksaan dalam batas wajar.',
    kotak: 'bg-emerald-50 border-emerald-200',
    ikon: 'bg-emerald-500 text-white',
    teks: 'text-emerald-900',
    titik: 'bg-emerald-500',
    Ikon: CheckCircle2,
  },
  kuning: {
    judul: 'Ada peringatan',
    sub: 'Aplikasi masih berjalan, tetapi ada yang perlu diperhatikan.',
    kotak: 'bg-amber-50 border-amber-200',
    ikon: 'bg-amber-500 text-white',
    teks: 'text-amber-900',
    titik: 'bg-amber-500',
    Ikon: AlertTriangle,
  },
  merah: {
    judul: 'Ada masalah',
    sub: 'Sebagian fungsi aplikasi terganggu dan perlu segera ditangani.',
    kotak: 'bg-rose-50 border-rose-200',
    ikon: 'bg-rose-600 text-white',
    teks: 'text-rose-900',
    titik: 'bg-rose-600',
    Ikon: XOctagon,
  },
};

const jamDetik = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const KondisiAplikasi = ({ status, gagal, diperbarui }) => {
  const kesehatan = gagal
    ? {
      status: 'merah',
      pemeriksaan: [{
        nama: 'Server aplikasi',
        status: 'merah',
        nilai: 'tidak merespons',
        keterangan: 'Server tidak menjawab pemeriksaan kondisi; aplikasi mungkin sedang mati atau koneksi terputus.',
      }],
    }
    : status?.kesehatan;
  if (!kesehatan) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 text-sm text-slate-400 animate-pulse">
        Memeriksa kondisi aplikasi…
      </div>
    );
  }
  const tema = TEMA_KONDISI[kesehatan.status] || TEMA_KONDISI.kuning;
  const masalah = kesehatan.pemeriksaan.filter((c) => c.status !== 'hijau')
    .sort((a, b) => (a.status === 'merah' ? -1 : 1) - (b.status === 'merah' ? -1 : 1));
  return (
    <section className={`rounded-2xl border shadow-sm overflow-hidden ${tema.kotak}`} aria-live="polite">
      <div className="px-6 py-5 flex items-start gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${tema.ikon}`}>
          <tema.Ikon className="w-6 h-6" />
        </div>
        <div className={`min-w-0 flex-1 ${tema.teks}`}>
          <p className="text-xs font-semibold opacity-70">Kondisi aplikasi</p>
          <h2 className="text-lg font-bold mt-0.5">{tema.judul}</h2>
          <p className="text-sm opacity-80">{tema.sub}</p>
          {masalah.length > 0 && (
            <ul className="mt-3 space-y-2">
              {masalah.map((c) => (
                <li key={c.nama} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${TEMA_KONDISI[c.status].titik}`} />
                  <span>
                    <b>{c.nama}</b> ({c.nilai}): {c.keterangan}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="bg-white/70 border-t border-black/5 px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
        {kesehatan.pemeriksaan.map((c) => (
          <div key={c.nama} className="min-w-0" title={c.keterangan || 'Normal'}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className={`h-2 w-2 rounded-full shrink-0 ${TEMA_KONDISI[c.status].titik}`} />
              {c.nama}
            </p>
            <p className="text-sm text-slate-900 tabular-nums truncate mt-0.5">{c.nilai}</p>
          </div>
        ))}
      </div>
      <p className="px-6 pb-3 bg-white/70 text-[11px] text-slate-400">
        Diperiksa otomatis tiap 30 detik{diperbarui ? ` · terakhir ${jamDetik(diperbarui)}` : ''}
      </p>
    </section>
  );
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

const MENU_ADMIN = [
  ['/admin/pipeline', Briefcase, 'Proyek Investasi', 'Perbarui realisasi dan tahap proyek.'],
  ['/admin/sectors', IkonPeta, 'Sektor Investasi', 'Tambah jenis investasi dan atur ketentuan zonanya.'],
  ['/admin/pengaturan-analisis', SlidersHorizontal, 'Pengaturan Analisis', 'Ubah ambang, bobot, dan skor yang dipakai analisis.'],
  ['/admin/parameter-tambahan', Layers, 'Parameter Tambahan', 'Tambah area atau nilai wilayah khusus untuk analisis.'],
  ['/admin/users', Users, 'Pengguna & Peran', 'Tambah admin, ubah profil, atau nonaktifkan akun.'],
  ['/admin/log-aktivitas', ScrollText, 'Log Aktivitas', 'Lihat siapa melakukan apa, termasuk akses yang ditolak.'],
];

const AdminDashboardPage = () => {
  const [ringkas, setRingkas] = useState(null);
  const [perStatus, setPerStatus] = useState([]);
  const [pengguna, setPengguna] = useState([]);
  const [log, setLog] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [status, setStatus] = useState(null);
  const [statusGagal, setStatusGagal] = useState(false);
  const [statusPada, setStatusPada] = useState(null);

  useEffect(() => {
    let hidup = true;
    const periksa = () => {
      api.get('/inti/admin/status-sistem/')
        .then(({ data }) => {
          if (!hidup) return;
          setStatus(data);
          setStatusGagal(false);
        })
        .catch(() => hidup && setStatusGagal(true))
        .finally(() => hidup && setStatusPada(new Date()));
    };
    periksa();
    const t = setInterval(periksa, SELANG_STATUS_MS);
    return () => {
      hidup = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const ambil = async () => {
      const tugas = [
        api.get('/inti/dashboard/').then(({ data }) => {
          setRingkas(data.summary || null);
          setPerStatus(data.proyek_per_status || []);
        }),
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

  const ditolak = log.filter((l) => l.aksi === 'DITOLAK');

  const peran = pengguna.reduce((akum, u) => {
    const nama = u.role_display || u.profil?.role || 'Tanpa peran';
    akum[nama] = (akum[nama] || 0) + 1;
    return akum;
  }, {});
  const takAktif = status?.pengguna?.nonaktif ?? pengguna.filter((u) => !u.is_active).length;
  const jumlahPengguna = status?.pengguna?.terdaftar ?? pengguna.length;

  const totalTahap = perStatus.reduce((a, s) => a + (s.count || 0), 0) || 1;

  return (
    <div className="w-full max-w-7xl 2xl:max-w-[1600px] min-[1920px]:max-w-[1800px] mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel Administrasi</h1>
        <p className="text-slate-500 text-sm mt-1">Kondisi aplikasi dan ringkasan data platform.</p>
      </div>

      <KondisiAplikasi status={status} gagal={statusGagal} diperbarui={statusPada} />

      {ditolak.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 space-y-1">
              <p className="font-bold">Perlu perhatian</p>
              <p>
                {ditolak.length} upaya akses ditolak pada aktivitas terkini —{' '}
                <Link to="/admin/log-aktivitas" className="underline font-semibold">
                  periksa jejak audit
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Kartu
          judul="Pengguna Terdaftar"
          nilai={formatNumber(jumlahPengguna, 0)}
          catatan={takAktif > 0 ? `${takAktif} akun nonaktif` : 'Seluruh akun aktif'}
          icon={Users}
          warna="bg-amber-100 text-amber-600"
        />
        <Kartu
          judul="Pengguna Aktif Sekarang"
          nilai={status ? formatNumber(status.pengguna.aktif_sekarang, 0) : '–'}
          catatan={status
            ? `Dalam ${status.pengguna.rentang_aktif_menit} menit terakhir · ${status.pengguna.aktif_hari_ini} aktif hari ini`
            : 'Memuat…'}
          icon={UserCheck}
          warna="bg-emerald-100 text-emerald-600"
          langsung
        />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
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
          warna="bg-teal-100 text-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          judul="Tahap proyek"
          keterangan="Jumlah dan nilai proyek per tahap"
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
                    className="h-full bg-kkp-700 rounded-full"
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
          judul="Peran pengguna"
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
        judul="Aktivitas terkini"
        keterangan="Delapan kejadian terakhir"
        tautan="/admin/log-aktivitas"
        tautanTeks="Lihat semua"
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

      <Panel judul="Menu administrator">
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
          {MENU_ADMIN.map(([tautan, Ikon, nama, fungsi]) => (
            <Link key={tautan} to={tautan} className="group flex items-start gap-3 bg-white px-6 py-4 hover:bg-slate-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-kkp-100 text-kkp-800">
                <Ikon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-kkp-800">{nama}</span>
                <span className="block text-xs text-slate-500 leading-snug">{fungsi}</span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default AdminDashboardPage;
