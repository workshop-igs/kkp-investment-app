import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { ArrowRight, ArrowUpRight, Download, RefreshCw, X } from 'lucide-react';
import { api } from '../api/klien';
import LapisanVektorBBox from '../components/map/LapisanVektorBBox';
import { LAYER_LOKAL } from '../components/map/katalogLapisan';
import { buatIkon, lambangSvg } from '../components/map/ikonPeta';
import { BATAS_INDONESIA } from '../components/map/PetaInteraktif';
import { Label } from './LandingPage';
import { IKON_JENIS_INVESTASI, WARNA_JENIS_INVESTASI, warnaJenisInvestasi } from '../utils/simbologiPeta';
import { LABEL_TAHAPAN, SECTORS, TAHAPAN_PROYEK } from '../utils/konstanta';
import { formatNumber, rupiahMiliar } from '../utils/pemformat';

const POTENSI = LAYER_LOKAL.potensi;
const NAVY = '#002242';
const BIRU = ['#9ec5f4', '#6da7ec', '#3987e5', '#184f95', '#0d366b'];
const WARNA_TAHAP = Object.fromEntries(TAHAPAN_PROYEK.map((t, i) => [t.kode, BIRU[i]]));
const PETA_DASAR = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const PETA_LABEL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const BATAS_DAFTAR = 10;
const FOKUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-900';

const angka = (n, d = 0) => (n === null || n === undefined || Number.isNaN(n) ? '—' : formatNumber(n, d));
const jumlah = (daftar, kunci) => daftar.reduce((t, x) => t + (Number(x[kunci]) || 0), 0);
const namaJenis = (kode) => SECTORS.find((s) => s.id === kode)?.label || kode;
const ikonProyek = buatIkon('koper', NAVY, 0.8);

const Kartu = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>
);

const JudulKartu = ({ judul, isi }) => (
  <div>
    <h3 className="text-[15px] font-bold text-kkp-900">{judul}</h3>
    {isi && <p className="mt-0.5 text-xs leading-snug text-slate-500">{isi}</p>}
  </div>
);

const JudulBagian = ({ label, nada, judul, isi }) => (
  <div className="max-w-3xl">
    <Label nada={nada}>{label}</Label>
    <h2 className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-[-0.03em] text-kkp-900 sm:text-4xl">{judul}</h2>
    <p className="mt-3 leading-relaxed text-slate-600">{isi}</p>
  </div>
);

const Lambang = ({ kode, kecil }) => (
  <span
    className={`grid shrink-0 place-items-center rounded-full shadow-sm ${kecil ? 'h-6 w-6' : 'h-8 w-8'}`}
    style={{ background: warnaJenisInvestasi(kode) }}
    dangerouslySetInnerHTML={{ __html: lambangSvg(IKON_JENIS_INVESTASI[kode], kecil ? 12 : 15) }}
    aria-hidden="true"
  />
);

const Batang = ({ nilai, maks, warna, dalam }) => (
  <span className="relative mt-1.5 block h-2 overflow-hidden rounded-full bg-slate-100">
    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${maks ? (nilai / maks) * 100 : 0}%`, backgroundColor: warna }} />
    {dalam !== undefined && (
      <span className="absolute inset-y-0 left-0 rounded-full bg-kkp-hijau" style={{ width: `${maks ? (dalam / maks) * 100 : 0}%` }} />
    )}
  </span>
);

const BarisPilih = ({ aktif, redup, onClick, children }) => (
  <button
    type="button"
    aria-pressed={aktif}
    onClick={onClick}
    className={`w-full rounded-xl px-3 py-2 text-left transition ${FOKUS} ${
      aktif ? 'bg-kkp-100 ring-1 ring-kkp-200' : 'hover:bg-slate-50'
    } ${redup ? 'opacity-50 hover:opacity-100' : ''}`}
  >
    {children}
  </button>
);

const Pilihan = ({ nilai, onUbah, kosong, opsi, label }) => (
  <select
    aria-label={label}
    value={nilai}
    onChange={(e) => onUbah(e.target.value)}
    className={`rounded-lg border px-3 py-2 text-sm font-medium text-kkp-900 focus:outline-none focus:ring-2 focus:ring-kkp-700 ${
      nilai ? 'border-kkp-700 bg-kkp-100' : 'border-slate-300 bg-white'
    }`}
  >
    <option value="">{kosong}</option>
    {opsi.map(([kode, teks]) => <option key={kode} value={kode}>{teks}</option>)}
  </select>
);

const KartuAngka = ({ label, nilai, ket, persen }) => (
  <Kartu className="flex flex-col p-5">
    <span className="text-[13px] font-semibold text-kkp-900">{label}</span>
    <span className="mt-auto pt-5 text-2xl font-extrabold tracking-[-0.02em] text-kkp-900 tabular-nums">{nilai}</span>
    {persen !== undefined && <Batang nilai={persen} maks={100} warna="#3BB273" />}
    <span className="mt-1.5 text-xs leading-snug text-slate-500">{ket}</span>
  </Kartu>
);

const FokusProvinsi = ({ provinsi }) => {
  const map = useMap();
  const [batas, setBatas] = useState(null);
  useEffect(() => {
    let batal = false;
    api.get('/inti/provinsi/peta/', { params: { ringkas: 1 } })
      .then(({ data }) => {
        if (!batal) setBatas(Object.fromEntries(data.features.map((f) => [String(f.properties.id), L.geoJSON(f).getBounds()])));
      })
      .catch(() => {});
    return () => { batal = true; };
  }, []);
  useEffect(() => {
    const b = provinsi ? batas?.[provinsi] : L.latLngBounds(BATAS_INDONESIA);
    if (b?.isValid()) map.flyToBounds(b, { padding: [24, 24], duration: 0.8 });
  }, [map, batas, provinsi]);
  return null;
};

const PetaDashboard = ({ jenis, provinsi, proyek }) => {
  const navigate = useNavigate();
  return (
    <MapContainer bounds={BATAS_INDONESIA} scrollWheelZoom={false} minZoom={4} zoomSnap={0.25} className="h-full w-full">
      <TileLayer url={PETA_DASAR} attribution="&copy; Esri" maxZoom={16} />
      <TileLayer url={PETA_LABEL} maxZoom={16} />
      <FokusProvinsi provinsi={provinsi} />
      <LapisanVektorBBox
        url={POTENSI.url}
        params={{ ...POTENSI.params, ...(jenis ? { sektor: jenis } : {}), ...(provinsi ? { provinsi } : {}) }}
        ikon={POTENSI.ikon}
        warnaIkon={POTENSI.warnaIkon}
        warnaTitik={POTENSI.warnaTitik}
        zoomPin={POTENSI.zoomPin}
        onEachFeature={(f, layer) => {
          const p = f.properties || {};
          layer.bindTooltip(POTENSI.tooltip(p), { sticky: true, className: 'map-tooltip' });
          layer.bindPopup(() => POTENSI.popup(p), { maxHeight: 400 });
          layer.on('popupopen', (e) => e.popup.getElement()?.querySelector('[data-analisis-lokasi]')
            ?.addEventListener('click', () => navigate(`/peta?lokasi=${f.id}`)));
        }}
      />
      {proyek.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={ikonProyek} zIndexOffset={1000}>
          <Popup maxWidth={280}>
            <div className="font-sans">
              <span className="font-mono text-[10px] font-semibold text-kkp-700">{p.kode_proyek}</span>
              <h4 className="mt-0.5 text-sm font-bold leading-tight text-kkp-900">{p.nama}</h4>
              <p className="mt-0.5 text-xs text-slate-500">{p.sektor_nama} · {p.provinsi_nama}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                <div><dt className="text-[10px] text-slate-400">Tahap</dt><dd className="font-semibold text-slate-800">{LABEL_TAHAPAN[p.status] || p.status}</dd></div>
                <div><dt className="text-[10px] text-slate-400">Nilai rencana</dt><dd className="font-semibold text-slate-800">{rupiahMiliar(p.nilai_investasi_miliar)}</dd></div>
              </dl>
              <Link to={`/pipeline/${p.id}`} className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-kkp-900 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-kkp-800">
                Buka detail proyek <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const [memuat, setMemuat] = useState(true);
  const [jenis, setJenis] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [tahap, setTahap] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const { data: hasil } = await api.get('/inti/dashboard/');
      setData(hasil);
    } catch (err) {
      const kode = err.response?.status;
      setGalat(kode === 401 || kode === 403
        ? 'Sesi Anda tidak lagi berlaku. Masuk kembali untuk melihat dashboard.'
        : `Data dashboard gagal dimuat${kode ? ` (${kode})` : ''}.`);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const semuaProyek = data?.proyek || [];
  const semuaPotensi = data?.potensi_wilayah || [];
  const diProvinsi = (x) => !provinsi || String(x.provinsi_id) === provinsi;
  const diJenis = (kode) => !jenis || kode === jenis;

  const proyekTanpaTahap = semuaProyek.filter((p) => diJenis(p.sektor_kode) && diProvinsi(p));
  const proyek = proyekTanpaTahap.filter((p) => !tahap || p.status === tahap);

  const potensi = semuaPotensi.filter((r) => diProvinsi(r) && (jenis ? r.kode === jenis : r.kode === null));
  const totalLokasi = jumlah(potensi, 'lokasi');
  const luasLokasi = jumlah(potensi, 'luas_ha');
  const provinsiLokasi = new Set(potensi.filter((r) => r.lokasi > 0).map((r) => r.provinsi_id)).size;

  const potensiPerJenis = SECTORS.map((s) => ({
    ...s,
    lokasi: jumlah(semuaPotensi.filter((r) => r.kode === s.id && diProvinsi(r)), 'lokasi'),
  }));
  const maksJenis = Math.max(1, ...potensiPerJenis.map((j) => j.lokasi));

  const potensiPerProvinsi = useMemo(() => {
    const kelompok = new Map();
    semuaPotensi
      .filter((r) => (jenis ? r.kode === jenis : r.kode === null))
      .forEach((r) => {
        const ada = kelompok.get(r.provinsi_id) || { id: String(r.provinsi_id), nama: r.provinsi, lokasi: 0, luas: 0 };
        ada.lokasi += r.lokasi;
        ada.luas += r.luas_ha;
        kelompok.set(r.provinsi_id, ada);
      });
    return [...kelompok.values()].sort((a, b) => b.lokasi - a.lokasi);
  }, [semuaPotensi, jenis]);
  const maksProvinsi = Math.max(1, ...potensiPerProvinsi.map((p) => p.lokasi));
  const daftarProvinsiPotensi = provinsi && !potensiPerProvinsi.slice(0, BATAS_DAFTAR).some((p) => p.id === provinsi)
    ? [...potensiPerProvinsi.slice(0, BATAS_DAFTAR - 1), ...potensiPerProvinsi.filter((p) => p.id === provinsi)]
    : potensiPerProvinsi.slice(0, BATAS_DAFTAR);

  const daftarProvinsi = useMemo(() => {
    const nama = new Map();
    semuaPotensi.forEach((r) => nama.set(String(r.provinsi_id), r.provinsi));
    semuaProyek.forEach((p) => p.provinsi_id && nama.set(String(p.provinsi_id), p.provinsi_nama));
    return [...nama.entries()].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  }, [semuaPotensi, semuaProyek]);

  const rencana = jumlah(proyek, 'nilai_investasi_miliar');
  const realisasi = jumlah(proyek, 'nilai_realisasi_miliar');
  const persenRealisasi = rencana > 0 ? (realisasi / rencana) * 100 : 0;
  const berskor = proyek.filter((p) => p.skor_kelayakan !== null && p.skor_kelayakan !== undefined);
  const rataSkor = berskor.length ? (jumlah(berskor, 'skor_kelayakan') / berskor.length) * 100 : null;

  const perTahap = TAHAPAN_PROYEK.map((t) => {
    const isi = proyekTanpaTahap.filter((p) => p.status === t.kode);
    return { ...t, jumlah: isi.length, nilai: jumlah(isi, 'nilai_investasi_miliar') };
  });

  const proyekPerJenis = SECTORS.map((s) => {
    const isi = semuaProyek.filter((p) => p.sektor_kode === s.id && diProvinsi(p) && (!tahap || p.status === tahap));
    return { ...s, jumlah: isi.length, rencana: jumlah(isi, 'nilai_investasi_miliar'), realisasi: jumlah(isi, 'nilai_realisasi_miliar') };
  }).filter((j) => j.jumlah > 0).sort((a, b) => b.rencana - a.rencana);
  const maksRencanaJenis = Math.max(1, ...proyekPerJenis.map((j) => j.rencana));

  const proyekPerProvinsi = useMemo(() => {
    const kelompok = new Map();
    semuaProyek
      .filter((p) => diJenis(p.sektor_kode) && (!tahap || p.status === tahap))
      .forEach((p) => {
        const kunci = String(p.provinsi_id ?? '');
        const ada = kelompok.get(kunci) || { id: kunci, nama: p.provinsi_nama, jumlah: 0, rencana: 0 };
        ada.jumlah += 1;
        ada.rencana += Number(p.nilai_investasi_miliar) || 0;
        kelompok.set(kunci, ada);
      });
    return [...kelompok.values()].sort((a, b) => b.rencana - a.rencana).slice(0, BATAS_DAFTAR);
  }, [semuaProyek, jenis, tahap]); // eslint-disable-line react-hooks/exhaustive-deps
  const maksRencanaProvinsi = Math.max(1, ...proyekPerProvinsi.map((p) => p.rencana));

  const adaSaringan = Boolean(jenis || provinsi || tahap);
  const alih = (setter, nilai, kini) => setter(kini === nilai ? '' : nilai);
  const namaProvinsi = daftarProvinsi.find(([id]) => id === provinsi)?.[1];

  const eksporCsv = () => {
    if (!proyek.length) return;
    const sel = (v) => (typeof v === 'number'
      ? v.toLocaleString('id-ID', { useGrouping: false, maximumFractionDigits: 2 })
      : `"${String(v ?? '').replace(/"/g, '""')}"`);
    const baris = [
      ['Kode Proyek', 'Nama Proyek', 'Investor', 'Jenis Investasi', 'Provinsi', 'Tahap', 'Nilai Investasi (Miliar Rp)',
        'Realisasi (Miliar Rp)', 'Luas (Ha)', 'Tenaga Kerja (Orang)', 'Skor Kelayakan (%)'],
      ...proyek.map((p) => [
        p.kode_proyek, p.nama, p.investor, p.sektor_nama, p.provinsi_nama, LABEL_TAHAPAN[p.status] || p.status,
        p.nilai_investasi_miliar || 0, p.nilai_realisasi_miliar || 0, p.luas_ha || 0, p.proyeksi_tenaga_kerja || 0,
        p.skor_kelayakan === null || p.skor_kelayakan === undefined ? '' : p.skor_kelayakan * 100,
      ]),
    ];
    const isi = `﻿${baris.map((r) => r.map(sel).join(';')).join('\r\n')}`;
    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    tautan.download = `KKP_Portofolio_Investasi_Nasional_${new Date().toISOString().slice(0, 10)}.csv`;
    tautan.click();
    setTimeout(() => URL.revokeObjectURL(tautan.href), 1000);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F6F8FB] pt-[72px] text-slate-800">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 2xl:max-w-[1440px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Label>Dashboard nasional</Label>
            <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.035em] text-kkp-900 sm:text-5xl">
              Potensi dan proyek investasi ruang laut
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
              Ringkasan lokasi potensial dari Peta Sebaran Wilayah Potensial dan proyek investasi yang dipantau KKP.
              Pilih jenis investasi, provinsi, atau tahap proyek; seluruh angka, daftar, dan peta di halaman ini ikut
              tersaring.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={muat}
              disabled={memuat}
              className={`inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-kkp-900 hover:border-kkp-900 disabled:opacity-50 ${FOKUS}`}
            >
              <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Perbarui
            </button>
            <button
              type="button"
              onClick={eksporCsv}
              disabled={!proyek.length}
              className={`inline-flex items-center gap-2 rounded-md bg-kkp-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-kkp-800 disabled:opacity-50 ${FOKUS}`}
            >
              <Download className="h-4 w-4 text-kkp-toska" /> Ekspor CSV proyek
            </button>
          </div>
        </header>

        <div className="relative z-30 lg:sticky lg:top-3 -mx-4 mt-8 border-y border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Saring</span>
            <Pilihan label="Jenis investasi" nilai={jenis} onUbah={setJenis} kosong="Semua jenis investasi" opsi={SECTORS.map((s) => [s.id, s.label])} />
            <Pilihan label="Provinsi" nilai={provinsi} onUbah={setProvinsi} kosong="Seluruh Indonesia" opsi={daftarProvinsi} />
            <Pilihan label="Tahap proyek" nilai={tahap} onUbah={setTahap} kosong="Semua tahap proyek" opsi={TAHAPAN_PROYEK.map((t) => [t.kode, t.label])} />
            {adaSaringan && (
              <button
                type="button"
                onClick={() => { setJenis(''); setProvinsi(''); setTahap(''); }}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-kkp-700 hover:bg-kkp-100 ${FOKUS}`}
              >
                <X className="h-4 w-4" /> Hapus saringan
              </button>
            )}
          </div>
        </div>

        {galat && <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{galat}</p>}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Link
            to="/peta?lapisan=potensi"
            className={`group col-span-2 flex flex-col rounded-2xl bg-kkp-900 p-5 text-white transition-colors hover:bg-kkp-800 ${FOKUS}`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="bg-kkp-toska px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-kkp-900">
                Lokasi potensial
              </span>
              <ArrowUpRight className="h-5 w-5 text-kkp-toska transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="mt-5 block text-5xl font-extrabold tracking-[-0.03em] text-[#BFE9F4] tabular-nums">
              {data ? angka(totalLokasi) : '…'}
            </span>
            <span className="mt-2 block text-sm leading-snug text-white/80">
              {jenis ? `untuk ${namaJenis(jenis)}` : 'untuk minimal satu jenis investasi'}
              {provinsi ? ` di ${namaProvinsi}` : ` di ${angka(provinsiLokasi)} provinsi`}, ±{angka(luasLokasi)} ha
            </span>
          </Link>
          <KartuAngka
            label="Proyek investasi"
            nilai={angka(proyek.length)}
            ket={`${angka(proyek.filter((p) => p.status === 'OPERASI').length)} sudah beroperasi`}
          />
          <KartuAngka
            label="Nilai rencana investasi"
            nilai={rupiahMiliar(rencana)}
            ket={`Realisasi ${rupiahMiliar(realisasi)} (${angka(persenRealisasi, 1)}%)`}
            persen={Math.min(100, persenRealisasi)}
          />
          <KartuAngka
            label="Serapan tenaga kerja"
            nilai={angka(jumlah(proyek, 'proyeksi_tenaga_kerja'))}
            ket="orang, proyeksi dari proyek yang tercatat"
          />
          <KartuAngka
            label="Rata-rata skor kelayakan"
            nilai={rataSkor === null ? '—' : `${angka(rataSkor)}%`}
            ket={`${angka(jumlah(proyek, 'luas_ha'), 1)} ha area proyek`}
          />
        </section>

        <section className="mt-16 space-y-6">
          <JudulBagian
            label="Potensi ruang laut"
            judul="Di mana peluang investasi berada"
            isi="Setiap titik adalah lokasi dengan sedikitnya 75% dari 5 atau lebih parameter terukurnya sangat sesuai untuk sebuah jenis investasi, di luar KKPRL terbit dan bangunan. Klik jenis atau provinsi untuk menyaring seluruh halaman."
          />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="relative isolate h-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-8 lg:h-auto lg:min-h-[520px]">
              <PetaDashboard jenis={jenis} provinsi={provinsi} proyek={proyek.filter((p) => p.lat !== null && p.lng !== null)} />
              <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full border border-white shadow"
                    style={{ background: `conic-gradient(${WARNA_JENIS_INVESTASI.PERIKANAN_TANGKAP} 0 33%, ${WARNA_JENIS_INVESTASI.PARIWISATA_BAHARI} 0 66%, ${WARNA_JENIS_INVESTASI.BIOTEKNOLOGI_KELAUTAN} 0)` }}
                  />
                  Lokasi potensial (warna = jenis)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded bg-kkp-900" dangerouslySetInnerHTML={{ __html: lambangSvg('koper', 10) }} />
                  Proyek investasi
                </span>
              </div>
              <Link
                to="/peta?lapisan=potensi"
                className={`absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-kkp-900 shadow hover:bg-white ${FOKUS}`}
              >
                Buka di Peta Spasial <ArrowUpRight className="h-3.5 w-3.5 text-kkp-700" />
              </Link>
            </div>

            <Kartu className="p-4 lg:col-span-4">
              <JudulKartu
                judul="Lokasi potensial per jenis"
                isi={provinsi ? `Di ${namaProvinsi}. Klik jenis untuk menyaring.` : 'Seluruh Indonesia. Klik jenis untuk menyaring.'}
              />
              <ul className="mt-3 space-y-0.5">
                {potensiPerJenis.map((j) => (
                  <li key={j.id}>
                    <BarisPilih aktif={jenis === j.id} redup={Boolean(jenis) && jenis !== j.id} onClick={() => alih(setJenis, j.id, jenis)}>
                      <span className="flex items-center gap-3">
                        <Lambang kode={j.id} kecil />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-slate-700">{j.label}</span>
                            <span className="text-[13px] font-bold tabular-nums text-kkp-900">{angka(j.lokasi)}</span>
                          </span>
                          <Batang nilai={j.lokasi} maks={maksJenis} warna={warnaJenisInvestasi(j.id)} />
                        </span>
                      </span>
                    </BarisPilih>
                  </li>
                ))}
              </ul>
            </Kartu>
          </div>

          <Kartu className="p-5">
            <JudulKartu
              judul="Provinsi dengan lokasi potensial terbanyak"
              isi={`${jenis ? namaJenis(jenis) : 'Semua jenis investasi'}. Klik provinsi untuk menyaring halaman dan memperbesar peta ke wilayahnya.`}
            />
            {daftarProvinsiPotensi.length ? (
              <ol className="mt-3 grid gap-x-6 gap-y-0.5 md:grid-cols-2">
                {daftarProvinsiPotensi.map((p) => (
                  <li key={p.id}>
                    <BarisPilih aktif={provinsi === p.id} redup={Boolean(provinsi) && provinsi !== p.id} onClick={() => alih(setProvinsi, p.id, provinsi)}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium text-slate-700">{p.nama}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          <b className="text-[13px] tabular-nums text-kkp-900">{angka(p.lokasi)}</b> lokasi · ±{angka(p.luas)} ha
                        </span>
                      </span>
                      <Batang nilai={p.lokasi} maks={maksProvinsi} warna={jenis ? warnaJenisInvestasi(jenis) : BIRU[3]} />
                    </BarisPilih>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{data ? 'Belum ada lokasi potensial untuk saringan ini.' : 'Memuat…'}</p>
            )}
          </Kartu>
        </section>

        <section className="mt-16 space-y-6">
          <JudulBagian
            label="Proyek investasi"
            nada="hijau"
            judul="Proyek yang sedang dipantau"
            isi="Proyek yang disimpan dari analisis kelayakan, dipantau dari perencanaan sampai beroperasi menurut tahapan proyek KPPIP. Klik tahap untuk menyaring."
          />

          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {perTahap.map((t, i) => (
              <li key={t.kode}>
                <button
                  type="button"
                  aria-pressed={tahap === t.kode}
                  onClick={() => alih(setTahap, t.kode, tahap)}
                  className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-white text-left transition ${FOKUS} ${
                    tahap === t.kode ? 'border-kkp-700 ring-1 ring-kkp-700' : 'border-slate-200 hover:border-kkp-900'
                  } ${tahap && tahap !== t.kode ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  <span className="h-1.5 w-full" style={{ backgroundColor: WARNA_TAHAP[t.kode] }} />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-kkp-700">Tahap {i + 1}</span>
                    <span className="mt-1 text-[15px] font-bold text-kkp-900">{t.label}</span>
                    <span className="mt-3 text-3xl font-extrabold tracking-[-0.02em] text-kkp-900 tabular-nums">{angka(t.jumlah)}</span>
                    <span className="text-xs text-slate-500">proyek · {rupiahMiliar(t.nilai)}</span>
                    <span className="mt-3 text-[11px] leading-snug text-slate-500">{t.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="grid gap-4 lg:grid-cols-2">
            <Kartu className="p-5">
              <JudulKartu judul="Nilai rencana dan realisasi per jenis" isi="Batang biru adalah nilai rencana, batang hijau di dalamnya adalah realisasi." />
              {proyekPerJenis.length ? (
                <ul className="mt-3 space-y-0.5">
                  {proyekPerJenis.map((j) => (
                    <li key={j.id}>
                      <BarisPilih aktif={jenis === j.id} redup={Boolean(jenis) && jenis !== j.id} onClick={() => alih(setJenis, j.id, jenis)}>
                        <span className="flex items-center gap-3">
                          <Lambang kode={j.id} kecil />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-[13px] font-medium text-slate-700">{j.label}</span>
                              <span className="shrink-0 text-xs text-slate-500">
                                <b className="text-[13px] text-kkp-900">{rupiahMiliar(j.rencana)}</b> · {angka(j.jumlah)} proyek
                              </span>
                            </span>
                            <Batang nilai={j.rencana} maks={maksRencanaJenis} warna={BIRU[2]} dalam={j.realisasi} />
                          </span>
                        </span>
                      </BarisPilih>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{data ? 'Belum ada proyek untuk saringan ini.' : 'Memuat…'}</p>
              )}
            </Kartu>

            <Kartu className="p-5">
              <JudulKartu judul="Proyek per provinsi" isi="Diurutkan menurut nilai rencana investasi. Klik provinsi untuk menyaring." />
              {proyekPerProvinsi.length ? (
                <ul className="mt-3 space-y-0.5">
                  {proyekPerProvinsi.map((p) => (
                    <li key={p.id || p.nama}>
                      <BarisPilih
                        aktif={provinsi === p.id}
                        redup={Boolean(provinsi) && provinsi !== p.id}
                        onClick={() => p.id && alih(setProvinsi, p.id, provinsi)}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[13px] font-medium text-slate-700">{p.nama}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            <b className="text-[13px] text-kkp-900">{rupiahMiliar(p.rencana)}</b> · {angka(p.jumlah)} proyek
                          </span>
                        </span>
                        <Batang nilai={p.rencana} maks={maksRencanaProvinsi} warna={BIRU[3]} />
                      </BarisPilih>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{data ? 'Belum ada proyek untuk saringan ini.' : 'Memuat…'}</p>
              )}
            </Kartu>
          </div>

          <Kartu className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <JudulKartu
                judul="Proyek dengan nilai rencana terbesar"
                isi={`${angka(Math.min(proyek.length, BATAS_DAFTAR))} dari ${angka(proyek.length)} proyek sesuai saringan. Klik baris untuk membuka detail proyek.`}
              />
              <Link to="/pipeline" className="inline-flex items-center gap-1.5 text-sm font-bold text-kkp-700 hover:underline">
                Semua proyek investasi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {proyek.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Proyek</th>
                      <th className="px-3 py-2.5 font-semibold">Jenis investasi</th>
                      <th className="px-3 py-2.5 font-semibold">Provinsi</th>
                      <th className="px-3 py-2.5 font-semibold">Tahap</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Nilai rencana</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Tenaga kerja</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Skor kelayakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proyek.slice(0, BATAS_DAFTAR).map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link to={`/pipeline/${p.id}`} className={`block rounded ${FOKUS}`}>
                            <span className="font-semibold text-kkp-900 hover:underline">{p.nama}</span>
                            <span className="block text-xs text-slate-500">
                              <span className="font-mono">{p.kode_proyek}</span>{p.investor ? ` · ${p.investor}` : ''}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2 text-slate-700">
                            {p.sektor_kode && <Lambang kode={p.sektor_kode} kecil />}
                            {p.sektor_nama}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{p.provinsi_nama}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: WARNA_TAHAP[p.status] }} />
                            {LABEL_TAHAPAN[p.status] || p.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-kkp-900">{rupiahMiliar(p.nilai_investasi_miliar)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-700">{angka(p.proyeksi_tenaga_kerja)}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                          {p.skor_kelayakan === null || p.skor_kelayakan === undefined ? '—' : `${angka(p.skor_kelayakan * 100)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">
                {data ? 'Belum ada proyek untuk saringan ini.' : 'Memuat…'}{' '}
                <Link to="/peta" className="font-semibold text-kkp-700 hover:underline">Mulai analisis lokasi di Peta Spasial</Link>
              </p>
            )}
          </Kartu>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
