import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface Actividad {
  id: number;
  programa: number;
  tipo_actividad: number;
  descripcion: string;
  horas: number;
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
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [tipos, setTipos] = useState<TipoActividad[]>([]);
  const [selected, setSelected] = useState<Actividad | null>(null);

  const loadData = useCallback(async () => {
    const [actividadRes, programaRes, tipoRes] = await Promise.all([
      api.get<PaginatedResponse<Actividad>>('/actividades'),
      api.get<PaginatedResponse<Programa>>('/programas'),
      api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad'),
    ]);
    setActividades(actividadRes.data.results);
    setProgramas(programaRes.data.results);
    setTipos(tipoRes.data.results);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useApiAutoRefresh(loadData, []);

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
      `${actividad.horas}h`,
      programaLookup.get(actividad.programa) || `Programa ${actividad.programa}`,
      <div className="table-actions" key={`actions-${actividad.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(actividad)}>
          Ver
        </button>
      </div>,
    ],
  }));

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Gestion admin</p>
          <h2>Actividades</h2>
          <p>Control global de horas IP/TA cargadas por docentes.</p>
        </div>
      </section>

      <SectionCard title="Listado de actividades">
        <BasicTable
          columns={['Actividad', 'Tipo', 'Horas', 'Programa', 'Acciones']}
          rows={rows}
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
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
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
