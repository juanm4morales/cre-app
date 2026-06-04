import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

const tipoActividadSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo_dedicacion: z.string().optional(),
  descripcion: z.string().optional(),
});

type TipoActividadFormValues = z.infer<typeof tipoActividadSchema>;

interface TipoActividad {
  id: number;
  nombre: string;
  descripcion: string;
  tipo_dedicacion: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminTiposActividad() {
  const [tipos, setTipos] = useState<TipoActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TipoActividad | null>(null);
  const [selected, setSelected] = useState<TipoActividad | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({
    open: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TipoActividadFormValues>({
    resolver: zodResolver(tipoActividadSchema),
    defaultValues: {
      nombre: '',
      tipo_dedicacion: '',
      descripcion: '',
    },
  });

  const loadTipos = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    try {
      const response = await api.get<PaginatedResponse<TipoActividad>>('/tipos-actividad');
      setTipos(response.data.results);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTipos();
  }, [loadTipos]);

  useApiAutoRefresh(() => loadTipos(true), []);

  const resetForm = () => {
    reset({ nombre: '', descripcion: '', tipo_dedicacion: '' });
    setEditing(null);
    setShowForm(false);
  };

  const onSubmit = async (data: TipoActividadFormValues) => {
    if (editing) {
      try {
        const response = await api.patch<TipoActividad>(`/tipos-actividad/${editing.id}`, data);
        setTipos((prev) => prev.map((item) => (item.id === editing.id ? response.data : item)));
        resetForm();
      } catch {
        toast.error('Error al actualizar el tipo de actividad');
      }
      return;
    }

    try {
      const response = await api.post<TipoActividad>('/tipos-actividad', data);
      setTipos((prev) => [response.data, ...prev]);
      resetForm();
    } catch {
      toast.error('Error al crear el tipo de actividad');
    }
  };

  const handleEdit = (tipo: TipoActividad) => {
    setEditing(tipo);
    setShowForm(true);
    reset({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      tipo_dedicacion: tipo.tipo_dedicacion,
    });
  };

  const handleDelete = async (tipoId: number) => {
    setDeleteConfirm({ open: true, id: tipoId });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await api.delete(`/tipos-actividad/${deleteConfirm.id}`);
      setTipos((prev) => prev.filter((item) => item.id !== deleteConfirm.id));
      toast.success('Tipo de actividad eliminado');
    } catch {
      toast.error('Error al eliminar el tipo de actividad');
    } finally {
      setDeleteConfirm({ open: false });
    }
  };

  const rows = tipos.map((tipo) => ({
    id: String(tipo.id),
    cells: [
      tipo.nombre,
      tipo.tipo_dedicacion,
      tipo.descripcion || 'Sin descripcion',
      <div className="table-actions" key={`actions-${tipo.id}`}>
        <button
          className="icon-button"
          type="button"
          onClick={() => setSelected(tipo)}
          title="Ver"
        >
          <Eye size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleEdit(tipo)}
          title="Editar"
        >
          <Edit size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleDelete(tipo.id)}
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </div>,
    ],
  }));

  return (
    <>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este tipo de actividad? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm({ open: false })}
      />

      <section className="page-header">
        <div>
          <p className="eyebrow">Gestión académica</p>
          <h2>Tipos de actividad</h2>
          <p>Configurá categorías y dedicaciones disponibles para docentes.</p>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            setShowForm(true);
            reset({ nombre: '', descripcion: '', tipo_dedicacion: '' });
            setEditing(null);
          }}
        >
          Nuevo tipo
        </button>
      </section>

      {showForm ? (
        <SectionCard title={editing ? 'Editar tipo de actividad' : 'Nuevo tipo de actividad'}>
          <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <input
                className={`input ${errors.nombre ? 'input-error' : ''}`}
                type="text"
                placeholder="Nombre"
                aria-invalid={errors.nombre ? 'true' : 'false'}
                {...register('nombre')}
              />
              {errors.nombre && (
                <span className="error-text" role="alert">{errors.nombre.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.tipo_dedicacion ? 'input-error' : ''}`}
                type="text"
                placeholder="Tipo de dedicación"
                aria-invalid={errors.tipo_dedicacion ? 'true' : 'false'}
                {...register('tipo_dedicacion')}
              />
              {errors.tipo_dedicacion && (
                <span className="error-text" role="alert">{errors.tipo_dedicacion.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.descripcion ? 'input-error' : ''}`}
                type="text"
                placeholder="Descripción"
                aria-invalid={errors.descripcion ? 'true' : 'false'}
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <span className="error-text" role="alert">{errors.descripcion.message}</span>
              )}
            </div>
            <div className="form-actions">
              <button className="button" type="submit" disabled={loading}>
                {editing ? 'Guardar cambios' : 'Crear tipo'}
              </button>
              <button className="button button-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Listado de tipos de actividad">
        <BasicTable
          columns={['Nombre', 'Dedicacion', 'Descripcion', 'Acciones']}
          rows={rows}
          pageSize={10}
        />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de tipo de actividad">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Nombre</p>
              <div>{selected.nombre}</div>
            </div>
            <div>
              <p className="eyebrow">Dedicacion</p>
              <div>{selected.tipo_dedicacion || 'Sin definir'}</div>
            </div>
            <div>
              <p className="eyebrow">Descripcion</p>
              <div>{selected.descripcion || 'Sin descripcion'}</div>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="button button-ghost" type="button" onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}

export default AdminTiposActividad;
