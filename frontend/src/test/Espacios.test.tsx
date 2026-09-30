import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardLayout from '../components/Layout/DashboardLayout';
import DocenteDashboard from '../pages/docente/Dashboard';
import DocenteEspacios from '../pages/docente/Espacios';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Docente Test', availableRoles: ['docente'] },
    logout: vi.fn(),
    switchRole: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/api', () => ({
  APP_DATA_CHANGED_EVENT: 'cre:api-data-changed',
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  queryClient.clear();
});

function renderEspacios() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/docente/espacios']}>
        <Routes>
          <Route path="/docente" element={<DashboardLayout role="docente" />}>
            <Route path="espacios" element={<DocenteEspacios />} />
            <Route path="resumen" element={<DocenteDashboard />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocenteEspacios', () => {
  it('stores the selected espacio and renders Inicio in selected-space mode', async () => {
    const selectedSpace = { id: 1, nombre: 'Matemática I', codigo: 'MAT-101', tipo_espacio: 'T1', anio_cursada: 1, periodo: 'ANUAL', creditos: 4, horas_ip: 30, horas_ta: 15 };
    const mockGet = vi.mocked(api.get);
    mockGet.mockImplementation((url: string) => {
      if (url === '/espacios-asignados') {
        return Promise.resolve({ data: [selectedSpace] } as never);
      }
      if (url === '/planes-estudio-ec') {
        return Promise.resolve({ data: { results: [{ id: 11, plan_estudio: 7, espacio_curricular: 1 }] } } as never);
      }
      if (url === '/planes-estudio') {
        return Promise.resolve({ data: { results: [{ id: 7, nombre: 'Plan 2026' }] } } as never);
      }
      if (url === '/espacios-curriculares') {
        return Promise.resolve({ data: { results: [selectedSpace] } } as never);
      }
      if (url === '/configuracion-cre') {
        return Promise.resolve({ data: { results: [{ horas_por_cre: 27 }] } } as never);
      }
      return Promise.resolve({ data: { results: [] } } as never);
    });

    renderEspacios();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /matemática i/i }));

    await waitFor(() => {
      expect(sessionStorage.getItem('selected_espacio_curricular_id')).toBe('1');
      expect(sessionStorage.getItem('selected_plan_estudio_ec_id')).toBe('11');
      expect(sessionStorage.getItem('selected_espacio_nombre')).toBe('Matemática I');
      expect(screen.getByRole('heading', { name: 'Matemática I' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('MAT-101 - Matemática I')).toBeInTheDocument();
    });
  });
});
