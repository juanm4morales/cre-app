import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../../components/Common/StatCard';
import SectionCard from '../../components/Common/SectionCard';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

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
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [planesEC, setPlanesEC] = useState<PlanEstudioEC[]>([]);
  const [espacios, setEspacios] = useState<EspacioCurricular[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    try {
      const [programaRes, actividadRes, planEcRes, espaciosRes] = await Promise.all([
        api.get<PaginatedResponse<Programa>>('/programas'),
        api.get<PaginatedResponse<Actividad>>('/actividades'),
        api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec'),
        api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares'),
      ]);
      setProgramas(programaRes.data.results);
      setActividades(actividadRes.data.results);
      setPlanesEC(planEcRes.data.results);
      setEspacios(espaciosRes.data.results);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useApiAutoRefresh(() => loadData(true), []);

  // Agrupar datos por espacio curricular
  const espaciosResumen: EspacioResumen[] = [];
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

    espaciosResumen.push({
      nombre: getEspacioNombre(planEc),
      programaActual,
      totalHoras: actividadesEspacio.reduce((acc, a) => acc + Number(a.horas), 0),
      cantidadActividades: actividadesEspacio.length,
    });
  });

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
      espacio.programaActual ? `${currentYear}` : 'Sin programa actual',
      `${espacio.cantidadActividades} actividades`,
      `${espacio.totalHoras.toFixed(1)}h`,
      espacio.programaActual ? (
        <span className="table-row-pill" key={`status-${idx}`}>Activo</span>
      ) : (
        <span className="chip" key={`status-${idx}`}>Pendiente</span>
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
