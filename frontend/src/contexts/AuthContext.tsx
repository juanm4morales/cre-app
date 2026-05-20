import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import api, { isAuthenticationError } from '../services/api';

type UserRole = 'docente' | 'admin';

interface AuthUser {
  name: string;
  role: UserRole;
  availableRoles: UserRole[];
}

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  availableRoles: UserRole[];
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: { username: string; password: string; role: UserRole }) => Promise<AuthUser>;
  switchRole: (role: UserRole) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'cre_auth_user';

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    const role = parsed.role === 'admin' || parsed.role === 'docente' ? parsed.role : null;
    if (!role) {
      return null;
    }

    const availableRoles = Array.isArray(parsed.availableRoles)
      ? parsed.availableRoles.filter((item): item is UserRole => item === 'admin' || item === 'docente')
      : [role];

    return {
      name: parsed.name || 'Usuario',
      role,
      availableRoles: availableRoles.length > 0 ? availableRoles : [role],
    };
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

function normalizeUser(data: unknown, fallbackName = 'Usuario'): AuthUser {
  const payload = (data && typeof data === 'object' ? data : {}) as {
    name?: string;
    username?: string;
    role?: string;
    available_roles?: string[];
  };
  const role: UserRole = payload.role === 'admin' ? 'admin' : 'docente';
  const availableRoles = Array.isArray(payload.available_roles)
    ? payload.available_roles.filter((item): item is UserRole => item === 'admin' || item === 'docente')
    : [role];

  return {
    name: payload.name || payload.username || fallbackName,
    role,
    availableRoles: availableRoles.length > 0 ? availableRoles : [role],
  };
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
        const nextUser = normalizeUser(response.data);

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

  const login = async ({ username, password, role }: { username: string; password: string; role: UserRole }) => {
    setLoading(true);
    try {
      await api.get('/auth/csrf');
      const response = await api.post('/auth/login', { username, password, role });
      const nextUser = normalizeUser(response.data, username);
      flushSync(() => {
        setUser(nextUser);
      });
      persistUser(nextUser);
      return nextUser;
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (role: UserRole) => {
    const response = await api.post('/auth/role', { role });
    const nextUser = normalizeUser(response.data, user?.name || 'Usuario');
    flushSync(() => {
      setUser(nextUser);
    });
    persistUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      persistUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role: user?.role || null,
    availableRoles: user?.availableRoles || [],
    isAuthenticated: Boolean(user?.role),
    loading,
    login,
    switchRole,
    logout,
    setUser,
  }), [user, loading, login, switchRole, logout]);

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
