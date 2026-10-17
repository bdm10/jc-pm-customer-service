import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ScenarioId } from '../domain/types';

interface PresenterValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  scenarioId: ScenarioId | undefined;
  setScenarioId: (id: ScenarioId | undefined) => void;
}

const Ctx = createContext<PresenterValue | null>(null);
const KEY = 'cs-proto/presenter';

function read(): { open: boolean; scenarioId?: ScenarioId } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '') as { open: boolean; scenarioId?: ScenarioId };
  } catch {
    return { open: false };
  }
}

export function PresenterProvider({ children }: { children: ReactNode }) {
  const initial = read();
  const [open, setOpen] = useState<boolean>(initial.open ?? false);
  const [scenarioId, setScenarioId] = useState<ScenarioId | undefined>(initial.scenarioId);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ open, scenarioId }));
    } catch {
      /* preferencia local, opcional */
    }
  }, [open, scenarioId]);
  return <Ctx.Provider value={{ open, setOpen, scenarioId, setScenarioId }}>{children}</Ctx.Provider>;
}

export function usePresenter(): PresenterValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('PresenterProvider no encontrado');
  return v;
}
