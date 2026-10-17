// Propuesta de envío de almacén (paso 3 del proceso: en PM lo crea Atención al Cliente; en JC, Logística).

import { productLabel } from './orders';
import type { DemoState, Order, ShipmentException } from './types';

export interface ShipmentProposal {
  orderIds: string[];
  customerId: string;
  addressId: string;
  addressLabel: string;
  requestedDate: string;
  groupingReason: string;
  lines: { orderId: string; sku: string; label: string; quantity: number; available: number; ok: boolean; backorderQty?: number }[];
  instructions: string[];
  exceptions: ShipmentException[];
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export function proposeShipment(state: DemoState, orderId: string): ShipmentProposal {
  const o = state.orders[orderId];
  const customer = o.customerId ? state.customers[o.customerId] : undefined;
  const address = customer?.addresses.find((a) => a.id === o.deliveryAddressId) ?? customer?.addresses[0];
  const overrideAddress = o.structuredDelivery?.address;

  // Agrupación propuesta: pedidos liberados del mismo cliente, misma dirección y misma fecha, sin envío.
  const group: Order[] = [o];
  if (!overrideAddress) {
    for (const other of Object.values(state.orders)) {
      if (other.id === o.id || other.stage !== 'released' || other.shipmentId) continue;
      if (other.company !== o.company || other.customerId !== o.customerId) continue;
      if ((other.deliveryAddressId ?? 'A1') !== (o.deliveryAddressId ?? 'A1') || other.structuredDelivery?.address) continue;
      if (!sameDay(other.requestedDeliveryDate, o.requestedDeliveryDate)) continue;
      group.push(other);
    }
  }

  const lines: ShipmentProposal['lines'] = [];
  const shipQty = (g: Order, l: Order['lines'][number]) => l.quantity + (g.deal.approval.status === 'approved' ? l.freeUnits : l.agreementFreeUnits);
  const needBySku: Record<string, number> = {};
  for (const g of group) {
    for (const l of g.lines) needBySku[l.sku] = (needBySku[l.sku] ?? 0) + shipQty(g, l);
  }
  for (const g of group) {
    for (const l of g.lines) {
      const qty = shipQty(g, l);
      const available = state.stock[l.sku] ?? 0;
      lines.push({ orderId: g.id, sku: l.sku, label: productLabel(state, l.sku), quantity: qty, available, ok: available >= needBySku[l.sku], backorderQty: l.backorderQty });
    }
  }

  const instructions: string[] = [];
  for (const si of customer?.standardInstructions ?? []) instructions.push(`Habitual (ficha): ${si.text}`);
  const sd = o.structuredDelivery;
  if (sd?.address) instructions.push(`Solo este pedido — dirección: ${sd.address}`);
  if (sd?.window) instructions.push(`Solo este pedido — franja: ${sd.window}${o.deal.timeWindowService ? ' (servicio con franja garantizada solicitado)' : ' (sin franja garantizada)'}`);
  if (sd?.contact) instructions.push(`Solo este pedido — contacto en destino: ${sd.contact}`);
  if (sd?.carrierNote) instructions.push(sd.carrierNote);

  const exceptions: ShipmentException[] = [];
  const timeInstruction = (customer?.standardInstructions ?? []).find((i) => /antes de las|horario de recepción/i.test(i.text));
  if (timeInstruction && !o.deal.timeWindowService) {
    exceptions.push({
      id: 'ex-window',
      title: 'Franja horaria sin garantía',
      detail: `La ficha indica «${timeInstruction.text}». El transporte estándar no garantiza la hora de entrega.`,
      options: [
        { id: 'request_window', label: 'Solicitar franja garantizada al transportista (recargo sintético 25 €)' },
        { id: 'standard_inform', label: 'Enviar con transporte estándar y trasladar la instrucción al transportista' },
      ],
    });
  }
  if ((customer?.standardInstructions ?? []).some((i) => /cita previa/i.test(i.text))) {
    exceptions.push({
      id: 'ex-appointment',
      title: 'Cita previa en muelle',
      detail: 'El cliente exige cita previa. Hay que pedirla antes de que salga el camión.',
      options: [
        { id: 'appointment_requested', label: 'Cita solicitada al cliente (simulado)' },
        { id: 'logistics_handles', label: 'Lo gestiona Logística al planificar la ruta' },
      ],
    });
  }
  for (const l of lines) {
    if (l.backorderQty) {
      exceptions.push({
        id: `ex-backorder-${l.orderId}-${l.sku}`,
        title: 'Entrega parcial acordada',
        detail: `${l.label}: salen ${l.quantity} uds; quedan ${l.backorderQty} pendientes para una entrega posterior.`,
        options: [{ id: 'confirm_partial', label: 'Confirmar envío parcial (aceptado por el cliente)' }],
      });
    }
    if (!l.ok) {
      exceptions.push({
        id: `ex-short-${l.orderId}-${l.sku}`,
        title: 'Cantidad disponible insuficiente',
        detail: `${l.label}: se necesitan ${needBySku[l.sku]} y hay ${l.available}.`,
        options: [{ id: 'hold_line', label: 'Retener la línea y avisar a Atención al Cliente' }],
      });
    }
  }

  const addressLabel = overrideAddress ?? (address ? `${address.label} — ${address.street}, ${address.city}` : o.deliveryAddressText ?? '—');
  const groupingReason =
    group.length > 1
      ? `Se agrupan ${group.length} pedidos liberados del mismo cliente, con la misma dirección y fecha de entrega.`
      : overrideAddress
        ? 'Envío individual: el pedido tiene una dirección puntual distinta.'
        : 'Envío individual: no hay otros pedidos liberados del cliente para la misma dirección y fecha.';

  return {
    orderIds: group.map((g) => g.id),
    customerId: o.customerId ?? '',
    addressId: o.deliveryAddressId ?? 'A1',
    addressLabel,
    requestedDate: o.requestedDeliveryDate,
    groupingReason,
    lines,
    instructions,
    exceptions,
  };
}

export function shipmentBlockingExceptions(p: ShipmentProposal, decisions: Record<string, string>): ShipmentException[] {
  return p.exceptions.filter((e) => !decisions[e.id]);
}
