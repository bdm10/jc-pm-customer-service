// Comprobador de condiciones y margen.
// Cálculos deterministas con entradas sintéticas documentadas en docs/CALCULOS.md.
// Los umbrales son ILUSTRATIVOS y PROVISIONALES: deben validarlos Dirección comercial y Finanzas.

import type { Customer, Order, Product, Role } from './types';

export interface DeliveryTariff {
  label: string;
  base: number;
  perCase: number;
}

export const MARGIN_ASSUMPTIONS = {
  /** Coste financiero anual aplicado al plazo de pago (sintético). */
  annualFinancingRate: 0.04,
  vatRate: 0.21,
  /** Recargo por entrega en franja horaria garantizada (sintético). */
  timeWindowSurcharge: 25,
  /** Tarifas de transporte sintéticas por zona. Baleares no tiene tarifa cargada a propósito. */
  deliveryTariffs: {
    BCN: { label: 'Barcelona ciudad', base: 18, perCase: 1.1 },
    CAT: { label: 'Resto de Cataluña', base: 24, perCase: 1.4 },
    MAD: { label: 'Madrid', base: 32, perCase: 1.9 },
    VAL: { label: 'Comunidad Valenciana', base: 28, perCase: 1.6 },
  } as Record<string, DeliveryTariff>,
  zoneLabels: {
    BCN: 'Barcelona ciudad',
    CAT: 'Resto de Cataluña',
    MAD: 'Madrid',
    VAL: 'Comunidad Valenciana',
    BAL: 'Islas Baleares',
  } as Record<string, string>,
  thresholds: {
    grossMarginPct: { ok: 0.35, review: 0.3 },
    contributionPct: { ok: 0.25, review: 0.18 },
    /** Puntos de descuento por encima del acuerdo que puede aprobar el/la jefe/a de ventas de zona. */
    zoneManagerDiscountPts: 2,
  },
} as const;

export type Rating = 'ok' | 'review' | 'approval' | 'incomplete';

export interface LineCalc {
  lineId: string;
  sku: string;
  name: string;
  quantity: number;
  freeUnits: number;
  listPrice: number;
  discountPct: number;
  netUnitPrice: number;
  revenue: number;
  unitCost: number | null;
  cost: number | null;
}

export interface MissingInput {
  what: string;
  owner: string;
}

export interface DealResult {
  basis: 'agreement' | 'requested';
  lines: LineCalc[];
  revenue: number;
  cogs: number | null;
  grossMargin: number | null;
  grossMarginPct: number | null;
  cases: number;
  deliveryCost: number | null;
  timeWindowCost: number;
  paymentDays: number;
  financingCost: number;
  promoCost: number | null;
  contribution: number | null;
  contributionPct: number | null;
  missing: MissingInput[];
  grossComplete: boolean;
  complete: boolean;
  totalWithVat: number;
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function computeDeal(
  order: Order,
  customer: Customer | undefined,
  products: Record<string, Product>,
  basis: 'agreement' | 'requested',
  zoneOverride?: string,
): DealResult {
  const lines: LineCalc[] = [];
  const missing: MissingInput[] = [];
  let revenue = 0;
  let cogs = 0;
  let cogsKnown = true;
  let promoCost = 0;
  let promoKnown = true;
  let cases = 0;

  for (const line of order.lines) {
    const p = products[line.sku];
    if (!p) continue;
    if (p.kind === 'merch') {
      if (p.unitCost == null) {
        promoKnown = false;
        missing.push({ what: `Valor del material «${p.name}»`, owner: 'Trade Marketing' });
      } else {
        promoCost += line.quantity * p.unitCost;
      }
      continue;
    }
    const discountPct = basis === 'requested' ? line.requestedDiscountPct : line.agreementDiscountPct;
    const freeUnits = basis === 'requested' ? line.freeUnits : line.agreementFreeUnits;
    const netUnitPrice = round2(p.listPrice * (1 - discountPct / 100));
    const lineRevenue = round2(line.quantity * netUnitPrice);
    const unitCost = p.unitCost;
    const cost = unitCost == null ? null : round2((line.quantity + freeUnits) * unitCost);
    if (cost == null) {
      cogsKnown = false;
      missing.push({ what: `Coste estándar de ${p.name} ${p.vintage ?? ''} ${p.format ?? ''}`.replace(/\s+/g, ' ').trim(), owner: 'Control de gestión' });
    } else {
      cogs += cost;
    }
    revenue += lineRevenue;
    cases += Math.ceil((line.quantity + freeUnits) / p.unitsPerCase);
    lines.push({
      lineId: line.id,
      sku: line.sku,
      name: p.name,
      quantity: line.quantity,
      freeUnits,
      listPrice: p.listPrice,
      discountPct,
      netUnitPrice,
      revenue: lineRevenue,
      unitCost,
      cost,
    });
  }

  revenue = round2(revenue);
  const address = customer?.addresses.find((a) => a.id === order.deliveryAddressId) ?? customer?.addresses[0];
  const zone = zoneOverride ?? address?.zone ?? order.deliveryZone;
  const tariff = zone ? MARGIN_ASSUMPTIONS.deliveryTariffs[zone] : undefined;
  let deliveryCost: number | null = null;
  if (tariff) {
    deliveryCost = round2(tariff.base + tariff.perCase * cases);
  } else {
    missing.push({
      what: `Tarifa de transporte para ${zone ? MARGIN_ASSUMPTIONS.zoneLabels[zone] ?? zone : 'la dirección de entrega'}`,
      owner: 'Logística',
    });
  }
  const timeWindowCost = order.deal.timeWindowService ? MARGIN_ASSUMPTIONS.timeWindowSurcharge : 0;

  const paymentDays = basis === 'requested' ? order.deal.paymentTermsRequestedDays : customer?.agreement.paymentTermsDays ?? 30;
  const financingCost = round2((revenue * MARGIN_ASSUMPTIONS.annualFinancingRate * paymentDays) / 365);

  const grossComplete = cogsKnown;
  const grossMargin = grossComplete ? round2(revenue - cogs) : null;
  const grossMarginPct = grossMargin != null && revenue > 0 ? grossMargin / revenue : null;

  const complete = grossComplete && deliveryCost != null && promoKnown;
  const contribution = complete
    ? round2((grossMargin as number) - (deliveryCost as number) - timeWindowCost - financingCost - promoCost)
    : null;
  const contributionPct = contribution != null && revenue > 0 ? contribution / revenue : null;

  return {
    basis,
    lines,
    revenue,
    cogs: cogsKnown ? round2(cogs) : null,
    grossMargin,
    grossMarginPct,
    cases,
    deliveryCost,
    timeWindowCost,
    paymentDays,
    financingCost,
    promoCost: promoKnown ? round2(promoCost) : null,
    contribution,
    contributionPct,
    missing,
    grossComplete,
    complete,
    totalWithVat: round2(revenue * (1 + MARGIN_ASSUMPTIONS.vatRate)),
  };
}

export function rateGross(pct: number | null): Rating {
  if (pct == null) return 'incomplete';
  const t = MARGIN_ASSUMPTIONS.thresholds.grossMarginPct;
  if (pct >= t.ok) return 'ok';
  if (pct >= t.review) return 'review';
  return 'approval';
}

export function rateContribution(pct: number | null): Rating {
  if (pct == null) return 'incomplete';
  const t = MARGIN_ASSUMPTIONS.thresholds.contributionPct;
  if (pct >= t.ok) return 'ok';
  if (pct >= t.review) return 'review';
  return 'approval';
}

export interface CommercialException {
  kind: 'discount' | 'free_goods' | 'payment_terms';
  lineId?: string;
  text: string;
  agreed: string;
  requested: string;
  deltaPts?: number;
}

export function findCommercialExceptions(order: Order, customer: Customer | undefined, products: Record<string, Product>): CommercialException[] {
  const out: CommercialException[] = [];
  for (const line of order.lines) {
    const p = products[line.sku];
    if (!p || p.kind !== 'wine') continue;
    if (line.requestedDiscountPct > line.agreementDiscountPct) {
      const delta = line.requestedDiscountPct - line.agreementDiscountPct;
      out.push({
        kind: 'discount',
        lineId: line.id,
        text: `Descuento en ${p.name}`,
        agreed: `${line.agreementDiscountPct} %`,
        requested: `${line.requestedDiscountPct} %`,
        deltaPts: delta,
      });
    }
    if (line.freeUnits > line.agreementFreeUnits) {
      out.push({
        kind: 'free_goods',
        lineId: line.id,
        text: `Unidades sin cargo de ${p.name}`,
        agreed: `${line.agreementFreeUnits} uds`,
        requested: `${line.freeUnits} uds`,
      });
    }
  }
  const agreedDays = customer?.agreement.paymentTermsDays;
  if (agreedDays != null && order.deal.paymentTermsRequestedDays > agreedDays) {
    out.push({
      kind: 'payment_terms',
      text: 'Plazo de pago',
      agreed: `${agreedDays} días`,
      requested: `${order.deal.paymentTermsRequestedDays} días`,
    });
  }
  return out;
}

/**
 * Regla provisional de quién aprueba una excepción comercial:
 * - Solo descuento ≤ 2 puntos sobre el acuerdo → Jefe/a de ventas de zona.
 * - Cualquier otra combinación (más descuento, unidades sin cargo, plazo) → Dirección comercial.
 * - Si el margen bruto solicitado queda por debajo del umbral de aprobación → Dirección comercial.
 */
export function commercialApprover(exceptions: CommercialException[], requested: DealResult): Role {
  const onlySmallDiscounts = exceptions.every(
    (e) => e.kind === 'discount' && (e.deltaPts ?? 0) <= MARGIN_ASSUMPTIONS.thresholds.zoneManagerDiscountPts,
  );
  if (onlySmallDiscounts && rateGross(requested.grossMarginPct) !== 'approval') return 'sales_manager';
  return 'commercial_mgmt';
}
