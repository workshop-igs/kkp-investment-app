import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRupiah, formatNumber, formatRibuan, hanyaDigit } from '../../utils/pemformat';
import { api, useSektorAktif } from '../../api/klien';
import { useAuth } from '../../context/KonteksAuth';
import KartuScreening from '../laporan/KartuScreening';
import { mulaiMemuat } from '../OverlayMemuat';

const InputAngka = ({ nilai, onUbah, className, ...sisa }) => {
  const ref = useRef(null);

  const tangani = (e) => {
    const kotak = e.target;
    const digitKiri = hanyaDigit(kotak.value.slice(0, kotak.selectionStart ?? 0)).length;
    const mentah = hanyaDigit(kotak.value);
    onUbah(mentah);

    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const teks = formatRibuan(mentah);
      let terhitung = 0;
      let posisi = 0;
      while (posisi < teks.length && terhitung < digitKiri) {
        if (/\d/.test(teks[posisi])) terhitung += 1;
        posisi += 1;
      }
      el.setSelectionRange(posisi, posisi);
    });
  };

  return (
    <input
      {...sisa}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatRibuan(nilai)}
      onChange={tangani}
      className={className}
    />
  );
};

const getBbox = (geometry) => {
  if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  geometry.coordinates[0].forEach(([lng, lat]) => {
    minX = Math.min(minX, lng);
    minY = Math.min(minY, lat);
    maxX = Math.max(maxX, lng);
    maxY = Math.max(maxY, lat);
  });
  const padding = 0.005; 
  return `${minX - padding},${minY - padding},${maxX + padding},${maxY + padding}`;
};

const LANGKAH = ['Identitas Proyek', 'Analisis Ruang', 'Analisis Finansial'];

const PanelAnalisis = ({ result, loading, onAnalyze, hasGeometry, geometry, sektorAwal, onLihatLokasi }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [projectName, setProjectName] = useState("");
  const [investor, setInvestor] = useState("");
  const [lokasiDetail, setLokasiDetail] = useState("");
  
  const [sektor, setSektor] = useState(sektorAwal || "PERIKANAN_BUDIDAYA");
  useEffect(() => {
    if (sektorAwal) setSektor(sektorAwal);
  }, [sektorAwal]);
  const daftarSektor = useSektorAktif();
  const [capex, setCapex] = useState("");
  const [revenue, setRevenue] = useState("");
  const [opex, setOpex] = useState("");
  const [growthRev, setGrowthRev] = useState("");
  const [growthOpex, setGrowthOpex] = useState("");
  const [wacc, setWacc] = useState("");
  const [lifetime, setLifetime] = useState("");
  const [serapanTK, setSerapanTK] = useState('');

  const [saving, setSaving] = useState(false);

  const [langkah, setLangkah] = useState(1);
  const [screening, setScreening] = useState(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const sektorRef = useRef(sektor);

  useEffect(() => {
    setScreening(null);
    setLangkah(1);
  }, [geometry]);

  const periksaRuang = async (kode = sektor) => {
    sektorRef.current = kode;
    setScreening(null);
    setMemeriksa(true);
    const selesai = mulaiMemuat('Memeriksa kesesuaian ruang');
    try {
      const { data } = await api.post('/analitik/screening/', { geometry, sektor: kode });
      if (data.sektor === sektorRef.current) setScreening(data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Screening kesesuaian ruang gagal dijalankan.');
    } finally {
      selesai();
      setMemeriksa(false);
    }
  };

  const pilihSektorAlternatif = (kode) => {
    setSektor(kode);
    periksaRuang(kode);
  };

  const lanjutKeRuang = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    if (!hasGeometry) {
      alert("Silakan gambar area (poligon) pada peta terlebih dahulu.");
      return;
    }
    const kosong = [[projectName, 'Nama Proyek'], [investor, 'Investor / Badan Usaha']]
      .filter(([nilai]) => !nilai.trim())
      .map(([, label]) => label);
    if (kosong.length) {
      alert("Field berikut wajib diisi:\n\n• " + kosong.join("\n• "));
      return;
    }
    setLangkah(2);
    periksaRuang(sektor);
  };

  const handleSaveToPipeline = async () => {
    if (!projectName.trim()) {
      alert("Nama proyek harus diisi sebelum menyimpan ke Proyek Investasi.");
      return;
    }
    if (!investor.trim()) {
      alert("Nama investor / badan usaha harus diisi sebelum menyimpan ke Proyek Investasi.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nama: projectName,
        investor: investor.trim(),
        lokasi_detail: lokasiDetail.trim(),
        sektor: sektor,
        nilai_investasi_miliar: parseFloat(capex) / 1000000000,
        luas_ha: result.area_hectares || result.area_ha || 0,
        geometry: geometry,
        analisis_json: { ...result, geometry: geometry },
        skor_kelayakan: result.ahp_score || result.kelayakan?.skor_ahp_total || 0,
        proyeksi_tenaga_kerja: result.ketenagakerjaan?.total_tenaga_kerja || result.ketenagakerjaan?.total_lapangan_kerja || 0,
      };

      await api.post('/pipeline/proyek/', payload);
      alert("Proyek berhasil disimpan ke daftar Proyek Investasi pada tahap Perencanaan.");
      navigate('/pipeline');
    } catch (error) {
      console.error("Save Pipeline Error:", error);
      alert("Terjadi kesalahan saat menyimpan proyek: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const wajib = [
      [capex, "CapEx (Capital Expenditure) / Investasi Awal"],
      [revenue, "Estimasi Pendapatan Tahun Pertama"],
      [opex, "Estimasi OpEx (Operational Expenditure) Tahun Pertama"],
      [wacc, "Discount Rate"],
      [lifetime, "Umur Proyek"],
    ];
    const kosong = wajib.filter(([nilai]) => String(nilai).trim() === "").map(([, label]) => label);
    if (kosong.length > 0) {
      alert("Field berikut wajib diisi:\n\n• " + kosong.join("\n• "));
      return;
    }

    const angkaAtauNol = (v) => (String(v).trim() === "" ? 0 : parseFloat(v));

    if (
      parseFloat(opex) >= parseFloat(revenue)
      && !window.confirm(
        `OpEx tahun pertama (${formatRupiah(parseFloat(opex))}) tidak lebih kecil dari pendapatan tahun pertama `
        + `(${formatRupiah(parseFloat(revenue))}), sehingga arus kas tahun pertama sudah negatif.\n\n`
        + 'Tetap jalankan analisis?'
      )
    ) {
      return;
    }

    const hasil = await onAnalyze(sektor, {
      capex_idr: parseFloat(capex),
      annual_revenue_idr: parseFloat(revenue),
      annual_opex_idr: parseFloat(opex),
      wacc_pct: parseFloat(wacc),
      lifetime_yr: parseInt(lifetime),
      revenue_growth_pct: angkaAtauNol(growthRev),
      opex_growth_pct: angkaAtauNol(growthOpex),
      tenaga_kerja_estimasi: String(serapanTK).trim() === '' ? null : parseFloat(serapanTK),
    });

    if (hasil && hasil.success !== false) {
      navigate('/analysis-report', {
        state: {
          result: hasil,
          geometry,
          namaProyek: projectName,
          investor,
          lokasiDetail,
        },
      });
    }
  };

  const umurProyek = parseInt(lifetime, 10);
  const totalOpex = String(opex).trim() !== '' && umurProyek > 0
    ? Array.from({ length: umurProyek }, (_, t) => parseFloat(opex) * (1 + (parseFloat(growthOpex) || 0) / 100) ** t)
      .reduce((a, b) => a + b, 0)
    : null;

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      
      <div className="p-8 pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Analisis Kelayakan Investasi</h2>
        <p className="text-slate-500 mt-1">
          Isi identitas proyek, periksa kesesuaian ruang, lalu analisis finansial bila lokasi
          dinyatakan sesuai. Laporan diterbitkan setelah ketiga langkah selesai.
        </p>
      </div>

      <div className="px-8 pb-8 flex-1 flex flex-col gap-6">
        
        {!result && !loading && (
          <div className="space-y-6">
            <ol className="grid grid-cols-3 gap-2">
              {LANGKAH.map((l, i) => {
                const n = i + 1;
                const aktif = langkah === n;
                const selesai = langkah > n;
                return (
                  <li
                    key={l}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${
                      aktif ? 'border-kkp-700 bg-kkp-100' : selesai ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        aktif ? 'bg-kkp-700 text-white' : selesai ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {selesai ? '✓' : n}
                    </span>
                    <span className={`text-xs font-semibold leading-tight ${aktif ? 'text-kkp-800' : 'text-slate-600'}`}>{l}</span>
                  </li>
                );
              })}
            </ol>

            {langkah === 1 && (
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-800 mb-4 text-[15px]">Identitas Proyek</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Nama Proyek <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Contoh: Kawasan Budidaya Laut Modern Teluk..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Jenis Investasi <span className="text-red-500">*</span></label>
                    <select
                      value={sektor}
                      onChange={(e) => setSektor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700 appearance-none"
                    >
                      {daftarSektor.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">
                      Investor / Badan Usaha <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={investor}
                      onChange={(e) => setInvestor(e.target.value)}
                      placeholder="Contoh: PT Samudra Nusantara Jaya"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Nama badan usaha atau perorangan yang akan menanamkan modal.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Lokasi Detail</label>
                    <input
                      type="text"
                      value={lokasiDetail}
                      onChange={(e) => setLokasiDetail(e.target.value)}
                      placeholder="Contoh: Perairan Teluk Lamong, Kec. Benowo"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      Opsional. Provinsi dan kabupaten/kota ditentukan sendiri dari
                      poligon yang digambar.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
                  <button type="button" onClick={lanjutKeRuang} disabled={!hasGeometry} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-kkp-700 hover:bg-kkp-800 text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                    Lanjut: Analisis Ruang
                  </button>
                </div>
              </div>
            )}

            {langkah === 2 && (
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-800 mb-1 text-[15px]">Analisis Kesesuaian Ruang</h3>
                <p className="text-xs text-slate-500 mb-5">
                  Gerbangnya hanya kesesuaian ruang: RTRW Provinsi, Rencana Zonasi KAW, atau RTRWN (berjenjang) dan
                  matriks KKPRL Perda, KKPRL yang sudah terbit, serta kawasan konservasi dan alur pelayaran. Kecocokan
                  fisik (kedalaman, gelombang, dan sejenisnya) hanya menjadi peringatan. Lokasi yang tidak sesuai tidak
                  dapat dilanjutkan; lokasi yang belum terverifikasi tetap dapat dilanjutkan dengan label.
                </p>
                {memeriksa && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
                    <span className="w-4 h-4 border-2 border-kkp-700 border-t-transparent rounded-full animate-spin" />
                    Memeriksa kesesuaian ruang…
                  </div>
                )}
                {!memeriksa && screening && (
                  <KartuScreening
                    screening={screening}
                    onPilihSektor={pilihSektorAlternatif}
                    onLihatLokasi={onLihatLokasi}
                  />
                )}
                <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-200">
                  <button type="button" onClick={() => setLangkah(1)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                    Kembali
                  </button>
                  {!memeriksa && !screening && (
                    <button type="button" onClick={() => periksaRuang()} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-kkp-700 hover:bg-kkp-800 text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                      Periksa Ulang
                    </button>
                  )}
                  {screening?.lanjut && (
                    <button type="button" onClick={() => setLangkah(3)} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-kkp-700 hover:bg-kkp-800 text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                      Lanjut: Analisis Finansial
                    </button>
                  )}
                </div>
              </div>
            )}

            {langkah === 3 && screening?.lanjut && (
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-800 mb-1 text-[15px]">Parameter Finansial</h3>
                <p className="text-xs text-slate-500 mb-5">
                  Lokasi dinyatakan {screening.status_label.toLowerCase()} secara ruang untuk {screening.sektor_nama}
                  {screening.status === 'BELUM_TERVERIFIKASI' && '; analisis dilanjutkan dengan label belum terverifikasi'}.
                </p>
                <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">CapEx (Capital Expenditure) / Investasi Awal <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                      <InputAngka
                        nilai={capex}
                        onUbah={setCapex}
                        placeholder="Contoh: 50.000.000.000"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pl-9 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">Estimasi Pendapatan Tahun Pertama <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                      <InputAngka
                        nilai={revenue}
                        onUbah={setRevenue}
                        placeholder="Contoh: 18.000.000.000"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pl-9 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Tahun berikutnya naik sesuai Pertumbuhan Pendapatan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-700 mb-1.5">
                      Estimasi OpEx (Operational Expenditure) Tahun Pertama <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                      <InputAngka
                        nilai={opex}
                        onUbah={setOpex}
                        placeholder="Contoh: 9.000.000.000"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pl-9 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Tahun berikutnya naik sesuai Pertumbuhan OpEx.</p>
                  </div>
                  <div>
                    <p className="block text-sm text-slate-700 mb-1.5">Total OpEx Selama Umur Proyek</p>
                    <p className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-sm text-slate-700 tabular-nums">
                      {totalOpex === null ? '—' : formatRupiah(totalOpex)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">Dihitung otomatis dari OpEx tahun pertama, Pertumbuhan OpEx, dan Umur Proyek.</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 border-t border-slate-200 pt-6">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Pertumbuhan Pendapatan</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={growthRev}
                        onChange={(e) => setGrowthRev(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-8 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Pertumbuhan OpEx</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={growthOpex}
                        onChange={(e) => setGrowthOpex(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-8 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Discount Rate <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={wacc}
                        onChange={(e) => setWacc(e.target.value)}
                        placeholder="Contoh: 10"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-8 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Umur Proyek <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={lifetime}
                        onChange={(e) => setLifetime(e.target.value)}
                        placeholder="Contoh: 20"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-14 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">tahun</span>
                    </div>
                  </div>
                  <p className="col-span-4 -mt-2 text-xs text-slate-500">
                    Pertumbuhan pendapatan dan OpEx berlaku setiap tahun, mulai dari tahun kedua. Kosongkan bila nilainya tetap.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="block text-xs text-slate-600 mb-1.5">
                    Estimasi Serapan Tenaga Kerja
                    <span className="text-slate-400 font-normal"> (opsional)</span>
                  </label>
                  <div className="relative">
                    <InputAngka
                      nilai={serapanTK}
                      onUbah={setSerapanTK}
                      placeholder="Contoh: 1.200"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-14 text-sm text-slate-800 focus:outline-none focus:border-kkp-700 focus:ring-1 focus:ring-kkp-700"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Orang</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                    Bila diisi, angka ini yang dipakai sebagai serapan tenaga kerja. Bila
                    dikosongkan, dihitung dari rasio per sektor terhadap nilai investasi.
                  </p>
                </div>
                </div>
                <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-200">
                  <button type="button" onClick={() => setLangkah(2)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                    Kembali
                  </button>
                  <button type="button" onClick={handleSubmit} disabled={loading} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-kkp-700 hover:bg-kkp-800 text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                    {loading ? 'Menganalisis…' : 'Jalankan Analisis & Tampilkan Laporan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-slate-200 rounded-xl"></div>
            <div className="h-48 bg-slate-200 rounded-xl"></div>
            <div className="h-32 bg-slate-200 rounded-xl"></div>
          </div>
        )}
        
        {!loading && result && result.success && (
          <div className="space-y-6">
            
            {geometry && (
              <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200/60 bg-white relative group">
                <div className="absolute top-2 left-2 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded shadow-sm text-[10px] font-bold text-slate-700 z-10 border border-slate-200 uppercase tracking-wider">
                  Citra Satelit Area Proyek
                </div>
                <img 
                  src={`https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${getBbox(geometry)}&bboxSR=4326&size=800,400&imageSR=4326&format=jpg&f=image`} 
                  alt="Citra Satelit" 
                  className="w-full h-64 object-cover opacity-90 transition-opacity group-hover:opacity-100"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}

            <div className={`p-5 rounded-xl border ${result.kelayakan?.keputusan === 'LAYAK' ? 'bg-teal-50 border-teal-200' : result.kelayakan?.keputusan === 'BERSYARAT' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-sm text-slate-500">Rekomendasi Analisis MCDA & Finansial</div>
              <div className={`text-3xl font-bold mt-1 uppercase ${result.kelayakan?.keputusan === 'LAYAK' ? 'text-teal-600' : result.kelayakan?.keputusan === 'BERSYARAT' ? 'text-amber-600' : 'text-red-600'}`}>{result.kelayakan?.keputusan}</div>
              <div className="text-sm mt-2 text-slate-600">Skor AHP Terpadu: <span className="font-bold">{result.kelayakan?.skor_ahp_total?.toFixed(3)}/1.00</span></div>
              {result.screening && (
                <div className="text-sm mt-1 text-slate-600">
                  Tahap 1 (kesesuaian ruang): <span className="font-bold">{result.screening.status_label}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3 mt-2">
              <h4 className="font-bold text-slate-800 text-[15px]">Detail Metrik Proyek</h4>
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 text-sm">
                <div>
                  <div className="text-slate-500 mb-1">Total Area Luasan</div>
                  <div className="font-bold text-slate-800 text-lg">{formatNumber(result.area_ha, 2)} Ha</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Estimasi ROI</div>
                  <div className="font-bold text-emerald-600 text-lg">{formatNumber(result.finansial?.roi_pct, 1)}%</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Estimasi IRR ({result.finansial?.project_lifetime_yr} Thn)</div>
                  <div className="font-bold text-emerald-600 text-lg">{formatNumber(result.finansial?.irr_pct, 1)}%</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-1">Penyerapan Naker Lokal</div>
                  <div className="font-bold text-amber-600 text-lg">{result.ketenagakerjaan?.total_tenaga_kerja || 0} Org</div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500 mb-1">Net Present Value (NPV)</div>
                  <div className="font-bold text-emerald-600 text-lg">{formatRupiah(result.finansial?.npv_idr)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-slate-500 mb-1">Tingkat Risiko Spasial Bencana</div>
                  <div className={`font-bold text-lg ${result.kelayakan?.kelas_risiko === 'Rendah' ? 'text-teal-600' : result.kelayakan?.kelas_risiko === 'Tinggi' ? 'text-red-600' : 'text-amber-600'}`}>
                    {result.kelayakan?.kelas_risiko || 'Sedang'}
                  </div>
                </div>
              </div>
            </div>

            {result.spasial && (
              <div className="space-y-3 mt-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h4 className="font-bold text-slate-800 text-[15px]">Dasar Data Spasial</h4>
                  <span className="text-xs text-slate-500">
                    {result.spasial.wilayah?.provinsi
                      ? `${result.spasial.wilayah.provinsi}${result.spasial.wilayah.metode === 'provinsi terdekat' ? ' (terdekat)' : ''}`
                      : 'Wilayah tidak teridentifikasi'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-slate-600">Skor dari data spasial nyata</span>
                      <span className="font-bold text-slate-800">
                        {result.spasial.skor_berbasis_spasial} dari {result.spasial.total_skor}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0056A5] rounded-full transition-all"
                        style={{ width: `${(result.spasial.skor_berbasis_spasial / result.spasial.total_skor) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Sisanya memakai nilai default netral karena datanya belum tersedia di sistem.
                    </p>
                  </div>

                  {result.spasial.detail?.bencana?.length > 0 && (
                    <div>
                      <div className="text-sm text-slate-600 mb-2">Ancaman bencana pada lokasi</div>
                      <div className="flex flex-wrap gap-2">
                        {result.spasial.detail.bencana.map((b, i) => (
                          <span
                            key={i}
                            className={`px-2.5 py-1 rounded text-xs font-medium border ${
                              b.skor >= 0.7
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : b.skor >= 0.45
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-teal-50 border-teal-200 text-teal-700'
                            }`}
                          >
                            {b.label} · {b.kelas}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.spasial.catatan?.length > 0 && (
                    <ul className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                      {result.spasial.catatan.map((c, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-slate-400 shrink-0">&bull;</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 mt-8 pt-6 border-t border-slate-200">
              <button 
                onClick={() => navigate('/analysis-report', {
                  state: {
                    result,
                    geometry,
                    namaProyek: projectName,
                    investor,
                    lokasiDetail,
                  },
                })}
                className="flex-1 py-3 bg-white hover:bg-slate-50 border border-[#0056A5] text-[#0056A5] rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                Lihat Laporan Lengkap (PDF)
              </button>
              
              <button 
                onClick={handleSaveToPipeline}
                disabled={saving}
                className="flex-1 py-3 bg-[#0056A5] hover:bg-sky-600 text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                {saving ? "Menyimpan..." : "Simpan ke Proyek Investasi"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default PanelAnalisis;
