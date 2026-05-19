import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';
import api from '../../services/api';

interface AsignacionDocente {
  id: number;
  docente: number;
  docente_nombre?: string;
  espacio_curricular: number;
  espacio_curricular_codigo?: string;
  espacio_curricular_nombre?: string;
  categoria: string;
  categoria_display?: string;
  vigente_desde: string;
  vigente_hasta?: string | null;
  activo?: boolean;
}

interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface EspacioCurricular {
  id: number;
  codigo: string;
  nombre: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

const CATEGORIA_OPTIONS = [
  { value: 'TIT', label: 'TIT - Titular' },
  { value: 'ADJ', label: 'ADJ - Adjunto' },
  { value: 'ASO', label: 'ASO - Asociado' },
  { value: 'JTP', label: 'JTP - Jefe de Trabajos Prácticos' },
  { value: 'AY1', label: 'AY1 - Ayudante de Primera' },
  { value: 'AY2', label: 'AY2 - Ayudante de Segunda' },
];

function AdminAsignacionesDocentes() {
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () =>
      api.get<PaginatedResponse<Usuario>>('/usuarios').then(res => res.data.results),
  });

  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-curriculares'],
    queryFn: () =>
      api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares').then(res => res.data.results),
  });

  const docenteOptions = useMemo(
    () =>
      usuarios
        .map(u => ({
          value: u.id,
          label: `${u.first_name} ${u.last_name}`.trim() || u.username,
        })),
    [usuarios],
  );

  const docenteLookup = useMemo(
    () =>
      new Map(
        usuarios.map(u => [
          u.id,
          `${u.first_name} ${u.last_name}`.trim() || u.username,
        ]),
      ),
    [usuarios],
  );

  const espacioOptions = useMemo(
    () => espacios.map(e => ({ value: e.id, label: `${e.codigo} - ${e.nombre}` })),
    [espacios],
  );

  const espacioLookup = useMemo(
    () => new Map(espacios.map(e => [e.id, `${e.codigo} - ${e.nombre}`])),
    [espacios],
  );

  const categoriaLookup = useMemo(
    () => new Map(CATEGORIA_OPTIONS.map(option => [option.value, option.label])),
    [],
  );

  const getDocenteLabel = (item: AsignacionDocente) => {
    return item.docente_nombre || docenteLookup.get(item.docente) || `Usuario ${item.docente}`;
  };

  const getEspacioLabel = (item: AsignacionDocente) => {
    if (item.espacio_curricular_codigo || item.espacio_curricular_nombre) {
      return `${item.espacio_curricular_codigo || ''} - ${item.espacio_curricular_nombre || ''}`.replace(/^ - | - $/g, '');
    }
    return espacioLookup.get(item.espacio_curricular) || `EC ${item.espacio_curricular}`;
  };

  const getCategoriaLabel = (item: AsignacionDocente) => {
    return item.categoria_display || categoriaLookup.get(item.categoria) || item.categoria;
  };

  const fields: CrudField[] = [
    {
      name: 'docente',
      label: 'Docente',
      type: 'select',
      required: true,
      valueType: 'number',
      options: docenteOptions,
    },
    {
      name: 'espacio_curricular',
      label: 'Espacio curricular',
      type: 'select',
      required: true,
      valueType: 'number',
      options: espacioOptions,
    },
    {
      name: 'categoria',
      label: 'Categoría',
      type: 'select',
      required: true,
      options: CATEGORIA_OPTIONS,
    },
    { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
    {
      name: 'vigente_hasta',
      label: 'Vigente hasta',
      type: 'date',
      required: false,
      emptyAs: null,
    },
  ];

  const columns: ColumnConfig<AsignacionDocente>[] = [
    {
      header: 'Docente',
      render: getDocenteLabel,
    },
    {
      header: 'Espacio curricular',
      render: getEspacioLabel,
    },
    { header: 'Categoría', render: getCategoriaLabel },
    { header: 'Vigente desde', render: (item) => item.vigente_desde || '-' },
    {
      header: 'Vigente hasta',
      render: (item) => item.vigente_hasta || '—',
    },
  ];

  const detailFields: DetailField<AsignacionDocente>[] = [
    {
      label: 'Docente',
      render: getDocenteLabel,
    },
    {
      label: 'Espacio curricular',
      render: getEspacioLabel,
    },
    { label: 'Categoría', render: getCategoriaLabel },
    { label: 'Vigente desde', render: (item) => item.vigente_desde || '-' },
    { label: 'Vigente hasta', render: (item) => item.vigente_hasta || '—' },
    {
      label: 'Activo',
      render: (item) => (item.activo !== undefined ? (item.activo ? 'Sí' : 'No') : '—'),
    },
  ];

  return (
    <AdminCrudPage
      endpoint="/asignaciones-docentes"
      title="Asignaciones docentes"
      eyebrow="Gestión"
      description="Administración de asignaciones de docentes a espacios curriculares."
      fields={fields}
      defaultValues={{
        docente: '',
        espacio_curricular: '',
        categoria: '',
        vigente_desde: '',
        vigente_hasta: '',
      }}
      columns={columns}
      detailFields={detailFields}
      newButtonText="Nueva asignación"
      createTitle="Nueva asignación docente"
      editTitle="Editar asignación docente"
      detailTitle="Detalle de asignación docente"
      tableTitle="Listado de asignaciones docentes"
      deleteTitle="Confirmar eliminación"
      deleteMessage="¿Estás seguro de que deseas eliminar esta asignación docente?"
    />
  );
}

export default AdminAsignacionesDocentes;
