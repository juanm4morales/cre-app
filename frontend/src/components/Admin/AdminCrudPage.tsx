import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../Common/SectionCard';
import ConfirmDialog from '../Common/ConfirmDialog';
import BasicTable from '../Tables/BasicTable';
import api from '../../services/api';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';
import { getApiErrorMessage } from '../../utils/errors';

export interface CrudField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  valueType?: 'number' | 'string';
  emptyAs?: null | '';
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  className?: string;
}

export interface ColumnConfig<T> {
  header: string;
  render: (item: T) => ReactNode;
}

export interface DetailField<T> {
  label: string;
  render: (item: T) => ReactNode;
}

interface AdminCrudPageProps<T extends { id: string | number }> {
  endpoint: string;
  title?: string;
  eyebrow?: string;
  description?: string;
  showHeader?: boolean;
  fields: CrudField[];
  defaultValues: Record<string, any>;
  columns: ColumnConfig<T>[];
  detailFields: DetailField<T>[];
  deleteTitle?: string;
  deleteMessage?: string;
  newButtonText?: string;
  createTitle?: string;
  editTitle?: string;
  detailTitle?: string;
  tableTitle?: string;
  transformSave?: (data: Record<string, any>) => Record<string, any>;
  onMutationSuccess?: () => void;
}

function AdminCrudPage<T extends { id: string | number }>({
  endpoint,
  title,
  eyebrow,
  description,
  showHeader = true,
  fields,
  defaultValues,
  columns,
  detailFields,
  deleteTitle = 'Confirmar eliminación',
  deleteMessage = '¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.',
  newButtonText = 'Nuevo',
  createTitle = 'Nuevo',
  editTitle = 'Editar',
  detailTitle = 'Detalle',
  tableTitle = 'Listado',
  transformSave,
  onMutationSuccess,
}: AdminCrudPageProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [selected, setSelected] = useState<T | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number | string }>({ open: false });
  const [saving, setSaving] = useState(false);
  const initialDefaults = useRef(defaultValues);

  const loadItems = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const response = await api.get(endpoint);
      let items: T[];
      if (Array.isArray(response.data)) {
        items = response.data;
      } else if (
        response.data &&
        typeof response.data === 'object' &&
        'results' in response.data &&
        Array.isArray((response.data as { results: unknown[] }).results)
      ) {
        items = (response.data as { results: T[] }).results;
      } else {
        items = [];
      }
      setData(items);
    } catch (error) {
      if (!background) {
        toast.error(getApiErrorMessage(error, 'Error al cargar datos'));
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useApiAutoRefresh(() => loadItems(true), [endpoint]);

  const resetForm = () => {
    setFormData({ ...initialDefaults.current });
    setErrors({});
    setShowForm(false);
    setEditing(null);
  };

  const openCreateForm = () => {
    resetForm();
    setSelected(null);
    setShowForm(true);
  };

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required) {
        const value = formData[field.name];
        if (value === undefined || value === null || value === '') {
          newErrors[field.name] = `${field.label} es requerido`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const prepareSaveData = (): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const field of fields) {
      let value = formData[field.name];
      if (value === '' || value === undefined || value === null) {
        result[field.name] = field.emptyAs !== undefined ? field.emptyAs : value;
      } else if (field.valueType === 'number') {
        result[field.name] = Number(value);
      } else {
        result[field.name] = value;
      }
    }
    return result;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const dataToSend = transformSave ? transformSave(prepareSaveData()) : prepareSaveData();
      if (editing) {
        await api.patch(`${endpoint}/${editing.id}`, dataToSend);
        toast.success('Guardado correctamente');
      } else {
        await api.post(endpoint, dataToSend);
        toast.success('Creado correctamente');
      }
      resetForm();
      void loadItems(true);
      onMutationSuccess?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: T) => {
    setEditing(item);
    setShowForm(true);
    const formValues: Record<string, any> = {};
    for (const field of fields) {
      const value = (item as Record<string, any>)[field.name];
      formValues[field.name] = value !== undefined && value !== null ? value : '';
    }
    setFormData(formValues);
    setErrors({});
  };

  const handleDelete = (item: T) => {
    setDeleteConfirm({ open: true, id: item.id });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.id === undefined) return;
    try {
      await api.delete(`${endpoint}/${deleteConfirm.id}`);
      toast.success('Eliminado correctamente');
      void loadItems(true);
      onMutationSuccess?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar'));
    } finally {
      setDeleteConfirm({ open: false });
    }
  };

  const renderField = (field: CrudField) => {
    const value = formData[field.name] ?? '';
    const customInputClass = field.className && field.className !== 'form-field-full' ? field.className : '';
    const inputClass = `input ${errors[field.name] ? 'input-error' : ''} ${customInputClass}`.trim();
    const selectClass = `select ${errors[field.name] ? 'input-error' : ''}`.trim();

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            className={inputClass}
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={e => handleChange(field.name, e.target.value)}
            aria-invalid={errors[field.name] ? 'true' : 'false'}
          />
        );
      case 'select':
        return (
          <select
            className={selectClass}
            value={value != null ? String(value) : ''}
            onChange={e => handleChange(field.name, e.target.value)}
            aria-invalid={errors[field.name] ? 'true' : 'false'}
          >
            <option value="">Seleccionar {field.label.toLowerCase()}</option>
            {(field.options || []).map(opt => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            className={inputClass}
            type="number"
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={e => handleChange(field.name, e.target.value)}
            aria-invalid={errors[field.name] ? 'true' : 'false'}
          />
        );
      default:
        return (
          <input
            className={inputClass}
            type={field.type}
            placeholder={field.placeholder || field.label}
            value={value}
            onChange={e => handleChange(field.name, e.target.value)}
            aria-invalid={errors[field.name] ? 'true' : 'false'}
          />
        );
    }
  };

  const tableCols = [...columns.map(col => col.header), 'Acciones'];

  const rows = data.map(item => ({
    id: String(item.id),
    cells: [
      ...columns.map(col => col.render(item)),
      <div className="table-actions" key={`actions-${item.id}`}>
        <button className="icon-button" type="button" onClick={() => setSelected(item)} title="Ver">
          <Eye size={18} />
        </button>
        <button className="icon-button" type="button" onClick={() => handleEdit(item)} title="Editar">
          <Edit size={18} />
        </button>
        <button className="icon-button" type="button" onClick={() => handleDelete(item)} title="Eliminar">
          <Trash2 size={18} />
        </button>
      </div>,
    ],
  }));

  return (
    <>
      <ConfirmDialog
        open={deleteConfirm.open}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm({ open: false })}
      />

      {showHeader ? (
        <section className="page-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          <button className="button" type="button" onClick={openCreateForm}>
            {newButtonText}
          </button>
        </section>
      ) : null}

      {showForm ? (
        <SectionCard title={editing ? editTitle : createTitle}>
          <form className="form-grid" onSubmit={e => { e.preventDefault(); void onSubmit(); }}>
            {fields.map(field => (
              <div key={field.name} className={field.type === 'textarea' || field.className === 'form-field-full' ? 'form-field-full' : ''}>
                {renderField(field)}
                {errors[field.name] ? (
                  <span className="error-text" role="alert">{errors[field.name]}</span>
                ) : null}
              </div>
            ))}
            <div className="form-actions">
              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear'}
              </button>
              <button className="button button-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        title={tableTitle}
        action={!showHeader ? (
          <button className="button" type="button" onClick={openCreateForm}>
            {newButtonText}
          </button>
        ) : undefined}
      >
        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : rows.length === 0 ? (
          <p className="muted">No hay datos disponibles.</p>
        ) : (
          <BasicTable columns={tableCols} rows={rows} pageSize={10} />
        )}
      </SectionCard>

      {selected ? (
        <SectionCard title={detailTitle}>
          <div className="detail-grid">
            {detailFields.map(field => (
              <div key={field.label}>
                <p className="eyebrow">{field.label}</p>
                <div>{field.render(selected)}</div>
              </div>
            ))}
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

export default AdminCrudPage;
