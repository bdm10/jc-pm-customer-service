// Alta de clientes: completitud, validación básica y detección de posibles duplicados.

import type { Customer, DuplicateCandidate, OnboardingCase, OnboardingCustomerData, OnboardingInternalData, OnboardingSalesData } from './types';

export const CUSTOMER_FIELDS: { key: keyof OnboardingCustomerData; label: string; group: 'legal' | 'billing' | 'delivery' | 'contact'; required: boolean }[] = [
  { key: 'legalName', label: 'Razón social', group: 'legal', required: true },
  { key: 'tradeName', label: 'Nombre comercial', group: 'legal', required: false },
  { key: 'taxId', label: 'NIF / CIF', group: 'legal', required: true },
  { key: 'fiscalAddress', label: 'Domicilio fiscal', group: 'legal', required: true },
  { key: 'billingEmail', label: 'Email de facturación', group: 'billing', required: true },
  { key: 'paymentMethod', label: 'Forma de pago preferida', group: 'billing', required: true },
  { key: 'iban', label: 'IBAN para domiciliación', group: 'billing', required: true },
  { key: 'deliveryAddress', label: 'Dirección de entrega', group: 'delivery', required: true },
  { key: 'deliveryHours', label: 'Horario de recepción', group: 'delivery', required: true },
  { key: 'deliveryContact', label: 'Persona que recibe', group: 'delivery', required: false },
  { key: 'contactName', label: 'Persona de contacto', group: 'contact', required: true },
  { key: 'contactEmail', label: 'Email de contacto', group: 'contact', required: true },
  { key: 'contactPhone', label: 'Teléfono', group: 'contact', required: true },
];

export const GROUP_LABEL = {
  legal: 'Datos legales',
  billing: 'Facturación',
  delivery: 'Entrega',
  contact: 'Contacto',
} as const;

export const SALES_FIELDS: { key: keyof OnboardingSalesData; label: string; required: boolean }[] = [
  { key: 'accountOwner', label: 'Comercial responsable', required: true },
  { key: 'segment', label: 'Canal / segmento', required: true },
  { key: 'priceList', label: 'Tarifa propuesta', required: true },
  { key: 'proposedPaymentTerms', label: 'Plazo de pago propuesto', required: true },
  { key: 'proposedCreditLimit', label: 'Límite de crédito propuesto', required: true },
  { key: 'expectedMonthlyVolume', label: 'Volumen mensual previsto', required: false },
  { key: 'notes', label: 'Notas del comercial', required: false },
];

export const INTERNAL_FIELDS: { key: keyof OnboardingInternalData; label: string; options: string[]; suggestion: string }[] = [
  { key: 'customerPostingGroup', label: 'Grupo contable cliente', options: ['NAC-HORECA', 'NAC-ALIMENTACION', 'NAC-DISTRIB', 'EXPORT'], suggestion: 'NAC-HORECA' },
  { key: 'vatPostingGroup', label: 'Grupo registro IVA', options: ['NACIONAL', 'INTRACOMUNITARIO', 'EXPORTACION', 'CANARIAS'], suggestion: 'NACIONAL' },
  { key: 'channelDimension', label: 'Dimensión canal', options: ['HORECA', 'ALIMENTACION', 'TIENDA-ESP', 'DISTRIBUIDOR'], suggestion: 'HORECA' },
  { key: 'zoneDimension', label: 'Dimensión zona', options: ['BCN-CIUTAT', 'CAT-RESTO', 'MADRID', 'LEVANTE', 'BALEARES'], suggestion: 'BCN-CIUTAT' },
];

const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

export function isCustomerFieldRequired(key: keyof OnboardingCustomerData, data: Partial<OnboardingCustomerData>): boolean {
  if (key === 'iban') return (data.paymentMethod ?? '').toLowerCase().includes('domiciliación');
  return CUSTOMER_FIELDS.find((f) => f.key === key)?.required ?? false;
}

export function sectionCompleteness(c: OnboardingCase) {
  const custReq = CUSTOMER_FIELDS.filter((f) => isCustomerFieldRequired(f.key, c.customerData));
  const custDone = custReq.filter((f) => filled(c.customerData[f.key]));
  const salesReq = SALES_FIELDS.filter((f) => f.required);
  const salesDone = salesReq.filter((f) => filled(c.salesData[f.key]));
  const intDone = INTERNAL_FIELDS.filter((f) => filled(c.internal[f.key]));
  return {
    customer: { done: custDone.length, total: custReq.length, missing: custReq.filter((f) => !filled(c.customerData[f.key])).map((f) => f.label) },
    sales: { done: salesDone.length, total: salesReq.length, missing: salesReq.filter((f) => !filled(c.salesData[f.key])).map((f) => f.label) },
    internal: { done: intDone.length, total: INTERNAL_FIELDS.length, missing: INTERNAL_FIELDS.filter((f) => !filled(c.internal[f.key])).map((f) => f.label) },
  };
}

export interface OutstandingItem {
  text: string;
  short: string;
  owner: string;
}

export function outstandingDecisions(c: OnboardingCase): OutstandingItem[] {
  const s = sectionCompleteness(c);
  const out: OutstandingItem[] = [];
  if (!c.invite) out.push({ text: 'Enviar el enlace de alta al cliente', short: 'Enviar el enlace de alta', owner: 'Atención al Cliente' });
  if (!c.customerSubmittedAt) out.push({ text: 'El cliente debe completar y enviar el formulario', short: 'Esperando el formulario del cliente', owner: 'Cliente' });
  else if (s.customer.missing.length) out.push({ text: `Faltan datos del cliente: ${s.customer.missing.join(', ')}`, short: 'Faltan datos del cliente', owner: 'Cliente' });
  if (c.customerData.taxId && !isValidSpanishTaxIdFormat(c.customerData.taxId)) out.push({ text: 'Revisar el formato del NIF / CIF', short: 'Revisar el NIF / CIF', owner: 'Atención al Cliente' });
  if (s.sales.missing.length) out.push({ text: `Faltan datos comerciales: ${s.sales.missing.join(', ')}`, short: 'Faltan datos del comercial', owner: 'Comercial' });
  if (c.duplicateCheck && c.duplicateCheck.candidates.length > 0 && !c.duplicateCheck.decision)
    out.push({ text: 'Decidir si el posible duplicado es el mismo cliente', short: 'Decidir el posible duplicado', owner: 'Atención al Cliente' });
  if (s.internal.missing.length) out.push({ text: `Asignar dimensiones contables: ${s.internal.missing.join(', ')}`, short: 'Asignar dimensiones contables', owner: 'Atención al Cliente / Administración' });
  if (c.finance.status === 'not_requested') out.push({ text: 'Solicitar a Finanzas la decisión de crédito y forma de pago', short: 'Solicitar decisión a Finanzas', owner: 'Atención al Cliente' });
  else if (c.finance.status === 'requested') out.push({ text: 'Decisión de crédito y forma de pago', short: 'Decisión de crédito', owner: 'Finanzas' });
  else if (c.finance.status === 'rejected') out.push({ text: 'Finanzas ha rechazado el crédito: acordar pago anticipado con el comercial', short: 'Acordar pago anticipado', owner: 'Comercial' });
  return out;
}

export function canCreateAccount(c: OnboardingCase): boolean {
  if (c.status === 'created' || c.status === 'merged') return false;
  const s = sectionCompleteness(c);
  const dupOk = !c.duplicateCheck || c.duplicateCheck.candidates.length === 0 || c.duplicateCheck.decision === 'different';
  const finOk = c.finance.status === 'approved' || c.finance.status === 'approved_changes';
  const taxOk = isValidSpanishTaxIdFormat(c.customerData.taxId ?? '');
  return !!c.customerSubmittedAt && s.customer.missing.length === 0 && s.sales.missing.length === 0 && s.internal.missing.length === 0 && dupOk && finOk && taxOk;
}

/** Comprueba solo el FORMATO (letra/dígitos). No valida contra la AEAT: eso requiere integración. */
export function isValidSpanishTaxIdFormat(v: string): boolean {
  const s = v.toUpperCase().replace(/[\s.-]/g, '');
  return /^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/.test(s) || /^\d{8}[A-Z]$/.test(s) || /^[XYZ]\d{7}[A-Z]$/.test(s);
}

export function normalizeText(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?\s?l\.?u?|s\.?\s?a\.?|sociedad limitada|sociedad anonima)\b/g, ' ')
    .replace(/\b(c\/|calle|carrer|avda\.?|avenida|avinguda|de|del|la|el|dels)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s: string): string[] {
  const t = s.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Coeficiente de Dice sobre bigramas (0–1). */
export function similarity(a: string, b: string): number {
  const A = bigrams(normalizeText(a));
  const B = bigrams(normalizeText(b));
  if (!A.length || !B.length) return 0;
  const counts = new Map<string, number>();
  for (const x of A) counts.set(x, (counts.get(x) ?? 0) + 1);
  let inter = 0;
  for (const x of B) {
    const c = counts.get(x) ?? 0;
    if (c > 0) {
      inter++;
      counts.set(x, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

const streetKey = (v: string) => {
  const n = normalizeText(v.split(',')[0] ?? v);
  return n;
};

/**
 * Busca posibles duplicados. Puntuación 0–100:
 * NIF idéntico = 100. Si no, nombre (hasta 60) + dirección de entrega o fiscal coincidente (40).
 */
export function findDuplicateCandidates(customers: Customer[], data: Partial<OnboardingCustomerData>): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  const tax = (data.taxId ?? '').toUpperCase().replace(/[\s.-]/g, '');
  const names = [data.legalName, data.tradeName].filter(filled) as string[];
  const addresses = [data.deliveryAddress, data.fiscalAddress].filter(filled) as string[];
  for (const c of customers) {
    const reasons: string[] = [];
    let score = 0;
    if (tax && c.taxId.toUpperCase() === tax) {
      score = 100;
      reasons.push('Mismo NIF / CIF');
    } else {
      const nameSim = Math.max(0, ...names.map((n) => Math.max(similarity(n, c.name), similarity(n, c.legalName))));
      if (nameSim >= 0.6) {
        score += Math.round(nameSim * 60);
        reasons.push(`Nombre muy parecido (${Math.round(nameSim * 100)} % de coincidencia)`);
      }
      const addrMatch = c.addresses.some((a) => addresses.some((x) => streetKey(x) === streetKey(a.street) || similarity(x, a.street) >= 0.85));
      if (addrMatch) {
        score += 40;
        reasons.push('Misma dirección');
      }
      if (tax && c.taxId && c.taxId.toUpperCase() !== tax && reasons.length) reasons.push('NIF / CIF distinto');
    }
    if (score >= 60) {
      out.push({
        customerId: c.id,
        name: c.name,
        taxId: c.taxId,
        address: c.addresses.map((a) => `${a.street}, ${a.city}`).join(' · '),
        status: c.status === 'blocked' ? c.statusNote ?? 'Cuenta bloqueada' : 'Cuenta activa',
        score,
        reasons,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export const SAMPLE_CUSTOMER_DATA: OnboardingCustomerData = {
  legalName: 'Urbana Gràcia Vins, S.L.',
  tradeName: 'Bodega Urbana Gràcia',
  taxId: 'B99420427',
  fiscalAddress: 'Carrer de Verdi 52, 08012 Barcelona',
  billingEmail: 'facturas@urbanagracia.example',
  paymentMethod: 'Domiciliación bancaria (SEPA)',
  iban: 'ES00 0000 0000 0000 0000 0000 (ficticio)',
  deliveryAddress: 'Carrer de Verdi 52, 08012 Barcelona',
  deliveryHours: 'Martes a sábado, 10:00–13:00',
  deliveryContact: 'Marc',
  contactName: 'Marc Soler',
  contactEmail: 'marc@urbanagracia.example',
  contactPhone: '+34 600 000 042',
};
