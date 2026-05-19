import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';
import api from '../../services/api';

interface Carrera {
  id: number;
  codigo: string;
  nombre: string;
  nivel: string;
  unidad_academica: number;
}

interface UnidadAcademica {
  id: number;
  nombre: string;
  sigla: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

const NIVEL_OPTIONS = [
  { value: 'PG', label: 'PG - Pregrado' },
  { value: 'G', label: 'G - Grado' },
];

function AdminCarreras() {
  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades-academicas'],
    queryFn: () =>
      api.get<PaginatedResponse<UnidadAcademica>>('/unidades-academicas').then(res => res.data.results),
  });

  const unidadOptions = useMemo(
    () =>
      unidades.map(u => ({
        value: u.id,
        label: `${u.sigla} - ${u.nombre}`,
      })),
    [unidades],
  );

  const unidadLookup = useMemo(
    () => new Map(unidades.map(u => [u.id, u.sigla])),
    [unidades],
  );

  const fields: CrudField[] = [
    { name: 'codigo', label: 'Código', type: 'text', required: true },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    {
      name: 'nivel',
      label: 'Nivel',
      type: 'select',
      required: true,
      options: NIVEL_OPTIONS,
    },
    {
      name: 'unidad_academica',
      label: 'Unidad académica',
      type: 'select',
      required: true,
      valueType: 'number',
      options: unidadOptions,
    },
  ];

  const columns: ColumnConfig<Carrera>[] = [
    { header: 'Código', render: (item) => item.codigo },
    { header: 'Carrera', render: (item) => item.nombre },
    { header: 'Nivel', render: (item) => item.nivel },
    {
      header: 'Unidad',
      render: (item) => unidadLookup.get(item.unidad_academica) || `UA ${item.unidad_academica}`,
    },
  ];

  const detailFields: DetailField<Carrera>[] = [
    { label: 'Código', render: (item) => item.codigo },
    { label: 'Nombre', render: (item) => item.nombre },
    { label: 'Nivel', render: (item) => item.nivel },
    {
      label: 'Unidad académica',
      render: (item) => unidadLookup.get(item.unidad_academica) || `UA ${item.unidad_academica}`,
    },
  ];

  return (
    <AdminCrudPage
      endpoint="/carreras"
      title="Carreras"
      eyebrow="Gestión académica"
      description="Administración de carreras vinculadas a la facultad."
      fields={fields}
      defaultValues={{ codigo: '', nombre: '', nivel: '', unidad_academica: '' }}
      columns={columns}
      detailFields={detailFields}
      newButtonText="Nueva carrera"
      createTitle="Nueva carrera"
      editTitle="Editar carrera"
      detailTitle="Detalle de carrera"
      tableTitle="Listado de carreras"
      deleteTitle="Confirmar eliminación"
      deleteMessage="¿Estás seguro de que deseas eliminar esta carrera? Esta acción no se puede deshacer."
    />
  );
}

export default AdminCarreras;
