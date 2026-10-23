// Datos de demostración. TODOS los clientes, personas, importes y referencias son sintéticos.
// Los tiempos se generan relativos al momento del reinicio para que las antigüedades sean realistas.

import { addBusinessDays, addHours, addMinutes } from '../domain/format';
import type {
  Customer,
  DemoState,
  Enquiry,
  OnboardingCase,
  Order,
  Product,
  Shipment,
  Claim,
  TimelineEvent,
  Role,
} from '../domain/types';

export const STATE_VERSION = 3;

/** Próximo día de la semana indicado (1 = lunes … 5 = viernes), al menos mañana. */
function nextWeekday(base: Date, weekday: number): string {
  const d = new Date(base);
  d.setHours(9, 0, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== weekday);
  return d.toISOString();
}

function dayAfter(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

const fmtDayMonth = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

const products: Product[] = [
  { sku: 'P-1001', name: 'Finca Alba Brut Reserva', kind: 'wine', style: 'Cava', vintage: 2021, format: '75 cl', unitsPerCase: 6, listPrice: 9.8, unitCost: 5.4 },
  { sku: 'P-2001', name: 'Clos Mirador Crianza', kind: 'wine', style: 'Tinto', vintage: 2021, format: '75 cl', unitsPerCase: 6, listPrice: 11.2, unitCost: 6.6 },
  { sku: 'P-2002', name: 'Clos Mirador Gran Reserva', kind: 'wine', style: 'Tinto', vintage: 2018, format: '150 cl (mágnum)', unitsPerCase: 3, listPrice: 58, unitCost: 31.5 },
  { sku: 'P-2003', name: 'Clos Mirador Gran Reserva', kind: 'wine', style: 'Tinto', vintage: 2019, format: '150 cl (mágnum)', unitsPerCase: 3, listPrice: 58, unitCost: null },
  { sku: 'P-2004', name: 'Clos Mirador Gran Reserva', kind: 'wine', style: 'Tinto', vintage: 2018, format: '75 cl', unitsPerCase: 6, listPrice: 27.5, unitCost: 14.8 },
  { sku: 'P-3001', name: 'Costa Lumen Blanco', kind: 'wine', style: 'Blanco', vintage: 2024, format: '75 cl', unitsPerCase: 6, listPrice: 7.4, unitCost: 4.3 },
  { sku: 'P-3002', name: 'Costa Lumen Rosado', kind: 'wine', style: 'Rosado', vintage: 2024, format: '75 cl', unitsPerCase: 6, listPrice: 7.4, unitCost: 4.25 },
  { sku: 'P-4001', name: 'Mas Roure Garnatxa', kind: 'wine', style: 'Tinto', vintage: 2022, format: '75 cl', unitsPerCase: 6, listPrice: 13.9, unitCost: 7.9 },
  { sku: 'P-5001', name: 'Vermut Riera Roig', kind: 'wine', style: 'Vermut', vintage: 'Sin añada', format: '100 cl', unitsPerCase: 6, listPrice: 12, unitCost: 6.9 },
  { sku: 'M-01', name: 'Cubitera metálica Finca Alba', kind: 'merch', unitsPerCase: 1, listPrice: 0, unitCost: 18, merchCategory: 'B' },
  { sku: 'M-02', name: 'Expositor de suelo (6 cajas)', kind: 'merch', unitsPerCase: 1, listPrice: 0, unitCost: 145, merchCategory: 'C' },
  { sku: 'M-03', name: 'Posavasos (pack de 100)', kind: 'merch', unitsPerCase: 1, listPrice: 0, unitCost: 12, merchCategory: 'A' },
];

const baseCredit = (limit: number, balance: number) => ({
  limit,
  balanceNotDue: balance,
  overdue: 0,
  oldestOverdueDays: 0,
  insurerCoverage: limit,
  lastPayment: { date: '', amount: 0 },
  averageDaysToPay: 31,
});

export function createSeed(now: Date = new Date()): DemoState {
  const h = (hours: number) => addHours(now, hours);
  const m = (minutes: number) => addMinutes(now, minutes);
  const bd = (n: number) => addBusinessDays(now, n);

  const thursday = nextWeekday(now, 4);
  const s2Thursday = thursday;
  const s2Friday = dayAfter(s2Thursday);
  const nextTuesday = nextWeekday(new Date(nextWeekday(now, 1)), 2);
  const receiptDate = bd(12);

  const productMap: Record<string, Product> = {};
  for (const p of products) productMap[p.sku] = { ...p };
  productMap['P-2002'].nextReceipt = { date: receiptDate, quantity: 24 };

  const customers: Customer[] = [
    {
      id: 'C-10233',
      name: 'Restaurante El Faro Azul',
      legalName: 'El Faro Azul Restauración, S.L.',
      taxId: 'B99102331',
      company: 'PM',
      segment: 'Horeca — restaurante',
      salesRep: 'Jordi Puig',
      contactName: 'Sergio (compras)',
      addresses: [
        { id: 'A1', label: 'Local principal', street: 'Passeig de la Barceloneta 21', postalCode: '08003', city: 'Barcelona', zone: 'BCN' },
        { id: 'A2', label: 'Almacén', street: 'Carrer del Doctor Aiguader 88', postalCode: '08003', city: 'Barcelona', zone: 'BCN' },
      ],
      standardInstructions: [{ text: 'Entregar antes de las 12:00 (el servicio de comidas empieza a las 13:00).', since: '02/2025', seenIn: '9 de los últimos 10 pedidos' }],
      agreement: { name: 'Acuerdo Horeca Barcelona 2026', validUntil: '31/12/2026', defaultDiscountPct: 5, discountsBySku: { 'P-1001': 8 }, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(12000, 3480), lastPayment: { date: h(-24 * 9), amount: 1240 } },
      status: 'active',
    },
    {
      id: 'C-10871',
      name: 'Hotel Miramar Costa',
      legalName: 'Miramar Costa Hoteles, S.A.',
      taxId: 'A99108712',
      company: 'PM',
      segment: 'Horeca — hotel',
      salesRep: 'Laia Ferrer',
      contactName: 'Recepción / economato',
      addresses: [{ id: 'A1', label: 'Hotel — acceso de servicio', street: 'Carrer dels Pescadors 12', postalCode: '08870', city: 'Sitges', zone: 'CAT' }],
      standardInstructions: [
        { text: 'Entregar por la puerta de servicio (C/ dels Pescadors 12) y avisar a recepción al llegar.', since: '03/2025', seenIn: '14 de los últimos 15 pedidos' },
      ],
      agreement: { name: 'Acuerdo Hoteles Costa 2026', validUntil: '31/12/2026', defaultDiscountPct: 7, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 45 },
      credit: { ...baseCredit(30000, 8940), lastPayment: { date: h(-24 * 12), amount: 5120 } },
      status: 'active',
    },
    {
      id: 'C-11402',
      name: 'Grupo Tapas Nórdicas',
      legalName: 'Tapas Nórdicas Grupo de Restauración, S.L.',
      taxId: 'B99114024',
      company: 'PM',
      segment: 'Horeca — cadena',
      salesRep: 'Jordi Puig',
      contactName: 'Central de compras',
      addresses: [{ id: 'A1', label: 'Central de compras', street: 'Carrer de la Creu 7', postalCode: '17002', city: 'Girona', zone: 'CAT' }],
      standardInstructions: [],
      agreement: {
        name: 'Acuerdo Cadenas Horeca 2026',
        validUntil: '31/12/2026',
        defaultDiscountPct: 5,
        discountsBySku: { 'P-4001': 10, 'P-1001': 8 },
        freeGoodsPer12: {},
        paymentTermsDays: 45,
      },
      credit: {
        limit: 25000,
        balanceNotDue: 19360,
        overdue: 4120,
        oldestOverdueDays: 38,
        insurerCoverage: 20000,
        lastPayment: { date: h(-24 * 21), amount: 6200 },
        averageDaysToPay: 58,
      },
      status: 'active',
    },
    {
      id: 'C-10655',
      name: 'Vinoteca Las Tres Copas',
      legalName: 'Las Tres Copas Vinos, S.L.',
      taxId: 'B99106557',
      company: 'PM',
      segment: 'Tienda especializada',
      salesRep: 'Marta Gil',
      contactName: 'Lucía (encargada)',
      addresses: [{ id: 'A1', label: 'Tienda', street: 'Calle de Ponzano 41', postalCode: '28003', city: 'Madrid', zone: 'MAD' }],
      standardInstructions: [],
      agreement: { name: 'Acuerdo Tiendas Especializadas 2026', validUntil: '31/12/2026', defaultDiscountPct: 6, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(15000, 4210), lastPayment: { date: h(-24 * 6), amount: 2380 } },
      status: 'active',
    },
    {
      id: 'C-12018',
      name: 'Supermercados Vall Fresca',
      legalName: 'Vall Fresca Distribució Alimentària, S.A.',
      taxId: 'A99120180',
      company: 'PM',
      segment: 'Alimentación',
      salesRep: 'Pau Serra',
      contactName: 'Jefe de sección bebidas',
      addresses: [{ id: 'A1', label: 'Tienda Lleida Centre', street: 'Avinguda de Blondel 30', postalCode: '25002', city: 'Lleida', zone: 'CAT' }],
      standardInstructions: [{ text: 'Muelle de carga 2. Horario de recepción 7:00–11:00.', since: '01/2025', seenIn: 'todos los pedidos' }],
      agreement: { name: 'Acuerdo Alimentación Regional 2026', validUntil: '31/12/2026', defaultDiscountPct: 9, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 60 },
      credit: { ...baseCredit(60000, 21800), lastPayment: { date: h(-24 * 4), amount: 9800 } },
      status: 'active',
    },
    {
      id: 'C-10482',
      name: 'Bodega Urbana Gracia, S.L.',
      legalName: 'Bodega Urbana Gracia, S.L.',
      taxId: 'B99104829',
      company: 'PM',
      segment: 'Horeca — bar de vinos',
      salesRep: '—',
      addresses: [{ id: 'A1', label: 'Local', street: 'Carrer de Verdi 52', postalCode: '08012', city: 'Barcelona', zone: 'BCN' }],
      standardInstructions: [],
      agreement: { name: 'Sin acuerdo vigente', validUntil: '—', defaultDiscountPct: 0, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(0, 0) },
      status: 'blocked',
      statusNote: 'Cuenta inactiva desde 05/2023 (cese de actividad comunicado).',
    },
    {
      id: 'C-11950',
      name: 'Distribuciones Llevant',
      legalName: 'Distribuciones Llevant, S.L.',
      taxId: 'B99119504',
      company: 'PM',
      segment: 'Distribuidor',
      salesRep: 'Marta Gil',
      addresses: [{ id: 'A1', label: 'Almacén Paterna', street: 'Calle Ciudad de Sevilla 14, Pol. Fuente del Jarro', postalCode: '46988', city: 'Paterna', zone: 'VAL' }],
      standardInstructions: [{ text: 'Cita previa obligatoria en muelle (llamar 24 h antes).', since: '06/2024', seenIn: 'todos los pedidos' }],
      agreement: { name: 'Acuerdo Distribuidores 2026', validUntil: '31/12/2026', defaultDiscountPct: 12, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 60 },
      credit: { ...baseCredit(80000, 31200), lastPayment: { date: h(-24 * 15), amount: 14800 } },
      status: 'active',
    },
    {
      id: 'C-10120',
      name: 'Celler Casa Montserrat',
      legalName: 'Casa Montserrat Celler, S.L.',
      taxId: 'B99101203',
      company: 'JC',
      segment: 'Tienda especializada',
      salesRep: 'Equipo comercial JC',
      addresses: [{ id: 'A1', label: 'Tienda', street: 'Carrer Major 18', postalCode: '08770', city: "Sant Sadurní d'Anoia", zone: 'CAT' }],
      standardInstructions: [],
      agreement: { name: 'Acuerdo JC Tiendas 2026', validUntil: '31/12/2026', defaultDiscountPct: 6, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(20000, 5100) },
      status: 'active',
    },
    {
      id: 'C-12190',
      name: 'Club Náutico Cala Serena',
      legalName: 'Club Náutico Cala Serena',
      taxId: 'G99121904',
      company: 'PM',
      segment: 'Horeca — club',
      salesRep: 'Laia Ferrer',
      addresses: [{ id: 'A1', label: 'Bar del puerto', street: 'Passeig Marítim 3', postalCode: '07157', city: "Port d'Andratx", zone: 'BAL' }],
      standardInstructions: [],
      agreement: { name: 'Acuerdo Horeca Baleares 2026', validUntil: '31/12/2026', defaultDiscountPct: 5, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(10000, 2200) },
      status: 'active',
    },
    {
      id: 'C-10377',
      name: 'Restaurante Sal y Brasa',
      legalName: 'Sal y Brasa Restauración, S.L.',
      taxId: 'B99103772',
      company: 'PM',
      segment: 'Horeca — restaurante',
      salesRep: 'Jordi Puig',
      addresses: [{ id: 'A1', label: 'Restaurante', street: 'Carrer de Pujades 102', postalCode: '08005', city: 'Barcelona', zone: 'BCN' }],
      standardInstructions: [],
      agreement: { name: 'Acuerdo Horeca Barcelona 2026', validUntil: '31/12/2026', defaultDiscountPct: 5, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 30 },
      credit: { ...baseCredit(8000, 1900) },
      status: 'active',
    },
    {
      id: 'C-10918',
      name: 'Hotel Les Dunes',
      legalName: 'Les Dunes Hotel & Spa, S.L.',
      taxId: 'B99109189',
      company: 'PM',
      segment: 'Horeca — hotel',
      salesRep: 'Laia Ferrer',
      addresses: [{ id: 'A1', label: 'Hotel', street: 'Avinguda del Mar 60', postalCode: '43840', city: 'Salou', zone: 'CAT' }],
      standardInstructions: [],
      agreement: { name: 'Acuerdo Hoteles Costa 2026', validUntil: '31/12/2026', defaultDiscountPct: 7, discountsBySku: {}, freeGoodsPer12: {}, paymentTermsDays: 45 },
      credit: { ...baseCredit(20000, 6400) },
      status: 'active',
    },
  ];

  const line = (
    id: string,
    sku: string,
    quantity: number,
    agreementDiscountPct: number,
    extra: Partial<Order['lines'][number]> = {},
  ): Order['lines'][number] => ({
    id,
    sku,
    quantity,
    requestedDiscountPct: agreementDiscountPct,
    agreementDiscountPct,
    freeUnits: 0,
    agreementFreeUnits: 0,
    ...extra,
  });

  const orders: Order[] = [
    // ---------- Escenario 1: pedido limpio desde email ----------
    {
      id: 'REQ-1042',
      scenarioId: 's1',
      company: 'PM',
      customerId: 'C-10233',
      channel: 'email',
      stage: 'draft',
      receivedAt: m(-42),
      owner: 'Ana Ruiz',
      requestedDeliveryDate: thursday,
      deliveryAddressId: 'A1',
      customerReference: 'FA-1018',
      source: {
        channel: 'email',
        from: 'Sergio — El Faro Azul',
        fromAddress: 'compras@elfaroazul.example',
        to: 'pedidos-pm@empresa.example',
        subject: 'Pedido semana — El Faro Azul',
        receivedAt: m(-42),
        segments: [
          { text: 'Hola equipo,\n\nOs paso el pedido de esta semana para ' },
          { id: 'ev-addr', text: 'el local de siempre' },
          { text: ':\n\n· ' },
          { id: 'ev-l1', text: '6 cajas de Finca Alba Brut Reserva' },
          { text: '\n· ' },
          { id: 'ev-l2', text: '4 cajas de Clos Mirador Crianza 2021' },
          { text: '\n· ' },
          { id: 'ev-l3', text: '2 cajas de Costa Lumen blanco' },
          { text: '\n\nSi puede ser, ' },
          { id: 'ev-date', text: 'lo necesitamos para el jueves' },
          { text: ', ' },
          { id: 'ev-instr', text: 'antes de las 12 como siempre' },
          { text: '.\n\nAdjunto la hoja de pedido con nuestra referencia ' },
          { id: 'ev-ref', text: 'FA-1018' },
          { text: '.\n\nGracias,\nSergio\nEl Faro Azul' },
        ],
        attachments: [
          {
            id: 'att-1',
            name: 'Pedido_FA-1018.pdf',
            kind: 'pdf_order',
            sizeLabel: '84 KB',
            title: 'HOJA DE PEDIDO — EL FARO AZUL',
            header: ['Ref. interna', 'Descripción', 'Cajas', 'Botellas'],
            rows: [
              { id: 'ev-l1', cells: ['FA-ESP-01', 'Finca Alba Brut Reserva', '6', '36'] },
              { id: 'ev-l2', cells: ['FA-TIN-04', 'Clos Mirador Crianza 2021', '4', '24'] },
              { id: 'ev-l3', cells: ['FA-BLA-02', 'Costa Lumen Blanco', '2', '12'] },
            ],
            footer: 'Ref. cliente FA-1018 · Entrega: jueves · Local Barceloneta',
          },
        ],
      },
      capture: { draftId: 'CAP-7731', capturedAt: m(-40), customerMatch: 'Remitente registrado como contacto de compras', overallConfidence: 'media' },
      fields: [
        { key: 'customer', label: 'Cliente', value: 'Restaurante El Faro Azul (C-10233)', confidence: 'alta', note: 'El remitente coincide con el contacto de compras registrado.', confirmed: true },
        { key: 'customerReference', label: 'Referencia del cliente', value: 'FA-1018', confidence: 'alta', evidenceId: 'ev-ref', confirmed: true },
        {
          key: 'deliveryAddress',
          label: 'Dirección de entrega',
          value: 'Local principal — Passeig de la Barceloneta 21, 08003 Barcelona',
          confidence: 'media',
          evidenceId: 'ev-addr',
          note: 'El email dice «el local de siempre». El cliente tiene 2 direcciones; se propone la usada en 9 de los últimos 10 pedidos.',
          confirmed: false,
        },
        {
          key: 'deliveryDate',
          label: 'Fecha de entrega solicitada',
          value: fmtDayMonth(thursday),
          confidence: 'media',
          evidenceId: 'ev-date',
          note: '«Para el jueves» se interpreta como el próximo jueves. El cliente no indica fecha exacta.',
          confirmed: false,
        },
        { key: 'instructions', label: 'Instrucción de entrega', value: 'Entregar antes de las 12:00', confidence: 'alta', evidenceId: 'ev-instr', note: 'Coincide con la instrucción habitual de la ficha.', confirmed: true },
      ],
      lines: [
        line('L1', 'P-1001', 36, 8, { evidenceId: 'ev-l1' }),
        line('L2', 'P-2001', 24, 5, { evidenceId: 'ev-l2' }),
        line('L3', 'P-3001', 12, 5, {
          evidenceId: 'ev-l3',
          uncertainty: { field: 'vintage', confidence: 'media', note: 'El email no indica añada. Se propone 2024, la añada en curso con stock.', confirmed: false },
        }),
      ],
      blockers: [],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
    },
    {
      id: 'PV-26-018702',
      scenarioId: 's1',
      company: 'PM',
      customerId: 'C-10233',
      channel: 'mipm',
      stage: 'released',
      erpNumber: 'PV-26-018702',
      receivedAt: h(-20),
      requestedDeliveryDate: thursday,
      deliveryAddressId: 'A1',
      source: {
        channel: 'mipm',
        from: 'Portal Mi PM',
        fromAddress: 'usuario: compras@elfaroazul.example',
        receivedAt: h(-20),
        segments: [{ text: 'Pedido de reposición desde el portal Mi PM.\n12 × Vermut Riera Roig 100 cl.\nSin observaciones.' }],
        attachments: [],
      },
      fields: [],
      lines: [line('L1', 'P-5001', 12, 5)],
      blockers: [],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
      releasedAt: h(-20),
    },

    // ---------- Escenario 2: bloqueo por observaciones ----------
    {
      id: 'PV-26-018690',
      scenarioId: 's2',
      company: 'PM',
      customerId: 'C-10871',
      channel: 'vendor',
      stage: 'erp_confirmed',
      erpNumber: 'PV-26-018690',
      receivedAt: h(-3),
      owner: 'Ana Ruiz',
      requestedDeliveryDate: s2Thursday,
      deliveryAddressId: 'A1',
      source: {
        channel: 'vendor',
        from: 'Vendor App — Laia Ferrer (comercial)',
        fromAddress: 'Pedido introducido en visita al cliente',
        receivedAt: h(-3),
        segments: [
          { text: 'Pedido tomado en visita. Campo «Observaciones» del pedido:\n\n' },
          { id: 'ev-obs1', text: 'Entregar por la puerta de servicio (C/ dels Pescadors 12) y avisar a recepción al llegar.' },
          { text: ' ' },
          { id: 'ev-obs2', text: 'IMPORTANTE: esta vez entregar en el Pabellón del Mar, Passeig de la Ribera 45, el viernes antes de las 10:00 — montaje de boda.' },
        ],
        attachments: [],
      },
      fields: [],
      lines: [line('L1', 'P-1001', 48, 7), line('L2', 'P-3001', 36, 7), line('L3', 'P-2001', 24, 7)],
      blockers: [
        {
          id: 'B-OBS',
          type: 'observations',
          origin: 'erp',
          status: 'open',
          reason: 'El pedido tiene texto en «Observaciones». El ERP lo retiene para que alguien lo lea antes de liberar.',
          decider: 'cs',
        },
      ],
      observation: {
        originalNote:
          'Entregar por la puerta de servicio (C/ dels Pescadors 12) y avisar a recepción al llegar. IMPORTANTE: esta vez entregar en el Pabellón del Mar, Passeig de la Ribera 45, el viernes antes de las 10:00 — montaje de boda.',
        segments: [
          {
            id: 'seg-1',
            text: 'Entregar por la puerta de servicio (C/ dels Pescadors 12) y avisar a recepción al llegar.',
            suggestion: 'standard_repeat',
            basis: [
              'Coincide con la instrucción habitual de la ficha del cliente (registrada en 03/2025).',
              'Aparece en 14 de los últimos 15 pedidos de este cliente.',
              'No cambia dirección, fecha, franja ni condiciones.',
            ],
          },
          {
            id: 'seg-2',
            text: 'IMPORTANTE: esta vez entregar en el Pabellón del Mar, Passeig de la Ribera 45, el viernes antes de las 10:00 — montaje de boda.',
            suggestion: 'one_off_delivery',
            basis: [
              'No coincide con ninguna instrucción de la ficha del cliente.',
              'Indica una dirección que no está registrada para este cliente.',
              'Indica una fecha y una franja horaria distintas a las del pedido.',
              '«Esta vez» apunta a un cambio puntual: es un indicio, no el criterio para liberar.',
            ],
            structured: { address: 'Pabellón del Mar, Passeig de la Ribera 45, 08870 Sitges', date: s2Friday, window: 'Antes de las 10:00', contact: '' },
          },
        ],
        conflicts: [
          {
            id: 'cf-address',
            segmentId: 'seg-2',
            title: 'Dirección distinta de la del pedido',
            detail: 'El pedido va a C/ dels Pescadors 12 (dirección de la ficha). La nota pide Passeig de la Ribera 45, que no está registrada.',
            options: [
              { id: 'use_event', label: 'Entregar en Passeig de la Ribera 45 solo en este pedido', consequence: 'Se registra como dirección puntual. La ficha del cliente no cambia.' },
              { id: 'ask_customer', label: 'Mantener la dirección habitual y consultar al cliente', consequence: 'El bloqueo queda pendiente de la respuesta del cliente.' },
            ],
          },
          {
            id: 'cf-window',
            segmentId: 'seg-2',
            title: 'Fecha y franja horaria',
            detail: `El pedido tiene entrega el ${fmtDayMonth(s2Thursday)}. La nota pide el viernes antes de las 10:00; el transporte estándar no garantiza franja horaria.`,
            options: [
              { id: 'friday_window', label: 'Cambiar a viernes y pedir servicio con franja garantizada', consequence: 'Fecha → viernes. Se añade el recargo de franja (25 €, sintético) al cálculo de contribución.' },
              { id: 'friday_no_window', label: 'Cambiar a viernes sin franja garantizada e informar al cliente', consequence: 'Fecha → viernes. Se avisa al cliente de que la hora no está garantizada.' },
              { id: 'ask_customer', label: 'Mantener la fecha del pedido y consultar al cliente', consequence: 'El bloqueo queda pendiente de la respuesta del cliente.' },
            ],
          },
        ],
      },
      deal: { paymentTermsRequestedDays: 45, approval: { status: 'not_needed' } },
    },

    // ---------- Escenario 3: bloqueo por crédito (+ excepción comercial) ----------
    {
      id: 'PV-26-018655',
      scenarioId: 's3',
      company: 'PM',
      customerId: 'C-11402',
      channel: 'mipm',
      stage: 'erp_confirmed',
      erpNumber: 'PV-26-018655',
      receivedAt: h(-5),
      owner: 'Ana Ruiz',
      requestedDeliveryDate: bd(1),
      deliveryAddressId: 'A1',
      source: {
        channel: 'mipm',
        from: 'Portal Mi PM',
        fromAddress: 'usuario: compras@tapasnordicas.example',
        receivedAt: h(-5),
        segments: [
          { text: 'Pedido semanal de la central de Girona.\nComentario del cliente: «' },
          { id: 'ev-terms', text: 'Según lo hablado con Jordi: 15 % en Mas Roure Garnatxa, 10 botellas sin cargo y pago a 60 días' },
          { text: '».' },
        ],
        attachments: [],
      },
      fields: [],
      lines: [
        line('L1', 'P-4001', 120, 10, { requestedDiscountPct: 15, freeUnits: 10, evidenceId: 'ev-terms' }),
        line('L2', 'P-1001', 60, 8),
        line('L3', 'P-3002', 36, 5),
      ],
      blockers: [
        {
          id: 'B-CREDIT',
          type: 'credit',
          origin: 'erp',
          status: 'open',
          reason: 'El saldo pendiente más este pedido supera el límite de crédito, y hay facturas vencidas de más de 30 días.',
          decider: 'finance',
        },
        {
          id: 'B-COMM',
          type: 'commercial',
          origin: 'workspace',
          status: 'open',
          reason: 'El cliente pide condiciones fuera del acuerdo: más descuento, botellas sin cargo y un plazo de pago más largo.',
          decider: 'commercial_mgmt',
        },
      ],
      credit: {},
      deal: { paymentTermsRequestedDays: 60, approval: { status: 'needed' } },
    },

    // ---------- Escenario 4: producto sin stock ----------
    {
      id: 'PV-26-018671',
      scenarioId: 's4',
      company: 'PM',
      customerId: 'C-10655',
      channel: 'vendor',
      stage: 'erp_confirmed',
      erpNumber: 'PV-26-018671',
      receivedAt: h(-6),
      requestedDeliveryDate: bd(3),
      deliveryAddressId: 'A1',
      source: {
        channel: 'vendor',
        from: 'Vendor App — Marta Gil (comercial)',
        fromAddress: 'Pedido introducido por teléfono con la tienda',
        receivedAt: h(-6),
        segments: [{ text: 'Pedido para la campaña de Navidad de la tienda. Les interesa especialmente el Gran Reserva en mágnum para cestas.' }],
        attachments: [],
      },
      fields: [],
      lines: [line('L1', 'P-2002', 12, 6), line('L2', 'P-2001', 24, 6), line('L3', 'P-4001', 18, 6)],
      blockers: [
        {
          id: 'B-STOCK',
          type: 'stock',
          origin: 'erp',
          status: 'open',
          reason: 'Clos Mirador Gran Reserva 2018 · 150 cl: pedidas 12 unidades, disponibles 4.',
          decider: 'customer',
        },
      ],
      stockReview: {
        lineId: 'L1',
        firstCheckAt: h(-6),
        availableAtFirstCheck: 4,
        options: [
          {
            id: 'opt-partial',
            kind: 'partial',
            title: 'Enviar 4 ahora y 8 en una segunda entrega',
            detail: `Próxima entrada prevista: ${fmtDayMonth(receiptDate)} (fecha de Compras, no confirmada). La segunda entrega añade un transporte.`,
            targetSku: 'P-2002',
            targetQuantity: 4,
            backorderQty: 8,
          },
          {
            id: 'opt-vintage',
            kind: 'vintage',
            title: 'Cambiar a la añada 2019 (mismo vino y formato)',
            detail: 'Clos Mirador Gran Reserva 2019 · 150 cl · 20 disponibles. Mismo precio de tarifa. El coste estándar de la 2019 todavía no está cargado.',
            targetSku: 'P-2003',
            targetQuantity: 12,
            simulatedCompetingReservation: 4,
          },
          {
            id: 'opt-format',
            kind: 'format',
            title: 'Cambiar a 75 cl (misma añada 2018)',
            detail: '24 botellas de 75 cl equivalen a 12 mágnum. 60 disponibles. Importe a tarifa: 660 € frente a 696 €.',
            targetSku: 'P-2004',
            targetQuantity: 24,
            simulatedCompetingReservation: 6,
          },
          {
            id: 'opt-later',
            kind: 'later',
            title: 'Entregar todo el pedido en la próxima entrada',
            detail: `Fecha prevista ${fmtDayMonth(receiptDate)} (no confirmada). Todo el pedido se aplaza.`,
            targetSku: 'P-2002',
            targetQuantity: 12,
            newDeliveryDate: dayAfter(receiptDate),
          },
        ],
      },
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
    },

    // ---------- Escenario 5: merchandising ----------
    {
      id: 'PV-26-018662',
      scenarioId: 's5',
      company: 'PM',
      customerId: 'C-12018',
      channel: 'vendor',
      stage: 'erp_confirmed',
      erpNumber: 'PV-26-018662',
      receivedAt: h(-26),
      owner: 'Ana Ruiz',
      requestedDeliveryDate: bd(4),
      deliveryAddressId: 'A1',
      source: {
        channel: 'vendor',
        from: 'Vendor App — Pau Serra (comercial)',
        fromAddress: 'Pedido introducido en visita',
        receivedAt: h(-26),
        segments: [
          { text: 'Inauguración de la nueva sección de vinos en Vall Fresca Lleida Centre. ' },
          { id: 'ev-merch', text: 'Necesitan 2 expositores de suelo, 6 cubiteras y 2 packs de posavasos para el día de la apertura' },
          { text: ', junto con el pedido de vino.' },
        ],
        attachments: [],
      },
      fields: [],
      lines: [
        line('L1', 'P-3001', 60, 9),
        line('L2', 'P-3002', 60, 9),
        line('L3', 'P-1001', 48, 9),
        line('L4', 'M-02', 2, 0, { evidenceId: 'ev-merch' }),
        line('L5', 'M-01', 6, 0, { evidenceId: 'ev-merch' }),
        line('L6', 'M-03', 2, 0, { evidenceId: 'ev-merch' }),
      ],
      blockers: [
        {
          id: 'B-MERCH',
          type: 'merchandising',
          origin: 'erp',
          status: 'open',
          reason: 'El pedido incluye material promocional que necesita comprobar disponibilidad y aprobación antes de liberar.',
          decider: 'trade_marketing',
        },
      ],
      merch: {
        approvals: { A: 'auto', B: 'pending', C: 'pending' },
        shortfall: { lineId: 'L4', requested: 2, available: 1 },
        budget: { quarterly: 1500, used: 1020 },
      },
      deal: { paymentTermsRequestedDays: 60, approval: { status: 'not_needed' } },
    },

    // ---------- Escenario 6: pedido de cliente nuevo (WhatsApp) ----------
    {
      id: 'REQ-1047',
      scenarioId: 's6',
      company: 'PM',
      onboardingId: 'ALTA-0042',
      customerNameAsWritten: 'Bodega Urbana Gràcia',
      channel: 'whatsapp',
      stage: 'draft',
      receivedAt: m(-95),
      owner: 'Ana Ruiz',
      requestedDeliveryDate: nextTuesday,
      deliveryZone: 'BCN',
      deliveryAddressText: 'Carrer de Verdi 52, 08012 Barcelona',
      source: {
        channel: 'whatsapp',
        from: 'Marc — Bodega Urbana Gràcia',
        fromAddress: '+34 600 000 042 (número de demo)',
        receivedAt: m(-95),
        segments: [
          { text: '¡Hola! Soy Marc, de Bodega Urbana Gràcia. Jordi nos ha dicho que os podemos pedir por aquí 🙂' },
          { text: '\n\n' },
          { text: 'Para la apertura necesitamos: ' },
          { id: 'ev-w1', text: '3 cajas de Clos Mirador crianza' },
          { text: ', ' },
          { id: 'ev-w2', text: '2 de Mas Roure' },
          { text: ' y ' },
          { id: 'ev-w3', text: '2 de Finca Alba brut' },
          { text: '\n\n' },
          { text: '¿Nos lo podéis traer ' },
          { id: 'ev-wdate', text: 'la semana que viene' },
          { text: '? ' },
          { id: 'ev-waddr', text: 'C/ Verdi 52' },
        ],
        attachments: [
          {
            id: 'att-w',
            name: 'foto_pedido.jpg',
            kind: 'photo_note',
            sizeLabel: '1,2 MB',
            handwritten: [
              { text: 'Pedido apertura' },
              { id: 'ev-w1', text: '3 cj Clos Mirador crianza' },
              { id: 'ev-w2', text: '2 cj Mas Roure' },
              { id: 'ev-w3', text: '2 cj Finca Alba brut' },
              { text: 'Verdi 52 — Marc' },
            ],
          },
        ],
      },
      capture: { draftId: 'CAP-7744', capturedAt: m(-92), customerMatch: 'Sin coincidencia con cliente activo', overallConfidence: 'baja' },
      fields: [
        {
          key: 'customer',
          label: 'Cliente',
          value: 'Bodega Urbana Gràcia — sin cuenta activa',
          confidence: 'baja',
          note: 'No hay ningún cliente activo con este nombre. Existe una cuenta inactiva parecida (C-10482). Alta en curso: ALTA-0042.',
          confirmed: false,
        },
        { key: 'deliveryAddress', label: 'Dirección de entrega', value: 'Carrer de Verdi 52, 08012 Barcelona', confidence: 'media', evidenceId: 'ev-waddr', note: 'Dirección escrita de forma abreviada; se ha completado con el código postal.', confirmed: false },
        {
          key: 'deliveryDate',
          label: 'Fecha de entrega solicitada',
          value: fmtDayMonth(nextTuesday),
          confidence: 'baja',
          evidenceId: 'ev-wdate',
          note: '«La semana que viene» no indica día. Se propone el primer día de reparto de la zona.',
          confirmed: false,
        },
      ],
      lines: [
        line('L1', 'P-2001', 18, 0, { evidenceId: 'ev-w1' }),
        line('L2', 'P-4001', 12, 0, { evidenceId: 'ev-w2' }),
        line('L3', 'P-1001', 12, 0, { evidenceId: 'ev-w3' }),
      ],
      blockers: [
        {
          id: 'B-NEW',
          type: 'new_customer',
          origin: 'workspace',
          status: 'open',
          reason: 'El cliente aún no existe en el ERP. El pedido no puede enviarse hasta crear la cuenta (alta ALTA-0042).',
          decider: 'cs',
        },
      ],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
    },

    // ---------- Elementos de contexto (no forman parte de los seis escenarios) ----------
    {
      id: 'PV-26-018640',
      company: 'PM',
      customerId: 'C-11950',
      channel: 'edi',
      stage: 'released',
      erpNumber: 'PV-26-018640',
      receivedAt: h(-4),
      requestedDeliveryDate: bd(2),
      deliveryAddressId: 'A1',
      source: {
        channel: 'edi',
        from: 'EDI — mensaje ORDERS',
        fromAddress: 'Distribuciones Llevant · pedido de compra 4500918832',
        receivedAt: h(-4),
        segments: [{ text: 'Mensaje EDI recibido y validado.\n3 líneas · Entrega solicitada en 2 días laborables.\nLiberado automáticamente por el ERP (sin bloqueos).' }],
        attachments: [],
      },
      fields: [],
      lines: [line('L1', 'P-3001', 180, 12), line('L2', 'P-3002', 120, 12), line('L3', 'P-5001', 60, 12)],
      blockers: [],
      deal: { paymentTermsRequestedDays: 60, approval: { status: 'not_needed' } },
      releasedAt: h(-4),
    },
    {
      id: 'PV-26-018612',
      company: 'JC',
      customerId: 'C-10120',
      channel: 'vendor',
      stage: 'released',
      erpNumber: 'PV-26-018612',
      receivedAt: h(-7),
      owner: 'Logística JC',
      requestedDeliveryDate: bd(2),
      deliveryAddressId: 'A1',
      source: {
        channel: 'vendor',
        from: 'Vendor App — equipo comercial JC',
        fromAddress: 'Pedido introducido en visita',
        receivedAt: h(-7),
        segments: [{ text: 'Pedido estándar de reposición. Liberado automáticamente.' }],
        attachments: [],
      },
      fields: [],
      lines: [line('L1', 'P-1001', 60, 6), line('L2', 'P-2004', 12, 6)],
      blockers: [],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
      releasedAt: h(-7),
    },
    {
      id: 'REQ-1045',
      company: 'PM',
      customerId: 'C-12190',
      channel: 'email',
      stage: 'draft',
      receivedAt: m(-25),
      requestedDeliveryDate: bd(5),
      deliveryAddressId: 'A1',
      source: {
        channel: 'email',
        from: 'Bar del Club — Cala Serena',
        fromAddress: 'bar@calaserena.example',
        to: 'pedidos-pm@empresa.example',
        subject: 'Pedido fin de temporada',
        receivedAt: m(-25),
        segments: [
          { text: 'Buenos días,\n\nPara el cierre de temporada necesitamos ' },
          { id: 'ev-c1', text: '4 cajas de Finca Alba Brut Reserva' },
          { text: ', ' },
          { id: 'ev-c2', text: '4 de Costa Lumen rosado' },
          { text: ' y ' },
          { id: 'ev-c3', text: '2 de vermut Riera Roig' },
          { text: '.\nEntrega ' },
          { id: 'ev-cdate', text: 'cuando podáis la semana que viene' },
          { text: ', en el bar del puerto.\n\nSaludos.' },
        ],
        attachments: [],
      },
      capture: { draftId: 'CAP-7740', capturedAt: m(-23), customerMatch: 'Remitente registrado', overallConfidence: 'alta' },
      fields: [
        { key: 'customer', label: 'Cliente', value: 'Club Náutico Cala Serena (C-12190)', confidence: 'alta', confirmed: true },
        { key: 'deliveryAddress', label: 'Dirección de entrega', value: "Bar del puerto — Passeig Marítim 3, 07157 Port d'Andratx", confidence: 'alta', confirmed: true },
        { key: 'deliveryDate', label: 'Fecha de entrega solicitada', value: 'Semana próxima (sin día)', confidence: 'media', evidenceId: 'ev-cdate', note: 'Se propone el primer día con salida a Baleares.', confirmed: false },
      ],
      lines: [line('L1', 'P-1001', 24, 5, { evidenceId: 'ev-c1' }), line('L2', 'P-3002', 24, 5, { evidenceId: 'ev-c2' }), line('L3', 'P-5001', 12, 5, { evidenceId: 'ev-c3' })],
      blockers: [],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
    },
    {
      id: 'PV-26-018598',
      company: 'PM',
      customerId: 'C-10377',
      channel: 'email',
      stage: 'dispatched',
      erpNumber: 'PV-26-018598',
      receivedAt: h(-72),
      requestedDeliveryDate: bd(-1),
      deliveryAddressId: 'A1',
      fields: [],
      lines: [line('L1', 'P-2001', 36, 5), line('L2', 'P-1001', 24, 5)],
      blockers: [],
      deal: { paymentTermsRequestedDays: 30, approval: { status: 'not_needed' } },
      shipmentId: 'ENV-26-004498',
      releasedAt: h(-60),
    },
    {
      id: 'PV-26-018571',
      company: 'PM',
      customerId: 'C-10918',
      channel: 'vendor',
      stage: 'delivered',
      erpNumber: 'PV-26-018571',
      receivedAt: h(-96),
      requestedDeliveryDate: bd(-1),
      deliveryAddressId: 'A1',
      fields: [],
      lines: [line('L1', 'P-2001', 48, 7), line('L2', 'P-3001', 36, 7)],
      blockers: [],
      deal: { paymentTermsRequestedDays: 45, approval: { status: 'not_needed' } },
      shipmentId: 'ENV-26-004490',
      releasedAt: h(-80),
    },
  ];

  const shipments: Shipment[] = [
    {
      id: 'ENV-26-004498',
      orderIds: ['PV-26-018598'],
      customerId: 'C-10377',
      addressId: 'A1',
      createdAt: h(-40),
      status: 'dispatched',
      lines: [
        { orderId: 'PV-26-018598', sku: 'P-2001', quantity: 36 },
        { orderId: 'PV-26-018598', sku: 'P-1001', quantity: 24 },
      ],
      instructions: [],
      exceptions: [],
      carrier: 'Transportes Ejemplo (simulado)',
      requestedDate: bd(-1),
      lastUpdateAt: h(-27),
      carrierUpdateMissing: true,
      dispatchedAt: h(-30),
      tracking: { token: 'T4498QX7M', url: 'https://seguimiento.ejemplo.invalid/t/T4498QX7M', createdAt: h(-40) },
    },
    {
      id: 'ENV-26-004490',
      orderIds: ['PV-26-018571'],
      customerId: 'C-10918',
      addressId: 'A1',
      createdAt: h(-50),
      status: 'delivered',
      lines: [
        { orderId: 'PV-26-018571', sku: 'P-2001', quantity: 48 },
        { orderId: 'PV-26-018571', sku: 'P-3001', quantity: 36 },
      ],
      instructions: [],
      exceptions: [],
      carrier: 'Transportes Ejemplo (simulado)',
      requestedDate: bd(-1),
      confirmedDelivery: { date: h(-22), window: '10:00–12:00', source: 'Confirmado por el transportista' },
      lastUpdateAt: h(-22),
      dispatchedAt: h(-30),
      deliveredAt: h(-22),
      tracking: { token: 'T4490LK2P', url: 'https://seguimiento.ejemplo.invalid/t/T4490LK2P', createdAt: h(-50) },
    },
  ];

  const claims: Claim[] = [
    {
      id: 'INC-0107',
      createdAt: h(-3),
      customerId: 'C-10918',
      orderId: 'PV-26-018571',
      shipmentId: 'ENV-26-004490',
      channel: 'tracking_page',
      type: 'damaged',
      items: [{ sku: 'P-2001', quantity: 2 }],
      description: 'Dos botellas de Clos Mirador Crianza llegaron rotas; la caja estaba mojada al recibirla.',
      evidence: [{ name: 'foto_caja_dañada.jpg', kind: 'photo', sample: true }],
      contact: 'Recepción Hotel Les Dunes',
      owner: 'Pablo Martín',
      status: 'new',
      nextAction: 'Revisar las fotos y pedir al almacén que confirme cómo salió el embalaje.',
      proposals: [],
    },
  ];

  const enquiries: Enquiry[] = [
    {
      id: 'CON-0311',
      customerId: 'C-10377',
      orderId: 'PV-26-018598',
      shipmentId: 'ENV-26-004498',
      channel: 'whatsapp',
      receivedAt: m(-50),
      message: {
        channel: 'whatsapp',
        from: 'Restaurante Sal y Brasa',
        fromAddress: '+34 600 000 377 (número de demo)',
        receivedAt: m(-50),
        segments: [{ text: 'Buenos días, ¿sabéis cuándo llega el pedido? Lo esperábamos ayer y hoy tenemos un evento por la noche.' }],
        attachments: [],
      },
      status: 'open',
      replyDraft:
        'Hola, gracias por escribirnos. Tu pedido PV-26-018598 salió de nuestro almacén ayer con el transportista. Todavía no nos ha confirmado la hora de entrega: le hemos pedido una actualización y te escribimos en cuanto la tengamos. Puedes seguirlo aquí: [enlace de seguimiento].',
    },
  ];

  const onboarding: OnboardingCase[] = [
    {
      id: 'ALTA-0042',
      scenarioId: 's6',
      company: 'PM',
      prospectName: 'Bodega Urbana Gràcia',
      owner: 'Ana Ruiz',
      requestedBy: 'Jordi Puig (comercial)',
      createdAt: h(-2),
      linkedOrderId: 'REQ-1047',
      customerData: {},
      salesData: {
        accountOwner: 'Jordi Puig',
        segment: 'Horeca — bar de vinos',
        priceList: 'Tarifa Horeca 2026',
        proposedPaymentTerms: '30 días',
        proposedCreditLimit: '6.000 €',
        expectedMonthlyVolume: '≈ 1.200 € / mes',
        notes: 'Bar de vinos nuevo en Gràcia. El primer pedido ya ha llegado por WhatsApp.',
      },
      internal: {},
      finance: { status: 'not_requested' },
      status: 'draft',
    },
    {
      id: 'ALTA-0039',
      company: 'PM',
      prospectName: 'Celler Nou Horitzó',
      owner: 'Pablo Martín',
      requestedBy: 'Marta Gil (comercial)',
      createdAt: h(-24 * 3 - 2),
      invite: { token: 'K8RD2M', url: 'https://altas.ejemplo.invalid/f/K8RD2M', createdAt: h(-24 * 3), expiresAt: h(24 * 4) },
      customerData: {},
      salesData: { accountOwner: 'Marta Gil', segment: 'Tienda especializada', priceList: 'Tarifa Tiendas 2026', proposedPaymentTerms: '30 días' },
      internal: {},
      finance: { status: 'not_requested' },
      status: 'waiting_customer',
    },
  ];

  const events: TimelineEvent[] = [];
  let ec = 0;
  const ev = (entityId: string, at: string, actor: Role, kind: TimelineEvent['kind'], text: string, actorName?: string) =>
    events.push({ id: `E${++ec}`, entityId, at, actor, kind, text, actorName });

  ev('REQ-1042', m(-42), 'customer', 'message', 'Email recibido en el buzón de pedidos con 1 adjunto.', 'Sergio — El Faro Azul');
  ev('REQ-1042', m(-40), 'capture', 'system', 'Borrador CAP-7731 preparado a partir del email y el PDF. 3 datos marcados para revisar.');
  ev('REQ-1042', m(-38), 'system', 'system', 'Asignado a Ana Ruiz por cartera de cliente.');
  ev('PV-26-018702', h(-20), 'erp', 'system', 'Pedido creado desde Mi PM y liberado automáticamente.');
  ev('PV-26-018690', h(-3), 'erp', 'system', 'Pedido creado desde Vendor App.');
  ev('PV-26-018690', h(-3), 'erp', 'system', 'Retenido: el campo «Observaciones» no está vacío.');
  ev('PV-26-018655', h(-5), 'erp', 'system', 'Pedido creado desde Mi PM.');
  ev('PV-26-018655', h(-5), 'erp', 'system', 'Retenido por límite de crédito.');
  ev('PV-26-018655', h(-5), 'system', 'system', 'Comprobación propuesta: condiciones fuera del acuerdo comercial detectadas.');
  ev('PV-26-018671', h(-6), 'erp', 'system', 'Pedido creado desde Vendor App.');
  ev('PV-26-018671', h(-6), 'erp', 'system', 'Retenido: Clos Mirador Gran Reserva 2018 · 150 cl sin stock suficiente (4 de 12).');
  ev('PV-26-018662', h(-26), 'erp', 'system', 'Pedido creado desde Vendor App con 3 líneas de material promocional.');
  ev('PV-26-018662', h(-26), 'erp', 'system', 'Retenido por merchandising.');
  ev('REQ-1047', m(-95), 'customer', 'message', 'Mensaje de WhatsApp recibido con una foto.', 'Marc — Bodega Urbana Gràcia');
  ev('REQ-1047', m(-92), 'capture', 'system', 'Borrador CAP-7744 preparado. Cliente no encontrado en el ERP.');
  ev('ALTA-0042', h(-2), 'sales', 'action', 'Solicita el alta de Bodega Urbana Gràcia y aporta los datos comerciales.', 'Jordi Puig');
  ev('ALTA-0042', m(-90), 'system', 'system', 'Vinculado al borrador de pedido REQ-1047 (WhatsApp).');
  ev('ALTA-0039', h(-24 * 3), 'cs', 'action', 'Enlace de alta generado (simulado). Pendiente de que el cliente lo complete.', 'Pablo Martín');
  ev('PV-26-018640', h(-4), 'erp', 'system', 'Pedido EDI recibido, validado y liberado automáticamente.');
  ev('PV-26-018612', h(-7), 'erp', 'system', 'Pedido liberado automáticamente. En JC el envío de almacén lo prepara Logística.');
  ev('REQ-1045', m(-25), 'customer', 'message', 'Email recibido en el buzón de pedidos.', 'Bar del Club — Cala Serena');
  ev('REQ-1045', m(-23), 'capture', 'system', 'Borrador CAP-7740 preparado. 1 dato marcado para revisar.');
  ev('ENV-26-004498', h(-30), 'warehouse', 'system', 'Expedido con Transportes Ejemplo.');
  ev('ENV-26-004498', h(-27), 'carrier', 'system', 'Última actualización del transportista: «En reparto — centro de Barcelona».');
  ev('PV-26-018598', h(-30), 'warehouse', 'system', 'Envío ENV-26-004498 expedido.');
  ev('ENV-26-004490', h(-22), 'carrier', 'system', 'Entrega confirmada por el transportista.');
  ev('PV-26-018571', h(-22), 'carrier', 'system', 'Entrega confirmada (ENV-26-004490).');
  ev('INC-0107', h(-3), 'customer', 'message', 'Problema reportado desde la página de seguimiento con 1 foto.', 'Recepción Hotel Les Dunes');
  ev('INC-0107', h(-3), 'system', 'system', 'Incidencia asignada a Pablo Martín.');
  ev('CON-0311', m(-50), 'customer', 'message', 'Consulta de entrega recibida por WhatsApp.', 'Restaurante Sal y Brasa');

  const toMap = <T extends { id: string }>(arr: T[]) => Object.fromEntries(arr.map((x) => [x.id, x])) as Record<string, T>;

  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    customers: toMap(customers),
    products: productMap,
    stock: {
      'P-1001': 600,
      'P-2001': 340,
      'P-2002': 4,
      'P-2003': 20,
      'P-2004': 60,
      'P-3001': 420,
      'P-3002': 380,
      'P-4001': 260,
      'P-5001': 150,
      'M-01': 40,
      'M-02': 1,
      'M-03': 30,
    },
    orders: toMap(orders),
    shipments: toMap(shipments),
    claims: toMap(claims),
    enquiries: toMap(enquiries),
    onboarding: toMap(onboarding),
    events,
    // Siguiente número disponible de cada serie.
    counters: { erp: 18734, shipment: 4512, claim: 108, customer: 20931, event: ec },
    currentUser: { name: 'Ana Ruiz', role: 'cs', team: 'Atención al Cliente PM' },
  };
}
