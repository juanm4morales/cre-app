import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit,
  Eye,
  FilePlus2,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

type WorkflowMode = 'PLAN' | 'EXEC';
type ExecutionFilter = 'PENDIENTES_REGISTRAR' | 'HOY_ANTERIORES' | 'PENDIENTES' | 'TODAS' | 'INCIDENCIAS';

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

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [adjustState, setAdjustState] = useState({
    tipo: 'REC' as 'REC' | 'EXT',
    motivo: '',
    horas_ip_extra: '',
    fecha_evento: '',
  });
  const [formState, setFormState] = useState({
    programa: '',
    tipo_actividad: '',
    modalidad_trabajo: 'IND' as 'IND' | 'EQU',
    unidad_ids: [] as number[],
    descripcion: '',
    minutos: '',
    clase_calendario: '',
    fecha_inicio_ta: '',
    fecha_fin_ta: '',
  });
  const [editing, setEditing] = useState<Actividad | null>(null);
  const [calendarGenerateState, setCalendarGenerateState] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    sobrescribir: false,
    loading: false,
  });
  const [classNotesDraft, setClassNotesDraft] = useState<Record<number, string>>({});
  const [updatingClassId, setUpdatingClassId] = useState<number | null>(null);
  const [extraClassForm, setExtraClassForm] = useState({
    fecha: '',
    estado: 'PLAN' as 'PLAN' | 'DICT' | 'CANC',
    observaciones: '',
    loading: false,
  });

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

  if (!selectedPlanEcId) {
    return (
      <SectionCard title="Seleccion de espacio curricular">
        <p className="muted">
          Usa el desplegable superior para elegir un espacio curricular y continuar con la planificacion.
        </p>
      </SectionCard>
    );
  }

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

  const activeProgramId = Number(formState.programa || currentYearProgram?.id || 0);

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
    () => tipos.find((tipo) => String(tipo.id) === formState.tipo_actividad) || null,
    [tipos, formState.tipo_actividad]
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

    if (executionFilter === 'PENDIENTES_REGISTRAR') {
      return withRelated.filter((item) => item.clase.estado === 'PLAN' && item.clase.fecha <= todayIso);
    }

    if (executionFilter === 'HOY_ANTERIORES') {
      return withRelated.filter((item) => item.clase.fecha <= todayIso);
    }

    if (executionFilter === 'PENDIENTES') {
      return withRelated.filter((item) => item.clase.estado === 'PLAN');
    }

    if (executionFilter === 'INCIDENCIAS') {
      return withRelated.filter(
        (item) => item.clase.estado === 'CANC' || (item.clase.observaciones || '').trim().length > 0
      );
    }

    return withRelated;
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
    return { total, dictadas, canceladas, pendientes, pendientesRegistrar, vencidas };
  }, [classesSortedByDate]);

  useEffect(() => {
    if (formState.programa || !currentYearProgram) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      programa: String(currentYearProgram.id),
      tipo_actividad: prev.tipo_actividad || String(firstTaType?.id || ''),
    }));
  }, [currentYearProgram, formState.programa, firstTaType]);

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
    setExtraClassForm((prev) => {
      if (prev.fecha) return prev;
      return { ...prev, fecha: dateToIso(new Date()) };
    });
  }, [currentYearProgram]);

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
    setFormState({
      programa: currentYearProgram ? String(currentYearProgram.id) : '',
      tipo_actividad: firstTaType ? String(firstTaType.id) : '',
      modalidad_trabajo: 'IND',
      unidad_ids: [],
      descripcion: '',
      minutos: '',
      clase_calendario: '',
      fecha_inicio_ta: '',
      fecha_fin_ta: '',
    });
    setEditing(null);
    setViewOnly(false);
    setShowForm(false);
    setSelectedClassDate(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formState.unidad_ids.length === 0) {
      toast.error('Selecciona al menos una unidad para la actividad.');
      return;
    }

    const minutos = Number(formState.minutos);
    if (!Number.isFinite(minutos) || minutos < 0) {
      toast.error('Los minutos deben ser un numero valido mayor o igual a 0.');
      return;
    }

    if (isIpForm && !formState.clase_calendario) {
      toast.error('Las actividades IP deben vincularse a una clase del calendario.');
      return;
    }

    if (!isIpForm && formState.fecha_inicio_ta && formState.fecha_fin_ta && formState.fecha_inicio_ta > formState.fecha_fin_ta) {
      toast.error('La fecha fin TA no puede ser anterior a la fecha inicio.');
      return;
    }

    const payload = {
      programa: Number(formState.programa),
      tipo_actividad: formState.tipo_actividad ? Number(formState.tipo_actividad) : undefined,
      modalidad_trabajo: formState.modalidad_trabajo,
      unidad_ids: formState.unidad_ids,
      descripcion: formState.descripcion,
      horas: Number((minutos / 60).toFixed(2)),
      clase_calendario: isIpForm ? Number(formState.clase_calendario) : null,
      fecha_inicio_ta: !isIpForm && formState.fecha_inicio_ta ? formState.fecha_inicio_ta : null,
      fecha_fin_ta: !isIpForm && formState.fecha_fin_ta ? formState.fecha_fin_ta : null,
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
    setFormState((prev) => ({
      ...prev,
      programa: String(currentYearProgram.id),
      tipo_actividad: String(firstIpType.id),
      clase_calendario: String(matchedClass.id),
    }));
  };

  const handleEdit = (actividad: Actividad) => {
    setEditing(actividad);
    setShowForm(true);
    setViewOnly(false);
    setFormState({
      programa: String(actividad.programa),
      tipo_actividad: String(actividad.tipo_actividad),
      modalidad_trabajo: actividad.modalidad_trabajo,
      unidad_ids: actividad.unidad_ids || [],
      descripcion: actividad.descripcion,
      minutos: String(Math.round(Number(actividad.horas) * 60)),
      clase_calendario: actividad.clase_calendario ? String(actividad.clase_calendario) : '',
      fecha_inicio_ta: actividad.fecha_inicio_ta || '',
      fecha_fin_ta: actividad.fecha_fin_ta || '',
    });
  };

  const handleView = (actividad: Actividad) => {
    setEditing(actividad);
    setShowForm(true);
    setViewOnly(true);
    setFormState({
      programa: String(actividad.programa),
      tipo_actividad: String(actividad.tipo_actividad),
      modalidad_trabajo: actividad.modalidad_trabajo,
      unidad_ids: actividad.unidad_ids || [],
      descripcion: actividad.descripcion,
      minutos: String(Math.round(Number(actividad.horas) * 60)),
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
    setAdjustState({ tipo: 'REC', motivo: '', horas_ip_extra: '', fecha_evento: '' });
    try {
      const response = await api.get<ActividadAjuste[]>(`/actividades/${actividad.id}/ajustes`);
      setAdjustModal({ open: true, actividad, loading: false, history: response.data });
    } catch (error) {
      setAdjustModal((prev) => ({ ...prev, loading: false }));
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el historial de ajustes.'));
    }
  };

  const handleCreateAdjust = async () => {
    if (!adjustModal.actividad) return;
    if (!adjustState.motivo.trim()) {
      toast.error('Debes indicar un motivo para registrar el ajuste.');
      return;
    }

    const payload = {
      tipo: adjustState.tipo,
      motivo: adjustState.motivo,
      horas_ip_extra: Number(adjustState.horas_ip_extra || 0),
      fecha_evento: adjustState.fecha_evento || null,
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
      setAdjustState({ tipo: 'REC', motivo: '', horas_ip_extra: '', fecha_evento: '' });
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

  const handleCreateExtraClass = async () => {
    if (!currentYearProgram) {
      toast.error('Debes tener un programa activo para agregar una clase extra.');
      return;
    }
    if (!extraClassForm.fecha) {
      toast.error('Debes indicar una fecha para la clase extra.');
      return;
    }

    setExtraClassForm((prev) => ({ ...prev, loading: true }));
    try {
      const response = await api.post<ClaseCalendario>('/clases-calendario', {
        programa: currentYearProgram.id,
        fecha: extraClassForm.fecha,
        estado: extraClassForm.estado,
        observaciones: extraClassForm.observaciones,
      });
      setClases((prev) => [...prev, response.data]);
      setExtraClassForm((prev) => ({
        ...prev,
        fecha: prev.fecha,
        estado: 'PLAN',
        observaciones: '',
        loading: false,
      }));
      toast.success('Clase extra agregada al calendario.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la clase extra.'));
      setExtraClassForm((prev) => ({ ...prev, loading: false }));
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
              <p style={{ marginTop: 0 }}>
                Registra recuperaciones o extensiones por tiempo insuficiente. Esta bitacora queda en historial.
              </p>
              <div className="form-grid">
                <select
                  className="select"
                  value={adjustState.tipo}
                  onChange={(event) =>
                    setAdjustState((prev) => ({ ...prev, tipo: event.target.value as 'REC' | 'EXT' }))
                  }
                >
                  <option value="REC">Recuperacion</option>
                  <option value="EXT">Extension</option>
                </select>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.25}
                  placeholder="Horas IP extra"
                  value={adjustState.horas_ip_extra}
                  onChange={(event) =>
                    setAdjustState((prev) => ({ ...prev, horas_ip_extra: event.target.value }))
                  }
                />
                <input
                  className="input"
                  type="date"
                  value={adjustState.fecha_evento}
                  onChange={(event) =>
                    setAdjustState((prev) => ({ ...prev, fecha_evento: event.target.value }))
                  }
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Motivo del ajuste"
                  value={adjustState.motivo}
                  onChange={(event) =>
                    setAdjustState((prev) => ({ ...prev, motivo: event.target.value }))
                  }
                />
              </div>
              <div className="form-actions" style={{ marginTop: '0.8rem' }}>
                <button className="button" type="button" onClick={handleCreateAdjust}>
                  Registrar ajuste
                </button>
              </div>
              <h4 style={{ marginBottom: '0.5rem' }}>Historial</h4>
              {adjustModal.loading ? (
                <p className="muted">Cargando historial...</p>
              ) : adjustModal.history.length === 0 ? (
                <p className="muted">Aun no hay ajustes registrados para esta actividad.</p>
              ) : (
                <div className="adjust-list">
                  {adjustModal.history.map((item) => (
                    <div className="adjust-item" key={item.id}>
                      <strong>{item.tipo === 'REC' ? 'Recuperacion' : 'Extension'}</strong>
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
          <p className="eyebrow">Gestion de actividades</p>
          <h2>
            {selectedEspacioNombre || 'Gestor docente'}
            {workflowMode === 'PLAN' ? ' | Planificacion' : ' | Seguimiento de clases IP'}
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
              Volver a planificacion
            </button>
          )}
        </div>
      </section>

      {!currentYearProgram ? (
        <SectionCard title={`Programa ${currentYear} pendiente`}>
          <p className="muted">
            Para crear actividades primero debes crear o actualizar el programa del anio actual y sus unidades.
          </p>
          <div className="form-actions" style={{ marginTop: '0.8rem' }}>
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
              <div className="form-actions" style={{ marginTop: '0.8rem' }}>
                <button className="button" type="button" onClick={() => navigate('/docente/programas')}>
                  Ir a programas y agregar unidades
                </button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Calendario de clases IP">
              {!firstIpType ? (
                <div className="status-note status-note-warning" style={{ marginBottom: '0.8rem' }}>
                  No hay tipos de actividad IP disponibles. Hasta que administración cargue al menos uno, no podrás crear actividades desde el calendario.
                </div>
              ) : null}

              <div className="planning-context-grid" style={{ marginBottom: '1rem' }}>
                <div className="context-card">
                  <span className="context-label">Programa activo</span>
                  <strong>{currentYearProgram?.descripcion || `Programa ${currentYear}`}</strong>
                  <p>{unidadesProgramaActivo.length} unidades activas para asociar actividades.</p>
                </div>
                <div className="context-card">
                  <span className="context-label">Dias configurados</span>
                  <strong>{allowedWeekDays.size}</strong>
                  <p>El calendario resalta solo los dias habilitados para cursado.</p>
                </div>
                <div className="context-card">
                  <span className="context-label">Clases del rango</span>
                  <strong>{classesSortedByDate.length}</strong>
                  <p>Genera o actualiza clases dentro del periodo que definas abajo.</p>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                <label style={{ minWidth: '190px', display: 'grid', gap: '0.25rem' }}>
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
                <label style={{ minWidth: '190px', display: 'grid', gap: '0.25rem' }}>
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
                <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                      title={
                        !clase
                          ? 'No hay clase registrada en esta fecha'
                          : !firstIpType
                            ? 'Falta configurar al menos un tipo de actividad IP'
                            : 'Cargar actividad IP sobre esta clase'
                      }
                    >
                      <span>{cell.date.getDate()}</span>
                      {clase ? <CalendarDays size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Actividades planificadas"
            action={
              <button className="button" type="button" onClick={openCreateForm}>
                <Plus size={18} style={{ marginRight: '0.45rem' }} />
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
            />
          </SectionCard>

          {showForm && currentYearProgram ? (
            <SectionCard title={viewOnly ? 'Detalle de actividad' : editing ? 'Editar actividad' : 'Nueva actividad'}>
              <form className="form-grid-full" onSubmit={handleSubmit}>
                <div className="form-row">
                  <select
                    className="select"
                    value={formState.programa}
                    onChange={(event) => setFormState((prev) => ({ ...prev, programa: event.target.value }))}
                    disabled={Boolean(editing) || viewOnly}
                    required
                  >
                    <option value="">Programa</option>
                    {programas.map((programa) => (
                      <option key={programa.id} value={programa.id}>
                        {programa.descripcion || `Programa ${programa.id}`}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={formState.tipo_actividad}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        tipo_actividad: event.target.value,
                        clase_calendario: '',
                        fecha_inicio_ta: '',
                        fecha_fin_ta: '',
                      }))
                    }
                    disabled={viewOnly}
                  >
                    <option value="">Tipo de actividad</option>
                    {tipos.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre} ({tipo.tipo_dedicacion})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={isIpForm ? 'status-note' : 'status-note status-note-neutral'}>
                  {isIpForm
                    ? 'Esta actividad quedará vinculada a una clase del calendario y respetará la agenda del programa.'
                    : 'Esta actividad no requiere clase asociada. El rango de fechas es opcional.'}
                </div>

                <div className="form-row">
                  <select
                    className="select"
                    value={formState.modalidad_trabajo}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        modalidad_trabajo: event.target.value as 'IND' | 'EQU',
                      }))
                    }
                    disabled={viewOnly}
                    required
                  >
                    <option value="IND">Trabajo individual</option>
                    <option value="EQU">Trabajo en equipo</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="Minutos de duracion"
                    value={formState.minutos}
                    onChange={(event) => setFormState((prev) => ({ ...prev, minutos: event.target.value }))}
                    disabled={viewOnly}
                    required
                  />
                </div>

                {isIpForm ? (
                  <div className="form-field-full">
                    <select
                      className="select"
                      value={formState.clase_calendario}
                      onChange={(event) => setFormState((prev) => ({ ...prev, clase_calendario: event.target.value }))}
                      disabled={viewOnly}
                      required
                    >
                      <option value="">Clase de calendario</option>
                      {clasesProgramaActivo.map((clase) => (
                        <option key={clase.id} value={clase.id}>
                          {clase.fecha} ({clase.estado})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-row">
                    <input
                      className="input"
                      type="date"
                      value={formState.fecha_inicio_ta}
                      onChange={(event) => setFormState((prev) => ({ ...prev, fecha_inicio_ta: event.target.value }))}
                      disabled={viewOnly}
                    />
                    <input
                      className="input"
                      type="date"
                      value={formState.fecha_fin_ta}
                      onChange={(event) => setFormState((prev) => ({ ...prev, fecha_fin_ta: event.target.value }))}
                      disabled={viewOnly}
                    />
                  </div>
                )}

                <div className="form-field-full">
                  <select
                    className="select"
                    value={formState.unidad_ids.map(String)}
                    onChange={(event) => {
                      const selectedValues = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
                      setFormState((prev) => ({ ...prev, unidad_ids: selectedValues }));
                    }}
                    disabled={viewOnly || unidadesProgramaActivo.length === 0}
                    multiple
                    required
                    style={{ minHeight: '90px' }}
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
                  <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                    Manten presionado Ctrl/Cmd para seleccionar multiples unidades
                  </p>
                </div>

                <div className="form-field-full">
                  <textarea
                    className="input"
                    placeholder="Descripcion de la actividad"
                    value={formState.descripcion}
                    onChange={(event) => setFormState((prev) => ({ ...prev, descripcion: event.target.value }))}
                    disabled={viewOnly}
                    required
                    rows={3}
                    style={{ resize: 'vertical', minHeight: '80px' }}
                  />
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
          <SectionCard title="Ejecucion de clases IP">
            <div className="docente-kpi-grid">
              <div className="docente-kpi kpi-success">
                <h4>Clases dictadas</h4>
                <strong>{executionStats.dictadas}</strong>
              </div>
              <div className="docente-kpi kpi-warning">
                <h4>Pendientes de registrar</h4>
                <strong>{executionStats.pendientesRegistrar}</strong>
              </div>
              <div className="docente-kpi kpi-pending">
                <h4>Pendientes</h4>
                <strong>{executionStats.pendientes}</strong>
              </div>
              <div className="docente-kpi kpi-danger">
                <h4>Suspendidas</h4>
                <strong>{executionStats.canceladas}</strong>
              </div>
              <div className="docente-kpi">
                <h4>Total calendario</h4>
                <strong>{executionStats.total}</strong>
              </div>
            </div>

            <p className="execution-filter-helper">
              En Seguimiento se priorizan clases hasta hoy para registrar si fueron dictadas o suspendidas.
            </p>

            <div className="execution-filter-row">
              <button
                className={`button button-ghost ${executionFilter === 'PENDIENTES_REGISTRAR' ? 'is-filter-active' : ''}`}
                type="button"
                onClick={() => setExecutionFilter('PENDIENTES_REGISTRAR')}
              >
                Pendientes de registrar
              </button>
              <button
                className={`button button-ghost ${executionFilter === 'HOY_ANTERIORES' ? 'is-filter-active' : ''}`}
                type="button"
                onClick={() => setExecutionFilter('HOY_ANTERIORES')}
              >
                Hoy y anteriores
              </button>
              <button
                className={`button button-ghost ${executionFilter === 'PENDIENTES' ? 'is-filter-active' : ''}`}
                type="button"
                onClick={() => setExecutionFilter('PENDIENTES')}
              >
                Pendientes
              </button>
              <button
                className={`button button-ghost ${executionFilter === 'TODAS' ? 'is-filter-active' : ''}`}
                type="button"
                onClick={() => setExecutionFilter('TODAS')}
              >
                Todas
              </button>
              <button
                className={`button button-ghost ${executionFilter === 'INCIDENCIAS' ? 'is-filter-active' : ''}`}
                type="button"
                onClick={() => setExecutionFilter('INCIDENCIAS')}
              >
                Con incidencias
              </button>
            </div>

            {executionRows.length === 0 ? (
              <p className="muted">No hay clases para el filtro seleccionado.</p>
            ) : (
              <div className="execution-class-list">
                {executionRows.map(({ clase, actividades: actividadesDeClase }) => {
                  const todayIso = toLocalIsoDate(new Date());
                  const isOverdue = clase.estado === 'PLAN' && clase.fecha < todayIso;
                  const isTodayPending = clase.estado === 'PLAN' && clase.fecha === todayIso;

                  return (
                  <article
                    className={`execution-class-card ${isOverdue ? 'is-overdue' : ''} ${isTodayPending ? 'is-today' : ''}`}
                    key={clase.id}
                  >
                    <header>
                      <div>
                        <h4>{clase.fecha}</h4>
                        <p>{programaLookup.get(clase.programa) || `Programa ${clase.programa}`}</p>
                      </div>
                      <div className="execution-header-badges">
                        {isOverdue ? <span className="state-pill state-attention">Vencida</span> : null}
                        {isTodayPending ? <span className="state-pill state-today">Hoy</span> : null}
                        <span className={`state-pill state-${clase.estado.toLowerCase()}`}>
                          {clase.estado === 'PLAN' ? 'Planificada' : clase.estado === 'DICT' ? 'Dictada' : 'Suspendida'}
                        </span>
                      </div>
                    </header>

                    <div className="execution-card-actions">
                      <button
                        className="button button-small"
                        type="button"
                        disabled={updatingClassId === clase.id}
                        onClick={() => handleUpdateClassStatus(clase, 'DICT')}
                      >
                        <CheckCircle2 size={14} />
                        Se dicto
                      </button>
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        disabled={updatingClassId === clase.id}
                        onClick={() => handleUpdateClassStatus(clase, 'PLAN')}
                      >
                        <CalendarDays size={14} />
                        Volver a plan
                      </button>
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        disabled={updatingClassId === clase.id}
                        onClick={() => handleUpdateClassStatus(clase, 'CANC')}
                      >
                        <AlertTriangle size={14} />
                        Se suspendio
                      </button>
                    </div>

                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Observaciones de la clase (ej. suspension por paro, cambio de aula, etc.)"
                      value={classNotesDraft[clase.id] ?? clase.observaciones ?? ''}
                      onChange={(event) =>
                        setClassNotesDraft((prev) => ({ ...prev, [clase.id]: event.target.value }))
                      }
                    />

                    <div className="form-actions" style={{ marginTop: '0.45rem' }}>
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        disabled={updatingClassId === clase.id}
                        onClick={() => handleSaveClassNote(clase)}
                      >
                        Guardar observacion
                      </button>
                    </div>

                    <div className="execution-activity-list">
                      {actividadesDeClase.length === 0 ? (
                        <span className="muted">No hay actividades IP asociadas a esta clase.</span>
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
            <p className="muted" style={{ marginTop: 0 }}>
              Utiliza esta accion cuando necesites sumar una fecha no planificada originalmente (por ejemplo, recuperacion).
            </p>

            <div className="form-grid">
              <input
                className="input"
                type="date"
                value={extraClassForm.fecha}
                onChange={(event) => setExtraClassForm((prev) => ({ ...prev, fecha: event.target.value }))}
              />
              <select
                className="select"
                value={extraClassForm.estado}
                onChange={(event) =>
                  setExtraClassForm((prev) => ({
                    ...prev,
                    estado: event.target.value as 'PLAN' | 'DICT' | 'CANC',
                  }))
                }
              >
                <option value="PLAN">Planificada</option>
                <option value="DICT">Dictada</option>
                <option value="CANC">Suspendida</option>
              </select>
              <input
                className="input"
                type="text"
                placeholder="Observacion breve"
                value={extraClassForm.observaciones}
                onChange={(event) =>
                  setExtraClassForm((prev) => ({ ...prev, observaciones: event.target.value }))
                }
              />
            </div>

            <div className="form-actions" style={{ marginTop: '0.8rem' }}>
              <button
                className="button"
                type="button"
                disabled={extraClassForm.loading}
                onClick={handleCreateExtraClass}
              >
                {extraClassForm.loading ? 'Guardando...' : 'Agregar clase extra'}
              </button>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}

export default DocenteActividades;
