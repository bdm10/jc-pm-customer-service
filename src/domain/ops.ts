// Operaciones sobre el estado de la demo. Son funciones puras que mutan una copia del estado
// (el store hace la copia). Cada operación deja rastro en el historial.
// Regla clave: ninguna operación de un rol puede resolver un bloqueo que pertenece a otro rol.

import { fmtLongDay, fromDateInput } from './format';
import { findCommercialExceptions } from './margin';
import { canCreateAccount } from './onboarding';
import { CLAIM_TYPE_LABEL, OBSERVATION_KIND_LABEL, ROLE_LABEL, STOCK_OPTION_LABEL } from './labels';
import { productLabel } from './orders';
import type { ShipmentProposal } from './shipment';
import type {
  Blocker,
  BlockerType,
  ClaimType,
  DemoState,
  DuplicateCandidate,
  FinanceDecision,
  MerchCategory,
  ObservationKind,
  OnboardingCustomerData,
  OnboardingInternalData,
  Order,
  Role,
  TimelineEvent,
} from './types';

const nowIso = () => new Date().toISOString();

export function log(s: DemoState, entityId: string, actor: Role, kind: TimelineEvent['kind'], text: string, actorName?: string) {
  s.counters.event += 1;
  s.events.push({ id: `E${s.counters.event}`, entityId, at: nowIso(), actor, kind, text, actorName });
}

const me = (s: DemoState) => s.currentUser.name;

function order(s: DemoState, id: string): Order {
  const o = s.orders[id];
  if (!o) throw new Error(`Pedido ${id} no encontrado`);
  return o;
}

function blocker(o: Order, type: BlockerType): Blocker | undefined {
  return o.blockers.find((b) => b.type === type && b.status !== 'resolved');
}

function resolve(b: Blocker, by: Role, resolution: string) {
  b.status = 'resolved';
  b.resolvedBy = by;
  b.resolvedAt = nowIso();
  b.resolution = resolution;
  b.waitingOn = undefined;
}

// ---------------------------------------------------------------- Asignación

export function assignToMe(s: DemoState, kind: 'order' | 'claim' | 'enquiry', id: string) {
  const target = kind === 'order' ? s.orders[id] : kind === 'claim' ? s.claims[id] : s.enquiries[id];
  target.owner = me(s);
  log(s, id, 'cs', 'action', `Se asigna a ${me(s)}.`, me(s));
}

// ---------------------------------------------------------------- Borradores (capa de captura)

export function confirmField(s: DemoState, orderId: string, key: string) {
  const f = order(s, orderId).fields.find((x) => x.key === key);
  if (!f || f.confirmed) return;
  f.confirmed = true;
  log(s, orderId, 'cs', 'decision', `Confirma «${f.label}»: ${f.value}.`, me(s));
}

/**
 * Corrige un dato extraído y lo traslada al pedido: la fecha (valor AAAA-MM-DD) cambia la fecha de entrega,
 * la dirección (valor «addr:<id>» o texto libre) cambia la dirección y la referencia cambia la referencia.
 */
export function editField(s: DemoState, orderId: string, key: string, value: string) {
  const o = order(s, orderId);
  const f = o.fields.find((x) => x.key === key);
  if (!f || !value.trim()) return;
  const before = f.value;
  if (key === 'deliveryDate' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    o.requestedDeliveryDate = fromDateInput(value);
    f.value = fmtLongDay(o.requestedDeliveryDate);
  } else if (key === 'deliveryAddress' && value.startsWith('addr:')) {
    const c = o.customerId ? s.customers[o.customerId] : undefined;
    const a = c?.addresses.find((x) => x.id === value.slice(5));
    if (!a) return;
    o.deliveryAddressId = a.id;
    f.value = `${a.label} — ${a.street}, ${a.postalCode} ${a.city}`;
  } else {
    if (key === 'deliveryAddress') o.deliveryAddressText = value;
    if (key === 'customerReference') o.customerReference = value;
    f.value = value;
  }
  f.confirmed = true;
  log(s, orderId, 'cs', 'decision', `Corrige «${f.label}»: «${before}» → «${f.value}».`, me(s));
}

export function confirmLine(s: DemoState, orderId: string, lineId: string) {
  const l = order(s, orderId).lines.find((x) => x.id === lineId);
  if (!l?.uncertainty || l.uncertainty.confirmed) return;
  l.uncertainty.confirmed = true;
  log(s, orderId, 'cs', 'decision', `Confirma ${productLabel(s, l.sku)} (${l.quantity} uds).`, me(s));
}

export function changeLineQuantity(s: DemoState, orderId: string, lineId: string, qty: number) {
  const o = order(s, orderId);
  const l = o.lines.find((x) => x.id === lineId);
  if (!l || o.stage !== 'draft' || qty < 0) return;
  const before = l.quantity;
  l.quantity = qty;
  if (l.uncertainty) l.uncertainty.confirmed = true;
  log(s, orderId, 'cs', 'decision', `Corrige la cantidad de ${productLabel(s, l.sku)}: ${before} → ${qty}.`, me(s));
}

export function approveDraft(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  if (o.stage !== 'draft') return;
  o.stage = 'approved';
  o.approvedAt = nowIso();
  log(s, orderId, 'cs', 'decision', 'Aprueba el borrador y lo envía al ERP.', me(s));
}

export interface ErpCreateResult {
  erpNumber: string;
  released: boolean;
  blocks: { type: BlockerType; reason: string; decider: Role }[];
  checks: { label: string; ok: boolean }[];
}

export function applyErpCreate(s: DemoState, orderId: string, r: ErpCreateResult) {
  const o = order(s, orderId);
  if (o.stage !== 'approved') return; // solo un borrador aprobado puede confirmarse en el ERP
  o.erpNumber = r.erpNumber;
  o.stage = 'erp_confirmed';
  log(s, orderId, 'erp', 'system', `Pedido ${r.erpNumber} creado en el ERP (simulado).`);
  log(s, orderId, 'erp', 'system', `Comprobaciones automáticas: ${r.checks.map((c) => `${c.label} ${c.ok ? '✓' : '✗'}`).join(' · ')}.`);
  for (const b of r.blocks) {
    o.blockers.push({ id: `B-${b.type}-${s.counters.event}`, type: b.type, origin: 'erp', status: 'open', reason: b.reason, decider: b.decider });
    log(s, orderId, 'erp', 'system', `Retenido: ${b.reason}`);
  }
  if (r.released) {
    o.stage = 'released';
    o.releasedAt = nowIso();
    log(s, orderId, 'erp', 'system', 'Liberado automáticamente: pasa a preparación de envío.');
  }
}

export function noteCaptureFeedback(s: DemoState, orderId: string, corrections: number) {
  const o = order(s, orderId);
  if (!o.capture) return;
  log(
    s,
    orderId,
    'capture',
    'system',
    `Resultado devuelto a la capa de captura (simulado): borrador ${o.capture.draftId} aprobado${corrections ? ` con ${corrections} corrección(es)` : ' sin correcciones'}.`,
  );
}

// ---------------------------------------------------------------- Liberación

export function applyRelease(s: DemoState, orderId: string, ok: boolean, detail: string) {
  const o = order(s, orderId);
  if (o.stage !== 'erp_confirmed') return;
  if (o.blockers.some((b) => b.status !== 'resolved')) throw new Error('No se puede liberar con bloqueos abiertos');
  if (ok) {
    o.stage = 'released';
    o.releasedAt = nowIso();
    log(s, orderId, 'erp', 'system', `Pedido liberado (simulado). ${detail}`);
  } else {
    log(s, orderId, 'erp', 'system', `El ERP (simulado) no libera el pedido: ${detail}`);
  }
}

// ---------------------------------------------------------------- Observaciones

export function classifySegment(s: DemoState, orderId: string, segId: string, kind: ObservationKind) {
  const o = order(s, orderId);
  const seg = o.observation?.segments.find((x) => x.id === segId);
  if (!seg) return;
  seg.classification = kind;
  if (kind === 'one_off_delivery' && !seg.structured) seg.structured = { address: '', date: o.requestedDeliveryDate, window: '', contact: '' };
  const followed = kind === seg.suggestion ? ' (coincide con la sugerencia)' : ' (distinta de la sugerencia)';
  log(s, orderId, 'cs', 'decision', `Clasifica «${seg.text.slice(0, 48)}…» como ${OBSERVATION_KIND_LABEL[kind]}${followed}.`, me(s));
}

export function updateStructured(s: DemoState, orderId: string, segId: string, patch: Partial<{ address: string; date: string; window: string; contact: string }>) {
  const seg = order(s, orderId).observation?.segments.find((x) => x.id === segId);
  if (!seg) return;
  seg.structured = { address: '', date: '', window: '', contact: '', ...seg.structured, ...patch };
}

export function chooseConflict(s: DemoState, orderId: string, conflictId: string, optionId: string) {
  const c = order(s, orderId).observation?.conflicts.find((x) => x.id === conflictId);
  if (!c) return;
  c.chosen = optionId;
  const opt = c.options.find((x) => x.id === optionId);
  log(s, orderId, 'cs', 'decision', `Conflicto «${c.title}»: ${opt?.label}.`, me(s));
}

export function activeConflicts(o: Order) {
  const r = o.observation;
  if (!r) return [];
  return r.conflicts.filter((c) => r.segments.find((sg) => sg.id === c.segmentId)?.classification === 'one_off_delivery');
}

export function observationReadiness(o: Order): { ready: boolean; waitingCustomer: boolean; consultWith?: Role; missing: string[] } {
  const r = o.observation;
  if (!r) return { ready: false, waitingCustomer: false, missing: ['Sin observaciones'] };
  const missing: string[] = [];
  for (const sg of r.segments) {
    if (!sg.classification) missing.push('Clasificar todas las partes de la nota');
    if (sg.classification === 'one_off_delivery') {
      if (!sg.structured?.address?.trim()) missing.push('Indicar la dirección del cambio puntual');
      if (!sg.structured?.date) missing.push('Indicar la fecha del cambio puntual');
    }
  }
  const conflicts = activeConflicts(o);
  if (conflicts.some((c) => !c.chosen)) missing.push('Revisar todos los conflictos');
  const waitingCustomer = conflicts.some((c) => c.chosen === 'ask_customer');
  // «Otra» y «Condición comercial» nunca liberan: obligan a consultar antes de seguir.
  const consultWith: Role | undefined = r.segments.some((x) => x.classification === 'commercial')
    ? 'sales'
    : r.segments.some((x) => x.classification === 'other')
      ? 'customer'
      : undefined;
  return { ready: missing.length === 0, waitingCustomer, consultWith, missing: Array.from(new Set(missing)) };
}

export function resolveObservations(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'observations');
  const r = o.observation;
  if (!b || !r) return;
  const st = observationReadiness(o);
  if (!st.ready) throw new Error('Faltan decisiones en las observaciones');
  if (st.consultWith) {
    b.status = 'waiting';
    b.waitingOn = st.consultWith;
    log(
      s,
      orderId,
      'cs',
      'action',
      st.consultWith === 'sales'
        ? 'Consulta al comercial la condición comercial de la nota. El pedido sigue retenido.'
        : 'Consulta al cliente qué significa la parte de la nota sin clasificar. El pedido sigue retenido.',
      me(s),
    );
    return;
  }
  if (st.waitingCustomer) {
    b.status = 'waiting';
    b.waitingOn = 'customer';
    log(s, orderId, 'cs', 'action', 'Consulta al cliente antes de aplicar el cambio. El pedido sigue retenido.', me(s));
    return;
  }
  const oneOff = r.segments.find((x) => x.classification === 'one_off_delivery');
  if (oneOff?.structured) {
    const addrChoice = r.conflicts.find((c) => c.id === 'cf-address')?.chosen;
    const winChoice = r.conflicts.find((c) => c.id === 'cf-window')?.chosen;
    o.structuredDelivery = {
      address: addrChoice === 'use_event' ? oneOff.structured.address : undefined,
      date: oneOff.structured.date,
      window: oneOff.structured.window || undefined,
      contact: oneOff.structured.contact || undefined,
      carrierNote: winChoice === 'friday_no_window' ? 'Informar al cliente: franja no garantizada.' : undefined,
    };
    if (winChoice === 'friday_window' || winChoice === 'friday_no_window') o.requestedDeliveryDate = oneOff.structured.date;
    o.deal.timeWindowService = winChoice === 'friday_window';
  }
  const parts = r.segments.map((x) => OBSERVATION_KIND_LABEL[x.classification as ObservationKind]).join(' + ');
  resolve(b, 'cs', `Clasificado: ${parts}. La nota original se conserva; el cambio puntual se guarda en campos estructurados.`);
  log(s, orderId, 'cs', 'decision', 'Resuelve el bloqueo de observaciones.', me(s));
  log(s, orderId, 'erp', 'system', 'Campos de entrega estructurados actualizados en el pedido (simulado). La ficha del cliente no cambia.');
}

/** Llega la respuesta a una consulta: la persona vuelve a clasificar la parte afectada con la nueva información. */
export function simulateConsultAnswer(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'observations');
  if (!b || !o.observation) return;
  const role: Role = b.waitingOn === 'sales' ? 'sales' : 'customer';
  const who = role === 'sales' ? 'el comercial' : 'el cliente';
  for (const sg of o.observation.segments) if (sg.classification === 'commercial' || sg.classification === 'other') sg.classification = undefined;
  b.status = 'open';
  b.waitingOn = undefined;
  log(s, orderId, role, 'demo', `Control de demo: responde ${who}. Vuelve a clasificar la parte consultada con la nueva información.`);
}

export function simulateCustomerConfirmsObservation(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'observations');
  if (!b || !o.observation) return;
  for (const c of o.observation.conflicts) if (c.chosen === 'ask_customer') c.chosen = c.options[0].id;
  b.status = 'open';
  b.waitingOn = undefined;
  log(s, orderId, 'customer', 'demo', 'Control de demo: el cliente confirma la dirección del evento y el viernes antes de las 10:00.');
}

// ---------------------------------------------------------------- Crédito (decide Finanzas)

export function requestCreditReview(s: DemoState, orderId: string, note: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'credit');
  if (!b) return;
  o.credit = { ...o.credit, requestedAt: nowIso(), requestNote: note };
  b.status = 'waiting';
  b.waitingOn = 'finance';
  log(s, orderId, 'cs', 'action', `Solicita revisión de crédito a Finanzas: «${note}»`, me(s));
}

export function financeDecision(s: DemoState, orderId: string, decision: FinanceDecision, note: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'credit');
  if (!b || !o.credit?.requestedAt) throw new Error('Finanzas solo decide sobre una solicitud enviada');
  o.credit.decision = decision;
  o.credit.decisionNote = note;
  o.credit.decidedAt = nowIso();
  if (decision === 'rejected') {
    b.status = 'open';
    b.waitingOn = undefined;
    log(s, orderId, 'finance', 'decision', `Finanzas rechaza liberar el pedido: ${note}`, 'Finanzas (simulado)');
    return;
  }
  resolve(b, 'finance', decision === 'approved' ? `Aprobado por Finanzas: ${note}` : `Aprobado con condiciones por Finanzas: ${note}`);
  log(s, orderId, 'finance', 'decision', `Finanzas ${decision === 'approved' ? 'aprueba' : 'aprueba con condiciones'}: ${note}`, 'Finanzas (simulado)');
}

export function informCreditRejection(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  if (!o.credit) return;
  o.credit.informedAt = nowIso();
  const b = blocker(o, 'credit');
  if (b) {
    b.status = 'waiting';
    b.waitingOn = 'sales';
  }
  log(s, orderId, 'cs', 'action', 'Prepara aviso al comercial con la decisión de Finanzas (no se envía en el prototipo).', me(s));
}

export function resubmitCreditAfterPrepayment(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'credit');
  if (!b || !o.credit) return;
  o.credit = { requestedAt: nowIso(), requestNote: 'El cliente acepta pagar este pedido por anticipado (gestión del comercial). Se pide a Finanzas que lo revise de nuevo.' };
  b.status = 'waiting';
  b.waitingOn = 'finance';
  log(s, orderId, 'sales', 'demo', 'Control de demo: el comercial acuerda con el cliente el pago anticipado. Vuelve a Finanzas para decidir.', 'Comercial (simulado)');
}

// ---------------------------------------------------------------- Excepción comercial (no toca el crédito)

export function requestCommercialApproval(s: DemoState, orderId: string, approver: Role, note: string) {
  const o = order(s, orderId);
  const b = blocker(o, 'commercial');
  o.deal.approval = { status: 'requested', requestedAt: nowIso(), note };
  if (b) {
    b.status = 'waiting';
    b.waitingOn = approver;
    b.decider = approver;
  }
  log(s, orderId, 'cs', 'action', `Envía la excepción comercial a ${ROLE_LABEL[approver]}: «${note}»`, me(s));
}

export function commercialDecision(s: DemoState, orderId: string, approve: boolean) {
  const o = order(s, orderId);
  const b = blocker(o, 'commercial');
  const approver = b?.decider ?? 'commercial_mgmt';
  o.deal.approval = { ...o.deal.approval, status: approve ? 'approved' : 'rejected', decidedAt: nowIso() };
  if (!approve) {
    // Se aplican las condiciones del acuerdo.
    const customer = o.customerId ? s.customers[o.customerId] : undefined;
    for (const l of o.lines) {
      l.requestedDiscountPct = l.agreementDiscountPct;
      l.freeUnits = l.agreementFreeUnits;
    }
    if (customer) o.deal.paymentTermsRequestedDays = customer.agreement.paymentTermsDays;
  }
  if (b) resolve(b, approver, approve ? 'Excepción aprobada: se aplican las condiciones solicitadas.' : 'Excepción rechazada: se aplican las condiciones del acuerdo.');
  log(s, orderId, approver, 'decision', approve ? 'Aprueba la excepción comercial.' : 'Rechaza la excepción comercial; se aplican las condiciones del acuerdo.', `${ROLE_LABEL[approver]} (simulado)`);
  if (blocker(o, 'credit')) log(s, orderId, 'system', 'system', 'Recordatorio: la aprobación comercial no libera el bloqueo de crédito. Sigue pendiente de Finanzas.');
}

/** Detecta excepciones comerciales en pedidos y añade el bloqueo propuesto si no existe. */
export function ensureCommercialBlocker(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const customer = o.customerId ? s.customers[o.customerId] : undefined;
  const ex = findCommercialExceptions(o, customer, s.products);
  if (ex.length && !o.blockers.some((b) => b.type === 'commercial') && o.deal.approval.status === 'not_needed') {
    o.deal.approval = { status: 'needed' };
    o.blockers.push({ id: 'B-COMM', type: 'commercial', origin: 'workspace', status: 'open', reason: 'Condiciones fuera del acuerdo comercial.', decider: 'commercial_mgmt' });
  }
}

// ---------------------------------------------------------------- Stock

export function selectStockOption(s: DemoState, orderId: string, optionId: string) {
  const o = order(s, orderId);
  const r = o.stockReview;
  if (!r || r.acceptance) return;
  r.selectedOptionId = optionId;
  r.proposalPreparedAt = undefined;
  const b = blocker(o, 'stock');
  if (b) {
    b.status = 'open';
    b.waitingOn = undefined;
  }
}

export function prepareStockProposal(s: DemoState, orderId: string, text: string) {
  const o = order(s, orderId);
  const r = o.stockReview;
  const b = blocker(o, 'stock');
  if (!r || !r.selectedOptionId || !b) return;
  r.proposalPreparedAt = nowIso();
  r.proposalText = text;
  b.status = 'waiting';
  b.waitingOn = 'customer';
  const opt = r.options.find((x) => x.id === r.selectedOptionId)!;
  log(s, orderId, 'cs', 'action', `Prepara propuesta al cliente: ${STOCK_OPTION_LABEL[opt.kind]} — ${opt.title}. (No se envía en el prototipo.)`, me(s));
}

export function recordStockAcceptance(s: DemoState, orderId: string, by: string, via: string) {
  const o = order(s, orderId);
  const r = o.stockReview;
  const b = blocker(o, 'stock');
  if (!r?.proposalPreparedAt || !r.selectedOptionId || !b) throw new Error('No hay propuesta preparada');
  if (!by.trim()) throw new Error('Indica quién acepta');
  r.acceptance = { optionId: r.selectedOptionId, by, via, at: nowIso() };
  b.status = 'open';
  b.waitingOn = undefined;
  const opt = r.options.find((x) => x.id === r.selectedOptionId)!;
  log(s, orderId, 'customer', 'decision', `Acepta explícitamente: ${opt.title} (vía ${via}).`, by);
  if (opt.simulatedCompetingReservation) {
    const avail = s.stock[opt.targetSku] ?? 0;
    const take = Math.min(opt.simulatedCompetingReservation, avail);
    s.stock[opt.targetSku] = avail - take;
    log(s, orderId, 'erp', 'system', `Mientras tanto se han reservado ${take} uds de ${productLabel(s, opt.targetSku)} para otro pedido (simulado).`);
  }
}

export function applyStockOption(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const r = o.stockReview;
  if (!r?.acceptance) throw new Error('No se puede sustituir sin aceptación explícita del cliente');
  if (r.appliedAt) return;
  const opt = r.options.find((x) => x.id === r.acceptance!.optionId)!;
  const l = o.lines.find((x) => x.id === r.lineId)!;
  const fromSku = l.sku;
  const fromQty = l.quantity;
  if (opt.kind === 'vintage' || opt.kind === 'format') {
    l.substitution = { fromSku, fromQuantity: fromQty, acceptedBy: r.acceptance.by, acceptedVia: r.acceptance.via, acceptedAt: r.acceptance.at };
    l.sku = opt.targetSku;
    l.quantity = opt.targetQuantity;
  } else if (opt.kind === 'partial') {
    l.quantity = opt.targetQuantity;
    l.backorderQty = opt.backorderQty;
  } else if (opt.kind === 'later' && opt.newDeliveryDate) {
    o.requestedDeliveryDate = opt.newDeliveryDate;
  }
  r.appliedAt = nowIso();
  log(s, orderId, 'cs', 'decision', `Aplica el cambio aceptado: ${opt.title}.`, me(s));
}

export function applySecondCheck(s: DemoState, orderId: string, results: { sku: string; requested: number; available: number; ok: boolean }[]) {
  const o = order(s, orderId);
  const r = o.stockReview;
  const b = blocker(o, 'stock');
  if (!r?.appliedAt || !b) return;
  const ok = results.every((x) => x.ok);
  r.secondCheck = { at: nowIso(), ok, results };
  log(
    s,
    orderId,
    'erp',
    'system',
    `Segunda comprobación de disponibilidad: ${results.map((x) => `${productLabel(s, x.sku)} ${x.available}/${x.requested}`).join(' · ')} → ${ok ? 'disponible' : 'insuficiente'}.`,
  );
  if (ok) {
    const opt = r.options.find((x) => x.id === r.acceptance?.optionId);
    resolve(b, 'cs', `Alternativa aceptada por ${r.acceptance?.by} (${opt?.title}) y disponibilidad confirmada en la segunda comprobación.`);
  } else {
    b.status = 'waiting';
    b.waitingOn = 'logistics';
  }
}

export function simulateGoodsReceipt(s: DemoState, orderId: string, sku: string, qty: number) {
  s.stock[sku] = (s.stock[sku] ?? 0) + qty;
  const o = order(s, orderId);
  const b = blocker(o, 'stock');
  if (b) {
    b.status = 'open';
    b.waitingOn = undefined;
  }
  if (o.stockReview) o.stockReview.secondCheck = undefined;
  log(s, orderId, 'warehouse', 'demo', `Control de demo: entrada de mercancía de ${qty} uds de ${productLabel(s, sku)}.`);
}

// ---------------------------------------------------------------- Merchandising (reglas provisionales)

export const MERCH_RULES: Record<MerchCategory, { label: string; examples: string; rule: string; approver: Role | null }> = {
  A: { label: 'Consumibles de punto de venta', examples: 'Posavasos, folletos, cartas', rule: 'Aprobación automática hasta 100 € por pedido', approver: null },
  B: { label: 'Material reutilizable', examples: 'Cubiteras, pizarras, abridores', rule: 'Aprueba el/la jefe/a de ventas de zona hasta 300 € por pedido', approver: 'sales_manager' },
  C: { label: 'Mobiliario y expositores', examples: 'Expositores de suelo, neveras', rule: 'Aprueba siempre Trade Marketing', approver: 'trade_marketing' },
};

export function decideShortfall(s: DemoState, orderId: string, decision: 'split' | 'reduce' | 'wait') {
  const o = order(s, orderId);
  const m = o.merch;
  if (!m?.shortfall) return;
  m.shortfall.decision = decision;
  const l = o.lines.find((x) => x.id === m.shortfall!.lineId);
  if (l) {
    l.backorderQty = undefined;
    l.quantity = m.shortfall.requested;
    if (decision === 'split') {
      l.quantity = m.shortfall.available;
      l.backorderQty = m.shortfall.requested - m.shortfall.available;
    } else if (decision === 'reduce') {
      l.quantity = m.shortfall.available;
    }
  }
  const { requested, available } = m.shortfall;
  const text = { split: `Enviar ${available} ahora y ${requested - available} cuando haya stock`, reduce: `Reducir a ${available}`, wait: `Esperar a tener los ${requested}` }[decision];
  log(s, orderId, 'cs', 'decision', `Material sin stock suficiente: ${text}.`, me(s));
}

export function requestMerchApprovals(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const m = o.merch;
  const b = blocker(o, 'merchandising');
  if (!m || !b) return;
  const asked: string[] = [];
  for (const k of ['A', 'B', 'C'] as MerchCategory[]) {
    if (m.approvals[k] === 'pending') {
      m.approvals[k] = 'requested';
      asked.push(ROLE_LABEL[MERCH_RULES[k].approver ?? 'system']);
    }
  }
  b.status = 'waiting';
  b.waitingOn = 'trade_marketing';
  log(s, orderId, 'cs', 'action', `Solicita aprobación de material a: ${asked.join(', ')}.`, me(s));
}

export function merchDecision(s: DemoState, orderId: string, cat: MerchCategory, approve: boolean) {
  const o = order(s, orderId);
  const m = o.merch;
  const b = blocker(o, 'merchandising');
  if (!m || m.approvals[cat] !== 'requested') return;
  m.approvals[cat] = approve ? 'approved' : 'rejected';
  const role = MERCH_RULES[cat].approver ?? 'system';
  if (!approve) {
    // El material rechazado se retira del pedido.
    o.lines = o.lines.filter((l) => s.products[l.sku]?.merchCategory !== cat);
    if (m.shortfall && !o.lines.some((l) => l.id === m.shortfall!.lineId)) m.shortfall = undefined;
  }
  log(s, orderId, role, 'decision', `${approve ? 'Aprueba' : 'Rechaza'} el material de categoría ${cat} (${MERCH_RULES[cat].label}).${approve ? '' : ' Se retira del pedido.'}`, `${ROLE_LABEL[role]} (simulado)`);
  const stillWaiting = (['A', 'B', 'C'] as MerchCategory[]).some((k) => m.approvals[k] === 'requested');
  if (b && !stillWaiting) {
    b.status = 'open';
    b.waitingOn = undefined;
  }
}

export function simulateMerchReceipt(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const m = o.merch;
  const b = blocker(o, 'merchandising');
  const line = m?.shortfall ? o.lines.find((l) => l.id === m.shortfall!.lineId) : undefined;
  if (!m?.shortfall || !line || !b) return;
  const need = line.quantity - (s.stock[line.sku] ?? 0);
  if (need > 0) s.stock[line.sku] = (s.stock[line.sku] ?? 0) + need;
  m.shortfall.available = s.stock[line.sku];
  b.status = 'open';
  b.waitingOn = undefined;
  log(s, orderId, 'warehouse', 'demo', `Control de demo: llega el material pendiente (${productLabel(s, line.sku)}).`);
}

export function resolveMerch(s: DemoState, orderId: string) {
  const o = order(s, orderId);
  const m = o.merch;
  const b = blocker(o, 'merchandising');
  if (!m || !b) return;
  const done = (['A', 'B', 'C'] as MerchCategory[]).every((k) => ['auto', 'approved', 'rejected', 'not_needed'].includes(m.approvals[k]));
  if (!done || (m.shortfall && !m.shortfall.decision)) throw new Error('Faltan decisiones de merchandising');
  const short = m.shortfall;
  const shortLine = short ? o.lines.find((l) => l.id === short.lineId) : undefined;
  if (short?.decision === 'wait' && shortLine && (s.stock[shortLine.sku] ?? 0) < shortLine.quantity) {
    b.status = 'waiting';
    b.waitingOn = 'logistics';
    log(s, orderId, 'cs', 'action', `Aprobaciones completas. El pedido espera a tener ${shortLine.quantity} uds de ${productLabel(s, shortLine.sku)}.`, me(s));
    return;
  }
  m.budget.used += o.lines.reduce((acc, l) => acc + (s.products[l.sku]?.kind === 'merch' ? (s.products[l.sku].unitCost ?? 0) * l.quantity : 0), 0);
  resolve(b, 'cs', 'Material revisado: disponibilidad decidida y aprobaciones registradas (reglas provisionales).');
  log(s, orderId, 'cs', 'decision', 'Resuelve el bloqueo de merchandising.', me(s));
}

// ---------------------------------------------------------------- Envío de almacén y seguimiento

export function createShipment(s: DemoState, p: ShipmentProposal, decisions: Record<string, string>, token: string, url: string) {
  const id = `ENV-26-${String(s.counters.shipment).padStart(6, '0')}`;
  s.counters.shipment += 1;
  const first = s.orders[p.orderIds[0]];
  const exceptions = p.exceptions.map((e) => ({ ...e, chosen: decisions[e.id] }));
  const timeWindow = decisions['ex-window'] === 'request_window';
  s.shipments[id] = {
    id,
    scenarioId: first.scenarioId,
    orderIds: p.orderIds,
    customerId: p.customerId,
    addressId: p.addressId,
    createdAt: nowIso(),
    status: 'prepared',
    lines: p.lines.map((l) => ({ orderId: l.orderId, sku: l.sku, quantity: l.quantity })),
    instructions: [...p.instructions, ...exceptions.map((e) => `${e.title}: ${e.options.find((o) => o.id === e.chosen)?.label ?? '—'}`)],
    exceptions,
    carrier: 'Transportes Ejemplo (simulado)',
    requestedDate: p.requestedDate,
    lastUpdateAt: nowIso(),
    tracking: { token, url, createdAt: nowIso() },
  };
  for (const oid of p.orderIds) {
    const o = s.orders[oid];
    o.stage = 'shipment_prepared';
    o.shipmentId = id;
    if (timeWindow) o.deal.timeWindowService = true;
    log(s, oid, 'cs', 'action', `Envío de almacén ${id} preparado${p.orderIds.length > 1 ? ` (agrupa ${p.orderIds.join(' + ')})` : ''}.`, me(s));
  }
  log(s, id, 'cs', 'action', `Envío creado con ${p.lines.length} líneas. Enlace de seguimiento generado (simulado).`, me(s));
  return id;
}

export function simulateDispatch(s: DemoState, shipmentId: string) {
  const sh = s.shipments[shipmentId];
  if (!sh || sh.status !== 'prepared') return;
  sh.status = 'dispatched';
  sh.dispatchedAt = nowIso();
  sh.lastUpdateAt = nowIso();
  sh.carrierUpdateMissing = false;
  sh.confirmedDelivery = { date: sh.requestedDate, window: undefined, source: 'Fecha planificada por Logística (pendiente de confirmar por el transportista)' };
  for (const oid of sh.orderIds) {
    s.orders[oid].stage = 'dispatched';
    log(s, oid, 'warehouse', 'demo', `Control de demo: picking, registro y salida del envío ${sh.id}.`);
  }
  log(s, shipmentId, 'warehouse', 'demo', 'Control de demo: expedido. Albarán de venta generado (simulado).');
}

export function simulateCarrierSilence(s: DemoState, shipmentId: string) {
  const sh = s.shipments[shipmentId];
  if (!sh || sh.status !== 'dispatched') return;
  sh.carrierUpdateMissing = true;
  sh.lastUpdateAt = new Date(Date.now() - 26 * 3600000).toISOString();
  log(s, shipmentId, 'carrier', 'demo', 'Control de demo: el transportista deja de enviar actualizaciones (última hace 26 h).');
}

export function simulateCarrierUpdate(s: DemoState, shipmentId: string) {
  const sh = s.shipments[shipmentId];
  if (!sh || sh.status !== 'dispatched') return;
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  sh.carrierUpdateMissing = false;
  sh.lastUpdateAt = nowIso();
  sh.confirmedDelivery = { date: today.toISOString(), window: '16:00–19:00', source: 'Confirmado por el transportista' };
  log(s, shipmentId, 'carrier', 'demo', 'Control de demo: el transportista confirma entrega hoy entre 16:00 y 19:00.');
  for (const oid of sh.orderIds) log(s, oid, 'carrier', 'system', 'El transportista confirma entrega hoy, 16:00–19:00 (simulado).');
}

export function simulateDelivered(s: DemoState, shipmentId: string) {
  const sh = s.shipments[shipmentId];
  if (!sh || sh.status !== 'dispatched') return;
  sh.status = 'delivered';
  sh.deliveredAt = nowIso();
  sh.lastUpdateAt = nowIso();
  sh.carrierUpdateMissing = false;
  sh.confirmedDelivery = { date: nowIso(), window: sh.confirmedDelivery?.window, source: 'Entrega confirmada por el transportista' };
  for (const oid of sh.orderIds) {
    s.orders[oid].stage = 'delivered';
    log(s, oid, 'carrier', 'demo', `Control de demo: entrega confirmada (${sh.id}).`);
  }
  log(s, shipmentId, 'carrier', 'demo', 'Control de demo: entrega confirmada por el transportista.');
}

// ---------------------------------------------------------------- Incidencias (sin abonos automáticos)

export interface NewClaimInput {
  shipmentId: string;
  type: ClaimType;
  items: { sku: string; quantity: number }[];
  description: string;
  evidence: { name: string; kind: 'photo' | 'note'; sample: boolean }[];
  contact: string;
}

export function createClaim(s: DemoState, input: NewClaimInput): string {
  const sh = s.shipments[input.shipmentId];
  if (!sh) throw new Error('Envío no encontrado');
  if (!input.items.length) throw new Error('Indica al menos un producto');
  const id = `INC-${String(s.counters.claim).padStart(4, '0')}`;
  s.counters.claim += 1;
  const orderId = input.items.length ? sh.lines.find((l) => l.sku === input.items[0].sku)?.orderId ?? sh.orderIds[0] : sh.orderIds[0];
  const nextAction =
    input.type === 'missing'
      ? 'Comprobar con el almacén si el envío salió completo antes de proponer nada al cliente.'
      : input.type === 'damaged'
        ? 'Revisar las fotos y pedir al almacén que confirme cómo salió el embalaje.'
        : 'Revisar el caso y contactar con el cliente.';
  s.claims[id] = {
    id,
    scenarioId: sh.scenarioId,
    createdAt: nowIso(),
    customerId: sh.customerId,
    orderId,
    shipmentId: sh.id,
    channel: 'tracking_page',
    type: input.type,
    items: input.items,
    description: input.description,
    evidence: input.evidence,
    contact: input.contact,
    owner: 'Ana Ruiz',
    status: 'new',
    nextAction,
    proposals: [],
  };
  log(s, id, 'customer', 'message', `Problema reportado desde la página de seguimiento: ${CLAIM_TYPE_LABEL[input.type]}. ${input.evidence.length} evidencia(s).`, input.contact || 'Cliente');
  log(s, id, 'system', 'system', 'Incidencia creada y asignada a Ana Ruiz por cartera de cliente. No se emite abono ni reposición automáticamente.');
  log(s, orderId, 'customer', 'message', `Incidencia ${id} abierta por el cliente.`);
  return id;
}

export function requestWarehouseCheck(s: DemoState, claimId: string) {
  const c = s.claims[claimId];
  c.status = 'investigating';
  c.warehouseCheck = { requestedAt: nowIso() };
  c.nextAction = 'Esperar la comprobación del almacén.';
  log(s, claimId, 'cs', 'action', 'Pide al almacén que compruebe la preparación y el embalaje.', me(s));
}

export function simulateWarehouseResult(s: DemoState, claimId: string) {
  const c = s.claims[claimId];
  if (!c.warehouseCheck) return;
  c.warehouseCheck.result =
    c.type === 'missing'
      ? 'El registro de picking muestra todas las unidades preparadas. Posible pérdida en tránsito: revisar con el transportista.'
      : 'El envío salió con embalaje estándar sin incidencias registradas. Daño probable en transporte.';
  c.nextAction = 'Proponer una solución (abono o reposición) para aprobación.';
  log(s, claimId, 'warehouse', 'demo', `Control de demo — respuesta del almacén: ${c.warehouseCheck.result}`);
}

export function proposeClaimResolution(s: DemoState, claimId: string, kind: 'credit_note' | 'replacement') {
  const c = s.claims[claimId];
  const approver: Role = kind === 'credit_note' ? 'finance' : 'logistics';
  c.proposals.push({ id: `PR-${c.proposals.length + 1}`, kind, status: 'requested', approver, requestedAt: nowIso() });
  c.status = 'proposal_pending';
  c.nextAction = `Esperar la decisión de ${ROLE_LABEL[approver]}.`;
  log(s, claimId, 'cs', 'action', `Propone ${kind === 'credit_note' ? 'un abono' : 'una reposición'} y lo envía a ${ROLE_LABEL[approver]} para aprobación. No se ejecuta nada automáticamente.`, me(s));
}

export function decideClaimProposal(s: DemoState, claimId: string, proposalId: string, approve: boolean) {
  const c = s.claims[claimId];
  const p = c.proposals.find((x) => x.id === proposalId);
  if (!p || p.status !== 'requested') return;
  p.status = approve ? 'approved' : 'rejected';
  c.nextAction = approve ? 'Comunicar la solución al cliente y cerrar la incidencia.' : 'Buscar otra solución o explicar la decisión al cliente.';
  c.status = 'investigating';
  log(s, claimId, p.approver, 'decision', `${approve ? 'Aprueba' : 'Rechaza'} la propuesta de ${p.kind === 'credit_note' ? 'abono' : 'reposición'} (simulado).`, `${ROLE_LABEL[p.approver]} (simulado)`);
}

export function closeClaim(s: DemoState, claimId: string) {
  const c = s.claims[claimId];
  c.status = 'resolved';
  c.nextAction = 'Sin acciones pendientes.';
  log(s, claimId, 'cs', 'decision', 'Cierra la incidencia.', me(s));
}

// ---------------------------------------------------------------- Consultas de entrega

export function requestCarrierUpdate(s: DemoState, enquiryId: string) {
  const e = s.enquiries[enquiryId];
  e.carrierRequestedAt = nowIso();
  log(s, enquiryId, 'cs', 'action', 'Pide actualización al transportista (simulado).', me(s));
}

export function updateReply(s: DemoState, enquiryId: string, text: string) {
  s.enquiries[enquiryId].replyDraft = text;
}

export function markEnquiryAnswered(s: DemoState, enquiryId: string) {
  const e = s.enquiries[enquiryId];
  e.status = 'answered';
  log(s, enquiryId, 'cs', 'action', 'Marca la consulta como respondida. (El prototipo no envía mensajes.)', me(s));
}

// ---------------------------------------------------------------- Alta de clientes

export function generateInvite(s: DemoState, caseId: string, token: string, url: string, expiresAt: string) {
  const c = s.onboarding[caseId];
  c.invite = { token, url, createdAt: nowIso(), expiresAt };
  if (c.status === 'draft') c.status = 'waiting_customer';
  log(s, caseId, 'cs', 'action', 'Genera el enlace de alta (simulado). No se envía nada al cliente.', me(s));
}

export function submitCustomerForm(s: DemoState, caseId: string, data: Partial<OnboardingCustomerData>, duplicates: DuplicateCandidate[]) {
  const c = s.onboarding[caseId];
  c.customerData = { ...data };
  c.customerSubmittedAt = nowIso();
  c.status = 'in_review';
  c.duplicateCheck = { checkedAt: nowIso(), candidates: duplicates };
  log(s, caseId, 'customer', 'message', 'El cliente completa y envía el formulario de alta (vista previa).', data.contactName || 'Cliente');
  if (duplicates.length) log(s, caseId, 'system', 'system', `Posible duplicado detectado: ${duplicates.map((d) => `${d.name} (${d.customerId})`).join(', ')}.`);
}

export function decideDuplicate(s: DemoState, caseId: string, decision: 'different' | 'same', note: string) {
  const c = s.onboarding[caseId];
  if (!c.duplicateCheck) return;
  c.duplicateCheck.decision = decision;
  c.duplicateCheck.decisionNote = note;
  log(s, caseId, 'cs', 'decision', decision === 'different' ? `No es duplicado: ${note}` : `Es el mismo cliente: ${note}`, me(s));
  if (decision === 'same') {
    c.status = 'merged';
    const o = c.linkedOrderId ? s.orders[c.linkedOrderId] : undefined;
    const cand = c.duplicateCheck.candidates[0];
    if (o) {
      const b = blocker(o, 'new_customer');
      if (b) {
        b.reason = `Se gestionará como reactivación de la cuenta ${cand?.customerId}. Requiere decisión de Finanzas (fuera del alcance del prototipo).`;
        b.status = 'waiting';
        b.waitingOn = 'finance';
      }
      log(s, o.id, 'cs', 'decision', `El alta se convierte en reactivación de ${cand?.customerId}.`, me(s));
    }
  }
}

export function updateSalesData(s: DemoState, caseId: string, key: string, value: string) {
  (s.onboarding[caseId].salesData as Record<string, string>)[key] = value;
}

export function updateInternal(s: DemoState, caseId: string, key: keyof OnboardingInternalData, value: string) {
  s.onboarding[caseId].internal[key] = value;
}

export function requestOnboardingFinance(s: DemoState, caseId: string) {
  const c = s.onboarding[caseId];
  c.finance = { ...c.finance, status: 'requested', requestedAt: nowIso() };
  log(s, caseId, 'cs', 'action', `Solicita a Finanzas la decisión de crédito (propuesta del comercial: ${c.salesData.proposedCreditLimit ?? '—'}, ${c.salesData.proposedPaymentTerms ?? '—'}).`, me(s));
}

export function onboardingFinanceDecision(s: DemoState, caseId: string, decision: 'approved' | 'approved_changes' | 'rejected') {
  const c = s.onboarding[caseId];
  if (c.finance.status !== 'requested') throw new Error('Finanzas solo decide sobre una solicitud enviada');
  const map = {
    approved: { creditLimit: c.salesData.proposedCreditLimit ?? '—', paymentTerms: c.salesData.proposedPaymentTerms ?? '—', note: 'Aprobado según la propuesta del comercial.' },
    approved_changes: { creditLimit: '3.000 €', paymentTerms: '30 días, domiciliación', note: 'Aprobado con límite inicial reducido durante 6 meses.' },
    rejected: { creditLimit: '0 €', paymentTerms: 'Pago anticipado', note: 'Sin crédito: solo pago anticipado.' },
  }[decision];
  c.finance = { ...c.finance, status: decision, ...map, decidedAt: nowIso() };
  log(s, caseId, 'finance', 'decision', `Finanzas: ${map.note} Límite ${map.creditLimit}, ${map.paymentTerms}.`, 'Finanzas (simulado)');
}

function parseAddress(text: string) {
  const [street, rest = ''] = text.split(',').map((x) => x.trim());
  const m = rest.match(/(\d{5})\s*(.*)/);
  const postalCode = m?.[1] ?? '';
  const city = m?.[2] || rest || '—';
  const zone = postalCode.startsWith('080') ? 'BCN' : postalCode.startsWith('08') || postalCode.startsWith('17') || postalCode.startsWith('25') || postalCode.startsWith('43') ? 'CAT' : postalCode.startsWith('28') ? 'MAD' : postalCode.startsWith('46') ? 'VAL' : postalCode.startsWith('07') ? 'BAL' : '';
  return { id: 'A1', label: 'Local', street: street || text, postalCode, city, zone };
}

export function createAccount(s: DemoState, caseId: string, customerId: string) {
  const c = s.onboarding[caseId];
  if (!c || !canCreateAccount(c)) throw new Error('No se puede crear la cuenta: faltan datos o decisiones.');
  const d = c.customerData;
  s.customers[customerId] = {
    id: customerId,
    scenarioId: c.scenarioId,
    name: d.tradeName || d.legalName || c.prospectName,
    legalName: d.legalName ?? c.prospectName,
    taxId: (d.taxId ?? '').toUpperCase(),
    company: c.company,
    segment: c.salesData.segment ?? '—',
    salesRep: c.salesData.accountOwner ?? '—',
    contactName: d.contactName,
    addresses: [parseAddress(d.deliveryAddress ?? '')],
    standardInstructions: d.deliveryHours ? [{ text: `Horario de recepción: ${d.deliveryHours}.`, since: 'alta', seenIn: 'nuevo cliente' }] : [],
    agreement: { name: c.salesData.priceList ?? 'Tarifa general', validUntil: '31/12/2026', defaultDiscountPct: 0, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
    credit: {
      limit: Number((c.finance.creditLimit ?? '0').replace(/[^\d]/g, '')) || 0,
      balanceNotDue: 0,
      overdue: 0,
      oldestOverdueDays: 0,
      insurerCoverage: 0,
      lastPayment: { date: '', amount: 0 },
      averageDaysToPay: 0,
    },
    status: 'active',
  };
  c.createdCustomerId = customerId;
  c.status = 'created';
  log(s, caseId, 'erp', 'system', `Cuenta de cliente ${customerId} creada en el ERP (simulado) con dimensiones ${Object.values(c.internal).join(' · ')}.`);
  const o = c.linkedOrderId ? s.orders[c.linkedOrderId] : undefined;
  if (o) {
    o.customerId = customerId;
    o.deliveryAddressId = 'A1';
    const f = o.fields.find((x) => x.key === 'customer');
    if (f) {
      f.value = `${s.customers[customerId].name} (${customerId})`;
      f.confidence = 'alta';
      f.confirmed = true;
      f.note = `Cuenta creada desde el alta ${caseId}.`;
    }
    const b = blocker(o, 'new_customer');
    if (b) resolve(b, 'cs', `Cuenta ${customerId} creada (alta ${caseId}).`);
    log(s, o.id, 'system', 'system', `Cliente vinculado: ${customerId}. El borrador ya puede aprobarse y enviarse al ERP.`);
  }
}
