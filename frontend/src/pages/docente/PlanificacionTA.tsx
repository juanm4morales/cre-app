import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import PlanningActivityCommonFields from '../../components/Forms/PlanningActivityCommonFields';
import PlanningCalendar from '../../components/Forms/PlanningCalendar';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

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
  modalidad_trabajo: 'IND' | 'EQU';
  fecha_inicio_ta: string | null;
  fecha_fin_ta: string | null;
  tipo_actividad: number;
  es_ta: boolean;
  unidad_ids: number[];
}

function normalizeCollection<T>(data: PaginatedResponse<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function DocentePlanificacionTA() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const now = new Date();

  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [tipos, setTipos] = useState<TipoActividad[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    tipo_actividad: '',
    descripcion: '',
    minutos: '',
    modalidad_trabajo: 'IND' as 'IND' | 'EQU',
    unidad_ids: [] as number[],
    fecha_inicio_ta: '',
    fecha_fin_ta: '',
  });

  const loadData = useCallback(async (background = false) => {
    if (!selectedPlanEcId) {
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
    }

    try {
      const [programaRes, tiposRes, unidadesRes, actividadesRes] = await Promise.all([
        api.get<PaginatedResponse<Programa>>('/programas', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
        api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad'),
        api.get<PaginatedResponse<Unidad>>('/unidades', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
        api.get<PaginatedResponse<Actividad>>('/actividades', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
      ]);

      setProgramas(normalizeCollection(programaRes.data));
      setTipos(normalizeCollection(tiposRes.data));
      setUnidades(normalizeCollection(unidadesRes.data));
      setActividades(normalizeCollection(actividadesRes.data));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la planificación TA.'));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [selectedPlanEcId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useApiAutoRefresh(() => loadData(true), [selectedPlanEcId], { enabled: Boolean(selectedPlanEcId) });

  const programaActual = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const tiposTA = useMemo(() => tipos.filter((tipo) => tipo.tipo_dedicacion === 'TA'), [tipos]);

  useEffect(() => {
    if (!formState.tipo_actividad && tiposTA.length > 0) {
      const defaultTipo = tiposTA[0];
      if (!defaultTipo) {
        return;
      }
      setFormState((prev) => ({ ...prev, tipo_actividad: String(defaultTipo.id) }));
    }
  }, [formState.tipo_actividad, tiposTA]);

  const unidadesProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return unidades.filter((unidad) => unidad.programa === programaActual.id).sort((a, b) => a.numero - b.numero);
  }, [programaActual, unidades]);

  const actividadesTA = useMemo(() => actividades.filter((actividad) => actividad.es_ta), [actividades]);

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
      setFormState((prev) => ({ ...prev, fecha_inicio_ta: isoDate, fecha_fin_ta: '' }));
      return;
    }

    if (isoDate < rangeAnchor) {
      setFormState((prev) => ({ ...prev, fecha_inicio_ta: isoDate, fecha_fin_ta: rangeAnchor }));
    } else {
      setFormState((prev) => ({ ...prev, fecha_inicio_ta: rangeAnchor, fecha_fin_ta: isoDate }));
    }

    setRangeAnchor(null);
  };

  const clearRangeSelection = () => {
    setRangeAnchor(null);
    setFormState((prev) => ({ ...prev, fecha_inicio_ta: '', fecha_fin_ta: '' }));
  };

  const handleCreateActividadTA = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!programaActual) {
      toast.error('Primero debes tener programa del año actual.');
      return;
    }

    if (unidadesProgramaActual.length === 0) {
      toast.error('Este programa no tiene unidades activas.');
      return;
    }

    const minutos = Number(formState.minutos);
    if (!Number.isFinite(minutos) || minutos <= 0) {
      toast.error('Ingresa una duración en minutos mayor a 0.');
      return;
    }

    if (formState.unidad_ids.length === 0) {
      toast.error('Selecciona al menos una unidad.');
      return;
    }

    if (formState.fecha_inicio_ta && formState.fecha_fin_ta && formState.fecha_inicio_ta > formState.fecha_fin_ta) {
      toast.error('La fecha fin no puede ser anterior a la fecha inicio.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post<Actividad>('/actividades', {
        programa: programaActual.id,
        tipo_actividad: Number(formState.tipo_actividad),
        descripcion: formState.descripcion,
        horas: Number((minutos / 60).toFixed(2)),
        modalidad_trabajo: formState.modalidad_trabajo,
        unidad_ids: formState.unidad_ids,
        clase_calendario: null,
        fecha_inicio_ta: formState.fecha_inicio_ta || null,
        fecha_fin_ta: formState.fecha_fin_ta || null,
      });

      setActividades((prev) => [response.data, ...prev]);
      setFormState((prev) => ({
        ...prev,
        descripcion: '',
        minutos: '',
        unidad_ids: [],
        fecha_inicio_ta: '',
        fecha_fin_ta: '',
      }));
      toast.success('Actividad TA creada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la actividad TA.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActividad = async (actividadId: number) => {
    const ok = window.confirm('¿Dar de baja esta actividad TA?');
    if (!ok) return;

    try {
      await api.delete(`/actividades/${actividadId}`);
      setActividades((prev) => prev.filter((actividad) => actividad.id !== actividadId));
      toast.success('Actividad dada de baja.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo dar de baja la actividad.'));
    }
  };

  if (!selectedPlanEcId) {
    return (
      <SectionCard title="Selección de espacio curricular">
        <p className="muted">Selecciona un espacio curricular desde la barra superior.</p>
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
      actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Equipo',
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
          <p>Selecciona una o varias unidades para contextualizar cada actividad.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Carga TA</span>
          <strong>{actividadesTA.length} actividades</strong>
          <p>Ya registradas para el programa académico actual.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Rango seleccionado</span>
          <strong>
            {formState.fecha_inicio_ta
              ? formState.fecha_fin_ta
                ? `${formState.fecha_inicio_ta} a ${formState.fecha_fin_ta}`
                : `${formState.fecha_inicio_ta} (pendiente fin)`
              : 'Sin rango'}
          </strong>
          <p>Selecciona inicio y fin en el calendario lateral para acelerar la carga.</p>
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
            Selecciona un rango en el calendario para precargar fechas de inicio y fin.
          </div>

          <PlanningCalendar
            year={currentYear}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDate={handlePickRangeDate}
            getCellMeta={(isoDate) => {
              const hasActivities = (taRangesByDate.get(isoDate) || 0) > 0;
              const isRangeStart = Boolean(formState.fecha_inicio_ta) && isoDate === formState.fecha_inicio_ta;
              const isRangeEnd = Boolean(formState.fecha_fin_ta) && isoDate === formState.fecha_fin_ta;
              const isInRange =
                Boolean(formState.fecha_inicio_ta)
                && Boolean(formState.fecha_fin_ta)
                && isoDate >= formState.fecha_inicio_ta
                && isoDate <= formState.fecha_fin_ta;

              return {
                className: `ta-day ${hasActivities ? 'ta-has-activity' : ''} ${isInRange ? 'ta-in-range' : ''} ${isRangeStart ? 'ta-range-start' : ''} ${isRangeEnd ? 'ta-range-end' : ''}`.trim(),
                title: 'Seleccionar fecha para el rango TA',
                showIcon: true,
                badge: hasActivities ? <span className="table-row-pill">TA</span> : null,
              };
            }}
            compactList={
              actividadesTA.length === 0 ? (
                <div className="status-note status-note-neutral">Aun no hay actividades TA cargadas en este programa.</div>
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
          <form className="form-grid-full planning-sticky-form" onSubmit={handleCreateActividadTA}>
            <div className="status-note status-note-neutral">
              El rango de fechas es opcional. Si no lo completas, la actividad queda asociada al programa y a las unidades elegidas.
            </div>
            <PlanningActivityCommonFields
              tipos={tiposTA}
              tipoActividad={formState.tipo_actividad}
              minutos={formState.minutos}
              modalidadTrabajo={formState.modalidad_trabajo}
              unidadIds={formState.unidad_ids}
              descripcion={formState.descripcion}
              onTipoActividadChange={(value) => setFormState((prev) => ({ ...prev, tipo_actividad: value }))}
              onMinutosChange={(value) => setFormState((prev) => ({ ...prev, minutos: value }))}
              onModalidadTrabajoChange={(value) => setFormState((prev) => ({ ...prev, modalidad_trabajo: value }))}
              onUnidadIdsChange={(value) => setFormState((prev) => ({ ...prev, unidad_ids: value }))}
              onDescripcionChange={(value) => setFormState((prev) => ({ ...prev, descripcion: value }))}
              unidades={unidadesProgramaActual}
            >
              <div className="form-row">
                <input
                  className="input"
                  type="date"
                  value={formState.fecha_inicio_ta}
                  readOnly
                  onChange={(event) => setFormState((prev) => ({ ...prev, fecha_inicio_ta: event.target.value }))}
                />
                <input
                  className="input"
                  type="date"
                  value={formState.fecha_fin_ta}
                  readOnly
                  onChange={(event) => setFormState((prev) => ({ ...prev, fecha_fin_ta: event.target.value }))}
                />
              </div>
            </PlanningActivityCommonFields>

            <div className="form-actions" style={{ marginTop: '-0.5rem' }}>
              <button className="button button-ghost" type="button" onClick={clearRangeSelection}>
                Limpiar rango TA
              </button>
            </div>

            <button className="button" type="submit" disabled={saving || tiposTA.length === 0}>
              {saving ? 'Guardando...' : 'Crear actividad TA'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Actividades TA cargadas">
        {rows.length === 0 ? (
          <p className="muted">Aún no hay actividades TA cargadas.</p>
        ) : (
          <BasicTable columns={['Actividad', 'Duración', 'Modalidad', 'Rango TA', 'Acciones']} rows={rows} />
        )}
      </SectionCard>
    </>
  );
}

export default DocentePlanificacionTA;
