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

const ipActivitySchema = z.object({
  tipo_actividad: z.string().min(1, 'Seleccioná un tipo de actividad'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  minutos: z.string()
    .min(1, 'Ingresa una duración en minutos')
    .refine((value) => Number(value) > 0, 'Ingresa una duración mayor a 0'),
  modalidad_trabajo: z.enum(['IND', 'EQU']),
  unidad_ids: z.array(z.number()).min(1, 'Seleccioná al menos una unidad'),
});

type IPActivityFormValues = z.infer<typeof ipActivitySchema>;

const defaultIPActivityValues: IPActivityFormValues = {
  tipo_actividad: '',
  descripcion: '',
  minutos: '',
  modalidad_trabajo: 'IND',
  unidad_ids: [],
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

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

  const clasesQuery = useQuery({
    queryKey: ['clases-calendario', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<ClaseCalendario>>('/clases-calendario', { params: { plan_estudio_ec_id: selectedPlanEcId } }).then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const actividadesQuery = useQuery({
    queryKey: ['actividades', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Actividad>>('/actividades', { params: { plan_estudio_ec_id: selectedPlanEcId } }).then((r) => normalizeCollection(r.data)),
    enabled: queryEnabled,
  });

  const programas = useMemo(() => programasQuery.data ?? [], [programasQuery.data]);
  const tipos = useMemo(() => tiposQuery.data ?? [], [tiposQuery.data]);
  const unidades = useMemo(() => unidadesQuery.data ?? [], [unidadesQuery.data]);
  const clases = useMemo(() => clasesQuery.data ?? [], [clasesQuery.data]);
  const actividades = useMemo(() => actividadesQuery.data ?? [], [actividadesQuery.data]);

  const loading = queryEnabled && (
    programasQuery.isLoading || tiposQuery.isLoading || unidadesQuery.isLoading || clasesQuery.isLoading || actividadesQuery.isLoading
  );

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IPActivityFormValues>({
    resolver: zodResolver(ipActivitySchema),
    defaultValues: defaultIPActivityValues,
  });

  const tipoActividadValue = watch('tipo_actividad');
  const minutosValue = watch('minutos');
  const modalidadTrabajoValue = watch('modalidad_trabajo');
  const unidadIdsValue = watch('unidad_ids');
  const descripcionValue = watch('descripcion');

  const programaActual = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const tiposIP = useMemo(() => tipos.filter((tipo) => tipo.tipo_dedicacion === 'IP'), [tipos]);

  useEffect(() => {
    if (!tipoActividadValue && tiposIP.length > 0) {
      const defaultTipo = tiposIP[0];
      if (!defaultTipo) return;
      setValue('tipo_actividad', String(defaultTipo.id));
    }
  }, [setValue, tipoActividadValue, tiposIP]);

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

  const handleCreateActividadIP = async (values: IPActivityFormValues) => {
    if (!programaActual || !selectedClassId) {
      toast.error('Seleccioná una clase del calendario para cargar actividad IP.');
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
        clase_calendario: selectedClassId,
        fecha_inicio_ta: null,
        fecha_fin_ta: null,
      });

      queryClient.invalidateQueries({ queryKey: ['actividades', selectedPlanEcId] });
      reset({
        ...defaultIPActivityValues,
        tipo_actividad: values.tipo_actividad,
        modalidad_trabajo: values.modalidad_trabajo,
        descripcion: '',
        minutos: '',
        unidad_ids: [],
      });
      toast.success('Actividad IP creada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la actividad IP.'));
    }
  };

  const handleDeleteActividad = async (actividadId: number) => {
    const ok = window.confirm('¿Dar de baja esta actividad IP?');
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
          <p>Seleccioná una clase existente y registra la actividad directamente sobre esa fecha.</p>
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
            <div className="generate-calendar-box">
              <p className="muted">
                Aún no hay clases generadas para este programa.
                {' '}Andá a <Link to="/docente/agenda-cursado">Agenda de cursado</Link> para
                configurar los días y generar el calendario.
              </p>
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
                ariaLabel: clase
                  ? `${isoDate}: clase registrada${hasActivities ? ' con actividades IP cargadas' : ''}`
                  : `${isoDate}: sin clase registrada`,
                ariaSelected: isSelected,
                disabled: !clase,
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
          <form className="form-grid-full planning-sticky-form" onSubmit={handleSubmit(handleCreateActividadIP)}>
            <div className={selectedClass ? 'status-note' : 'status-note status-note-neutral'}>
              {selectedClass
                ? `Clase lista para planificar: ${selectedClass.fecha}.`
                : 'Seleccioná una fecha con clase en el calendario para habilitar la carga.'}
            </div>
            <PlanningActivityCommonFields
              idPrefix="planificacion-ip"
              tipos={tiposIP}
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
            />
            <button className="button" type="submit" disabled={isSubmitting || !selectedClassId || tiposIP.length === 0}>
              {isSubmitting ? 'Guardando...' : 'Crear actividad IP'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Actividades IP cargadas">
        {rows.length === 0 ? (
          <p className="muted">Aún no hay actividades IP cargadas.</p>
        ) : (
          <BasicTable columns={['Actividad', 'Duración', 'Modalidad', 'Fecha clase', 'Acciones']} rows={rows} pageSize={10} />
        )}
      </SectionCard>
    </>
  );
}

export default DocentePlanificacionIP;
