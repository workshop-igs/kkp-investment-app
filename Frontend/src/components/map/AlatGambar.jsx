import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const POLYGON_COLORS = {
  LAYAK:       { color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.20, weight: 2.5 },
  PERINGATAN:  { color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.20, weight: 2.5 },
  TIDAK_LAYAK: { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.20, weight: 2.5 },
  DEFAULT:     { color: '#2dd4bf', fillColor: '#2dd4bf', fillOpacity: 0.12, weight: 2, dashArray: '6,4' },
};

export const BATAS_TITIK_UBAH = 600;

const ikonTitik = (warna, besar) => L.divIcon({
  className: '',
  html: `<span style="display:block;width:100%;height:100%;border-radius:9999px;background:${warna};border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,42,.45);cursor:grab"></span>`,
  iconSize: [besar, besar],
});

const poligonDari = (lapisan) => (lapisan instanceof L.Polygon ? [lapisan] : (lapisan?.getLayers?.() || []).filter((l) => l instanceof L.Polygon));
const titikDari = (latlngs) => (Array.isArray(latlngs) ? latlngs.flatMap(titikDari) : [latlngs]);

export const MapOverlayLayers = ({ layers, visibility }) => {
  const map = useMap();
  const layerRefs = useRef({});

  useEffect(() => {
    Object.values(layerRefs.current).forEach(l => { try { map.removeLayer(l) } catch (_) {} });
    layerRefs.current = {};

    if (!layers?.length) return;

    layers.forEach(layer => {
      if (!layer.features) return;
      const fc = typeof layer.features === 'string' ? JSON.parse(layer.features) : layer.features;
      if (!fc?.features?.length && fc?.type !== 'FeatureCollection') return;

      const geoLayer = L.geoJSON(fc, {
        style: (feature) => ({
          color:       feature?.properties?.stroke  || layer.color,
          fillColor:   feature?.properties?.fill    || layer.color,
          fillOpacity: feature?.properties?.fillOpacity ?? layer.opacity ?? 0.35,
          weight:      1.5,
          opacity:     0.85,
        }),
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            radius:      8,
            fillColor:   layer.color,
            color:       '#ffffff',
            weight:      2,
            opacity:     1,
            fillOpacity: 0.95,
          }),
        onEachFeature: (feature, featureLayer) => {
          const p = feature?.properties || {};
          const tip = p.tooltip || p.layer_label || layer.label;
          if (tip) featureLayer.bindTooltip(tip, { sticky: true, className: 'map-tooltip' });
          if (feature?.geometry?.type === 'Point' && p.point_label) {
            featureLayer.bindTooltip(p.point_label, {
              permanent: true, direction: 'top', className: 'elevation-label',
            });
          }
        },
      });

      layerRefs.current[layer.id] = geoLayer;
      if (visibility[layer.id] !== false) geoLayer.addTo(map);
    });

    return () => {
      Object.values(layerRefs.current).forEach(l => { try { map.removeLayer(l) } catch (_) {} });
      layerRefs.current = {};
    };
  }, [layers, map]);

  useEffect(() => {
    if (!layers?.length) return;
    layers.forEach(layer => {
      const gl = layerRefs.current[layer.id];
      if (!gl) return;
      if (visibility[layer.id] === false) {
        if (map.hasLayer(gl)) map.removeLayer(gl);
      } else {
        if (!map.hasLayer(gl)) gl.addTo(map);
      }
    });
  }, [visibility, layers, map]);

  return null;
};

export const DrawingLayer = forwardRef(function DrawingLayer(
  { onPolygonCompleted, onVertexCountChange },
  ref
) {
  const map = useMap();
  const isActiveRef        = useRef(false);
  const verticesRef        = useRef([]);
  const vtxMarkersRef      = useRef([]);
  const previewLineRef     = useRef(null);
  const closingLineRef     = useRef(null);
  const guideLineRef       = useRef(null);
  const completedPolyRef   = useRef(null);
  const ubahRef            = useRef(null);

  const PANE_GAMBAR = 'alat-gambar';
  if (!map.getPane(PANE_GAMBAR)) {
    map.createPane(PANE_GAMBAR).style.zIndex = 450;
  }
  const opsiPane = { pane: PANE_GAMBAR };

  const notify = (n) => onVertexCountChange(n);
  const removeLayer = (r) => { if (r.current) { map.removeLayer(r.current); r.current = null; } };

  const rebuildLines = () => {
    const verts = verticesRef.current;
    removeLayer(previewLineRef);
    removeLayer(closingLineRef);
    if (verts.length > 1)
      previewLineRef.current = L.polyline(verts, { ...opsiPane, interactive: false, color: '#2dd4bf', weight: 2.5, dashArray: '8,4', opacity: 0.9 }).addTo(map);
    if (verts.length >= 3)
      closingLineRef.current = L.polyline([verts[verts.length - 1], verts[0]], { ...opsiPane, interactive: false, color: '#2dd4bf', weight: 1.5, dashArray: '4,4', opacity: 0.35 }).addTo(map);
  };

  const cleanupPreview = () => {
    vtxMarkersRef.current.forEach(m => map.removeLayer(m));
    vtxMarkersRef.current = [];
    removeLayer(previewLineRef);
    removeLayer(closingLineRef);
    removeLayer(guideLineRef);
    verticesRef.current = [];
    notify(0);
  };

  const lepasPegangan = () => {
    ubahRef.current?.pegangan.forEach((h) => map.removeLayer(h));
    ubahRef.current = null;
  };

  const ubahTitik = () => {
    const lapisan = poligonDari(completedPolyRef.current);
    const jumlah = lapisan.reduce((n, p) => n + titikDari(p.getLatLngs()).length, 0);
    if (!lapisan.length || ubahRef.current || jumlah > BATAS_TITIK_UBAH) return false;
    const pegangan = lapisan.flatMap((p) => titikDari(p.getLatLngs()).map((ll) => {
      const h = L.marker(ll, { ...opsiPane, icon: ikonTitik('#ffffff', 12), draggable: true, keyboard: false }).addTo(map);
      h.on('drag', (ev) => {
        const baru = ev.target.getLatLng();
        ll.lat = baru.lat;
        ll.lng = baru.lng;
        p.setLatLngs(p.getLatLngs());
      });
      return h;
    }));
    ubahRef.current = { pegangan, asli: lapisan.map((p) => JSON.parse(JSON.stringify(p.getLatLngs()))) };
    return true;
  };

  const selesaiUbah = () => {
    if (!ubahRef.current) return;
    lepasPegangan();
    const bentuk = poligonDari(completedPolyRef.current).map((p) => p.toGeoJSON().geometry);
    onPolygonCompleted(bentuk.length === 1 ? bentuk[0] : {
      type: 'MultiPolygon',
      coordinates: bentuk.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)),
    }, completedPolyRef.current);
  };

  const batalUbah = () => {
    if (!ubahRef.current) return;
    const { asli } = ubahRef.current;
    lepasPegangan();
    poligonDari(completedPolyRef.current).forEach((p, i) => p.setLatLngs(asli[i]));
  };

  const startDrawing = () => {
    cleanupPreview();
    lepasPegangan();
    if (completedPolyRef.current) { map.removeLayer(completedPolyRef.current); completedPolyRef.current = null; }
    isActiveRef.current = true;
    map.getContainer().style.cursor = 'crosshair';
    map.doubleClickZoom.disable();
  };

  const finish = () => {
    if (verticesRef.current.length < 3) return;
    const verts = [...verticesRef.current];
    cleanupPreview();
    isActiveRef.current = false;
    map.getContainer().style.cursor = '';
    map.doubleClickZoom.enable();
    if (completedPolyRef.current) map.removeLayer(completedPolyRef.current);
    const poly = L.polygon(verts, { ...POLYGON_COLORS.DEFAULT }).addTo(map);
    completedPolyRef.current = poly;
    onPolygonCompleted(poly.toGeoJSON().geometry, poly);
  };

  const undo = () => {
    if (verticesRef.current.length === 0) return;
    verticesRef.current.pop();
    const m = vtxMarkersRef.current.pop();
    if (m) map.removeLayer(m);
    if (vtxMarkersRef.current.length > 0) {
      vtxMarkersRef.current[0].setIcon(ikonTitik(verticesRef.current.length >= 3 ? '#2dd4bf' : '#ffffff', 14));
    }
    rebuildLines();
    notify(verticesRef.current.length);
  };

  const cancel = () => {
    cleanupPreview();
    isActiveRef.current = false;
    map.getContainer().style.cursor = '';
    map.doubleClickZoom.enable();
    onPolygonCompleted(null, null);
  };

  const removePolygon = () => {
    lepasPegangan();
    if (completedPolyRef.current) { map.removeLayer(completedPolyRef.current); completedPolyRef.current = null; }
  };

  const updatePolygonColor = (feasibility) => {
    if (!completedPolyRef.current) return;
    completedPolyRef.current.setStyle(POLYGON_COLORS[feasibility] || POLYGON_COLORS.DEFAULT);
  };

  const loadGeometry = (geometry) => {
    if (!['Polygon', 'MultiPolygon'].includes(geometry?.type)) return;
    cleanupPreview();
    lepasPegangan();
    isActiveRef.current = false;
    map.getContainer().style.cursor = '';
    map.doubleClickZoom.enable();
    if (completedPolyRef.current) { map.removeLayer(completedPolyRef.current); completedPolyRef.current = null; }

    const geoLayer = L.geoJSON(geometry, {
      style: POLYGON_COLORS.DEFAULT
    }).addTo(map);
    
    completedPolyRef.current = geoLayer;
    map.fitBounds(geoLayer.getBounds(), { padding: [50, 50] });
    
    onPolygonCompleted(geometry, geoLayer);
  };

  const sorotPoligon = () => {
    const poly = completedPolyRef.current;
    if (!poly) return;
    map.flyToBounds(poly.getBounds(), { padding: [60, 60], duration: 0.8 });
  };

  useImperativeHandle(ref, () => ({
    startDrawing, finish, undo, cancel, removePolygon, updatePolygonColor,
    loadGeometry, sorotPoligon, ubahTitik, selesaiUbah, batalUbah,
  }));

  useEffect(() => {
    const handleClick = (e) => {
      if (!isActiveRef.current) return;
      const verts = verticesRef.current;
      verts.push(e.latlng);
      const isFirst = verts.length === 1;
      const urutan = verts.length - 1;
      const m = L.marker(e.latlng, {
        ...opsiPane, icon: ikonTitik('#ffffff', isFirst ? 14 : 10), draggable: true, keyboard: false, zIndexOffset: isFirst ? 100 : 0,
      }).addTo(map);
      m.on('drag', (ev) => {
        verticesRef.current[urutan] = ev.target.getLatLng();
        removeLayer(guideLineRef);
        rebuildLines();
      });
      if (isFirst) {
        m.on('click', (ev) => { L.DomEvent.stop(ev); if (verticesRef.current.length >= 3) finish(); });
      }
      vtxMarkersRef.current.push(m);
      if (verts.length === 3 && vtxMarkersRef.current[0])
        vtxMarkersRef.current[0].setIcon(ikonTitik('#2dd4bf', 14));
      rebuildLines();
      notify(verts.length);
    };

    const handleMouseMove = (e) => {
      if (!isActiveRef.current || verticesRef.current.length === 0) return;
      removeLayer(guideLineRef);
      const last = verticesRef.current[verticesRef.current.length - 1];
      guideLineRef.current = L.polyline([last, e.latlng], { ...opsiPane, interactive: false, color: '#2dd4bf', weight: 1.5, dashArray: '4,6', opacity: 0.5 }).addTo(map);
    };

    const handleDblClick = (e) => { L.DomEvent.stopPropagation(e); };

    const handleKeyDown = (e) => {
      if (!isActiveRef.current) return;
      if (e.key === 'Enter')                              finish();
      else if (e.key === 'Escape')                        cancel();
      else if (e.key === 'Backspace' || e.key === 'Delete') undo();
    };

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    map.on('dblclick', handleDblClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('dblclick', handleDblClick);
      document.removeEventListener('keydown', handleKeyDown);
      cleanupPreview();
    };
  }, [map]);

  return null;
});
