// Bandeja de trabajo: une solicitudes, pedidos retenidos, altas, incidencias y consultas.

import { BLOCKER_LABEL, ROLE_LABEL, STAGE_LABEL, waitingOnText } from './labels';
import { blockerOwner, customerName, openBlockers, orderNextAction } from './orders';
import { outstandingDecisions } from './onboarding';
import { daysUntil, hoursSince } from './format';
import type { Channel, DemoState, ScenarioId } from './types';

export type QueueKind = 'draft' | 'blocked' | 'order' | 'onboarding' | 'claim' | 'enquiry';
export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'alert';

export interface QueueBlocker {
  label: string;
  tone: Tone;
  who: string;
  status: string;
}

export interface QueueItem {
  id: string;
  kind: QueueKind;
  route: string;
  customer: string;
  channel: Channel;
  requestType: string;
  receivedAt: string;
  owner?: string;
  status: string;
  statusTone: Tone;
  blockers: QueueBlocker[];
  needs: 'you' | 'others' | 'none';
  nextAction: string;
  priority: { score: number; level: 'Alta' | 'Media' | 'Normal'; reason: string };
  scenarioId?: ScenarioId;
  search: string;
  company: 'PM' | 'JC';
}

function priorityFor(receivedAt: string, deliveryIso: string | undefined, extra: { score: number; reason: string }[], now: Date) {
  const factors: { score: number; reason: string }[] = [...extra];
  if (deliveryIso) {
    const d = daysUntil(deliveryIso, now);
    if (d <= 0) factors.push({ score: 55, reason: 'Entrega solicitada para hoy o ya pasada' });
    else if (d === 1) factors.push({ score: 50, reason: 'Entrega solicitada mañana' });
    else if (d === 2) factors.push({ score: 30, reason: 'Entrega solicitada en 2 días' });
  }
  const age = hoursSince(receivedAt, now);
  if (age > 24) factors.push({ score: 25, reason: 'Más de 24 h sin resolver' });
  else if (age > 4) factors.push({ score: 10, reason: 'Más de 4 h en la bandeja' });
  factors.sort((a, b) => b.score - a.score);
  const score = factors.reduce((acc, f) => acc + f.score, 0);
  const level: 'Alta' | 'Media' | 'Normal' = score >= 50 ? 'Alta' : score >= 25 ? 'Media' : 'Normal';
  return { score, level, reason: factors[0]?.reason ?? 'Sin urgencia especial' };
}

export function buildQueue(s: DemoState, now = new Date()): QueueItem[] {
  const items: QueueItem[] = [];

  for (const o of Object.values(s.orders)) {
    if (o.stage === 'delivered' || o.stage === 'dispatched') continue;
    const na = orderNextAction(s, o);
    const open = openBlockers(o);
    const blockers: QueueBlocker[] = open.map((b) => ({
      label: BLOCKER_LABEL[b.type],
      tone: b.status === 'waiting' ? 'neutral' : 'warn',
      who: ROLE_LABEL[blockerOwner(b)],
      status: b.status === 'waiting' ? waitingOnText(blockerOwner(b)) : 'Pendiente',
    }));
    const kind: QueueKind = o.stage === 'draft' ? 'draft' : open.length ? 'blocked' : 'order';
    const requestType =
      o.stage === 'draft' ? 'Pedido nuevo · borrador' : open.length ? 'Pedido retenido en ERP' : o.stage === 'released' ? 'Preparar envío de almacén' : 'Pedido en curso';
    const status = o.stage === 'erp_confirmed' && open.length ? 'Retenido en ERP' : STAGE_LABEL[o.stage];
    const statusTone: Tone = o.stage === 'draft' ? 'info' : open.length ? 'warn' : 'ok';
    const extra: { score: number; reason: string }[] = [];
    if (open.some((b) => b.type === 'credit')) extra.push({ score: 10, reason: 'Bloqueo de crédito' });
    if (open.length > 1) extra.push({ score: 10, reason: `${open.length} bloqueos en el mismo pedido` });
    const name = customerName(s, o);
    items.push({
      id: o.id,
      kind,
      route: `/pedido/${o.id}`,
      customer: name,
      channel: o.channel,
      requestType,
      receivedAt: o.receivedAt,
      owner: o.owner,
      status,
      statusTone,
      blockers,
      needs: na.needs,
      nextAction: na.label,
      priority: priorityFor(o.receivedAt, o.requestedDeliveryDate, extra, now),
      scenarioId: o.scenarioId,
      search: [o.id, o.erpNumber, name, ...o.lines.map((l) => s.products[l.sku]?.name ?? '')].join(' ').toLowerCase(),
      company: o.company,
    });
  }

  for (const c of Object.values(s.onboarding)) {
    if (c.status === 'created' || c.status === 'merged') continue;
    const pending = outstandingDecisions(c);
    const waitingCustomer = c.status === 'waiting_customer';
    const mine = pending.find((p) => p.owner.startsWith('Atención'));
    const readyToCreate = pending.length === 0 && c.status === 'in_review';
    const needsYou = (!waitingCustomer && !!mine) || readyToCreate;
    items.push({
      id: c.id,
      kind: 'onboarding',
      route: `/alta/${c.id}`,
      customer: c.prospectName,
      channel: 'sales_request',
      requestType: 'Alta de cliente',
      receivedAt: c.createdAt,
      owner: c.owner,
      status: waitingCustomer ? 'Esperando al cliente' : c.status === 'in_review' ? 'En revisión' : 'Pendiente de enviar enlace',
      statusTone: waitingCustomer ? 'neutral' : 'info',
      blockers: pending.length
        ? [{ label: `${pending.length} ${pending.length === 1 ? 'dato o decisión pendiente' : 'datos o decisiones pendientes'}`, tone: 'neutral', who: (needsYou ? mine! : pending[0]).owner, status: '' }]
        : [],
      needs: needsYou ? 'you' : 'others',
      nextAction: readyToCreate ? 'Crear la cuenta en el ERP' : needsYou ? mine!.short : waitingCustomer ? 'Esperando el formulario del cliente' : `Esperando a ${pending[0]?.owner ?? '—'}`,
      priority: priorityFor(c.createdAt, undefined, c.linkedOrderId ? [{ score: 25, reason: 'Hay un pedido esperando esta alta' }] : [], now),
      scenarioId: c.scenarioId,
      search: [c.id, c.prospectName].join(' ').toLowerCase(),
      company: c.company,
    });
  }

  for (const c of Object.values(s.claims)) {
    if (c.status === 'resolved') continue;
    const name = s.customers[c.customerId]?.name ?? '—';
    const waiting = c.status === 'proposal_pending' || (c.warehouseCheck && !c.warehouseCheck.result);
    items.push({
      id: c.id,
      kind: 'claim',
      route: `/incidencia/${c.id}`,
      customer: name,
      channel: c.channel,
      requestType: 'Incidencia de entrega',
      receivedAt: c.createdAt,
      owner: c.owner,
      status: c.status === 'new' ? 'Nueva' : c.status === 'proposal_pending' ? 'Propuesta en aprobación' : 'En investigación',
      statusTone: c.status === 'new' ? 'warn' : 'neutral',
      blockers: [],
      needs: waiting ? 'others' : 'you',
      nextAction: c.nextAction,
      priority: priorityFor(c.createdAt, undefined, [{ score: 30, reason: 'Incidencia abierta por un cliente' }], now),
      scenarioId: c.scenarioId,
      search: [c.id, name, c.description].join(' ').toLowerCase(),
      company: 'PM',
    });
  }

  for (const e of Object.values(s.enquiries)) {
    if (e.status === 'answered') continue;
    const name = s.customers[e.customerId]?.name ?? '—';
    items.push({
      id: e.id,
      kind: 'enquiry',
      route: `/consulta/${e.id}`,
      customer: name,
      channel: e.channel,
      requestType: 'Consulta de entrega',
      receivedAt: e.receivedAt,
      owner: e.owner,
      status: 'Cliente esperando respuesta',
      statusTone: 'warn',
      blockers: [],
      needs: 'you',
      nextAction: 'Responder con el estado real del envío',
      priority: priorityFor(e.receivedAt, s.shipments[e.shipmentId]?.requestedDate, [{ score: 20, reason: 'Cliente esperando respuesta' }], now),
      search: [e.id, name, e.orderId].join(' ').toLowerCase(),
      company: 'PM',
    });
  }

  return items.sort((a, b) => b.priority.score - a.priority.score || a.receivedAt.localeCompare(b.receivedAt));
}
