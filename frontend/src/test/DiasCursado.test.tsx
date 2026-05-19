import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DocenteDiasCursado from '../pages/docente/DiasCursado';

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

vi.mock('../hooks/useApiAutoRefresh', () => ({
  useApiAutoRefresh: vi.fn(),
}));

import api from '../services/api';
import { toast } from 'sonner';

const mockPrograma = { id: 1, plan_estudio_ec: 1, anio_academico: 2026, descripcion: 'Test Programa' };

function renderComponent() {
  return render(
    <MemoryRouter>
      <DocenteDiasCursado />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  sessionStorage.clear();
});

describe('DocenteDiasCursado', () => {
  it('shows selection message when no plan_estudio_ec is selected', () => {
    renderComponent();
    expect(screen.getByText(/usa el desplegable superior/i)).toBeInTheDocument();
  });

  it('shows create button when no programa exists for the year', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { results: [] } });

    renderComponent();

    expect(await screen.findByRole('button', { name: /crear programa/i })).toBeInTheDocument();
  });

  it('shows form when programa exists', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { results: [mockPrograma] } });

    renderComponent();

    expect(await screen.findByText(/agregar bloque/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('validates that finish time must be after start time', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { results: [mockPrograma] } });

    renderComponent();

    await screen.findByText(/agregar bloque/i);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), '0');

    const timeInputs = document.querySelectorAll('input[type="time"]');
    const horaInicio = timeInputs[0] as HTMLInputElement | undefined;
    const horaFin = timeInputs[1] as HTMLInputElement | undefined;
    if (!horaInicio || !horaFin) throw new Error('Time inputs not found');
    await user.type(horaInicio, '10:00');
    await user.type(horaFin, '09:00');
    await user.click(screen.getByRole('button', { name: /agregar bloque/i }));

    expect(await screen.findByText(/hora de fin debe ser posterior/i)).toBeInTheDocument();
  });

  it('submits form with valid data and shows success', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { results: [mockPrograma] } });

    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValue({
      data: { id: 5, programa: 1, dia_semana: 0, hora_inicio: '10:00', hora_fin: '12:00', activo: true },
    });

    renderComponent();

    await screen.findByText(/agregar bloque/i);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), '0');

    const timeInputs = document.querySelectorAll('input[type="time"]');
    const horaInicio = timeInputs[0] as HTMLInputElement | undefined;
    const horaFin = timeInputs[1] as HTMLInputElement | undefined;
    if (!horaInicio || !horaFin) throw new Error('Time inputs not found');
    await user.type(horaInicio, '10:00');
    await user.type(horaFin, '12:00');
    await user.click(screen.getByRole('button', { name: /agregar bloque/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/dias-clase', {
        programa: 1,
        dia_semana: 0,
        hora_inicio: '10:00',
        hora_fin: '12:00',
        activo: true,
      });
    });
  });

  it('shows error toast on API failure', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet.mockResolvedValue({ data: { results: [mockPrograma] } });

    const mockPost = vi.mocked(api.post);
    mockPost.mockRejectedValue(new Error('Network error'));

    renderComponent();

    await screen.findByText(/agregar bloque/i);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), '0');
    const timeInputs = document.querySelectorAll('input[type="time"]');
    const horaInicio = timeInputs[0] as HTMLInputElement | undefined;
    const horaFin = timeInputs[1] as HTMLInputElement | undefined;
    if (!horaInicio || !horaFin) throw new Error('Time inputs not found');
    await user.type(horaInicio, '10:00');
    await user.type(horaFin, '12:00');
    await user.click(screen.getByRole('button', { name: /agregar bloque/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/Network error|no se pudo agregar/i)
      );
    });
  });

  it('creates a new programa for current year', async () => {
    sessionStorage.setItem('selected_plan_estudio_ec_id', '1');
    sessionStorage.setItem('selected_espacio_nombre', 'Test Espacio');

    const mockGet = vi.mocked(api.get);
    mockGet
      .mockResolvedValueOnce({ data: { results: [] } })
      .mockResolvedValue({ data: { results: [mockPrograma] } });

    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValue({ data: { message: 'ok' } });

    renderComponent();

    const createBtn = await screen.findByRole('button', { name: /crear programa/i });
    const user = userEvent.setup();
    await user.click(createBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/espacios-asignados/create_programa_if_needed',
        { plan_estudio_ec_id: 1 },
      );
    });
  });
});
