import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { resetScenario } from '../state/reset';
import { canCreateAccount, findDuplicateCandidates, isValidSpanishTaxIdFormat, SAMPLE_CUSTOMER_DATA } from './onboarding';
import * as ops from './ops';
import { creditExposure, orderNextAction } from './orders';
import { buildQueue } from './queue';
import { proposeShipment } from './shipment';

const now = new Date('2026-10-19T09:30:00');

describe('Bloqueo de crédito y excepción comercial', () => {
  it('una aprobación comercial NUNCA libera el bloqueo de crédito', () => {
    const s = createSeed(now);
    const id = 'PV-26-018655';
    ops.requestCommercialApproval(s, id, 'commercial_mgmt', 'Cliente estratégico');
    ops.commercialDecision(s, id, true);
    const o = s.orders[id];
    expect(o.blockers.find((b) => b.type === 'commercial')?.status).toBe('resolved');
    expect(o.blockers.find((b) => b.type === 'credit')?.status).toBe('open');
    expect(() => ops.applyRelease(s, id, true, '')).toThrow();
    expect(o.stage).toBe('erp_confirmed');
  });

  it('Finanzas solo decide sobre una solicitud enviada, y su aprobación sí resuelve el crédito', () => {
    const s = createSeed(now);
    const id = 'PV-26-018655';
    expect(() => ops.financeDecision(s, id, 'approved', 'ok')).toThrow();
    ops.requestCreditReview(s, id, 'Pedido habitual');
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.waitingOn).toBe('finance');
    ops.financeDecision(s, id, 'approved', 'Cobro comprometido');
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.status).toBe('resolved');
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.resolvedBy).toBe('finance');
    // Sigue abierto el comercial: no se puede liberar todavía.
    expect(() => ops.applyRelease(s, id, true, '')).toThrow();
  });

  it('un rechazo de Finanzas mantiene el pedido retenido', () => {
    const s = createSeed(now);
    const id = 'PV-26-018655';
    ops.requestCreditReview(s, id, 'x');
    ops.financeDecision(s, id, 'rejected', 'Vencidos sin plan de pago');
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.status).toBe('open');
    expect(orderNextAction(s, s.orders[id]).label).toMatch(/comercial|Informar/);
  });

  it('calcula la exposición de crédito con el pedido (IVA incluido)', () => {
    const s = createSeed(now);
    const e = creditExposure(s, s.orders['PV-26-018655'])!;
    expect(e.outstanding).toBe(23480);
    expect(e.orderTotal).toBe(2777.53);
    expect(e.excess).toBeCloseTo(1257.53, 2);
  });
});

describe('Bloqueo por observaciones', () => {
  const id = 'PV-26-018690';
  it('no se resuelve sin clasificar cada parte de la nota', () => {
    const s = createSeed(now);
    expect(ops.observationReadiness(s.orders[id]).ready).toBe(false);
    expect(() => ops.resolveObservations(s, id)).toThrow();
  });

  it('«Otra» mantiene el bloqueo: no se descartan instrucciones en silencio', () => {
    const s = createSeed(now);
    ops.classifySegment(s, id, 'seg-1', 'standard_repeat');
    ops.classifySegment(s, id, 'seg-2', 'other');
    expect(ops.observationReadiness(s.orders[id]).ready).toBe(false);
  });

  it('cambio puntual + conflictos revisados → bloqueo resuelto con campos estructurados y nota original intacta', () => {
    const s = createSeed(now);
    ops.classifySegment(s, id, 'seg-1', 'standard_repeat');
    ops.classifySegment(s, id, 'seg-2', 'one_off_delivery');
    expect(ops.observationReadiness(s.orders[id]).ready).toBe(false); // faltan conflictos
    ops.chooseConflict(s, id, 'cf-address', 'use_event');
    ops.chooseConflict(s, id, 'cf-window', 'friday_window');
    ops.resolveObservations(s, id);
    const o = s.orders[id];
    expect(o.blockers[0].status).toBe('resolved');
    expect(o.structuredDelivery?.address).toContain('Passeig de la Ribera 45');
    expect(o.deal.timeWindowService).toBe(true);
    expect(o.observation?.originalNote).toContain('IMPORTANTE');
    expect(s.customers['C-10871'].addresses).toHaveLength(1); // la ficha no cambia
  });

  it('si se decide consultar al cliente, el bloqueo queda esperando al cliente', () => {
    const s = createSeed(now);
    ops.classifySegment(s, id, 'seg-1', 'standard_repeat');
    ops.classifySegment(s, id, 'seg-2', 'one_off_delivery');
    ops.chooseConflict(s, id, 'cf-address', 'ask_customer');
    ops.chooseConflict(s, id, 'cf-window', 'friday_no_window');
    ops.resolveObservations(s, id);
    expect(s.orders[id].blockers[0].status).toBe('waiting');
    expect(s.orders[id].blockers[0].waitingOn).toBe('customer');
  });
});

describe('Producto sin stock', () => {
  const id = 'PV-26-018671';
  it('exige aceptación explícita antes de sustituir y repite la comprobación de stock', () => {
    const s = createSeed(now);
    ops.selectStockOption(s, id, 'opt-vintage');
    expect(() => ops.applyStockOption(s, id)).toThrow(/aceptación/);
    ops.prepareStockProposal(s, id, 'Propuesta');
    expect(() => ops.recordStockAcceptance(s, id, '', 'teléfono')).toThrow();
    ops.recordStockAcceptance(s, id, 'Lucía (encargada)', 'teléfono');
    expect(s.stock['P-2003']).toBe(16); // 4 reservadas para otro pedido mientras tanto
    ops.applyStockOption(s, id);
    const l = s.orders[id].lines[0];
    expect(l.sku).toBe('P-2003');
    expect(l.substitution?.fromSku).toBe('P-2002');
    expect(l.substitution?.acceptedBy).toBe('Lucía (encargada)');
    ops.applySecondCheck(s, id, [{ sku: 'P-2003', requested: 12, available: 16, ok: true }]);
    expect(s.orders[id].blockers[0].status).toBe('resolved');
  });
});

describe('Merchandising', () => {
  it('no se resuelve hasta tener decisiones y aprobaciones', () => {
    const s = createSeed(now);
    const id = 'PV-26-018662';
    expect(() => ops.resolveMerch(s, id)).toThrow();
    ops.decideShortfall(s, id, 'split');
    ops.requestMerchApprovals(s, id);
    expect(() => ops.resolveMerch(s, id)).toThrow();
    ops.merchDecision(s, id, 'B', true);
    ops.merchDecision(s, id, 'C', true);
    ops.resolveMerch(s, id);
    expect(s.orders[id].blockers[0].status).toBe('resolved');
    expect(s.orders[id].lines.find((l) => l.sku === 'M-02')?.backorderQty).toBe(1);
  });
});

describe('Alta de clientes', () => {
  it('detecta la cuenta inactiva parecida como posible duplicado', () => {
    const s = createSeed(now);
    const d = findDuplicateCandidates(Object.values(s.customers), SAMPLE_CUSTOMER_DATA);
    expect(d[0].customerId).toBe('C-10482');
    expect(d[0].reasons.join(' ')).toMatch(/Misma dirección/);
    expect(d[0].reasons.join(' ')).toMatch(/NIF \/ CIF distinto/);
  });

  it('valida solo el formato del NIF/CIF', () => {
    expect(isValidSpanishTaxIdFormat('B99420427')).toBe(true);
    expect(isValidSpanishTaxIdFormat('12345678Z')).toBe(true);
    expect(isValidSpanishTaxIdFormat('B-123')).toBe(false);
  });

  it('la cuenta solo se crea con datos completos, duplicado decidido y decisión de Finanzas', () => {
    const s = createSeed(now);
    const id = 'ALTA-0042';
    expect(canCreateAccount(s.onboarding[id])).toBe(false);
    ops.generateInvite(s, id, 'T', 'https://altas.ejemplo.invalid/f/T', now.toISOString());
    ops.submitCustomerForm(s, id, SAMPLE_CUSTOMER_DATA, findDuplicateCandidates(Object.values(s.customers), SAMPLE_CUSTOMER_DATA));
    ops.updateInternal(s, id, 'customerPostingGroup', 'NAC-HORECA');
    ops.updateInternal(s, id, 'vatPostingGroup', 'NACIONAL');
    ops.updateInternal(s, id, 'channelDimension', 'HORECA');
    ops.updateInternal(s, id, 'zoneDimension', 'BCN-CIUTAT');
    expect(canCreateAccount(s.onboarding[id])).toBe(false); // duplicado sin decidir, Finanzas sin decidir
    ops.decideDuplicate(s, id, 'different', 'CIF distinto; la cuenta antigua cesó actividad');
    ops.requestOnboardingFinance(s, id);
    ops.onboardingFinanceDecision(s, id, 'approved');
    expect(canCreateAccount(s.onboarding[id])).toBe(true);
    ops.createAccount(s, id, 'C-20931');
    expect(s.orders['REQ-1047'].customerId).toBe('C-20931');
    expect(s.orders['REQ-1047'].blockers[0].status).toBe('resolved');
    expect(s.customers['C-20931'].addresses[0].zone).toBe('BCN');
  });
});

describe('Envío de almacén', () => {
  it('agrupa pedidos liberados del mismo cliente, dirección y fecha, y marca la franja como excepción', () => {
    const s = createSeed(now);
    s.orders['REQ-1042'].stage = 'released';
    const p = proposeShipment(s, 'REQ-1042');
    expect(p.orderIds.sort()).toEqual(['PV-26-018702', 'REQ-1042']);
    expect(p.exceptions.map((e) => e.id)).toContain('ex-window');
    expect(p.lines.every((l) => l.ok)).toBe(true);
  });
});

describe('Bandeja y reinicio', () => {
  it('la bandeja muestra varios bloqueos en el mismo pedido', () => {
    const s = createSeed(now);
    const q = buildQueue(s, now);
    expect(q.find((x) => x.id === 'PV-26-018655')?.blockers).toHaveLength(2);
    expect(q.length).toBeGreaterThanOrEqual(12);
  });

  it('reiniciar un escenario restaura solo sus datos', () => {
    const s = createSeed(now);
    ops.confirmField(s, 'REQ-1042', 'deliveryDate'); // escenario 1
    ops.classifySegment(s, 'PV-26-018690', 'seg-1', 'standard_repeat'); // escenario 2
    const r = resetScenario(s, 's2', createSeed(now));
    expect(r.orders['PV-26-018690'].observation?.segments[0].classification).toBeUndefined();
    expect(r.orders['REQ-1042'].fields.find((f) => f.key === 'deliveryDate')?.confirmed).toBe(true);
  });

  it('reiniciar el escenario 4 restaura las existencias que modifica', () => {
    const s = createSeed(now);
    ops.selectStockOption(s, 'PV-26-018671', 'opt-vintage');
    ops.prepareStockProposal(s, 'PV-26-018671', 'x');
    ops.recordStockAcceptance(s, 'PV-26-018671', 'Lucía', 'email');
    expect(s.stock['P-2003']).toBe(16);
    const r = resetScenario(s, 's4', createSeed(now));
    expect(r.stock['P-2003']).toBe(20);
  });
});
