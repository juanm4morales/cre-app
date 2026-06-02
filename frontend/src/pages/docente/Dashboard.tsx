import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Gauge, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import api from '../../services/api';

interface Programa {
  id: number;
  anio_academico: number;
  descripcion: string;
  plan_estudio_ec: number;
}

interface TipoActividad {
  id: number;
  nombre: string;
  tipo_dedicacion: 'IP' | 'TA';
}

interface Actividad {
  id: number;
  descripcion: string;
  horas: number;
  programa: number;
  tipo_actividad: number | TipoActividad;
  clase_calendario: number | null;
  fecha_inicio_ta: string | null;
  es_ip?: boolean;
  es_ta?: boolean;
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
  codigo: string;
  nombre: string;
  creditos: number;
  horas_ip: number;
  horas_ta: number;
}

interface ClaseCalendario {
  id: number;
  programa: number;
  fecha: string;
}

interface ConfiguracionCRE {
  horas_por_cre: number;
}

interface PaginatedResponse<T> {
  results: T[];
}

interface EspacioResumen {
  id: number;
  nombre: string;
  codigo: string;
  programaActual?: Programa;
  horasIpBase: number;
  horasIpPlanificadas: number;
  horasTaPlanificadas: number;
  horasObjetivoTa: number;
  horasObjetivoTotal: number;
  cargaHorariaTotal: number;
  cantidadActividades: number;
  cantidadActividadesIp: number;
  cantidadActividadesTa: number;
  loadState: LoadState;
  excesoMinutos: number;
}

type LoadState = 'red' | 'yellow' | 'green' | 'neutral';

interface ChartBucket {
  isoDate: string;
  label: string;
  count: number;
}

function normalizeCollection<T>(data: PaginatedResponse<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date: Date): Date {
  const day = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return addDays(date, -day);
}

function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' });
}

function formatWindowTitle(mode: 'week' | 'month', offset: number): string {
  const now = new Date();
  if (mode === 'week') {
    const start = addDays(startOfWeek(now), offset * 7);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`;
  }

  const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function getActivityDedication(actividad: Actividad, tiposMap: Map<number, TipoActividad>): 'IP' | 'TA' {
  if (actividad.es_ip) return 'IP';
  if (actividad.es_ta) return 'TA';
  if (typeof actividad.tipo_actividad === 'object') return actividad.tipo_actividad.tipo_dedicacion;
  return tiposMap.get(actividad.tipo_actividad)?.tipo_dedicacion ?? 'TA';
}

function getPlanEcEspacioId(planEc: PlanEstudioEC): number | null {
  if (typeof planEc.espacio_curricular === 'object') return planEc.espacio_curricular.id;
  const parsed = Number(planEc.espacio_curricular);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLoadState(usedHours: number, targetHours: number): LoadState {
  if (targetHours <= 0) return 'neutral';
  const ratio = usedHours / targetHours;
  if (ratio > 1) return 'red';
  if (ratio >= 0.95) return 'green';
  if (ratio >= 0.85) return 'yellow';
  return 'neutral';
}

function getLoadStatusLabel(state: LoadState, excesoMinutos: number): string {
  if (state === 'red') return `Excedido por ${excesoMinutos} min`;
  if (state === 'green') return 'En objetivo';
  if (state === 'yellow') return 'Cerca del límite';
  return 'En progreso';
}

function getProgressWidth(value: number, target: number): string {
  if (target <= 0) return '0%';
  return `${Math.min(100, (value / target) * 100)}%`;
}

function DocenteDashboard() {
  const currentYear = new Date().getFullYear();
  const [windowMode, setWindowMode] = useState<'week' | 'month'>('week');
  const [windowOffset, setWindowOffset] = useState(0);

  const { data: programas = [], isLoading: loadingProgramas } = useQuery({
    queryKey: ['programas'],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas').then(res => normalizeCollection(res.data)),
  });

  const { data: actividades = [], isLoading: loadingActividades } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades').then(res => normalizeCollection(res.data)),
  });

  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ['tipos-actividad'],
    queryFn: () => api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad').then(res => normalizeCollection(res.data)),
  });

  const { data: clases = [], isLoading: loadingClases } = useQuery({
    queryKey: ['clases-calendario'],
    queryFn: () => api.get<PaginatedResponse<ClaseCalendario>>('/clases-calendario').then(res => normalizeCollection(res.data)),
  });

  const { data: planesEC = [], isLoading: loadingPlanesEC } = useQuery({
    queryKey: ['planes-estudio-ec'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec').then(res => normalizeCollection(res.data)),
  });

  const { data: espacios = [], isLoading: loadingEspacios } = useQuery({
    queryKey: ['espacios-asignados'],
    queryFn: () => api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados').then(res => normalizeCollection(res.data)),
  });

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuracion-cre'],
    queryFn: () => api.get<PaginatedResponse<ConfiguracionCRE>>('/configuracion-cre').then(res => normalizeCollection(res.data)),
  });

  const loading = loadingProgramas || loadingActividades || loadingTipos || loadingClases || loadingPlanesEC || loadingEspacios;

  const tiposMap = useMemo(() => {
    const map = new Map<number, TipoActividad>();
    tipos.forEach((tipo) => map.set(tipo.id, tipo));
    return map;
  }, [tipos]);

  const clasesMap = useMemo(() => {
    const map = new Map<number, ClaseCalendario>();
    clases.forEach((clase) => map.set(clase.id, clase));
    return map;
  }, [clases]);

  const planEcToEspacio = useMemo(() => {
    const map = new Map<number, number>();
    planesEC.forEach((planEc) => {
      const espacioId = getPlanEcEspacioId(planEc);
      if (espacioId) map.set(planEc.id, espacioId);
    });
    return map;
  }, [planesEC]);

  const selectedEspacioId = Number(sessionStorage.getItem('selected_espacio_curricular_id') || 0);
  const espaciosSeleccionados = useMemo(
    () => espacios.filter((espacio) => espacio.id === selectedEspacioId),
    [espacios, selectedEspacioId],
  );

  const programasDelEspacioSeleccionado = useMemo(
    () => programas.filter((programa) => planEcToEspacio.get(programa.plan_estudio_ec) === selectedEspacioId),
    [planEcToEspacio, programas, selectedEspacioId],
  );

  const programasActuales = useMemo(
    () => programasDelEspacioSeleccionado.filter((programa) => programa.anio_academico === currentYear),
    [programasDelEspacioSeleccionado, currentYear],
  );

  const programaActualIds = useMemo(() => new Set(programasActuales.map((programa) => programa.id)), [programasActuales]);
  const programasIds = useMemo(() => new Set(programasDelEspacioSeleccionado.map((programa) => programa.id)), [programasDelEspacioSeleccionado]);
  const actividadesCiclo = useMemo(() => {
    const ids = programaActualIds.size > 0 ? programaActualIds : programasIds;
    return actividades.filter((actividad) => ids.has(actividad.programa));
  }, [actividades, programaActualIds, programasIds]);

  const horasPorCredito = configuraciones[0]?.horas_por_cre ?? 27;

  const espaciosResumen = useMemo(() => {
    const actividadPorPrograma = new Map<number, Actividad[]>();
    actividadesCiclo.forEach((actividad) => {
      const list = actividadPorPrograma.get(actividad.programa) || [];
      list.push(actividad);
      actividadPorPrograma.set(actividad.programa, list);
    });

    return espaciosSeleccionados.map<EspacioResumen>((espacio) => {
      const programasDelEspacio = programasDelEspacioSeleccionado;
      const programaActual = programasDelEspacio.find((programa) => programa.anio_academico === currentYear);
      const actividadesEspacio = programasDelEspacio.flatMap((programa) => actividadPorPrograma.get(programa.id) || []);
      const actividadesIp = actividadesEspacio.filter((actividad) => getActivityDedication(actividad, tiposMap) === 'IP');
      const actividadesTa = actividadesEspacio.filter((actividad) => getActivityDedication(actividad, tiposMap) === 'TA');
      const horasIpPlanificadas = actividadesEspacio.reduce((acc, actividad) => (
        getActivityDedication(actividad, tiposMap) === 'IP' ? acc + Number(actividad.horas) : acc
      ), 0);
      const horasTaPlanificadas = actividadesEspacio.reduce((acc, actividad) => (
        getActivityDedication(actividad, tiposMap) === 'TA' ? acc + Number(actividad.horas) : acc
      ), 0);
      const horasIpBase = Number(espacio.horas_ip || 0);
      const horasObjetivoTa = Number(espacio.horas_ta || 0);
      const horasObjetivoTotal = horasIpBase + horasObjetivoTa || Number(espacio.creditos || 0) * horasPorCredito;
      const horasIpComputables = Math.max(horasIpBase, horasIpPlanificadas);
      const cargaHorariaTotal = horasIpComputables + horasTaPlanificadas;
      const excesoMinutos = Math.max(0, Math.round((cargaHorariaTotal - horasObjetivoTotal) * 60));

      return {
        id: espacio.id,
        nombre: espacio.nombre,
        codigo: espacio.codigo,
        programaActual,
        horasIpBase,
        horasIpPlanificadas,
        horasTaPlanificadas,
        horasObjetivoTa,
        horasObjetivoTotal,
        cargaHorariaTotal,
        cantidadActividades: actividadesEspacio.length,
        cantidadActividadesIp: actividadesIp.length,
        cantidadActividadesTa: actividadesTa.length,
        loadState: getLoadState(cargaHorariaTotal, horasObjetivoTotal),
        excesoMinutos,
      };
    });
  }, [actividadesCiclo, currentYear, espaciosSeleccionados, horasPorCredito, programasDelEspacioSeleccionado, tiposMap]);

  useEffect(() => {
    espaciosResumen
      .filter((espacio) => espacio.excesoMinutos > 0)
      .forEach((espacio) => {
        const notificationKey = `cre_overload_notified_${currentYear}_${espacio.id}_${espacio.excesoMinutos}`;
        if (sessionStorage.getItem(notificationKey)) return;
        sessionStorage.setItem(notificationKey, '1');
        toast.warning(
          `${espacio.nombre}: te pasaste por ${espacio.excesoMinutos} minutos de la carga horaria objetivo.`,
          { duration: 6500 },
        );
      });
  }, [espaciosResumen, currentYear]);

  const activityStartCounts = useMemo(() => {
    const counts = new Map<string, number>();
    actividadesCiclo.forEach((actividad) => {
      const dedication = getActivityDedication(actividad, tiposMap);
      const startDate = dedication === 'IP'
        ? (actividad.clase_calendario ? clasesMap.get(actividad.clase_calendario)?.fecha : null)
        : actividad.fecha_inicio_ta;

      if (!startDate) return;
      counts.set(startDate, (counts.get(startDate) || 0) + 1);
    });
    return counts;
  }, [actividadesCiclo, clasesMap, tiposMap]);

  const chartBuckets = useMemo<ChartBucket[]>(() => {
    const now = new Date();
    if (windowMode === 'week') {
      const start = addDays(startOfWeek(now), windowOffset * 7);
      return Array.from({ length: 7 }, (_, index) => {
        const isoDate = dateToIso(addDays(start, index));
        return { isoDate, label: formatShortDate(isoDate), count: activityStartCounts.get(isoDate) || 0 };
      });
    }

    const monthDate = new Date(now.getFullYear(), now.getMonth() + windowOffset, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const isoDate = dateToIso(new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1));
      return { isoDate, label: String(index + 1), count: activityStartCounts.get(isoDate) || 0 };
    });
  }, [activityStartCounts, windowMode, windowOffset]);

  const maxChartCount = Math.max(1, ...chartBuckets.map((bucket) => bucket.count));
  const totalActividadesVentana = chartBuckets.reduce((acc, bucket) => acc + bucket.count, 0);
  const espacioActual = espaciosResumen.length > 0 ? espaciosResumen[0] : null;

  return (
    <>
      <section className="page-header docente-hero">
        <div>
          <p className="eyebrow">Panel docente</p>
          <h2>Planificación dinámica de actividades y tiempo</h2>
          {espacioActual ? (
            <div className="hero-context-info">
              <p>
                Gestionando <strong>{espacioActual.nombre}</strong> ({espacioActual.codigo}).
              </p>
              <div className="hero-meta-row">
                <span className="hero-meta-item">
                  Actividades IP: <strong>{espacioActual.cantidadActividadesIp}</strong>
                </span>
                <span className="hero-meta-item">
                  Actividades TA: <strong>{espacioActual.cantidadActividadesTa}</strong>
                </span>
                <span className="hero-meta-item">
                  Carga horaria: <strong>{espacioActual.cargaHorariaTotal.toFixed(1)}h</strong> / {espacioActual.horasObjetivoTotal.toFixed(1)}h
                </span>
                <span className={`hero-meta-status status-${espacioActual.loadState}`}>
                  {getLoadStatusLabel(espacioActual.loadState, espacioActual.excesoMinutos)}
                </span>
              </div>
            </div>
          ) : (
            <p>
              Explorá ventanas semanales o mensuales, separá IP/TA y controlá la carga horaria contra los créditos/horas del espacio curricular.
            </p>
          )}
        </div>
      </section>

      <SectionCard
        title="Carga del espacio curricular"
        action={(
          <Link className="button button-ghost" to="/docente/espacios">
            Ajustar créditos/horas
          </Link>
        )}
      >
        {loading ? (
          <p className="muted">Cargando seguimiento...</p>
        ) : espaciosResumen.length === 0 ? (
          <div className="content-empty">
            <MinusCircle size={24} />
            <p>Seleccioná un espacio curricular para ver su carga horaria, actividades y objetivo.</p>
            <Link className="button" to="/docente/espacios">Seleccionar espacio</Link>
          </div>
        ) : (
          <div className="unified-workload-card">
            {espaciosResumen.map((espacio) => (
              <div key={espacio.id} className="unified-workload-content">
                <div className="unified-workload-header">
                  <div className="unified-workload-title">
                    <h3>{espacio.nombre}</h3>
                    <span className="unified-workload-code">{espacio.codigo}</span>
                  </div>
                  <span className={`workload-status-badge status-${espacio.loadState}`}>
                    {getLoadStatusLabel(espacio.loadState, espacio.excesoMinutos)}
                  </span>
                </div>

                <div className="unified-workload-progress">
                  <div className="workload-progress-header">
                    <span>Progreso de carga horaria</span>
                    <strong>{espacio.cargaHorariaTotal.toFixed(1)} <small>/ {espacio.horasObjetivoTotal.toFixed(1)}h</small></strong>
                  </div>
                  <div className={`workload-progress-track ${espacio.loadState === 'red' ? 'track-overlimit' : ''}`}>
                    <div 
                      className={`workload-progress-fill fill-${espacio.loadState}`}
                      style={{ width: getProgressWidth(espacio.cargaHorariaTotal, espacio.horasObjetivoTotal) }} 
                    />
                  </div>
                </div>

                <div className="unified-workload-metrics">
                  <div className="unified-metric">
                    <span className="unified-metric-label">Actividades IP</span>
                    <strong className="unified-metric-value">{espacio.cantidadActividadesIp}</strong>
                  </div>
                  <div className="unified-metric">
                    <span className="unified-metric-label">Actividades TA</span>
                    <strong className="unified-metric-value">{espacio.cantidadActividadesTa}</strong>
                  </div>
                  <div className="unified-metric">
                    <span className="unified-metric-label">Horas IP planificadas</span>
                    <strong className="unified-metric-value">
                      {espacio.horasIpPlanificadas.toFixed(1)}h <small>/ {espacio.horasIpBase.toFixed(1)}h base</small>
                    </strong>
                  </div>
                  <div className="unified-metric">
                    <span className="unified-metric-label">Horas TA planificadas</span>
                    <strong className="unified-metric-value">
                      {espacio.horasTaPlanificadas.toFixed(1)}h <small>/ {espacio.horasObjetivoTa.toFixed(1)}h objetivo</small>
                    </strong>
                  </div>
                  <div className="unified-metric">
                    <span className="unified-metric-label">Carga horaria total</span>
                    <strong className={`unified-metric-value value-${espacio.loadState}`}>{espacio.cargaHorariaTotal.toFixed(1)}h</strong>
                  </div>
                  <div className="unified-metric">
                    <span className="unified-metric-label">Inicios en ventana</span>
                    <strong className="unified-metric-value">{totalActividadesVentana}</strong>
                  </div>
                </div>

                <div className="unified-workload-actions">
                  {!espacio.programaActual ? (
                    <Link to="/docente/programas" className="button">Crear programa {currentYear}</Link>
                  ) : espacio.cantidadActividades === 0 ? (
                    <Link to="/docente/planificacion-ta" className="button">Planificar primera actividad</Link>
                  ) : espacio.loadState === 'red' ? (
                    <Link to="/docente/planificacion-ta" className="button button-danger">Revisar carga de actividades</Link>
                  ) : (
                    <>
                      <Link to="/docente/planificacion-ta" className="button">Planificar TA</Link>
                      <Link to="/docente/planificacion-ip" className="button button-ghost">Planificar IP</Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Actividades iniciadas por día"
        action={(
          <div className="chart-toolbar">
            <button className="button button-ghost button-small" type="button" onClick={() => setWindowOffset((value) => value - 1)} aria-label="Ventana anterior">
              <ArrowLeft size={15} />
            </button>
            <select
              className="select chart-mode-select"
              value={windowMode}
              onChange={(event) => {
                setWindowMode(event.target.value as 'week' | 'month');
                setWindowOffset(0);
              }}
            >
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
            <button className="button button-ghost button-small" type="button" onClick={() => setWindowOffset((value) => value + 1)} aria-label="Ventana siguiente">
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      >
        <div className="planning-window-title">
          <Gauge size={18} />
          <strong>{formatWindowTitle(windowMode, windowOffset)}</strong>
          {windowOffset !== 0 ? (
            <button className="button button-ghost button-small" type="button" onClick={() => setWindowOffset(0)}>
              Volver a hoy
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : (
          <>
            <div className={`activity-chart activity-chart-${windowMode}`} style={{ '--chart-cols': chartBuckets.length } as React.CSSProperties} role="img" aria-label="Cantidad de actividades iniciadas por día">
              {chartBuckets.map((bucket) => (
                <div className="activity-chart-bar-wrap" key={bucket.isoDate} title={`${bucket.label}: ${bucket.count} actividades`}>
                  <span className="activity-chart-value">{bucket.count}</span>
                  <div className="activity-chart-track">
                    <span className="activity-chart-bar" style={{ height: `${Math.max(8, (bucket.count / maxChartCount) * 100)}%` }} />
                  </div>
                  <span className="activity-chart-label">{bucket.label}</span>
                </div>
              ))}
            </div>
            <p className="chart-insight">
              Cada barra muestra cuántas actividades comienzan ese día.
            </p>
          </>
        )}
      </SectionCard>
    </>
  );
}

export default DocenteDashboard;
