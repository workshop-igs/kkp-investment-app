import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Anchor,
  ChevronLeft,
  ChevronRight,
  Info,
  Leaf,
  Loader2,
  Map as MapIcon,
  FileDown,
  Printer,
  Save,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../api/klien';
import PetaProyek from '../components/map/PetaProyek';
import KartuLaporan, {
  AngkaBesar,
  BarisLipat,
  Donat,
  KartuSkorBagian,
  KartuTabelSpasial,
  KotakBatimetri,
  TabelRingkas,
  TabelTitikSudut,
} from '../components/laporan/KartuLaporan';
import KartuRisikoRuang from '../components/laporan/KartuRisikoRuang';
import KartuScreening from '../components/laporan/KartuScreening';
import { keLatLng } from '../utils/koordinat';
import {
  ASPEK_AHP,
  PENJELASAN_RISIKO,
  namaAspek,
  normalkanAnalisis,
  pilihKonteksBps,
  pisahSebaranTk,
  skorBagian,
  warnaStatus,
} from '../utils/normalisasiAnalisis';
import { angkaRingkas as nf, rupiahRingkas } from '../utils/pemformat';
import { unduhPdfLaporan } from '../utils/pdfLaporan';
import { SECTORS } from '../utils/konstanta';
import { mulaiMemuat } from '../components/OverlayMemuat';

const CATATAN_SCREENING =
  'Acuan berjenjang: RTRW Provinsi, lalu Rencana Zonasi KAW, lalu RTRWN. Ketentuan pemanfaatan per jenis investasi dikelola administrator.';

const PALET = ['#0056A5', '#3d81c0', '#7aa9d6', '#a9c6e5', '#cfdff0', '#8fa3b8'];

const TEMA = [
  { kunci: 'umum', label: 'Informasi Umum', Ikon: Info },
  { kunci: 'ruang', label: 'Tata Ruang & Perizinan', Ikon: MapIcon },
  { kunci: 'transportasi', label: 'Transportasi & Infrastruktur', Ikon: Anchor },
  { kunci: 'sosial', label: 'Sosial & Ketenagakerjaan', Ikon: Users },
  { kunci: 'risiko', label: 'Risiko Lingkungan & Sosial', Ikon: Leaf },
  { kunci: 'kelayakan', label: 'Kelayakan Investasi', Ikon: TrendingUp },
];

const KOLOM_SENSITIVITAS = ['Perubahan', 'NPV', 'IRR', 'Payback (th)'];

const barisSensitivitas = (baris) =>
  [...baris]
    .sort((a, b) => (b.perubahan_pct ?? 0) - (a.perubahan_pct ?? 0))
    .map((r) => {
      const pc = Number(r.perubahan_pct) || 0;
      return [
        pc === 0 ? '0% (dasar)' : `${pc > 0 ? '+' : ''}${nf(pc, pc % 1 ? 1 : 0)}%`,
        `Rp ${rupiahRingkas(r.npv)}`,
        r.irr != null ? `${nf(r.irr, 1)}%` : '—',
        r.payback_tercapai === false ? 'tidak tercapai' : nf(r.payback, 1),
      ];
    });

const PENGANTAR = {
  umum:
    'Menjelaskan ukuran area yang dianalisis, letak geografisnya, dan wilayah administratif yang menaunginya. Informasi dasar ini diperlukan sebelum menyusun rencana kegiatan atau mengajukan perizinan.',
  ruang:
    'Memeriksa kesesuaian area terhadap rencana tata ruang laut yang berlaku dan terhadap izin pemanfaatan ruang laut yang sudah terbit. Menentukan apakah kegiatan yang diusulkan sejalan dengan peruntukan yang direncanakan.',
  transportasi:
    'Menghitung kedekatan area dengan alur pelayaran, kabel dan pipa bawah laut, serta infrastruktur pendukung. Jarak ke pelabuhan dan jaringan listrik menentukan biaya logistik dan penyambungan daya.',
  kelayakan:
    'Ringkasan penilaian kelayakan multi-kriteria dan proyeksi arus kas terdiskonto untuk area ini, berdasarkan parameter finansial yang dimasukkan.',
  sosial:
    'Perkiraan serapan tenaga kerja dan kebutuhan peningkatan kapasitas yang menyertai kegiatan pada skala investasi ini.',
  risiko: PENJELASAN_RISIKO.tema,
};

const pesanGalatSimpan = (galat) => {
  const kode = galat?.response?.status;
  const d = galat?.response?.data;
  if (!d || typeof d !== 'object') return `Server menolak permintaan (HTTP ${kode ?? '?'}).`;
  if (d.detail) return d.detail;

  const baris = Object.entries(d)
    .filter(([k]) => k !== 'sektor_tersedia')
    .map(([kolom, isi]) => `${kolom}: ${Array.isArray(isi) ? isi.join(' ') : isi}`);
  if (Array.isArray(d.sektor_tersedia) && d.sektor_tersedia.length) {
    baris.push(`Sektor yang tersedia: ${d.sektor_tersedia.join(', ')}`);
  }
  return baris.join('\n') || `Server menolak permintaan (HTTP ${kode ?? '?'}).`;
};

const WARNA_KELAS_RISIKO = {
  TINGGI: 'bg-rose-50 text-rose-700 border-rose-200',
  SEDANG: 'bg-amber-50 text-amber-700 border-amber-200',
  RENDAH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const LaporanAnalisisPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { result, geometry, namaProyek, investor, lokasiDetail } =
    location.state || {};
  const jenisInvestasi = SECTORS.find((s) => s.id === result?.sektor)?.label || result?.sektor;
  const skorTema = (t) => skorBagian(result?.kelayakan?.skor_per_aspek, result?.spasial?.sumber, t);

  const [tema, setTema] = useState('umum');
  const [spasialData, setSpasialData] = useState(null);
  const spasialDataRef = React.useRef(null);
  const [status, setStatus] = useState({ memuat: true, galat: null });
  const [menyimpan, setMenyimpan] = useState(false);
  const [bps, setBps] = useState({ memuat: false, data: null, galat: null });
  const [membuatPdf, setMembuatPdf] = useState(false);

  const [panelTerlipat, setPanelTerlipat] = useState(false);

  const geom = result?.geometry || geometry;
  const bencana = useMemo(() => {
    if (status.memuat) return { memuat: true, data: null, galat: null };
    const bagian = (spasialData?.bagian || []).find((b) => b.kunci === 'bencana');
    return { memuat: false, data: bagian || null, galat: bagian ? null : status.galat };
  }, [spasialData, status]);

  const posisi = useMemo(() => keLatLng(geom), [geom]);

  useEffect(() => {
    if (!geom) {
      setStatus({ memuat: false, galat: 'Geometry area tidak tersedia.' });
      return undefined;
    }
    const kontrol = new AbortController();
    api
      .post('/analitik/laporan-spasial/', { geometry: geom }, { signal: kontrol.signal })
      .then(({ data }) => {
        spasialDataRef.current = data;
        setSpasialData(data);
        setStatus({ memuat: false, galat: null });
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        setStatus({ memuat: false, galat: err.response?.data?.detail || 'Gagal menyusun laporan spasial.' });
      });
    return () => kontrol.abort();
  }, [geom]);

  const kodeBps =
    result?.spasial?.wilayah?.kode_bps ||
    (spasialDataRef.current?.bagian || [])
      .find((b) => b.kunci === 'wilayah')?.baris?.[0]?.kode_bps ||
    null;
  const kodeKab = (spasialData?.bagian || []).find((b) => b.kunci === 'wilayah')?.kabupaten_terdekat?.kode_bps;
  const kunciBps = `${kodeBps}-${kodeKab || ''}`;

  useEffect(() => {
    if (tema !== 'sosial' || !kodeBps || bps.kunci === kunciBps) return undefined;
    const kontrol = new AbortController();
    setBps({ memuat: true, data: null, galat: null, kunci: kunciBps });
    api
      .get('/analitik/statistik-bps/', { params: { provinsi: kodeBps, kabupaten: kodeKab }, signal: kontrol.signal })
      .then(({ data }) => setBps({ memuat: false, data, galat: null, kunci: kunciBps }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        setBps({ memuat: false, data: null, galat: 'Gagal membaca statistik ketenagakerjaan.', kunci: kunciBps });
      });
    return () => kontrol.abort();
  }, [tema, kunciBps]); // eslint-disable-line react-hooks/exhaustive-deps

  const eksporPdf = async () => {
    setMembuatPdf(true);
    const selesai = mulaiMemuat('Menyusun PDF laporan analisis');
    try {
      let dataBps = bps.data;
      if (!dataBps && kodeBps) {
        try {
          const { data } = await api.get('/analitik/statistik-bps/', {
            params: { provinsi: kodeBps, kabupaten: kodeKab },
          });
          dataBps = data;
          setBps({ memuat: false, data, galat: null, kunci: kunciBps });
        } catch {
        }
      }
      await unduhPdfLaporan({
        bencana: bencana.data,
        namaProyek: namaProyek || 'Laporan Analisis Ruang Laut',
        subjudul: [jenisInvestasi, result?.spasial?.wilayah?.provinsi]
          .filter(Boolean)
          .join(' · '),
        jenisInvestasi,
        analisis: normalkanAnalisis(result),
        spasial: spasialData,
        bps: dataBps,
      });
    } catch (e) {
      alert(`Gagal menyusun PDF: ${e.message}`);
    } finally {
      selesai();
      setMembuatPdf(false);
    }
  };

  const simpanKePipeline = async () => {
    setMenyimpan(true);
    try {
      const { data: disimpan } = await api.post('/pipeline/proyek/', {
          nama: namaProyek || 'Proyek Tanpa Nama',
          investor: investor || '',
          lokasi_detail: lokasiDetail || result?.spasial?.wilayah?.provinsi || '',
          sektor: result?.sektor || 'PERIKANAN_BUDIDAYA',
          nilai_investasi_miliar: result?.finansial?.capex_idr / 1e9 || 50,
          luas_ha: result?.area_ha || 0,
          geometry: geom || null,
          analisis_json: { ...result, geometry: geom },
          skor_kelayakan: result?.kelayakan?.skor_ahp_total || 0,
          proyeksi_tenaga_kerja: result?.ketenagakerjaan?.total_tenaga_kerja || 0,
          status: 'LOI',
      });

      if (disimpan?.catatan_wilayah) alert(disimpan.catatan_wilayah);

      navigate('/pipeline');
    } catch (e) {
      alert(`Terjadi kesalahan: ${e.response ? pesanGalatSimpan(e) : e.message}`);
    } finally {
      setMenyimpan(false);
    }
  };

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-1.5">Laporan tidak tersedia</h2>
          <p className="text-[14px] text-slate-500 mb-5">
            Jalankan analisis dari peta terlebih dahulu.
          </p>
          <button
            onClick={() => navigate('/peta')}
            className="px-4 py-2 rounded bg-kkp-700 text-white text-[14px] font-semibold hover:bg-kkp-800"
          >
            Kembali ke Peta Spasial
          </button>
        </div>
      </div>
    );
  }

  const area = spasialData?.area;
  const bagian = (kunci) => (spasialData?.bagian || []).find((b) => b.kunci === kunci);
  const temaAktif = TEMA.find((t) => t.kunci === tema);

  const kelayakan = result.kelayakan;
  const finansial = result.finansial;
  const kerja = result.ketenagakerjaan;
  const sebaran = pisahSebaranTk(kerja?.sebaran_kabupaten);
  const konteksBps = pilihKonteksBps(bps.data);
  const spasial = result.spasial;

  const KartuBencana = () => {
    if (bencana.memuat) {
      return (
        <KartuLaporan judul="Risiko Bencana Pesisir">
          <p className="text-[13px] text-slate-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung indeks risiko bencana…
          </p>
        </KartuLaporan>
      );
    }
    const b = bencana.data;
    if (!b) {
      return (
        <KartuLaporan judul="Risiko Bencana Pesisir" catatan="Sumber: BNPB InaRISK">
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
            <p className="text-[13px] text-amber-800 leading-relaxed">
              {bencana.galat || 'Indeks risiko bencana tidak dapat dihitung untuk area ini.'}
            </p>
          </div>
        </KartuLaporan>
      );
    }
    if (b.kosong) {
      return (
        <KartuLaporan judul={b.judul} catatan={`Sumber: ${b.sumber}`}>
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
            <p className="text-[13px] text-amber-800 leading-relaxed">{b.catatan_kosong}</p>
          </div>
          <KotakBatimetri data={b.batimetri} />
        </KartuLaporan>
      );
    }
    return (
      <KartuLaporan
        judul={b.judul}
        pengantar={b.ringkas}
        catatan={`Sumber: ${b.sumber}`}
        keterangan={
          'Indeks risiko bernilai 0-1 per piksel raster 100 m, tersimpan di server '
          + 'sendiri. Rata-rata dihitung HANYA dari piksel yang terpapar, bukan dari '
          + 'seluruh area — karena itu persen luas terpapar ikut disebut. Kelas '
          + 'mengikuti ambang InaRISK: <0,33 rendah, <0,67 sedang, selebihnya tinggi.'
        }
      >
        <div className="space-y-2.5">
          {b.baris.map((r) => (
            <div key={r.kunci}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-700">{r.nama}</span>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                    WARNA_KELAS_RISIKO[r.kategori] || 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {r.indeks === null ? 'Tidak terpetakan' : r.kategori}
                </span>
              </div>
              {r.indeks !== null && (
                <>
                  <div className="mt-1 h-2 rounded bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${Math.min(100, r.indeks * 100)}%`,
                        backgroundColor:
                          r.kategori === 'TINGGI' ? '#e11d48'
                            : r.kategori === 'SEDANG' ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400 font-mono-custom">
                    <span>rata-rata {nf(r.indeks, 3)}</span>
                    <span>tertinggi {nf(r.maks, 3)}</span>
                  </div>
                  {r.cakupan_persen != null && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {nf(r.cakupan_persen, 1)}% luas area terpapar; indeks dihitung
                      dari bagian itu saja.
                    </p>
                  )}
                </>
              )}
              {r.keterangan && (
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">{r.keterangan}</p>
              )}
            </div>
          ))}
        </div>
        <KotakBatimetri data={b.batimetri} />
      </KartuLaporan>
    );
  };

  const KartuIrisan = ({ kunci, judul, kolomNama = 'Peruntukan' }) => {
    const b = bagian(kunci);
    if (!b) return null;
    if (b.kosong) {
      return (
        <KartuLaporan judul={judul} catatan={`Sumber: ${b.sumber}`}>
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
            <p className="text-[13px] text-amber-800 leading-relaxed">{b.catatan_kosong}</p>
          </div>
        </KartuLaporan>
      );
    }
    if (b.ukuran === 'jarak') {
      return (
        <KartuLaporan
          judul={judul}
          pengantar={b.ringkas}
          catatan={`Sumber: ${b.sumber} · ${nf(b.objek_diperiksa)} objek diperiksa`}
        >
          <TabelRingkas
            kolom={[kolomNama, 'Jarak & arah dari titik pusat area']}
            baris={b.baris.map((r) => [r.nama, r.keterangan || `${nf(r.jarak_km, 1)} km`])}
          />
        </KartuLaporan>
      );
    }
    return (
      <KartuLaporan
        judul={judul}
        pengantar={b.ringkas}
        catatan={`Persentase pada tabel dihitung terhadap luas area analisis${
          area ? ` (${nf(area.luas_ha)} ha)` : ''
        } · Sumber: ${b.sumber} · ${nf(b.objek_diperiksa)} objek diperiksa`}
      >
        <Donat
          data={b.grafik.map((g) => ({ label: g.label, nilai: g.nilai }))}
          palet={PALET}
          catatan="Angka pada grafik ini adalah bagian dari total luas yang beririsan — bukan dari luas area analisis seperti pada tabel di bawah."
        />
        <div className="mt-3">
          <TabelRingkas
            kolom={[kolomNama, 'Luas (ha)', '% area analisis']}
            baris={b.baris.map((r) => [r.nama, nf(r.luas_ha, 1), `${nf(r.persen, 2)}%`])}
          />
        </div>
      </KartuLaporan>
    );
  };

  const KartuJarak = ({ kunci, judul }) => {
    const b = bagian(kunci);
    if (!b) return null;
    if (b.kosong) {
      return (
        <KartuLaporan judul={judul} catatan={`Sumber: ${b.sumber}`}>
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
            <p className="text-[13px] text-amber-800 leading-relaxed">{b.catatan_kosong}</p>
          </div>
        </KartuLaporan>
      );
    }
    return (
      <KartuLaporan
        judul={judul}
        pengantar={b.ringkas}
        catatan={`Sumber: ${b.sumber} · ${nf(b.objek_diperiksa)} objek diperiksa`}
      >
        <TabelRingkas
          kolom={['Objek terdekat', 'Kategori', 'Jarak (km)']}
          baris={b.baris.map((r) => [
            r.nama,
            r.kategori,
            r.beririsan ? 'di dalam area' : nf(r.jarak_km, 2),
          ])}
        />
      </KartuLaporan>
    );
  };

  return (
    <div className="h-full flex bg-white pt-[72px] print:pt-0">
      <nav
        className={`w-12 lg:w-14 shrink-0 border-r border-slate-200 bg-slate-50 flex-col items-center py-3 gap-1 print:hidden ${
          panelTerlipat ? 'hidden' : 'flex'
        }`}
      >
        <button
          onClick={() => navigate(-1)}
          title="Kembali"
          className="w-9 lg:w-10 h-9 lg:h-10 rounded flex items-center justify-center text-slate-400 hover:text-kkp-700 hover:bg-white mb-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {TEMA.map(({ kunci, label, Ikon }) => {
          const ini = tema === kunci;
          return (
            <button
              key={kunci}
              onClick={() => setTema(kunci)}
              title={label}
              className={`w-9 lg:w-10 h-9 lg:h-10 rounded flex items-center justify-center transition-colors ${
                ini ? 'bg-kkp-700 text-white' : 'text-slate-400 hover:text-kkp-700 hover:bg-white'
              }`}
            >
              <Ikon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <div
        className={`flex-1 min-w-0 lg:flex-none lg:w-[55%] lg:min-w-[520px] lg:max-w-[860px] lg:shrink-0 border-r border-slate-200 flex-col ${
          panelTerlipat ? 'hidden' : 'flex'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-kkp-700 tracking-wide">
              {temaAktif.label}
            </div>
            <h1 className="text-[19px] font-bold text-slate-900 leading-tight truncate">
              {namaProyek || 'Laporan Analisis'}
            </h1>
            <p className="text-[11.5px] text-slate-400 truncate">
              {jenisInvestasi}
            </p>
          </div>
          <div className="flex gap-1 shrink-0 print:hidden">
            <button
              onClick={eksporPdf}
              disabled={membuatPdf}
              title="Export PDF"
              className="p-1.5 rounded text-slate-400 hover:text-kkp-700 hover:bg-slate-100 disabled:opacity-40"
            >
              {membuatPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => window.print()}
              title="Cetak halaman"
              className="p-1.5 rounded text-slate-400 hover:text-kkp-700 hover:bg-slate-100"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={simpanKePipeline}
              disabled={menyimpan}
              title="Tambahkan proyek ini ke Pipeline Investasi"
              className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] font-semibold
                         text-white bg-kkp-700 hover:bg-sky-600 disabled:opacity-40 transition-colors
                         print:hidden"
            >
              {menyimpan ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {menyimpan ? 'Menyimpan…' : 'Tambah ke Pipeline'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 print:overflow-visible">
          <p className="text-[13px] text-slate-500 leading-relaxed mb-4">{PENGANTAR[tema]}</p>

          {status.memuat && tema !== 'kelayakan' && tema !== 'sosial' && tema !== 'risiko' && (
            <div className="flex items-center gap-2 text-[13px] text-slate-400 py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              Menghitung irisan spasial…
            </div>
          )}

          {status.galat && tema !== 'risiko' && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded mb-4">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-px" />
              <p className="text-[13px] text-rose-700 leading-relaxed">{status.galat}</p>
            </div>
          )}

          {tema === 'umum' && area && (
            <>
              {jenisInvestasi && (
                <KartuLaporan
                  judul="Jenis Investasi"
                >
                  <AngkaBesar item={[{ nilai: jenisInvestasi, satuan: 'Sektor investasi' }]} />
                </KartuLaporan>
              )}
              <KartuLaporan
                judul="Luas Area Laporan"
                pengantar="Ukuran area tidak selalu menggambarkan luas dampak sebenarnya. Dampak kumulatif atau sementara dapat berada di dalam maupun jauh di luar batas ini."
                catatan="Luas dihitung pada elipsoid WGS84 (PostGIS ::geography), bukan pada proyeksi peta."
              >
                <AngkaBesar
                  item={[
                    { nilai: nf(area.luas_ha, 2), satuan: 'Hektare' },
                    { nilai: nf(area.luas_m2), satuan: 'Meter persegi' },
                  ]}
                />
                <TabelTitikSudut titikSudut={area.titik_sudut} />
              </KartuLaporan>

              <KartuIrisan kunci="wilayah" judul="Wilayah Administratif" kolomNama="Provinsi" />
              <KartuTabelSpasial bagian={bagian('oseanografi')} />
              <KartuTabelSpasial bagian={bagian('karbon_biru')} />
            </>
          )}

          {tema === 'ruang' && (
            <>
              {result?.screening && (
                <KartuLaporan judul="Screening Kesesuaian Ruang (Tahap 1)" catatan={CATATAN_SCREENING}>
                  <KartuScreening screening={result.screening} />
                </KartuLaporan>
              )}
              <KartuIrisan kunci="tata_ruang" judul="Rencana Tata Ruang Laut" />
              <KartuIrisan kunci="kkprl" judul="Izin KKPRL yang Berlaku" kolomNama="Pemegang izin" />
              <KartuBencana />
            </>
          )}

          {tema === 'transportasi' && (
            <>
              <KartuJarak kunci="unsur" judul="Alur Pelayaran & Unsur Ruang Laut" />
              <KartuJarak kunci="infrastruktur" judul="Infrastruktur Pendukung" />
            </>
          )}

          {tema === 'risiko' && (
            <KartuRisikoRuang
              risiko={spasialData?.risiko_ruang}
              memuat={status.memuat}
              galat={status.galat}
            />
          )}

          {tema === 'kelayakan' && (
            <>
              {finansial && (
                <KartuLaporan
                  judul="Proyeksi Arus Kas (DCF)"
                  pengantar={`Discount rate ${nf(finansial.wacc_pct, 1)}% selama ${finansial.project_lifetime_yr} tahun.`}
                  catatan="Angka finansial berasal dari parameter yang dimasukkan pengguna, bukan dari survei lapangan."
                >
                  <AngkaBesar
                    item={[
                      { nilai: rupiahRingkas(finansial.npv_idr), satuan: 'NPV (Rp)' },
                      { nilai: `${nf(finansial.irr_pct, 1)}%`, satuan: 'IRR' },
                      {
                        nilai: finansial.payback_tercapai === false ? 'tidak tercapai' : nf(finansial.payback_period_tahun, 1),
                        satuan: 'Payback (thn)',
                      },
                    ]}
                  />
                  <div className="mt-2">
                    <TabelRingkas
                      kolom={['Parameter', 'Nilai']}
                      baris={[
                        ['CapEx (Capital Expenditure)', `Rp ${rupiahRingkas(finansial.capex_idr)}`],
                        ['Pendapatan tahun pertama', `Rp ${rupiahRingkas(finansial.annual_revenue_idr)}`],
                        ['OpEx (Operational Expenditure) tahun pertama', `Rp ${rupiahRingkas(finansial.annual_opex_idr)}`],
                        ['Pertumbuhan pendapatan per tahun', finansial.revenue_growth_pct != null ? `${nf(finansial.revenue_growth_pct, 1)}%` : '—'],
                        ['Pertumbuhan OpEx per tahun', finansial.opex_growth_pct != null ? `${nf(finansial.opex_growth_pct, 1)}%` : '—'],
                        ['ROI', `${nf(finansial.roi_pct, 0)}%`],
                      ]}
                    />
                  </div>
                  {(finansial.sensitivitas?.pendapatan?.length
                    || finansial.sensitivitas?.biaya?.length) > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <BarisLipat judul="Analisis sensitivitas">
                        <p className="text-[12px] text-slate-500 mb-2 leading-snug">
                          Seberapa jauh hasilnya bergeser bila satu asumsi meleset, sementara asumsi
                          lainnya tetap. CapEx, discount rate, dan umur proyek tetap pada nilai dasarnya.
                        </p>
                        {finansial.sensitivitas.pendapatan?.length > 0 && (
                          <>
                            <p className="text-[12.5px] font-bold text-slate-700 mt-1 mb-1">
                              Pendapatan tahunan bergeser
                            </p>
                            <TabelRingkas
                              kolom={KOLOM_SENSITIVITAS}
                              baris={barisSensitivitas(finansial.sensitivitas.pendapatan)}
                            />
                          </>
                        )}
                        {finansial.sensitivitas.biaya?.length > 0 && (
                          <>
                            <p className="text-[12.5px] font-bold text-slate-700 mt-3 mb-1">
                              Biaya operasional tahunan bergeser
                            </p>
                            <TabelRingkas
                              kolom={KOLOM_SENSITIVITAS}
                              baris={barisSensitivitas(finansial.sensitivitas.biaya)}
                            />
                          </>
                        )}
                      </BarisLipat>
                    </div>
                  )}
                </KartuLaporan>
              )}

              <KartuSkorBagian baris={skorTema('kelayakan')} />

              {kelayakan && (
                <KartuLaporan
                  judul="Penilaian Multi-Kriteria (AHP)"
                  pengantar={`Keputusan ${kelayakan.keputusan?.replace(/_/g, ' ')}, prioritas ${kelayakan.prioritas}, kelas risiko ${kelayakan.kelas_risiko}.`}
                  catatan={`Rasio konsistensi ${nf(kelayakan.consistency_ratio, 4)} — ${
                    kelayakan.is_consistent ? 'matriks konsisten' : 'matriks TIDAK konsisten, bobot perlu ditinjau'
                  }.`}
                  keterangan="Skor tiap aspek dikalikan bobot hasil AHP, lalu dijumlahkan. Bobot berasal dari matriks perbandingan berpasangan antar-kriteria."
                >
                  <AngkaBesar
                    item={[
                      {
                        nilai: nf(kelayakan.skor_ahp_total, 2),
                        satuan: 'Skor AHP',
                        warna: warnaStatus(kelayakan.keputusan),
                      },
                      {
                        nilai: kelayakan.keputusan?.replace(/_/g, ' '),
                        satuan: 'Keputusan',
                        warna: warnaStatus(kelayakan.keputusan),
                      },
                      {
                        nilai: kelayakan.prioritas,
                        satuan: 'Prioritas',
                        warna: warnaStatus(kelayakan.prioritas),
                      },
                    ]}
                  />
                  <div className="mt-3">
                    <Donat
                      data={Object.entries(kelayakan.bobot_kriteria || {}).map(([k, v]) => ({
                        label: namaAspek(k),
                        nilai: v * 100,
                      }))}
                      palet={PALET}
                    />
                  </div>
                  <div className="mt-2">
                    <TabelRingkas
                      kolom={['Aspek penilaian', 'Skor', 'Bobot']}
                      baris={Object.entries(kelayakan.skor_per_aspek || {}).map(([k, v]) => [
                        <div>
                          <div>{namaAspek(k)}</div>
                          <div className="text-[11.5px] text-slate-400 leading-snug mt-0.5">
                            {ASPEK_AHP[k]?.dari || ''}
                          </div>
                        </div>,
                        nf((v.skor || 0) * 100, 1) + '%',
                        nf((v.bobot || 0) * 100, 1) + '%',
                      ])}
                    />
                  </div>
                </KartuLaporan>
              )}

              {kelayakan?.strategi_mitigasi?.length > 0 && (
                <KartuLaporan judul="Temuan & Strategi Mitigasi">
                  <ul className="space-y-2">
                    {kelayakan.strategi_mitigasi.map((m, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-slate-600 leading-relaxed">
                        <span className="text-kkp-700 font-bold shrink-0">{i + 1}.</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </KartuLaporan>
              )}
            </>
          )}

          {tema === 'sosial' &&
            (kerja ? (
              <>
              <KartuLaporan
                judul="Perkiraan Serapan Tenaga Kerja"
                pengantar="Angka serapan berasal dari rencana operasional yang diisi penyusun analisis; ia tidak dimodelkan dari nilai investasi."
                catatan="Konteks pasar kerja wilayah ada pada kartu berikutnya, bersumber dari BPS."
              >
                {kerja.total_tenaga_kerja != null ? (
                  <AngkaBesar
                    item={[{ nilai: nf(kerja.total_tenaga_kerja), satuan: 'Tenaga kerja' }]}
                  />
                ) : (
                  <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 my-2 leading-relaxed">
                    Serapan tenaga kerja <b>belum diisi</b>. Isi kolom &ldquo;Estimasi Serapan
                    Tenaga Kerja&rdquo; saat menjalankan analisis; angka itu tidak dapat
                    diturunkan dari nilai investasi.
                  </p>
                )}
                {kerja.kebutuhan_pelatihan?.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <p className="text-[12.5px] font-semibold text-slate-700 mb-1">
                      Kebutuhan pelatihan — {kerja.sektor_nama || kerja.sektor || 'sektor tidak dikenal'}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mb-2 leading-snug">
                      Kompetensi yang dibutuhkan kategori investasi ini, beserta lembaga
                      penyelenggara dan skema sertifikasinya.
                    </p>
                    <TabelRingkas
                      kolom={['Kompetensi', 'Bulan']}
                      baris={kerja.kebutuhan_pelatihan.map((p) => [
                        <div key={p.keahlian}>
                          <div>{p.keahlian}</div>
                          <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                            {[p.lembaga, p.skema].filter(Boolean).join(' · ')}
                          </div>
                        </div>,
                        p.durasi_bulan,
                      ])}
                    />
                  </div>
                )}
              </KartuLaporan>

              {sebaran.tampilkan && (
                <KartuLaporan
                  judul="Perkiraan Asal Tenaga Kerja"
                  pengantar={`Kabupaten/kota tempat area proyek berada: ${sebaran.diArea
                    .map((r) => r.kabupaten_kota)
                    .join(', ')}.`}
                  catatan="Sumber kolam tenaga kerja: statistik kabupaten/kota Portal Satu Data KKP."
                  keterangan={
                    'Ini perkiraan DARI MANA tenaga kerja berasal, BUKAN berapa lapangan '
                    + 'kerja yang tercipta di tiap kabupaten. Pertanyaan kedua menuntut tabel '
                    + 'input-output dan pengganda regional yang datanya tidak ada di sini, dan '
                    + 'selisih dua istilah itu akan ditanyakan pemeriksa. '
                    + 'Pembagiannya: kolam tenaga kerja dikali peluruhan jarak yang menurun '
                    + 'lurus sampai nol pada radius 100 km — sengaja sesederhana itu supaya '
                    + 'dapat diperiksa dengan pensil. Kolamnya berbeda menurut sektor: proyek '
                    + 'perikanan menarik tenaga dari nelayan yang sudah ada, bukan dari seluruh '
                    + 'penduduk, dan kolom Kolam menyebutkan mana yang dipakai tiap baris.'
                  }
                >
                  <TabelRingkas
                    kolom={['Kabupaten/Kota', 'Jarak (km)', 'Kolam', 'Orang', '%']}
                    baris={sebaran.diArea.map((r) => [
                      r.kabupaten_kota,
                      nf(r.jarak_km, 1),
                      `${nf(r.kolam_tenaga_kerja)} ${r.jenis_kolam}`,
                      nf(r.perkiraan_asal_tk),
                      `${nf(r.persen, 1)}%`,
                    ])}
                  />
                  {sebaran.orangLain > 0 && (
                    <p className="text-[12px] text-slate-500 mt-2 leading-snug">
                      {nf(sebaran.orangLain)} orang lainnya diperkirakan berasal dari{' '}
                      {sebaran.lain.length} kabupaten/kota lain dalam radius 100 km, dan tidak
                      didaftar di sini.
                    </p>
                  )}
                </KartuLaporan>
              )}

              <KartuLaporan
                judul="Konteks Ketenagakerjaan Wilayah (BPS)"
                pengantar="Angka serapan proyek baru bermakna bila dibandingkan dengan pasar kerja setempat. Data berikut bersumber dari WebAPI Badan Pusat Statistik untuk provinsi ini, dirinci per kabupaten/kota."
                catatan={
                  bps.data?.tersedia
                    ? `Sumber: ${bps.data.sumber} · domain ${bps.data.domain}`
                      + (bps.data.diperiksa_pada
                        ? ` · diperiksa terhadap BPS ${bps.data.diperiksa_pada}`
                        : '')
                    : 'Sumber: Badan Pusat Statistik — WebAPI'
                }
                keterangan="Cakupan variabel BPS berbeda antar provinsi. Pada tingkat kabupaten/kota, WebAPI hanya memaparkan statistik harga; angka ketenagakerjaan tersedia di domain provinsi dengan rincian per kabupaten/kota di dalamnya."
              >
                {bps.memuat && (
                  <p className="text-[13px] text-slate-400 flex items-center gap-2 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengambil data dari BPS… (panggilan pertama untuk satu provinsi bisa
                    memakan belasan detik)
                  </p>
                )}

                {bps.galat && (
                  <p className="text-[13px] text-rose-600">{bps.galat}</p>
                )}

                {!bps.memuat && !bps.galat && !kodeBps && (
                  <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                    Provinsi area ini belum dapat ditentukan, sehingga statistik BPS tidak
                    dapat diambil.
                  </p>
                )}

                {bps.data && !bps.data.tersedia && (
                  <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                    {bps.data.catatan || 'BPS tidak memuat statistik ketenagakerjaan untuk wilayah ini.'}
                  </p>
                )}

                {bps.data?.tersedia && konteksBps && (
                  konteksBps.kosong ? (
                    <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 leading-snug">
                      {konteksBps.alasanKosong} Tarik ulang dengan: manage.py tarik_statistik_bps
                      (domain nasional selalu ikut, tanpa --provinsi)
                    </p>
                  ) : (
                    <>
                      <p className="text-[12.5px] text-slate-500 mb-2 leading-snug">
                        {konteksBps.wilayah} — {konteksBps.tahun}
                      </p>
                      <TabelRingkas
                        kolom={['Indikator', 'Wilayah', 'Nilai', 'Tahun']}
                        baris={konteksBps.baris.map((b) => [b.label, b.wilayah, b.teks, b.tahun])}
                      />
                      <p className="text-[11.5px] text-slate-400 mt-1.5 leading-snug">{konteksBps.catatan}</p>
                    </>
                  )
                )}
              </KartuLaporan>
              </>
            ) : (
              <KartuLaporan judul="Ketenagakerjaan">
                <p className="text-[13px] text-slate-500">
                  Analisis ini tidak menyertakan proyeksi ketenagakerjaan.
                </p>
              </KartuLaporan>
            ))}

          

          {tema !== 'kelayakan' && <KartuSkorBagian baris={skorTema(tema)} />}

          <p className="text-[11px] text-slate-300 text-center py-4">
            Diterbitkan {new Date().toLocaleDateString('id-ID')} · Kementerian Kelautan dan
            Perikanan RI
          </p>
        </div>
      </div>

      <button
        onClick={() => setPanelTerlipat((v) => !v)}
        title={panelTerlipat ? 'Tampilkan laporan analisis' : 'Sembunyikan laporan, perbesar peta'}
        className="hidden lg:flex w-4 shrink-0 items-center justify-center bg-slate-50 hover:bg-kkp-100
                   border-r border-slate-200 text-slate-400 hover:text-kkp-700 transition-colors group print:hidden"
      >
        <span className="w-4 h-14 rounded-r bg-white border border-l-0 border-slate-200 group-hover:border-kkp-200 flex items-center justify-center shadow-sm">
          {panelTerlipat ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </span>
      </button>

      <div className="hidden lg:block flex-1 relative bg-slate-100 print:hidden">
        <PetaProyek posisi={posisi} tampilkanPerkakas={panelTerlipat} />

        {panelTerlipat && (
          <button
            onClick={() => setPanelTerlipat(false)}
            className="absolute top-4 left-4 z-[1000] inline-flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm
                       text-[13px] font-semibold text-slate-600 hover:text-kkp-700 hover:border-kkp-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            Tampilkan Laporan Analisis
          </button>
        )}
      </div>
    </div>
  );
};

export default LaporanAnalisisPage;
