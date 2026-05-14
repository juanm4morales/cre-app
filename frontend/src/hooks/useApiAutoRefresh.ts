import { DependencyList, useEffect, useRef } from 'react';
import { APP_DATA_CHANGED_EVENT } from '../services/api';

interface UseApiAutoRefreshOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export function useApiAutoRefresh(
  refresh: () => Promise<void> | void,
  deps: DependencyList = [],
  options: UseApiAutoRefreshOptions = {}
) {
  const { enabled = true, debounceMs = 150 } = options;
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        void refreshRef.current();
      }, debounceMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    };

    const handleDataChanged = () => {
      scheduleRefresh();
    };

    window.addEventListener('focus', scheduleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged as EventListener);

    return () => {
      window.removeEventListener('focus', scheduleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener(APP_DATA_CHANGED_EVENT, handleDataChanged as EventListener);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, ...deps]);
}
