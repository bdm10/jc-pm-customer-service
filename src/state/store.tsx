import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSeed, STATE_VERSION } from '../data/seed';
import type { DemoState, ScenarioId } from '../domain/types';
import { createMockServices } from '../services/mock';
import type { Services } from '../services/types';
import { resetScenario as resetScenarioState } from './reset';

const KEY = 'cs-proto/state';

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === STATE_VERSION) return parsed;
    }
  } catch {
    /* almacenamiento no disponible: se usa la semilla */
  }
  return createSeed(new Date());
}

function save(s: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin persistencia (navegación privada, etc.) */
  }
}

interface StoreValue {
  state: DemoState;
  /** Aplica una operación sobre una copia del estado. Los errores se propagan a quien llama. */
  apply: (fn: (s: DemoState) => void) => void;
  reset: () => void;
  resetScenario: (id: ScenarioId) => void;
  services: Services;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);
  const ref = useRef(state);

  const commit = useCallback((next: DemoState) => {
    ref.current = next;
    setState(next);
    save(next);
  }, []);

  const apply = useCallback(
    (fn: (s: DemoState) => void) => {
      const next = structuredClone(ref.current);
      fn(next);
      commit(next);
    },
    [commit],
  );

  const services = useMemo(
    () =>
      createMockServices(
        () => ref.current,
        (kind) => {
          let n = 0;
          apply((s) => {
            n = s.counters[kind];
            s.counters[kind] += 1;
          });
          return n;
        },
      ),
    [apply],
  );

  const reset = useCallback(() => commit(createSeed(new Date())), [commit]);
  const resetScenario = useCallback((id: ScenarioId) => commit(resetScenarioState(ref.current, id, createSeed(new Date()))), [commit]);

  const value = useMemo(() => ({ state, apply, reset, resetScenario, services }), [state, apply, reset, resetScenario, services]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider no encontrado');
  return v;
}
