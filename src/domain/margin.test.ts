import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import { commercialApprover, computeDeal, findCommercialExceptions, rateContribution, rateGross } from './margin';

const now = new Date('2026-10-19T09:30:00');

describe('Comprobador de condiciones y margen (entradas sintéticas)', () => {
  it('escenario 1: margen bruto y contribución después de entrega con datos completos', () => {
    const s = createSeed(now);
    const o = s.orders['REQ-1042'];
    const r = computeDeal(o, s.customers['C-10233'], s.products, 'agreement');
    expect(r.revenue).toBe(664.44); // 36×9,02 + 24×10,64 + 12×7,03
    expect(r.cogs).toBe(404.4); // 36×5,40 + 24×6,60 + 12×4,30
    expect(r.grossMargin).toBe(260.04);
    expect(r.cases).toBe(12);
    expect(r.deliveryCost).toBe(31.2); // BCN: 18 € + 1,10 €/caja × 12
    expect(r.financingCost).toBe(2.18); // 664,44 × 4 % × 30/365
    expect(r.contribution).toBe(226.66);
    expect(r.complete).toBe(true);
    expect(rateGross(r.grossMarginPct)).toBe('ok');
    expect(rateContribution(r.contributionPct)).toBe('ok');
  });

  it('escenario 3: compara acuerdo frente a solicitud y separa margen bruto de contribución', () => {
    const s = createSeed(now);
    const o = s.orders['PV-26-018655'];
    const c = s.customers['C-11402'];
    const agreed = computeDeal(o, c, s.products, 'agreement');
    const requested = computeDeal(o, c, s.products, 'requested');

    expect(agreed.revenue).toBe(2295.48);
    expect(agreed.grossMargin).toBe(870.48);
    expect(agreed.deliveryCost).toBe(74.4);
    expect(agreed.financingCost).toBe(11.32);
    expect(agreed.contribution).toBe(784.76);

    expect(requested.revenue).toBe(2212.68); // 120×11,82 + 60×9,02 + 36×7,03
    expect(requested.cogs).toBe(1504); // incluye 10 botellas sin cargo al coste
    expect(requested.grossMargin).toBe(708.68);
    expect(requested.deliveryCost).toBe(77.2); // 38 cajas
    expect(requested.financingCost).toBe(14.55); // 60 días
    expect(requested.contribution).toBe(616.93);
    expect(rateGross(requested.grossMarginPct)).toBe('review');
    expect(rateGross(agreed.grossMarginPct)).toBe('ok');
  });

  it('detecta las excepciones comerciales y decide quién aprueba (regla provisional)', () => {
    const s = createSeed(now);
    const o = s.orders['PV-26-018655'];
    const c = s.customers['C-11402'];
    const ex = findCommercialExceptions(o, c, s.products);
    expect(ex.map((e) => e.kind).sort()).toEqual(['discount', 'free_goods', 'payment_terms']);
    expect(commercialApprover(ex, computeDeal(o, c, s.products, 'requested'))).toBe('commercial_mgmt');

    // Solo 2 puntos de descuento extra → jefe/a de ventas de zona.
    const small = structuredClone(o);
    small.lines[0].requestedDiscountPct = 12;
    small.lines[0].freeUnits = 0;
    small.deal.paymentTermsRequestedDays = 45;
    const ex2 = findCommercialExceptions(small, c, s.products);
    expect(ex2).toHaveLength(1);
    expect(commercialApprover(ex2, computeDeal(small, c, s.products, 'requested'))).toBe('sales_manager');
  });

  it('muestra «Cálculo incompleto» si falta el coste estándar (añada 2019 sin coste)', () => {
    const s = createSeed(now);
    const o = structuredClone(s.orders['PV-26-018671']);
    o.lines[0].sku = 'P-2003';
    const r = computeDeal(o, s.customers['C-10655'], s.products, 'agreement');
    expect(r.grossMargin).toBeNull();
    expect(r.contribution).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missing[0].what).toContain('Clos Mirador Gran Reserva 2019');
    expect(rateGross(r.grossMarginPct)).toBe('incomplete');
  });

  it('muestra «Cálculo incompleto» en la contribución si falta la tarifa de transporte (Baleares)', () => {
    const s = createSeed(now);
    const r = computeDeal(s.orders['REQ-1045'], s.customers['C-12190'], s.products, 'agreement');
    expect(r.grossMargin).not.toBeNull();
    expect(r.deliveryCost).toBeNull();
    expect(r.contribution).toBeNull();
    expect(r.missing.map((m) => m.what)).toContain('Tarifa de transporte para Islas Baleares');
  });

  it('el material promocional resta en la contribución, no en el margen bruto', () => {
    const s = createSeed(now);
    const o = s.orders['PV-26-018662'];
    const r = computeDeal(o, s.customers['C-12018'], s.products, 'agreement');
    expect(r.promoCost).toBe(2 * 145 + 6 * 18 + 2 * 12);
    const withoutMerch = computeDeal({ ...o, lines: o.lines.filter((l) => !l.sku.startsWith('M-')) }, s.customers['C-12018'], s.products, 'agreement');
    expect(r.grossMargin).toBe(withoutMerch.grossMargin);
    expect(r.contribution).toBeCloseTo((withoutMerch.contribution as number) - 422, 2);
  });
});
