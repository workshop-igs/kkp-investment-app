import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../api/klien';
import { buatIkon, skalaIkon } from './ikonPeta';

const GAYA_TITIK = { radius: 5, color: '#0056A5', weight: 2, fillColor: '#ffffff', fillOpacity: 1 };

const radiusTitikJauh = (zoom) => 2 + Math.max(0, zoom - 4) * 0.75;

const dalamTampilan = (lapisan, batas) =>
  lapisan.getBounds ? batas.intersects(lapisan.getBounds()) : batas.contains(lapisan.getLatLng());

const LapisanVektorBBox = ({ url, style, onEachFeature, gayaTitik, ikon, warnaIkon, params, jeda = 400, onStatus, zoomPin }) => {
  const map = useMap();
  const lapor = useRef(onStatus);
  lapor.current = onStatus;
  const opsi = useRef({});
  opsi.current = { style, onEachFeature, gayaTitik, ikon, warnaIkon };
  const kunciParams = JSON.stringify(params || {});

  useEffect(() => {
    const kabari = (status) => lapor.current && lapor.current(status);
    const warnaDari = (p) => {
      const w = opsi.current.warnaIkon;
      return (typeof w === 'function' ? w(p || {}) : w) || '#0056A5';
    };
    const modePin = () => !zoomPin || map.getZoom() >= zoomPin;

    const pin = new Set();
    const bulat = new Set();
    const entri = new Map();
    let toleransi = null;
    let dimuat = null;
    let statusTerakhir = null;
    let pinAktif = modePin();
    let skalaPin = skalaIkon(map.getZoom());
    let baru = null;
    let timer = null;
    let pembatal = null;

    const buatPenanda = (latlng, p) => {
      if (!opsi.current.ikon) return L.circleMarker(latlng, opsi.current.gayaTitik || GAYA_TITIK);
      if (!pinAktif) {
        const titik = L.circleMarker(latlng, {
          pane: 'markerPane',
          radius: radiusTitikJauh(map.getZoom()),
          color: '#ffffff',
          weight: 1,
          fillColor: warnaDari(p),
          fillOpacity: 0.95,
        });
        bulat.add(titik);
        return titik;
      }
      const penanda = L.marker(latlng, {
        icon: buatIkon(opsi.current.ikon, warnaDari(p), skalaPin),
        riseOnHover: true,
      });
      pin.add(penanda);
      return penanda;
    };

    const geo = L.geoJSON(null, {
      style: (f) => (typeof opsi.current.style === 'function' ? opsi.current.style(f) : opsi.current.style),
      pointToLayer: (f, latlng) => buatPenanda(latlng, f.properties),
      onEachFeature: (f, lapisan) => {
        baru = lapisan;
        if (opsi.current.onEachFeature) opsi.current.onEachFeature(f, lapisan);
      },
    }).addTo(map);
    const grupTitik = L.layerGroup().addTo(map);

    const tambah = (f) => {
      baru = null;
      geo.addData(f);
      const bidang = baru;
      const t = f.properties?.titik;
      let titik = null;
      if (
        opsi.current.ikon
        && Array.isArray(t)
        && f.geometry?.type !== 'Point'
        && f.geometry?.type !== 'MultiPoint'
      ) {
        titik = buatPenanda(L.latLng(t[1], t[0]), f.properties);
        titik.feature = { type: 'Feature', id: f.id, geometry: { type: 'Point', coordinates: t }, properties: f.properties };
        if (opsi.current.onEachFeature) opsi.current.onEachFeature(titik.feature, titik);
        grupTitik.addLayer(titik);
      }
      return { bidang, titik, fitur: f };
    };

    const buang = (e) => {
      [e.bidang, e.titik].forEach((l) => {
        if (!l) return;
        pin.delete(l);
        bulat.delete(l);
      });
      if (e.bidang) geo.removeLayer(e.bidang);
      if (e.titik) grupTitik.removeLayer(e.titik);
    };

    const terapkan = (fitur, tol) => {
      const berId = fitur.every((f) => f.id !== undefined && f.id !== null);
      const kunci = (f, i) => (berId ? `${f.id}:${Boolean(f.properties?.titik)}` : i);
      if (!berId || tol !== toleransi) {
        entri.forEach(buang);
        entri.clear();
      }
      toleransi = tol;
      const sisa = new Set(entri.keys());
      let ditambah = false;
      fitur.forEach((f, i) => {
        const k = kunci(f, i);
        if (entri.has(k)) {
          sisa.delete(k);
          return;
        }
        entri.set(k, tambah(f));
        ditambah = true;
      });
      sisa.forEach((k) => {
        buang(entri.get(k));
        entri.delete(k);
      });
      if (ditambah) {
        fitur.forEach((f, i) => entri.get(kunci(f, i))?.bidang?.bringToFront?.());
      }
    };

    const saatZoom = () => {
      const zoom = map.getZoom();
      if (modePin() !== pinAktif) {
        pinAktif = !pinAktif;
        skalaPin = skalaIkon(zoom);
        const batas = map.getBounds();
        const daftar = [...entri.entries()];
        entri.clear();
        daftar.forEach(([k, e]) => {
          const masuk = [e.bidang, e.titik].some((l) => l && dalamTampilan(l, batas));
          buang(e);
          if (masuk) entri.set(k, tambah(e.fitur));
        });
        if (dimuat) dimuat = { ...dimuat, batas };
        return;
      }
      if (skalaIkon(zoom) !== skalaPin) {
        skalaPin = skalaIkon(zoom);
        pin.forEach((p) => p.setIcon(buatIkon(opsi.current.ikon, warnaDari(p.feature?.properties), skalaPin)));
      }
      const r = radiusTitikJauh(zoom);
      bulat.forEach((t) => t.setRadius(r));
    };

    const muat = () => {
      const b = map.getBounds();

      if (b.getWest() === b.getEast() || b.getSouth() === b.getNorth()) return;

      if (dimuat && dimuat.lengkap && dimuat.batas.contains(b)) {
        if (statusTerakhir) {
          let jumlah = 0;
          entri.forEach((e) => {
            if ([e.bidang, e.titik].some((l) => l && dalamTampilan(l, b))) jumlah += 1;
          });
          kabari({ ...statusTerakhir, jumlah });
        }
        return;
      }

      const bbox = [
        b.getWest().toFixed(4),
        b.getSouth().toFixed(4),
        b.getEast().toFixed(4),
        b.getNorth().toFixed(4),
      ].join(',');

      if (pembatal) pembatal.abort();
      const kontrol = new AbortController();
      pembatal = kontrol;

      kabari({ memuat: true });

      api
        .get(url, { params: { ...JSON.parse(kunciParams), bbox }, signal: kontrol.signal })
        .then(({ data: d }) => {
          const fc = d && d.type === 'FeatureCollection' ? d : null;
          const tol = fc?.meta?.toleransi_penyederhanaan ?? 0;
          terapkan(fc?.features || [], tol);
          dimuat = { batas: b, lengkap: !!fc && !fc.meta?.dipangkas && tol === 0 };
          statusTerakhir = {
            memuat: false,
            galat: null,
            jumlah: fc?.features?.length ?? 0,
            dipangkas: !!fc?.meta?.dipangkas,
            batas: fc?.meta?.batas_fitur ?? null,
            pemilihan: fc?.meta?.pemilihan ?? 'terbesar',
          };
          kabari(statusTerakhir);
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
    };

    const jadwalkan = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(muat, jeda);
    };

    muat();
    map.on('zoomend', saatZoom);
    map.on('moveend zoomend resize', jadwalkan);
    return () => {
      map.off('zoomend', saatZoom);
      map.off('moveend zoomend resize', jadwalkan);
      if (timer) clearTimeout(timer);
      if (pembatal) pembatal.abort();
      map.removeLayer(geo);
      map.removeLayer(grupTitik);
      kabari(null);
    };
  }, [map, url, kunciParams, jeda, zoomPin]);

  return null;
};

export default LapisanVektorBBox;
