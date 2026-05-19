import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';
import api from '../../services/api';

interface Competencia {
  id: number;
  plan_estudio: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
}

interface PlanEstudio {
  id: number;
  nombre: string;
  ordenanza: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminCompetencias() {
  const { data: planes = [] } = useQuery({
    queryKey: ['planes-estudio'],
    queryFn: () =>
      api.get<PaginatedResponse<PlanEstudio>>('/planes-estudio').then(res => res.data.results),
  });

  const planOptions = useMemo(
    () => planes.map(p => ({ value: p.id, label: `${p.nombre} (${p.ordenanza})` })),
    [planes],
  );

  const planLookup = useMemo(
    () => new Map(planes.map(p => [p.id, `${p.nombre} (${p.ordenanza})`])),
    [planes],
  );

  const fields: CrudField[] = [
    {
      name: 'plan_estudio',
      label: 'Plan de estudio',
      type: 'select',
      required: true,
      valueType: 'number',
      options: planOptions,
    },
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    {
      name: 'descripcion',
      label: 'Descripción',
      type: 'textarea',
      required: false,
      placeholder: 'Descripción (opcional)',
    },
  ];

  const columns: ColumnConfig<Competencia>[] = [
    { header: 'Código', render: (item) => item.codigo },
    { header: 'Nombre', render: (item) => item.nombre },
    {
      header: 'Plan de estudio',
      render: (item) => planLookup.get(item.plan_estudio) || `Plan ${item.plan_estudio}`,
    },
  ];

  const detailFields: DetailField<Competencia>[] = [
    { label: 'Código', render: (item) => item.codigo },
    { label: 'Nombre', render: (item) => item.nombre },
    {
      label: 'Plan de estudio',
      render: (item) => planLookup.get(item.plan_estudio) || `Plan ${item.plan_estudio}`,
    },
    { label: 'Descripción', render: (item) => item.descripcion || '—' },
  ];

  return (
    <AdminCrudPage
      endpoint="/competencias"
      title="Competencias"
      eyebrow="Estructura Académica"
      description="Administración de competencias por plan de estudio."
      fields={fields}
      defaultValues={{ plan_estudio: '', codigo: '', nombre: '', descripcion: '' }}
      columns={columns}
      detailFields={detailFields}
      newButtonText="Nueva competencia"
      createTitle="Nueva competencia"
      editTitle="Editar competencia"
      detailTitle="Detalle de competencia"
      tableTitle="Listado de competencias"
      deleteTitle="Confirmar eliminación"
      deleteMessage="¿Estás seguro de que deseas eliminar esta competencia? Se realizará un borrado lógico."
    />
  );
}

export default AdminCompetencias;
