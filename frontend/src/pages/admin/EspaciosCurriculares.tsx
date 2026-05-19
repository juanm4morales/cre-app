import AdminCrudPage from '../../components/Admin/AdminCrudPage';
import type { CrudField, ColumnConfig, DetailField } from '../../components/Admin/AdminCrudPage';

interface EspacioCurricular {
  id: number;
  codigo: string;
  nombre: string;
  tipo_espacio: string;
  anio_cursada: number;
  periodo: string;
  creditos: number;
  horas_ip: number;
  horas_ta: number;
  horas_totales?: number;
}

const TIPO_ESPACIO_OPTIONS = [
  { value: 'T1', label: 'T1' },
  { value: 'T2', label: 'T2' },
  { value: 'T3', label: 'T3' },
  { value: 'T4', label: 'T4' },
];

const PERIODO_OPTIONS = [
  { value: 'ANUAL', label: 'Anual' },
  { value: '1S', label: '1S - Primer semestre' },
  { value: '2S', label: '2S - Segundo semestre' },
];

const fields: CrudField[] = [
  { name: 'codigo', label: 'Código', type: 'text', required: true },
  { name: 'nombre', label: 'Nombre', type: 'text', required: true },
  {
    name: 'tipo_espacio',
    label: 'Tipo de espacio',
    type: 'select',
    required: true,
    options: TIPO_ESPACIO_OPTIONS,
  },
  { name: 'anio_cursada', label: 'Año de cursada', type: 'number', required: true, valueType: 'number' },
  {
    name: 'periodo',
    label: 'Periodo',
    type: 'select',
    required: true,
    options: PERIODO_OPTIONS,
  },
  { name: 'creditos', label: 'Créditos', type: 'number', required: true, valueType: 'number' },
  { name: 'horas_ip', label: 'Horas IP', type: 'number', required: true, valueType: 'number' },
  { name: 'horas_ta', label: 'Horas TA', type: 'number', required: true, valueType: 'number' },
];

const columns: ColumnConfig<EspacioCurricular>[] = [
  { header: 'Código', render: (item) => item.codigo },
  { header: 'Nombre', render: (item) => item.nombre },
  { header: 'Tipo', render: (item) => item.tipo_espacio },
  { header: 'Créditos', render: (item) => `${item.creditos} CRE` },
  { header: 'Horas IP', render: (item) => `${item.horas_ip}h` },
  { header: 'Horas TA', render: (item) => `${item.horas_ta}h` },
];

const detailFields: DetailField<EspacioCurricular>[] = [
  { label: 'Código', render: (item) => item.codigo },
  { label: 'Nombre', render: (item) => item.nombre },
  { label: 'Tipo de espacio', render: (item) => item.tipo_espacio },
  { label: 'Año de cursada', render: (item) => item.anio_cursada },
  { label: 'Periodo', render: (item) => item.periodo },
  { label: 'Créditos', render: (item) => `${item.creditos} CRE` },
  { label: 'Horas IP', render: (item) => `${item.horas_ip}h` },
  { label: 'Horas TA', render: (item) => `${item.horas_ta}h` },
  {
    label: 'Horas totales',
    render: (item) =>
      item.horas_totales != null ? `${item.horas_totales}h` : `${(item.horas_ip || 0) + (item.horas_ta || 0)}h`,
  },
];

function AdminEspaciosCurriculares() {
  return (
    <AdminCrudPage
      endpoint="/espacios-curriculares"
      title="Espacios curriculares"
      eyebrow="Gestión académica"
      description="Administración de la distribución de créditos y horas por tipo de EC."
      fields={fields}
      defaultValues={{
        codigo: '',
        nombre: '',
        tipo_espacio: '',
        anio_cursada: '',
        periodo: '',
        creditos: '',
        horas_ip: '',
        horas_ta: '',
      }}
      columns={columns}
      detailFields={detailFields}
      newButtonText="Nuevo espacio"
      createTitle="Nuevo espacio curricular"
      editTitle="Editar espacio curricular"
      detailTitle="Detalle de espacio curricular"
      tableTitle="Listado de espacios curriculares"
    />
  );
}

export default AdminEspaciosCurriculares;
