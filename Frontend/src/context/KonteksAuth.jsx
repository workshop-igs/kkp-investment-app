import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/klien';
import {
  USER_KEY,
  getAccessToken,
  hapusToken,
  mintaToken,
} from '../api/autentikasi';

const KonteksAuth = createContext(null);

export const PenyediaAuth = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => getAccessToken());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  useEffect(() => {
    if (!getAccessToken()) return;
    api
      .get('/inti/auth/me/')
      .then(({ data }) => {
        if (data.authenticated) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const idPengguna = user?.id;
  useEffect(() => {
    if (!idPengguna) return undefined;
    const denyut = () => {
      if (document.visibilityState === 'visible') api.get('/inti/auth/denyut/').catch(() => {});
    };
    denyut();
    const t = setInterval(denyut, 60_000);
    document.addEventListener('visibilitychange', denyut);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', denyut);
    };
  }, [idPengguna]);

  const muatProfil = async () => {
    const { data } = await api.get('/inti/auth/me/');
    if (!data.authenticated) {
      throw new Error('Token diterima tetapi sesi tidak dikenali server.');
    }
    setUser(data.user);
    setToken(getAccessToken());
    return { user: data.user };
  };

  const login = async (username, password) => {
    setLoading(true);
    try {
      await mintaToken(username, password);
      return await muatProfil();
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    setLoading(true);
    try {
      const { data } = await api.post('/inti/auth/register/', formData);
      await mintaToken(formData.username, formData.password);
      const hasil = await muatProfil();
      return { ...data, ...hasil };
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (username) => {
    return login(username, 'password123');
  };

  const logout = async () => {
    try {
      await api.post('/inti/auth/logout/');
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setToken(null);
      hapusToken();
    }
  };

  return (
    <KonteksAuth.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      demoLogin,
      logout,
      perbaruiUser: setUser,
    }}>
      {children}
    </KonteksAuth.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(KonteksAuth);
  if (!context) {
    throw new Error('useAuth must be used within an PenyediaAuth');
  }
  return context;
};

export default KonteksAuth;
