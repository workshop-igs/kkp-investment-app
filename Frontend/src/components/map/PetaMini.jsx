import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-minimap';
import 'leaflet-minimap/src/Control.MiniMap.css';

const PetaMini = () => {
  const map = useMap();

  useEffect(() => {
    const minimapLayer = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: 0,
      maxZoom: 13,
      attribution: '&copy; OpenStreetMap'
    });

    const miniMap = new L.Control.MiniMap(minimapLayer, {
      position: 'bottomleft',
      toggleDisplay: true,
      minimized: false,
      width: 150,
      height: 150,
      zoomLevelOffset: -5,
      zoomAnimation: true,
      aimingRectOptions: { color: '#0056A5', weight: 1.5, fillColor: '#0056A5', fillOpacity: 0.12 },
      shadowRectOptions: { color: '#99bbdb', weight: 1, opacity: 0, fillOpacity: 0 }
    }).addTo(map);

    return () => {
      miniMap.remove();
    };
  }, [map]);

  return null;
};

export default PetaMini;
