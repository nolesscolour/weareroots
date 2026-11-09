import { createContext, useContext, useSyncExternalStore } from 'react';
import type { RootsController } from './RootsController';
import type { RootsState } from '../types';

export const RootsContext = createContext<RootsController | null>(null);

export function useController(): RootsController {
  const c = useContext(RootsContext);
  if (!c) throw new Error('RootsContext missing');
  return c;
}

export function useRoots(): RootsState {
  const c = useController();
  return useSyncExternalStore(c.subscribe, c.getState, c.getState);
}
