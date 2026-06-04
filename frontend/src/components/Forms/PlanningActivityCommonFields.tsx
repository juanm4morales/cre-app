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

interface PlanningActivityFieldErrors {
  tipoActividad?: string;
  minutos?: string;
  modalidadTrabajo?: string;
  unidadIds?: string;
  descripcion?: string;
}

interface PlanningActivityCommonFieldsProps {
  idPrefix?: string;
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
  errors?: PlanningActivityFieldErrors;
  children?: ReactNode;
}

function PlanningActivityCommonFields({
  idPrefix = 'planning-activity',
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
  errors,
  children,
}: PlanningActivityCommonFieldsProps) {
  const tipoActividadErrorId = `${idPrefix}-tipo-actividad-error`;
  const minutosErrorId = `${idPrefix}-minutos-error`;
  const modalidadErrorId = `${idPrefix}-modalidad-error`;
  const unidadesErrorId = `${idPrefix}-unidades-error`;
  const descripcionErrorId = `${idPrefix}-descripcion-error`;

  return (
    <>
      <div className="form-row">
        <label className="grid-label" htmlFor={`${idPrefix}-tipo-actividad`}>
          <span className="muted">Tipo de actividad</span>
          <select
            id={`${idPrefix}-tipo-actividad`}
            className="select"
            value={tipoActividad}
            onChange={(event) => onTipoActividadChange(event.target.value)}
            aria-invalid={Boolean(errors?.tipoActividad)}
            aria-describedby={errors?.tipoActividad ? tipoActividadErrorId : undefined}
            required
          >
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </option>
            ))}
          </select>
          {errors?.tipoActividad ? <span id={tipoActividadErrorId} className="error-text" role="alert">{errors.tipoActividad}</span> : null}
        </label>

        <label className="grid-label" htmlFor={`${idPrefix}-minutos`}>
          <span className="muted">Duración (min)</span>
          <input
            id={`${idPrefix}-minutos`}
            className="input"
            type="number"
            min={1}
            value={minutos}
            onChange={(event) => onMinutosChange(event.target.value)}
            aria-invalid={Boolean(errors?.minutos)}
            aria-describedby={errors?.minutos ? minutosErrorId : undefined}
            required
          />
          {errors?.minutos ? <span id={minutosErrorId} className="error-text" role="alert">{errors.minutos}</span> : null}
        </label>
      </div>

      <label className="grid-label" htmlFor={`${idPrefix}-modalidad`}>
        <span className="muted">Modalidad de trabajo</span>
        <select
          id={`${idPrefix}-modalidad`}
          className="select"
          value={modalidadTrabajo}
          onChange={(event) => onModalidadTrabajoChange(event.target.value as 'IND' | 'EQU')}
          aria-invalid={Boolean(errors?.modalidadTrabajo)}
          aria-describedby={errors?.modalidadTrabajo ? modalidadErrorId : undefined}
        >
          <option value="IND">Trabajo individual</option>
          <option value="EQU">Trabajo grupal</option>
        </select>
        {errors?.modalidadTrabajo ? <span id={modalidadErrorId} className="error-text" role="alert">{errors.modalidadTrabajo}</span> : null}
      </label>

      {children}

      <fieldset className="grid-label form-field-full checkbox-group" id={`${idPrefix}-unidades-fieldset`}>
        <legend className="muted">Unidades asociadas</legend>
        <div
          role="group"
          aria-label="Unidades asociadas"
          aria-invalid={Boolean(errors?.unidadIds)}
          aria-describedby={errors?.unidadIds ? unidadesErrorId : undefined}
        >
          {unidades.length === 0 ? (
            <p className="muted text-sm">No hay unidades disponibles.</p>
          ) : (
            unidades.map((unidad) => {
              const checkboxId = `${idPrefix}-unidad-${unidad.id}`;
              const isChecked = unidadIds.includes(unidad.id);
              return (
                <label key={unidad.id} htmlFor={checkboxId} className="checkbox-label">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => {
                      const next = isChecked
                        ? unidadIds.filter((id) => id !== unidad.id)
                        : [...unidadIds, unidad.id];
                      onUnidadIdsChange(next);
                    }}
                  />
                  <span>U{unidad.numero} — {unidad.descripcion}</span>
                </label>
              );
            })
          )}
        </div>
        {errors?.unidadIds ? <span id={unidadesErrorId} className="error-text" role="alert">{errors.unidadIds}</span> : null}
      </fieldset>

      <label className="grid-label" htmlFor={`${idPrefix}-descripcion`}>
        <span className="muted">Descripción de la actividad</span>
        <textarea
          id={`${idPrefix}-descripcion`}
          className="input"
          rows={3}
          value={descripcion}
          onChange={(event) => onDescripcionChange(event.target.value)}
          aria-invalid={Boolean(errors?.descripcion)}
          aria-describedby={errors?.descripcion ? descripcionErrorId : undefined}
          required
        />
        {errors?.descripcion ? <span id={descripcionErrorId} className="error-text" role="alert">{errors.descripcion}</span> : null}
      </label>
    </>
  );
}

export default PlanningActivityCommonFields;
