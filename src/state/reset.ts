// Reinicio parcial de un escenario: restaura solo sus entidades y deja el resto de la demo como está.

import { SCENARIOS } from '../data/scenarios';
import type { DemoState, ScenarioId } from '../domain/types';

type EntityMap = 'orders' | 'shipments' | 'claims' | 'onboarding' | 'customers';

export function resetScenario(current: DemoState, id: ScenarioId, fresh: DemoState): DemoState {
  const next = structuredClone(current);
  const meta = SCENARIOS.find((s) => s.id === id);
  const touched = new Set<string>();

  const maps: EntityMap[] = ['orders', 'shipments', 'claims', 'onboarding', 'customers'];
  for (const key of maps) {
    const cur = next[key] as Record<string, { scenarioId?: ScenarioId }>;
    const seed = fresh[key] as Record<string, { scenarioId?: ScenarioId }>;
    for (const [eid, e] of Object.entries(cur)) {
      if (e.scenarioId === id) {
        touched.add(eid);
        delete cur[eid];
      }
    }
    for (const [eid, e] of Object.entries(seed)) {
      if (e.scenarioId === id) {
        touched.add(eid);
        cur[eid] = structuredClone(e);
      }
    }
  }
  for (const cid of meta?.customerIds ?? []) {
    if (fresh.customers[cid]) next.customers[cid] = structuredClone(fresh.customers[cid]);
  }
  for (const sku of meta?.stockSkus ?? []) next.stock[sku] = fresh.stock[sku];

  next.events = next.events.filter((e) => !touched.has(e.entityId));
  const maxId = next.counters.event;
  let n = maxId;
  for (const e of fresh.events) {
    if (touched.has(e.entityId)) next.events.push({ ...e, id: `E${++n}` });
  }
  next.counters.event = n;
  return next;
}
