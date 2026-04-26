import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface Programa {
  id: number;
  plan_estudio_ec: number;
  anio_academico: number;
  descripcion: string;
}

interface PlanEstudioEC {
  id: number;
  plan_estudio: number;
  espacio_curricular: number;
}

interface PlanEstudio {
  id: number;
  nombre: string;
}

interface EspacioCurricular {
  id: number;
  nombre: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

interface Unidad {
  id: number;
  programa: number;
  numero: number;
  descripcion: string;
  competencias?: Array<{
    id: number;
    orden: number;
    competencia: {
      id: number;
      codigo: string;
      nombre: string;
    };
  }>;
}

interface Competencia {
  id: number;
  plan_estudio: number;
  codigo: string;
  nombre: string;
}

function DocenteProgramas() {
  const currentYear = new Date().getFullYear();
  const navigate = useNavigate();
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [unidadCompetenciasDraft, setUnidadCompetenciasDraft] = useState<Record<number, number[]>>({});
  const [planEcs, setPlanEcs] = useState<PlanEstudioEC[]>([]);
  const [planes, setPlanes] = useState<PlanEstudio[]>([]);
  const [espacios, setEspacios] = useState<EspacioCurricular[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [creatingPrograma, setCreatingPrograma] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({
    open: false,
  });
  const [formState, setFormState] = useState({
    plan_estudio_ec: '',
    anio_academico: '',
    descripcion: '',
  });
  const [unidadForm, setUnidadForm] = useState({
    numero: '',
    descripcion: '',
  });
  const [editing, setEditing] = useState<Programa | null>(null);

  // Leer espacio curricular del sessionStorage
  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  const loadData = async () => {
    if (!selectedPlanEcId) return;

    setLoading(true);
    try {
      const [programaRes, unidadRes, planEcRes, planRes, espacioRes] = await Promise.all([
        api.get<PaginatedResponse<Programa>>('/programas', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<Unidad>>('/unidades', {
          params: { plan_estudio_ec_id: selectedPlanEcId },
        }),
        api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec'),
        api.get<PaginatedResponse<PlanEstudio>>('/planes-estudio'),
        api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares'),
      ]);
      setProgramas(programaRes.data.results);
      setUnidades(unidadRes.data.results);
      setPlanEcs(planEcRes.data.results);
      setPlanes(planRes.data.results);
      setEspacios(espacioRes.data.results);

      const initialDraft: Record<number, number[]> = {};
      unidadRes.data.results.forEach((unidad) => {
        initialDraft[unidad.id] = unidad.competencias?.map((item) => item.competencia.id) || [];
      });
      setUnidadCompetenciasDraft(initialDraft);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los programas del espacio seleccionado.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedPlanEcId) {
      setLoading(false);
      return;
    }

    void loadData();
  }, [selectedPlanEcId, navigate]);

  useApiAutoRefresh(() => loadData(), [selectedPlanEcId]);

  useEffect(() => {
    const loadCompetencias = async () => {
      if (!selectedPlanEcId || planEcs.length === 0) return;
      const selectedPlanEc = planEcs.find((item) => item.id === Number(selectedPlanEcId));
      if (!selectedPlanEc) return;

      try {
        const response = await api.get<PaginatedResponse<Competencia>>('/competencias', {
          params: { plan_estudio_id: selectedPlanEc.plan_estudio },
        });
        setCompetencias(response.data.results);
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudieron cargar las competencias del plan.'));
      }
    };

    loadCompetencias();
  }, [selectedPlanEcId, planEcs]);

  const programaActual = useMemo(
    () => programas.find((programa) => programa.anio_academico === currentYear) || null,
    [programas, currentYear]
  );

  const unidadesProgramaActual = useMemo(() => {
    if (!programaActual) return [];
    return unidades
      .filter((unidad) => unidad.programa === programaActual.id)
      .sort((a, b) => a.numero - b.numero);
  }, [unidades, programaActual]);

  const competenciasOrdenadas = useMemo(
    () => [...competencias].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [competencias]
  );

  const planLookup = useMemo(() => {
    const map = new Map<number, string>();
    planes.forEach((plan) => map.set(plan.id, plan.nombre));
    return map;
  }, [planes]);

  const espacioLookup = useMemo(() => {
    const map = new Map<number, string>();
    espacios.forEach((espacio) => map.set(espacio.id, espacio.nombre));
    return map;
  }, [espacios]);

  const planEcLabel = (planEcId: number) => {
    const planEc = planEcs.find((item) => item.id === planEcId);
    if (!planEc) return `Plan EC ${planEcId}`;
    const planNombre = planLookup.get(planEc.plan_estudio) || `Plan ${planEc.plan_estudio}`;
    const espacioNombre = espacioLookup.get(planEc.espacio_curricular) || `EC ${planEc.espacio_curricular}`;
    return `${planNombre} - ${espacioNombre}`;
  };

  const resetForm = () => {
    setFormState({ plan_estudio_ec: '', anio_academico: '', descripcion: '' });
    setEditing(null);
    setViewOnly(false);
    setShowForm(false);
  };

  const handleCreateProgramaCurrentYear = async () => {
    if (!selectedPlanEcId) return;
    setCreatingPrograma(true);
    try {
      await api.post<Programa>('/espacios-asignados/create_programa_if_needed', {
        plan_estudio_ec_id: Number(selectedPlanEcId),
      });
      await loadData();
      toast.success(`Programa ${currentYear} disponible para cargar actividades.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear o verificar el programa actual.'));
    } finally {
      setCreatingPrograma(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      plan_estudio_ec: Number(formState.plan_estudio_ec),
      anio_academico: Number(formState.anio_academico),
      descripcion: formState.descripcion,
    };

    if (editing) {
      try {
        const response = await api.patch<Programa>(`/programas/${editing.id}`, {
          anio_academico: payload.anio_academico,
          descripcion: payload.descripcion,
        });
        setProgramas((prev) => prev.map((item) => (item.id === editing.id ? response.data : item)));
        toast.success('Programa actualizado correctamente.');
        resetForm();
        return;
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo actualizar el programa.'));
        return;
      }
    }

    try {
      const response = await api.post<Programa>('/programas', payload);
      setProgramas((prev) => [response.data, ...prev]);
      toast.success('Programa creado correctamente.');
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear el programa.'));
    }
  };

  const handleEdit = (programa: Programa) => {
    setEditing(programa);
    setShowForm(true);
    setViewOnly(false);
    setFormState({
      plan_estudio_ec: String(programa.plan_estudio_ec),
      anio_academico: String(programa.anio_academico),
      descripcion: programa.descripcion,
    });
  };

  const handleView = (programa: Programa) => {
    setEditing(programa);
    setShowForm(true);
    setViewOnly(true);
    setFormState({
      plan_estudio_ec: String(programa.plan_estudio_ec),
      anio_academico: String(programa.anio_academico),
      descripcion: programa.descripcion,
    });
  };

  const handleDelete = async (programaId: number) => {
    setDeleteConfirm({ open: true, id: programaId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await api.delete(`/programas/${deleteConfirm.id}`);
      setProgramas((prev) => prev.filter((item) => item.id !== deleteConfirm.id));
      toast.success('Programa dado de baja correctamente.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo dar de baja el programa.'));
    } finally {
      setDeleteConfirm({ open: false });
    }
  };

  const handleCreateUnidad = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!programaActual) {
      toast.error('Primero debes crear o actualizar el programa del año actual.');
      return;
    }

    try {
      const response = await api.post<Unidad>('/unidades', {
        programa: programaActual.id,
        numero: Number(unidadForm.numero),
        descripcion: unidadForm.descripcion,
      });
      setUnidades((prev) => [...prev, response.data]);
      setUnidadCompetenciasDraft((prev) => ({ ...prev, [response.data.id]: [] }));
      setUnidadForm({ numero: '', descripcion: '' });
      await loadData();
      toast.success('Unidad agregada al programa actual.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la unidad.'));
    }
  };

  const handleSaveUnidadCompetencias = async (unidadId: number) => {
    try {
      const response = await api.post<Unidad>(`/unidades/${unidadId}/competencias`, {
        competencia_ids: unidadCompetenciasDraft[unidadId] || [],
      });
      setUnidades((prev) => prev.map((unidad) => (unidad.id === unidadId ? response.data : unidad)));
      toast.success('Competencias de unidad actualizadas.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron guardar las competencias de la unidad.'));
    }
  };

  const rows = programas.map((programa) => ({
    id: String(programa.id),
    cells: [
      planEcLabel(programa.plan_estudio_ec),
      programa.anio_academico,
      `${programa.descripcion || 'Sin descripcion'}`,
      <div className="table-actions" key={`actions-${programa.id}`}>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleView(programa)}
          title="Ver"
        >
          <Eye size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleEdit(programa)}
          title="Editar"
        >
          <Edit size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleDelete(programa.id)}
          title="Dar de baja"
        >
          <Trash2 size={18} />
        </button>
      </div>,
    ],
  }));

  // Vista de edición/creación - Pantalla completa
  if (showForm) {
    return (
      <>
        <ConfirmDialog
          open={deleteConfirm.open}
          title="Confirmar baja"
          message="Este programa se dará de baja y dejará de mostrarse en la gestión diaria, pero no se eliminará definitivamente de la base de datos."
          confirmLabel="Dar de baja"
          cancelLabel="Cancelar"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteConfirm({ open: false })}
        />

        <section className="page-header">
          <div>
            <p className="eyebrow">Programas</p>
            <h2>{viewOnly ? 'Detalle del programa' : editing ? 'Editar programa' : 'Nuevo programa'}</h2>
            <p>{selectedEspacioNombre || 'Programa'}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="button button-ghost" type="button" onClick={resetForm}>
              Volver a la lista
            </button>
          </div>
        </section>

        <SectionCard title={viewOnly ? 'Información del programa' : editing ? 'Datos del programa' : 'Crear nuevo programa'}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <select
              className="select"
              value={formState.plan_estudio_ec}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, plan_estudio_ec: event.target.value }))
              }
              disabled={Boolean(editing) || viewOnly}
              required
            >
              <option value="">Plan de estudio - Espacio curricular</option>
              {planEcs.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {planEcLabel(plan.id)}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              placeholder="Año académico"
              value={formState.anio_academico}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, anio_academico: event.target.value }))
              }
              disabled={viewOnly}
              required
            />
            <input
              className="input"
              type="text"
              placeholder="Descripción"
              value={formState.descripcion}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, descripcion: event.target.value }))
              }
              disabled={viewOnly}
            />
            <div className="form-actions">
              {!viewOnly ? (
                <button className="button" type="submit" disabled={loading}>
                  {editing ? 'Guardar cambios' : 'Crear programa'}
                </button>
              ) : null}
              <button className="button button-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>

        {editing && editing.anio_academico === currentYear ? (
          <SectionCard title="Unidades del programa">
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Para habilitar la carga de actividades, el programa actual debe tener al menos una unidad activa.
              </p>
              <form className="form-grid" onSubmit={handleCreateUnidad}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="Número de unidad"
                  value={unidadForm.numero}
                  onChange={(event) =>
                    setUnidadForm((prev) => ({ ...prev, numero: event.target.value }))
                  }
                  required
                />
                <input
                  className="input"
                  type="text"
                  placeholder="Descripción de unidad"
                  value={unidadForm.descripcion}
                  onChange={(event) =>
                    setUnidadForm((prev) => ({ ...prev, descripcion: event.target.value }))
                  }
                  required
                />
                <div className="form-actions">
                  <button className="button" type="submit">
                    Agregar unidad
                  </button>
                </div>
              </form>

              <div className="unidades-competencias-grid" style={{ marginTop: '0.9rem' }}>
                {unidades.filter((u) => u.programa === editing.id).length === 0 ? (
                  <span className="chip">Aún no hay unidades cargadas.</span>
                ) : (
                  unidades
                    .filter((u) => u.programa === editing.id)
                    .sort((a, b) => a.numero - b.numero)
                    .map((unidad) => (
                      <div className="unidad-competencia-card unidad-competencia-card-programa" key={unidad.id}>
                        <div className="unidad-competencia-head">
                          <span className="chip unidad-competencia-chip">
                            U{unidad.numero}: {unidad.descripcion}
                          </span>
                          <span className="unidad-competencia-counter">
                            {(unidadCompetenciasDraft[unidad.id] || []).length} seleccionadas
                          </span>
                        </div>
                        <select
                          className="select competencias-select"
                          multiple
                          value={(unidadCompetenciasDraft[unidad.id] || []).map(String)}
                          onChange={(event) => {
                            const ids = Array.from(event.target.selectedOptions).map((option) =>
                              Number(option.value)
                            );
                            setUnidadCompetenciasDraft((prev) => ({ ...prev, [unidad.id]: ids }));
                          }}
                          aria-label={`Competencias de unidad ${unidad.numero}`}
                        >
                          {competenciasOrdenadas.map((competencia) => (
                            <option key={competencia.id} value={competencia.id}>
                              {competencia.codigo} - {competencia.nombre}
                            </option>
                          ))}
                        </select>
                        <div className="unidad-competencia-actions">
                          <button
                            className="button button-small"
                            type="button"
                            onClick={() => handleSaveUnidadCompetencias(unidad.id)}
                          >
                            Guardar competencias
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
              {competenciasOrdenadas.length > 0 ? (
                <p className="muted unidades-competencias-help">
                  Consejo: usa Ctrl (o Cmd en Mac) para seleccionar múltiples competencias en cada unidad.
                </p>
              ) : null}
            </>
          </SectionCard>
        ) : null}
      </>
    );
  }

  // Vista de lista principal
  if (!selectedPlanEcId) {
    return (
      <SectionCard title="Seleccion de espacio curricular">
        <p className="muted">
          Usa el desplegable superior para elegir un espacio curricular y comenzar a cargar programas.
        </p>
      </SectionCard>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Confirmar baja"
        message="Este programa se dará de baja y dejará de mostrarse en la gestión diaria, pero no se eliminará definitivamente de la base de datos."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm({ open: false })}
      />

      <section className="page-header">
        <div>
          <p className="eyebrow">Programas</p>
          <h2>{selectedEspacioNombre || 'Programa'}</h2>
          <p>
            Primero verifica el programa {currentYear}. Si está actualizado, podrás cargar actividades.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!programaActual ? (
            <button
              className="button button-ghost"
              type="button"
              onClick={() => navigate('/docente/agenda-cursado')}
            >
              Configurar agenda de cursado
            </button>
          ) : null}
          {programaActual ? (
            <button
              className="button"
              type="button"
              onClick={handleCreateProgramaCurrentYear}
              disabled={creatingPrograma}
            >
              {creatingPrograma ? (
                <>Creando...</>
              ) : (
                <>
                  <Plus size={18} style={{ marginRight: '0.5rem' }} />
                  Crear programa {currentYear}
                </>
              )}
            </button>
          ) : (
            <button
              className="button"
              type="button"
              onClick={() => {
                if (unidadesProgramaActual.length === 0) {
                  toast.error('Antes de cargar actividades debes agregar al menos una unidad al programa actual.');
                  return;
                }
                navigate('/docente/actividades');
              }}
            >
              Ir a actividades
            </button>
          )}
          <button
            className="button"
            type="button"
            onClick={() => {
              setShowForm(true);
              setEditing(null);
              setViewOnly(false);
            }}
          >
            Nuevo programa
          </button>
        </div>
      </section>

      <SectionCard title={`Programa actual (${currentYear})`}>
        {!programaActual ? (
          <div className="content-empty">
            <p>No existe un programa para el año {currentYear}.</p>
            <p>Crea uno usando el botón "Crear programa {currentYear}" arriba.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <p className="muted" style={{ marginTop: 0 }}>
                <strong>Descripción:</strong> {programaActual.descripcion || 'Sin descripción'}
              </p>
              <p className="muted">
                <strong>Unidades:</strong> {unidadesProgramaActual.length}{' '}
                {unidadesProgramaActual.length === 1 ? 'unidad' : 'unidades'}
              </p>
            </div>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={() => handleEdit(programaActual)}
              >
                <Edit size={18} style={{ marginRight: '0.5rem' }} />
                Editar programa y unidades
              </button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Historial de programas">
        {rows.length === 0 ? (
          <div className="content-empty">No hay programas registrados aún.</div>
        ) : (
          <BasicTable
            columns={['Espacio curricular', 'Año', 'Descripción', 'Acciones']}
            rows={rows}
          />
        )}
      </SectionCard>
    </>
  );
}

export default DocenteProgramas;
