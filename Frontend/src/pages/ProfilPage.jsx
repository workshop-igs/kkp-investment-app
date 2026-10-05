import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, History, KeyRound, Loader2, RefreshCw, ShieldCheck, UserRound,
} from 'lucide-react';
import { api, ambilDaftar } from '../api/klien';
import { useAuth } from '../context/KonteksAuth';
import { WARNA_AKSI } from '../utils/konstanta';
import { inisialNama, waktuPanjang } from '../utils/pemformat';

const isianDari = (user) => ({
  first_name: user.first_name || '',
  last_name: user.last_name || '',
  telepon: user.telepon || '',
  instansi: user.instansi || '',
  provinsi_id: user.provinsi_id ?? '',
});

const SANDI_KOSONG = { sandi_lama: '', sandi_baru: '', sandi_ulang: '' };

const tanggalPanjang = (iso) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

const kelasIsian = (galat) =>
  `w-full px-3 py-2 bg-white border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-kkp-700/20 focus:border-kkp-700 transition-colors ${
    galat ? 'border-rose-400' : 'border-slate-300'
  }`;

const Bagian = ({ id, ikon: Ikon, judul, keterangan, aksi, children }) => (
  <section id={id} className="bg-white border border-slate-200 rounded-xl shadow-sm scroll-mt-24">
    <header className="flex items-start gap-3 px-6 py-4 border-b border-slate-200">
      <div className="w-9 h-9 rounded-lg bg-kkp-100 text-kkp-700 flex items-center justify-center shrink-0">
        <Ikon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-bold text-slate-900">{judul}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{keterangan}</p>
      </div>
      {aksi}
    </header>
    <div className="p-6">{children}</div>
  </section>
);

const Isian = ({ label, wajib, galat, catatan, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
      {label}
      {wajib && <span className="text-rose-600"> *</span>}
    </span>
    {children}
    {galat ? (
      <span className="block mt-1 text-[11px] text-rose-600">{galat}</span>
    ) : (
      catatan && <span className="block mt-1 text-[11px] text-slate-400">{catatan}</span>
    )}
  </label>
);

const Pesan = ({ pesan }) =>
  pesan && (
    <div
      role={pesan.galat ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
        pesan.galat
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
      }`}
    >
      {pesan.galat ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
      <span>{pesan.teks}</span>
    </div>
  );

const Tombol = ({ memuat, children, ...sisa }) => (
  <button
    {...sisa}
    className="inline-flex items-center gap-2 px-4 py-2 bg-kkp-700 hover:bg-kkp-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {memuat && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

const ProfilPage = () => {
  const { user, perbaruiUser } = useAuth();
  const location = useLocation();

  const [provinsi, setProvinsi] = useState([]);
  const [isian, setIsian] = useState(() => isianDari(user));
  const [galatDiri, setGalatDiri] = useState({});
  const [pesanDiri, setPesanDiri] = useState(null);
  const [menyimpanDiri, setMenyimpanDiri] = useState(false);

  const [sandi, setSandi] = useState(SANDI_KOSONG);
  const [galatSandi, setGalatSandi] = useState({});
  const [pesanSandi, setPesanSandi] = useState(null);
  const [menyimpanSandi, setMenyimpanSandi] = useState(false);

  const [riwayat, setRiwayat] = useState(null);
  const [galatRiwayat, setGalatRiwayat] = useState(false);

  const muatRiwayat = useCallback(() => {
    setGalatRiwayat(false);
    return api
      .get('/inti/auth/aktivitas/')
      .then(({ data }) => setRiwayat(data.hasil))
      .catch(() => setGalatRiwayat(true));
  }, []);

  useEffect(() => {
    api
      .get('/inti/auth/me/')
      .then(({ data }) => {
        if (!data.authenticated) return;
        perbaruiUser(data.user);
        setIsian(isianDari(data.user));
      })
      .catch(() => {});
    muatRiwayat();
    api
      .get('/inti/provinsi/')
      .then(({ data }) => setProvinsi(ambilDaftar(data).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))))
      .catch(() => setProvinsi([]));
  }, [muatRiwayat, perbaruiUser]);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const awal = isianDari(user);
  const berubah = Object.keys(awal).some((k) => String(isian[k]) !== String(awal[k]));

  const ubahIsian = (e) => setIsian((s) => ({ ...s, [e.target.name]: e.target.value }));
  const ubahSandi = (e) => setSandi((s) => ({ ...s, [e.target.name]: e.target.value }));

  const simpanDiri = async (e) => {
    e.preventDefault();
    setMenyimpanDiri(true);
    setPesanDiri(null);
    setGalatDiri({});
    try {
      const { data } = await api.patch('/inti/auth/me/', { ...isian, provinsi_id: isian.provinsi_id || null });
      perbaruiUser(data.user);
      setIsian(isianDari(data.user));
      setPesanDiri({ teks: 'Data diri berhasil disimpan.' });
      muatRiwayat();
    } catch (err) {
      setGalatDiri(err.response?.data?.galat || {});
      setPesanDiri({
        galat: true,
        teks: err.response?.data?.detail || 'Data diri gagal disimpan. Periksa koneksi lalu coba lagi.',
      });
    } finally {
      setMenyimpanDiri(false);
    }
  };

  const simpanSandi = async (e) => {
    e.preventDefault();
    setMenyimpanSandi(true);
    setPesanSandi(null);
    setGalatSandi({});
    try {
      const { data } = await api.post('/inti/auth/ganti-sandi/', sandi);
      setSandi(SANDI_KOSONG);
      setPesanSandi({
        teks:
          data.detail +
          (data.sesi_lain_diakhiri > 0 ? ` ${data.sesi_lain_diakhiri} sesi di perangkat lain telah diakhiri.` : ''),
      });
      muatRiwayat();
    } catch (err) {
      setGalatSandi(err.response?.data?.galat || {});
      setPesanSandi({
        galat: true,
        teks: err.response?.data?.detail || 'Kata sandi gagal diganti. Periksa koneksi lalu coba lagi.',
      });
    } finally {
      setMenyimpanSandi(false);
    }
  };

  const rincian = [
    ['Nama pengguna', user.username],
    ['Surel', user.email || '-'],
    ['Instansi', user.instansi || '-'],
    ['Provinsi', user.provinsi_nama || '-'],
    ['Telepon', user.telepon || '-'],
    ['Terdaftar sejak', tanggalPanjang(user.terdaftar_pada)],
  ];

  return (
    <div className="p-4 lg:px-8 lg:pb-8 pt-[88px] lg:pt-[104px] h-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-kkp-700">Akun Pengguna</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Profil Saya</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data diri dan keamanan akun, serta tinjau riwayat aktivitas Anda.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[20rem_1fr] items-start">
          <aside className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="h-20 bg-kkp-800" />
            <div className="px-6 pb-6 -mt-10">
              <div className="w-20 h-20 rounded-full bg-kkp-700 ring-4 ring-white text-white text-2xl font-bold flex items-center justify-center">
                {inisialNama(user)}
              </div>
              <h2 className="mt-3 text-lg font-bold text-slate-900 leading-tight break-words">{user.full_name}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-kkp-100 text-kkp-800 border border-kkp-200">
                  {user.role_display}
                </span>
              </div>

              <dl className="mt-5 divide-y divide-slate-100 text-xs">
                {rincian.map(([label, nilai]) => (
                  <div key={label} className="py-2.5 grid grid-cols-[7rem_1fr] gap-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="text-slate-800 font-medium break-words">{nilai}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <ShieldCheck className="w-4 h-4 shrink-0 text-kkp-700" />
                Peran, surel, dan nama pengguna ditetapkan oleh administrator. Hubungi administrator sistem bila
                perlu diubah.
              </p>
            </div>
          </aside>

          <div className="space-y-6 min-w-0">
            <Bagian
              ikon={UserRound}
              judul="Data Diri"
              keterangan="Nama dan kontak yang tercatat pada akun Anda."
            >
              <form onSubmit={simpanDiri} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Isian label="Nama depan" wajib galat={galatDiri.first_name}>
                    <input name="first_name" value={isian.first_name} onChange={ubahIsian} required maxLength={150}
                      autoComplete="given-name" className={kelasIsian(galatDiri.first_name)} />
                  </Isian>
                  <Isian label="Nama belakang" galat={galatDiri.last_name}>
                    <input name="last_name" value={isian.last_name} onChange={ubahIsian} maxLength={150}
                      autoComplete="family-name" className={kelasIsian(galatDiri.last_name)} />
                  </Isian>
                  <Isian label="Nomor telepon" galat={galatDiri.telepon} catatan="Contoh: 0812-3456-7890 atau +62 21 3519070">
                    <input name="telepon" type="tel" value={isian.telepon} onChange={ubahIsian} maxLength={20}
                      autoComplete="tel" className={kelasIsian(galatDiri.telepon)} />
                  </Isian>
                  <Isian label="Provinsi domisili / wilayah kerja" galat={galatDiri.provinsi_id}>
                    <select name="provinsi_id" value={isian.provinsi_id} onChange={ubahIsian}
                      className={kelasIsian(galatDiri.provinsi_id)}>
                      <option value="">— Tidak ditentukan —</option>
                      {provinsi.map((p) => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </Isian>
                  <div className="sm:col-span-2">
                    <Isian label="Instansi / organisasi" galat={galatDiri.instansi}>
                      <input name="instansi" value={isian.instansi} onChange={ubahIsian} maxLength={255}
                        autoComplete="organization" className={kelasIsian(galatDiri.instansi)} />
                    </Isian>
                  </div>
                </div>

                <Pesan pesan={pesanDiri} />

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setIsian(awal); setGalatDiri({}); setPesanDiri(null); }}
                    disabled={!berubah || menyimpanDiri}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Batalkan
                  </button>
                  <Tombol type="submit" disabled={!berubah || menyimpanDiri} memuat={menyimpanDiri}>
                    Simpan Perubahan
                  </Tombol>
                </div>
              </form>
            </Bagian>

            <Bagian
              id="keamanan"
              ikon={KeyRound}
              judul="Keamanan Akun"
              keterangan="Ganti kata sandi secara berkala. Sesi di perangkat lain akan diakhiri."
            >
              <form onSubmit={simpanSandi} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                    <Isian label="Kata sandi saat ini" wajib galat={galatSandi.sandi_lama}>
                      <input name="sandi_lama" type="password" value={sandi.sandi_lama} onChange={ubahSandi} required
                        autoComplete="current-password" className={kelasIsian(galatSandi.sandi_lama)} />
                    </Isian>
                  </div>
                  <Isian label="Kata sandi baru" wajib galat={galatSandi.sandi_baru}>
                    <input name="sandi_baru" type="password" value={sandi.sandi_baru} onChange={ubahSandi} required
                      autoComplete="new-password" className={kelasIsian(galatSandi.sandi_baru)} />
                  </Isian>
                  <Isian label="Ulangi kata sandi baru" wajib galat={galatSandi.sandi_ulang}>
                    <input name="sandi_ulang" type="password" value={sandi.sandi_ulang} onChange={ubahSandi} required
                      autoComplete="new-password" className={kelasIsian(galatSandi.sandi_ulang)} />
                  </Isian>
                </div>

                <ul className="text-[11px] text-slate-500 list-disc pl-4 space-y-0.5">
                  <li>Minimal 8 karakter dan tidak seluruhnya angka.</li>
                  <li>Tidak mirip nama pengguna, nama, atau surel Anda.</li>
                  <li>Bukan kata sandi yang umum dipakai.</li>
                </ul>

                <Pesan pesan={pesanSandi} />

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <Tombol type="submit" disabled={menyimpanSandi} memuat={menyimpanSandi}>
                    Ganti Kata Sandi
                  </Tombol>
                </div>
              </form>
            </Bagian>

            <Bagian
              ikon={History}
              judul="Riwayat Aktivitas"
              keterangan="Dua puluh aktivitas terakhir atas nama akun Anda. Laporkan kepada administrator bila ada yang tidak Anda kenali."
              aksi={
                <button
                  type="button"
                  onClick={muatRiwayat}
                  title="Muat ulang"
                  className="p-2 text-slate-400 hover:text-kkp-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              }
            >
              {galatRiwayat ? (
                <Pesan pesan={{ galat: true, teks: 'Riwayat aktivitas gagal dimuat.' }} />
              ) : riwayat === null ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuat riwayat…
                </div>
              ) : riwayat.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada aktivitas yang tercatat.</p>
              ) : (
                <div className="-m-6 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 whitespace-nowrap">Waktu</th>
                        <th className="px-6 py-3">Aktivitas</th>
                        <th className="px-6 py-3">Keterangan</th>
                        <th className="px-6 py-3 whitespace-nowrap">Alamat IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {riwayat.map((b, i) => (
                        <tr key={`${b.waktu}-${i}`} className="hover:bg-slate-50/60">
                          <td className="px-6 py-3 text-slate-500 whitespace-nowrap tabular-nums">{waktuPanjang(b.waktu)}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full whitespace-nowrap ${
                              WARNA_AKSI[b.aksi] || 'bg-slate-100 text-slate-600'
                            }`}>
                              {b.aksi_label || b.aksi}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-700 max-w-[20rem]">
                            <div className="truncate" title={b.ringkasan || b.objek}>{b.ringkasan || b.objek || '-'}</div>
                          </td>
                          <td className="px-6 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{b.alamat_ip || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Bagian>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilPage;
