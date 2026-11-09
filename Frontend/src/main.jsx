import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { muatJenisInvestasi } from './api/klien';
import './index.css';

import 'leaflet/dist/leaflet.css';

muatJenisInvestasi().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
