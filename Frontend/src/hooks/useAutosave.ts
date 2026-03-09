import { useState, useEffect, useCallback, useRef } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface UseAutosaveOptions {
  data: unknown;
  onSave: (data: unknown) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

const RETRY_DELAY_MS = 30_000; // retry a failed save after 30 seconds

export function useAutosave({ data, onSave, debounceMs = 2000, enabled = true }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<unknown>(null);
  const lastSavedRef = useRef<string>('');

  // Keep onSave in a ref so the online/retry handlers always use the latest version
  // without being listed as effect dependencies.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const saveData = useCallback(
    async (dataToSave: unknown) => {
      const dataString = JSON.stringify(dataToSave);

      // Skip if nothing changed since last successful save
      if (dataString === lastSavedRef.current) return;

      if (!navigator.onLine) {
        pendingDataRef.current = dataToSave;
        localStorage.setItem('planner_pending_changes', dataString);
        setStatus('offline');
        return;
      }

      // Clear any pending retry since we're attempting now
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      setStatus('saving');
      try {
        await onSaveRef.current(dataToSave);
        lastSavedRef.current = dataString;
        pendingDataRef.current = null;
        localStorage.removeItem('planner_pending_changes');
        setStatus('saved');

        // Reset to idle after 2 seconds
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        console.error('Autosave failed:', error);
        pendingDataRef.current = dataToSave;
        localStorage.setItem('planner_pending_changes', dataString);
        setStatus('error');

        // Schedule a retry in 30 seconds
        retryTimeoutRef.current = setTimeout(() => {
          if (pendingDataRef.current) {
            void saveData(pendingDataRef.current);
          }
        }, RETRY_DELAY_MS);
      }
    },
    [] // no deps — uses refs for onSave and online status
  );

  // Track online/offline and sync pending changes when back online
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (pendingDataRef.current) {
        void saveData(pendingDataRef.current);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [saveData]);

  // Debounced save when data changes
  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      void saveData(data);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data, debounceMs, enabled, saveData]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const forceSave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void saveData(data);
  }, [data, saveData]);

  return { status, isOnline, forceSave };
}
