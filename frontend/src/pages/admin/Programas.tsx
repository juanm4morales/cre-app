import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, BookOpen, Calendar, FileText } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');

  const { data: programas = [], isLoading, isError } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => res.data.results),
  });

  useEffect(() => {
    if (isError) toast.error('No se pudieron cargar los datos.');
  }, [isError]);

  const availableYears = useMemo(() => {
    const years = programas.map(p => String(p.anio_academico));
    return ['all', ...Array.from(new Set(years)).sort().reverse()];
  }, [programas]);

  const filteredProgramas = useMemo(() => {
    return programas.filter((p) => {
      const desc = (p.descripcion || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      const year = String(p.anio_academico);

      const matchesSearch =
        desc.includes(query) ||
        year.includes(query) ||
        String(p.plan_estudio_ec).includes(query);
        
      const matchesYear = yearFilter === 'all' || year === yearFilter;

      return matchesSearch && matchesYear;
    });
  }, [programas, searchQuery, yearFilter]);

  const rows = filteredProgramas.map((programa) => ({
    id: String(programa.id),
    cells: [
      programa.descripcion || `Programa ${programa.id}`,
      <span className="badge badge-info" key={`year-${programa.id}`}>{programa.anio_academico}</span>,
      <span className="badge badge-gray" key={`plan-${programa.id}`}>{`Plan EC ${programa.plan_estudio_ec}`}</span>,
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
      </section>

      <SectionCard title="Listado de programas">
        <div className="filter-toolbar">
          <div className="filter-toolbar-search">
            <Search size={18} />
            <input
              type="text"
              className="input"
              placeholder="Buscar por descripción o Plan EC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-toolbar-options">
            <div className="filter-toolbar-select">
              <select
                className="select"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="all">Todos los años</option>
                {availableYears.filter(y => y !== 'all').map((year) => (
                  <option key={year} value={year}>Año {year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredProgramas.length === 0 ? (
          <p className="muted" style={{ padding: '1.5rem 1rem', textAlign: 'center' }}>
            No se encontraron programas con los filtros aplicados.
          </p>
        ) : (
          <BasicTable columns={['Programa', 'Año', 'Plan EC', 'Acciones']} rows={rows} pageSize={10} />
        )}
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de programa">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-item-header">
                <span className="detail-item-icon"><BookOpen size={16} /></span>
                <p className="eyebrow">Programa</p>
              </div>
              <div className="detail-item-value">{selected.descripcion || `Programa ${selected.id}`}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-header">
                <span className="detail-item-icon"><Calendar size={16} /></span>
                <p className="eyebrow">Año Académico</p>
              </div>
              <div className="detail-item-value">{selected.anio_academico}</div>
            </div>
            <div className="detail-item">
              <div className="detail-item-header">
                <span className="detail-item-icon"><FileText size={16} /></span>
                <p className="eyebrow">Plan EC</p>
              </div>
              <div className="detail-item-value">Plan EC {selected.plan_estudio_ec}</div>
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
