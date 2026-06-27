import { useSyncExternalStore, useCallback } from 'react';
import { store } from '../data/store';

let version = 0;
const listeners = new Set<() => void>();

store.subscribe(() => {
  version++;
  listeners.forEach(fn => fn());
});

export function useStore() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => listeners.delete(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => version, []);

  useSyncExternalStore(subscribe, getSnapshot);
  return store;
}
