import { useCallback, useEffect, useState } from 'react';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface EspacioCurricular {
  id: number;
  codigo: string;
  nombre: string;
  tipo_espacio: string;
  creditos: number;
  horas_ip: number;
  horas_ta: number;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminEspaciosCurriculares() {
  const [espacios, setEspacios] = useState<EspacioCurricular[]>([]);
  const [selected, setSelected] = useState<EspacioCurricular | null>(null);

  const loadEspacios = useCallback(async () => {
    const response = await api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares');
    setEspacios(response.data.results);
  }, []);

  useEffect(() => {
    void loadEspacios();
  }, [loadEspacios]);

  useApiAutoRefresh(loadEspacios, []);

  const rows = espacios.map((espacio) => ({
    id: String(espacio.id),
    cells: [
      espacio.codigo,
      espacio.nombre,
      espacio.tipo_espacio,
      `${espacio.creditos} CRE`,
      `${espacio.horas_ip}h`,
      `${espacio.horas_ta}h`,
      <div className="table-actions" key={`actions-${espacio.id}`}>
        <button className="button button-ghost button-small" type="button" onClick={() => setSelected(espacio)}>
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
          <h2>Espacios curriculares</h2>
          <p>Consulta la distribucion de creditos y horas por tipo de EC.</p>
        </div>
      </section>

      <SectionCard title="Listado de espacios curriculares">
        <BasicTable
          columns={['Codigo', 'Nombre', 'Tipo', 'Creditos', 'Horas IP', 'Horas TA', 'Acciones']}
          rows={rows}
        />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de espacio curricular">
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
              <p className="eyebrow">Tipo</p>
              <div>{selected.tipo_espacio}</div>
            </div>
            <div>
              <p className="eyebrow">Creditos</p>
              <div>{selected.creditos} CRE</div>
            </div>
            <div>
              <p className="eyebrow">Horas IP</p>
              <div>{selected.horas_ip}h</div>
            </div>
            <div>
              <p className="eyebrow">Horas TA</p>
              <div>{selected.horas_ta}h</div>
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

export default AdminEspaciosCurriculares;
