import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../api/klien';
import { buatIkon, skalaIkon } from './ikonPeta';

const LapisanVektorBBox = ({ url, style, onEachFeature, gayaTitik, ikon, warnaIkon, params, jeda = 400, onStatus }) => {
  const map = useMap();
  const [data, setData] = useState(null);
  const [kunciRender, setKunciRender] = useState(0);
  const timer = useRef(null);
  const pembatal = useRef(null);
  const lapor = useRef(onStatus);
  lapor.current = onStatus;
  const kabari = (status) => lapor.current && lapor.current(status);
  const kunciParams = JSON.stringify(params || {});

  const muat = useCallback(() => {
    const b = map.getBounds();

    if (b.getWest() === b.getEast() || b.getSouth() === b.getNorth()) return;

    const bbox = [
      b.getWest().toFixed(4),
      b.getSouth().toFixed(4),
      b.getEast().toFixed(4),
      b.getNorth().toFixed(4),
    ].join(',');

    if (pembatal.current) pembatal.current.abort();
    const kontrol = new AbortController();
    pembatal.current = kontrol;

    kabari({ memuat: true });

    api
      .get(url, { params: { ...(params || {}), bbox }, signal: kontrol.signal })
      .then(({ data: d }) => {
        const fc = d && d.type === 'FeatureCollection' ? d : null;
        setData(fc);
        setKunciRender((k) => k + 1);
        kabari({
          memuat: false,
          galat: null,
          jumlah: fc?.features?.length ?? 0,
          dipangkas: !!fc?.meta?.dipangkas,
          batas: fc?.meta?.batas_fitur ?? null,
          pemilihan: fc?.meta?.pemilihan ?? 'terbesar',
        });
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;

        const kode = err.response?.status;
        const pesan =
          kode === 429
            ? 'Terlalu banyak permintaan — tunggu sebentar'
            : kode === 401 || kode === 403
            ? 'Sesi berakhir, masuk kembali'
            : kode >= 500
            ? 'Server sedang bermasalah'
            : err.code === 'ECONNABORTED'
            ? 'Server tidak menjawab tepat waktu'
            : 'Tidak dapat menghubungi server';

        console.error('Gagal memuat lapisan', url, kode || err.code, err);
        kabari({ memuat: false, galat: pesan, kode: kode || null });
      });
  }, [map, url, kunciParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const jadwalkan = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(muat, jeda);
    };
    muat();
    map.on('moveend zoomend resize', jadwalkan);
    return () => {
      map.off('moveend zoomend resize', jadwalkan);
      if (timer.current) clearTimeout(timer.current);
      if (pembatal.current) pembatal.current.abort();
      kabari(null);
    };
  }, [map, muat, jeda]); // eslint-disable-line react-hooks/exhaustive-deps

  const dataTitik = useMemo(() => {
    if (!ikon || !data?.features?.length) return null;
    const titik = data.features
      .filter(
        (f) =>
          Array.isArray(f?.properties?.titik)
          && f.geometry?.type !== 'Point'
          && f.geometry?.type !== 'MultiPoint'
      )
      .map((f) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: f.properties.titik },
        properties: f.properties,
      }));
    return titik.length ? { type: 'FeatureCollection', features: titik } : null;
  }, [data, ikon]);

  if (!data || !data.features?.length) return null;

  const gambarTitik = (fitur, latlng) => {
    const warna = (typeof warnaIkon === 'function' ? warnaIkon(fitur.properties || {}) : warnaIkon) || '#0056A5';
    if (ikon) {
      return L.marker(latlng, {
        icon: buatIkon(ikon, warna, skalaIkon(map.getZoom())),
        riseOnHover: true,
      });
    }
    return L.circleMarker(
      latlng,
      gayaTitik || { radius: 5, color: '#0056A5', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }
    );
  };

  return (
    <>
      <GeoJSON
        key={`bidang-${kunciRender}`}
        data={data}
        style={style}
        onEachFeature={onEachFeature}
        pointToLayer={gambarTitik}
      />
      {dataTitik && (
        <GeoJSON
          key={`titik-${kunciRender}`}
          data={dataTitik}
          onEachFeature={onEachFeature}
          pointToLayer={gambarTitik}
        />
      )}
    </>
  );
};

export default LapisanVektorBBox;
