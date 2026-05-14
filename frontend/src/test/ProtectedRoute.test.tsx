import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, UnauthorizedPage, NotFoundPage } from '../components/ProtectedRoute';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

interface AuthUser {
  name: string;
  role: 'docente' | 'admin';
}

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    post: vi.fn(),
  },
  isAuthenticationError: vi.fn(() => false),
}));

let _resolveLogin: ((user: AuthUser) => void) | null = null;

function MockLogin() {
  const { login } = useAuth();
  return (
    <div>
      <span>Login page</span>
      <button onClick={async () => {
        const user = await login({ username: 'admin', password: 'pass' });
        _resolveLogin?.(user);
      }}>
        Authenticate
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  _resolveLogin = null;
});

function renderProtectedRoute(initialUrl: string, requiredRole?: 'docente' | 'admin') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<MockLogin />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<ProtectedRoute requiredRole={requiredRole} />}>
            <Route path="/admin" element={<div data-testid="protected-content">Admin Panel</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated', async () => {
    renderProtectedRoute('/admin', 'admin');

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument();
    });
  });

  it('renders children when authenticated with correct role', async () => {
    window.localStorage.setItem('cre_auth_user', JSON.stringify({ name: 'Admin', role: 'admin' }));

    const mockGet = vi.mocked((await import('../services/api')).default.get);
    mockGet.mockResolvedValueOnce({ data: { name: 'Admin', role: 'admin' } });

    renderProtectedRoute('/admin', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toHaveTextContent('Admin Panel');
    });
  });

  it('redirects to /unauthorized when role does not match', async () => {
    window.localStorage.setItem('cre_auth_user', JSON.stringify({ name: 'Docente', role: 'docente' }));

    const mockGet = vi.mocked((await import('../services/api')).default.get);
    mockGet.mockResolvedValueOnce({ data: { name: 'Docente', role: 'docente' } });

    renderProtectedRoute('/admin', 'admin');

    await waitFor(() => {
      expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    });
  });
});

describe('UnauthorizedPage', () => {
  it('renders error message', () => {
    render(
      <MemoryRouter>
        <UnauthorizedPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('No tenés permisos para entrar')).toBeInTheDocument();
  });
});

describe('NotFoundPage', () => {
  it('renders 404 message', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
  });
});
