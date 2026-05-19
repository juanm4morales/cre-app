import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';

interface UnidadAcademica {
  id: number;
  nombre: string;
  sigla: string;
}

const fields: CrudField[] = [
  { name: 'sigla', label: 'Sigla', type: 'text', required: true },
  { name: 'nombre', label: 'Nombre', type: 'text', required: true },
];

const columns: ColumnConfig<UnidadAcademica>[] = [
  { header: 'Sigla', render: (item) => item.sigla },
  { header: 'Unidad académica', render: (item) => item.nombre },
];

const detailFields: DetailField<UnidadAcademica>[] = [
  { label: 'Sigla', render: (item) => item.sigla },
  { label: 'Nombre', render: (item) => item.nombre },
];

function AdminUnidadesAcademicas() {
  return (
    <AdminCrudPage
      endpoint="/unidades-academicas"
      title="Unidades académicas"
      eyebrow="Gestión académica"
      description="Organización institucional y siglas oficiales."
      fields={fields}
      defaultValues={{ sigla: '', nombre: '' }}
      columns={columns}
      detailFields={detailFields}
      newButtonText="Nueva unidad"
      createTitle="Nueva unidad académica"
      editTitle="Editar unidad académica"
      detailTitle="Detalle de unidad académica"
      tableTitle="Listado de unidades académicas"
    />
  );
}

export default AdminUnidadesAcademicas;
