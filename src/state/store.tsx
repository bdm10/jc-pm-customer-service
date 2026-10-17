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
  /**
   * Para acciones con espera (servicios simulados): devuelve un `apply` ligado al estado actual.
   * Si mientras tanto se reinicia la demo o el escenario, descarta el resultado en lugar de aplicarlo
   * sobre datos nuevos.
   */
  begin: () => (fn: (s: DemoState) => void) => void;
  reset: () => void;
  resetScenario: (id: ScenarioId) => void;
  services: Services;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);
  const ref = useRef(state);
  const epoch = useRef(0);

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

  const begin = useCallback(() => {
    const started = epoch.current;
    return (fn: (s: DemoState) => void) => {
      if (epoch.current !== started) throw new Error('La demo se ha reiniciado mientras se esperaba la respuesta simulada. La acción se ha descartado.');
      apply(fn);
    };
  }, [apply]);

  const reset = useCallback(() => {
    epoch.current += 1;
    commit(createSeed(new Date()));
  }, [commit]);
  const resetScenario = useCallback(
    (id: ScenarioId) => {
      epoch.current += 1;
      commit(resetScenarioState(ref.current, id, createSeed(new Date())));
    },
    [commit],
  );

  const value = useMemo(() => ({ state, apply, begin, reset, resetScenario, services }), [state, apply, begin, reset, resetScenario, services]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('StoreProvider no encontrado');
  return v;
}
