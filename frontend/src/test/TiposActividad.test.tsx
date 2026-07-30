import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminTiposActividad from '../pages/admin/TiposActividad';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock('../services/api', () => ({
  APP_DATA_CHANGED_EVENT: 'app-data-changed',
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import api from '../services/api';

let queryClient: QueryClient;

function renderComponent() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminTiposActividad />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.delete).mockReset();
  vi.mocked(api.patch).mockReset();
});

describe('AdminTiposActividad', () => {
  it('usa una selección accesible para tipo de dedicación y limita las opciones a IP y TA', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { results: [] } });
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 1, nombre: 'Clase teórica', tipo_dedicacion: 'IP', descripcion: '' },
    });

    renderComponent();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /nuevo tipo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /crear tipo/i })).not.toBeDisabled();
    });

    const select = screen.getByLabelText(/tipo de dedicación/i);
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'IP' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TA' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/nombre/i), 'Clase teórica');
    await user.selectOptions(select, 'IP');
    await user.click(screen.getByRole('button', { name: /crear tipo/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/tipos-actividad',
        expect.objectContaining({ nombre: 'Clase teórica', tipo_dedicacion: 'IP' }),
      );
    });
  });
});
