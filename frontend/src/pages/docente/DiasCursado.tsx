import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface CalendarGenerateResponse {
  programa_id: number;
  created: number;
  updated: number;
  skipped: number;
}

const diaClaseSchema = z.object({
  dia_semana: z.number().int().min(0).max(6, 'Día inválido'),
  hora_inicio: z.string().optional(),
  hora_fin: z.string().optional(),
}).refine(data => {
  if (data.hora_inicio && !data.hora_fin) return false;
  if (!data.hora_inicio && data.hora_fin) return false;
  return true;
}, { message: 'Completa hora de inicio y fin, o deja ambas vacías.', path: ['hora_fin'] }).refine(data => {
  if (data.hora_inicio && data.hora_fin && data.hora_inicio >= data.hora_fin) return false;
  return true;
}, { message: 'La hora de fin debe ser posterior a la hora de inicio.', path: ['hora_fin'] });

type DiaClaseFormValues = z.infer<typeof diaClaseSchema>;

interface Programa {
  id: number;
  plan_estudio_ec: number;
  anio_academico: number;
  descripcion: string;
}

interface DiaClase {
  id: number;
  programa: number;
  dia_semana: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  activo: boolean;
}

interface PaginatedResponse<T> {
  results: T[];
}

const DIAS_SEMANA = [
  { value: 0, label: 'Lunes' },
  { value: 1, label: 'Martes' },
  { value: 2, label: 'Miércoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sábado' },
  { value: 6, label: 'Domingo' },
];

function DocenteDiasCursado() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creatingPrograma, setCreatingPrograma] = useState(false);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [diasClase, setDiasClase] = useState<DiaClase[]>([]);

  const [calendarGenerateState, setCalendarGenerateState] = useState({
    fecha_desde: `${currentYear}-03-01`,
    fecha_hasta: `${currentYear}-11-30`,
    sobrescribir: false,
    loading: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DiaClaseFormValues>({
    resolver: zodResolver(diaClaseSchema),
    defaultValues: {
      dia_semana: 0,
      hora_inicio: '',
      hora_fin: '',
    },
  });

  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  const programaActual = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const diasProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return diasClase
      .filter((item) => item.programa === programaActual.id && item.activo)
      .sort((a, b) => a.dia_semana - b.dia_semana);
  }, [diasClase, programaActual]);

  const loadData = useCallback(async (background = false) => {
    if (!selectedPlanEcId) return;

    if (!background) {
      setLoading(true);
    }

    try {
      const [programaRes, diasRes] = await Promise.all([
        api.get<PaginatedResponse<Programa>>('/programas', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<DiaClase>>('/dias-clase', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
      ]);

      setProgramas(programaRes.data.results);
      setDiasClase(diasRes.data.results);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los días de cursado.'));
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
      <SectionCard title="Selección de espacio curricular">
        <p className="muted">
          Usa el desplegable superior para elegir un espacio curricular y configurar sus días de cursado.
        </p>
      </SectionCard>
    );
  }

  const handleCreateProgramaCurrentYear = async () => {
    if (!selectedPlanEcId) return;

    setCreatingPrograma(true);
    try {
      await api.post('/espacios-asignados/create_programa_if_needed', {
        plan_estudio_ec_id: Number(selectedPlanEcId),
      });
      await loadData();
      toast.success(`Programa ${currentYear} listo para configurar días de cursado.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear o verificar el programa actual.'));
    } finally {
      setCreatingPrograma(false);
    }
  };

  const onSubmit = async (data: DiaClaseFormValues) => {
    if (!programaActual) {
      toast.error('Debes tener programa del año actual para cargar días.');
      return;
    }

    try {
      const response = await api.post<DiaClase>('/dias-clase', {
        programa: programaActual.id,
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio || null,
        hora_fin: data.hora_fin || null,
        activo: true,
      });

      setDiasClase((prev) => [...prev, response.data]);
      reset();
      toast.success('Dia de cursado agregado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo agregar el dia de cursado.'));
    }
  };

  const handleDeleteDiaClase = async (diaClaseId: number) => {
    try {
      await api.delete(`/dias-clase/${diaClaseId}`);
      setDiasClase((prev) => prev.filter((item) => item.id !== diaClaseId));
      toast.success('Dia de cursado eliminado.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el dia de cursado.'));
    }
  };

  const handleGenerateCalendarRange = async () => {
    if (!programaActual) {
      toast.error('Debes tener programa del año actual.');
      return;
    }
    if (!calendarGenerateState.fecha_desde || !calendarGenerateState.fecha_hasta) {
      toast.error('Debes indicar fecha desde y fecha hasta.');
      return;
    }

    setCalendarGenerateState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await api.post<CalendarGenerateResponse>('/clases-calendario/generar-rango', {
        programa_id: programaActual.id,
        fecha_desde: calendarGenerateState.fecha_desde,
        fecha_hasta: calendarGenerateState.fecha_hasta,
        sobrescribir: calendarGenerateState.sobrescribir,
      });

      const { created, updated, skipped } = response.data;
      toast.success(`Calendario generado: ${created} nuevas, ${updated} actualizadas, ${skipped} omitidas.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo generar el calendario por rango.'));
    } finally {
      setCalendarGenerateState((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatDiaLabel = (diaSemana: number) => {
    return DIAS_SEMANA.find((item) => item.value === diaSemana)?.label || `Dia ${diaSemana}`;
  };

  if (loading) {
    return (
      <SectionCard title="Agenda de cursado">
        <p className="muted">Cargando configuracion...</p>
      </SectionCard>
    );
  }

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Programación semanal</p>
          <h2>Agenda de cursado</h2>
          <p>{selectedEspacioNombre || 'Espacio curricular seleccionado'}</p>
        </div>
        {programaActual ? (
          <button className="button" type="button" onClick={() => navigate('/docente/planificacion')}>
            Ir a planificación IP
          </button>
        ) : null}
      </section>

      <SectionCard title={`Programa actual (${currentYear})`}>
        {!programaActual ? (
          <>
            <p className="muted">No existe un programa para el año {currentYear}.</p>
            <div className="form-actions mt-2">
              <button
                className="button"
                type="button"
                onClick={handleCreateProgramaCurrentYear}
                disabled={creatingPrograma}
              >
                {creatingPrograma ? 'Creando...' : `Crear programa ${currentYear}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted mt-0">
              Configurá aquí los días y franjas horarias de clase que se usarán luego en la planificación IP.
            </p>

            <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <select
                  className={`select ${errors.dia_semana ? 'input-error' : ''}`}
                  aria-invalid={errors.dia_semana ? 'true' : 'false'}
                  {...register('dia_semana', { valueAsNumber: true })}
                >
                  <option value="">Día de la semana</option>
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia.value} value={dia.value}>
                      {dia.label}
                    </option>
                  ))}
                </select>
                {errors.dia_semana && (
                  <span className="error-text" role="alert">{errors.dia_semana.message}</span>
                )}
              </div>
              <div>
                <input
                  className={`input ${errors.hora_inicio ? 'input-error' : ''}`}
                  type="time"
                  aria-invalid={errors.hora_inicio ? 'true' : 'false'}
                  {...register('hora_inicio')}
                />
                {errors.hora_inicio && (
                  <span className="error-text" role="alert">{errors.hora_inicio.message}</span>
                )}
              </div>
              <div>
                <input
                  className={`input ${errors.hora_fin ? 'input-error' : ''}`}
                  type="time"
                  aria-invalid={errors.hora_fin ? 'true' : 'false'}
                  {...register('hora_fin')}
                />
                {errors.hora_fin && (
                  <span className="error-text" role="alert">{errors.hora_fin.message}</span>
                )}
              </div>
              <div className="form-actions">
                <button className="button" type="submit">
                  <Plus size={16} className="mr-1" />
                  Agregar bloque
                </button>
              </div>
            </form>

            <div className="chip-grid mt-3">
              {diasProgramaActual.length === 0 ? (
                <span className="chip">Aún no hay bloques cargados en la agenda semanal.</span>
              ) : (
                diasProgramaActual.map((dia) => (
                  <div className="unidad-competencia-card" key={dia.id}>
                    <span className="chip">
                      {formatDiaLabel(dia.dia_semana)}
                      {dia.hora_inicio && dia.hora_fin ? ` (${dia.hora_inicio} - ${dia.hora_fin})` : ''}
                    </span>
                    <div className="form-actions mt-1">
                      <button
                        className="button button-ghost button-small"
                        type="button"
                        onClick={() => handleDeleteDiaClase(dia.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <hr className="divider mt-4" />

            <div className="generate-calendar-box">
              <p className="muted mb-2">
                Generá las clases del calendario a partir de los bloques semanales configurados arriba.
                Esto crea una fecha concreta por cada bloque semanal dentro del rango indicado.
              </p>
              <div className="form-row">
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
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}

export default DocenteDiasCursado;
