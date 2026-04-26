import { useCallback, useEffect, useState } from 'react';
import { Eye, Edit, ToggleRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import BasicTable from '../../components/Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

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
  const [formState, setFormState] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
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
    setFormState({ username: '', password: '', first_name: '', last_name: '', email: '' });
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editing) {
      const response = await api.patch<Usuario>(`/usuarios/${editing.id}`, {
        first_name: formState.first_name,
        last_name: formState.last_name,
        email: formState.email,
        password: formState.password || undefined,
      });
      setUsuarios((prev) => prev.map((item) => (item.id === editing.id ? response.data : item)));
      resetForm();
      return;
    }

    const response = await api.post<Usuario>('/usuarios', formState);
    setUsuarios((prev) => [response.data, ...prev]);
    resetForm();
  };

  const handleEdit = (usuario: Usuario) => {
    setEditing(usuario);
    setShowForm(true);
    setFormState({
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
    } catch (error) {
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
            setFormState({ username: '', password: '', first_name: '', last_name: '', email: '' });
            setEditing(null);
          }}
        >
          Nuevo docente
        </button>
      </section>

      {showForm ? (
        <SectionCard title={editing ? 'Editar docente' : 'Alta de docente'}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input
              className="input"
              type="text"
              placeholder="Username"
              value={formState.username}
              onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
              required={!editing}
              disabled={Boolean(editing)}
            />
            <input
              className="input"
              type="password"
              placeholder={editing ? 'Contrasena nueva (opcional)' : 'Contrasena'}
              value={formState.password}
              onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
              required={!editing}
            />
            <input
              className="input"
              type="text"
              placeholder="Nombre"
              value={formState.first_name}
              onChange={(event) => setFormState((prev) => ({ ...prev, first_name: event.target.value }))}
            />
            <input
              className="input"
              type="text"
              placeholder="Apellido"
              value={formState.last_name}
              onChange={(event) => setFormState((prev) => ({ ...prev, last_name: event.target.value }))}
            />
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
            />
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
        <BasicTable columns={['Nombre', 'Email', 'Estado', 'Acciones']} rows={rows} />
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
