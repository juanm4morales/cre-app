import { useCallback, useEffect, useState } from 'react';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface Carrera {
  id: number;
  nombre: string;
  codigo: string;
  unidad_academica: number;
  nivel: string;
}

interface UnidadAcademica {
  id: number;
  nombre: string;
  sigla: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminCarreras() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [unidades, setUnidades] = useState<UnidadAcademica[]>([]);
  const [selected, setSelected] = useState<Carrera | null>(null);

  const loadData = useCallback(async () => {
    const [carreraRes, unidadRes] = await Promise.all([
      api.get<PaginatedResponse<Carrera>>('/carreras'),
      api.get<PaginatedResponse<UnidadAcademica>>('/unidades-academicas'),
    ]);
    setCarreras(carreraRes.data.results);
    setUnidades(unidadRes.data.results);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useApiAutoRefresh(loadData, []);

  const unidadLookup = new Map(unidades.map((unidad) => [unidad.id, unidad.sigla]));

  const rows = carreras.map((carrera) => ({
    id: String(carrera.id),
    cells: [
      carrera.codigo,
      carrera.nombre,
      carrera.nivel,
      unidadLookup.get(carrera.unidad_academica) || `UA ${carrera.unidad_academica}`,
      <div className="table-actions" key={`actions-${carrera.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(carrera)}>
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
          <h2>Carreras</h2>
          <p>Listado de carreras vinculadas a la facultad.</p>
        </div>
      </section>

      <SectionCard title="Listado de carreras">
        <BasicTable columns={['Codigo', 'Carrera', 'Nivel', 'Unidad', 'Acciones']} rows={rows} />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de carrera">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Codigo</p>
              <div>{selected.codigo}</div>
            </div>
            <div>
              <p className="eyebrow">Nombre</p>
              <div>{selected.nombre}</div>
            </div>
            <div>
              <p className="eyebrow">Nivel</p>
              <div>{selected.nivel}</div>
            </div>
            <div>
              <p className="eyebrow">Unidad academica</p>
              <div>{unidadLookup.get(selected.unidad_academica) || `UA ${selected.unidad_academica}`}</div>
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

export default AdminCarreras;
