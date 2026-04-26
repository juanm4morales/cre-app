import type { ReactNode } from 'react';

interface TableRow {
  id: string;
  cells: ReactNode[];
}

interface BasicTableProps {
  columns: string[];
  rows: TableRow[];
}

function BasicTable({ columns, rows }: BasicTableProps) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {row.cells.map((cell, index) => (
              <td key={`${row.id}-${index}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default BasicTable;
