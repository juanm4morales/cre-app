import axios from 'axios';

export const APP_DATA_CHANGED_EVENT = 'cre:api-data-changed';

interface DataChangedDetail {
  method: string;
  url: string;
}

function isMutationMethod(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

function emitDataChanged(detail: DataChangedDetail) {
  window.dispatchEvent(new CustomEvent<DataChangedDetail>(APP_DATA_CHANGED_EVENT, { detail }));
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const method = String(response?.config?.method || '').toUpperCase();
    const url = String(response?.config?.url || '');

    if (isMutationMethod(method) && url) {
      emitDataChanged({ method, url });
    }

    return response;
  },
  (error) => {
    const requestUrl = String(error?.config?.url || '');
    const isSessionProbe = requestUrl.includes('/auth/me');
    const isLoginScreen = window.location.pathname === '/login';

    if (isAuthenticationError(error) && !isSessionProbe && !isLoginScreen) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function isAuthenticationError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;
  const detail = String(error.response?.data?.detail || '').toLowerCase();

  if (status === 401) {
    return true;
  }

  if (status !== 403) {
    return false;
  }

  return (
    detail.includes('authentication credentials were not provided')
    || detail.includes('credenciales de autenticación')
    || detail.includes('sesión')
  );
}

function getCookie(name: string) {
  let cookieValue: string | null = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i += 1) {
      const cookie = cookies[i]?.trim();
      if (!cookie) {
        continue;
      }
      if (cookie.substring(0, name.length + 1) === `${name}=`) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export default api;
