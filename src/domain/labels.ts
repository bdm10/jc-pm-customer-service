import type { BlockerType, Channel, ClaimType, ObservationKind, OrderStage, Role, StockOptionKind } from './types';

export const ROLE_LABEL: Record<Role, string> = {
  cs: 'Atención al Cliente',
  finance: 'Finanzas',
  sales: 'Comercial de la cuenta',
  sales_manager: 'Jefe/a de ventas de zona',
  commercial_mgmt: 'Dirección comercial',
  logistics: 'Logística',
  warehouse: 'Almacén',
  trade_marketing: 'Trade Marketing',
  customer: 'Cliente',
  carrier: 'Transportista',
  capture: 'Capa de captura de pedidos',
  erp: 'ERP (Navision)',
  system: 'Espacio de trabajo',
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  vendor: 'Vendor App',
  edi: 'EDI',
  mipm: 'Mi PM (portal)',
  tracking_page: 'Página de seguimiento',
  sales_request: 'Solicitud del comercial',
};

export const BLOCKER_LABEL: Record<BlockerType, string> = {
  observations: 'Observaciones',
  credit: 'Límite de crédito',
  merchandising: 'Merchandising',
  new_customer: 'Cliente nuevo',
  stock: 'Sin stock',
  commercial: 'Excepción comercial',
};

export const STAGE_LABEL: Record<OrderStage, string> = {
  draft: 'Borrador preparado',
  approved: 'Aprobado',
  erp_confirmed: 'Confirmado en ERP',
  released: 'Liberado',
  shipment_prepared: 'Envío preparado',
  dispatched: 'Expedido',
  delivered: 'Entregado',
};

export const STAGE_ORDER: OrderStage[] = [
  'draft',
  'approved',
  'erp_confirmed',
  'released',
  'shipment_prepared',
  'dispatched',
  'delivered',
];

export const STAGE_HELP: Record<OrderStage, string> = {
  draft: 'La capa de captura ha preparado un borrador. Aún no existe en el ERP.',
  approved: 'Atención al Cliente ha revisado y aprobado el borrador. Aún falta que el ERP lo acepte.',
  erp_confirmed: 'El pedido existe en el ERP. Puede estar retenido hasta resolver los bloqueos.',
  released: 'Sin bloqueos: el pedido puede pasar a preparación de envío.',
  shipment_prepared: 'Se ha creado el envío de almacén. Falta picking, registro y salida.',
  dispatched: 'El pedido ha salido del almacén con el transportista.',
  delivered: 'El transportista ha confirmado la entrega.',
};

export const OBSERVATION_KIND_LABEL: Record<ObservationKind, string> = {
  standard_repeat: 'Instrucción habitual repetida',
  one_off_delivery: 'Cambio puntual de entrega',
  commercial: 'Condición comercial o de precio',
  other: 'Otra — requiere consulta',
};

export const OBSERVATION_KIND_HELP: Record<ObservationKind, string> = {
  standard_repeat: 'Ya está en la ficha del cliente. Se mantiene como instrucción de entrega; no requiere decisión.',
  one_off_delivery: 'Solo para este pedido. Se registra en campos estructurados y no modifica la ficha.',
  commercial: 'Afecta a precio, descuento o regalo. Se envía al comprobador de condiciones.',
  other: 'No encaja en las categorías anteriores. El pedido sigue retenido hasta consultarlo.',
};

export const STOCK_OPTION_LABEL: Record<StockOptionKind, string> = {
  partial: 'Entrega parcial',
  vintage: 'Cambio de añada',
  format: 'Cambio de formato',
  later: 'Fecha posterior',
};

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  missing: 'Falta producto',
  damaged: 'Producto dañado',
  wrong: 'Producto equivocado',
  other: 'Otro problema',
};

/** «Esperando a Finanzas», «Esperando al cliente»… con el artículo correcto. */
export function waitingOnText(role: Role): string {
  const special: Partial<Record<Role, string>> = {
    customer: 'Esperando al cliente',
    carrier: 'Esperando al transportista',
    sales: 'Esperando al comercial de la cuenta',
    warehouse: 'Esperando al almacén',
    erp: 'Esperando al ERP',
  };
  return special[role] ?? `Esperando a ${ROLE_LABEL[role]}`;
}
