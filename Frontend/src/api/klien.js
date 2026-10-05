import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_V1_URL } from '../api/alamat';
import { getAccessToken, hapusToken, segarkanToken } from './autentikasi';
import { SECTORS } from '../utils/konstanta';

export const api = axios.create({
  baseURL: API_V1_URL,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshBerjalan = null;

const segarkanSekali = () => {
  if (!refreshBerjalan) {
    refreshBerjalan = segarkanToken().finally(() => {
      refreshBerjalan = null;
    });
  }
  return refreshBerjalan;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const asli = error.config;
    const status = error.response?.status;

    const tidakTerautentikasi =
      status === 401 ||
      (status === 403 && error.response?.data?.detail?.includes('autentikasi'));

    if (tidakTerautentikasi && asli && !asli._percobaanUlang) {
      asli._percobaanUlang = true;

      const tokenBaru = await segarkanSekali();
      if (tokenBaru) {
        asli.headers.Authorization = `Bearer ${tokenBaru}`;
        return api(asli);
      }

      hapusToken();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const jalankanAnalisisKelayakan = async (geometry, sektor, parameterFinansial) => {
  const { data } = await api.post('/analitik/analisis/', {
    geometry,
    sektor,
    ...parameterFinansial,
  });
  return data;
};

export const ambilDaftar = (data) => (Array.isArray(data) ? data : data?.results ?? []);

export const useSektorAktif = () => {
  const [daftar, setDaftar] = useState(SECTORS);
  useEffect(() => {
    if (!getAccessToken()) return;
    api.get('/inti/sektor/')
      .then(({ data }) => {
        const aktif = ambilDaftar(data).map((s) => ({ id: s.kode, label: s.nama }));
        if (aktif.length) setDaftar(aktif);
      })
      .catch(() => {});
  }, []);
  return daftar;
};

export default api;
