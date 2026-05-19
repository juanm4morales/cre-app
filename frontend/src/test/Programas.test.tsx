import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DocenteProgramas from '../pages/docente/Programas';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  isAuthenticationError: vi.fn(() => false),
}));

vi.mock('../../hooks/useApiAutoRefresh', () => ({
  useApiAutoRefresh: vi.fn(),
}));

import api from '../services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockResponse = { data: { results: [] } };

function renderForm() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/docente/programas']}>
        <DocenteProgramas />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  queryClient.clear();
});

describe('DocenteProgramas', () => {
  it('shows selection message when no plan_estudio_ec is selected', async () => {
    renderForm();
    expect(await screen.findByText(/usa el desplegable superior/i)).toBeInTheDocument();
  });

  it('renders create button when no programa exists', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Matemática');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue(mockResponse);

    renderForm();

    const nuevoBtn = await screen.findByRole('button', { name: /nuevo programa/i });
    expect(nuevoBtn).toBeInTheDocument();
  });

  it('shows programa form when clicking nuevo programa', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue(mockResponse);

    renderForm();

    const nuevoBtn = await screen.findByRole('button', { name: /nuevo programa/i });
    const user = userEvent.setup();
    await user.click(nuevoBtn);

    expect(await screen.findByText(/crear nuevo programa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear programa/i })).toBeInTheDocument();
  });

  it('creates a programa successfully', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue(mockResponse);

    renderForm();

    const nuevoBtn = await screen.findByRole('button', { name: /nuevo programa/i });
    const user = userEvent.setup();
    await user.click(nuevoBtn);

    expect(await screen.findByText(/crear nuevo programa/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear programa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows error toast on API failure', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue(mockResponse);

    renderForm();

    const nuevoBtn = await screen.findByRole('button', { name: /nuevo programa/i });
    const user = userEvent.setup();
    await user.click(nuevoBtn);

    await screen.findByText(/crear nuevo programa/i);

    await user.click(screen.getByRole('button', { name: /crear programa/i }));

    expect(await screen.findByText(/seleccion[áa] un plan de estudio/i)).toBeInTheDocument();
  });

  it('shows validation when required plan field is empty', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue(mockResponse);

    renderForm();

    const nuevoBtn = await screen.findByRole('button', { name: /nuevo programa/i });
    const user = userEvent.setup();
    await user.click(nuevoBtn);

    await screen.findByText(/crear nuevo programa/i);

    await user.click(screen.getByRole('button', { name: /crear programa/i }));

    expect(await screen.findByText(/seleccion[áa] un plan de estudio/i)).toBeInTheDocument();
  });
});
