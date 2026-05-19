import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BasicTable from '../components/Tables/BasicTable';

describe('BasicTable', () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 1),
    cells: [`Fila ${index + 1}`],
  }));

  it('paginates rows when pageSize is provided', async () => {
    render(<BasicTable columns={['Nombre']} rows={rows} pageSize={10} />);

    expect(screen.getByText('Fila 1')).toBeInTheDocument();
    expect(screen.getByText('Fila 10')).toBeInTheDocument();
    expect(screen.queryByText('Fila 11')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1-10 de 12')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.queryByText('Fila 1')).not.toBeInTheDocument();
    expect(screen.getByText('Fila 11')).toBeInTheDocument();
    expect(screen.getByText('Fila 12')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 11-12 de 12')).toBeInTheDocument();
  });
});
