import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../../components/Common/StatCard';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';

interface Programa {
  id: number;
  descripcion: string;
  anio_academico: number;
}

interface Actividad {
  id: number;
  descripcion: string;
  horas: number;
  programa?: number;
  tipo_actividad: {
    nombre: string;
    tipo_dedicacion: 'IP' | 'TA';
  };
}

interface Usuario {
  id: number;
  role: 'docente' | 'admin';
  is_active: boolean;
  username: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminDashboard() {
  const currentYear = new Date().getFullYear();

  const { data: programas = [], isLoading: loadingProgramas } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => res.data.results),
  });

  const { data: actividades = [], isLoading: loadingActividades } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades').then(res => res.data.results),
  });

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get<PaginatedResponse<Usuario>>('/usuarios').then(res => res.data.results),
  });

  const loading = loadingProgramas || loadingActividades || loadingUsuarios;

  const programasActuales = useMemo(() => programas.filter((p) => p.anio_academico === currentYear), [programas, currentYear]);
  const docentesActivos = useMemo(() => usuarios.filter((user) => user.role === 'docente' && user.is_active).length, [usuarios]);
  
  const actividadesIP = actividades.filter((a) => a.tipo_actividad?.tipo_dedicacion === 'IP').length;
  const actividadesTA = actividades.filter((a) => a.tipo_actividad?.tipo_dedicacion === 'TA').length;
  const totalHorasIP = actividades
    .filter((a) => a.tipo_actividad?.tipo_dedicacion === 'IP')
    .reduce((acc, a) => acc + Number(a.horas), 0);
  const totalHorasTA = actividades
    .filter((a) => a.tipo_actividad?.tipo_dedicacion === 'TA')
    .reduce((acc, a) => acc + Number(a.horas), 0);

  const stats = [
    { 
      title: 'Programas cargados', 
      value: String(programas.length), 
      footer: `${programasActuales.length} del ciclo ${currentYear}` 
    },
    { 
      title: 'Actividades totales', 
      value: String(actividades.length), 
      footer: `${actividadesIP} IP / ${actividadesTA} TA` 
    },
    { 
      title: 'Docentes activos', 
      value: String(docentesActivos), 
      footer: `De ${usuarios.length} totales` 
    },
    { 
      title: 'Distribución horaria', 
      value: `${(totalHorasIP + totalHorasTA).toFixed(0)}h`, 
      footer: `${totalHorasIP.toFixed(0)}h IP / ${totalHorasTA.toFixed(0)}h TA` 
    },
  ];

  const tableRows = programasActuales.slice(0, 5).map((programa) => ({
    id: String(programa.id),
    cells: [
      programa.descripcion || `Programa ${programa.id}`,
      <span className="badge badge-info" key={`year-${programa.id}`}>{programa.anio_academico}</span>,
      actividades.filter((a) => a.programa === programa.id).length || 'N/A',
      <span className="badge badge-success" key={`status-${programa.id}`}>Activo</span>,
    ],
  }));

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Panel admin</p>
          <h2>Supervisión académica</h2>
          <p>Controla la distribución IP/TA, valida programas cargados y supervisa la gestión docente.</p>
        </div>
        <Link className="button" to="/admin/programas">
          Ver todos los programas
        </Link>
      </section>

      <section className="grid-stats">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <SectionCard
        title={`Programas del ciclo ${currentYear}`}
        action={(
          <Link className="button button-ghost" to="/admin/programas">
            Ver lista completa
          </Link>
        )}
      >
        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : tableRows.length === 0 ? (
          <p className="muted">No hay programas cargados para el ciclo actual.</p>
        ) : (
          <BasicTable
            columns={['Programa', 'Año', 'Actividades', 'Estado']}
            rows={tableRows}
            pageSize={8}
          />
        )}
      </SectionCard>

      <SectionCard title="Indicadores clave">
        <div className="chip-grid">
          <span className="chip">Total de actividades: {actividades.length}</span>
          <span className="chip">Docentes con programas: {docentesActivos}</span>
          <span className="chip">Promedio horas/programa: {programas.length > 0 ? ((totalHorasIP + totalHorasTA) / programas.length).toFixed(1) : '0'}h</span>
          <span className="chip">Ratio IP/TA: {totalHorasTA > 0 ? (totalHorasIP / totalHorasTA).toFixed(2) : 'N/A'}</span>
        </div>
      </SectionCard>
    </>
  );
}

export default AdminDashboard;
