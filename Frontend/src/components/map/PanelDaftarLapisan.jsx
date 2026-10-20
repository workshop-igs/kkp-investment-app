import { useMemo, useState } from 'react';
import { AlertTriangle, Info, Layers, Loader2, Minus, Plus, Search, ZoomIn } from 'lucide-react';
import { useMap } from 'react-leaflet';
import { api } from '../../api/klien';
import PemilihSektor from './PemilihSektor';
import PemilihWilayah from './PemilihWilayah';

const KATEGORI = [
  {
    judul: 'Rencana Tata Ruang & Zonasi',
    layer: [
      { id: 'polaruang', nama: 'RTRW Provinsi (Perda RTRW, PKKPRL & RZWP-3-K)', warna: '#0056A5' },
      { id: 'polaruang_darat', nama: 'Pola Ruang Darat Pesisir (RTRW Provinsi)', warna: '#65a30d' },
      { id: 'polaruang_kaw', nama: 'Rencana Zonasi Kawasan Antarwilayah (KAW)', warna: '#7c3aed' },
      { id: 'rtrl', nama: 'Rencana Tata Ruang Laut', warna: '#1d4ed8' },
      { id: 'wilayah_adat', nama: 'Wilayah Kelola Masyarakat Hukum Adat', warna: '#b45309' },
    ],
  },
  {
    judul: 'Perizinan Pemanfaatan Ruang Laut',
    layer: [
      { id: 'kkprl', nama: 'KKPRL Nasional', warna: '#10b981' },
    ],
  },
  {
    judul: 'Sebaran Transportasi & Infrastruktur',
    layer: [
      { id: 'infra_pelabuhan_perikanan', nama: 'Pelabuhan Perikanan', warna: '#0e7490' },
      { id: 'infra_pelabuhan_umum', nama: 'Pelabuhan Umum', warna: '#1e40af' },
      { id: 'infra_pelabuhan_penyeberangan', nama: 'Pelabuhan Penyeberangan', warna: '#7e22ce' },
      { id: 'infra_terminal_khusus', nama: 'Terminal Khusus', warna: '#c2410c' },
      { id: 'infra_jalan_nasional', nama: 'Jalan Nasional', warna: '#78350f' },
      { id: 'infra_jaringan_listrik', nama: 'Jaringan Listrik', warna: '#a16207' },
      { id: 'infra_pembangkit_listrik', nama: 'Pembangkit Listrik', warna: '#b91c1c' },
      { id: 'infra_kawasan_industri', nama: 'Kawasan Industri', warna: '#44403c' },
      { id: 'infra_kpbpb', nama: 'Kawasan Perdagangan Bebas', warna: '#15803d' },
      { id: 'infra_bandara', nama: 'Bandar Udara', warna: '#0f766e' },
      { id: 'infra_gardu_induk', nama: 'Gardu Induk', warna: '#9a3412' },
      { id: 'infra_listrik_tm', nama: 'Jaringan Listrik 20 kV', warna: '#ca8a04' },
      { id: 'infra_kampus_riset', nama: 'Kampus & Lembaga Riset', warna: '#4338ca' },
      { id: 'infra_muara', nama: 'Muara Sungai Besar', warna: '#0284c7' },
    ],
  },
  {
    judul: 'Risiko Bencana',
    layer: [
      { id: 'risiko_tsunami', nama: 'Risiko Tsunami', warna: '#dc2626' },
      { id: 'risiko_abrasi', nama: 'Risiko Gelombang Ekstrem & Abrasi', warna: '#ea580c' },
      { id: 'risiko_banjir', nama: 'Risiko Banjir', warna: '#2563eb' },
      { id: 'risiko_pga', nama: 'Percepatan Tanah Gempa (PGA)', warna: '#f03b20' },
      { id: 'risiko_laju_abrasi', nama: 'Laju Abrasi Garis Pantai', warna: '#e31a1c' },
    ],
  },
  {
    judul: 'Oseanografi',
    layer: [
      { id: 'osea_suhu', nama: 'Suhu Permukaan Laut', warna: '#f46d43' },
      { id: 'osea_anomali', nama: 'Anomali Suhu Permukaan Laut', warna: '#b2182b' },
      { id: 'osea_klorofil', nama: 'Klorofil-a', warna: '#21918c' },
      { id: 'osea_gelombang', nama: 'Tinggi Gelombang Signifikan', warna: '#4575b4' },
      { id: 'osea_kedalaman', nama: 'Kedalaman Laut', warna: '#0369a1' },
      { id: 'osea_kd490', nama: 'Kecerahan Perairan (Kd490)', warna: '#2171b5' },
      { id: 'osea_periode', nama: 'Periode Gelombang', warna: '#4575b4' },
      { id: 'osea_kemiringan_dasar', nama: 'Kemiringan Dasar Laut', warna: '#fc8d59' },
      { id: 'osea_arus', nama: 'Kecepatan Arus Permukaan', warna: '#2171b5' },
      { id: 'osea_salinitas', nama: 'Salinitas Permukaan Laut', warna: '#41ab5d' },
      { id: 'osea_beda_suhu', nama: 'Beda Suhu Permukaan dan 1.000 m', warna: '#f46d43' },
      { id: 'osea_shannon', nama: 'Keanekaragaman Hayati Laut (Shannon)', warna: '#238b45' },
    ],
  },
  {
    judul: 'Iklim & Lahan Pesisir',
    layer: [
      { id: 'iklim_hujan', nama: 'Curah Hujan Bulanan', warna: '#238443' },
      { id: 'iklim_kering', nama: 'Bulan Kering Berturut-turut', warna: '#ec7014' },
      { id: 'iklim_kemiringan', nama: 'Kemiringan Lahan', warna: '#fc8d59' },
      { id: 'iklim_liat', nama: 'Kandungan Tanah Liat', warna: '#d95f0e' },
      { id: 'iklim_angin', nama: 'Kecepatan Angin 100 m', warna: '#238b45' },
      { id: 'iklim_ghi', nama: 'Iradiasi Surya (GHI)', warna: '#fd8d3c' },
      { id: 'pesisir_eks_mangrove', nama: 'Eks-Mangrove 1996-2020', warna: '#b45309' },
      { id: 'pesisir_produksi_kab', nama: 'Perkiraan Produksi Ikan Kabupaten', warna: '#2171b5' },
    ],
  },
  {
    judul: 'Analisis Investasi',
    layer: [
      { id: 'potensi', nama: 'Peta Sebaran Wilayah Potensial Investasi', warna: '#15803d' },
    ],
  },
];

const StatusLapisan = ({ status }) => {
  if (status.memuat) {
    return (
      <p className="px-3.5 pb-2 -mt-0.5 text-[11px] text-slate-400 flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        Memuat data…
      </p>
    );
  }

  if (status.galat) {
    return (
      <p className="px-3.5 pb-2 -mt-0.5 text-[11px] text-rose-600 flex items-start gap-1.5">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>{status.galat}</span>
      </p>
    );
  }

  if (status.jumlah === undefined || status.jumlah === null) {
    return (
      <p
        className={`px-3.5 pb-2 -mt-0.5 text-[11px] ${
          status.catatan ? 'text-amber-600' : 'text-emerald-700'
        }`}
      >
        {status.catatan || 'Peta bahaya tergambar.'}
      </p>
    );
  }

  if (status.jumlah === 0) {
    return (
      <p className="px-3.5 pb-2 -mt-0.5 text-[11px] text-amber-600">
        Tidak ada data di tampilan peta saat ini — geser atau perkecil peta.
      </p>
    );
  }

  if (status.dipangkas) {
    return (
      <p className="px-3.5 pb-2 -mt-0.5 text-[11px] text-amber-600">
        Menampilkan {status.jumlah.toLocaleString('id-ID')} objek
        {status.pemilihan === 'terbesar'
          ? ' terbesar saja'
          : ` sebagai sampel ${status.pemilihan}`}.
        Perbesar peta atau pilih provinsi untuk melihat seluruhnya.
      </p>
    );
  }

  return (
    <p className="px-3.5 pb-2 -mt-0.5 text-[11px] text-emerald-700">
      {status.jumlah.toLocaleString('id-ID')} objek tergambar.
    </p>
  );
};

const PanelDaftarLapisan = ({
  activeLayers,
  toggleLayer,
  daftarLapisan,
  wilayahLapisan,
  setWilayahLapisan,
  sektorLapisan = {},
  setSektorLapisan,
  statusLapisan = {},
  lapisanAwal = [],
}) => {
  const map = useMap();
  const [cari, setCari] = useState('');
  const [dibuka, setDibuka] = useState(() =>
    Object.fromEntries(KATEGORI.filter((k) => k.layer.some((l) => lapisanAwal.includes(l.id))).map((k) => [k.judul, true]))
  );
  const [keterangan, setKeterangan] = useState(null);
  const [sedangZoom, setSedangZoom] = useState(null);

  const kataKunci = cari.trim().toLowerCase();

  const kategoriTampil = useMemo(
    () =>
      KATEGORI.map((k) => ({
        ...k,
        layer: kataKunci ? k.layer.filter((l) => l.nama.toLowerCase().includes(kataKunci)) : k.layer,
      })).filter((k) => k.layer.length > 0),
    [kataKunci]
  );

  const zoomKeLapisan = async (idLapisan) => {
    const def = daftarLapisan[idLapisan];
    if (!def?.url) return;
    const urlCakupan = def.url.replace(/peta\/$/, 'cakupan/');
    setSedangZoom(idLapisan);
    try {
      const { data } = await api.get(urlCakupan, {
        params: {
          ...(def.params || {}),
          ...(sektorLapisan[idLapisan] ? { [def.pilihan?.param || 'sektor']: sektorLapisan[idLapisan] } : {}),
          ...(wilayahLapisan[idLapisan] ? { provinsi: wilayahLapisan[idLapisan] } : {}),
        },
      });
      const c = data?.cakupan;
      if (c && c.length === 4) {
        map.fitBounds(
          [
            [c[1], c[0]],
            [c[3], c[2]],
          ],
          { padding: [40, 40], animate: false }
        );
      }
    } catch {
    } finally {
      setSedangZoom(null);
    }
  };

  return (
    <div className="pointer-events-none absolute right-full mr-3 top-20 bottom-0 flex items-center w-[19.5rem] max-w-[calc(100vw-6.5rem)]">
    <div
      className="pointer-events-auto w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden
                 animate-fade-in flex flex-col
                 max-h-[min(100%,max(220px,calc(100vh-33rem)))]
                 sm:max-h-[min(100%,max(220px,calc(100vh-28rem)))]
                 xl:max-h-full"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-kkp-800 text-white shrink-0">
        <Layers className="w-4 h-4 shrink-0" />
        <span className="text-[13px] font-bold tracking-wide uppercase">Daftar Layer</span>
      </div>

      <div className="px-3 py-2.5 bg-kkp-100 border-b border-kkp-200 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-kkp-700 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama layer…"
            className="w-full text-[13px] bg-white border border-kkp-200 rounded-lg pl-8 pr-3 py-2
                       text-slate-700 placeholder:text-slate-400
                       focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {kategoriTampil.length === 0 && (
          <p className="px-4 py-6 text-[12px] text-slate-400 text-center">
            Tidak ada layer bernama “{cari}”.
          </p>
        )}

        {kategoriTampil.map((kategori) => {
          const dilipat = !dibuka[kategori.judul];
          const aktifDiKategori = kategori.layer.filter((l) => activeLayers.includes(l.id)).length;
          return (
            <div key={kategori.judul}>
              <button
                onClick={() =>
                  setDibuka((s) => ({ ...s, [kategori.judul]: !s[kategori.judul] }))
                }
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-kkp-700 text-white
                           hover:bg-kkp-800 transition-colors text-left"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider leading-tight">
                  {kategori.judul}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {aktifDiKategori > 0 && (
                    <span className="text-[10px] font-semibold bg-white/25 rounded px-1.5 py-0.5">
                      {aktifDiKategori}
                    </span>
                  )}
                  {dilipat ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                </span>
              </button>

              {!dilipat &&
                kategori.layer.map((layer) => {
                  const aktif = activeLayers.includes(layer.id);
                  const def = daftarLapisan[layer.id] || {};
                  return (
                    <div key={layer.id} className="border-b border-slate-100 last:border-0">
                      <div
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 transition-colors ${
                          aktif ? 'bg-kkp-100/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          id={`layer-${layer.id}`}
                          type="checkbox"
                          className="accent-kkp-700 w-4 h-4 cursor-pointer shrink-0"
                          checked={aktif}
                          onChange={() => toggleLayer(layer.id)}
                        />
                        <label
                          htmlFor={`layer-${layer.id}`}
                          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                            style={{ backgroundColor: layer.warna }}
                          />
                          <span
                            className={`text-[12.5px] leading-snug ${
                              aktif ? 'text-kkp-800 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            {layer.nama}
                          </span>
                        </label>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {def.url && (
                            <button
                              onClick={() => zoomKeLapisan(layer.id)}
                              title="Zoom ke sebaran layer"
                              className={`p-1.5 rounded-md text-slate-400 hover:text-kkp-700 hover:bg-kkp-100
                                          transition-colors ${sedangZoom === layer.id ? 'animate-pulse text-kkp-700' : ''}`}
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setKeterangan((k) => (k === layer.id ? null : layer.id))
                            }
                            title="Keterangan layer"
                            className={`p-1.5 rounded-md transition-colors hover:bg-kkp-100 ${
                              keterangan === layer.id
                                ? 'text-kkp-700 bg-kkp-100'
                                : 'text-slate-400 hover:text-kkp-700'
                            }`}
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {aktif && statusLapisan[layer.id] && (
                        <StatusLapisan status={statusLapisan[layer.id]} />
                      )}

                      {keterangan === layer.id && (
                        <p className="px-3.5 pb-2.5 -mt-1 text-[11px] text-slate-500 leading-snug">
                          {def.keteranganLegenda ||
                            'Data Portal Satu Data KKP yang disimpan dan digambar dari server aplikasi ini.'}
                        </p>
                      )}

                      {aktif && def.params && 'sektor' in def.params && (
                        <PemilihSektor
                          nilai={def.semuaJenis ? sektorLapisan[layer.id] : sektorLapisan[layer.id] || def.params.sektor}
                          onPilih={(kode) => setSektorLapisan && setSektorLapisan(layer.id, kode)}
                          label={def.semuaJenis ? 'Jenis investasi' : undefined}
                          semua={def.semuaJenis}
                        />
                      )}

                      {aktif && def.pilihan && (
                        <PemilihSektor
                          nilai={sektorLapisan[layer.id]}
                          onPilih={(kode) => setSektorLapisan && setSektorLapisan(layer.id, kode)}
                          label={def.pilihan.label}
                          opsi={def.pilihan.opsi}
                          semua={def.pilihan.semua}
                        />
                      )}

                      {aktif && def.urlWilayah && (
                        <PemilihWilayah
                          urlWilayah={def.urlWilayah}
                          params={sektorLapisan[layer.id]
                            ? { ...(def.params || {}), [def.pilihan?.param || 'sektor']: sektorLapisan[layer.id] }
                            : def.params}
                          nilai={wilayahLapisan[layer.id]}
                          onPilih={(id) => setWilayahLapisan(layer.id, id)}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      <p className="px-4 py-2 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100 shrink-0">
        Sumber: Portal Satu Data KKP
      </p>
    </div>
    </div>
  );
};

export default PanelDaftarLapisan;
