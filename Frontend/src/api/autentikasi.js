import axios from 'axios';
import { API_BASE_URL, API_V1_URL } from '../api/alamat';

const AKSES_KEY = 'kkp_access_token';
const REFRESH_KEY = 'kkp_refresh_token';
const KEDALUWARSA_KEY = 'kkp_token_expires_at';
export const USER_KEY = 'kkp_auth_user';

const KUNCI_USANG = 'kkp_auth_token';

const TOKEN_URL = `${API_BASE_URL}/o/token/`;
const SCOPE = 'read write';

let konfigCache = null;

const getOAuthConfig = async () => {
  if (konfigCache) return konfigCache;
  const { data } = await axios.get(`${API_V1_URL}/inti/auth/config/`);
  konfigCache = data;
  return data;
};

export const getAccessToken = () => localStorage.getItem(AKSES_KEY);
const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

const simpanToken = (data) => {
  localStorage.setItem(AKSES_KEY, data.access_token);
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
  }
  if (data.expires_in) {
    localStorage.setItem(KEDALUWARSA_KEY, String(Date.now() + data.expires_in * 1000));
  }
  localStorage.removeItem(KUNCI_USANG);
};

export const hapusToken = () => {
  [AKSES_KEY, REFRESH_KEY, KEDALUWARSA_KEY, USER_KEY, KUNCI_USANG].forEach((k) =>
    localStorage.removeItem(k)
  );
};

const pesanGalat = (error) => {
  const data = error.response?.data;
  if (!data) {
    return 'Tidak dapat menghubungi server. Pastikan backend berjalan di port 8000.';
  }
  if (data.error === 'invalid_grant') {
    return 'Username/email atau kata sandi tidak valid.';
  }
  if (data.error === 'invalid_client') {
    return 'Aplikasi OAuth2 belum terdaftar dengan benar. Jalankan: python manage.py setup_oauth_app';
  }
  if (data.error === 'unsupported_grant_type') {
    return 'Konfigurasi OAuth2 tidak sesuai (grant type tidak didukung).';
  }
  return data.error_description || data.detail || data.error || 'Gagal melakukan autentikasi.';
};

export const mintaToken = async (username, password) => {
  const { client_id } = await getOAuthConfig();

  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    client_id,
    scope: SCOPE,
  });

  try {
    const { data } = await axios.post(TOKEN_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    simpanToken(data);
    return data;
  } catch (error) {
    throw new Error(pesanGalat(error));
  }
};

export const segarkanToken = async () => {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;

  try {
    const { client_id } = await getOAuthConfig();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id,
    });
    const { data } = await axios.post(TOKEN_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    simpanToken(data);
    return data.access_token;
  } catch {
    return null;
  }
};
