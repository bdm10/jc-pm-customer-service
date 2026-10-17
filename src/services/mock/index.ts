// Implementaciones simuladas. No hay red, no se envía nada y no se modifica ningún sistema real.
// Los resultados son deterministas a partir del estado de la demo.

import { findDuplicateCandidates } from '../../domain/onboarding';
import { creditExposure, customerOf, productLabel } from '../../domain/orders';
import { proposeShipment } from '../../domain/shipment';
import type { BlockerType, DemoState, Role } from '../../domain/types';
import type { Services } from '../types';

let latencyMs = 650;
export function setLatency(ms: number) {
  latencyMs = ms;
}

const wait = <T>(value: T, factor = 1): Promise<T> => new Promise((r) => setTimeout(() => r(value), latencyMs * factor));

function token(seed: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 2166136261;
  for (const ch of seed + Date.now()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.abs(h) % alphabet.length];
    h = Math.imul(h ^ (i + 7), 16777619);
  }
  return out;
}

export function createMockServices(getState: () => DemoState, takeNumber: (kind: 'erp' | 'customer') => number): Services {
  return {
    capture: {
      async listPendingDrafts() {
        return wait([]);
      },
      async reportOutcome() {
        return wait(undefined, 0.3);
      },
    },

    erp: {
      async createSalesOrder(order) {
        const s = getState();
        const n = takeNumber('erp');
        const erpNumber = `PV-26-${String(n).padStart(6, '0')}`;
        const blocks: { type: BlockerType; reason: string; decider: Role }[] = [];
        const checks: { label: string; ok: boolean }[] = [];

        const exp = creditExposure(s, order);
        const creditOk = !exp || (exp.after <= exp.limit && exp.oldestOverdueDays <= 30);
        checks.push({ label: 'Crédito', ok: creditOk });
        if (!creditOk) blocks.push({ type: 'credit', reason: 'El saldo pendiente más este pedido supera el límite de crédito.', decider: 'finance' });

        const short = order.lines.filter((l) => (s.stock[l.sku] ?? 0) < l.quantity);
        checks.push({ label: 'Stock', ok: short.length === 0 });
        for (const l of short) blocks.push({ type: 'stock', reason: `${productLabel(s, l.sku)}: pedidas ${l.quantity}, disponibles ${s.stock[l.sku] ?? 0}.`, decider: 'customer' });

        const hasMerch = order.lines.some((l) => s.products[l.sku]?.kind === 'merch');
        checks.push({ label: 'Merchandising', ok: !hasMerch });
        if (hasMerch) blocks.push({ type: 'merchandising', reason: 'Incluye material promocional.', decider: 'trade_marketing' });

        // Propuesta: las instrucciones llegan en campos estructurados desde el borrador revisado,
        // por lo que no se vuelcan como texto libre en «Observaciones».
        checks.push({ label: 'Observaciones', ok: true });
        checks.push({ label: 'Cliente', ok: !!customerOf(s, order) });

        return wait({ erpNumber, released: blocks.length === 0, blocks, checks }, 1.6);
      },

      async releaseOrder(order) {
        const s = getState();
        const short = order.lines.filter((l) => (s.stock[l.sku] ?? 0) < l.quantity);
        if (short.length) return wait({ ok: false, detail: `Stock insuficiente en ${short.map((l) => productLabel(s, l.sku)).join(', ')}.` }, 1.4);
        return wait({ ok: true, detail: 'Comprobaciones repetidas sin incidencias.' }, 1.4);
      },

      async createCustomer() {
        const n = takeNumber('customer');
        return wait({ customerId: `C-${n}` }, 1.6);
      },
    },

    inventory: {
      async checkAvailability(lines) {
        const s = getState();
        const need: Record<string, number> = {};
        for (const l of lines) need[l.sku] = (need[l.sku] ?? 0) + l.quantity;
        return wait(
          Object.entries(need).map(([sku, requested]) => {
            const available = s.stock[sku] ?? 0;
            return { sku, requested, available, ok: available >= requested };
          }),
          1.2,
        );
      },
    },

    approvals: {
      async requestApproval(input) {
        return wait({ requestId: `APR-${token(input.entityId).slice(0, 5)}` });
      },
    },

    warehouse: {
      async proposeShipment(orderId) {
        return wait(proposeShipment(getState(), orderId), 1.2);
      },
      async confirmShipment() {
        return wait({ accepted: true }, 1.2);
      },
    },

    links: {
      async createLink(purpose, entityId) {
        const t = token(`${purpose}-${entityId}`);
        const host = purpose === 'tracking' ? 'seguimiento.ejemplo.invalid/t' : 'altas.ejemplo.invalid/f';
        const days = purpose === 'tracking' ? 30 : 7;
        return wait({ token: t, url: `https://${host}/${t}`, expiresAt: new Date(Date.now() + days * 86400000).toISOString() }, 0.6);
      },
    },

    directory: {
      async findDuplicates(data) {
        return wait(findDuplicateCandidates(Object.values(getState().customers), data), 0.8);
      },
    },

    messaging: {
      async prepareDraft() {
        return wait({ draftId: `MSG-${token('msg').slice(0, 5)}`, sent: false as const }, 0.5);
      },
    },
  };
}
