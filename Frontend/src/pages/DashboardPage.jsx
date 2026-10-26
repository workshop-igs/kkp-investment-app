import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { ArrowRight, ArrowUpRight, Download, RefreshCw, X } from 'lucide-react';
import { api } from '../api/klien';
import LapisanVektorBBox from '../components/map/LapisanVektorBBox';
import { LAYER_LOKAL } from '../components/map/katalogLapisan';
import { buatIkon, lambangSvg } from '../components/map/ikonPeta';
import { BATAS_INDONESIA } from '../components/map/PetaInteraktif';
import { IKON_JENIS_INVESTASI, WARNA_JENIS_INVESTASI, warnaJenisInvestasi } from '../utils/simbologiPeta';
import { LABEL_TAHAPAN, SECTORS, TAHAPAN_PROYEK } from '../utils/konstanta';
import { formatNumber, rupiahRingkas } from '../utils/pemformat';

const POTENSI = LAYER_LOKAL.potensi;
const NAVY = '#002242';
const BIRU = ['#9ec5f4', '#6da7ec', '#3987e5', '#184f95', '#0d366b'];
const WARNA_TAHAP = Object.fromEntries(TAHAPAN_PROYEK.map((t, i) => [t.kode, BIRU[i]]));
const PETA_DASAR = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const BATAS_PROVINSI = 8;
const BATAS_PROYEK = 8;
const FOKUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kkp-700';

const angka = (n, d = 0) => (n === null || n === undefined || Number.isNaN(n) ? '—' : formatNumber(n, d));
const rupiah = (miliar) => `Rp ${rupiahRingkas((Number(miliar) || 0) * 1e9)}`;
const jumlah = (daftar, kunci) => daftar.reduce((t, x) => t + (Number(x[kunci]) || 0), 0);
const ikonProyek = buatIkon('koper', NAVY, 0.8);
const KELOMPOK_KOMODITAS = {
  TANGKAP_LAUT: { label: 'Tangkap laut', jenis: 'PERIKANAN_TANGKAP' },
  BUDIDAYA: { label: 'Budi daya laut & pesisir', jenis: 'PERIKANAN_BUDIDAYA' },
};
const ton = (v) => (v >= 1e6 ? `${formatNumber(v / 1e6, 2)} jt ton` : v >= 1e3 ? `${formatNumber(v / 1e3, 1)} rb ton` : `${angka(v)} ton`);
const perubahan = (kini, lalu) => (lalu ? ((kini - lalu) / lalu) * 100 : null);

const Lambang = ({ kode }) => (
  <span
    className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
    style={{ background: warnaJenisInvestasi(kode) }}
    dangerouslySetInnerHTML={{ __html: lambangSvg(IKON_JENIS_INVESTASI[kode], 11) }}
    aria-hidden="true"
  />
);

const Batang = ({ nilai, maks, warna, dalam }) => (
  <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${maks ? (nilai / maks) * 100 : 0}%`, backgroundColor: warna }} />
    {dalam !== undefined && (
      <span className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${maks ? (dalam / maks) * 100 : 0}%` }} />
    )}
  </span>
);

const Panel = ({ judul, kanan, className = '', children }) => (
  <section className={`flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
    <header className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">{judul}</h2>
      {kanan}
    </header>
    {children}
  </section>
);

const Baris = ({ aktif, redup, onClick, children }) => (
  <button
    type="button"
    aria-pressed={aktif}
    onClick={onClick}
    className={`w-full rounded-lg px-2 py-1.5 text-left transition ${FOKUS} ${
      aktif ? 'bg-kkp-100' : 'hover:bg-slate-50'
    } ${redup ? 'opacity-40 hover:opacity-100' : ''}`}
  >
    {children}
  </button>
);

const Perubahan = ({ nilai, banding }) => (nilai === null ? null : (
  <span className={`text-xs font-semibold tabular-nums ${nilai >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
    {nilai >= 0 ? '▲' : '▼'} {angka(Math.abs(nilai), 1)}% <span className="font-normal text-slate-400">vs {banding}</span>
  </span>
));

const Segmen = ({ nilai, onUbah, opsi }) => (
  <span className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
    {opsi.map(([kode, label]) => (
      <button
        key={kode}
        type="button"
        aria-pressed={nilai === kode}
        onClick={() => onUbah(kode)}
        className={`rounded-md px-2.5 py-1 transition ${FOKUS} ${nilai === kode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >
        {label}
      </button>
    ))}
  </span>
);

const Kosong = () => <p className="py-6 text-center text-sm text-slate-400">Tidak ada data</p>;

const Pilihan = ({ nilai, onUbah, kosong, opsi, label }) => (
  <select
    aria-label={label}
    value={nilai}
    onChange={(e) => onUbah(e.target.value)}
    className={`max-w-[13rem] rounded-lg border px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-kkp-toska ${
      nilai ? 'border-kkp-toska/70 bg-kkp-toska/20' : 'border-white/15 bg-white/10 hover:bg-white/15'
    }`}
  >
    <option value="" className="text-kkp-900">{kosong}</option>
    {opsi.map(([kode, teks]) => <option key={kode} value={kode} className="text-kkp-900">{teks}</option>)}
  </select>
);

const Kpi = ({ label, nilai, sub, sorot, persen }) => (
  <div className="min-w-0 rounded-xl bg-white/[0.06] px-4 py-3 ring-1 ring-inset ring-white/10">
    <p className="truncate text-xs text-white/60">{label}</p>
    <p className={`mt-1 truncate text-[1.75rem] font-bold leading-tight tracking-tight tabular-nums ${sorot ? 'text-[#BFE9F4]' : 'text-white'}`}>{nilai}</p>
    {persen !== undefined && (
      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/15">
        <span className="block h-full rounded-full bg-kkp-hijau" style={{ width: `${Math.min(100, persen)}%` }} />
      </span>
    )}
    <p className="mt-1 truncate text-xs text-white/50">{sub}</p>
  </div>
);

const Grup = ({ judul, kolom, children }) => (
  <div>
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-kkp-toska">{judul}</p>
    <div className={`grid grid-cols-2 gap-2 ${kolom}`}>{children}</div>
  </div>
);

const Donat = ({ bagian, tengah, sub }) => {
  const total = bagian.reduce((t, b) => t + b.nilai, 0);
  let sudut = 0;
  const gradien = total
    ? bagian.filter((b) => b.nilai > 0).map((b) => {
      const awal = sudut;
      sudut += (b.nilai / total) * 360;
      return `${b.warna} ${awal}deg ${sudut}deg`;
    }).join(',')
    : '#e2e8f0 0deg 360deg';
  return (
    <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradien})` }}>
      <div className="absolute inset-[17%] grid place-items-center rounded-full bg-white text-center">
        <div>
          <p className="text-2xl font-bold leading-none text-slate-900 tabular-nums">{tengah}</p>
          <p className="mt-1 text-[11px] text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
};

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
  const pernah = useRef(false);
  useEffect(() => {
    if (!provinsi && !pernah.current) return;
    pernah.current = true;
    const b = provinsi ? batas?.[provinsi] : L.latLngBounds(BATAS_INDONESIA);
    if (b?.isValid()) map.flyToBounds(b, { padding: [24, 24], duration: 0.8 });
  }, [map, batas, provinsi]);
  return null;
};

const PetaDashboard = ({ jenis, provinsi, proyek }) => {
  const navigate = useNavigate();
  return (
    <MapContainer bounds={BATAS_INDONESIA} scrollWheelZoom={false} minZoom={4} className="h-full w-full">
      <TileLayer url={PETA_DASAR} attribution="&copy; Esri" maxZoom={16} />
      <FokusProvinsi provinsi={provinsi} />
      <LapisanVektorBBox
        url={POTENSI.url}
        params={{ ...POTENSI.params, ...(jenis ? { sektor: jenis } : {}), ...(provinsi ? { provinsi } : {}) }}
        style={POTENSI.gaya}
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
          <Popup maxWidth={260}>
            <div className="font-sans">
              <span className="font-mono text-[10px] font-semibold text-kkp-700">{p.kode_proyek}</span>
              <h4 className="mt-0.5 text-sm font-bold leading-tight text-kkp-900">{p.nama}</h4>
              <p className="mt-0.5 text-xs text-slate-500">{p.sektor_nama} · {p.provinsi_nama}</p>
              <p className="mt-2 text-xs text-slate-700">
                {LABEL_TAHAPAN[p.status] || p.status} · <b>{rupiah(p.nilai_investasi_miliar)}</b>
              </p>
              <Link to={`/pipeline/${p.id}`} className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-kkp-900 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-kkp-800">
                Detail proyek <ArrowRight className="h-3.5 w-3.5" />
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
  const [diperbarui, setDiperbarui] = useState(null);
  const [jenis, setJenis] = useState('');
  const [provinsi, setProvinsi] = useState('');
  const [tahap, setTahap] = useState('');
  const [ukuranKomoditas, setUkuranKomoditas] = useState('ton');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const { data: hasil } = await api.get('/inti/dashboard/');
      setData(hasil);
      setDiperbarui(new Date());
    } catch (err) {
      const kode = err.response?.status;
      setGalat(kode === 401 || kode === 403 ? 'Sesi berakhir. Masuk kembali.' : `Data gagal dimuat${kode ? ` (${kode})` : ''}.`);
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
  const provinsiLokasi = new Set(potensi.filter((r) => r.lokasi > 0).map((r) => r.provinsi_id)).size;

  const potensiPerJenis = SECTORS.map((s) => ({
    ...s,
    lokasi: jumlah(semuaPotensi.filter((r) => r.kode === s.id && diProvinsi(r)), 'lokasi'),
  })).sort((a, b) => b.lokasi - a.lokasi);
  const maksJenis = Math.max(1, ...potensiPerJenis.map((j) => j.lokasi));

  const potensiPerProvinsi = useMemo(() => {
    const kelompok = new Map();
    semuaPotensi
      .filter((r) => (jenis ? r.kode === jenis : r.kode === null))
      .forEach((r) => {
        const ada = kelompok.get(r.provinsi_id) || { id: String(r.provinsi_id), nama: r.provinsi, lokasi: 0 };
        ada.lokasi += r.lokasi;
        kelompok.set(r.provinsi_id, ada);
      });
    return [...kelompok.values()].sort((a, b) => b.lokasi - a.lokasi);
  }, [semuaPotensi, jenis]);
  const maksProvinsi = Math.max(1, ...potensiPerProvinsi.map((p) => p.lokasi));
  const provinsiTeratas = provinsi && !potensiPerProvinsi.slice(0, BATAS_PROVINSI).some((p) => p.id === provinsi)
    ? [...potensiPerProvinsi.slice(0, BATAS_PROVINSI - 1), ...potensiPerProvinsi.filter((p) => p.id === provinsi)]
    : potensiPerProvinsi.slice(0, BATAS_PROVINSI);

  const daftarProvinsi = useMemo(() => {
    const nama = new Map();
    semuaPotensi.forEach((r) => nama.set(String(r.provinsi_id), r.provinsi));
    semuaProyek.forEach((p) => p.provinsi_id && nama.set(String(p.provinsi_id), p.provinsi_nama));
    return [...nama.entries()].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  }, [semuaPotensi, semuaProyek]);
  const namaProvinsi = daftarProvinsi.find(([id]) => id === provinsi)?.[1];

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
  const maksRencana = Math.max(1, ...proyekPerJenis.map((j) => j.rencana));

  const kom = data?.komoditas || { baris: [] };
  const kelompokAktif = Object.keys(KELOMPOK_KOMODITAS).find((k) => KELOMPOK_KOMODITAS[k].jenis === jenis);
  const ukurKom = ukuranKomoditas === 'ton' ? 'ton' : 'nilai_juta';
  const tampilKom = (v) => (ukuranKomoditas === 'ton' ? ton(v) : rupiah(v / 1000));
  const barisKom = (tahun) => kom.baris.filter((b) => b.tahun === tahun && (!kelompokAktif || b.kelompok === kelompokAktif));
  const komKini = barisKom(kom.tahun).filter(diProvinsi);
  const komLalu = barisKom(kom.tahun_banding).filter(diProvinsi);
  const totalKom = (baris, kelompok) => jumlah(kelompok ? baris.filter((b) => b.kelompok === kelompok) : baris, ukurKom);
  const kumpulkan = (baris, kunci, awal) => {
    const kelompok = new Map();
    baris.forEach((b) => {
      const k = kunci(b);
      const ada = kelompok.get(k) || awal(b);
      ada.nilai += b[ukurKom] || 0;
      kelompok.set(k, ada);
    });
    return [...kelompok.values()].sort((a, b) => b.nilai - a.nilai);
  };
  const perKomoditas = kumpulkan(komKini, (b) => `${b.kelompok}:${b.komoditas}`, (b) => ({
    kunci: `${b.kelompok}:${b.komoditas}`, komoditas: b.komoditas, kelompok: b.kelompok, nilai: 0,
  }));
  const maksKomoditas = Math.max(1, ...perKomoditas.map((k) => k.nilai));
  const komPerProvinsi = kumpulkan(barisKom(kom.tahun), (b) => b.provinsi_id, (b) => ({
    id: String(b.provinsi_id), nama: b.provinsi, nilai: 0,
  }));
  const maksKomProvinsi = Math.max(1, ...komPerProvinsi.map((p) => p.nilai));
  const komProvinsiTeratas = provinsi && !komPerProvinsi.slice(0, BATAS_PROVINSI).some((p) => p.id === provinsi)
    ? [...komPerProvinsi.slice(0, BATAS_PROVINSI - 1), ...komPerProvinsi.filter((p) => p.id === provinsi)]
    : komPerProvinsi.slice(0, BATAS_PROVINSI);
  const kartuKomoditas = [
    ...Object.entries(KELOMPOK_KOMODITAS)
      .filter(([k]) => !kelompokAktif || k === kelompokAktif)
      .map(([k, { label, jenis: kodeJenis }]) => [label, totalKom(komKini, k), totalKom(komLalu, k), warnaJenisInvestasi(kodeJenis)]),
    ...(kelompokAktif ? [] : [['Total', totalKom(komKini), totalKom(komLalu), NAVY]]),
  ];

  const adaSaringan = Boolean(jenis || provinsi || tahap);
  const alih = (setter, nilai, kini) => setter(kini === nilai ? '' : nilai);

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

  const tombolIkon = `inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40 ${FOKUS}`;

  return (
    <div className="h-full overflow-y-auto bg-[#F1F4F8] pt-[72px] text-slate-800">
      <section className="relative overflow-hidden bg-kkp-900 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_88%_-10%,rgba(64,191,219,0.35),transparent_55%),radial-gradient(ellipse_at_0%_120%,rgba(140,198,63,0.14),transparent_45%)]" />
        <div className="relative mx-auto max-w-[1440px] px-4 pb-6 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Dashboard Nasional</h1>
              <p className="mt-0.5 text-sm text-white/55">
                Investasi Ruang Laut{diperbarui ? ` · ${diperbarui.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pilihan label="Jenis investasi" nilai={jenis} onUbah={setJenis} kosong="Semua jenis" opsi={SECTORS.map((s) => [s.id, s.label])} />
              <Pilihan label="Provinsi" nilai={provinsi} onUbah={setProvinsi} kosong="Seluruh Indonesia" opsi={daftarProvinsi} />
              <Pilihan label="Tahap proyek" nilai={tahap} onUbah={setTahap} kosong="Semua tahap" opsi={TAHAPAN_PROYEK.map((t) => [t.kode, t.label])} />
              {adaSaringan && (
                <button type="button" onClick={() => { setJenis(''); setProvinsi(''); setTahap(''); }} title="Hapus saringan" className={tombolIkon}>
                  <X className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={muat} disabled={memuat} title="Perbarui data" className={tombolIkon}>
                <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={eksporCsv} disabled={!proyek.length} title="Unduh daftar proyek (CSV)" className={tombolIkon}>
                <Download className="h-4 w-4" /> CSV
              </button>
            </div>
          </div>

          {galat && <p className="mt-4 rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{galat}</p>}

          <div className="mt-6 grid gap-4 xl:grid-cols-[3fr_4fr]">
            <Grup judul="Potensi ruang laut" kolom="sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <Kpi
                  label="Lokasi potensial"
                  nilai={data ? angka(totalLokasi) : '…'}
                  sub={jenis ? SECTORS.find((s) => s.id === jenis)?.label : 'semua jenis'}
                  sorot
                />
              </div>
              <Kpi label="Provinsi" nilai={angka(provinsiLokasi)} sub={provinsi ? namaProvinsi : `dari ${angka(data?.summary?.total_provinsi)}`} />
              <Kpi label="Luas lokasi" nilai={angka(jumlah(potensi, 'luas_ha'))} sub="hektare" />
            </Grup>
            <Grup judul="Portofolio proyek" kolom="sm:grid-cols-4">
              <Kpi label="Proyek" nilai={angka(proyek.length)} sub={rataSkor === null ? 'skor —' : `skor rata-rata ${angka(rataSkor)}%`} />
              <Kpi label="Nilai rencana" nilai={rupiah(rencana)} sub={`${angka(jumlah(proyek, 'luas_ha'))} ha area`} />
              <Kpi label="Realisasi" nilai={`${angka(persenRealisasi, 1)}%`} sub={rupiah(realisasi)} persen={persenRealisasi} />
              <Kpi label="Tenaga kerja" nilai={angka(jumlah(proyek, 'proyeksi_tenaga_kerja'))} sub="orang" />
            </Grup>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <Panel
          judul="Peta sebaran"
          kanan={(
            <span className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="hidden items-center gap-1.5 sm:flex">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: `conic-gradient(${WARNA_JENIS_INVESTASI.PERIKANAN_TANGKAP} 0 33%, ${WARNA_JENIS_INVESTASI.PARIWISATA_BAHARI} 0 66%, ${WARNA_JENIS_INVESTASI.BIOTEKNOLOGI_KELAUTAN} 0)` }}
                />
                Lokasi potensial
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-kkp-900" dangerouslySetInnerHTML={{ __html: lambangSvg('koper', 9) }} />
                Proyek
              </span>
              <Link to="/peta?lapisan=potensi" title="Buka di Peta Spasial" className={`rounded-md p-1 text-kkp-700 hover:bg-kkp-100 ${FOKUS}`}>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </span>
          )}
        >
          <div className="relative isolate h-[360px] overflow-hidden rounded-xl bg-slate-100 lg:h-[470px]">
            <PetaDashboard jenis={jenis} provinsi={provinsi} proyek={proyek.filter((p) => p.lat !== null && p.lng !== null)} />
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Panel judul="Lokasi per jenis">
            <ul className="-mx-2 flex flex-1 flex-col justify-between">
              {potensiPerJenis.map((j) => (
                <li key={j.id}>
                  <Baris aktif={jenis === j.id} redup={Boolean(jenis) && jenis !== j.id} onClick={() => alih(setJenis, j.id, jenis)}>
                    <span className="flex items-center gap-2.5">
                      <Lambang kode={j.id} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] text-slate-700">{j.label}</span>
                          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">{angka(j.lokasi)}</span>
                        </span>
                        <Batang nilai={j.lokasi} maks={maksJenis} warna={warnaJenisInvestasi(j.id)} />
                      </span>
                    </span>
                  </Baris>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel judul="Provinsi teratas" kanan={<span className="text-[11px] text-slate-400">lokasi potensial</span>}>
            {provinsiTeratas.length ? (
              <ol className="-mx-2">
                {provinsiTeratas.map((p) => (
                  <li key={p.id}>
                    <Baris aktif={provinsi === p.id} redup={Boolean(provinsi) && provinsi !== p.id} onClick={() => alih(setProvinsi, p.id, provinsi)}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] text-slate-700">
                          <span className="mr-2 inline-block w-4 text-right text-[11px] tabular-nums text-slate-400">
                            {potensiPerProvinsi.findIndex((x) => x.id === p.id) + 1}
                          </span>
                          {p.nama}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">{angka(p.lokasi)}</span>
                      </span>
                      <Batang nilai={p.lokasi} maks={maksProvinsi} warna={jenis ? warnaJenisInvestasi(jenis) : BIRU[3]} />
                    </Baris>
                  </li>
                ))}
              </ol>
            ) : <Kosong />}
          </Panel>

          <Panel judul="Tahapan proyek" kanan={<span className="text-[11px] text-slate-400">{rupiah(jumlah(perTahap, 'nilai'))}</span>}>
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <Donat
                bagian={perTahap.map((t) => ({ nilai: t.jumlah, warna: WARNA_TAHAP[t.kode] }))}
                tengah={angka(jumlah(perTahap, 'jumlah'))}
                sub="proyek"
              />
              <ul className="-mx-2 w-full flex-1">
                {perTahap.map((t) => (
                  <li key={t.kode}>
                    <Baris aktif={tahap === t.kode} redup={Boolean(tahap) && tahap !== t.kode} onClick={() => alih(setTahap, t.kode, tahap)}>
                      <span className="flex items-center gap-2 text-[13px]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: WARNA_TAHAP[t.kode] }} />
                        <span className="flex-1 text-slate-700">{t.label}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{angka(t.jumlah)}</span>
                        <span className="w-[4.5rem] text-right text-[11px] tabular-nums text-slate-400">{rupiah(t.nilai)}</span>
                      </span>
                    </Baris>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel
            judul="Investasi per jenis"
            kanan={(
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: BIRU[2] }} />Rencana</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Realisasi</span>
              </span>
            )}
          >
            {proyekPerJenis.length ? (
              <ul className="-mx-2">
                {proyekPerJenis.map((j) => (
                  <li key={j.id}>
                    <Baris aktif={jenis === j.id} redup={Boolean(jenis) && jenis !== j.id} onClick={() => alih(setJenis, j.id, jenis)}>
                      <span className="flex items-center gap-2.5">
                        <Lambang kode={j.id} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] text-slate-700">{j.label}</span>
                            <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">{rupiah(j.rencana)}</span>
                          </span>
                          <Batang nilai={j.rencana} maks={maksRencana} warna={BIRU[2]} dalam={j.realisasi} />
                        </span>
                      </span>
                    </Baris>
                  </li>
                ))}
              </ul>
            ) : <Kosong />}
          </Panel>
        </div>


        <Panel
          judul="Komoditas perikanan laut & pesisir"
          kanan={(
            <span className="flex items-center gap-3">
              <span className="hidden text-[11px] text-slate-400 sm:inline">BPS {kom.tahun ?? '—'}</span>
              <Segmen nilai={ukuranKomoditas} onUbah={setUkuranKomoditas} opsi={[['ton', 'Volume'], ['nilai', 'Nilai']]} />
            </span>
          )}
        >
          {kom.baris.length ? (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="grid content-start gap-2 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
                {kartuKomoditas.map(([label, kini, lalu, warna]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: warna }} />
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-slate-900">{tampilKom(kini)}</p>
                    <Perubahan nilai={perubahan(kini, lalu)} banding={kom.tahun_banding} />
                  </div>
                ))}
              </div>

              <div className="lg:col-span-5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Per komoditas{provinsi ? ` · ${namaProvinsi}` : ' · Indonesia'}
                </p>
                {perKomoditas.length ? (
                  <ul>
                    {perKomoditas.map((k) => (
                      <li key={k.kunci} className="py-1.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] text-slate-700">
                            {k.komoditas}
                            <span className="ml-1.5 text-[11px] text-slate-400">{k.kelompok === 'BUDIDAYA' ? 'budi daya' : 'tangkap'}</span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">{tampilKom(k.nilai)}</span>
                        </span>
                        <Batang nilai={k.nilai} maks={maksKomoditas} warna={warnaJenisInvestasi(KELOMPOK_KOMODITAS[k.kelompok].jenis)} />
                      </li>
                    ))}
                  </ul>
                ) : <Kosong />}
              </div>

              <div className="lg:col-span-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Provinsi penghasil</p>
                <ol className="-mx-2">
                  {komProvinsiTeratas.map((p) => (
                    <li key={p.id}>
                      <Baris aktif={provinsi === p.id} redup={Boolean(provinsi) && provinsi !== p.id} onClick={() => alih(setProvinsi, p.id, provinsi)}>
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] text-slate-700">
                            <span className="mr-2 inline-block w-4 text-right text-[11px] tabular-nums text-slate-400">
                              {komPerProvinsi.findIndex((x) => x.id === p.id) + 1}
                            </span>
                            {p.nama}
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-900">{tampilKom(p.nilai)}</span>
                        </span>
                        <Batang nilai={p.nilai} maks={maksKomProvinsi} warna={BIRU[3]} />
                      </Baris>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : <Kosong />}
        </Panel>

        <Panel
          judul="Proyek terbesar"
          kanan={(
            <Link to="/pipeline" className="inline-flex items-center gap-1 text-xs font-semibold text-kkp-700 hover:underline">
              Semua proyek <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        >
          {proyek.length ? (
            <div className="-mx-4 -mb-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Proyek</th>
                    <th className="px-3 py-2 font-semibold">Jenis</th>
                    <th className="px-3 py-2 font-semibold">Provinsi</th>
                    <th className="px-3 py-2 font-semibold">Tahap</th>
                    <th className="px-3 py-2 text-right font-semibold">Nilai</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Tenaga kerja</th>
                    <th className="px-4 py-2 text-right font-semibold">Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proyek.slice(0, BATAS_PROYEK).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="max-w-[18rem] px-4 py-2.5">
                        <Link to={`/pipeline/${p.id}`} className={`block truncate font-semibold text-slate-900 hover:text-kkp-700 ${FOKUS}`}>{p.nama}</Link>
                        <span className="font-mono text-[11px] text-slate-400">{p.kode_proyek}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2 text-slate-700">
                          {p.sektor_kode && <Lambang kode={p.sektor_kode} />}
                          <span className="truncate">{p.sektor_nama}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{p.provinsi_nama}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: WARNA_TAHAP[p.status] }} />
                          {LABEL_TAHAPAN[p.status] || p.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">{rupiah(p.nilai_investasi_miliar)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{angka(p.proyeksi_tenaga_kerja)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                        {p.skor_kelayakan === null || p.skor_kelayakan === undefined ? '—' : `${angka(p.skor_kelayakan * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Kosong />}
        </Panel>
      </div>
    </div>
  );
};

export default DashboardPage;
