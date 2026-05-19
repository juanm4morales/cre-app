import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DocentePlanificacionIP from '../pages/docente/PlanificacionIP';

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
const mockTipoIP = { id: 10, nombre: 'Clase teórica', tipo_dedicacion: 'IP' as const };
const mockUnidad = { id: 1, programa: 1, numero: 1, descripcion: 'Unidad 1' };
const mockClase = { id: 1, programa: 1, fecha: '2026-05-15', estado: 'PLAN' as const };

let queryClient: QueryClient;

function renderComponent() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocentePlanificacionIP />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupMocks() {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: { results: [mockPrograma] } })
    .mockResolvedValueOnce({ data: { results: [mockTipoIP] } })
    .mockResolvedValueOnce({ data: { results: [mockUnidad] } })
    .mockResolvedValueOnce({ data: { results: [mockClase] } })
    .mockResolvedValueOnce({ data: { results: [] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  sessionStorage.clear();
});

describe('DocentePlanificacionIP', () => {
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
      .mockResolvedValueOnce({ data: { results: [mockTipoIP] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } });

    renderComponent();
    expect(await screen.findByText(/no hay programa del año actual/i)).toBeInTheDocument();
  });

  it('shows error when no IP tipos exist', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { results: [mockPrograma] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [mockUnidad] } })
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValueOnce({ data: { results: [] } });

    renderComponent();
    expect(await screen.findByText(/no hay tipos de actividad ip configurados/i)).toBeInTheDocument();
  });

  it('renders form when all data is available', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    renderComponent();

    expect(await screen.findByText(/nueva actividad ip/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit with no class selected', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    renderComponent();

    await screen.findByText(/nueva actividad ip/i);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /crear actividad ip/i }));

    expect(await screen.findByText(/seleccion[áa] una clase/i)).toBeInTheDocument();
  });

  it('creates activity successfully after selecting a class', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValue({
      data: { id: 99, descripcion: 'Test', horas: 1.5, modalidad_trabajo: 'IND', es_ip: true },
    });

    renderComponent();

    await screen.findByText(/nueva actividad ip/i);

    const classBtn = screen.getByText('2026-05-15');
    const user = userEvent.setup();
    await user.click(classBtn);

    await screen.findByText(/clase lista para planificar/i);

    const descInput = screen.getByLabelText(/descripción/i);
    await user.type(descInput, 'Test IP');

    const duracionInput = screen.getByLabelText(/duración/i);
    await user.clear(duracionInput);
    await user.type(duracionInput, '90');

    const modalidadSelect = screen.getByLabelText(/modalidad/i);
    await user.selectOptions(modalidadSelect, 'IND');

    const unidadCheckbox = screen.getByRole('checkbox', { name: /U1 — Unidad 1/u });
    await user.click(unidadCheckbox);

    await user.click(screen.getByRole('button', { name: /crear actividad ip/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Actividad IP creada.');
    });
  });

  it('shows error toast on API failure', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');

    setupMocks();

    vi.mocked(api.post).mockRejectedValue(new Error('API error'));

    renderComponent();

    await screen.findByText(/nueva actividad ip/i);

    const classBtn = screen.getByText('2026-05-15');
    const user = userEvent.setup();
    await user.click(classBtn);

    await screen.findByText(/clase lista para planificar/i);

    await user.type(screen.getByLabelText(/descripción/i), 'Test');
    const duracionInput = screen.getByLabelText(/duración/i);
    await user.clear(duracionInput);
    await user.type(duracionInput, '60');
    await user.selectOptions(screen.getByLabelText(/modalidad/i), 'IND');
    await user.click(screen.getByRole('checkbox', { name: /U1 — Unidad 1/u }));
    await user.click(screen.getByRole('button', { name: /crear actividad ip/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/API error|no se pudo crear/i));
    });
  });
});
