import axios from 'axios';

const FIELD_LABELS: Record<string, string> = {
  dia_semana: 'Dia de semana',
  hora_inicio: 'Hora de inicio',
  hora_fin: 'Hora de fin',
  programa: 'Programa',
  fecha_desde: 'Fecha desde',
  fecha_hasta: 'Fecha hasta',
  unidad_ids: 'Unidades',
  clase_calendario: 'Clase de calendario',
  plan_estudio_ec: 'Plan de estudio',
  tipo_actividad: 'Tipo de actividad',
  descripcion: 'Descripcion',
  horas: 'Horas',
  fecha_inicio_ta: 'Fecha de inicio',
  fecha_fin_ta: 'Fecha de fin',
  modalidad_trabajo: 'Modalidad de trabajo',
  observaciones: 'Observaciones',
  detail: 'Detalle',
};

function formatFieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

function flattenMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenMessages(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
      const nestedMessages = flattenMessages(nested);
      if (nestedMessages.length === 0) {
        return [];
      }
      if (key === 'non_field_errors' || key === 'detail') {
        return nestedMessages;
      }
      const fieldLabel = formatFieldLabel(key);
      return nestedMessages.map((message) => `${fieldLabel}: ${message}`);
    });
  }

  return [];
}

function normalizeMessage(message: string): string {
  return message
    .replace(/authentication credentials were not provided\.?/gi, 'Debes iniciar sesion para continuar.')
    .replace(/this field may not be null\.?/gi, 'Este campo es obligatorio.')
    .replace(/this field is required\.?/gi, 'Este campo es obligatorio.')
    .replace(/not found\.?/gi, 'No se encontro el recurso solicitado.')
    .replace(/unable to authenticate with provided credentials\.?/gi, 'Usuario o contraseña incorrectos.')
    .trim();
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const status = error.response?.status;

  if (error.code === 'ECONNABORTED') {
    return 'La solicitud demoró demasiado. Revisa tu conexion e intentalo nuevamente.';
  }

  if (!error.response) {
    return 'No se pudo conectar con el servidor. Verifica tu conexion o intenta nuevamente en unos minutos.';
  }

  const data = error.response?.data;
  const messages = Array.from(new Set(flattenMessages(data).map(normalizeMessage).filter(Boolean)));
  if (messages.length > 0) {
    return messages.join(' · ');
  }

  if (status === 400) {
    return 'La solicitud tiene datos inválidos. Revisa los campos e inténtalo nuevamente.';
  }

  if (status === 401) {
    return 'Tu sesión expiró o no estás autenticado. Inicia sesión nuevamente.';
  }

  if (status === 403) {
    return 'No tienes permisos para realizar esta acción.';
  }

  if (status === 404) {
    return 'No se encontró el recurso solicitado.';
  }

  if (status === 409) {
    return 'La operación entró en conflicto con datos existentes.';
  }

  if (status && status >= 500) {
    return 'Ocurrió un error interno del servidor. Inténtalo nuevamente en unos minutos.';
  }

  if (error.message) {
    return error.message;
  }

  return fallback;
}
