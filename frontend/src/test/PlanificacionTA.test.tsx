import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocentePlanificacionTA from '../pages/docente/PlanificacionTA';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  isAuthenticationError: vi.fn(() => false),
}));

import api from '../services/api';
import { toast } from 'sonner';

const mockPrograma = { id: 1, plan_estudio_ec: 1, anio_academico: 2026, descripcion: 'Programa 2026' };
const mockTipoTA = { id: 20, nombre: 'Trabajo práctico', tipo_dedicacion: 'TA' as const };
const mockUnidad = { id: 1, programa: 1, numero: 1, descripcion: 'Unidad 1' };

let queryClient: QueryClient;

function renderComponent() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocentePlanificacionTA />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupMocks() {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: { results: [mockPrograma] } })
    .mockResolvedValueOnce({ data: { results: [mockTipoTA] } })
    .mockResolvedValueOnce({ data: { results: [mockUnidad] } })
    .mockResolvedValueOnce({ data: { results: [] } })
    .mockResolvedValueOnce({ data: { results: [] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  sessionStorage.clear();
});

describe('DocentePlanificacionTA', () => {
  it('shows selection message when no plan_estudio_ec is selected', () => {
    renderComponent();
    expect(screen.getByText(/seleccion[áa] un espacio curricular/i)).toBeInTheDocument();
  });

  it('shows loading state while fetching data', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));

    renderComponent();
    expect(await screen.findByText(/cargando planificación/i)).toBeInTheDocument();
  });

  it('shows no-programa message when no programa exists', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [mockTipoTA] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } });

    renderComponent();
    expect(await screen.findByText(/no hay programa del año actual/i)).toBeInTheDocument();
  });

  it('shows error when no TA tipos exist', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { results: [mockPrograma] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [mockUnidad] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } });

    renderComponent();
    expect(await screen.findByText(/no hay tipos de actividad ta disponibles/i)).toBeInTheDocument();
  });

  it('renders form when all data is available', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    renderComponent();

    expect(await screen.findByText(/nueva actividad ta/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    renderComponent();

    await screen.findByText(/nueva actividad ta/i);

    const submitBtn = screen.getByRole('button', { name: /crear actividad ta/i });
    expect(submitBtn).toBeEnabled();
    expect(submitBtn).not.toBeDisabled();
  });
  });

  it('creates activity successfully with valid data', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    vi.mocked(api.post).mockResolvedValue({
      data: { id: 99, descripcion: 'Test', horas: 2, modalidad_trabajo: 'IND', es_ta: true },
    });

    renderComponent();

    await screen.findByText(/nueva actividad ta/i);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/descripción/i), 'Test TA');
    const duracionInput = screen.getByLabelText(/duración/i);
    await user.clear(duracionInput);
    await user.type(duracionInput, '120');
    await user.selectOptions(screen.getByLabelText(/modalidad/i), 'IND');
    await user.click(screen.getByRole('checkbox', { name: /U1 — Unidad 1/u }));
    await user.click(screen.getByRole('button', { name: /crear actividad ta/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Actividad TA creada.');
    });
  });

  it('shows error toast on API failure', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    vi.mocked(api.post).mockRejectedValue(new Error('Server error'));

    renderComponent();

    await screen.findByText(/nueva actividad ta/i);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/descripción/i), 'Test');
    const duracionInput = screen.getByLabelText(/duración/i);
    await user.clear(duracionInput);
    await user.type(duracionInput, '60');
    await user.selectOptions(screen.getByLabelText(/modalidad/i), 'EQU');
    await user.click(screen.getByRole('checkbox', { name: /U1 — Unidad 1/u }));
    await user.click(screen.getByRole('button', { name: /crear actividad ta/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Server error|no se pudo crear/i));
    });
  });
