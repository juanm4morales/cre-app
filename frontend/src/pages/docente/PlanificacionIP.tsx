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

interface ClaseCalendario {
  id: number;
  programa: number;
  fecha: string;
  estado: 'PLAN' | 'DICT' | 'CANC';
}

interface Actividad {
  id: number;
  descripcion: string;
  horas: number;
  modalidad_trabajo: 'IND' | 'EQU';
  tipo_actividad: number;
  clase_calendario: number | null;
  unidad_ids: number[];
  es_ip: boolean;
}

function normalizeCollection<T>(data: PaginatedResponse<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function DocentePlanificacionIP() {
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
  const [clases, setClases] = useState<ClaseCalendario[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const [formState, setFormState] = useState({
    tipo_actividad: '',
    descripcion: '',
    minutos: '',
    modalidad_trabajo: 'IND' as 'IND' | 'EQU',
    unidad_ids: [] as number[],
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
      const [programaRes, tiposRes, unidadesRes, clasesRes, actividadesRes] = await Promise.all([
        api.get<PaginatedResponse<Programa>>('/programas', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
        api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad'),
        api.get<PaginatedResponse<Unidad>>('/unidades', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
        api.get<PaginatedResponse<ClaseCalendario>>('/clases-calendario', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
        api.get<PaginatedResponse<Actividad>>('/actividades', { params: { plan_estudio_ec_id: selectedPlanEcId } }),
      ]);

      setProgramas(normalizeCollection(programaRes.data));
      setTipos(normalizeCollection(tiposRes.data));
      setUnidades(normalizeCollection(unidadesRes.data));
      setClases(normalizeCollection(clasesRes.data));
      setActividades(normalizeCollection(actividadesRes.data));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la planificación IP.'));
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

  const tiposIP = useMemo(() => tipos.filter((tipo) => tipo.tipo_dedicacion === 'IP'), [tipos]);

  useEffect(() => {
    if (!formState.tipo_actividad && tiposIP.length > 0) {
      const defaultTipo = tiposIP[0];
      if (!defaultTipo) {
        return;
      }
      setFormState((prev) => ({ ...prev, tipo_actividad: String(defaultTipo.id) }));
    }
  }, [formState.tipo_actividad, tiposIP]);

  const unidadesProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return unidades.filter((unidad) => unidad.programa === programaActual.id).sort((a, b) => a.numero - b.numero);
  }, [programaActual, unidades]);

  const clasesProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return clases
      .filter((clase) => clase.programa === programaActual.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [programaActual, clases]);

  const clasesMap = useMemo(() => {
    const map = new Map<string, ClaseCalendario>();
    clasesProgramaActual.forEach((clase) => map.set(clase.fecha, clase));
    return map;
  }, [clasesProgramaActual]);

  const actividadIP = useMemo(() => actividades.filter((actividad) => actividad.es_ip), [actividades]);

  const actividadesPorClase = useMemo(() => {
    const map = new Map<number, number>();
    actividadIP.forEach((actividad) => {
      if (!actividad.clase_calendario) return;
      map.set(actividad.clase_calendario, (map.get(actividad.clase_calendario) || 0) + 1);
    });
    return map;
  }, [actividadIP]);

  const selectedClass = useMemo(
    () => clasesProgramaActual.find((clase) => clase.id === selectedClassId) || null,
    [clasesProgramaActual, selectedClassId]
  );

  const handlePickDate = (isoDate: string) => {
    if (!programaActual) {
      toast.error('Primero debes tener programa del año actual.');
      return;
    }

    if (tiposIP.length === 0) {
      toast.error('Faltan tipos de actividad IP para poder cargar desde calendario.');
      return;
    }

    const clase = clasesMap.get(isoDate);
    if (!clase) {
      toast.info('Ese día no tiene clase registrada. Configura días de cursado y genera calendario.');
      return;
    }

    setSelectedClassId(clase.id);
  };

  const handleCreateActividadIP = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!programaActual || !selectedClassId) {
      toast.error('Selecciona una clase del calendario para cargar actividad IP.');
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

    setSaving(true);
    try {
      const response = await api.post<Actividad>('/actividades', {
        programa: programaActual.id,
        tipo_actividad: Number(formState.tipo_actividad),
        descripcion: formState.descripcion,
        horas: Number((minutos / 60).toFixed(2)),
        modalidad_trabajo: formState.modalidad_trabajo,
        unidad_ids: formState.unidad_ids,
        clase_calendario: selectedClassId,
        fecha_inicio_ta: null,
        fecha_fin_ta: null,
      });

      setActividades((prev) => [response.data, ...prev]);
      setFormState((prev) => ({
        ...prev,
        descripcion: '',
        minutos: '',
        unidad_ids: [],
      }));
      toast.success('Actividad IP creada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la actividad IP.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActividad = async (actividadId: number) => {
    const ok = window.confirm('¿Dar de baja esta actividad IP?');
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
      <SectionCard title="Planificación IP">
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

  const rows = actividadIP.map((actividad) => ({
    id: String(actividad.id),
    cells: [
      actividad.descripcion,
      `${Math.round(Number(actividad.horas) * 60)} min`,
      actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Equipo',
      actividad.clase_calendario
        ? clasesProgramaActual.find((clase) => clase.id === actividad.clase_calendario)?.fecha || '-'
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
          <h2>{selectedEspacioNombre || 'Espacio curricular'} | IP</h2>
          <p>Selecciona una clase existente y registra la actividad directamente sobre esa fecha.</p>
        </div>
        <div className="docente-hero-actions">
          <Link className="button button-ghost" to="/docente/planificacion-ta">
            Ir a planificación TA
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
          <p>{unidadesProgramaActual.length} unidades activas listas para asociar.</p>
        </div>
        <div className="context-card">
          <span className="context-label">Clase seleccionada</span>
          <strong>{selectedClass?.fecha || 'Sin clase seleccionada'}</strong>
          <p>{selectedClassId ? `${actividadesPorClase.get(selectedClassId) || 0} actividades IP ya vinculadas.` : 'Elige una fecha con clase para habilitar la carga.'}</p>
        </div>
        <div className="context-card">
          <span className="context-label">Carga IP</span>
          <strong>{actividadIP.length} actividades</strong>
          <p>{clasesProgramaActual.length} clases registradas en el calendario anual.</p>
        </div>
      </section>

      {tiposIP.length === 0 ? (
        <SectionCard title="Tipos IP faltantes">
          <p className="muted">
            No hay tipos de actividad IP configurados. Pide a administración que cargue al menos uno para habilitar esta pantalla.
          </p>
        </SectionCard>
      ) : null}

      <div className="planning-split">
        <SectionCard title="Calendario de clases">
          {clasesProgramaActual.length === 0 ? (
            <div className="status-note status-note-neutral">
              Aún no hay clases generadas para este programa. Configura días de cursado y luego vuelve a esta pantalla.
            </div>
          ) : null}

          <PlanningCalendar
            year={currentYear}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDate={handlePickDate}
            getCellMeta={(isoDate) => {
              const clase = clasesMap.get(isoDate);
              const isSelected = selectedClass?.fecha === isoDate;
              const hasActivities = clase ? (actividadesPorClase.get(clase.id) || 0) > 0 : false;

              return {
                className: `${clase ? 'has-class' : ''} ${isSelected ? 'is-selected' : ''}`.trim(),
                title: clase ? 'Seleccionar clase del día' : 'Sin clase registrada para ese día',
                showIcon: Boolean(clase),
                badge: hasActivities ? <span className="table-row-pill">IP</span> : null,
              };
            }}
            compactList={clasesProgramaActual.slice(0, 10).map((clase) => (
              <button
                className={`planning-compact-item ${selectedClassId === clase.id ? 'is-selected' : ''}`}
                type="button"
                key={clase.id}
                onClick={() => setSelectedClassId(clase.id)}
              >
                <span>{clase.fecha}</span>
                <span>{clase.estado}</span>
              </button>
            ))}
          />
        </SectionCard>

        <SectionCard title="Nueva actividad IP">
          <form className="form-grid-full planning-sticky-form" onSubmit={handleCreateActividadIP}>
            <div className={selectedClass ? 'status-note' : 'status-note status-note-neutral'}>
              {selectedClass
                ? `Clase lista para planificar: ${selectedClass.fecha}.`
                : 'Selecciona una fecha con clase en el calendario para habilitar la carga.'}
            </div>
            <PlanningActivityCommonFields
              tipos={tiposIP}
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
            />
            <button className="button" type="submit" disabled={saving || !selectedClassId || tiposIP.length === 0}>
              {saving ? 'Guardando...' : 'Crear actividad IP'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Actividades IP cargadas">
        {rows.length === 0 ? (
          <p className="muted">Aún no hay actividades IP cargadas.</p>
        ) : (
          <BasicTable columns={['Actividad', 'Duración', 'Modalidad', 'Fecha clase', 'Acciones']} rows={rows} />
        )}
      </SectionCard>
    </>
  );
}

export default DocentePlanificacionIP;
