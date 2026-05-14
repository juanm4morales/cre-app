import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import api, { isAuthenticationError } from '../services/api';

type UserRole = 'docente' | 'admin';

interface AuthUser {
  name: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: { username: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'cre_auth_user';

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      try {
        await api.get('/auth/csrf');
        const response = await api.get('/auth/me');
        const apiRole = response.data?.role;
        const nextUser: AuthUser = {
          name: response.data?.name || response.data?.username || 'Usuario',
          role: apiRole === 'admin' || apiRole === 'docente' ? apiRole : 'docente',
        };

        if (!isMounted) {
          return;
        }

        setUser(nextUser);
        persistUser(nextUser);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (isAuthenticationError(error)) {
          setUser(null);
          persistUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    syncSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async ({ username, password }: { username: string; password: string }) => {
    setLoading(true);
    try {
      await api.get('/auth/csrf');
      const response = await api.post('/auth/login', { username, password });
      const apiRole = response.data?.role;
      const nextUser: AuthUser = {
        name: response.data?.name || username,
        role: apiRole === 'admin' || apiRole === 'docente' ? apiRole : 'docente',
      };
      setUser(nextUser);
      persistUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      persistUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      role: user?.role || null,
      isAuthenticated: Boolean(user?.role),
      loading,
      login,
      logout,
      setUser,
    };
  }, [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
