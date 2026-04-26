import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

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
  { value: 2, label: 'Miercoles' },
  { value: 3, label: 'Jueves' },
  { value: 4, label: 'Viernes' },
  { value: 5, label: 'Sabado' },
  { value: 6, label: 'Domingo' },
];

function DocenteDiasCursado() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creatingPrograma, setCreatingPrograma] = useState(false);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [diasClase, setDiasClase] = useState<DiaClase[]>([]);
  const [diaClaseForm, setDiaClaseForm] = useState({ dia_semana: '', hora_inicio: '', hora_fin: '' });

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
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los dias de cursado.'));
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
          Usa el desplegable superior para elegir un espacio curricular y configurar sus dias de cursado.
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
      toast.success(`Programa ${currentYear} listo para configurar dias de cursado.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear o verificar el programa actual.'));
    } finally {
      setCreatingPrograma(false);
    }
  };

  const handleCreateDiaClase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!programaActual) {
      toast.error('Debes tener programa del año actual para cargar días.');
      return;
    }

    const { hora_inicio: horaInicio, hora_fin: horaFin } = diaClaseForm;
    if (Boolean(horaInicio) !== Boolean(horaFin)) {
      toast.error('Completa hora de inicio y hora de fin, o deja ambas vacias.');
      return;
    }

    if (horaInicio && horaFin && horaInicio >= horaFin) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    try {
      const response = await api.post<DiaClase>('/dias-clase', {
        programa: programaActual.id,
        dia_semana: Number(diaClaseForm.dia_semana),
        hora_inicio: diaClaseForm.hora_inicio || null,
        hora_fin: diaClaseForm.hora_fin || null,
        activo: true,
      });

      setDiasClase((prev) => [...prev, response.data]);
      setDiaClaseForm({ dia_semana: '', hora_inicio: '', hora_fin: '' });
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
          <p className="eyebrow">Programacion semanal</p>
          <h2>Agenda de cursado</h2>
          <p>{selectedEspacioNombre || 'Espacio curricular seleccionado'}</p>
        </div>
        {programaActual ? (
          <button className="button" type="button" onClick={() => navigate('/docente/planificacion')}>
            Ir a planificacion IP
          </button>
        ) : null}
      </section>

      <SectionCard title={`Programa actual (${currentYear})`}>
        {!programaActual ? (
          <>
            <p className="muted">No existe un programa para el año {currentYear}.</p>
            <div className="form-actions" style={{ marginTop: '0.8rem' }}>
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
            <p className="muted" style={{ marginTop: 0 }}>
              Configura aqui los dias y franjas horarias de clase que se usaran luego en la planificacion IP.
            </p>

            <form className="form-grid" onSubmit={handleCreateDiaClase}>
              <select
                className="select"
                value={diaClaseForm.dia_semana}
                onChange={(event) =>
                  setDiaClaseForm((prev) => ({ ...prev, dia_semana: event.target.value }))
                }
                required
              >
                <option value="">Día de la semana</option>
                {DIAS_SEMANA.map((dia) => (
                  <option key={dia.value} value={dia.value}>
                    {dia.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="time"
                value={diaClaseForm.hora_inicio}
                onChange={(event) =>
                  setDiaClaseForm((prev) => ({ ...prev, hora_inicio: event.target.value }))
                }
              />
              <input
                className="input"
                type="time"
                value={diaClaseForm.hora_fin}
                onChange={(event) =>
                  setDiaClaseForm((prev) => ({ ...prev, hora_fin: event.target.value }))
                }
              />
              <div className="form-actions">
                <button className="button" type="submit">
                  <Plus size={16} style={{ marginRight: '0.35rem' }} />
                  Agregar bloque
                </button>
              </div>
            </form>

            <div className="chip-grid" style={{ marginTop: '1rem' }}>
              {diasProgramaActual.length === 0 ? (
                <span className="chip">Aún no hay bloques cargados en la agenda semanal.</span>
              ) : (
                diasProgramaActual.map((dia) => (
                  <div className="unidad-competencia-card" key={dia.id}>
                    <span className="chip">
                      {formatDiaLabel(dia.dia_semana)}
                      {dia.hora_inicio && dia.hora_fin ? ` (${dia.hora_inicio} - ${dia.hora_fin})` : ''}
                    </span>
                    <div className="form-actions" style={{ marginTop: '0.5rem' }}>
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
          </>
        )}
      </SectionCard>
    </>
  );
}

export default DocenteDiasCursado;
