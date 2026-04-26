import type { ReactNode } from 'react';

interface TipoOption {
  id: number;
  nombre: string;
}

interface UnidadOption {
  id: number;
  numero: number;
  descripcion: string;
}

interface PlanningActivityCommonFieldsProps {
  tipos: TipoOption[];
  tipoActividad: string;
  minutos: string;
  modalidadTrabajo: 'IND' | 'EQU';
  unidadIds: number[];
  descripcion: string;
  onTipoActividadChange: (value: string) => void;
  onMinutosChange: (value: string) => void;
  onModalidadTrabajoChange: (value: 'IND' | 'EQU') => void;
  onUnidadIdsChange: (value: number[]) => void;
  onDescripcionChange: (value: string) => void;
  unidades: UnidadOption[];
  children?: ReactNode;
}

function PlanningActivityCommonFields({
  tipos,
  tipoActividad,
  minutos,
  modalidadTrabajo,
  unidadIds,
  descripcion,
  onTipoActividadChange,
  onMinutosChange,
  onModalidadTrabajoChange,
  onUnidadIdsChange,
  onDescripcionChange,
  unidades,
  children,
}: PlanningActivityCommonFieldsProps) {
  return (
    <>
      <div className="form-row">
        <select
          className="select"
          value={tipoActividad}
          onChange={(event) => onTipoActividadChange(event.target.value)}
          required
        >
          {tipos.map((tipo) => (
            <option key={tipo.id} value={tipo.id}>
              {tipo.nombre}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          min={1}
          placeholder="Duración (min)"
          value={minutos}
          onChange={(event) => onMinutosChange(event.target.value)}
          required
        />
      </div>

      <select
        className="select"
        value={modalidadTrabajo}
        onChange={(event) => onModalidadTrabajoChange(event.target.value as 'IND' | 'EQU')}
      >
        <option value="IND">Trabajo individual</option>
        <option value="EQU">Trabajo en equipo</option>
      </select>

      {children}

      <div className="form-field-full">
        <select
          className="select"
          multiple
          value={unidadIds.map(String)}
          onChange={(event) => {
            const selectedValues = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
            onUnidadIdsChange(selectedValues);
          }}
          style={{ minHeight: '90px' }}
        >
          {unidades.map((unidad) => (
            <option key={unidad.id} value={unidad.id}>
              U{unidad.numero} - {unidad.descripcion}
            </option>
          ))}
        </select>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Mantén presionado Ctrl/Cmd para seleccionar múltiples unidades.
        </p>
      </div>

      <textarea
        className="input"
        placeholder="Descripción de la actividad"
        rows={3}
        value={descripcion}
        onChange={(event) => onDescripcionChange(event.target.value)}
        required
      />
    </>
  );
}

export default PlanningActivityCommonFields;
