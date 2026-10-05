import { useState } from 'react';
import {
  X, Briefcase, Wallet, Users, Ruler, Ship, MapPin, Anchor, Factory, Zap,
  FileCheck, Map, TrendingUp, Leaf, Waves, Download, Loader2,
} from 'lucide-react';
import { useSektorAktif } from '../../api/klien';
import { SECTORS } from '../../utils/konstanta';
import { formatNumber, rupiahMiliar } from '../../utils/pemformat';
import { unduhProfil } from '../../utils/pdfProfilInvestasi';
import { mulaiMemuat } from '../OverlayMemuat';

const Baris = ({ icon: Icon, label, nilai, satuan, warna = 'text-slate-900' }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-sm text-slate-600 leading-tight">{label}</span>
    </div>
    <div className={`text-sm font-bold tabular-nums whitespace-nowrap shrink-0 ${warna}`}>
      {nilai}
      {satuan && <span className="text-[11px] font-normal text-slate-500 ml-1">{satuan}</span>}
    </div>
  </div>
);

const Bagian = ({ judul, tahun, catatan, children }) => (
  <div>
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{judul}</h4>
      {tahun && <span className="text-[11px] text-slate-400 font-semibold">{tahun}</span>}
    </div>
    <div>{children}</div>
    {catatan && (
      <p className="text-[11px] text-slate-400 leading-snug mt-1.5">{catatan}</p>
    )}
  </div>
);

const useUnduhProfil = () => {
  const [mengunduh, setMengunduh] = useState(null);
  const unduh = async (kunci, susun) => {
    setMengunduh(kunci);
    const selesai = mulaiMemuat('Menyusun PDF profil investasi');
    try {
      await susun();
    } catch (e) {
      alert(`Profil investasi gagal disusun: ${e.response?.data?.detail || e.message}`);
    } finally {
      selesai();
      setMengunduh(null);
    }
  };
  return [mengunduh, unduh];
};


export const RingkasanProvinsi = ({ p }) => {
  const inv = p.investasi || {};
  const rl = p.ruang_laut || {};
  const eko = p.ekosistem || {};
  const infra = p.infrastruktur || {};
  const tk = p.tenaga_kerja || {};

  const persenRealisasi =
    inv.nilai_rencana_miliar > 0
      ? Math.round((inv.nilai_realisasi_miliar / inv.nilai_rencana_miliar) * 100)
      : 0;

  return (
    <>
      <Bagian judul="Portofolio Investasi">
        <Baris icon={Briefcase} label="Jumlah proyek" nilai={formatNumber(inv.jumlah_proyek, 0)} />
        <Baris
          icon={Wallet}
          label="Nilai rencana"
          nilai={rupiahMiliar(inv.nilai_rencana_miliar)}
        />
        <Baris
          icon={Wallet}
          label="Realisasi"
          nilai={rupiahMiliar(inv.nilai_realisasi_miliar)}
          satuan={`· ${persenRealisasi}%`}
          warna={persenRealisasi >= 50 ? 'text-emerald-700' : 'text-amber-700'}
        />
        <Baris icon={Users} label="Proyeksi tenaga kerja" nilai={formatNumber(inv.tenaga_kerja, 0)} satuan="orang" />
        <Baris icon={Ruler} label="Luas area proyek" nilai={formatNumber(inv.luas_proyek_ha, 0)} satuan="Ha" />
      </Bagian>

      <Bagian
        judul="Perizinan & Rencana Ruang Laut"
        catatan="KKPRL aktif menunjukkan ruang yang sudah dipegang pihak lain."
      >
        <Baris icon={FileCheck} label="KKPRL aktif" nilai={formatNumber(rl.kkprl_jumlah, 0)} satuan="izin" />
        <Baris icon={Ruler} label="Luas KKPRL" nilai={formatNumber(rl.kkprl_luas_ha, 0)} satuan="Ha" />
        <Baris icon={Map} label="Zona rencana" nilai={formatNumber(rl.zona_jumlah, 0)} />
        <Baris icon={Waves} label="Luas zona rencana" nilai={formatNumber(rl.zona_luas_ha, 0)} satuan="Ha" />
      </Bagian>

      <Bagian
        judul="Ekosistem Pesisir"
        catatan="Ikut membebani penilaian lewat sensitivitas ekosistem."
      >
        <Baris icon={Leaf} label="Mangrove" nilai={formatNumber(eko.mangrove_ha, 0)} satuan="Ha" />
        <Baris icon={Waves} label="Terumbu karang" nilai={formatNumber(eko.terumbu_karang_ha, 0)} satuan="Ha" />
      </Bagian>

      <Bagian judul="Infrastruktur Pendukung">
        <Baris icon={Anchor} label="Pelabuhan" nilai={formatNumber(infra.pelabuhan, 0)} satuan="titik" />
        <Baris icon={Factory} label="Kawasan industri" nilai={formatNumber(infra.kawasan_industri, 0)} />
        <Baris icon={Zap} label="Jaringan & pembangkit listrik" nilai={formatNumber(infra.tenaga_listrik, 0)} />
      </Bagian>

      {tk.tpt_persen != null && (
        <Bagian judul="Pasar Kerja (BPS)" tahun={tk.tahun}>
          <Baris
            icon={TrendingUp}
            label="Tingkat pengangguran terbuka"
            nilai={formatNumber(tk.tpt_persen, 2)}
            satuan="%"
          />
          {tk.penganggur_orang != null && (
            <Baris
              icon={Users}
              label="Penduduk berusia 15 tahun ke atas yang menganggur"
              nilai={formatNumber(tk.penganggur_orang, 0)}
              satuan="orang"
            />
          )}
        </Bagian>
      )}

      {p.luas_laut_km2 > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 border-t border-slate-100 pt-3">
          <Ship className="w-3.5 h-3.5 shrink-0" />
          <span>Luas wilayah laut: {formatNumber(p.luas_laut_km2, 0)} km²</span>
        </div>
      )}
    </>
  );
};

export const UnduhProfilProvinsi = ({ p, jenisAwal }) => {
  const [mengunduh, unduh] = useUnduhProfil();
  const [jenis, setJenis] = useState(jenisAwal || SECTORS[0].id);
  const daftarSektor = useSektorAktif();

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Semua jenis investasi</div>
      <button
        type="button"
        onClick={() => unduh('provinsi', () => unduhProfil(p.id))}
        disabled={!!mengunduh}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-kkp-700 hover:bg-kkp-800 rounded-lg disabled:opacity-60"
      >
        {mengunduh === 'provinsi' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {mengunduh === 'provinsi' ? 'Menyusun profil…' : 'Unduh Profil Investasi Provinsi (PDF)'}
      </button>
      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide pt-1">Satu jenis investasi</div>
      <select
        value={jenis}
        onChange={(e) => setJenis(e.target.value)}
        className="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
      >
        {daftarSektor.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <button
        type="button"
        onClick={() => unduh('jenis', () => unduhProfil(p.id, jenis))}
        disabled={!!mengunduh}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-kkp-700 border border-kkp-200 hover:bg-kkp-100 rounded-lg disabled:opacity-60"
      >
        {mengunduh === 'jenis' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {mengunduh === 'jenis' ? 'Menyusun profil…' : 'Unduh Profil Jenis Terpilih (PDF)'}
      </button>
    </div>
  );
};

const PanelDetailProvinsi = ({ fitur, onTutup }) => {
  if (!fitur) return null;
  const p = fitur.properties || {};

  return (
    <div className="absolute top-24 left-4 bottom-[13rem] z-[1200] w-[min(20rem,calc(100vw-2rem))] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in slide-in-from-left-4 duration-200">
      <div className="px-4 py-3 border-b border-slate-100 bg-kkp-700 rounded-t-2xl shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-kkp-100 mb-0.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>Provinsi · Kode BPS {p.kode_bps}</span>
            </div>
            <h3 className="font-bold text-white text-lg leading-snug">{p.nama}</h3>
          </div>
          <button
            onClick={onTutup}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            aria-label="Tutup detail provinsi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <RingkasanProvinsi p={p} />
      </div>

      <div className="px-4 py-3 border-t border-slate-100 shrink-0">
        <UnduhProfilProvinsi p={p} />
      </div>
    </div>
  );
};

export default PanelDetailProvinsi;
