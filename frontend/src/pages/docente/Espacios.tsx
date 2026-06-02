import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FlaskConical, Save } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';

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
  creditos: string;
  horas_ip: string;
  horas_ta: string;
  plan_estudio: string;
}

const defaultTemporaryForm: TemporaryEspacioForm = {
  codigo: '',
  nombre: '',
  tipo_espacio: 'T1',
  anio_cursada: '1',
  periodo: 'ANUAL',
  creditos: '1',
  horas_ip: '0',
  horas_ta: '0',
  plan_estudio: '',
};

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return typeof value === 'object' && value !== null && 'results' in value && Array.isArray((value as PaginatedResponse<T>).results);
}

export default function DocenteEspacios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [temporaryForm, setTemporaryForm] = useState<TemporaryEspacioForm>(defaultTemporaryForm);

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

  const createTemporaryEspacioMutation = useMutation({
    mutationFn: (payload: TemporaryEspacioForm) => api.post<TemporaryEspacioResponse>('/espacios-asignados/temporal/espacio', {
      codigo: payload.codigo,
      nombre: payload.nombre,
      tipo_espacio: payload.tipo_espacio,
      anio_cursada: Number(payload.anio_cursada),
      periodo: payload.periodo,
      creditos: Number(payload.creditos),
      horas_ip: Number(payload.horas_ip),
      horas_ta: Number(payload.horas_ta),
      plan_estudio: Number(payload.plan_estudio),
    }),
    onSuccess: (response) => {
      const { espacio, plan_estudio_ec_id: planEcId } = response.data;
      queryClient.invalidateQueries({ queryKey: ['espacios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['planes-estudio-ec'] });
      sessionStorage.setItem('selected_espacio_curricular_id', String(espacio.id));
      sessionStorage.setItem('selected_plan_estudio_ec_id', String(planEcId));
      sessionStorage.setItem('selected_espacio_nombre', espacio.nombre);
      setTemporaryForm((current) => ({ ...defaultTemporaryForm, plan_estudio: current.plan_estudio }));
      toast.success('Espacio temporal cargado y asignado. Ya podés crear el programa y planificar.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el espacio temporal.'));
    },
  });

  const updateCargaMutation = useMutation({
    mutationFn: (payload: { espacio_curricular_id: number; creditos: number; horas_ip: number; horas_ta: number }) => (
      api.patch<{ espacio: EspacioCurricular; temporary: true }>('/espacios-asignados/temporal/carga-horaria', payload)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['espacios-asignados'] });
      queryClient.invalidateQueries({ queryKey: ['espacios-curriculares'] });
      toast.success('Créditos y horas actualizados temporalmente.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la carga horaria temporal.'));
    },
  });

  const loading = loadingEspacios || loadingPlanEcs || loadingPlanes;

  const planEcsMap = useMemo(() => {
    const map = new Map<number, number>();
    planEcsData.forEach((planEc) => {
      map.set(planEc.espacio_curricular, planEc.id);
    });
    return map;
  }, [planEcsData]);

  const handleSelectEspacio = (espacio: EspacioCurricular) => {
    const planEcId = planEcsMap.get(espacio.id);
    if (planEcId) {
      sessionStorage.setItem('selected_espacio_curricular_id', espacio.id.toString());
      sessionStorage.setItem('selected_plan_estudio_ec_id', planEcId.toString());
      sessionStorage.setItem('selected_espacio_nombre', espacio.nombre);

      navigate('/docente/programas');
      return;
    }

    toast.error('No se encontró el plan de estudio asociado para este espacio. Contacta al administrador.');
  };

  const handleTemporaryFieldChange = (field: keyof TemporaryEspacioForm, value: string) => {
    setTemporaryForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateTemporaryEspacio = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!temporaryForm.plan_estudio) {
      toast.error('Seleccioná el plan de estudio donde se vinculará el espacio.');
      return;
    }

    createTemporaryEspacioMutation.mutate(temporaryForm);
  };

  const handleUpdateCarga = (event: FormEvent<HTMLFormElement>, espacioId: number) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateCargaMutation.mutate({
      espacio_curricular_id: espacioId,
      creditos: Number(formData.get('creditos') || 0),
      horas_ip: Number(formData.get('horas_ip') || 0),
      horas_ta: Number(formData.get('horas_ta') || 0),
    });
  };

  const renderTemporaryTools = () => (
    <SectionCard title="Modo prueba docente (temporal)">
      <div className="temporary-tool-callout">
        <FlaskConical size={22} />
        <div>
          <strong>Cargas habilitadas solo para acelerar pruebas.</strong>
          <p>
            Podés crear un espacio curricular, asignártelo y ajustar créditos/horas IP-TA.
            Esta funcionalidad es temporal y queda documentada para retirarla cuando llegue la carga oficial.
          </p>
        </div>
      </div>

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
          Créditos
          <input
            className="input"
            type="number"
            min="1"
            value={temporaryForm.creditos}
            onChange={(event) => handleTemporaryFieldChange('creditos', event.target.value)}
            required
          />
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
        <div className="form-actions form-field-full">
          <button className="button" type="submit" disabled={createTemporaryEspacioMutation.isPending || planes.length === 0}>
            {createTemporaryEspacioMutation.isPending ? 'Cargando...' : 'Cargar y asignarme espacio'}
          </button>
        </div>
      </form>
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
          Seleccioná un espacio curricular para continuar con tu planificación anual o ajustá créditos/horas de forma temporal.
        </p>

        <div className="flex-col gap-3">
          {espacios.map((espacio) => (
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
                  Créditos
                  <input className="input" name="creditos" type="number" min="1" defaultValue={espacio.creditos} required />
                </label>
                <label>
                  Horas IP
                  <input className="input" name="horas_ip" type="number" min="0" defaultValue={espacio.horas_ip} required />
                </label>
                <label>
                  Horas TA
                  <input className="input" name="horas_ta" type="number" min="0" defaultValue={espacio.horas_ta} required />
                </label>
                <button className="button button-ghost button-small" type="submit" disabled={updateCargaMutation.isPending}>
                  <Save size={15} /> Guardar carga
                </button>
              </form>
            </article>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
