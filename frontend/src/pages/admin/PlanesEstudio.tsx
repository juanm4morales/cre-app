import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';
import api from '../../services/api';

interface PlanEstudio {
  id: number;
  carrera: number;
  nombre: string;
  ordenanza: string;
  descripcion?: string;
  creditos: number;
  vigente_desde: string;
  vigente_hasta?: string | null;
}

interface PlanEstudioEC {
  id: number;
  plan_estudio: number;
  espacio_curricular: number;
}

interface Carrera {
  id: number;
  codigo: string;
  nombre: string;
}

interface EspacioCurricular {
  id: number;
  codigo: string;
  nombre: string;
}

interface PaginatedResponse<T> {
  results: T[];
}

function AdminPlanesEstudio() {
  const { data: carreras = [] } = useQuery({
    queryKey: ['carreras'],
    queryFn: () =>
      api.get<PaginatedResponse<Carrera>>('/carreras').then(res => res.data.results),
  });

  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-curriculares'],
    queryFn: () =>
      api.get<PaginatedResponse<EspacioCurricular>>('/espacios-curriculares').then(res => res.data.results),
  });

  const { data: planes = [], refetch: refetchPlanes } = useQuery({
    queryKey: ['planes-estudio'],
    queryFn: () =>
      api.get<PaginatedResponse<PlanEstudio>>('/planes-estudio').then(res => res.data.results),
  });

  const carreraOptions = useMemo(
    () => carreras.map(c => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` })),
    [carreras],
  );

  const espacioOptions = useMemo(
    () => espacios.map(e => ({ value: e.id, label: `${e.codigo} - ${e.nombre}` })),
    [espacios],
  );

  const planOptions = useMemo(
    () => planes.map(p => ({ value: p.id, label: `${p.nombre} (${p.ordenanza})` })),
    [planes],
  );

  const carreraLookup = useMemo(
    () => new Map(carreras.map(c => [c.id, `${c.codigo} - ${c.nombre}`])),
    [carreras],
  );

  const espacioLookup = useMemo(
    () => new Map(espacios.map(e => [e.id, `${e.codigo} - ${e.nombre}`])),
    [espacios],
  );

  const planFields: CrudField[] = [
    {
      name: 'carrera',
      label: 'Carrera',
      type: 'select',
      required: true,
      valueType: 'number',
      options: carreraOptions,
    },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    { name: 'ordenanza', label: 'Ordenanza', type: 'text', required: true },
    {
      name: 'descripcion',
      label: 'Descripción',
      type: 'textarea',
      required: false,
      placeholder: 'Descripción (opcional)',
    },
    { name: 'creditos', label: 'Créditos', type: 'number', required: true, valueType: 'number' },
    { name: 'vigente_desde', label: 'Vigente desde', type: 'date', required: true },
    {
      name: 'vigente_hasta',
      label: 'Vigente hasta',
      type: 'date',
      required: false,
      emptyAs: null,
    },
  ];

  const planColumns: ColumnConfig<PlanEstudio>[] = [
    { header: 'Nombre', render: (item) => item.nombre },
    { header: 'Ordenanza', render: (item) => item.ordenanza },
    {
      header: 'Carrera',
      render: (item) => carreraLookup.get(item.carrera) || `Carrera ${item.carrera}`,
    },
    { header: 'Créditos', render: (item) => `${item.creditos} CRE` },
    { header: 'Vigente desde', render: (item) => item.vigente_desde || '-' },
    {
      header: 'Vigente hasta',
      render: (item) => item.vigente_hasta || '—',
    },
  ];

  const planDetailFields: DetailField<PlanEstudio>[] = [
    {
      label: 'Carrera',
      render: (item) => carreraLookup.get(item.carrera) || `Carrera ${item.carrera}`,
    },
    { label: 'Nombre', render: (item) => item.nombre },
    { label: 'Ordenanza', render: (item) => item.ordenanza },
    { label: 'Descripción', render: (item) => item.descripcion || '—' },
    { label: 'Créditos', render: (item) => `${item.creditos} CRE` },
    { label: 'Vigente desde', render: (item) => item.vigente_desde || '-' },
    { label: 'Vigente hasta', render: (item) => item.vigente_hasta || '—' },
  ];

  const planEcFields: CrudField[] = [
    {
      name: 'plan_estudio',
      label: 'Plan de estudio',
      type: 'select',
      required: true,
      valueType: 'number',
      options: planOptions,
    },
    {
      name: 'espacio_curricular',
      label: 'Espacio curricular',
      type: 'select',
      required: true,
      valueType: 'number',
      options: espacioOptions,
    },
  ];

  const planEcColumns: ColumnConfig<PlanEstudioEC>[] = [
    {
      header: 'Plan de estudio',
      render: (item) => planOptions.find(p => p.value === item.plan_estudio)?.label || `Plan ${item.plan_estudio}`,
    },
    {
      header: 'Espacio curricular',
      render: (item) => espacioLookup.get(item.espacio_curricular) || `EC ${item.espacio_curricular}`,
    },
  ];

  const planEcDetailFields: DetailField<PlanEstudioEC>[] = [
    {
      label: 'Plan de estudio',
      render: (item) => planOptions.find(p => p.value === item.plan_estudio)?.label || `Plan ${item.plan_estudio}`,
    },
    {
      label: 'Espacio curricular',
      render: (item) => espacioLookup.get(item.espacio_curricular) || `EC ${item.espacio_curricular}`,
    },
  ];

  return (
    <>
      <AdminCrudPage
        endpoint="/planes-estudio"
        title="Planes de estudio"
        eyebrow="Estructura Académica"
        description="Administración de planes de estudio por carrera."
        fields={planFields}
        defaultValues={{
          carrera: '',
          nombre: '',
          ordenanza: '',
          descripcion: '',
          creditos: '',
          vigente_desde: '',
          vigente_hasta: '',
        }}
        columns={planColumns}
        detailFields={planDetailFields}
        newButtonText="Nuevo plan"
        createTitle="Nuevo plan de estudio"
        editTitle="Editar plan de estudio"
        detailTitle="Detalle de plan de estudio"
        tableTitle="Listado de planes de estudio"
        deleteTitle="Confirmar eliminación"
        deleteMessage="¿Estás seguro de que deseas eliminar este plan de estudio? Esta acción no se puede deshacer."
        onMutationSuccess={() => {
          void refetchPlanes();
        }}
      />

      <AdminCrudPage
        endpoint="/planes-estudio-ec"
        showHeader={false}
        fields={planEcFields}
        defaultValues={{ plan_estudio: '', espacio_curricular: '' }}
        columns={planEcColumns}
        detailFields={planEcDetailFields}
        newButtonText="Vincular EC"
        createTitle="Vincular espacio curricular a plan de estudio"
        editTitle="Editar vinculación"
        detailTitle="Detalle de vinculación"
        tableTitle="Vinculación planes de estudio - Espacios curriculares"
        deleteTitle="Confirmar eliminación"
        deleteMessage="¿Estás seguro de que deseas eliminar esta vinculación?"
      />
    </>
  );
}

export default AdminPlanesEstudio;
