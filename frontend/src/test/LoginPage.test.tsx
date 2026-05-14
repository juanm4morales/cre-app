import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../contexts/AuthContext';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  isAuthenticationError: vi.fn(() => false),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('LoginPage', () => {
  it('renders the login form', async () => {
    const mockGet = vi.mocked(api.get);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));

    renderLoginPage();

    expect(await screen.findByText('Ingreso a la plataforma')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const mockGet = vi.mocked(api.get);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));

    renderLoginPage();

    await screen.findByText('Ingreso a la plataforma');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('El usuario es requerido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
  });

  it('calls login on valid form submission', async () => {
    const mockGet = vi.mocked(api.get);
    const mockPost = vi.mocked(api.post);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    mockPost.mockResolvedValueOnce({ data: { name: 'Test User', role: 'docente' } });

    renderLoginPage();

    await screen.findByText('Ingreso a la plataforma');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Usuario'), 'testuser');
    await user.type(screen.getByLabelText('Contraseña'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password123',
      });
    });
  });

  it('has correct autocomplete attributes', async () => {
    const mockGet = vi.mocked(api.get);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));

    renderLoginPage();

    await screen.findByText('Ingreso a la plataforma');

    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('disables submit button while loading', async () => {
    const mockGet = vi.mocked(api.get);
    const mockPost = vi.mocked(api.post);
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    mockPost.mockImplementation(() => new Promise(() => {}));

    renderLoginPage();

    await screen.findByText('Ingreso a la plataforma');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Usuario'), 'testuser');
    await user.type(screen.getByLabelText('Contraseña'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingresando...')).toBeInTheDocument();
  });
});
