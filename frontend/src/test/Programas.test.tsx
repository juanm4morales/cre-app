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
    expect(screen.getByRole('textbox', { name: 'Fundamentación' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Objetivos generales' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Objetivos específicos' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Competencias' })).toBeInTheDocument();
  });

  it('includes all long text fields in the create POST payload', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    vi.mocked(api.get).mockImplementation((url) => Promise.resolve(
      url === '/planes-estudio-ec'
        ? { data: { results: [{ id: 1, plan_estudio: 1, espacio_curricular: 1 }] } }
        : mockResponse,
    ));
    vi.mocked(api.post).mockResolvedValue({ data: { id: 10 } });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole('button', { name: /nuevo programa/i }));
    await user.selectOptions(screen.getByRole('combobox'), '1');
    const values = {
      Fundamentación: 'Base pedagógica',
      'Objetivos generales': 'Formar profesionales',
      'Objetivos específicos': 'Resolver problemas',
      Competencias: 'Pensamiento crítico',
    };
    for (const [label, value] of Object.entries(values)) {
      await user.type(screen.getByRole('textbox', { name: label }), value);
    }
    await user.click(screen.getByRole('button', { name: /crear programa/i }));

    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/programas', expect.objectContaining({
      fundamentacion: values.Fundamentación,
      objetivos_generales: values['Objetivos generales'],
      objetivos_especificos: values['Objetivos específicos'],
      competencias: values.Competencias,
    })));
  });

  it('prefills existing long text fields and sends them in the edit PATCH payload', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    const existing = {
      id: 7,
      plan_estudio_ec: 1,
      anio_academico: new Date().getFullYear(),
      descripcion: 'Programa de prueba',
      fundamentacion: 'Fundamentación existente',
      objetivos_generales: 'Objetivo general existente',
      objetivos_especificos: 'Objetivos específicos existentes',
      competencias: 'Competencias existentes',
    };
    vi.mocked(api.get).mockImplementation((url) => Promise.resolve(
      url === '/programas' ? { data: { results: [existing] } } : mockResponse,
    ));
    vi.mocked(api.patch).mockResolvedValue({ data: existing });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole('button', { name: 'Editar' }));
    const values = [
      ['Fundamentación', existing.fundamentacion],
      ['Objetivos generales', existing.objetivos_generales],
      ['Objetivos específicos', existing.objetivos_especificos],
      ['Competencias', existing.competencias],
    ] as const;
    for (const [label, value] of values) {
      expect(screen.getByRole('textbox', { name: label })).toHaveValue(value);
    }
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await vi.waitFor(() => expect(api.patch).toHaveBeenCalledWith('/programas/7', expect.objectContaining({
      fundamentacion: existing.fundamentacion,
      objetivos_generales: existing.objetivos_generales,
      objetivos_especificos: existing.objetivos_especificos,
      competencias: existing.competencias,
    })));
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
