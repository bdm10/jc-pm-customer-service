import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { resetScenario } from '../state/reset';
import { canCreateAccount, findDuplicateCandidates, isValidSpanishTaxIdFormat, SAMPLE_CUSTOMER_DATA } from './onboarding';
import * as ops from './ops';
import { creditExposure, orderNextAction } from './orders';
import { buildQueue } from './queue';
import { confirmedDelivery, proposeShipment } from './shipment';

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

  it('«Otra» mantiene el bloqueo: obliga a consultar y nunca libera', () => {
    const s = createSeed(now);
    ops.classifySegment(s, id, 'seg-1', 'standard_repeat');
    ops.classifySegment(s, id, 'seg-2', 'other');
    expect(ops.observationReadiness(s.orders[id]).consultWith).toBe('customer');
    ops.resolveObservations(s, id);
    expect(s.orders[id].blockers[0].status).toBe('waiting');
    expect(s.orders[id].blockers[0].waitingOn).toBe('customer');
    // La respuesta no clasifica por la persona: vuelve a pedir la clasificación.
    ops.simulateConsultAnswer(s, id);
    expect(s.orders[id].blockers[0].status).toBe('open');
    expect(s.orders[id].observation?.segments[1].classification).toBeUndefined();
  });

  it('«Condición comercial» se consulta al comercial y no libera', () => {
    const s = createSeed(now);
    ops.classifySegment(s, id, 'seg-1', 'standard_repeat');
    ops.classifySegment(s, id, 'seg-2', 'commercial');
    ops.resolveObservations(s, id);
    expect(s.orders[id].blockers[0].status).toBe('waiting');
    expect(s.orders[id].blockers[0].waitingOn).toBe('sales');
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

describe('Regresiones de la revisión', () => {
  it('un resultado del ERP solo se aplica a un borrador aprobado (p. ej. tras un reinicio)', () => {
    const s = createSeed(now);
    ops.applyErpCreate(s, 'REQ-1042', { erpNumber: 'PV-26-999999', released: true, blocks: [], checks: [] });
    expect(s.orders['REQ-1042'].stage).toBe('draft');
    expect(s.orders['REQ-1042'].erpNumber).toBeUndefined();
  });

  it('no se puede crear una cuenta sin datos ni decisiones', () => {
    const s = createSeed(now);
    expect(() => ops.createAccount(s, 'ALTA-0042', 'C-20931')).toThrow();
    expect(s.orders['REQ-1047'].blockers[0].status).toBe('open');
  });

  it('Finanzas «sin crédito» permite crear la cuenta con pago anticipado (límite 0)', () => {
    const s = createSeed(now);
    const id = 'ALTA-0042';
    ops.generateInvite(s, id, 'T', 'u', now.toISOString());
    ops.submitCustomerForm(s, id, SAMPLE_CUSTOMER_DATA, findDuplicateCandidates(Object.values(s.customers), SAMPLE_CUSTOMER_DATA));
    ops.decideDuplicate(s, id, 'different', 'CIF distinto');
    for (const [k, v] of [['customerPostingGroup', 'NAC-HORECA'], ['vatPostingGroup', 'NACIONAL'], ['channelDimension', 'HORECA'], ['zoneDimension', 'BCN-CIUTAT']] as const)
      ops.updateInternal(s, id, k, v);
    ops.requestOnboardingFinance(s, id);
    ops.onboardingFinanceDecision(s, id, 'rejected');
    expect(canCreateAccount(s.onboarding[id])).toBe(true);
    ops.createAccount(s, id, 'C-20931');
    expect(s.customers['C-20931'].credit.limit).toBe(0);
  });

  it('«Esperar a tener los 2» deja el merchandising esperando material hasta que llega', () => {
    const s = createSeed(now);
    const id = 'PV-26-018662';
    ops.decideShortfall(s, id, 'wait');
    ops.requestMerchApprovals(s, id);
    ops.merchDecision(s, id, 'B', true);
    ops.merchDecision(s, id, 'C', true);
    ops.resolveMerch(s, id);
    const b = s.orders[id].blockers[0];
    expect(b.status).toBe('waiting');
    expect(b.waitingOn).toBe('logistics');
    ops.simulateMerchReceipt(s, id);
    ops.resolveMerch(s, id);
    expect(s.orders[id].blockers[0].status).toBe('resolved');
    expect(s.stock['M-02']).toBeGreaterThanOrEqual(2);
  });

  it('un rechazo de Material C con decisiones completas permite resolver', () => {
    const s = createSeed(now);
    const id = 'PV-26-018662';
    ops.decideShortfall(s, id, 'split');
    ops.requestMerchApprovals(s, id);
    ops.merchDecision(s, id, 'B', true);
    ops.merchDecision(s, id, 'C', false);
    expect(orderNextAction(s, s.orders[id]).label).toBe('Resolver el bloqueo de merchandising');
  });

  it('«Corregir» la fecha y la dirección cambia el pedido, no solo el texto', () => {
    const s = createSeed(now);
    ops.editField(s, 'REQ-1042', 'deliveryDate', '2026-10-30');
    ops.editField(s, 'REQ-1042', 'deliveryAddress', 'addr:A2');
    const o = s.orders['REQ-1042'];
    expect(new Date(o.requestedDeliveryDate).getDate()).toBe(30);
    expect(o.deliveryAddressId).toBe('A2');
    expect(o.fields.find((f) => f.key === 'deliveryAddress')?.value).toContain('Doctor Aiguader');
  });

  it('crédito rechazado → el comercial consigue pago anticipado → vuelve a Finanzas', () => {
    const s = createSeed(now);
    const id = 'PV-26-018655';
    ops.requestCreditReview(s, id, 'x');
    ops.financeDecision(s, id, 'rejected', 'no');
    ops.informCreditRejection(s, id);
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.waitingOn).toBe('sales');
    ops.resubmitCreditAfterPrepayment(s, id);
    expect(s.orders[id].credit?.decision).toBeUndefined();
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.waitingOn).toBe('finance');
    ops.financeDecision(s, id, 'approved', 'Pago recibido');
    expect(s.orders[id].blockers.find((b) => b.type === 'credit')?.status).toBe('resolved');
  });

  it('si el transportista deja de informar no se muestra una entrega confirmada', () => {
    const s = createSeed(now);
    s.orders['REQ-1042'].stage = 'released';
    const p = proposeShipment(s, 'REQ-1042');
    const shId = ops.createShipment(s, p, { 'ex-window': 'standard_inform' }, 'TOK', 'u');
    ops.simulateDispatch(s, shId);
    ops.simulateCarrierUpdate(s, shId);
    expect(confirmedDelivery(s.shipments[shId])?.window).toBe('16:00–19:00');
    ops.simulateCarrierSilence(s, shId);
    expect(confirmedDelivery(s.shipments[shId])).toBeUndefined();
  });

  it('«Es el mismo cliente» deja el pedido esperando a Finanzas, no a Atención al Cliente', () => {
    const s = createSeed(now);
    const id = 'ALTA-0042';
    ops.submitCustomerForm(s, id, SAMPLE_CUSTOMER_DATA, findDuplicateCandidates(Object.values(s.customers), SAMPLE_CUSTOMER_DATA));
    ops.decideDuplicate(s, id, 'same', 'Mismo local');
    ops.confirmField(s, 'REQ-1047', 'deliveryAddress');
    ops.confirmField(s, 'REQ-1047', 'deliveryDate');
    const na = orderNextAction(s, s.orders['REQ-1047']);
    expect(na.needs).toBe('others');
    expect(na.label).toBe('Esperando a Finanzas');
  });
});
