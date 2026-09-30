import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Edit, Trash2, Plus, BookOpen, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';

const programaSchema = z.object({
  plan_estudio_ec: z.string().min(1, 'Seleccioná un plan de estudio'),
  anio_academico: z.number().min(2000, 'Año inválido'),
  descripcion: z.string().optional(),
  fundamentacion: z.string().optional(),
  objetivos_generales: z.string().optional(),
  objetivos_especificos: z.string().optional(),
  competencias: z.string().optional(),
});
type ProgramaFormValues = z.infer<typeof programaSchema>;

const unidadSchema = z.object({
  numero: z.number().int().min(1, 'El número de unidad debe ser mayor a 0'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
});
type UnidadFormValues = z.infer<typeof unidadSchema>;

interface Programa {
  id: number;
  plan_estudio_ec: number;
  anio_academico: number;
  descripcion: string;
  fundamentacion?: string;
  objetivos_generales?: string;
  objetivos_especificos?: string;
  competencias?: string;
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
  const queryClient = useQueryClient();
  const [unidadCompetenciasDraft, setUnidadCompetenciasDraft] = useState<Record<number, number[]>>({});
  const [showCompetencias, setShowCompetencias] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({
    open: false,
  });
  const [editing, setEditing] = useState<Programa | null>(null);

  const {
    register: registerPrograma,
    handleSubmit: handleSubmitPrograma,
    formState: { errors: errorsPrograma },
    reset: resetProgramaForm,
  } = useForm<ProgramaFormValues>({
    resolver: zodResolver(programaSchema),
    defaultValues: {
      plan_estudio_ec: '',
      anio_academico: currentYear,
      descripcion: '',
      fundamentacion: '',
      objetivos_generales: '',
      objetivos_especificos: '',
      competencias: '',
    },
  });

  const {
    register: registerUnidad,
    handleSubmit: handleSubmitUnidad,
    formState: { errors: errorsUnidad },
    reset: resetUnidadForm,
  } = useForm<UnidadFormValues>({
    resolver: zodResolver(unidadSchema),
    defaultValues: {
      numero: 1,
      descripcion: '',
    },
  });

  // Leer espacio curricular del sessionStorage
  const selectedPlanEcId = sessionStorage.getItem('selected_plan_estudio_ec_id');
  const selectedEspacioNombre = sessionStorage.getItem('selected_espacio_nombre');

  const { data: programas = [] } = useQuery({
    queryKey: ['programas', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Programa>>('/programas', {
      params: { plan_estudio_ec_id: selectedPlanEcId },
    }).then(res => res.data.results),
    enabled: !!selectedPlanEcId,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades', selectedPlanEcId],
    queryFn: () => api.get<PaginatedResponse<Unidad>>('/unidades', {
      params: { plan_estudio_ec_id: selectedPlanEcId },
    }).then(res => {
      const data = res.data.results;
      const initialDraft: Record<number, number[]> = {};
      data.forEach((unidad) => {
        initialDraft[unidad.id] = unidad.competencias?.map((item) => item.competencia.id) || [];
      });
      setUnidadCompetenciasDraft(initialDraft);
      return data;
    }),
    enabled: !!selectedPlanEcId,
  });

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

  const { data: planEcs = [] } = useQuery({
    queryKey: ['planes-estudio-ec'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec').then(res => res.data.results),
    enabled: !!selectedPlanEcId,
  });

  const { data: planes = [] } = useQuery({
    queryKey: ['planes-estudio'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudio>>('/planes-estudio').then(res => res.data.results),
    enabled: !!selectedPlanEcId,
  });

  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-curriculares'],
    queryFn: () => api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares').then(res => res.data.results),
    enabled: !!selectedPlanEcId,
  });

  const selectedPlanEc = useMemo(() => planEcs.find((item) => item.id === Number(selectedPlanEcId)), [planEcs, selectedPlanEcId]);

  const { data: competencias = [] } = useQuery({
    queryKey: ['competencias', selectedPlanEc?.plan_estudio],
    queryFn: () => api.get<PaginatedResponse<Competencia>>('/competencias', {
      params: { plan_estudio_id: selectedPlanEc?.plan_estudio },
    }).then(res => res.data.results),
    enabled: showCompetencias && !!selectedPlanEc?.plan_estudio,
  });

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
    resetProgramaForm({ plan_estudio_ec: '', anio_academico: currentYear, descripcion: '', fundamentacion: '', objetivos_generales: '', objetivos_especificos: '', competencias: '' });
    setEditing(null);
    setViewOnly(false);
    setShowForm(false);
  };

  const createProgramaMutation = useMutation({
    mutationFn: () => api.post<Programa>('/espacios-asignados/create_programa_if_needed', {
      plan_estudio_ec_id: Number(selectedPlanEcId),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas'] });
      toast.success(`Programa ${currentYear} disponible para cargar actividades.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo crear o verificar el programa actual.'));
    },
  });

  const handleCreateProgramaCurrentYear = () => {
    if (!selectedPlanEcId) return;
    createProgramaMutation.mutate();
  };

  const saveProgramaMutation = useMutation({
    mutationFn: (payload: { plan_estudio_ec: number; anio_academico: number; descripcion: string; fundamentacion: string; objetivos_generales: string; objetivos_especificos: string; competencias: string }) => {
      if (editing) {
        return api.patch<Programa>(`/programas/${editing.id}`, {
          anio_academico: payload.anio_academico,
          descripcion: payload.descripcion,
          fundamentacion: payload.fundamentacion,
          objetivos_generales: payload.objetivos_generales,
          objetivos_especificos: payload.objetivos_especificos,
          competencias: payload.competencias,
        });
      }
      return api.post<Programa>('/programas', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas'] });
      toast.success(editing ? 'Programa actualizado correctamente.' : 'Programa creado correctamente.');
      resetForm();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, editing ? 'No se pudo actualizar el programa.' : 'No se pudo crear el programa.'));
    },
  });

  const onSubmitPrograma = (data: ProgramaFormValues) => {
    saveProgramaMutation.mutate({
      plan_estudio_ec: Number(data.plan_estudio_ec),
      anio_academico: Number(data.anio_academico),
      descripcion: data.descripcion || '',
      fundamentacion: data.fundamentacion || '',
      objetivos_generales: data.objetivos_generales || '',
      objetivos_especificos: data.objetivos_especificos || '',
      competencias: data.competencias || '',
    });
  };

  const handleEdit = (programa: Programa) => {
    setEditing(programa);
    setShowForm(true);
    setViewOnly(false);
    resetProgramaForm({
      plan_estudio_ec: String(programa.plan_estudio_ec),
      anio_academico: programa.anio_academico,
      descripcion: programa.descripcion || '',
      fundamentacion: programa.fundamentacion || '',
      objetivos_generales: programa.objetivos_generales || '',
      objetivos_especificos: programa.objetivos_especificos || '',
      competencias: programa.competencias || '',
    });
  };

  const handleView = (programa: Programa) => {
    setEditing(programa);
    setShowForm(true);
    setViewOnly(true);
    resetProgramaForm({
      plan_estudio_ec: String(programa.plan_estudio_ec),
      anio_academico: programa.anio_academico,
      descripcion: programa.descripcion || '',
      fundamentacion: programa.fundamentacion || '',
      objetivos_generales: programa.objetivos_generales || '',
      objetivos_especificos: programa.objetivos_especificos || '',
      competencias: programa.competencias || '',
    });
  };

  const deleteProgramaMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/programas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programas'] });
      toast.success('Programa dado de baja correctamente.');
      setDeleteConfirm({ open: false });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo dar de baja el programa.'));
      setDeleteConfirm({ open: false });
    },
  });

  const handleDelete = (programaId: number) => {
    setDeleteConfirm({ open: true, id: programaId });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;
    deleteProgramaMutation.mutate(deleteConfirm.id);
  };

  const createUnidadMutation = useMutation({
    mutationFn: (payload: { programa: number; numero: number; descripcion: string }) => api.post<Unidad>('/unidades', payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
      setUnidadCompetenciasDraft((prev) => ({ ...prev, [response.data.id]: [] }));
      resetUnidadForm({ numero: 1, descripcion: '' });
      toast.success('Unidad agregada al programa actual.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la unidad.'));
    },
  });

  const onSubmitUnidad = (data: UnidadFormValues) => {
    if (!programaActual) {
      toast.error('Primero debes crear o actualizar el programa del año actual.');
      return;
    }

    createUnidadMutation.mutate({
      programa: programaActual.id,
      numero: data.numero,
      descripcion: data.descripcion,
    });
  };

  const saveUnidadCompetenciasMutation = useMutation({
    mutationFn: (unidadId: number) => api.post<Unidad>(`/unidades/${unidadId}/competencias`, {
      competencia_ids: unidadCompetenciasDraft[unidadId] || [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades'] });
      toast.success('Competencias de unidad actualizadas.');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'No se pudieron guardar las competencias de la unidad.'));
    },
  });

  const handleSaveUnidadCompetencias = (unidadId: number) => {
    saveUnidadCompetenciasMutation.mutate(unidadId);
  };

  const rows = programas.map((programa) => ({
    id: String(programa.id),
    cells: [
      <span className="badge badge-gray" key={`plan-${programa.id}`}>{planEcLabel(programa.plan_estudio_ec)}</span>,
      <span className="badge badge-info" key={`year-${programa.id}`}>{programa.anio_academico}</span>,
      `${programa.descripcion || 'Sin descripción'}`,
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
          <div className="flex-row-gap">
            <button className="button button-ghost" type="button" onClick={resetForm}>
              Volver a la lista
            </button>
          </div>
        </section>

        <SectionCard title={viewOnly ? 'Información del programa' : editing ? 'Datos del programa' : 'Crear nuevo programa'}>
          <form className="form-grid" onSubmit={handleSubmitPrograma(onSubmitPrograma)}>
            <div className="form-group">
              <label className="form-label form-label-required">
                <FileText size={16} /> Plan de Estudio / Espacio Curricular
              </label>
              <select
                className={`select ${errorsPrograma.plan_estudio_ec ? 'input-error' : ''}`}
                disabled={Boolean(editing) || viewOnly}
                aria-invalid={errorsPrograma.plan_estudio_ec ? 'true' : 'false'}
                {...registerPrograma('plan_estudio_ec')}
              >
                <option value="">Seleccioná un plan - espacio</option>
                {planEcs.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {planEcLabel(plan.id)}
                  </option>
                ))}
              </select>
              {errorsPrograma.plan_estudio_ec && (
                <span className="error-text" role="alert">{errorsPrograma.plan_estudio_ec.message}</span>
              )}
            </div>
            {([
              ['fundamentacion', 'Fundamentación'],
              ['objetivos_generales', 'Objetivos generales'],
              ['objetivos_especificos', 'Objetivos específicos'],
              ['competencias', 'Competencias'],
            ] as const).map(([name, label]) => (
              <div className="form-group form-field-full" key={name}>
                <label className="form-label" htmlFor={`programa-${name}`}>{label}</label>
                <textarea
                  id={`programa-${name}`}
                  className="input"
                  rows={4}
                  placeholder={label}
                  disabled={viewOnly}
                  {...registerPrograma(name)}
                />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label form-label-required">
                <Calendar size={16} /> Año Académico
              </label>
              <input
                className={`input ${errorsPrograma.anio_academico ? 'input-error' : ''}`}
                type="number"
                placeholder="Año académico"
                disabled={viewOnly}
                aria-invalid={errorsPrograma.anio_academico ? 'true' : 'false'}
                {...registerPrograma('anio_academico', { valueAsNumber: true })}
              />
              {errorsPrograma.anio_academico && (
                <span className="error-text" role="alert">{errorsPrograma.anio_academico.message}</span>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">
                <BookOpen size={16} /> Descripción
              </label>
              <input
                className={`input ${errorsPrograma.descripcion ? 'input-error' : ''}`}
                type="text"
                placeholder="Descripción"
                disabled={viewOnly}
                aria-invalid={errorsPrograma.descripcion ? 'true' : 'false'}
                {...registerPrograma('descripcion')}
              />
              {errorsPrograma.descripcion && (
                <span className="error-text" role="alert">{errorsPrograma.descripcion.message}</span>
              )}
            </div>
            <div className="form-actions form-field-full">
              {!viewOnly ? (
                <button className="button" type="submit" disabled={saveProgramaMutation.isPending}>
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
              <p className="muted mt-0">
                Para habilitar la carga de actividades, el programa actual debe tener al menos una unidad activa.
              </p>
              <form className="form-grid" onSubmit={handleSubmitUnidad(onSubmitUnidad)}>
                <div className="form-group">
                  <label className="form-label form-label-required">
                    Número de Unidad
                  </label>
                  <input
                    className={`input ${errorsUnidad.numero ? 'input-error' : ''}`}
                    type="number"
                    min={1}
                    placeholder="Número de unidad"
                    aria-invalid={errorsUnidad.numero ? 'true' : 'false'}
                    {...registerUnidad('numero', { valueAsNumber: true })}
                  />
                  {errorsUnidad.numero && (
                    <span className="error-text" role="alert">{errorsUnidad.numero.message}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required">
                    Descripción / Nombre de Unidad
                  </label>
                  <input
                    className={`input ${errorsUnidad.descripcion ? 'input-error' : ''}`}
                    type="text"
                    placeholder="Descripción de unidad"
                    aria-invalid={errorsUnidad.descripcion ? 'true' : 'false'}
                    {...registerUnidad('descripcion')}
                  />
                  {errorsUnidad.descripcion && (
                    <span className="error-text" role="alert">{errorsUnidad.descripcion.message}</span>
                  )}
                </div>
                <div className="form-actions form-field-full">
                  <button className="button" type="submit" disabled={createUnidadMutation.isPending}>
                    Agregar unidad
                  </button>
                </div>
              </form>

              <div className="temporary-tool-callout mt-3">
                <div>
                  <strong>Competencias ocultas temporalmente.</strong>
                  <p>
                    Para priorizar el diseño de la planificación, la vinculación de competencias se omite por defecto.
                    Podés volver a mostrarla si necesitás cargar esa trazabilidad.
                  </p>
                </div>
                <button
                  className="button button-ghost button-small"
                  type="button"
                  onClick={() => setShowCompetencias((value) => !value)}
                >
                  {showCompetencias ? 'Ocultar competencias' : 'Mostrar competencias'}
                </button>
              </div>

              <div className="unidades-competencias-grid">
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
                          {showCompetencias ? (
                            <span className="unidad-competencia-counter">
                              {(unidadCompetenciasDraft[unidad.id] || []).length} seleccionadas
                            </span>
                          ) : (
                            <span className="unidad-competencia-counter">Competencias omitidas</span>
                          )}
                        </div>
                        {showCompetencias ? (
                          <>
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
                          </>
                        ) : (
                          <p className="muted unidades-competencias-help">
                            Unidad disponible para planificar actividades sin seleccionar competencias.
                          </p>
                        )}
                      </div>
                    ))
                )}
              </div>
              {showCompetencias && competenciasOrdenadas.length > 0 ? (
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
      <SectionCard title="Selección de espacio curricular">
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
        <div className="flex-row-gap">
          {!programaActual ? (
            <button
              className="button button-ghost"
              type="button"
              onClick={() => navigate('/docente/agenda-cursado')}
            >
              Configurar agenda de cursado
            </button>
          ) : null}
          {!programaActual ? (
            <button
              className="button"
              type="button"
              onClick={handleCreateProgramaCurrentYear}
              disabled={createProgramaMutation.isPending}
            >
              {createProgramaMutation.isPending ? (
                <>Creando...</>
              ) : (
                <>
                  <Plus size={18} className="mr-2" />
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
            <div className="detail-grid mb-4">
              <div className="detail-item">
                <div className="detail-item-header">
                  <span className="detail-item-icon"><FileText size={16} /></span>
                  <p className="eyebrow">Espacio Curricular</p>
                </div>
                <div className="detail-item-value">{selectedEspacioNombre}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-header">
                  <span className="detail-item-icon"><BookOpen size={16} /></span>
                  <p className="eyebrow">Descripción</p>
                </div>
                <div className="detail-item-value">{programaActual.descripcion || 'Sin descripción'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-header">
                  <span className="detail-item-icon"><Calendar size={16} /></span>
                  <p className="eyebrow">Unidades</p>
                </div>
                <div className="detail-item-value">
                  <span className="badge badge-info">
                    {unidadesProgramaActual.length}{' '}
                    {unidadesProgramaActual.length === 1 ? 'unidad' : 'unidades'}
                  </span>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button
                className="button"
                type="button"
                onClick={() => handleEdit(programaActual)}
              >
                <Edit size={18} className="mr-2" />
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
            pageSize={10}
          />
        )}
      </SectionCard>
    </>
  );
}

export default DocenteProgramas;
