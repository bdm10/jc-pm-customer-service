// Reglas derivadas sobre pedidos: bloqueos, siguiente paso, prioridad.

import { computeDeal } from './margin';
import { BLOCKER_LABEL, STAGE_ORDER, waitingOnText } from './labels';
import type { Blocker, Customer, DemoState, Order, OrderStage, Role } from './types';

export const openBlockers = (o: Order) => o.blockers.filter((b) => b.status !== 'resolved');

export const stageIndex = (s: OrderStage) => STAGE_ORDER.indexOf(s);

export const atLeast = (o: Order, s: OrderStage) => stageIndex(o.stage) >= stageIndex(s);

export function customerOf(state: DemoState, o: Order): Customer | undefined {
  return o.customerId ? state.customers[o.customerId] : undefined;
}

export function customerName(state: DemoState, o: Order): string {
  return customerOf(state, o)?.name ?? o.customerNameAsWritten ?? 'Cliente sin identificar';
}

/** Datos extraídos que el usuario todavía debe confirmar (confianza media o baja). */
export function pendingReviews(o: Order): number {
  // El cliente de un alta en curso no se «confirma» aquí: lo resuelve el alta.
  const onboardingPending = !!o.onboardingId && !o.customerId;
  const fields = o.fields.filter((f) => f.confidence !== 'alta' && !f.confirmed && !(onboardingPending && f.key === 'customer')).length;
  const lines = o.lines.filter((l) => l.uncertainty && !l.uncertainty.confirmed).length;
  return fields + lines;
}

export const isEnteredDirectlyInErp = (o: Order) => !o.capture;

/** Quién debe decidir sobre un bloqueo en este momento. */
export function blockerOwner(b: Blocker): Role {
  return b.status === 'waiting' && b.waitingOn ? b.waitingOn : b.decider;
}

export function blockerStatusText(b: Blocker): string {
  if (b.status === 'resolved') return 'Resuelto';
  if (b.status === 'waiting') return waitingOnText(b.waitingOn ?? b.decider);
  return 'Pendiente';
}

const you = (label: string, detail: string, target: string): NextAction => ({ label, detail, actor: 'cs', needs: 'you', target, kind: 'scroll' });

/** Acción que corresponde a Atención al Cliente para un bloqueo, o `null` si espera a otro rol. */
export function csActionFor(o: Order, b: Blocker): NextAction | null {
  if (b.status === 'resolved') return null;
  switch (b.type) {
    case 'commercial':
      return o.deal.approval.status === 'needed'
        ? you('Solicitar aprobación de la excepción comercial', 'Las condiciones pedidas están fuera del acuerdo. Debe aprobarlas quien tenga la autorización.', 'panel-deal')
        : null;
    case 'credit':
      if (b.status === 'waiting') return null;
      if (!o.credit?.requestedAt) return you('Solicitar revisión a Finanzas', 'Atención al Cliente no puede liberar un bloqueo de crédito. Prepara la solicitud con el contexto.', 'panel-credit');
      if (o.credit.decision === 'rejected' && !o.credit.informedAt)
        return you('Informar del rechazo al comercial', 'Finanzas no libera el pedido. Atención al Cliente no puede anular esa decisión.', 'panel-credit');
      return null;
    case 'observations':
      return b.status === 'waiting' ? null : you('Revisar las observaciones', b.reason, 'panel-observations');
    case 'stock': {
      const r = o.stockReview;
      if (b.status === 'waiting') return null;
      if (!r?.proposalPreparedAt) return you('Proponer una alternativa al cliente', b.reason, 'panel-stock');
      if (r.acceptance && !r.appliedAt) return you('Aplicar el cambio aceptado', 'El cliente ha aceptado. Aplica el cambio y repite la comprobación de disponibilidad.', 'panel-stock');
      return you('Repetir la comprobación de disponibilidad', 'Antes de liberar hay que confirmar de nuevo que hay stock.', 'panel-stock');
    }
    case 'merchandising': {
      const m = o.merch;
      if (!m) return null;
      const pendingReq = (['A', 'B', 'C'] as const).some((k) => m.approvals[k] === 'pending');
      if ((m.shortfall && !m.shortfall.decision) || pendingReq) return you('Revisar el material promocional', b.reason, 'panel-merchandising');
      if (b.status === 'waiting') return null;
      const decided = (['A', 'B', 'C'] as const).every((k) => m.approvals[k] !== 'requested');
      if (decided) return you('Resolver el bloqueo de merchandising', 'Las decisiones de aprobación están registradas.', 'panel-merchandising');
      return null;
    }
    case 'new_customer':
      return b.status === 'waiting' ? null : you('Completar el alta del cliente', b.reason, 'panel-new_customer');
  }
}

export interface NextAction {
  label: string;
  detail: string;
  actor: Role;
  /** 'you' = lo hace Atención al Cliente ahora; 'others' = espera a otro rol; 'none' = nada pendiente. */
  needs: 'you' | 'others' | 'none';
  target?: string;
  kind: 'scroll' | 'approve' | 'release' | 'none';
}

export function orderNextAction(state: DemoState, o: Order): NextAction {
  const open = openBlockers(o);
  if (o.stage === 'draft') {
    const pending = pendingReviews(o);
    if (pending > 0) {
      return {
        label: `Revisar ${pending} ${pending === 1 ? 'dato dudoso' : 'datos dudosos'}`,
        detail: 'Compara los datos marcados con el mensaje original y confírmalos o corrígelos.',
        actor: 'cs',
        needs: 'you',
        target: 'panel-datos',
        kind: 'scroll',
      };
    }
    const nc = open.find((b) => b.type === 'new_customer');
    if (nc?.status === 'waiting') {
      return { label: waitingOnText(blockerOwner(nc)), detail: nc.reason, actor: blockerOwner(nc), needs: 'others', target: 'panel-new_customer', kind: 'scroll' };
    }
    if (nc) {
      return {
        label: 'Completar el alta del cliente',
        detail: 'El pedido no puede enviarse al ERP hasta que exista la cuenta del cliente.',
        actor: 'cs',
        needs: 'you',
        target: 'panel-new_customer',
        kind: 'scroll',
      };
    }
    return {
      label: 'Aprobar y enviar al ERP',
      detail: 'Los datos están revisados. Al aprobar, el ERP (simulado) crea el pedido y ejecuta sus comprobaciones.',
      actor: 'cs',
      needs: 'you',
      kind: 'approve',
    };
  }
  if (o.stage === 'approved') {
    return { label: 'Esperando confirmación del ERP', detail: 'El ERP (simulado) está creando el pedido.', actor: 'erp', needs: 'others', kind: 'none' };
  }
  if (o.stage === 'erp_confirmed') {
    for (const b of open) {
      const a = csActionFor(o, b);
      if (a) return a;
    }
    if (open.length > 0) {
      const b = open[0];
      return {
        label: waitingOnText(blockerOwner(b)),
        detail: `${BLOCKER_LABEL[b.type]}: ${b.reason}`,
        actor: blockerOwner(b),
        needs: 'others',
        target: b.type === 'commercial' ? 'panel-deal' : `panel-${b.type}`,
        kind: 'scroll',
      };
    }
    return {
      label: 'Liberar el pedido en el ERP',
      detail: 'Todos los bloqueos están resueltos. El ERP (simulado) repite sus comprobaciones antes de liberar.',
      actor: 'cs',
      needs: 'you',
      kind: 'release',
    };
  }
  if (o.stage === 'released') {
    if (o.company === 'JC') {
      return {
        label: 'Logística JC prepara el envío',
        detail: 'En JC el envío de almacén lo crea Logística, no Atención al Cliente.',
        actor: 'logistics',
        needs: 'others',
        target: 'panel-shipment',
        kind: 'scroll',
      };
    }
    return {
      label: 'Preparar el envío de almacén',
      detail: 'En PM, Atención al Cliente crea el envío de almacén. Revisa agrupación, cantidades e instrucciones.',
      actor: 'cs',
      needs: 'you',
      target: 'panel-shipment',
      kind: 'scroll',
    };
  }
  if (o.stage === 'shipment_prepared') {
    return { label: 'En almacén: picking y salida', detail: 'El almacén prepara y registra el envío.', actor: 'warehouse', needs: 'others', target: 'panel-shipment', kind: 'scroll' };
  }
  if (o.stage === 'dispatched') {
    const sh = o.shipmentId ? state.shipments[o.shipmentId] : undefined;
    return {
      label: sh?.carrierUpdateMissing ? 'Sin noticias del transportista' : 'En tránsito',
      detail: sh?.carrierUpdateMissing ? 'El transportista no ha enviado actualización. No mostramos fecha estimada inventada.' : 'El pedido está con el transportista.',
      actor: 'carrier',
      needs: 'others',
      target: 'panel-shipment',
      kind: 'scroll',
    };
  }
  return { label: 'Entregado', detail: 'No hay acciones pendientes.', actor: 'system', needs: 'none', kind: 'none' };
}

export function orderAmount(state: DemoState, o: Order): number {
  const basis = o.deal.approval.status === 'approved' ? 'requested' : 'agreement';
  return computeDeal(o, customerOf(state, o), state.products, basis).revenue;
}

/** Exposición de crédito con este pedido (IVA incluido). */
export function creditExposure(state: DemoState, o: Order) {
  const c = customerOf(state, o);
  if (!c) return undefined;
  const basis = o.deal.approval.status === 'approved' ? 'requested' : 'agreement';
  const deal = computeDeal(o, c, state.products, basis);
  const outstanding = c.credit.balanceNotDue + c.credit.overdue;
  const after = outstanding + deal.totalWithVat;
  return {
    limit: c.credit.limit,
    outstanding,
    orderTotal: deal.totalWithVat,
    after,
    excess: Math.max(0, after - c.credit.limit),
    available: Math.max(0, c.credit.limit - outstanding),
    overdue: c.credit.overdue,
    oldestOverdueDays: c.credit.oldestOverdueDays,
    insurerCoverage: c.credit.insurerCoverage,
  };
}

export function productLabel(state: DemoState, sku: string): string {
  const p = state.products[sku];
  if (!p) return sku;
  if (p.kind === 'merch') return p.name;
  return `${p.name} ${p.vintage === 'Sin añada' ? '' : p.vintage} · ${p.format}`.replace(/\s+/g, ' ');
}
