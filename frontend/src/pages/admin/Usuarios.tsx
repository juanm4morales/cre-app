import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Edit, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

const createUsuarioSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

const updateUsuarioSchema = z.object({
  username: z.string().min(1, 'El nombre de usuario es requerido'),
  password: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type UsuarioFormValues = z.infer<typeof updateUsuarioSchema>;

interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  role: 'docente' | 'admin';
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Usuario | null>(null);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({
    open: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UsuarioFormValues>({
    resolver: zodResolver(editing ? updateUsuarioSchema : createUsuarioSchema),
    defaultValues: {
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
    },
  });

  const loadUsers = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    try {
      const response = await api.get<PaginatedResponse<Usuario>>('/usuarios');
      setUsuarios(response.data.results);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useApiAutoRefresh(() => loadUsers(true), []);

  const resetForm = () => {
    reset({ username: '', password: '', first_name: '', last_name: '', email: '' });
    setShowForm(false);
    setEditing(null);
  };

  const onSubmit = async (data: UsuarioFormValues) => {
    try {
      if (editing) {
        const response = await api.patch<Usuario>(`/usuarios/${editing.id}`, {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          password: data.password || undefined,
        });
        setUsuarios((prev) => prev.map((item) => (item.id === editing.id ? response.data : item)));
        resetForm();
        return;
      }

      const response = await api.post<Usuario>('/usuarios', data);
      setUsuarios((prev) => [response.data, ...prev]);
      resetForm();
    } catch {
      toast.error('Error al guardar el usuario');
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditing(usuario);
    setShowForm(true);
    reset({
      username: usuario.username,
      password: '',
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      email: usuario.email,
    });
  };

  const handleToggleActive = async (usuario: Usuario) => {
    const response = await api.patch<Usuario>(`/usuarios/${usuario.id}`, {
      is_active: !usuario.is_active,
    });
    setUsuarios((prev) => prev.map((item) => (item.id === usuario.id ? response.data : item)));
  };

  const handleDeactivate = async (usuario: Usuario) => {
    setDeleteConfirm({ open: true, id: usuario.id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await api.delete(`/usuarios/${deleteConfirm.id}`);
      setUsuarios((prev) =>
        prev.map((item) =>
          item.id === deleteConfirm.id ? { ...item, is_active: false } : item
        )
      );
      toast.success('Usuario dado de baja');
    } catch {
      toast.error('Error al dar de baja el usuario');
    } finally {
      setDeleteConfirm({ open: false });
    }
  };

  const rows = usuarios.map((usuario) => ({
    id: String(usuario.id),
    cells: [
      `${usuario.first_name} ${usuario.last_name}`.trim() || usuario.username,
      usuario.email || 'Sin email',
      usuario.is_active ? 'Activo' : 'Inactivo',
      <div className="table-actions" key={`actions-${usuario.id}`}>
        <button
          className="icon-button"
          type="button"
          onClick={() => setSelected(usuario)}
          title="Ver"
        >
          <Eye size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleEdit(usuario)}
          title="Editar"
        >
          <Edit size={18} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => handleToggleActive(usuario)}
          title={usuario.is_active ? 'Desactivar' : 'Activar'}
        >
          <ToggleRight size={18} />
        </button>
        {usuario.is_active ? (
          <button
            className="icon-button"
            type="button"
            onClick={() => handleDeactivate(usuario)}
            title="Dar de baja"
          >
            <Trash2 size={18} />
          </button>
        ) : null}
      </div>,
    ],
  }));

  return (
    <>
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Confirmar baja"
        message="¿Estás seguro de que deseas dar de baja este usuario? Esta acción no se puede deshacer."
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm({ open: false })}
      />

      <section className="page-header">
        <div>
          <p className="eyebrow">Gestión de docentes</p>
          <h2>Usuarios docentes</h2>
          <p>Administra los accesos y datos de los docentes del sistema.</p>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            setShowForm(true);
            reset({ username: '', password: '', first_name: '', last_name: '', email: '' });
            setEditing(null);
          }}
        >
          Nuevo docente
        </button>
      </section>

      {showForm ? (
        <SectionCard title={editing ? 'Editar docente' : 'Alta de docente'}>
          <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <input
                className={`input ${errors.username ? 'input-error' : ''}`}
                type="text"
                placeholder="Username"
                disabled={Boolean(editing)}
                aria-invalid={errors.username ? 'true' : 'false'}
                {...register('username')}
              />
              {errors.username && (
                <span className="error-text" role="alert">{errors.username.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.password ? 'input-error' : ''}`}
                type="password"
                placeholder={editing ? 'Contraseña nueva (opcional)' : 'Contraseña'}
                aria-invalid={errors.password ? 'true' : 'false'}
                {...register('password')}
              />
              {errors.password && (
                <span className="error-text" role="alert">{errors.password.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.first_name ? 'input-error' : ''}`}
                type="text"
                placeholder="Nombre"
                aria-invalid={errors.first_name ? 'true' : 'false'}
                {...register('first_name')}
              />
              {errors.first_name && (
                <span className="error-text" role="alert">{errors.first_name.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.last_name ? 'input-error' : ''}`}
                type="text"
                placeholder="Apellido"
                aria-invalid={errors.last_name ? 'true' : 'false'}
                {...register('last_name')}
              />
              {errors.last_name && (
                <span className="error-text" role="alert">{errors.last_name.message}</span>
              )}
            </div>
            <div>
              <input
                className={`input ${errors.email ? 'input-error' : ''}`}
                type="email"
                placeholder="Email"
                aria-invalid={errors.email ? 'true' : 'false'}
                {...register('email')}
              />
              {errors.email && (
                <span className="error-text" role="alert">{errors.email.message}</span>
              )}
            </div>
            <div className="form-actions">
              <button className="button" type="submit" disabled={loading}>
                {editing ? 'Guardar cambios' : 'Crear docente'}
              </button>
              <button className="button button-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Listado de docentes">
        <BasicTable columns={['Nombre', 'Email', 'Estado', 'Acciones']} rows={rows} pageSize={10} />
      </SectionCard>

      {selected ? (
        <SectionCard title="Detalle de usuario">
          <div className="detail-grid">
            <div>
              <p className="eyebrow">Usuario</p>
              <div>{selected.username}</div>
            </div>
            <div>
              <p className="eyebrow">Nombre</p>
              <div>{`${selected.first_name} ${selected.last_name}`.trim() || 'Sin nombre'}</div>
            </div>
            <div>
              <p className="eyebrow">Email</p>
              <div>{selected.email || 'Sin email'}</div>
            </div>
            <div>
              <p className="eyebrow">Rol</p>
              <div>{selected.role}</div>
            </div>
            <div>
              <p className="eyebrow">Estado</p>
              <div>{selected.is_active ? 'Activo' : 'Inactivo'}</div>
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

export default AdminUsuarios;
