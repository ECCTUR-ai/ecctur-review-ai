import { useState, useEffect, useCallback, useRef } from 'react';

export function usePersistentPageState<T extends Record<string, any>>(key: string, defaultState: T) {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge defaults with parsed values to prevent missing properties on schema change
        return { ...defaultState, ...parsed };
      }
    } catch (e) {
      console.error(`Error reading localStorage key "${key}":`, e);
    }
    return defaultState;
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setState = useCallback((value: Partial<T> | ((prev: T) => Partial<T>)) => {
    setStateInternal(prev => {
      const updates = typeof value === 'function' ? (value as any)(prev) : value;
      const newState = { ...prev, ...updates };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(newState));
        } catch (e) {
          console.error(`Error writing localStorage key "${key}":`, e);
        }
      }, 250);

      return newState;
    });
  }, [key]);

  const resetState = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error clearing localStorage key "${key}":`, e);
    }
    setStateInternal(defaultState);
  }, [key, defaultState]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setState, resetState] as const;
}
