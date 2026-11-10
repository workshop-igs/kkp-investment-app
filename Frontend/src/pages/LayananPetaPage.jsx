import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api/klien';
import { API_V1_URL } from '../api/alamat';
import { kotakGeometri } from '../utils/koordinat';

const OWS = '/ows';
const AKAR = '/rest/services';
const kap = (layanan) => `${OWS}?SERVICE=${layanan}&REQUEST=GetCapabilities`;
const peta = (nama, [x0, y0, x1, y1], lebar = 720) => {
  const tinggi = Math.max(120, Math.min(720, Math.round((lebar * (y1 - y0)) / Math.max(x1 - x0, 1e-6))));
  return `${OWS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${nama}&STYLES=&CRS=EPSG:4326`
    + `&BBOX=${y0},${x0},${y1},${x1}&WIDTH=${lebar}&HEIGHT=${tinggi}&FORMAT=image/png&TRANSPARENT=true`;
};
const wfs = (nama, format) => `${OWS}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${nama}&OUTPUTFORMAT=${format}&MAXFEATURES=10000`;
const wcs = (nama, [x0, y0, x1, y1]) => `${OWS}?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=${nama}`
  + `&FORMAT=image/tiff&SUBSET=Lat(${y0},${y1})&SUBSET=Long(${x0},${x1})`;
const angka = (v) => Number(v).toLocaleString('id-ID');

const Tautan = ({ href, children, ...sisa }) => (
  href.startsWith('/') && !href.startsWith(OWS)
    ? <Link to={href} className="text-kkp-700 hover:underline">{children}</Link>
    : <a href={href} className="text-kkp-700 hover:underline" {...sisa}>{children}</a>
);

const Baris = ({ label, children }) => (
  <div className="grid grid-cols-[11rem_1fr] gap-3 py-1.5 border-b border-slate-100 text-sm">
    <dt className="font-semibold text-slate-600">{label}</dt>
    <dd className="text-slate-800 break-words">{children}</dd>
  </div>
);

const Jejak = ({ bagian }) => (
  <p className="text-xs text-slate-500">
    <Tautan href={AKAR}>Beranda layanan</Tautan>
    {bagian.map(([label, href]) => (
      <span key={label}> &gt; {href ? <Tautan href={href}>{label}</Tautan> : label}</span>
    ))}
  </p>
);

const useData = (alamat) => {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  useEffect(() => {
    let batal = false;
    setData(null); setGalat(null);
    api.get(alamat).then(({ data: d }) => { if (!batal) setData(d); })
      .catch((e) => { if (!batal) setGalat(e.response?.status === 404 ? 'Layanan atau layer tidak ditemukan.' : 'Gagal memuat data.'); });
    return () => { batal = true; };
  }, [alamat]);
  return [data, galat];
};

const Memuat = ({ galat }) => (galat
  ? <p className="text-sm text-red-700">{galat}</p>
  : <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>);

const DaftarLayanan = () => {
  const [data, galat] = useData('/inti/layanan/');
  return (
    <>
      <Jejak bagian={[]} />
      <h1 className="text-2xl font-extrabold text-kkp-900">Direktori Layanan Peta</h1>
      <p className="text-sm text-slate-600">
        Layanan peta Platform Manajemen Investasi Ruang Laut KKP. Dapat dibuka tanpa masuk akun di browser, QGIS, ArcGIS,
        atau aplikasi lain yang mendukung standar OGC.
      </p>
      <dl>
        <Baris label="Alamat OGC"><code>{window.location.origin}{OWS}</code></Baris>
        <Baris label="Kapabilitas">
          <Tautan href={kap('WMS')}>WMS</Tautan> · <Tautan href={kap('WFS')}>WFS</Tautan> · <Tautan href={kap('WCS')}>WCS</Tautan>
        </Baris>
        <Baris label="Format lain"><Tautan href={`${API_V1_URL}/inti/layanan/`}>JSON</Tautan></Baris>
      </dl>
      <h2 className="text-lg font-bold text-kkp-900 pt-2">Layanan</h2>
      {!data ? <Memuat galat={galat} /> : (
        <ul className="space-y-2">
          {data.map((l) => (
            <li key={l.kode} className="text-sm">
              <Tautan href={`${AKAR}/${l.kode}/MapServer`}>{l.kode} (MapServer)</Tautan>
              <span className="text-slate-500"> — {l.judul}; {l.jumlah_lapisan} layer</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

const InfoLayanan = ({ kode }) => {
  const [data, galat] = useData(`/inti/layanan/${kode}/`);
  const dasar = `${AKAR}/${kode}/MapServer`;
  return (
    <>
      <Jejak bagian={[[`${kode} (MapServer)`]]} />
      <h1 className="text-2xl font-extrabold text-kkp-900">{kode} (MapServer)</h1>
      {!data ? <Memuat galat={galat} /> : (
        <>
          <dl>
            <Baris label="Keterangan">{data.judul}: {data.keterangan}</Baris>
            <Baris label="Sistem koordinat">{data.sistem_koordinat}</Baris>
            <Baris label="Cakupan">{data.cakupan.join(', ')} (barat, selatan, timur, utara)</Baris>
            <Baris label="Batas Query">{angka(data.batas_query)} objek per permintaan</Baris>
            <Baris label="Lihat di">
              <Tautan href="/peta">Peta Spasial</Tautan> · QGIS/ArcGIS: tambahkan koneksi WMS/WFS/WCS ke <code>{window.location.origin}{OWS}</code>
            </Baris>
            <Baris label="Layanan OGC">
              <Tautan href={kap('WMS')}>WMS</Tautan> · {kode === 'Oseanografi' ? <Tautan href={kap('WCS')}>WCS</Tautan> : <Tautan href={kap('WFS')}>WFS</Tautan>}
            </Baris>
            <Baris label="Format lain"><Tautan href={`${API_V1_URL}/inti/layanan/${kode}/`}>JSON</Tautan></Baris>
          </dl>
          <h2 className="text-lg font-bold text-kkp-900 pt-2">Layer</h2>
          <ul className="space-y-1.5">
            {data.lapisan.map((l) => (
              <li key={l.id} className="text-sm">
                <Tautan href={`${dasar}/${l.id}`}>{l.judul}</Tautan>
                <span className="text-slate-500"> ({l.id}) · {l.jenis === 'RASTER' ? 'raster' : `vektor ${l.jenis.toLowerCase()}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};

const InfoLapisan = ({ kode, nomor }) => {
  const [data, galat] = useData(`/inti/layanan/${kode}/${nomor}/`);
  const dasar = `${AKAR}/${kode}/MapServer`;
  return (
    <>
      <Jejak bagian={[[`${kode} (MapServer)`, dasar], [data?.judul || `Layer ${nomor}`]]} />
      <h1 className="text-2xl font-extrabold text-kkp-900">{data ? `${data.judul} (${nomor})` : `Layer ${nomor}`}</h1>
      {!data ? <Memuat galat={galat} /> : (
        <>
          <dl>
            <Baris label="Nama layanan OGC"><code>{data.nama}</code></Baris>
            <Baris label="Jenis">{data.jenis === 'RASTER' ? 'Raster' : `Vektor, geometri ${data.jenis.toLowerCase()}`}</Baris>
            <Baris label="Sistem koordinat">{data.sistem_koordinat}</Baris>
            <Baris label="Cakupan">{data.cakupan.join(', ')}</Baris>
            {data.jenis === 'RASTER' ? (
              <>
                <Baris label="Satuan">{data.satuan}</Baris>
                <Baris label="Periode">{data.periode || '-'}</Baris>
                <Baris label="Sumber">{data.sumber}</Baris>
              </>
            ) : (
              <>
                <Baris label="Jumlah objek">{angka(data.jumlah_objek)}</Baris>
                <Baris label="Kolom">{data.kolom.join(', ')}</Baris>
              </>
            )}
            <Baris label="Legenda">
              <img alt={`Legenda ${data.judul}`} src={`${OWS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${data.nama}&FORMAT=image/png&SLD_VERSION=1.1.0`} />
            </Baris>
            <Baris label="Operasi">
              {data.jenis !== 'RASTER' && <><Tautan href={`${dasar}/${nomor}/query`}>Query</Tautan> · </>}
              <Tautan href={peta(data.nama, data.pratinjau || data.cakupan, 1600)} target="_blank" rel="noreferrer">Ekspor peta (PNG)</Tautan>
            </Baris>
            <Baris label="Unduh">
              {data.jenis === 'RASTER'
                ? <Tautan href={wcs(data.nama, data.cakupan)} download={`${data.nama}.tif`}>GeoTIFF</Tautan>
                : <>
                    <Tautan href={wfs(data.nama, 'geojson')} download={`${data.nama}.geojson`}>GeoJSON</Tautan> ·{' '}
                    <Tautan href={wfs(data.nama, 'shapezip')} download={`${data.nama}.zip`}>Shapefile (ZIP)</Tautan> ·{' '}
                    <Tautan href={wfs(data.nama, 'kml')} download={`${data.nama}.kml`}>KML (Google Earth)</Tautan>
                    {data.jumlah_objek > 10000 && <span className="text-slate-500"> — paling banyak 10.000 objek; untuk satu wilayah pakai <Tautan href="/unduh-data">Unduh Data</Tautan></span>}
                  </>}
            </Baris>
            <Baris label="Format lain"><Tautan href={`${API_V1_URL}/inti/layanan/${kode}/${nomor}/`}>JSON</Tautan></Baris>
          </dl>
          <h2 className="text-lg font-bold text-kkp-900 pt-2">Pratinjau</h2>
          <img alt={`Pratinjau ${data.judul}`} src={peta(data.nama, data.pratinjau || data.cakupan)} className="max-w-full border border-slate-200 rounded-lg bg-slate-50" />
        </>
      )}
    </>
  );
};

const QueryLapisan = ({ kode, nomor }) => {
  const [data, galat] = useData(`/inti/layanan/${kode}/${nomor}/`);
  const [provinsi, setProvinsi] = useState([]);
  const [isian, setIsian] = useState({ kolom: '', operasi: 'sama', nilai: '', bbox: '', batas: '100' });
  const [hasil, setHasil] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const dasar = `${AKAR}/${kode}/MapServer`;

  useEffect(() => {
    api.get('/inti/provinsi/peta/').then(({ data: d }) => setProvinsi(d.features
      .map((f) => ({ nama: f.properties.nama, bbox: kotakGeometri(f.geometry).join(',') }))
      .sort((a, b) => a.nama.localeCompare(b.nama, 'id')))).catch(() => {});
  }, []);

  const parameter = Object.fromEntries(Object.entries(isian).filter(([k, v]) => v && (k !== 'nilai' || isian.kolom) && (k !== 'operasi' || isian.kolom)));
  const alamatJson = `${API_V1_URL}/inti/layanan/${kode}/${nomor}/query/?${new URLSearchParams(parameter)}`;
  const jalankan = (e) => {
    e.preventDefault();
    setMemuat(true);
    api.get(`/inti/layanan/${kode}/${nomor}/query/`, { params: parameter })
      .then(({ data: d }) => setHasil(d))
      .catch((er) => setHasil({ galat: er.response?.data?.galat || 'Query gagal.' }))
      .finally(() => setMemuat(false));
  };
  const ubah = (k) => (e) => setIsian((s) => ({ ...s, [k]: e.target.value }));
  const kelas = 'w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:border-kkp-700 focus:outline-none';
  const fitur = hasil?.features || [];
  const kolomHasil = fitur.length ? Object.keys(fitur[0].properties) : [];
  const unduhHasil = () => {
    const tautan = document.createElement('a');
    tautan.href = URL.createObjectURL(new Blob([JSON.stringify(hasil)], { type: 'application/geo+json' }));
    tautan.download = `${data.nama}_query.geojson`;
    tautan.click();
    URL.revokeObjectURL(tautan.href);
  };

  return (
    <>
      <Jejak bagian={[[`${kode} (MapServer)`, dasar], [data?.judul || `Layer ${nomor}`, `${dasar}/${nomor}`], ['Query']]} />
      <h1 className="text-2xl font-extrabold text-kkp-900">Query: {data?.judul || `Layer ${nomor}`}</h1>
      {!data ? <Memuat galat={galat} /> : (
        <form onSubmit={jalankan} className="grid sm:grid-cols-2 gap-3 max-w-3xl">
          <label className="text-xs font-semibold text-slate-600">Kolom
            <select value={isian.kolom} onChange={ubah('kolom')} className={kelas}>
              <option value="">Tanpa saringan atribut</option>
              {data.kolom.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Operasi dan nilai
            <div className="flex gap-2">
              <select value={isian.operasi} onChange={ubah('operasi')} className={kelas.replace('w-full', 'w-40 shrink-0')} disabled={!isian.kolom}>
                <option value="sama">sama dengan</option>
                <option value="mengandung">mengandung</option>
              </select>
              <input value={isian.nilai} onChange={ubah('nilai')} className={kelas} disabled={!isian.kolom} placeholder="mis. PARIWISATA" />
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-600">Wilayah (kotak batas)
            <select value={isian.bbox} onChange={ubah('bbox')} className={kelas}>
              <option value="">Seluruh cakupan</option>
              {provinsi.map((p) => <option key={p.nama} value={p.bbox}>{p.nama}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Jumlah paling banyak (≤ 1.000)
            <input type="number" min="1" max="1000" value={isian.batas} onChange={ubah('batas')} className={kelas} />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="rounded-lg bg-kkp-700 hover:bg-kkp-800 text-white text-sm font-semibold px-4 py-2" disabled={memuat}>
              {memuat ? 'Menjalankan…' : 'Jalankan Query'}
            </button>
            <Tautan href={alamatJson} target="_blank" rel="noreferrer">Alamat permintaan (JSON)</Tautan>
          </div>
        </form>
      )}
      {hasil?.galat && <p className="text-sm text-red-700">{hasil.galat}</p>}
      {hasil && !hasil.galat && (
        <section className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-kkp-900">{angka(fitur.length)} objek</p>
            {fitur.length > 0 && (
              <button type="button" onClick={unduhHasil} className="text-sm text-kkp-700 hover:underline">Unduh hasil (GeoJSON)</button>
            )}
          </div>
          {fitur.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="text-xs min-w-full">
                <thead className="bg-slate-50"><tr>{kolomHasil.map((k) => <th key={k} className="px-2 py-1.5 text-left font-semibold text-slate-600">{k}</th>)}</tr></thead>
                <tbody>
                  {fitur.slice(0, 50).map((f) => (
                    <tr key={f.id} className="border-t border-slate-100">
                      {kolomHasil.map((k) => <td key={k} className="px-2 py-1 text-slate-700 whitespace-nowrap">{String(f.properties[k] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fitur.length > 50 && <p className="text-xs text-slate-500">Tabel menampilkan 50 objek pertama; unduhan memuat semuanya.</p>}
        </section>
      )}
    </>
  );
};

const LayananPetaPage = () => {
  const { kode, nomor, aksi } = useParams();
  let isi = <DaftarLayanan />;
  if (kode && nomor !== undefined && aksi === 'query') isi = <QueryLapisan kode={kode} nomor={nomor} />;
  else if (kode && nomor !== undefined) isi = <InfoLapisan kode={kode} nomor={nomor} />;
  else if (kode) isi = <InfoLayanan kode={kode} />;
  return (
    <div className="h-full pt-[72px] overflow-y-auto bg-white custom-scrollbar">
      <div className="max-w-5xl mx-auto p-5 lg:p-8 space-y-4">{isi}</div>
    </div>
  );
};

export default LayananPetaPage;
