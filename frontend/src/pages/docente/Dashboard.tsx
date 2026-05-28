import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../../components/Common/StatCard';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';

interface Programa {
  id: number;
  anio_academico: number;
  descripcion: string;
  plan_estudio_ec: number;
}

interface Actividad {
  id: number;
  descripcion: string;
  horas: number;
  programa: number;
}

interface PlanEstudioEC {
  id: number;
  espacio_curricular: number | {
    id: number;
    nombre: string;
  };
}

interface EspacioCurricular {
  id: number;
  nombre: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

interface EspacioResumen {
  nombre: string;
  programaActual?: Programa;
  totalHoras: number;
  cantidadActividades: number;
}

function DocenteDashboard() {
  const currentYear = new Date().getFullYear();

  const { data: programas = [], isLoading: loadingProgramas } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => res.data.results),
  });

  const { data: actividades = [], isLoading: loadingActividades } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades').then(res => res.data.results),
  });

  const { data: planesEC = [], isLoading: loadingPlanesEC } = useQuery({
    queryKey: ['planes-estudio-ec'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec').then(res => res.data.results),
  });

  const { data: espacios = [], isLoading: loadingEspacios } = useQuery({
    queryKey: ['espacios-curriculares'],
    queryFn: () => api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares').then(res => res.data.results),
  });

  const loading = loadingProgramas || loadingActividades || loadingPlanesEC || loadingEspacios;

  // Agrupar datos por espacio curricular
  const espaciosResumen = useMemo(() => {
    const resumen: EspacioResumen[] = [];
    const planEcMap = new Map<number, PlanEstudioEC>();
    planesEC.forEach((pe) => planEcMap.set(pe.id, pe));
    const espaciosMap = new Map<number, string>();
    espacios.forEach((espacio) => espaciosMap.set(espacio.id, espacio.nombre));

    const getEspacioNombre = (planEc: PlanEstudioEC) => {
      if (typeof planEc.espacio_curricular === 'object' && planEc.espacio_curricular?.nombre) {
        return planEc.espacio_curricular.nombre;
      }

      const espacioId = Number(planEc.espacio_curricular);
      if (Number.isFinite(espacioId) && espaciosMap.has(espacioId)) {
        return espaciosMap.get(espacioId) || `EC ${espacioId}`;
      }

      return 'Espacio curricular sin nombre';
    };

    const programasPorPlanEc = new Map<number, Programa[]>();
    programas.forEach((prog) => {
      const list = programasPorPlanEc.get(prog.plan_estudio_ec) || [];
      list.push(prog);
      programasPorPlanEc.set(prog.plan_estudio_ec, list);
    });

    programasPorPlanEc.forEach((progs, planEcId) => {
      const planEc = planEcMap.get(planEcId);
      if (!planEc) return;

      const programaActual = progs.find((p) => p.anio_academico === currentYear);
      const programasIds = progs.map((p) => p.id);
      const actividadesEspacio = actividades.filter((a) => programasIds.includes(a.programa));

      resumen.push({
        nombre: getEspacioNombre(planEc),
        programaActual,
        totalHoras: actividadesEspacio.reduce((acc, a) => acc + Number(a.horas), 0),
        cantidadActividades: actividadesEspacio.length,
      });
    });

    return resumen;
  }, [programas, actividades, planesEC, espacios, currentYear]);

  const programasActuales = programas.filter((p) => p.anio_academico === currentYear);
  const totalHoras = actividades.reduce((acc, actividad) => acc + Number(actividad.horas), 0);

  const stats = [
    { title: 'Espacios curriculares', value: String(espaciosResumen.length), footer: 'Asignados a ti' },
    { title: 'Programas activos', value: String(programasActuales.length), footer: `Ciclo ${currentYear}` },
    { title: 'Actividades cargadas', value: String(actividades.length), footer: 'Total histórico' },
    { title: 'Horas totales', value: `${totalHoras.toFixed(1)}h`, footer: 'Suma IP + TA' },
  ];

  const tableRows = espaciosResumen.slice(0, 5).map((espacio, idx) => ({
    id: String(idx),
    cells: [
      espacio.nombre,
      espacio.programaActual ? (
        <span className="badge badge-info" key={`year-${idx}`}>{currentYear}</span>
      ) : (
        <span className="badge badge-gray" key={`year-${idx}`}>Sin programa actual</span>
      ),
      `${espacio.cantidadActividades} actividades`,
      `${espacio.totalHoras.toFixed(1)}h`,
      espacio.programaActual ? (
        <span className="badge badge-success" key={`status-${idx}`}>Activo</span>
      ) : (
        <span className="badge badge-warning" key={`status-${idx}`}>Pendiente</span>
      ),
    ],
  }));

  const acciones = [] as Array<{ label: string; to: string }>;
  if (programasActuales.length === 0) {
    acciones.push({ label: `Crear programa ${currentYear}`, to: '/docente/programas' });
  }
  if (programasActuales.length > 0 && actividades.length === 0) {
    acciones.push({ label: 'Cargar actividades del programa', to: '/docente/planificacion-ip' });
  }
  if (programasActuales.length > 0 && actividades.length > 0) {
    acciones.push({ label: 'Revisar seguimiento de clases IP', to: '/docente/ejecucion-ip' });
    acciones.push({ label: 'Revisar actividades TA', to: '/docente/planificacion-ta' });
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Panel docente</p>
          <h2>Tu carga académica</h2>
          <p>
            Visualiza el avance de tus programas y distribución de horas por espacio curricular en tiempo real.
          </p>
        </div>
        <Link className="button" to="/docente/espacios">
          Gestionar espacios
        </Link>
      </section>

      <section className="grid-stats">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </section>

      <SectionCard
        title="Resumen por espacio curricular"
        action={(
          <Link className="button button-ghost" to="/docente/espacios">
            Ver todos
          </Link>
        )}
      >
        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : tableRows.length === 0 ? (
          <p className="muted">No tienes espacios curriculares asignados aún.</p>
        ) : (
          <BasicTable
            columns={['Espacio curricular', 'Año', 'Actividades', 'Horas', 'Estado']}
            rows={tableRows}
            pageSize={8}
          />
        )}
      </SectionCard>

      <SectionCard title="Acciones recomendadas">
        {acciones.length === 0 ? (
          <p className="muted">No hay pendientes urgentes en este momento.</p>
        ) : (
          <div className="chip-grid">
            {acciones.map((accion) => (
              <Link key={accion.label} className="button button-ghost" to={accion.to}>
                {accion.label}
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

export default DocenteDashboard;
