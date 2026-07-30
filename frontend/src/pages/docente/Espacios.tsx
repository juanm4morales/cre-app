import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FlaskConical, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { setDocenteSelection } from '../../hooks/useDocenteSelection';

interface EspacioCurricular {
  id: number;
  nombre: string;
  codigo: string;
  tipo_espacio: string;
  anio_cursada: number;
  periodo: string;
  creditos: number;
  horas_ip: number;
  horas_ta: number;
}

interface PlanEstudioEC {
  id: number;
  plan_estudio: number;
  espacio_curricular: number;
}

interface PaginatedResponse<T> {
  results: T[];
}

interface PlanEstudio {
  id: number;
  nombre: string;
}

interface ConfiguracionCRE {
  horas_por_cre: number;
}

interface TemporaryEspacioResponse {
  espacio: EspacioCurricular;
  plan_estudio_ec_id: number;
  temporary: true;
}

interface TemporaryEspacioForm {
  codigo: string;
  nombre: string;
  tipo_espacio: string;
  anio_cursada: string;
  periodo: string;
  horas_ip: string;
  horas_ta: string;
  plan_estudio: string;
}

interface ExistingAssignmentForm {
  espacio_curricular: string;
  plan_estudio: string;
}

type TemporaryMode = 'create' | 'assign' | null;

const defaultTemporaryForm: TemporaryEspacioForm = {
  codigo: '',
  nombre: '',
  tipo_espacio: 'T1',
  anio_cursada: '1',
  periodo: 'ANUAL',
  horas_ip: '0',
  horas_ta: '0',
  plan_estudio: '',
};

const defaultExistingAssignmentForm: ExistingAssignmentForm = {
  espacio_curricular: '',
  plan_estudio: '',
};

function calculateCreditsFromHours(horasIp: number, horasTa: number, horasPorCre: number): number {
  const totalHours = horasIp + horasTa;
  if (totalHours <= 0 || horasPorCre <= 0) return 0;
  return Math.max(1, Math.ceil(totalHours / horasPorCre));
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return typeof value === 'object' && value !== null && 'results' in value && Array.isArray((value as PaginatedResponse<T>).results);
}

export default function DocenteEspacios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [temporaryForm, setTemporaryForm] = useState<TemporaryEspacioForm>(defaultTemporaryForm);
  const [existingAssignmentForm, setExistingAssignmentForm] = useState<ExistingAssignmentForm>(defaultExistingAssignmentForm);
  const [temporaryMode, setTemporaryMode] = useState<TemporaryMode>(null);
  const [cargaDrafts, setCargaDrafts] = useState<Record<number, { horas_ip: string; horas_ta: string }>>({});

  const { data: espacios = [], isLoading: loadingEspacios } = useQuery({
    queryKey: ['espacios-asignados', user?.name || 'anon'],
    queryFn: () => api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados').then(res => {
      return Array.isArray(res.data)
        ? res.data
        : isPaginatedResponse<EspacioCurricular>(res.data)
          ? res.data.results
          : [];
    }),
  });

  const { data: planEcsData = [], isLoading: loadingPlanEcs } = useQuery({
    queryKey: ['planes-estudio-ec', user?.name || 'anon'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec').then(res => res.data.results || []),
  });

  const { data: planes = [], isLoading: loadingPlanes } = useQuery({
    queryKey: ['planes-estudio'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudio>>('/planes-estudio').then(res => res.data.results || []),
  });

  const { data: espaciosCatalogo = [], isLoading: loadingEspaciosCatalogo } = useQuery({
    queryKey: ['espacios-curriculares'],
    queryFn: () => api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares').then(res => res.data.results || []),
  });

  const { data: configuraciones = [] } = useQuery({
    queryKey: ['configuracion-cre'],
    queryFn: () => api.get<PaginatedResponse<ConfiguracionCRE>>('/configuracion-cre').then(res => res.data.results || []),
  });

  const createTemporaryEspacioMutation = useMutation({
    mutationFn: (payload: TemporaryEspacioForm) => api.post<TemporaryEspacioResponse>('/espacios-asignados/temporal/espacio', {
      codigo: payload.codigo,
      nombre: payload.nombre,
      tipo_espacio: payload.tipo_espacio,
      anio_cursada: Number(payload.anio_cursada),
      periodo: payload.periodo,
      horas_ip: Number(payload.horas_ip),
      horas_ta: Number(payload.horas_ta),
      plan_estudio: Number(payload.plan_estudio),
    }),
    onSuccess: (response) => {
      const { espacio, plan_estudio_ec_id: planEcId } = response.data;
      queryClient.invalidateQueries({ queryKey: ['espacios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['planes-estudio-ec'] });
      setDocenteSelection({
        espacioId: String(espacio.id),
        planEstudioEcId: String(planEcId),
        espacioNombre: espacio.nombre,
      });
      setTemporaryForm((current) => ({ ...defaultTemporaryForm, plan_estudio: current.plan_estudio }));
      toast.success('Espacio temporal cargado y asignado. Ya podés crear el programa y planificar.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el espacio temporal.'));
    },
  });

  const updateCargaMutation = useMutation({
    mutationFn: (payload: { espacio_curricular_id: number; horas_ip: number; horas_ta: number }) => (
      api.patch<{ espacio: EspacioCurricular; temporary: true }>('/espacios-asignados/temporal/carga-horaria', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['espacios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['espacios-curriculares'] });
      toast.success('Horas actualizadas y créditos recalculados temporalmente.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la carga horaria temporal.'));
    },
  });

  const assignExistingEspacioMutation = useMutation({
    mutationFn: (payload: ExistingAssignmentForm) => api.post<TemporaryEspacioResponse>('/espacios-asignados/temporal/asignarme', {
      espacio_curricular: Number(payload.espacio_curricular),
      plan_estudio: Number(payload.plan_estudio),
    }),
    onSuccess: (response) => {
      const { espacio, plan_estudio_ec_id: planEcId } = response.data;
      queryClient.invalidateQueries({ queryKey: ['espacios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['planes-estudio-ec'] });
      setDocenteSelection({
        espacioId: String(espacio.id),
        planEstudioEcId: String(planEcId),
        espacioNombre: espacio.nombre,
      });
      setExistingAssignmentForm((current) => ({ ...defaultExistingAssignmentForm, plan_estudio: current.plan_estudio }));
      toast.success('Espacio existente asignado. Ya podés crear el programa y planificar.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo asignar el espacio existente.'));
    },
  });

  const loading = loadingEspacios || loadingPlanEcs || loadingPlanes || loadingEspaciosCatalogo;
  const horasPorCre = configuraciones[0]?.horas_por_cre ?? 27;
  const temporaryHorasIp = Number(temporaryForm.horas_ip || 0);
  const temporaryHorasTa = Number(temporaryForm.horas_ta || 0);
  const temporaryCalculatedCredits = calculateCreditsFromHours(temporaryHorasIp, temporaryHorasTa, horasPorCre);

  const planEcsMap = useMemo(() => {
    const map = new Map<number, number>();
    planEcsData.forEach((planEc) => {
      map.set(planEc.espacio_curricular, planEc.id);
    });
    return map;
  }, [planEcsData]);

  const espaciosAsignadosIds = useMemo(() => new Set(espacios.map((espacio) => espacio.id)), [espacios]);
  const espaciosDisponiblesParaAsignar = useMemo(
    () => espaciosCatalogo.filter((espacio) => !espaciosAsignadosIds.has(espacio.id)),
    [espaciosAsignadosIds, espaciosCatalogo],
  );

  const handleSelectEspacio = (espacio: EspacioCurricular) => {
    const planEcId = planEcsMap.get(espacio.id);
    if (planEcId) {
      setDocenteSelection({
        espacioId: espacio.id.toString(),
        planEstudioEcId: planEcId.toString(),
        espacioNombre: espacio.nombre,
      });

      navigate('/docente/resumen');
      return;
    }

    toast.error('No se encontró el plan de estudio asociado para este espacio. Contacta al administrador.');
  };

  const handleTemporaryFieldChange = (field: keyof TemporaryEspacioForm, value: string) => {
    setTemporaryForm((current) => ({ ...current, [field]: value }));
  };

  const handleExistingAssignmentFieldChange = (field: keyof ExistingAssignmentForm, value: string) => {
    setExistingAssignmentForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateTemporaryEspacio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!temporaryForm.plan_estudio) {
      toast.error('Seleccioná el plan de estudio donde se vinculará el espacio.');
      return;
    }

    if (temporaryCalculatedCredits === 0) {
      toast.error('Ingresá Horas IP y/o Horas TA para calcular los créditos.');
      return;
    }

    createTemporaryEspacioMutation.mutate(temporaryForm);
  };

  const handleAssignExistingEspacio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!existingAssignmentForm.espacio_curricular) {
      toast.error('Seleccioná un espacio curricular existente.');
      return;
    }

    if (!existingAssignmentForm.plan_estudio) {
      toast.error('Seleccioná el plan de estudio asociado.');
      return;
    }

    assignExistingEspacioMutation.mutate(existingAssignmentForm);
  };

  const handleCargaDraftChange = (espacioId: number, field: 'horas_ip' | 'horas_ta', value: string) => {
    setCargaDrafts((current) => ({
      ...current,
      [espacioId]: {
        horas_ip: current[espacioId]?.horas_ip ?? '',
        horas_ta: current[espacioId]?.horas_ta ?? '',
        [field]: value,
      },
    }));
  };

  const handleUpdateCarga = (event: FormEvent<HTMLFormElement>, espacioId: number) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const horasIp = Number(formData.get('horas_ip') || 0);
    const horasTa = Number(formData.get('horas_ta') || 0);
    if (calculateCreditsFromHours(horasIp, horasTa, horasPorCre) === 0) {
      toast.error('Ingresá Horas IP y/o Horas TA para calcular los créditos.');
      return;
    }
    updateCargaMutation.mutate({
      espacio_curricular_id: espacioId,
      horas_ip: horasIp,
      horas_ta: horasTa,
    });
  };

  const renderTemporaryTools = () => (
    <SectionCard title="Modo prueba docente (temporal)">
      <div className="temporary-tool-callout">
        <FlaskConical size={22} />
        <div>
          <strong>Cargas habilitadas solo para acelerar pruebas.</strong>
          <p>
            Primero elegí si querés crear un espacio curricular de prueba o asignarte uno ya existente.
            Los créditos se calculan automáticamente con la equivalencia horas/CRE configurada.
            Esta funcionalidad es temporal y queda documentada para retirarla cuando llegue la carga oficial.
          </p>
        </div>
      </div>

      <div className="temporary-mode-actions" aria-label="Acciones temporales de espacios curriculares">
        <button
          className={temporaryMode === 'create' ? 'button' : 'button button-ghost'}
          type="button"
          onClick={() => setTemporaryMode((current) => (current === 'create' ? null : 'create'))}
        >
          <FlaskConical size={16} /> Crear espacio y autoasignarme
        </button>
        <button
          className={temporaryMode === 'assign' ? 'button' : 'button button-ghost'}
          type="button"
          onClick={() => setTemporaryMode((current) => (current === 'assign' ? null : 'assign'))}
        >
          <UserPlus size={16} /> Asignarme a espacio existente
        </button>
      </div>

      {temporaryMode === 'create' ? (
      <form className="form-grid mt-3" onSubmit={handleCreateTemporaryEspacio}>
        <label className="grid-label">
          Código
          <input
            className="input"
            value={temporaryForm.codigo}
            onChange={(event) => handleTemporaryFieldChange('codigo', event.target.value)}
            placeholder="Ej: MAT-101"
            required
          />
        </label>
        <label className="grid-label">
          Nombre del espacio
          <input
            className="input"
            value={temporaryForm.nombre}
            onChange={(event) => handleTemporaryFieldChange('nombre', event.target.value)}
            placeholder="Ej: Matemática I"
            required
          />
        </label>
        <label className="grid-label">
          Plan de estudio
          <select
            className="select"
            value={temporaryForm.plan_estudio}
            onChange={(event) => handleTemporaryFieldChange('plan_estudio', event.target.value)}
            required
          >
            <option value="">Seleccionar plan</option>
            {planes.map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.nombre}</option>
            ))}
          </select>
        </label>
        <label className="grid-label">
          Tipo
          <select
            className="select"
            value={temporaryForm.tipo_espacio}
            onChange={(event) => handleTemporaryFieldChange('tipo_espacio', event.target.value)}
          >
            <option value="T1">T1 - Asignatura</option>
            <option value="T2">T2 - Seminario</option>
            <option value="T3">T3 - Taller/Lab</option>
            <option value="T4">T4 - Actividad profesional</option>
          </select>
        </label>
        <label className="grid-label">
          Año de cursada
          <input
            className="input"
            type="number"
            min="1"
            max="10"
            value={temporaryForm.anio_cursada}
            onChange={(event) => handleTemporaryFieldChange('anio_cursada', event.target.value)}
            required
          />
        </label>
        <label className="grid-label">
          Período
          <select
            className="select"
            value={temporaryForm.periodo}
            onChange={(event) => handleTemporaryFieldChange('periodo', event.target.value)}
          >
            <option value="ANUAL">Anual</option>
            <option value="1S">1er semestre</option>
            <option value="2S">2do semestre</option>
          </select>
        </label>
        <label className="grid-label">
          Horas IP conocidas
          <input
            className="input"
            type="number"
            min="0"
            value={temporaryForm.horas_ip}
            onChange={(event) => handleTemporaryFieldChange('horas_ip', event.target.value)}
            required
          />
        </label>
        <label className="grid-label">
          Horas TA objetivo
          <input
            className="input"
            type="number"
            min="0"
            value={temporaryForm.horas_ta}
            onChange={(event) => handleTemporaryFieldChange('horas_ta', event.target.value)}
            required
          />
        </label>
        <div className="temporary-derived-credit">
          <span>Créditos calculados</span>
          <input
            className="input temporary-derived-credit-input"
            type="number"
            value={temporaryCalculatedCredits || ''}
            readOnly
            aria-readonly="true"
            placeholder="—"
          />
          <small>
            ({Math.max(0, temporaryHorasIp + temporaryHorasTa)} h / {horasPorCre} h por crédito, redondeado hacia arriba)
          </small>
        </div>
        <div className="form-actions form-field-full">
          <button className="button" type="submit" disabled={createTemporaryEspacioMutation.isPending || planes.length === 0}>
            {createTemporaryEspacioMutation.isPending ? 'Cargando...' : 'Cargar y asignarme espacio'}
          </button>
        </div>
      </form>
      ) : null}

      {temporaryMode === 'assign' ? (
      <div className="temporary-existing-assignment">
        <div className="temporary-existing-head">
          <UserPlus size={20} />
          <div>
            <strong>Asignarme a un espacio ya creado</strong>
            <p>Si el espacio curricular ya existe en el catálogo, elegilo y vinculalo a un plan para comenzar a planificar.</p>
          </div>
        </div>

        <form className="form-grid mt-2" onSubmit={handleAssignExistingEspacio}>
          <label className="grid-label form-field-full">
            Espacio curricular existente
            <select
              className="select"
              value={existingAssignmentForm.espacio_curricular}
              onChange={(event) => handleExistingAssignmentFieldChange('espacio_curricular', event.target.value)}
              required
            >
              <option value="">Seleccionar espacio</option>
              {espaciosDisponiblesParaAsignar.map((espacio) => (
                <option key={espacio.id} value={espacio.id}>
                  {espacio.codigo} · {espacio.nombre} · {espacio.creditos} créditos
                </option>
              ))}
            </select>
          </label>
          <label className="grid-label">
            Plan de estudio
            <select
              className="select"
              value={existingAssignmentForm.plan_estudio}
              onChange={(event) => handleExistingAssignmentFieldChange('plan_estudio', event.target.value)}
              required
            >
              <option value="">Seleccionar plan</option>
              {planes.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.nombre}</option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button
              className="button button-ghost"
              type="submit"
              disabled={assignExistingEspacioMutation.isPending || espaciosDisponiblesParaAsignar.length === 0 || planes.length === 0}
            >
              {assignExistingEspacioMutation.isPending ? 'Asignando...' : 'Asignarme espacio existente'}
            </button>
          </div>
        </form>

        {espaciosDisponiblesParaAsignar.length === 0 ? (
          <p className="text-sm text-muted mt-2">No hay espacios disponibles para asignarte o ya tenés asignados todos los espacios visibles.</p>
        ) : null}
      </div>
      ) : null}
    </SectionCard>
  );

  if (loading) {
    return (
      <>
        {renderTemporaryTools()}
        <div className="content-empty">
          <p>Cargando espacios curriculares...</p>
        </div>
      </>
    );
  }

  if (espacios.length === 0) {
    return (
      <>
        {renderTemporaryTools()}
        <SectionCard title="Mis Espacios Curriculares">
          <div className="content-empty">
            <p>No tienes espacios curriculares asignados en este período.</p>
            <p className="text-sm text-muted mt-1">
              Usá el modo prueba para cargar un espacio temporal o contactá con el administrador.
            </p>
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      {renderTemporaryTools()}
      <SectionCard title="Mis Espacios Curriculares">
        <p className="mb-3 text-muted">
          Seleccioná un espacio curricular para continuar con tu planificación anual o ajustá Horas IP/TA de forma temporal.
          Los créditos se recalculan automáticamente.
        </p>

        <div className="flex-col gap-3">
          {espacios.map((espacio) => {
            const draft = cargaDrafts[espacio.id];
            const horasIpDraft = draft?.horas_ip ?? String(espacio.horas_ip);
            const horasTaDraft = draft?.horas_ta ?? String(espacio.horas_ta);
            const calculatedCredits = calculateCreditsFromHours(Number(horasIpDraft || 0), Number(horasTaDraft || 0), horasPorCre);

            return (
              <article key={espacio.id} className="espacio-card espacio-card-editable">
                <button
                  type="button"
                  onClick={() => handleSelectEspacio(espacio)}
                  className="espacio-card-main"
                >
                  <div className="flex-col" style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                    <span className="espacio-card-title">{espacio.nombre}</span>
                    <span className="text-sm text-muted">
                      {espacio.codigo} · Tipo: {espacio.tipo_espacio} · {espacio.creditos} créditos
                    </span>
                  </div>
                  <ChevronRight size={20} />
                </button>

                <form className="temporary-load-form" onSubmit={(event) => handleUpdateCarga(event, espacio.id)}>
                  <label>
                    Horas IP
                    <input
                      className="input"
                      name="horas_ip"
                      type="number"
                      min="0"
                      value={horasIpDraft}
                      onChange={(event) => handleCargaDraftChange(espacio.id, 'horas_ip', event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Horas TA
                    <input
                      className="input"
                      name="horas_ta"
                      type="number"
                      min="0"
                      value={horasTaDraft}
                      onChange={(event) => handleCargaDraftChange(espacio.id, 'horas_ta', event.target.value)}
                      required
                    />
                  </label>
                  <div className="temporary-derived-credit temporary-derived-credit-inline">
                    <span>Créditos calculados</span>
                    <input
                      className="input temporary-derived-credit-input"
                      type="number"
                      value={calculatedCredits || ''}
                      readOnly
                      aria-readonly="true"
                      placeholder="—"
                    />
                    <small>Actual: {espacio.creditos}. Se guarda al confirmar.</small>
                  </div>
                  <button className="button button-ghost button-small" type="submit" disabled={updateCargaMutation.isPending}>
                    <Save size={15} /> Guardar carga
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}
