import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import SectionCard from '../../components/Common/SectionCard';
import PlanningActivityCommonFields from '../../components/Forms/PlanningActivityCommonFields';
import PlanningCalendar from '../../components/Forms/PlanningCalendar';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';

const taActivitySchema = z.object({
  tipo_actividad: z.string().min(1, 'Seleccioná un tipo de actividad'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  minutos: z.string()
    .min(1, 'Ingresa una duración en minutos')
    .refine((value) => Number(value) > 0, 'Ingresa una duración mayor a 0'),
  modalidad_trabajo: z.enum(['IND', 'EQU']),
  unidad_ids: z.array(z.number()).min(1, 'Seleccioná al menos una unidad'),
  fecha_inicio_ta: z.string().optional(),
  fecha_fin_ta: z.string().optional(),
}).refine(
  (values) => !values.fecha_inicio_ta || !values.fecha_fin_ta || values.fecha_inicio_ta <= values.fecha_fin_ta,
  { message: 'La fecha fin no puede ser anterior a la fecha inicio', path: ['fecha_fin_ta'] },
);

type TAActivityFormValues = z.infer<typeof taActivitySchema>;

const defaultTAActivityValues: TAActivityFormValues = {
  tipo_actividad: '',
  descripcion: '',
  minutos: '',
  modalidad_trabajo: 'IND',
  unidad_ids: [],
  fecha_inicio_ta: '',
  fecha_fin_ta: '',
};

interface PaginatedResponse<T> {
  results: T[];
}

interface Programa {
  id: number;
  anio_academico: number;
  descripcion: string;
}

interface TipoActividad {
  id: number;
  nombre: string;
  tipo_dedicacion: 'IP' | 'TA';
}

interface Unidad {
  id: number;
  programa: number;
  numero: number;
  descripcion: string;
}

interface Actividad {
  id: number;
  descripcion: string;
  horas: number;
  programa: number;
  modalidad_trabajo: 'IND' | 'EQU';
  fecha_inicio_ta: string | null;
  fecha_fin_ta: string | null;
  tipo_actividad: number;
  es_ta: boolean;
  unidad_ids: number[];
}

interface EspacioCurricular {
  id: number;
  codigo: string;
  nombre: string;
  creditos: number;
  horas_ip: number;
  horas_ta: number;
}

type TALoadState = 'red' | 'yellow' | 'green' | 'neutral';

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

function getTAFeedbackState(projectedHours: number, targetHours: number): TALoadState {
  if (targetHours <= 0) return 'neutral';
  const ratio = projectedHours / targetHours;
  if (ratio > 1) return 'red';
  if (ratio >= 0.95) return 'green';
  if (ratio >= 0.85) return 'yellow';
  return 'neutral';
}

function getProgressWidth(value: number, target: number): string {
  if (target <= 0) return '0%';
  return `${Math.min(100, (value / target) * 100)}%`;
}

function formatHours(value: number): string {
  return `${value.toFixed(1)}h`;
}

function DocentePlanificacionTA() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const now = new Date();

  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');
  const selectedEspacioId = Number(sessionStorage.getItem('selected_espacio_curricular_id') || 0);

  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  const queryEnabled = Boolean(selectedPlanEcId);

  const programasQuery = useQuery({
    queryKey: ['programas', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas', { params: { plan_estudio_ec_id: selectedPlanEcId } }).then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const tiposQuery = useQuery({
    queryKey: ['tipos-actividad'],
    queryFn: () => api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad').then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const unidadesQuery = useQuery({
    queryKey: ['unidades', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Unidad>>('/unidades', { params: { plan_estudio_ec_id: selectedPlanEcId } }).then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const actividadesQuery = useQuery({
    queryKey: ['actividades', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades', { params: { plan_estudio_ec_id: selectedPlanEcId } }).then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const espaciosQuery = useQuery({
    queryKey: ['espacios-asignados'],
    queryFn: () => api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados').then((r) => normalizeCollection(r.data)),
    enabled: Boolean(selectedEspacioId),
  });

  const programas = useMemo(() => programasQuery.data ?? [], [programasQuery.data]);
  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);
  const unidades = useMemo(() => unidadesQuery.data ?? [], [unidadesQuery.data]);
  const actividades = useMemo(() => actividadesQuery.data ?? [], [actividadesQuery.data]);
  const espacios = useMemo(() => espaciosQuery.data ?? [], [espaciosQuery.data]);

  const loading = queryEnabled && (
    programasQuery.isLoading || tiposQuery.isLoading || unidadesQuery.isLoading || actividadesQuery.isLoading || espaciosQuery.isLoading
  );

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TAActivityFormValues>({
    resolver: zodResolver(taActivitySchema),
    defaultValues: defaultTAActivityValues,
  });

  const tipoActividadValue = watch('tipo_actividad');
  const minutosValue = watch('minutos');
  const modalidadTrabajoValue = watch('modalidad_trabajo');
  const unidadIdsValue = watch('unidad_ids');
  const descripcionValue = watch('descripcion');
  const fechaInicioTaValue = watch('fecha_inicio_ta') || '';
  const fechaFinTaValue = watch('fecha_fin_ta') || '';

  const programaActual = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const tiposTA = useMemo(() => tipos.filter((tipo) => tipo.tipo_dedicacion === 'TA'), [tipos]);

  useEffect(() => {
    if (!tipoActividadValue && tiposTA.length > 0) {
      const defaultTipo = tiposTA[0];
      if (!defaultTipo) return;
      setValue('tipo_actividad', String(defaultTipo.id));
    }
  }, [setValue, tipoActividadValue, tiposTA]);

  const unidadesProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return unidades.filter((unidad) => unidad.programa === programaActual.id).sort((a, b) => a.numero - b.numero);
  }, [programaActual, unidades]);

  const actividadesTA = useMemo(
    () => actividades.filter((actividad) => actividad.es_ta && (!programaActual || actividad.programa === programaActual.id)),
    [actividades, programaActual],
  );

  const selectedEspacio = useMemo(
    () => espacios.find((espacio) => espacio.id === selectedEspacioId) || null,
    [espacios, selectedEspacioId],
  );

  const horasTaActuales = useMemo(
    () => actividadesTA.reduce((total, actividad) => total + Number(actividad.horas || 0), 0),
    [actividadesTA],
  );

  const minutosDraft = Number(minutosValue);
  const horasTaDraft = Number.isFinite(minutosDraft) && minutosDraft > 0 ? minutosDraft / 60 : 0;
  const horasTaObjetivo = Number(selectedEspacio?.horas_ta || 0);
  const horasTaProyectadas = horasTaActuales + horasTaDraft;
  const taFeedbackState = getTAFeedbackState(horasTaProyectadas, horasTaObjetivo);
  const taExcesoMinutos = Math.max(0, Math.round((horasTaProyectadas - horasTaObjetivo) * 60));
  const taRestantesMinutos = Math.max(0, Math.round((horasTaObjetivo - horasTaProyectadas) * 60));

  const taFeedbackMessage = useMemo(() => {
    if (horasTaObjetivo <= 0) {
      return 'Este espacio no tiene un objetivo de horas TA cargado. Podés ajustarlo desde Espacios.';
    }
    if (taFeedbackState === 'red') {
      return `Con esta carga te pasarías por ${taExcesoMinutos} min del objetivo TA.`;
    }
    if (taFeedbackState === 'green') {
      return 'Con esta carga quedás muy cerca del objetivo TA.';
    }
    if (taFeedbackState === 'yellow') {
      return `Atención: quedarían ${taRestantesMinutos} min para llegar al objetivo TA.`;
    }
    return `Quedan ${taRestantesMinutos} min disponibles para actividades TA.`;
  }, [horasTaObjetivo, taExcesoMinutos, taFeedbackState, taRestantesMinutos]);

  const taRangesByDate = useMemo(() => {
    const map = new Map<string, number>();
    actividadesTA.forEach((actividad) => {
      if (!actividad.fecha_inicio_ta || !actividad.fecha_fin_ta) {
        return;
      }

      let cursor = new Date(actividad.fecha_inicio_ta);
      const end = new Date(actividad.fecha_fin_ta);
      while (cursor <= end) {
        const key = dateToIso(cursor);
        map.set(key, (map.get(key) || 0) + 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
    });
    return map;
  }, [actividadesTA]);

  const handlePickRangeDate = (isoDate: string) => {
    if (!rangeAnchor) {
      setRangeAnchor(isoDate);
      setValue('fecha_inicio_ta', isoDate, { shouldDirty: true, shouldValidate: true });
      setValue('fecha_fin_ta', '', { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (isoDate < rangeAnchor) {
      setValue('fecha_inicio_ta', isoDate, { shouldDirty: true, shouldValidate: true });
      setValue('fecha_fin_ta', rangeAnchor, { shouldDirty: true, shouldValidate: true });
    } else {
      setValue('fecha_inicio_ta', rangeAnchor, { shouldDirty: true, shouldValidate: true });
      setValue('fecha_fin_ta', isoDate, { shouldDirty: true, shouldValidate: true });
    }

    setRangeAnchor(null);
  };

  const clearRangeSelection = () => {
    setRangeAnchor(null);
    setValue('fecha_inicio_ta', '', { shouldDirty: true, shouldValidate: true });
    setValue('fecha_fin_ta', '', { shouldDirty: true, shouldValidate: true });
  };

  const handleCreateActividadTA = async (values: TAActivityFormValues) => {
    if (!programaActual) {
      toast.error('Primero debes tener programa del año actual.');
      return;
    }

    if (unidadesProgramaActual.length === 0) {
      toast.error('Este programa no tiene unidades activas.');
      return;
    }

    const minutos = Number(values.minutos);
    try {
      await api.post<Actividad>('/actividades', {
        programa: programaActual.id,
        tipo_actividad: Number(values.tipo_actividad),
        descripcion: values.descripcion,
        horas: Number((minutos / 60).toFixed(2)),
        modalidad_trabajo: values.modalidad_trabajo,
        unidad_ids: values.unidad_ids,
        clase_calendario: null,
        fecha_inicio_ta: values.fecha_inicio_ta || null,
        fecha_fin_ta: values.fecha_fin_ta || null,
      });

      queryClient.invalidateQueries({ queryKey: ['actividades', selectedPlanEcId] });
      reset({
        ...defaultTAActivityValues,
        tipo_actividad: values.tipo_actividad,
        modalidad_trabajo: values.modalidad_trabajo,
        descripcion: '',
        minutos: '',
        unidad_ids: [],
        fecha_inicio_ta: '',
        fecha_fin_ta: '',
      });
      toast.success('Actividad TA creada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la actividad TA.'));
    }
  };

  const handleDeleteActividad = async (actividadId: number) => {
    const ok = window.confirm('¿Dar de baja esta actividad TA?');
    if (!ok) return;

    try {
      await api.delete(`/actividades/${actividadId}`);
      queryClient.invalidateQueries({ queryKey: ['actividades', selectedPlanEcId] });
      toast.success('Actividad dada de baja.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo dar de baja la actividad.'));
    }
  };

  if (!selectedPlanEcId) {
    return (
      <SectionCard title="Selección de espacio curricular">
        <p className="muted">Seleccioná un espacio curricular desde la barra superior.</p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard title="Planificación TA">
        <p className="muted">Cargando planificación...</p>
      </SectionCard>
    );
  }

  if (!programaActual) {
    return (
      <SectionCard title="Programa actual requerido">
        <p className="muted">No hay programa del año actual para este espacio.</p>
        <div className="form-actions">
          <button className="button" type="button" onClick={() => navigate('/docente/programas')}>
            Ir a programas
          </button>
        </div>
      </SectionCard>
    );
  }

  const rows = actividadesTA.map((actividad) => ({
    id: String(actividad.id),
    cells: [
      actividad.descripcion,
      `${Math.round(Number(actividad.horas) * 60)} min`,
      actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Grupal',
      actividad.fecha_inicio_ta && actividad.fecha_fin_ta
        ? `${actividad.fecha_inicio_ta} a ${actividad.fecha_fin_ta}`
        : '-',
      <button className="icon-button" type="button" onClick={() => handleDeleteActividad(actividad.id)} title="Dar de baja" key={`delete-${actividad.id}`}>
        <Trash2 size={16} />
      </button>,
    ],
  }));

  return (
    <>
      <section className="page-header docente-hero">
        <div>
          <p className="eyebrow">Planificación</p>
          <h2>{selectedEspacioNombre || 'Espacio curricular'} | TA</h2>
          <p>Planifica trabajo autónomo con el mismo flujo visual del calendario de IP.</p>
        </div>
        <div className="docente-hero-actions">
          <Link className="button button-ghost" to="/docente/planificacion-ip">
            Ir a planificación IP
          </Link>
          <Link className="button button-ghost" to="/docente/ejecucion-ip">
            Seguimiento IP
          </Link>
        </div>
      </section>

      <section className="planning-context-grid">
        <div className="context-card">
          <span className="context-label">Programa vigente</span>
          <strong>{programaActual.descripcion || `Programa ${currentYear}`}</strong>
          <p>La carga TA se distribuye por unidades del programa académico actual.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Unidades activas</span>
          <strong>{unidadesProgramaActual.length}</strong>
          <p>Seleccioná una o varias unidades para contextualizar cada actividad.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Carga TA</span>
          <strong>{actividadesTA.length} actividades</strong>
          <p>Ya registradas para el programa académico actual.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Rango seleccionado</span>
          <strong>
            {fechaInicioTaValue
              ? fechaFinTaValue
                ? `${fechaInicioTaValue} a ${fechaFinTaValue}`
                : `${fechaInicioTaValue} (pendiente fin)`
              : 'Sin rango'}
          </strong>
          <p>Seleccioná inicio y fin en el calendario lateral para acelerar la carga.</p>
        </div>
      </section>

      {tiposTA.length === 0 ? (
        <SectionCard title="Tipos TA faltantes">
          <p className="muted">
            No hay tipos de actividad TA disponibles. Pide a administración que cargue al menos uno para habilitar esta carga.
          </p>
        </SectionCard>
      ) : null}

      <div className="planning-split">
        <SectionCard title="Calendario de trabajo TA">
          <div className="status-note status-note-neutral">
            Seleccioná un rango en el calendario para precargar fechas de inicio y fin.
          </div>

          <PlanningCalendar
            year={currentYear}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDate={handlePickRangeDate}
            getCellMeta={(isoDate) => {
              const hasActivities = (taRangesByDate.get(isoDate) || 0) > 0;
              const isRangeStart = Boolean(fechaInicioTaValue) && isoDate === fechaInicioTaValue;
              const isRangeEnd = Boolean(fechaFinTaValue) && isoDate === fechaFinTaValue;
              const isInRange =
                Boolean(fechaInicioTaValue)
                && Boolean(fechaFinTaValue)
                && isoDate >= fechaInicioTaValue
                && isoDate <= fechaFinTaValue;

              return {
                className: `ta-day ${hasActivities ? 'ta-has-activity' : ''} ${isInRange ? 'ta-in-range' : ''} ${isRangeStart ? 'ta-range-start' : ''} ${isRangeEnd ? 'ta-range-end' : ''}`.trim(),
                title: 'Seleccionar fecha para el rango TA',
                ariaLabel: `${isoDate}: seleccionar fecha para el rango TA${hasActivities ? '. Tiene actividades TA cargadas' : ''}`,
                ariaSelected: isInRange || isRangeStart || isRangeEnd,
                showIcon: true,
                badge: hasActivities ? <span className="table-row-pill pill-success">TA</span> : null,
              };
            }}
            compactList={
              actividadesTA.length === 0 ? (
                <div className="status-note status-note-neutral">Aún no hay actividades TA cargadas en este programa.</div>
              ) : (
                actividadesTA.slice(0, 10).map((actividad) => (
                  <div className="planning-compact-item" key={actividad.id}>
                    <span>{actividad.descripcion}</span>
                    <span>
                      {actividad.fecha_inicio_ta && actividad.fecha_fin_ta
                        ? `${actividad.fecha_inicio_ta} a ${actividad.fecha_fin_ta}`
                        : 'Sin rango'}
                    </span>
                  </div>
                ))
              )
            }
          />
        </SectionCard>

        <SectionCard title="Nueva actividad TA">
          <form className="form-grid-full planning-sticky-form" onSubmit={handleSubmit(handleCreateActividadTA)}>
            <div className="status-note status-note-neutral">
              El rango de fechas es opcional. Si no lo completas, la actividad queda asociada al programa y a las unidades elegidas.
            </div>

            <div className={`ta-feedback-card ta-feedback-${taFeedbackState}`} aria-live="polite">
              <div className="ta-feedback-header">
                <div>
                  <span className="ta-feedback-eyebrow">Feedback de carga TA</span>
                  <strong>{taFeedbackMessage}</strong>
                </div>
                <span className="ta-feedback-ratio">
                  {formatHours(horasTaProyectadas)} <small>/ {formatHours(horasTaObjetivo)}</small>
                </span>
              </div>
              <div className={`ta-feedback-track ${taFeedbackState === 'red' ? 'track-overlimit' : ''}`}>
                <span
                  className={`ta-feedback-fill fill-${taFeedbackState}`}
                  style={{ width: getProgressWidth(horasTaProyectadas, horasTaObjetivo) }}
                />
              </div>
              <div className="ta-feedback-metrics">
                <span>Actual: <strong>{formatHours(horasTaActuales)}</strong></span>
                <span>Nueva actividad: <strong>{formatHours(horasTaDraft)}</strong></span>
                <span>Objetivo TA: <strong>{formatHours(horasTaObjetivo)}</strong></span>
              </div>
            </div>

            <PlanningActivityCommonFields
              idPrefix="planificacion-ta"
              tipos={tiposTA}
              tipoActividad={tipoActividadValue}
              minutos={minutosValue}
              modalidadTrabajo={modalidadTrabajoValue}
              unidadIds={unidadIdsValue}
              descripcion={descripcionValue}
              onTipoActividadChange={(value) => setValue('tipo_actividad', value, { shouldDirty: true, shouldValidate: true })}
              onMinutosChange={(value) => setValue('minutos', value, { shouldDirty: true, shouldValidate: true })}
              onModalidadTrabajoChange={(value) => setValue('modalidad_trabajo', value, { shouldDirty: true, shouldValidate: true })}
              onUnidadIdsChange={(value) => setValue('unidad_ids', value, { shouldDirty: true, shouldValidate: true })}
              onDescripcionChange={(value) => setValue('descripcion', value, { shouldDirty: true, shouldValidate: true })}
              unidades={unidadesProgramaActual}
              errors={{
                tipoActividad: errors.tipo_actividad?.message,
                minutos: errors.minutos?.message,
                modalidadTrabajo: errors.modalidad_trabajo?.message,
                unidadIds: errors.unidad_ids?.message,
                descripcion: errors.descripcion?.message,
              }}
            >
              <div className="form-row">
                <label className="grid-label" htmlFor="planificacion-ta-fecha-inicio">
                  <span className="muted">Fecha inicio TA</span>
                  <input
                    id="planificacion-ta-fecha-inicio"
                    className="input"
                    type="date"
                    value={fechaInicioTaValue}
                    readOnly
                    aria-invalid={Boolean(errors.fecha_inicio_ta)}
                    aria-describedby={errors.fecha_inicio_ta ? 'planificacion-ta-fecha-inicio-error' : undefined}
                    onChange={(event) => setValue('fecha_inicio_ta', event.target.value, { shouldDirty: true, shouldValidate: true })}
                  />
                  {errors.fecha_inicio_ta ? <span id="planificacion-ta-fecha-inicio-error" className="error-text" role="alert">{errors.fecha_inicio_ta.message}</span> : null}
                </label>
                <label className="grid-label" htmlFor="planificacion-ta-fecha-fin">
                  <span className="muted">Fecha fin TA</span>
                  <input
                    id="planificacion-ta-fecha-fin"
                    className="input"
                    type="date"
                    value={fechaFinTaValue}
                    readOnly
                    aria-invalid={Boolean(errors.fecha_fin_ta)}
                    aria-describedby={errors.fecha_fin_ta ? 'planificacion-ta-fecha-fin-error' : undefined}
                    onChange={(event) => setValue('fecha_fin_ta', event.target.value, { shouldDirty: true, shouldValidate: true })}
                  />
                  {errors.fecha_fin_ta ? <span id="planificacion-ta-fecha-fin-error" className="error-text" role="alert">{errors.fecha_fin_ta.message}</span> : null}
                </label>
              </div>
            </PlanningActivityCommonFields>

            <div className="form-actions" style={{ marginTop: '-0.5rem' }}>
              <button className="button button-ghost" type="button" onClick={clearRangeSelection}>
                Limpiar rango TA
              </button>
            </div>

            <button className="button" type="submit" disabled={isSubmitting || tiposTA.length === 0}>
              {isSubmitting ? 'Guardando...' : 'Crear actividad TA'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Actividades TA cargadas">
        {rows.length === 0 ? (
          <p className="muted">Aún no hay actividades TA cargadas.</p>
        ) : (
          <BasicTable columns={['Actividad', 'Duración', 'Modalidad', 'Rango TA', 'Acciones']} rows={rows} pageSize={10} />
        )}
      </SectionCard>
    </>
  );
}

export default DocentePlanificacionTA;
