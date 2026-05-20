import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  isAuthenticationError: vi.fn(() => false),
}));

function TestConsumer() {
  const { user, isAuthenticated, loading, login, logout, role } = useAuth();
  if (loading) return <div role="status">Loading...</div>;
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
      <span data-testid="user-role">{role || 'none'}</span>
      <span data-testid="user-name">{user?.name || 'anonymous'}</span>
      <button data-testid="login-btn" onClick={() => login({ username: 'test', password: 'pass', role: 'docente' })}>
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('AuthContext', () => {
  it('starts in loading state, then shows logged-out when unauthenticated', async () => {
    const mockGet = vi.mocked(api.get);
    mockGet.mockRejectedValue(new Error('Not authenticated'));

    renderWithProvider();

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });
  });

  it('restores user from localStorage on mount', async () => {
    window.localStorage.setItem('cre_auth_user', JSON.stringify({ name: 'Stored User', role: 'admin', availableRoles: ['admin', 'docente'] }));
    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { name: 'Stored User', role: 'admin', available_roles: ['admin', 'docente'] } });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
      expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Stored User');
    });
  });

  it('calls login and updates state on success', async () => {
    const mockGet = vi.mocked(api.get);
    const mockPost = vi.mocked(api.post);
    // First call: initial syncSession fails (not authenticated)
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    // Second call: login() calls /auth/csrf
    mockGet.mockResolvedValueOnce({});
    mockPost.mockResolvedValueOnce({ data: { name: 'Test User', role: 'docente', available_roles: ['docente'] } });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    });
  });

  it('login defaults unknown roles to docente', async () => {
    const mockGet = vi.mocked(api.get);
    const mockPost = vi.mocked(api.post);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    mockGet.mockResolvedValueOnce({});
    mockPost.mockResolvedValueOnce({ data: { name: 'Test User', role: 'unknown', available_roles: [] } });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('user-role')).toHaveTextContent('docente');
    });
  });

  it('logout clears user state', async () => {
    const mockGet = vi.mocked(api.get);
    const mockPost = vi.mocked(api.post);
    // Set up for initial login
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    mockGet.mockResolvedValueOnce({});
    mockPost.mockResolvedValueOnce({ data: { name: 'Test User', role: 'docente', available_roles: ['docente'] } });

    renderWithProvider();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });

    await user.click(screen.getByTestId('login-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
    });

    mockPost.mockResolvedValueOnce({});

    await user.click(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
    });
  });
});
