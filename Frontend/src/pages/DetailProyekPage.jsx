import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  FileDown,
  Info,
  Leaf,
  Loader2,
  Map as MapIcon,
  Printer,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
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
  TombolLipatPanel,
} from '../components/laporan/KartuLaporan';
import KartuScreening from '../components/laporan/KartuScreening';
import KartuRisikoRuang from '../components/laporan/KartuRisikoRuang';
import {
  ASPEK_AHP,
  PENJELASAN_RISIKO,
  namaAspek,
  normalkanAnalisis,
  pilihKonteksBps,
  itemSerapan,
  skorBagian,
  warnaStatus,
} from '../utils/normalisasiAnalisis';
import { keLatLng } from '../utils/koordinat';
import { angkaRingkas as nf, rupiahRingkas } from '../utils/pemformat';
import { unduhPdfLaporan } from '../utils/pdfLaporan';
import { mulaiMemuat } from '../components/OverlayMemuat';

const PALET = ['#0056A5', '#3d81c0', '#7aa9d6', '#a9c6e5', '#cfdff0', '#8fa3b8'];

const STAGES = [
  { key: 'LOI', label: 'Letter of Intent (LOI)', desc: 'Pernyataan minat awal dari investor.' },
  { key: 'FS', label: 'Feasibility Study (FS)', desc: 'Analisis kelayakan teknis, spasial, finansial, dan lingkungan.' },
  { key: 'DEV', label: 'Development', desc: 'Fase konstruksi, izin lanjutan (KKPRL), dan persiapan operasional.' },
  { key: 'OP', label: 'Operational', desc: 'Proyek telah aktif beroperasi penuh di ruang laut.' },
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

const TEMA = [
  { kunci: 'umum', label: 'Informasi Umum', Ikon: Info },
  { kunci: 'ruang', label: 'Tata Ruang & Perizinan', Ikon: MapIcon },
  { kunci: 'transportasi', label: 'Transportasi & Infrastruktur', Ikon: Anchor },
  { kunci: 'sosial', label: 'Sosial & Ketenagakerjaan', Ikon: Users },
  { kunci: 'risiko', label: 'Risiko Lingkungan & Sosial', Ikon: Leaf },
  { kunci: 'kelayakan', label: 'Kelayakan Investasi', Ikon: TrendingUp },
  { kunci: 'pipeline', label: 'Status & Realisasi', Ikon: Workflow },
];

const PENGANTAR = {
  umum: 'Identitas proyek, investor, lokasi, dan ukuran area yang diusulkan.',
  ruang: 'Kesesuaian area proyek terhadap rencana tata ruang laut dan izin pemanfaatan ruang laut yang berlaku, dihitung ulang dari geometri proyek yang tersimpan.',
  transportasi: 'Kedekatan area proyek dengan alur pelayaran, unsur ruang laut, dan infrastruktur pendukung.',
  kelayakan: 'Hasil penilaian kelayakan dan proyeksi arus kas yang tersimpan bersama proyek ini.',
  sosial: 'Perkiraan serapan tenaga kerja proyek dan konteks pasar kerja wilayah dari BPS.',
  pipeline: 'Posisi proyek dalam tahapan pipeline dan riwayat perubahan status.',
  risiko: PENJELASAN_RISIKO.tema,
};

const tanggal = (t) => (t ? new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

const WARNA_KELAS_RISIKO = {
  TINGGI: 'bg-rose-50 text-rose-700 border-rose-200',
  SEDANG: 'bg-amber-50 text-amber-700 border-amber-200',
  RENDAH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const DetailProyekPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [proyek, setProyek] = useState(null);
  const [muat, setMuat] = useState({ memuat: true, galat: null });
  const [tema, setTema] = useState('umum');

  const [spasial, setSpasial] = useState({ memuat: false, data: null, galat: null });
  const [bps, setBps] = useState({ memuat: false, data: null, galat: null });
  const [screening, setScreening] = useState(null);
  const konteksBps = useMemo(
    () => pilihKonteksBps(bps.data),
    [bps.data]
  );


  const [modalStatus, setModalStatus] = useState(false);
  const [modalHapus, setModalHapus] = useState(false);
  const [tahapDipilih, setTahapDipilih] = useState('');
  const [catatanStatus, setCatatanStatus] = useState('');
  const [memperbarui, setMemperbarui] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [membuatPdf, setMembuatPdf] = useState(false);

  const [panelTerlipat, setPanelTerlipat] = useState(false);

  const ambilProyek = () => {
    setMuat({ memuat: true, galat: null });
    api
      .get(`/pipeline/proyek/${id}/`)
      .then(({ data }) => {
        setProyek(data);
        setMuat({ memuat: false, galat: null });
      })
      .catch((e) => {
        const kode = e.response?.status;
        const pesan = {
          404: 'Proyek tidak ditemukan.',
          429: 'Terlalu banyak permintaan ke server. Tunggu sebentar lalu muat ulang.',
          401: 'Sesi berakhir. Masuk kembali untuk melihat proyek ini.',
          403: 'Tidak memiliki izin untuk melihat proyek ini.',
        }[kode];
        setMuat({
          memuat: false,
          galat: pesan || (kode ? `Server membalas ${kode} saat memuat proyek.` : e.message),
        });
      });
  };

  useEffect(ambilProyek, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const analisis = useMemo(() => normalkanAnalisis(proyek?.analisis_json), [proyek]);
  const geom = proyek?.geometry || analisis.geometry;
  const bencana = useMemo(() => {
    if (spasial.memuat) return { memuat: true, data: null, galat: null };
    const bagian = (spasial.data?.bagian || []).find((b) => b.kunci === 'bencana');
    return { memuat: false, data: bagian || null, galat: bagian ? null : spasial.galat };
  }, [spasial]);

  const posisi = useMemo(() => keLatLng(geom), [geom]);

  useEffect(() => {
    if (!geom || !proyek?.sektor_kode) return undefined;
    const kontrol = new AbortController();
    api
      .post('/analitik/screening/', { geometry: geom, sektor: proyek.sektor_kode }, { signal: kontrol.signal })
      .then(({ data }) => setScreening(data))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        setScreening(analisis.screening);
      });
    return () => kontrol.abort();
  }, [geom, proyek?.sektor_kode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!geom) return undefined;
    const kontrol = new AbortController();
    setSpasial({ memuat: true, data: null, galat: null });
    api
      .post('/analitik/laporan-spasial/', { geometry: geom }, { signal: kontrol.signal })
      .then(({ data }) => setSpasial({ memuat: false, data, galat: null }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        setSpasial({ memuat: false, data: null, galat: 'Gagal menyusun laporan spasial.' });
      });
    return () => kontrol.abort();
  }, [geom]); // eslint-disable-line react-hooks/exhaustive-deps

  const kodeBps =
    analisis.spasial?.wilayah?.kode_bps ||
    spasial.data?.bagian?.find((b) => b.kunci === 'wilayah')?.baris?.[0]?.kode_bps ||
    null;
  const kodeKab = spasial.data?.bagian?.find((b) => b.kunci === 'wilayah')?.kabupaten_terdekat?.kode_bps;
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
        setBps({ memuat: false, data: null, galat: 'Tidak dapat menghubungi BPS.', kunci: kunciBps });
      });
    return () => kontrol.abort();
  }, [tema, kunciBps]); // eslint-disable-line react-hooks/exhaustive-deps

  const bukaModalStatus = () => {
    setTahapDipilih(proyek?.status || 'LOI');
    setCatatanStatus('');
    setModalStatus(true);
  };

  const perbaruiStatus = async (e) => {
    if (e) e.preventDefault();
    if (!tahapDipilih) return;
    setMemperbarui(true);
    try {
      let balasan;
      try {
        balasan = await api.post(`/pipeline/proyek/${id}/update-status/`, {
          status_baru: tahapDipilih,
          catatan: catatanStatus.trim(),
        });
      } catch (galatEndpoint) {
        try {
          balasan = await api.patch(`/pipeline/proyek/${id}/`, {
            status: tahapDipilih,
            catatan: catatanStatus.trim(),
          });
        } catch (galatPatch) {
          throw new Error('Gagal memperbarui status proyek.');
        }
      }
      setProyek(balasan.data);
      setModalStatus(false);
      setCatatanStatus('');
    } catch (err) {
      alert(err.message);
    } finally {
      setMemperbarui(false);
    }
  };

  const hapusProyek = async () => {
    setMenghapus(true);
    try {
      await api.delete(`/pipeline/proyek/${id}/`);
      navigate('/pipeline', {
        state: {
          notification: {
            type: 'success',
            message: `Proyek "${proyek.nama}" berhasil dihapus dari pipeline.`,
          },
        },
      });
    } catch (err) {
      alert(`Terjadi kesalahan saat menghapus proyek: ${err.message}`);
      setMenghapus(false);
    }
  };

  const eksporPdf = async () => {
    setMembuatPdf(true);
    const selesai = mulaiMemuat('Menyusun PDF laporan proyek');
    try {
      let dataBps = bps.data;
      if (!dataBps && kodeBps) {
        try {
          const { data } = await api.get('/analitik/statistik-bps/', { params: { provinsi: kodeBps, kabupaten: kodeKab } });
          dataBps = data;
          setBps({ memuat: false, data, galat: null, kunci: kunciBps });
        } catch {
        }
      }
      await unduhPdfLaporan({
        bencana: bencana.data,
        namaProyek: proyek.nama,
        subjudul: [proyek.kode_proyek, proyek.sektor_nama, proyek.provinsi_nama]
          .filter(Boolean)
          .join(' · '),
        jenisInvestasi: proyek.sektor_nama,
        analisis: { ...analisis, screening: screening || analisis.screening },
        spasial: spasial.data,
        bps: dataBps,
      });
    } catch (e) {
      alert(`Gagal menyusun PDF: ${e.message}`);
    } finally {
      selesai();
      setMembuatPdf(false);
    }
  };

  if (muat.memuat) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400 text-[14px]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memuat proyek…
        </div>
      </div>
    );
  }

  if (muat.galat || !proyek) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 mb-1.5">Proyek tidak dapat dimuat</h2>
          <p className="text-[14px] text-slate-500 mb-5">{muat.galat}</p>
          <button
            onClick={() => navigate('/pipeline')}
            className="px-4 py-2 rounded bg-kkp-700 text-white text-[14px] font-semibold hover:bg-kkp-800"
          >
            Kembali ke Pipeline
          </button>
        </div>
      </div>
    );
  }

  const temaAktif = TEMA.find((t) => t.kunci === tema);
  const bagian = (kunci) => (spasial.data?.bagian || []).find((b) => b.kunci === kunci);
  const area = spasial.data?.area;
  const tahapSekarang = STAGES.findIndex((s) => s.key === proyek.status);

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
    if (spasial.memuat) {
      return (
        <KartuLaporan judul={judul}>
          <p className="text-[13px] text-slate-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung irisan spasial…
          </p>
        </KartuLaporan>
      );
    }
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
    if (spasial.memuat) {
      return (
        <KartuLaporan judul={judul}>
          <p className="text-[13px] text-slate-400 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung jarak…
          </p>
        </KartuLaporan>
      );
    }
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
          baris={b.baris.map((r) => [r.nama, r.kategori, r.beririsan ? 'di dalam area' : nf(r.jarak_km, 2)])}
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
          onClick={() => navigate('/pipeline')}
          title="Kembali ke Pipeline"
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
              {proyek.nama}
            </h1>
            <p className="text-[11.5px] text-slate-400 truncate">
              {[proyek.kode_proyek, proyek.sektor_nama, proyek.provinsi_nama].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex gap-1 shrink-0 print:hidden">
            <button
              onClick={eksporPdf}
              disabled={membuatPdf}
              title="Export PDF"
              className="p-1.5 rounded text-slate-400 hover:text-kkp-700 hover:bg-slate-100 disabled:opacity-40"
            >
              {membuatPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => window.print()}
              title="Cetak halaman"
              className="p-1.5 rounded text-slate-400 hover:text-kkp-700 hover:bg-slate-100"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => setModalHapus(true)}
              title="Hapus proyek"
              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 print:overflow-visible">
          <p className="text-[13px] text-slate-500 leading-relaxed mb-4">{PENGANTAR[tema]}</p>

          {tema === 'umum' && (
            <>
              {proyek.sektor_nama && (
                <KartuLaporan judul="Jenis Investasi">
                  <AngkaBesar item={[{ nilai: proyek.sektor_nama, satuan: 'Sektor investasi' }]} />
                </KartuLaporan>
              )}
              <KartuLaporan
                judul="Nilai & Ukuran Proyek"
                pengantar={proyek.deskripsi || ''}
                catatan={`Tersimpan di pipeline sejak ${tanggal(proyek.created_at)}.`}
              >
                <AngkaBesar
                  item={[
                    { nilai: `Rp ${rupiahRingkas((proyek.nilai_investasi_miliar || 0) * 1e9)}`, satuan: 'Nilai investasi' },
                    { nilai: nf(proyek.luas_ha), satuan: 'Luas (ha)' },
                    { nilai: nf(proyek.proyeksi_tenaga_kerja), satuan: 'Proyeksi TK' },
                  ]}
                />
                <div className="mt-2">
                  <TabelRingkas
                    kolom={['Keterangan', 'Isi']}
                    baris={[
                      ['Kode proyek', proyek.kode_proyek || '—'],
                      ['Investor', proyek.investor || '—'],
                      ['Provinsi', proyek.provinsi_nama || '—'],
                      ['Lokasi', proyek.lokasi_detail || '—'],
                    ]}
                  />
                </div>
              </KartuLaporan>

              {area && (
                <KartuLaporan
                  judul="Luas Area Terukur"
                  pengantar="Dihitung ulang dari geometri yang tersimpan, bukan dari kolom luas yang diisi manual."
                  catatan="Luas dihitung pada elipsoid WGS84 (PostGIS ::geography)."
                >
                  <AngkaBesar
                    item={[
                      { nilai: nf(area.luas_ha, 2), satuan: 'Hektare' },
                      { nilai: nf(area.luas_m2), satuan: 'Meter persegi' },
                    ]}
                  />
                  <TabelTitikSudut titikSudut={area.titik_sudut} />
                </KartuLaporan>
              )}

              <KartuIrisan kunci="wilayah" judul="Wilayah Administratif" kolomNama="Provinsi" />
              <KartuTabelSpasial bagian={bagian('oseanografi')} />
              <KartuTabelSpasial bagian={bagian('karbon_biru')} />
            </>
          )}

          {tema === 'ruang' && (
            <>
              {screening && (
                <KartuLaporan
                  judul="Screening Kesesuaian Ruang (Tahap 1)"
                  catatan="Dihitung ulang dari geometri proyek dengan ketentuan ruang yang berlaku saat ini. Acuan berjenjang: RTRW Provinsi, lalu Rencana Zonasi KAW, lalu RTRWN."
                >
                  <KartuScreening screening={screening} />
                </KartuLaporan>
              )}
              <KartuIrisan kunci="tata_ruang" judul="Rencana Tata Ruang Laut" />
              <KartuIrisan kunci="alokasi" judul="Alokasi Ruang Laut 1:50.000" />
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
              risiko={spasial.data?.risiko_ruang}
              memuat={spasial.memuat}
              galat={spasial.galat}
            />
          )}

          {tema === 'kelayakan' && (
            <>
              {analisis.finansial && (
                <KartuLaporan
                  judul="Proyeksi Arus Kas (DCF)"
                  pengantar={
                    analisis.finansial.wacc != null
                      ? `Discount rate ${nf(analisis.finansial.wacc, 1)}% selama ${analisis.finansial.umur ?? '—'} tahun.`
                      : ''
                  }
                  catatan="Angka finansial berasal dari parameter yang dimasukkan penyusun analisis."
                >
                  <AngkaBesar
                    item={[
                      { nilai: `Rp ${rupiahRingkas(analisis.finansial.npv)}`, satuan: 'NPV' },
                      { nilai: `${nf(analisis.finansial.irr, 1)}%`, satuan: 'IRR' },
                      {
                        nilai: analisis.finansial.paybackTercapai === false ? 'tidak tercapai' : nf(analisis.finansial.payback, 1),
                        satuan: 'Payback (thn)',
                      },
                    ]}
                  />
                  <div className="mt-2">
                    <TabelRingkas
                      kolom={['Parameter', 'Nilai']}
                      baris={[
                        ['CapEx (Capital Expenditure)', `Rp ${rupiahRingkas(analisis.finansial.capex)}`],
                        ['Pendapatan tahun pertama', `Rp ${rupiahRingkas(analisis.finansial.pendapatan)}`],
                        ['OpEx (Operational Expenditure) tahun pertama', `Rp ${rupiahRingkas(analisis.finansial.opex)}`],
                        ['Pertumbuhan pendapatan per tahun', analisis.finansial.tumbuhPendapatan != null ? `${nf(analisis.finansial.tumbuhPendapatan, 1)}%` : '—'],
                        ['Pertumbuhan OpEx per tahun', analisis.finansial.tumbuhOpex != null ? `${nf(analisis.finansial.tumbuhOpex, 1)}%` : '—'],
                        ['ROI', analisis.finansial.roi != null ? `${nf(analisis.finansial.roi, 0)}%` : '—'],
                      ]}
                    />
                  </div>
                  {(analisis.finansial.sensitivitas?.pendapatan?.length
                    || analisis.finansial.sensitivitas?.biaya?.length) > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <BarisLipat judul="Analisis sensitivitas">
                        <p className="text-[12px] text-slate-500 mb-2 leading-snug">
                          Seberapa jauh hasilnya bergeser bila satu asumsi meleset, sementara asumsi
                          lainnya tetap. CapEx, discount rate, dan umur proyek tetap pada nilai dasarnya.
                        </p>
                        {analisis.finansial.sensitivitas.pendapatan?.length > 0 && (
                          <>
                            <p className="text-[12.5px] font-bold text-slate-700 mt-1 mb-1">
                              Pendapatan tahunan bergeser
                            </p>
                            <TabelRingkas
                              kolom={KOLOM_SENSITIVITAS}
                              baris={barisSensitivitas(analisis.finansial.sensitivitas.pendapatan)}
                            />
                          </>
                        )}
                        {analisis.finansial.sensitivitas.biaya?.length > 0 && (
                          <>
                            <p className="text-[12.5px] font-bold text-slate-700 mt-3 mb-1">
                              Biaya operasional tahunan bergeser
                            </p>
                            <TabelRingkas
                              kolom={KOLOM_SENSITIVITAS}
                              baris={barisSensitivitas(analisis.finansial.sensitivitas.biaya)}
                            />
                          </>
                        )}
                      </BarisLipat>
                    </div>
                  )}
                </KartuLaporan>
              )}

              <KartuSkorBagian
                baris={skorBagian(analisis.kelayakan?.perAspek, analisis.spasial?.sumber, 'kelayakan')}
              />

              {analisis.kelayakan?.skor != null ? (
                <KartuLaporan
                  judul="Penilaian Kelayakan"
                  pengantar={[
                    analisis.kelayakan.keputusan
                      && `Keputusan ${analisis.kelayakan.keputusan.replace(/_/g, ' ')}`,
                    analisis.kelayakan.prioritas && `prioritas ${analisis.kelayakan.prioritas}`,
                    analisis.kelayakan.kelasRisiko && `kelas risiko ${analisis.kelayakan.kelasRisiko}`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  catatan={
                    analisis.bentuk === 'lama'
                      ? 'Analisis ini tersimpan dalam format lama; rincian bobot AHP tidak tercatat.'
                      : 'Mesin AHP · analitik.services.ahp_engine'
                  }
                >
                  <AngkaBesar
                    item={[
                      {
                        nilai: nf(analisis.kelayakan.skor, 2),
                        satuan: 'Skor AHP',
                        warna: warnaStatus(analisis.kelayakan.keputusan),
                      },
                      {
                        nilai: (analisis.kelayakan.keputusan || '—').replace(/_/g, ' '),
                        satuan: 'Keputusan',
                        warna: warnaStatus(analisis.kelayakan.keputusan),
                      },
                      {
                        nilai: analisis.kelayakan.prioritas || '—',
                        satuan: 'Prioritas',
                        warna: warnaStatus(analisis.kelayakan.prioritas),
                      },
                    ]}
                  />
                  {Object.keys(analisis.kelayakan.bobot || {}).length > 0 && (
                    <div className="mt-3">
                      <Donat
                        data={Object.entries(analisis.kelayakan.bobot).map(([k, v]) => ({
                          label: namaAspek(k),
                          nilai: v * 100,
                        }))}
                        palet={PALET}
                      />
                    </div>
                  )}
                  {Object.keys(analisis.kelayakan.perAspek || {}).length > 0 && (
                    <div className="mt-2">
                      <TabelRingkas
                        kolom={['Aspek penilaian', 'Skor', 'Bobot']}
                        baris={Object.entries(analisis.kelayakan.perAspek).map(([k, v]) => [
                          <div>
                            <div>{namaAspek(k)}</div>
                            <div className="text-[11.5px] text-slate-400 leading-snug mt-0.5">
                              {ASPEK_AHP[k]?.dari || ''}
                            </div>
                          </div>,
                          `${nf((v.skor || 0) * 100, 1)}%`,
                          `${nf((v.bobot || 0) * 100, 1)}%`,
                        ])}
                      />
                    </div>
                  )}
                </KartuLaporan>
              ) : (
                <KartuLaporan judul="Penilaian Kelayakan">
                  <p className="text-[13px] text-slate-500">
                    Proyek ini belum memiliki hasil analisis kelayakan yang tersimpan.
                  </p>
                </KartuLaporan>
              )}

              {analisis.penyaring.length > 0 && (
                <KartuLaporan
                  judul="Hasil Mesin Penyaring"
                  pengantar="Tersimpan pada analisis lama, mencatat hasil empat mesin penyaring alih-alih rincian bobot AHP."
                  catatan="Tidak dihitung ulang."
                >
                  {analisis.penyaring.map((f, i) => (
                    <div key={i} className="mb-2 last:mb-0">
                      <BarisLipat judul={`${f.filter_name || f.name || 'Penyaring'} — ${f.status || (f.passed ? 'LULUS' : 'TIDAK LULUS')}`}>
                        {typeof f.detail === 'string' ? (
                          <p className="text-[13px] text-slate-600 leading-relaxed">{f.detail}</p>
                        ) : f.detail && typeof f.detail === 'object' ? (
                          <TabelRingkas
                            kolom={['Indikator', 'Nilai']}
                            baris={Object.entries(f.detail).map(([nama, v]) => [
                              nama.replace(/_/g, ' '),
                              typeof v === 'number' ? nf(v, v % 1 ? 2 : 0) : String(v),
                            ])}
                          />
                        ) : null}
                      </BarisLipat>
                    </div>
                  ))}
                </KartuLaporan>
              )}

              {analisis.kelayakan?.mitigasi?.length > 0 && (
                <KartuLaporan judul="Temuan & Strategi Mitigasi">
                  <ul className="space-y-2">
                    {analisis.kelayakan.mitigasi.map((m, i) => (
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

          {tema === 'sosial' && (
            <>
              {analisis.kerja ? (
                <KartuLaporan
                  judul="Perkiraan Serapan Tenaga Kerja"
                  pengantar="Angka serapan berasal dari rencana operasional yang diisi penyusun analisis."
                >
                  {analisis.kerja.total != null ? (
                    <AngkaBesar
                      item={itemSerapan(analisis.kerja.total, analisis.finansial?.capex)}
                    />
                  ) : (
                    <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 my-2 leading-relaxed">
                      Serapan tenaga kerja <b>belum diisi</b> pada analisis ini. Isi kolom
                      &ldquo;Estimasi Serapan Tenaga Kerja&rdquo; saat menjalankan analisis;
                      angka itu tidak dapat diturunkan dari nilai investasi.
                    </p>
                  )}
                  {analisis.kerja.pelatihan?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <p className="text-[12.5px] font-semibold text-slate-700 mb-1">
                        Kebutuhan pelatihan — {analisis.kerja.sektorNama || analisis.kerja.sektor || 'sektor tidak dikenal'}
                      </p>
                      <p className="text-[11.5px] text-slate-500 mb-2 leading-snug">
                        Kompetensi yang dibutuhkan kategori investasi ini, beserta lembaga
                        penyelenggara dan skema sertifikasinya.
                      </p>
                      <TabelRingkas
                        kolom={['Kompetensi']}
                        baris={analisis.kerja.pelatihan.map((p) => [
                          <div key={p.keahlian}>
                            <div>{p.keahlian}</div>
                            <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                              {[p.lembaga, p.skema].filter(Boolean).join(' · ')}
                            </div>
                          </div>,
                        ])}
                      />
                    </div>
                  )}
                </KartuLaporan>
              ) : (
                <KartuLaporan judul="Ketenagakerjaan">
                  <p className="text-[13px] text-slate-500">
                    Proyek ini tidak menyimpan proyeksi ketenagakerjaan.
                  </p>
                </KartuLaporan>
              )}

              <KartuLaporan
                judul="Konteks Ketenagakerjaan Wilayah (BPS)"
                pengantar="Angka serapan proyek baru bermakna bila dibandingkan dengan pasar kerja setempat."
                catatan={
                  bps.data?.tersedia
                    ? `Sumber: ${bps.data.sumber} · domain ${bps.data.domain}`
                    : 'Sumber: Badan Pusat Statistik — WebAPI'
                }
              >
                {bps.memuat && (
                  <p className="text-[13px] text-slate-400 flex items-center gap-2 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengambil data dari BPS…
                  </p>
                )}
                {bps.galat && <p className="text-[13px] text-rose-600">{bps.galat}</p>}
                {!bps.memuat && !bps.galat && !kodeBps && (
                  <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                    Provinsi proyek belum dapat ditentukan dari geometri, sehingga statistik BPS
                    tidak dapat diambil.
                  </p>
                )}
                {bps.data && !bps.data.tersedia && (
                  <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                    {bps.data.catatan}
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
          )}

          {tema === 'pipeline' && (
            <>
              <KartuLaporan
                judul="Tahapan Pipeline"
                pengantar={STAGES.find((s) => s.key === proyek.status)?.desc || ''}
              >
                <div className="space-y-2 mb-3">
                  {STAGES.map((s, i) => {
                    const lewat = i <= tahapSekarang;
                    return (
                      <div key={s.key} className="flex items-start gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${
                            lewat ? 'bg-kkp-700 text-white' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-[13px] font-semibold ${lewat ? 'text-slate-800' : 'text-slate-400'}`}>
                            {s.label}
                          </div>
                          <div className="text-[11.5px] text-slate-400 leading-snug">{s.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={bukaModalStatus}
                  className="w-full px-3 py-2 rounded bg-kkp-700 text-white text-[13px] font-semibold hover:bg-kkp-800 print:hidden"
                >
                  Perbarui Status Proyek
                </button>
              </KartuLaporan>

              {proyek.riwayat_status?.length > 0 && (
                <KartuLaporan judul="Riwayat Perubahan Status">
                  <TabelRingkas
                    kolom={['Tanggal', 'Status']}
                    baris={proyek.riwayat_status.map((h) => [
                      tanggal(h.created_at || h.tanggal),
                      h.status_baru || h.status || '—',
                    ])}
                  />
                </KartuLaporan>
              )}
            </>
          )}

          

          {tema !== 'kelayakan' && (
            <KartuSkorBagian
              baris={skorBagian(analisis.kelayakan?.perAspek, analisis.spasial?.sumber, tema)}
            />
          )}

          <p className="text-[11px] text-slate-300 text-center py-4">
            Diperbarui {tanggal(proyek.updated_at)} · Kementerian Kelautan dan Perikanan RI
          </p>
        </div>
      </div>

      <div className="hidden lg:block flex-1 relative bg-slate-100 print:hidden">
        <PetaProyek posisi={posisi} tampilkanPerkakas={panelTerlipat} />

        <TombolLipatPanel terlipat={panelTerlipat} onUbah={setPanelTerlipat} />
      </div>

      {modalStatus && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={perbaruiStatus}
            className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-[15px] font-bold text-slate-900">Perbarui Status Proyek</h3>
            </div>
            <div className="p-5 space-y-3">
              {STAGES.map((s) => (
                <label
                  key={s.key}
                  className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition-colors ${
                    tahapDipilih === s.key ? 'border-kkp-700 bg-kkp-100' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tahap"
                    value={s.key}
                    checked={tahapDipilih === s.key}
                    onChange={(e) => setTahapDipilih(e.target.value)}
                    className="accent-kkp-700 mt-0.5"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-slate-800">{s.label}</span>
                    <span className="block text-[12px] text-slate-500 leading-snug">{s.desc}</span>
                  </span>
                </label>
              ))}
              <textarea
                value={catatanStatus}
                onChange={(e) => setCatatanStatus(e.target.value)}
                placeholder="Catatan perubahan (opsional)"
                rows={3}
                className="w-full text-[13.5px] border border-slate-300 rounded p-2.5 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
              />
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalStatus(false)}
                className="px-4 py-2 rounded border border-slate-200 text-[13.5px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={memperbarui}
                className="px-4 py-2 rounded bg-kkp-700 text-white text-[13.5px] font-semibold hover:bg-kkp-800 disabled:opacity-50"
              >
                {memperbarui ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalHapus && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-900 mb-1.5">Hapus proyek ini?</h3>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">
                <b>{proyek.nama}</b> akan dihapus dari pipeline beserta seluruh catatan
                analisisnya. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setModalHapus(false)}
                className="px-4 py-2 rounded border border-slate-200 text-[13.5px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={hapusProyek}
                disabled={menghapus}
                className="px-4 py-2 rounded bg-rose-600 text-white text-[13.5px] font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {menghapus ? 'Menghapus…' : 'Hapus permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailProyekPage;
