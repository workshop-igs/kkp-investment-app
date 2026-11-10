import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Layers, Loader2, Search } from 'lucide-react';
import { api } from '../api/klien';
import { kotakGeometri } from '../utils/koordinat';

const OWS = '/ows';
const FORMAT_VEKTOR = [
  ['geojson', 'GeoJSON', 'geojson'],
  ['shapezip', 'Shapefile (ZIP)', 'zip'],
  ['kml', 'KML (Google Earth)', 'kml'],
];
const BATAS_OBJEK = 10000;

const alamatUnduh = (lapisan, format, kotak) => {
  if (lapisan.raster) {
    const [x0, y0, x1, y1] = kotak || [94, -12, 142, 7];
    return `${OWS}?SERVICE=WCS&VERSION=2.0.1&REQUEST=GetCoverage&COVERAGEID=${lapisan.nama}&FORMAT=image/tiff`
      + `&SUBSET=Lat(${y0},${y1})&SUBSET=Long(${x0},${x1})`;
  }
  return `${OWS}?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=${lapisan.nama}&OUTPUTFORMAT=${format}`
    + `&MAXFEATURES=${BATAS_OBJEK}${kotak ? `&BBOX=${kotak.join(',')}` : ''}`;
};

const BarisLapisan = ({ lapisan, kotak, wilayah }) => {
  const [format, setFormat] = useState('geojson');
  const ekstensi = lapisan.raster ? 'tif' : FORMAT_VEKTOR.find((f) => f[0] === format)[2];
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{lapisan.judul}</p>
        {lapisan.abstrak && <p className="text-xs text-slate-500 mt-0.5">{lapisan.abstrak}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lapisan.raster ? (
          <span className="text-xs text-slate-500 w-40 text-right">GeoTIFF</span>
        ) : (
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            aria-label={`Format ${lapisan.judul}`}
            className="w-40 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 focus:border-kkp-700 focus:outline-none"
          >
            {FORMAT_VEKTOR.map(([nilai, label]) => <option key={nilai} value={nilai}>{label}</option>)}
          </select>
        )}
        <a
          href={alamatUnduh(lapisan, format, kotak)}
          download={`${lapisan.nama}_${wilayah}.${ekstensi}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-kkp-700 hover:bg-kkp-800 text-white text-xs font-semibold px-3 py-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Unduh
        </a>
      </div>
    </li>
  );
};

const UnduhDataPage = () => {
  const [lapisan, setLapisan] = useState(null);
  const [provinsi, setProvinsi] = useState([]);
  const [kode, setKode] = useState('');
  const [cari, setCari] = useState('');

  useEffect(() => {
    let batal = false;
    fetch(`${OWS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`)
      .then((r) => r.text())
      .then((xml) => {
        const dok = new DOMParser().parseFromString(xml, 'application/xml');
        const daftar = [...dok.getElementsByTagName('Layer')]
          .map((l) => ({
            nama: l.querySelector(':scope > Name')?.textContent,
            judul: l.querySelector(':scope > Title')?.textContent,
            abstrak: l.querySelector(':scope > Abstract')?.textContent,
          }))
          .filter((l) => l.nama && l.nama !== 'kkp')
          .map((l) => ({ ...l, raster: l.nama.startsWith('oseanografi_') }));
        if (!batal) setLapisan(daftar);
      })
      .catch(() => { if (!batal) setLapisan([]); });
    api.get('/inti/provinsi/peta/')
      .then(({ data }) => {
        if (batal) return;
        setProvinsi(data.features
          .map((f) => ({ kode: f.properties.kode_bps, nama: f.properties.nama, kotak: kotakGeometri(f.geometry) }))
          .sort((a, b) => a.nama.localeCompare(b.nama, 'id')));
      })
      .catch(() => {});
    return () => { batal = true; };
  }, []);

  const terpilih = provinsi.find((p) => p.kode === kode);
  const wilayah = terpilih ? terpilih.nama.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'indonesia';
  const tersaring = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return (lapisan || []).filter((l) => !kata || `${l.judul} ${l.nama}`.toLowerCase().includes(kata));
  }, [lapisan, cari]);
  const kelompok = [['Data vektor', tersaring.filter((l) => !l.raster)], ['Data raster', tersaring.filter((l) => l.raster)]];

  return (
    <div className="h-full pt-[72px] overflow-y-auto bg-white custom-scrollbar">
      <div className="max-w-4xl mx-auto p-5 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-kkp-900">Unduh Data</h1>
          <p className="mt-1 text-sm text-slate-500">
            Unduh layer data rujukan ruang laut tanpa perlu masuk akun. Pilih wilayah, pilih format, lalu tekan Unduh.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Wilayah</span>
            <select
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              className="mt-1 w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
            >
              <option value="">Seluruh Indonesia</option>
              {provinsi.map((p) => <option key={p.kode} value={p.kode}>{p.nama}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cari layer</span>
            <div className="mt-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="mis. zonasi, mangrove, kedalaman"
                className="w-full text-sm bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:border-kkp-700 focus:outline-none focus:ring-1 focus:ring-kkp-700"
              />
            </div>
          </label>
        </div>

        <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-xs text-sky-900 leading-relaxed">
          Satu unduhan data vektor berisi paling banyak {BATAS_OBJEK.toLocaleString('id-ID')} objek. Untuk layer besar seperti
          zonasi atau mangrove, unduh per provinsi. Pilihan provinsi memakai kotak batas provinsi, sehingga objek di tepi
          provinsi tetangga dapat ikut terunduh. Data proyek investasi dan data pribadi tidak tersedia di sini.
        </div>

        {lapisan === null && (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Memuat daftar layer…</p>
        )}
        {lapisan?.length === 0 && <p className="text-sm text-slate-500">Layanan peta belum tersedia di server ini.</p>}

        {kelompok.map(([judul, isi]) => isi.length > 0 && (
          <section key={judul}>
            <h2 className="flex items-center gap-2 text-sm font-bold text-kkp-900">
              <Layers className="w-4 h-4" /> {judul} <span className="font-normal text-slate-400">({isi.length})</span>
            </h2>
            <ul className="mt-1 divide-y divide-slate-100">
              {isi.map((l) => <BarisLapisan key={l.nama} lapisan={l} kotak={terpilih?.kotak} wilayah={wilayah} />)}
            </ul>
          </section>
        ))}

        <p className="text-xs text-slate-400">
          Pengguna QGIS atau ArcGIS dapat memakai alamat layanan <code>{window.location.origin}{OWS}</code> secara langsung (WMS, WFS, WCS),
          atau menjelajahi <Link to="/rest/services" className="text-kkp-700 hover:underline">Direktori Layanan Peta</Link> untuk keterangan, Query, dan unduhan per layer.
        </p>
      </div>
    </div>
  );
};

export default UnduhDataPage;
