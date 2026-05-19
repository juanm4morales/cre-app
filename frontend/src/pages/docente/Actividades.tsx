import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit,
  Eye,
  FilePlus2,
  ListFilter,
  Plus,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

const actividadSchema = z.object({
  programa: z.string().min(1, 'El programa es requerido'),
  tipo_actividad: z.string().optional(),
  modalidad_trabajo: z.enum(['IND', 'EQU']),
  unidad_ids: z.array(z.number()).min(1, 'Seleccioná al menos una unidad para la actividad'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  minutos: z.number().min(0, 'Los minutos deben ser mayor o igual a 0'),
  clase_calendario: z.string().optional(),
  fecha_inicio_ta: z.string().optional(),
  fecha_fin_ta: z.string().optional(),
});

type ActividadFormValues = z.infer<typeof actividadSchema>;

const ajusteSchema = z.object({
  tipo: z.enum(['REC', 'EXT']),
  motivo: z.string().min(1, 'El motivo es requerido'),
  horas_ip_extra: z.number().min(0),
  fecha_evento: z.string().optional(),
});

type AjusteFormValues = z.infer<typeof ajusteSchema>;

const extraClassSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  estado: z.enum(['PLAN', 'DICT', 'CANC']),
  observaciones: z.string().optional(),
});

type ExtraClassFormValues = z.infer<typeof extraClassSchema>;

type WorkflowMode = 'PLAN' | 'EXEC';
type ExecutionFilter =
  | 'PENDIENTES_REGISTRAR'
  | 'VENCIDAS'
  | 'NO_VENCIDAS'
  | 'HOY_ANTERIORES'
  | 'PENDIENTES'
  | 'TODAS'
  | 'INCIDENCIAS';

interface Actividad {
  id: number;
  programa: number;
  tipo_actividad: number;
  descripcion: string;
  horas: number;
  modalidad_trabajo: 'IND' | 'EQU';
  unidad_ids: number[];
  clase_calendario: number | null;
  fecha_inicio_ta: string | null;
  fecha_fin_ta: string | null;
  es_ip: boolean;
  es_ta: boolean;
  tiene_ajustes: boolean;
}

interface Programa {
  id: number;
  descripcion: string;
  anio_academico: number;
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
  observaciones: string;
}

interface DiaClase {
  id: number;
  programa: number;
  dia_semana: number;
}

interface ActividadAjuste {
  id: number;
  tipo: 'REC' | 'EXT';
  motivo: string;
  horas_ip_extra: number;
  fecha_evento: string | null;
  creado_por_username: string;
  creado_en: string;
}

interface CalendarGenerateResponse {
  programa_id: number;
  created: number;
  updated: number;
  skipped: number;
}

interface PaginatedResponse<T> {
  results: T[];
}

function normalizeCollection<T>(data: PaginatedResponse<T> | T[] | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CLASS_DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function formatClassDate(isoDate: string): string {
  return CLASS_DATE_FORMATTER.format(parseIsoLocalDate(isoDate));
}

function getClassStatusLabel(status: ClaseCalendario['estado']): string {
  if (status === 'DICT') return 'Dictada';
  if (status === 'CANC') return 'Suspendida';
  return 'Planificada';
}

function getClassTimingLabel(isoDate: string, todayIso: string): string {
  const diffDays = Math.round(
    (parseIsoLocalDate(isoDate).getTime() - parseIsoLocalDate(todayIso).getTime()) / DAY_IN_MS
  );

  if (diffDays === 0) return 'Hoy';
  if (diffDays === -1) return 'Vencida ayer';
  if (diffDays < 0) return `Vencida hace ${Math.abs(diffDays)} días`;
  if (diffDays === 1) return 'Mañana';
  return `En ${diffDays} días`;
}

function DocenteActividades() {
  const currentYear = new Date().getFullYear();
  const now = new Date();
  const navigate = useNavigate();
  const location = useLocation();

  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('PLAN');
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>('PENDIENTES_REGISTRAR');
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [tipos, setTipos] = useState<TipoActividad[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [clases, setClases] = useState<ClaseCalendario[]>([]);
  const [diasClase, setDiasClase] = useState<DiaClase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [selectedClassDate, setSelectedClassDate] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({ open: false });
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    actividad?: Actividad;
    loading: boolean;
    history: ActividadAjuste[];
  }>({
    open: false,
    loading: false,
    history: [],
  });
  const {
    register: registerAjuste,
    handleSubmit: handleAjusteSubmit,
    formState: { errors: errorsAjuste },
    reset: resetAjuste,
  } = useForm<AjusteFormValues>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: {
      tipo: 'REC',
      motivo: '',
      horas_ip_extra: 0,
      fecha_evento: '',
    },
  });

  const {
    register: registerExtraClass,
    handleSubmit: handleExtraClassSubmit,
    formState: { errors: errorsExtraClass },
    reset: resetExtraClass,
    setValue: setExtraClassValue,
  } = useForm<ExtraClassFormValues>({
    resolver: zodResolver(extraClassSchema),
    defaultValues: {
      fecha: '',
      estado: 'PLAN',
      observaciones: '',
    },
  });

  const [editing, setEditing] = useState<Actividad | null>(null);

  const {
    register: registerActividad,
    handleSubmit: handleActividadSubmit,
    formState: { errors: errorsActividad },
    reset: resetActividadForm,
    watch: watchActividad,
    setValue: setActividadValue,
  } = useForm<ActividadFormValues>({
    resolver: zodResolver(actividadSchema),
    defaultValues: {
      programa: '',
      tipo_actividad: '',
      modalidad_trabajo: 'IND',
      unidad_ids: [],
      descripcion: '',
      minutos: 0,
      clase_calendario: '',
      fecha_inicio_ta: '',
      fecha_fin_ta: '',
    },
  });

  const watchPrograma = watchActividad('programa');
  const watchTipoActividad = watchActividad('tipo_actividad');

  const [calendarGenerateState, setCalendarGenerateState] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    sobrescribir: false,
    loading: false,
  });
  const [classNotesDraft, setClassNotesDraft] = useState<Record<number, string>>({});
  const [updatingClassId, setUpdatingClassId] = useState<number | null>(null);
  const [extraClassLoading, setExtraClassLoading] = useState(false);

  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  useEffect(() => {
    if (location.pathname.endsWith('/ejecucion-ip')) {
      setWorkflowMode('EXEC');
      return;
    }

    if (location.pathname.endsWith('/planificacion')) {
      setWorkflowMode('PLAN');
      return;
    }

    if (location.pathname.endsWith('/actividades')) {
      navigate('/docente/planificacion', { replace: true });
    }
  }, [location.pathname, navigate]);

  const loadData = useCallback(async (background = false) => {
    if (!selectedPlanEcId) {
      setLoading(false);
      return;
    }

    if (!background) {
      setLoading(true);
    }

    try {
      const [actividadRes, programaRes, tipoRes, unidadRes, claseRes, diasClaseRes] = await Promise.all([
        api.get<PaginatedResponse<Actividad>>('/actividades', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<Programa>>('/programas', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad'),
        api.get<PaginatedResponse<Unidad>>('/unidades', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<ClaseCalendario>>('/clases-calendario', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<DiaClase>>('/dias-clase', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
      ]);

      setActividades(normalizeCollection(actividadRes.data));
      setProgramas(normalizeCollection(programaRes.data));
      setTipos(normalizeCollection(tipoRes.data));
      setUnidades(normalizeCollection(unidadRes.data));
      setClases(normalizeCollection(claseRes.data));
      setDiasClase(normalizeCollection(diasClaseRes.data));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar actividades para el espacio seleccionado.'));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [selectedPlanEcId]);

  useEffect(() => {
    if (!selectedPlanEcId) {
      setLoading(false);
      return;
    }

    void loadData();
  }, [selectedPlanEcId, navigate, loadData]);

  useApiAutoRefresh(() => loadData(true), [selectedPlanEcId], { enabled: Boolean(selectedPlanEcId) });

  const programaLookup = useMemo(() => {
    const map = new Map<number, string>();
    programas.forEach((programa) => map.set(programa.id, programa.descripcion || `Programa ${programa.id}`));
    return map;
  }, [programas]);

  const tipoLookup = useMemo(() => {
    const map = new Map<number, string>();
    tipos.forEach((tipo) => map.set(tipo.id, `${tipo.nombre} (${tipo.tipo_dedicacion})`));
    return map;
  }, [tipos]);

  const unidadLookup = useMemo(() => {
    const map = new Map<number, string>();
    unidades.forEach((unidad) => map.set(unidad.id, `U${unidad.numero}: ${unidad.descripcion}`));
    return map;
  }, [unidades]);

  const claseLookup = useMemo(() => {
    const map = new Map<number, ClaseCalendario>();
    clases.forEach((clase) => map.set(clase.id, clase));
    return map;
  }, [clases]);

  const currentYearProgram = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const activeProgramId = Number(watchPrograma || currentYearProgram?.id || 0);

  const unidadesProgramaActivo = useMemo(
    () => unidades.filter((unidad) => unidad.programa === activeProgramId).sort((a, b) => a.numero - b.numero),
    [unidades, activeProgramId]
  );

  const clasesProgramaActivo = useMemo(
    () => clases.filter((clase) => clase.programa === activeProgramId),
    [clases, activeProgramId]
  );

  const classesSortedByDate = useMemo(
    () => [...clasesProgramaActivo].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [clasesProgramaActivo]
  );

  const firstIpType = useMemo(() => tipos.find((tipo) => tipo.tipo_dedicacion === 'IP') || null, [tipos]);
  const firstTaType = useMemo(() => tipos.find((tipo) => tipo.tipo_dedicacion === 'TA') || null, [tipos]);

  const selectedType = useMemo(
    () => tipos.find((tipo) => String(tipo.id) === watchTipoActividad) || null,
    [tipos, watchTipoActividad]
  );
  const isIpForm = selectedType?.tipo_dedicacion === 'IP';

  const ipActivities = useMemo(() => actividades.filter((actividad) => actividad.es_ip), [actividades]);
  const taActivities = useMemo(() => actividades.filter((actividad) => actividad.es_ta), [actividades]);

  const ipActivitiesByClass = useMemo(() => {
    const map = new Map<number, Actividad[]>();
    ipActivities.forEach((actividad) => {
      if (!actividad.clase_calendario) return;
      const current = map.get(actividad.clase_calendario) || [];
      current.push(actividad);
      map.set(actividad.clase_calendario, current);
    });
    return map;
  }, [ipActivities]);

  const executionRows = useMemo(() => {
    const todayIso = toLocalIsoDate(new Date());
    const withRelated = classesSortedByDate.map((clase) => ({
      clase,
      actividades: ipActivitiesByClass.get(clase.id) || [],
    }));

    let filteredRows = withRelated;

    if (executionFilter === 'PENDIENTES_REGISTRAR') {
      filteredRows = withRelated.filter((item) => item.clase.estado === 'PLAN' && item.clase.fecha <= todayIso);
    } else if (executionFilter === 'VENCIDAS') {
      filteredRows = withRelated.filter((item) => item.clase.estado === 'PLAN' && item.clase.fecha < todayIso);
    } else if (executionFilter === 'NO_VENCIDAS') {
      filteredRows = withRelated.filter((item) => item.clase.estado === 'PLAN' && item.clase.fecha >= todayIso);
    } else if (executionFilter === 'HOY_ANTERIORES') {
      filteredRows = withRelated.filter((item) => item.clase.fecha <= todayIso);
    } else if (executionFilter === 'PENDIENTES') {
      filteredRows = withRelated.filter((item) => item.clase.estado === 'PLAN');
    } else if (executionFilter === 'INCIDENCIAS') {
      filteredRows = withRelated.filter(
        (item) => item.clase.estado === 'CANC' || (item.clase.observaciones || '').trim().length > 0
      );
    }

    return [...filteredRows].sort((a, b) => {
      const aIsCurrentOrPast = a.clase.fecha <= todayIso;
      const bIsCurrentOrPast = b.clase.fecha <= todayIso;

      if (aIsCurrentOrPast && bIsCurrentOrPast) {
        return b.clase.fecha.localeCompare(a.clase.fecha);
      }

      if (aIsCurrentOrPast) return -1;
      if (bIsCurrentOrPast) return 1;

      return a.clase.fecha.localeCompare(b.clase.fecha);
    });
  }, [classesSortedByDate, ipActivitiesByClass, executionFilter]);

  const executionStats = useMemo(() => {
    const todayIso = toLocalIsoDate(new Date());
    const total = classesSortedByDate.length;
    const dictadas = classesSortedByDate.filter((clase) => clase.estado === 'DICT').length;
    const canceladas = classesSortedByDate.filter((clase) => clase.estado === 'CANC').length;
    const pendientes = classesSortedByDate.filter((clase) => clase.estado === 'PLAN').length;
    const pendientesRegistrar = classesSortedByDate.filter(
      (clase) => clase.estado === 'PLAN' && clase.fecha <= todayIso
    ).length;
    const vencidas = classesSortedByDate.filter((clase) => clase.estado === 'PLAN' && clase.fecha < todayIso).length;
    const noVencidas = classesSortedByDate.filter((clase) => clase.estado === 'PLAN' && clase.fecha >= todayIso).length;
    const hastaHoy = classesSortedByDate.filter((clase) => clase.fecha <= todayIso).length;
    const incidencias = classesSortedByDate.filter(
      (clase) => clase.estado === 'CANC' || (clase.observaciones || '').trim().length > 0
    ).length;
    return { total, dictadas, canceladas, pendientes, pendientesRegistrar, vencidas, noVencidas, hastaHoy, incidencias };
  }, [classesSortedByDate]);

  const latestDueClass = useMemo(() => {
    const todayIso = toLocalIsoDate(new Date());
    return [...classesSortedByDate]
      .filter((clase) => clase.fecha <= todayIso)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
  }, [classesSortedByDate]);

  const executionFilterOptions = useMemo<Array<{ id: ExecutionFilter; label: string; count: number; help: string }>>(
    () => [
      {
        id: 'PENDIENTES_REGISTRAR',
        label: 'Para registrar',
        count: executionStats.pendientesRegistrar,
        help: 'Planificadas hasta hoy',
      },
      {
        id: 'VENCIDAS',
        label: 'Vencidas',
        count: executionStats.vencidas,
        help: 'Antes de hoy sin cierre',
      },
      {
        id: 'NO_VENCIDAS',
        label: 'No vencidas',
        count: executionStats.noVencidas,
        help: 'Hoy o futuras pendientes',
      },
      {
        id: 'HOY_ANTERIORES',
        label: 'Hasta hoy',
        count: executionStats.hastaHoy,
        help: 'Historial y jornada actual',
      },
      {
        id: 'PENDIENTES',
        label: 'Pendientes',
        count: executionStats.pendientes,
        help: 'Todas las planificadas',
      },
      {
        id: 'INCIDENCIAS',
        label: 'Incidencias',
        count: executionStats.incidencias,
        help: 'Suspendidas u observadas',
      },
      {
        id: 'TODAS',
        label: 'Todas',
        count: executionStats.total,
        help: 'Calendario completo',
      },
    ],
    [executionStats]
  );

  useEffect(() => {
    if (watchPrograma || !currentYearProgram) {
      return;
    }
    setActividadValue('programa', String(currentYearProgram.id));
    if (!watchTipoActividad) {
      setActividadValue('tipo_actividad', String(firstTaType?.id || ''));
    }
  }, [currentYearProgram, watchPrograma, watchTipoActividad, firstTaType, setActividadValue]);

  useEffect(() => {
    const monthStart = new Date(currentYear, calendarMonth, 1);
    const monthEnd = new Date(currentYear, calendarMonth + 1, 0);
    setCalendarGenerateState((prev) => {
      if (prev.fecha_desde || prev.fecha_hasta) {
        return prev;
      }
      return {
        ...prev,
        fecha_desde: dateToIso(monthStart),
        fecha_hasta: dateToIso(monthEnd),
      };
    });
  }, [currentYear, calendarMonth]);

  useEffect(() => {
    if (!currentYearProgram) return;
    setExtraClassValue('fecha', dateToIso(new Date()));
  }, [currentYearProgram, setExtraClassValue]);

  const refreshCalendarClasses = async () => {
    const classesResponse = await api.get<PaginatedResponse<ClaseCalendario>>('/clases-calendario', {
      params: { plan_estudio_ec_id: selectedPlanEcId },
    });
    setClases(classesResponse.data.results);
  };

  const handleGenerateCalendarRange = async () => {
    if (!currentYearProgram) {
      return;
    }
    if (!calendarGenerateState.fecha_desde || !calendarGenerateState.fecha_hasta) {
      toast.error('Debes indicar fecha desde y fecha hasta.');
      return;
    }

    setCalendarGenerateState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await api.post<CalendarGenerateResponse>('/clases-calendario/generar-rango', {
        programa_id: currentYearProgram.id,
        fecha_desde: calendarGenerateState.fecha_desde,
        fecha_hasta: calendarGenerateState.fecha_hasta,
        sobrescribir: calendarGenerateState.sobrescribir,
      });

      await refreshCalendarClasses();

      const { created, updated, skipped } = response.data;
      toast.success(`Calendario generado: ${created} nuevas, ${updated} actualizadas, ${skipped} omitidas.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo generar el calendario por rango.'));
    } finally {
      setCalendarGenerateState((prev) => ({ ...prev, loading: false }));
    }
  };

  const resetForm = () => {
    resetActividadForm({
      programa: currentYearProgram ? String(currentYearProgram.id) : '',
      tipo_actividad: firstTaType ? String(firstTaType.id) : '',
      modalidad_trabajo: 'IND',
      unidad_ids: [],
      descripcion: '',
      minutos: 0,
      clase_calendario: '',
      fecha_inicio_ta: '',
      fecha_fin_ta: '',
    });
    setEditing(null);
    setViewOnly(false);
    setShowForm(false);
    setSelectedClassDate(null);
  };

  const onSubmitActividad = async (data: ActividadFormValues) => {
    const minutos = Number(data.minutos);

    if (isIpForm && !data.clase_calendario) {
      toast.error('Las actividades IP deben vincularse a una clase del calendario.');
      return;
    }

    if (!isIpForm && data.fecha_inicio_ta && data.fecha_fin_ta && data.fecha_inicio_ta > data.fecha_fin_ta) {
      toast.error('La fecha fin TA no puede ser anterior a la fecha inicio.');
      return;
    }

    const payload = {
      programa: Number(data.programa),
      tipo_actividad: data.tipo_actividad ? Number(data.tipo_actividad) : undefined,
      modalidad_trabajo: data.modalidad_trabajo,
      unidad_ids: data.unidad_ids,
      descripcion: data.descripcion,
      horas: Number((minutos / 60).toFixed(2)),
      clase_calendario: isIpForm && data.clase_calendario ? Number(data.clase_calendario) : null,
      fecha_inicio_ta: !isIpForm && data.fecha_inicio_ta ? data.fecha_inicio_ta : null,
      fecha_fin_ta: !isIpForm && data.fecha_fin_ta ? data.fecha_fin_ta : null,
    };

    if (editing) {
      try {
        const response = await api.patch<Actividad>(`/actividades/${editing.id}`, payload);
        setActividades((prev) => prev.map((item) => (item.id === editing.id ? response.data : item)));
        toast.success('Actividad actualizada correctamente.');
        resetForm();
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo actualizar la actividad.'));
      }
      return;
    }

    try {
      const response = await api.post<Actividad>('/actividades', payload);
      setActividades((prev) => [response.data, ...prev]);
      toast.success('Actividad creada correctamente.');
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la actividad.'));
    }
  };

  const openCreateForm = () => {
    if (unidadesProgramaActivo.length === 0) {
      toast.error('No puedes crear actividades: el programa actual no tiene unidades activas.');
      return;
    }
    setShowForm(true);
    setEditing(null);
    setViewOnly(false);
  };

  const handleCalendarPick = (classDate: string) => {
    if (!currentYearProgram) {
      toast.error('No hay programa activo del año actual para este espacio curricular.');
      return;
    }

    if (!firstIpType) {
      toast.error('No hay tipos de actividad IP configurados. Contacta a un administrador para habilitarlos.');
      return;
    }

    const matchedClass = clases.find(
      (clase) => clase.programa === currentYearProgram.id && clase.fecha === classDate
    );

    if (!matchedClass) {
      toast.error('Ese dia no tiene clase calendarizada.');
      return;
    }

    setSelectedClassDate(classDate);
    setShowForm(true);
    setEditing(null);
    setViewOnly(false);
    resetActividadForm({
      programa: String(currentYearProgram.id),
      tipo_actividad: String(firstIpType.id),
      clase_calendario: String(matchedClass.id),
      modalidad_trabajo: 'IND',
      unidad_ids: [],
      descripcion: '',
      minutos: 0,
      fecha_inicio_ta: '',
      fecha_fin_ta: '',
    });
  };

  const handleEdit = (actividad: Actividad) => {
    setEditing(actividad);
    setShowForm(true);
    setViewOnly(false);
    resetActividadForm({
      programa: String(actividad.programa),
      tipo_actividad: String(actividad.tipo_actividad),
      modalidad_trabajo: actividad.modalidad_trabajo,
      unidad_ids: actividad.unidad_ids || [],
      descripcion: actividad.descripcion,
      minutos: Math.round(Number(actividad.horas) * 60),
      clase_calendario: actividad.clase_calendario ? String(actividad.clase_calendario) : '',
      fecha_inicio_ta: actividad.fecha_inicio_ta || '',
      fecha_fin_ta: actividad.fecha_fin_ta || '',
    });
  };

  const handleView = (actividad: Actividad) => {
    setEditing(actividad);
    setShowForm(true);
    setViewOnly(true);
    resetActividadForm({
      programa: String(actividad.programa),
      tipo_actividad: String(actividad.tipo_actividad),
      modalidad_trabajo: actividad.modalidad_trabajo,
      unidad_ids: actividad.unidad_ids || [],
      descripcion: actividad.descripcion,
      minutos: Math.round(Number(actividad.horas) * 60),
      clase_calendario: actividad.clase_calendario ? String(actividad.clase_calendario) : '',
      fecha_inicio_ta: actividad.fecha_inicio_ta || '',
      fecha_fin_ta: actividad.fecha_fin_ta || '',
    });
  };

  const handleDelete = async (actividadId: number) => {
    setDeleteConfirm({ open: true, id: actividadId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await api.delete(`/actividades/${deleteConfirm.id}`);
      setActividades((prev) => prev.filter((item) => item.id !== deleteConfirm.id));
      toast.success('Actividad dada de baja correctamente.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo dar de baja la actividad.'));
    } finally {
      setDeleteConfirm({ open: false });
    }
  };

  const openAdjustModal = async (actividad: Actividad) => {
    setAdjustModal({ open: true, actividad, loading: true, history: [] });
    resetAjuste({ tipo: 'REC', motivo: '', horas_ip_extra: 0, fecha_evento: '' });
    try {
      const response = await api.get<ActividadAjuste[]>(`/actividades/${actividad.id}/ajustes`);
      setAdjustModal({ open: true, actividad, loading: false, history: response.data });
    } catch (error) {
      setAdjustModal((prev) => ({ ...prev, loading: false }));
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el historial de ajustes.'));
    }
  };

  const handleAjusteSubmitAction = async (data: AjusteFormValues) => {
    if (!adjustModal.actividad) return;

    const payload = {
      tipo: data.tipo,
      motivo: data.motivo,
      horas_ip_extra: data.horas_ip_extra,
      fecha_evento: data.fecha_evento || null,
    };

    try {
      const response = await api.post<ActividadAjuste>(
        `/actividades/${adjustModal.actividad.id}/ajustes`,
        payload
      );
      setAdjustModal((prev) => ({
        ...prev,
        history: [response.data, ...prev.history],
      }));
      resetAjuste({ tipo: 'REC', motivo: '', horas_ip_extra: 0, fecha_evento: '' });
      setActividades((prev) =>
        prev.map((item) =>
          item.id === adjustModal.actividad?.id ? { ...item, tiene_ajustes: true } : item
        )
      );
      toast.success('Ajuste registrado correctamente.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar el ajuste.'));
    }
  };

  const handleUpdateClassStatus = async (clase: ClaseCalendario, estado: 'PLAN' | 'DICT' | 'CANC') => {
    setUpdatingClassId(clase.id);
    try {
      const response = await api.patch<ClaseCalendario>(`/clases-calendario/${clase.id}`, {
        estado,
        observaciones: classNotesDraft[clase.id] ?? clase.observaciones,
      });
      setClases((prev) => prev.map((item) => (item.id === clase.id ? response.data : item)));
      toast.success('Estado de clase actualizado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar el estado de la clase.'));
    } finally {
      setUpdatingClassId(null);
    }
  };

  const handleSaveClassNote = async (clase: ClaseCalendario) => {
    setUpdatingClassId(clase.id);
    try {
      const response = await api.patch<ClaseCalendario>(`/clases-calendario/${clase.id}`, {
        observaciones: classNotesDraft[clase.id] ?? clase.observaciones,
      });
      setClases((prev) => prev.map((item) => (item.id === clase.id ? response.data : item)));
      toast.success('Observacion guardada.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar la observacion.'));
    } finally {
      setUpdatingClassId(null);
    }
  };

  const handleCreateExtraClassAction = async (data: ExtraClassFormValues) => {
    if (!currentYearProgram) {
      toast.error('Debes tener un programa activo para agregar una clase extra.');
      return;
    }

    setExtraClassLoading(true);
    try {
      const response = await api.post<ClaseCalendario>('/clases-calendario', {
        programa: currentYearProgram.id,
        fecha: data.fecha,
        estado: data.estado,
        observaciones: data.observaciones,
      });
      setClases((prev) => [...prev, response.data]);
      resetExtraClass({
        fecha: data.fecha,
        estado: 'PLAN',
        observaciones: '',
      });
      toast.success('Clase extra agregada al calendario.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la clase extra.'));
    } finally {
      setExtraClassLoading(false);
    }
  };

  const classesByDate = useMemo(() => {
    const map = new Map<string, ClaseCalendario>();
    clasesProgramaActivo.forEach((clase) => map.set(clase.fecha, clase));
    return map;
  }, [clasesProgramaActivo]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, calendarMonth, 1);
    const lastDay = new Date(currentYear, calendarMonth + 1, 0);
    const mondayBasedStart = (firstDay.getDay() + 6) % 7;
    const cells: Array<{ date: Date | null; iso: string | null }> = [];

    for (let i = 0; i < mondayBasedStart; i += 1) {
      cells.push({ date: null, iso: null });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(currentYear, calendarMonth, day);
      cells.push({ date, iso: dateToIso(date) });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, iso: null });
    }

    return cells;
  }, [currentYear, calendarMonth]);

  const rows = actividades.map((actividad) => {
    const linkedClass = actividad.clase_calendario ? claseLookup.get(actividad.clase_calendario) : null;
    return {
      id: String(actividad.id),
      cells: [
        actividad.descripcion,
        tipoLookup.get(actividad.tipo_actividad) || `Tipo ${actividad.tipo_actividad}`,
        `${Math.round(Number(actividad.horas) * 60)} min`,
        actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Equipo',
        (actividad.unidad_ids || [])
          .map((id) => unidadLookup.get(id) || `Unidad ${id}`)
          .join(', '),
        linkedClass ? linkedClass.fecha : actividad.fecha_inicio_ta ? `${actividad.fecha_inicio_ta} a ${actividad.fecha_fin_ta || '-'}` : '-',
        actividad.tiene_ajustes ? 'Si' : 'No',
        <div className="table-actions" key={`actions-${actividad.id}`}>
          <button className="icon-button" type="button" onClick={() => handleView(actividad)} title="Ver">
            <Eye size={18} />
          </button>
          <button className="icon-button" type="button" onClick={() => handleEdit(actividad)} title="Editar">
            <Edit size={18} />
          </button>
          <button
            className="icon-button icon-button-warn"
            type="button"
            onClick={() => openAdjustModal(actividad)}
            title="Recuperar o extender"
          >
            <Repeat2 size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => handleDelete(actividad.id)}
            title="Dar de baja"
          >
            <Trash2 size={18} />
          </button>
        </div>,
      ],
    };
  });

  const monthLabel = new Date(currentYear, calendarMonth, 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const allowedWeekDays = useMemo(() => {
    const ids = new Set<number>();
    diasClase
      .filter((dia) => dia.programa === activeProgramId)
      .forEach((dia) => ids.add(dia.dia_semana));
    return ids;
  }, [diasClase, activeProgramId]);

  if (!selectedPlanEcId) {
    return (
      <SectionCard title="Selección de espacio curricular">
        <p className="muted">
          Usa el desplegable superior para elegir un espacio curricular y continuar con la planificación.
        </p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard title="Actividades">
        <p className="muted">Cargando panel docente...</p>
      </SectionCard>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Confirmar baja"
        message="Esta actividad se dara de baja y dejara de aparecer en tu gestion, pero no se eliminara definitivamente de la base de datos."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm({ open: false })}
      />

      {adjustModal.open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal modal-large">
            <div className="modal-header">
              <h3>Recuperar o extender actividad</h3>
            </div>
            <div className="modal-body">
              <p className="mt-0">
                Registra recuperaciones o extensiones por tiempo insuficiente. Esta bitacora queda en historial.
              </p>
              <form onSubmit={handleAjusteSubmit(handleAjusteSubmitAction)}>
                <div className="form-grid">
                  <div>
                    <select
                      className={`select ${errorsAjuste.tipo ? 'input-error' : ''}`}
                      aria-invalid={errorsAjuste.tipo ? 'true' : 'false'}
                      {...registerAjuste('tipo')}
                    >
                      <option value="REC">Recuperación</option>
                      <option value="EXT">Extension</option>
                    </select>
                    {errorsAjuste.tipo && (
                      <span className="error-text" role="alert">{errorsAjuste.tipo.message}</span>
                    )}
                  </div>
                  <div>
                    <input
                      className={`input ${errorsAjuste.horas_ip_extra ? 'input-error' : ''}`}
                      type="number"
                      min={0}
                      step={0.25}
                      placeholder="Horas IP extra"
                      aria-invalid={errorsAjuste.horas_ip_extra ? 'true' : 'false'}
                      {...registerAjuste('horas_ip_extra', { valueAsNumber: true })}
                    />
                    {errorsAjuste.horas_ip_extra && (
                      <span className="error-text" role="alert">{errorsAjuste.horas_ip_extra.message}</span>
                    )}
                  </div>
                  <div>
                    <input
                      className={`input ${errorsAjuste.fecha_evento ? 'input-error' : ''}`}
                      type="date"
                      aria-invalid={errorsAjuste.fecha_evento ? 'true' : 'false'}
                      {...registerAjuste('fecha_evento')}
                    />
                    {errorsAjuste.fecha_evento && (
                      <span className="error-text" role="alert">{errorsAjuste.fecha_evento.message}</span>
                    )}
                  </div>
                  <div>
                    <input
                      className={`input ${errorsAjuste.motivo ? 'input-error' : ''}`}
                      type="text"
                      placeholder="Motivo del ajuste"
                      aria-invalid={errorsAjuste.motivo ? 'true' : 'false'}
                      {...registerAjuste('motivo')}
                    />
                    {errorsAjuste.motivo && (
                      <span className="error-text" role="alert">{errorsAjuste.motivo.message}</span>
                    )}
                  </div>
                </div>
                <div className="form-actions mt-2" style={{ marginBottom: '1.5rem' }}>
                  <button className="button" type="submit">
                    Registrar ajuste
                  </button>
                </div>
              </form>
              <h4 className="mb-2">Historial</h4>
              {adjustModal.loading ? (
                <p className="muted">Cargando historial...</p>
              ) : adjustModal.history.length === 0 ? (
                <p className="muted">Aún no hay ajustes registrados para esta actividad.</p>
              ) : (
                <div className="adjust-list">
                  {adjustModal.history.map((item) => (
                    <div className="adjust-item" key={item.id}>
                      <strong>{item.tipo === 'REC' ? 'Recuperación' : 'Extension'}</strong>
                      <span>{item.motivo}</span>
                      <span>
                        Horas extra: {item.horas_ip_extra} | Fecha: {item.fecha_evento || '-'} | Por: {item.creado_por_username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setAdjustModal({ open: false, loading: false, history: [] })}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="page-header docente-hero">
        <div>
          <p className="eyebrow">Gestión de actividades</p>
          <h2>
            {selectedEspacioNombre || 'Gestor docente'}
            {workflowMode === 'PLAN' ? ' | Planificación' : ' | Seguimiento de clases IP'}
          </h2>
          {workflowMode === 'PLAN' ? (
            <p>Organiza actividades IP/TA y el calendario de clases del cursado.</p>
          ) : (
            <p>Registra lo ocurrido en cada clase IP, con estado real y observaciones.</p>
          )}
        </div>
        <div className="docente-hero-actions">
          {workflowMode === 'PLAN' ? (
            <button className="button button-ghost" type="button" onClick={() => navigate('/docente/ejecucion-ip')}>
              Ir a seguimiento de clases IP
            </button>
          ) : (
            <button className="button button-ghost" type="button" onClick={() => navigate('/docente/planificacion')}>
              Volver a planificación
            </button>
          )}
        </div>
      </section>

      {!currentYearProgram ? (
        <SectionCard title={`Programa ${currentYear} pendiente`}>
          <p className="muted">
            Para crear actividades primero debes crear o actualizar el programa del anio actual y sus unidades.
          </p>
          <div className="form-actions mt-2">
            <button className="button" type="button" onClick={() => navigate('/docente/programas')}>
              Ir a programa actual
            </button>
          </div>
        </SectionCard>
      ) : workflowMode === 'PLAN' ? (
        <>
          {unidadesProgramaActivo.length === 0 ? (
            <SectionCard title="Unidades requeridas">
              <p className="muted">
                Este programa no tiene unidades activas. Para cargar actividades debes agregar al menos una unidad.
              </p>
              <div className="form-actions mt-2">
                <button className="button" type="button" onClick={() => navigate('/docente/programas')}>
                  Ir a programas y agregar unidades
                </button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Calendario de clases IP">
              {!firstIpType ? (
                <div className="status-note status-note-warning mb-2">
                  No hay tipos de actividad IP disponibles. Hasta que administración cargue al menos uno, no podrás crear actividades desde el calendario.
                </div>
              ) : null}

              <div className="planning-context-grid mb-3">
                <div className="context-card">
                  <span className="context-label">Programa activo</span>
                  <strong>{currentYearProgram?.descripcion || `Programa ${currentYear}`}</strong>
                  <p>{unidadesProgramaActivo.length} unidades activas para asociar actividades.</p>
                </div>
                <div className="context-card">
                  <span className="context-label">Dias configurados</span>
                  <strong>{allowedWeekDays.size}</strong>
                  <p>El calendario resalta solo los días habilitados para cursado.</p>
                </div>
                <div className="context-card">
                  <span className="context-label">Clases del rango</span>
                  <strong>{classesSortedByDate.length}</strong>
                  <p>Genera o actualiza clases dentro del período que definas abajo.</p>
                </div>
              </div>

              <div className="form-row mb-2">
                <label className="grid-label">
                  <span className="muted">Desde</span>
                  <input
                    className="input"
                    type="date"
                    value={calendarGenerateState.fecha_desde}
                    onChange={(event) =>
                      setCalendarGenerateState((prev) => ({ ...prev, fecha_desde: event.target.value }))
                    }
                  />
                </label>
                <label className="grid-label">
                  <span className="muted">Hasta</span>
                  <input
                    className="input"
                    type="date"
                    value={calendarGenerateState.fecha_hasta}
                    onChange={(event) =>
                      setCalendarGenerateState((prev) => ({ ...prev, fecha_hasta: event.target.value }))
                    }
                  />
                </label>
                <label className="muted flex-row gap-1">
                  <input
                    type="checkbox"
                    checked={calendarGenerateState.sobrescribir}
                    onChange={(event) =>
                      setCalendarGenerateState((prev) => ({ ...prev, sobrescribir: event.target.checked }))
                    }
                  />
                  Actualizar clases ya existentes
                </label>
                <button
                  className="button"
                  type="button"
                  onClick={handleGenerateCalendarRange}
                  disabled={calendarGenerateState.loading}
                >
                  {calendarGenerateState.loading ? 'Generando...' : 'Generar calendario'}
                </button>
              </div>

              <div className="calendar-toolbar">
                <button className="button button-ghost" type="button" onClick={() => setCalendarMonth((m) => Math.max(0, m - 1))}>
                  Mes anterior
                </button>
                <strong>{monthLabel}</strong>
                <button className="button button-ghost" type="button" onClick={() => setCalendarMonth((m) => Math.min(11, m + 1))}>
                  Mes siguiente
                </button>
              </div>

              <div className="calendar-scroll-wrap">
                <div className="calendar-grid">
                  {DAY_NAMES.map((day) => (
                    <div className="calendar-head" key={day}>
                      {day}
                    </div>
                  ))}
                  {calendarCells.map((cell, index) => {
                  if (!cell.iso || !cell.date) {
                    return <div className="calendar-cell muted-cell" key={`empty-${index}`} />;
                  }

                  const cellIso = cell.iso; // TypeScript guard
                  const clase = classesByDate.get(cellIso);
                  const weekday = (cell.date.getDay() + 6) % 7;
                  const isClassDay = allowedWeekDays.has(weekday);
                  const isSelected = selectedClassDate === cellIso;

                  return (
                    <button
                      className={`calendar-cell ${isClassDay ? 'is-class-day' : ''} ${clase ? 'has-class' : ''} ${isSelected ? 'is-selected' : ''}`}
                      type="button"
                      key={cellIso}
                      onClick={() => handleCalendarPick(cellIso)}
                      disabled={!clase || !firstIpType}
                      aria-current={cellIso === toLocalIsoDate(new Date()) ? 'date' : undefined}
                      title={
                        !clase
                          ? 'No hay clase registrada en esta fecha'
                          : !firstIpType
                            ? 'Falta configurar al menos un tipo de actividad IP'
                            : 'Cargar actividad IP sobre esta clase'
                      }
                    >
                      <span className="calendar-day-number">{cell.date.getDate()}</span>
                      {clase ? (
                        <span className="calendar-cell-icon" aria-hidden="true">
                          <CalendarDays size={14} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Actividades planificadas"
            action={
              <button className="button" type="button" onClick={openCreateForm}>
                <Plus size={18} className="mr-2" />
                Nueva actividad
              </button>
            }
          >
            <div className="docente-kpi-grid">
              <div className="docente-kpi">
                <h4>IP planificadas</h4>
                <strong>{ipActivities.length}</strong>
              </div>
              <div className="docente-kpi">
                <h4>TA planificadas</h4>
                <strong>{taActivities.length}</strong>
              </div>
              <div className="docente-kpi">
                <h4>Con ajustes</h4>
                <strong>{actividades.filter((item) => item.tiene_ajustes).length}</strong>
              </div>
            </div>

            <BasicTable
              columns={['Actividad', 'Tipo', 'Duracion', 'Modalidad', 'Unidades', 'Agenda', 'Ajustes', 'Acciones']}
              rows={rows}
              pageSize={10}
            />
          </SectionCard>

          {showForm && currentYearProgram ? (
            <SectionCard title={viewOnly ? 'Detalle de actividad' : editing ? 'Editar actividad' : 'Nueva actividad'}>
              <form className="form-grid-full" onSubmit={handleActividadSubmit(onSubmitActividad)}>
                <div className="form-row">
                  <div>
                    <select
                      className={`select ${errorsActividad.programa ? 'input-error' : ''}`}
                      disabled={Boolean(editing) || viewOnly}
                      aria-invalid={errorsActividad.programa ? 'true' : 'false'}
                      {...registerActividad('programa')}
                    >
                      <option value="">Programa</option>
                      {programas.map((programa) => (
                        <option key={programa.id} value={programa.id}>
                          {programa.descripcion || `Programa ${programa.id}`}
                        </option>
                      ))}
                    </select>
                    {errorsActividad.programa && (
                      <span className="error-text" role="alert">{errorsActividad.programa.message}</span>
                    )}
                  </div>
                  <div>
                    <select
                      className="select"
                      disabled={viewOnly}
                      {...registerActividad('tipo_actividad', {
                        onChange: (e) => {
                          setActividadValue('tipo_actividad', e.target.value);
                          setActividadValue('clase_calendario', '');
                          setActividadValue('fecha_inicio_ta', '');
                          setActividadValue('fecha_fin_ta', '');
                        }
                      })}
                    >
                      <option value="">Tipo de actividad</option>
                      {tipos.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>
                          {tipo.nombre} ({tipo.tipo_dedicacion})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={isIpForm ? 'status-note' : 'status-note status-note-neutral'}>
                  {isIpForm
                    ? 'Esta actividad quedará vinculada a una clase del calendario y respetará la agenda del programa.'
                    : 'Esta actividad no requiere clase asociada. El rango de fechas es opcional.'}
                </div>

                <div className="form-row">
                  <div>
                    <select
                      className={`select ${errorsActividad.modalidad_trabajo ? 'input-error' : ''}`}
                      disabled={viewOnly}
                      aria-invalid={errorsActividad.modalidad_trabajo ? 'true' : 'false'}
                      {...registerActividad('modalidad_trabajo')}
                    >
                      <option value="IND">Trabajo individual</option>
                      <option value="EQU">Trabajo en equipo</option>
                    </select>
                    {errorsActividad.modalidad_trabajo && (
                      <span className="error-text" role="alert">{errorsActividad.modalidad_trabajo.message}</span>
                    )}
                  </div>
                  <div>
                    <input
                      className={`input ${errorsActividad.minutos ? 'input-error' : ''}`}
                      type="number"
                      min={0}
                      placeholder="Minutos de duracion"
                      disabled={viewOnly}
                      aria-invalid={errorsActividad.minutos ? 'true' : 'false'}
                      {...registerActividad('minutos', { valueAsNumber: true })}
                    />
                    {errorsActividad.minutos && (
                      <span className="error-text" role="alert">{errorsActividad.minutos.message}</span>
                    )}
                  </div>
                </div>

                {isIpForm ? (
                  <div className="form-field-full">
                    <select
                      className={`select ${errorsActividad.clase_calendario ? 'input-error' : ''}`}
                      disabled={viewOnly}
                      aria-invalid={errorsActividad.clase_calendario ? 'true' : 'false'}
                      {...registerActividad('clase_calendario')}
                    >
                      <option value="">Clase de calendario</option>
                      {clasesProgramaActivo.map((clase) => (
                        <option key={clase.id} value={clase.id}>
                          {clase.fecha} ({clase.estado})
                        </option>
                      ))}
                    </select>
                    {errorsActividad.clase_calendario && (
                      <span className="error-text" role="alert">{errorsActividad.clase_calendario.message}</span>
                    )}
                  </div>
                ) : (
                  <div className="form-row">
                    <div>
                      <input
                        className={`input ${errorsActividad.fecha_inicio_ta ? 'input-error' : ''}`}
                        type="date"
                        disabled={viewOnly}
                        aria-invalid={errorsActividad.fecha_inicio_ta ? 'true' : 'false'}
                        {...registerActividad('fecha_inicio_ta')}
                      />
                      {errorsActividad.fecha_inicio_ta && (
                        <span className="error-text" role="alert">{errorsActividad.fecha_inicio_ta.message}</span>
                      )}
                    </div>
                    <div>
                      <input
                        className={`input ${errorsActividad.fecha_fin_ta ? 'input-error' : ''}`}
                        type="date"
                        disabled={viewOnly}
                        aria-invalid={errorsActividad.fecha_fin_ta ? 'true' : 'false'}
                        {...registerActividad('fecha_fin_ta')}
                      />
                      {errorsActividad.fecha_fin_ta && (
                        <span className="error-text" role="alert">{errorsActividad.fecha_fin_ta.message}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="form-field-full">
                  <select
                    className={`select min-h-90 ${errorsActividad.unidad_ids ? 'input-error' : ''}`}
                    disabled={viewOnly || unidadesProgramaActivo.length === 0}
                    multiple
                    aria-invalid={errorsActividad.unidad_ids ? 'true' : 'false'}
                    {...registerActividad('unidad_ids', {
                      setValueAs: (v: string | string[]) => {
                        if (Array.isArray(v)) {
                          return v.map(Number);
                        }
                        if (typeof v === 'string' && v !== '') {
                          return [Number(v)];
                        }
                        return [];
                      }
                    })}
                  >
                    {unidadesProgramaActivo.length === 0 ? (
                      <option value="">No hay unidades en este programa</option>
                    ) : (
                      unidadesProgramaActivo.map((unidad) => (
                        <option key={unidad.id} value={unidad.id}>
                          U{unidad.numero} - {unidad.descripcion}
                        </option>
                      ))
                    )}
                  </select>
                  {errorsActividad.unidad_ids && (
                    <span className="error-text" role="alert">{errorsActividad.unidad_ids.message}</span>
                  )}
                  <p className="muted text-sm mt-1">
                    Manten presionado Ctrl/Cmd para seleccionar multiples unidades
                  </p>
                </div>

                <div className="form-field-full">
                  <textarea
                    className={`input min-h-80 ${errorsActividad.descripcion ? 'input-error' : ''}`}
                    placeholder="Descripcion de la actividad"
                    disabled={viewOnly}
                    rows={3}
                    style={{ resize: 'vertical' }}
                    aria-invalid={errorsActividad.descripcion ? 'true' : 'false'}
                    {...registerActividad('descripcion')}
                  />
                  {errorsActividad.descripcion && (
                    <span className="error-text" role="alert">{errorsActividad.descripcion.message}</span>
                  )}
                </div>
                <div className="form-actions">
                  {!viewOnly ? (
                    <button className="button" type="submit" disabled={loading}>
                      {editing ? 'Guardar cambios' : 'Crear actividad'}
                    </button>
                  ) : null}
                  <button className="button button-ghost" type="button" onClick={resetForm}>
                    {viewOnly ? 'Cerrar' : 'Cancelar'}
                  </button>
                </div>
              </form>
            </SectionCard>
          ) : null}
        </>
      ) : (
        <>
          <SectionCard title="Seguimiento de clases IP" action={<Clock3 size={18} />}>
            <div className="execution-command-center">
              <div className="execution-priority-card">
                <span className="execution-priority-label">Clase más reciente hasta hoy</span>
                {latestDueClass ? (
                  <>
                    <strong>{formatClassDate(latestDueClass.fecha)}</strong>
                    <p>
                      {getClassStatusLabel(latestDueClass.estado)} ·{' '}
                      {ipActivitiesByClass.get(latestDueClass.id)?.length ?? 0} actividades IP asociadas
                    </p>
                    <span className="execution-priority-meta">
                      {latestDueClass.estado === 'PLAN'
                        ? getClassTimingLabel(latestDueClass.fecha, toLocalIsoDate(new Date()))
                        : 'Ya registrada'}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Sin clases hasta hoy</strong>
                    <p>Cuando el calendario tenga fechas alcanzadas, la más reciente aparecerá primera.</p>
                  </>
                )}
              </div>

              <div className="docente-kpi-grid execution-kpi-grid">
                <div className="docente-kpi kpi-danger">
                  <h4>Vencidas</h4>
                  <strong>{executionStats.vencidas}</strong>
                  <span>Antes de hoy sin registrar</span>
                </div>
                <div className="docente-kpi kpi-warning">
                  <h4>Para registrar</h4>
                  <strong>{executionStats.pendientesRegistrar}</strong>
                  <span>Planificadas hasta hoy</span>
                </div>
                <div className="docente-kpi kpi-info">
                  <h4>No vencidas</h4>
                  <strong>{executionStats.noVencidas}</strong>
                  <span>Hoy o futuras pendientes</span>
                </div>
                <div className="docente-kpi kpi-success">
                  <h4>Dictadas</h4>
                  <strong>{executionStats.dictadas}</strong>
                  <span>Clases cerradas</span>
                </div>
                <div className="docente-kpi kpi-pending">
                  <h4>Suspendidas</h4>
                  <strong>{executionStats.canceladas}</strong>
                  <span>Con incidencia</span>
                </div>
                <div className="docente-kpi">
                  <h4>Total calendario</h4>
                  <strong>{executionStats.total}</strong>
                  <span>Clases generadas</span>
                </div>
              </div>
            </div>

            <div className="execution-filter-toolbar">
              <div className="execution-filter-title">
                <ListFilter size={18} />
                <div>
                  <strong>Filtros de seguimiento</strong>
                  <p>
                    La lista muestra primero la clase más reciente con fecha menor o igual a hoy; las futuras quedan debajo.
                  </p>
                </div>
              </div>
              <div className="execution-filter-row" role="group" aria-label="Filtros de clases IP">
                {executionFilterOptions.map((option) => (
                  <button
                    className={`execution-filter-chip ${executionFilter === option.id ? 'is-filter-active' : ''}`}
                    type="button"
                    key={option.id}
                    onClick={() => setExecutionFilter(option.id)}
                    aria-pressed={executionFilter === option.id}
                  >
                    <span>{option.label}</span>
                    <strong>{option.count}</strong>
                    <small>{option.help}</small>
                  </button>
                ))}
              </div>
            </div>

            {executionRows.length === 0 ? (
              <p className="muted">No hay clases para el filtro seleccionado.</p>
            ) : (
              <div className="execution-class-list">
                {executionRows.map(({ clase, actividades: actividadesDeClase }) => {
                  const todayIso = toLocalIsoDate(new Date());
                  const isOverdue = clase.estado === 'PLAN' && clase.fecha < todayIso;
                  const isTodayPending = clase.estado === 'PLAN' && clase.fecha === todayIso;
                  const timingLabel = clase.estado === 'PLAN' ? getClassTimingLabel(clase.fecha, todayIso) : 'Registrada';
                  const statusLabel = getClassStatusLabel(clase.estado);

                  return (
                  <article
                    className={`execution-class-card ${isOverdue ? 'is-overdue' : ''} ${isTodayPending ? 'is-today' : ''}`}
                    key={clase.id}
                  >
                    <header>
                      <div className="execution-date-block">
                        <span className="execution-date-kicker">{timingLabel}</span>
                        <h4>{formatClassDate(clase.fecha)}</h4>
                        <p>
                          {programaLookup.get(clase.programa) || `Programa ${clase.programa}`} ·{' '}
                          {actividadesDeClase.length} actividades IP
                        </p>
                      </div>
                      <div className="execution-header-badges">
                        {isOverdue ? <span className="state-pill state-attention">Vencida</span> : null}
                        {isTodayPending ? <span className="state-pill state-today">Hoy</span> : null}
                        <span className={`state-pill state-${clase.estado.toLowerCase()}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </header>

                    <div className="execution-card-actions">
                      <button
                        className="button button-small execution-action-done"
                        type="button"
                        disabled={updatingClassId === clase.id || clase.estado === 'DICT'}
                        onClick={() => handleUpdateClassStatus(clase, 'DICT')}
                        title="Marca esta clase como dictada y conserva la observación escrita."
                      >
                        <CheckCircle2 size={14} />
                        Se dictó
                      </button>
                      {clase.estado !== 'PLAN' ? (
                        <button
                          className="button button-ghost button-small execution-action-reopen"
                          type="button"
                          disabled={updatingClassId === clase.id}
                          onClick={() => handleUpdateClassStatus(clase, 'PLAN')}
                          title="Reabre la clase como planificada/pendiente si fue marcada por error."
                        >
                          <RotateCcw size={14} />
                          Reabrir pendiente
                        </button>
                      ) : null}
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        disabled={updatingClassId === clase.id || clase.estado === 'CANC'}
                        onClick={() => handleUpdateClassStatus(clase, 'CANC')}
                        title="Marca esta clase como suspendida y conserva la observación escrita."
                      >
                        <AlertTriangle size={14} />
                        Se suspendió
                      </button>
                    </div>

                    <label className="execution-notes-field">
                      <span>Observaciones</span>
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Ej. suspensión por paro, cambio de aula, recuperatorio, etc."
                        value={classNotesDraft[clase.id] ?? clase.observaciones ?? ''}
                        onChange={(event) =>
                          setClassNotesDraft((prev) => ({ ...prev, [clase.id]: event.target.value }))
                        }
                      />
                    </label>

                    <div className="form-actions" style={{ marginTop: '0.45rem' }}>
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        disabled={updatingClassId === clase.id}
                        onClick={() => handleSaveClassNote(clase)}
                      >
                        Guardar observación
                      </button>
                    </div>

                    <div className="execution-activity-list">
                      <div className="execution-activity-list-header">Actividades IP de esta clase</div>
                      {actividadesDeClase.length === 0 ? (
                        <span className="status-note status-note-neutral">No hay actividades IP asociadas a esta clase.</span>
                      ) : (
                        actividadesDeClase.map((actividad) => (
                          <div className="execution-activity-item" key={actividad.id}>
                            <div>
                              <strong>{actividad.descripcion}</strong>
                              <p>
                                {Math.round(Number(actividad.horas) * 60)} min | {actividad.modalidad_trabajo === 'IND' ? 'Individual' : 'Equipo'}
                              </p>
                            </div>
                            <button
                              className="button button-ghost button-small"
                              type="button"
                              onClick={() => openAdjustModal(actividad)}
                            >
                              <Repeat2 size={14} />
                              Ajustar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Agregar clase extra o recuperacion" action={<FilePlus2 size={18} />}>
            <p className="muted mt-0">
              Utiliza esta accion cuando necesites sumar una fecha no planificada originalmente (por ejemplo, recuperacion).
            </p>

            <form onSubmit={handleExtraClassSubmit(handleCreateExtraClassAction)}>
              <div className="form-grid">
                <div>
                  <input
                    className={`input ${errorsExtraClass.fecha ? 'input-error' : ''}`}
                    type="date"
                    aria-invalid={errorsExtraClass.fecha ? 'true' : 'false'}
                    {...registerExtraClass('fecha')}
                  />
                  {errorsExtraClass.fecha && (
                    <span className="error-text" role="alert">{errorsExtraClass.fecha.message}</span>
                  )}
                </div>
                <div>
                  <select
                    className={`select ${errorsExtraClass.estado ? 'input-error' : ''}`}
                    aria-invalid={errorsExtraClass.estado ? 'true' : 'false'}
                    {...registerExtraClass('estado')}
                  >
                    <option value="PLAN">Planificada</option>
                    <option value="DICT">Dictada</option>
                    <option value="CANC">Suspendida</option>
                  </select>
                  {errorsExtraClass.estado && (
                    <span className="error-text" role="alert">{errorsExtraClass.estado.message}</span>
                  )}
                </div>
                <div>
                  <input
                    className={`input ${errorsExtraClass.observaciones ? 'input-error' : ''}`}
                    type="text"
                    placeholder="Observacion breve"
                    aria-invalid={errorsExtraClass.observaciones ? 'true' : 'false'}
                    {...registerExtraClass('observaciones')}
                  />
                  {errorsExtraClass.observaciones && (
                    <span className="error-text" role="alert">{errorsExtraClass.observaciones.message}</span>
                  )}
                </div>
              </div>

              <div className="form-actions mt-2">
                <button
                  className="button"
                  type="submit"
                  disabled={extraClassLoading}
                >
                  {extraClassLoading ? 'Guardando...' : 'Agregar clase extra'}
                </button>
              </div>
            </form>
          </SectionCard>
        </>
      )}
    </>
  );
}

export default DocenteActividades;
