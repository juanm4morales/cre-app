import { useCallback, useEffect, useState } from 'react';
import { APP_DATA_CHANGED_EVENT } from '../services/api';

export interface DocenteSelection {
  espacioId: string;
  planEstudioEcId: string;
  espacioNombre: string;
}

const STORAGE_KEYS = {
  espacioId: 'selected_espacio_curricular_id',
  planEstudioEcId: 'selected_plan_estudio_ec_id',
  espacioNombre: 'selected_espacio_nombre',
} as const;

function readSelectionFromStorage(): DocenteSelection {
  return {
    espacioId: sessionStorage.getItem(STORAGE_KEYS.espacioId) || '',
    planEstudioEcId: sessionStorage.getItem(STORAGE_KEYS.planEstudioEcId) || '',
    espacioNombre: sessionStorage.getItem(STORAGE_KEYS.espacioNombre) || '',
  };
}

export function setDocenteSelection(selection: DocenteSelection) {
  sessionStorage.setItem(STORAGE_KEYS.espacioId, selection.espacioId);
  sessionStorage.setItem(STORAGE_KEYS.planEstudioEcId, selection.planEstudioEcId);
  sessionStorage.setItem(STORAGE_KEYS.espacioNombre, selection.espacioNombre);
  window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED_EVENT, {
    detail: { method: 'LOCAL', url: 'docente-selection' },
  }));
}

export function useDocenteSelection() {
  const [selection, setSelection] = useState<DocenteSelection>(() => readSelectionFromStorage());

  useEffect(() => {
    const syncSelection = () => setSelection(readSelectionFromStorage());

    window.addEventListener(APP_DATA_CHANGED_EVENT, syncSelection as EventListener);
    window.addEventListener('storage', syncSelection);

    return () => {
      window.removeEventListener(APP_DATA_CHANGED_EVENT, syncSelection as EventListener);
      window.removeEventListener('storage', syncSelection);
    };
  }, []);

  const updateSelection = useCallback((nextSelection: DocenteSelection) => {
    setDocenteSelection(nextSelection);
    setSelection(nextSelection);
  }, []);

  return { selection, setSelection: updateSelection };
}
