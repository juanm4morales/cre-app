import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';

interface UnidadAcademica {
  id: number;
  nombre: string;
  sigla: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminUnidadesAcademicas() {
  const [selected, setSelected] = useState<UnidadAcademica | null>(null);

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades-academicas'],
    queryFn: () => api.get<PaginatedResponse<UnidadAcademica>>('/unidades-academicas').then(res => res.data.results),
  });

  const rows = unidades.map((unidad) => ({
    id: String(unidad.id),
    cells: [
      unidad.sigla,
      unidad.nombre,
      <div className="table-actions" key={`actions-${unidad.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(unidad)}>
          Ver
        </button>
      </div>,
    ],
  }));

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Gestion academica</p>
          <h2>Unidades academicas</h2>
          <p>Organizacion institucional y siglas oficiales.</p>
        </div>
      </section>

      <SectionCard title="Listado de unidades academicas">
        <BasicTable columns={['Sigla', 'Unidad academica', 'Acciones']} rows={rows} />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de unidad academica">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Sigla</p>
              <div>{selected.sigla}</div>
            </div>
            <div>
              <p className="eyebrow">Nombre</p>
              <div>{selected.nombre}</div>
            </div>
          </div>
          <div className="form-actions mt-3">
            <button className="button button-ghost" type="button" onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}

export default AdminUnidadesAcademicas;
