import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface TableRow {
  id: string;
  cells: ReactNode[];
}

interface BasicTableProps {
  columns: string[];
  rows: TableRow[];
  caption?: string;
  pageSize?: number;
}

function BasicTable({ columns, rows, caption, pageSize }: BasicTableProps) {
  const [page, setPage] = useState(1);
  const shouldPaginate = Boolean(pageSize && rows.length > pageSize);
  const safePageSize = pageSize || rows.length || 1;
  const totalPages = shouldPaginate ? Math.max(1, Math.ceil(rows.length / safePageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const startIndex = shouldPaginate ? (currentPage - 1) * safePageSize : 0;
  const endIndex = shouldPaginate ? Math.min(startIndex + safePageSize, rows.length) : rows.length;
  const visibleRows = useMemo(
    () => rows.slice(startIndex, endIndex),
    [endIndex, rows, startIndex]
  );

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, index) => (
                  <td key={`${row.id}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shouldPaginate ? (
        <nav className="table-pagination" aria-label="Paginación de tabla">
          <span className="table-pagination-summary">
            Mostrando {startIndex + 1}-{endIndex} de {rows.length}
          </span>
          <div className="table-pagination-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span className="table-pagination-page" aria-live="polite">
              Página {currentPage} de {totalPages}
            </span>
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        </nav>
      ) : null}
    </>
  );
}

export default BasicTable;
