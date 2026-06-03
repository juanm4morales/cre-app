import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { toast } from 'sonner';

interface Actividad {
  id: number;
  programa: number;
  tipo_actividad: number;
  descripcion: string;
  horas: number;
  modalidad_trabajo: 'IND' | 'EQU';
}

interface Programa {
  id: number;
  descripcion: string;
}

interface TipoActividad {
  id: number;
  nombre: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminActividades() {
  const [selected, setSelected] = useState<Actividad | null>(null);

  const { data: actividades = [], isLoading, isError } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades').then(res => res.data.results),
  });

  const { data: programas = [] } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => res.data.results),
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-actividad'],
    queryFn: () => api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad').then(res => res.data.results),
  });

  useEffect(() => {
    if (isError) toast.error('No se pudieron cargar los datos.');
  }, [isError]);

  const programaLookup = useMemo(() => {
    const map = new Map<number, string>();
    programas.forEach((programa) =>
      map.set(programa.id, programa.descripcion || `Programa ${programa.id}`)
    );
    return map;
  }, [programas]);

  const tipoLookup = useMemo(() => {
    const map = new Map<number, string>();
    tipos.forEach((tipo) => map.set(tipo.id, tipo.nombre));
    return map;
  }, [tipos]);

  const rows = actividades.map((actividad) => ({
    id: String(actividad.id),
    cells: [
      actividad.descripcion,
      tipoLookup.get(actividad.tipo_actividad) || `Tipo ${actividad.tipo_actividad}`,
      actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Grupal',
      `${actividad.horas}h`,
      programaLookup.get(actividad.programa) || `Programa ${actividad.programa}`,
      <div className="table-actions" key={`actions-${actividad.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(actividad)}>
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
            <h2>Actividades</h2>
            <p>Control global de horas IP/TA cargadas por docentes.</p>
          </div>
        </section>
        <SectionCard title="Listado de actividades">
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
          <h2>Actividades</h2>
          <p>Control global de horas IP/TA cargadas por docentes.</p>
        </div>
      </section>

      <SectionCard title="Listado de actividades">
        <BasicTable
          columns={['Actividad', 'Tipo', 'Modalidad', 'Horas', 'Programa', 'Acciones']}
          rows={rows}
          pageSize={10}
        />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de actividad">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Actividad</p>
              <div>{selected.descripcion}</div>
            </div>
            <div>
              <p className="eyebrow">Programa</p>
              <div>{programaLookup.get(selected.programa) || `Programa ${selected.programa}`}</div>
            </div>
            <div>
              <p className="eyebrow">Tipo</p>
              <div>{tipoLookup.get(selected.tipo_actividad) || `Tipo ${selected.tipo_actividad}`}</div>
            </div>
            <div>
              <p className="eyebrow">Horas</p>
              <div>{selected.horas}h</div>
            </div>
            <div>
              <p className="eyebrow">Modalidad</p>
              <div>{selected.modalidad_trabajo === 'IND' ? 'Individual' : 'Grupal'}</div>
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

export default AdminActividades;
