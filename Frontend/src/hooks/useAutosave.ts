import { useState, useEffect, useCallback, useRef } from 'react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface UseAutosaveOptions {
  data: unknown;
  onSave: (data: unknown) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave({ data, onSave, debounceMs = 2000, enabled = true }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDataRef = useRef<unknown>(null);
  const lastSavedRef = useRef<string>('');

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync pending changes when back online
      if (pendingDataRef.current) {
        saveData(pendingDataRef.current);
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
  }, []);

  const saveData = useCallback(async (dataToSave: unknown) => {
    const dataString = JSON.stringify(dataToSave);
    
    // Skip if nothing changed
    if (dataString === lastSavedRef.current) return;

    if (!isOnline) {
      pendingDataRef.current = dataToSave;
      // Store in localStorage for crash recovery
      localStorage.setItem('planner_pending_changes', dataString);
      setStatus('offline');
      return;
    }

    setStatus('saving');
    try {
      await onSave(dataToSave);
      lastSavedRef.current = dataString;
      pendingDataRef.current = null;
      localStorage.removeItem('planner_pending_changes');
      setStatus('saved');
      
      // Reset to idle after 2 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Autosave failed:', error);
      pendingDataRef.current = dataToSave;
      localStorage.setItem('planner_pending_changes', dataString);
      setStatus('error');
    }
  }, [isOnline, onSave]);

  // Debounced save on data change
  useEffect(() => {
    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveData(data);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debounceMs, enabled, saveData]);

  const forceSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    saveData(data);
  }, [data, saveData]);

  return { status, isOnline, forceSave };
}
