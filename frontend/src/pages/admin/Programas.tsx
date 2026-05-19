import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { toast } from 'sonner';

interface Programa {
  id: number;
  plan_estudio_ec: number;
  anio_academico: number;
  descripcion: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminProgramas() {
  const [selected, setSelected] = useState<Programa | null>(null);

  const { data: programas = [], isLoading, isError } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => res.data.results),
  });

  useEffect(() => {
    if (isError) toast.error('No se pudieron cargar los datos.');
  }, [isError]);

  const rows = programas.map((programa) => ({
    id: String(programa.id),
    cells: [
      programa.descripcion || `Programa ${programa.id}`,
      programa.anio_academico,
      `Plan EC ${programa.plan_estudio_ec}`,
      <div className="table-actions" key={`actions-${programa.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(programa)}>
          Ver
        </button>
      </div>,
    ],
  }));

  if (isLoading) {
    return (
      <>
        <section className="page-header">
          <div>
            <p className="eyebrow">Gestión admin</p>
            <h2>Programas</h2>
            <p>Valida programas y deja observaciones para el docente.</p>
          </div>
          <span className="pill">Filtros próximamente</span>
        </section>
        <SectionCard title="Listado de programas">
          <p className="muted">Cargando datos...</p>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Gestión admin</p>
          <h2>Programas</h2>
          <p>Valida programas y deja observaciones para el docente.</p>
        </div>
        <span className="pill">Filtros próximamente</span>
      </section>

      <SectionCard title="Listado de programas">
        <BasicTable columns={['Programa', 'Anio', 'Plan EC', 'Acciones']} rows={rows} pageSize={10} />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de programa">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Programa</p>
              <div>{selected.descripcion || `Programa ${selected.id}`}</div>
            </div>
            <div>
              <p className="eyebrow">Anio academico</p>
              <div>{selected.anio_academico}</div>
            </div>
            <div>
              <p className="eyebrow">Plan EC</p>
              <div>{selected.plan_estudio_ec}</div>
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

export default AdminProgramas;
