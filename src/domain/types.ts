// Modelo de dominio del prototipo. Todos los datos son sintéticos.

export type Company = 'PM' | 'JC';

export type Role =
  | 'cs' // Atención al Cliente
  | 'finance' // Finanzas
  | 'sales' // Comercial responsable de la cuenta
  | 'sales_manager' // Jefe/a de ventas de zona
  | 'commercial_mgmt' // Dirección comercial
  | 'logistics' // Logística
  | 'warehouse' // Almacén
  | 'trade_marketing' // Trade Marketing
  | 'customer' // Cliente
  | 'carrier' // Transportista
  | 'capture' // Capa de captura de pedidos (en desarrollo, Toni)
  | 'erp' // ERP (Navision) simulado
  | 'system'; // Espacio de trabajo

export type Channel = 'email' | 'whatsapp' | 'vendor' | 'edi' | 'mipm' | 'tracking_page' | 'sales_request';

export type Confidence = 'alta' | 'media' | 'baja';

export type OrderStage =
  | 'draft' // Borrador preparado
  | 'approved' // Aprobado por Atención al Cliente (aún no está en el ERP)
  | 'erp_confirmed' // Confirmado en ERP (puede estar retenido)
  | 'released' // Liberado para preparar envío
  | 'shipment_prepared' // Envío de almacén preparado
  | 'dispatched' // Expedido
  | 'delivered'; // Entregado

export type BlockerType = 'observations' | 'credit' | 'merchandising' | 'new_customer' | 'stock' | 'commercial';

export type BlockerStatus = 'open' | 'waiting' | 'resolved';

export interface Blocker {
  id: string;
  type: BlockerType;
  /** 'erp' = bloqueo actual de Navision. 'workspace' = comprobación propuesta del nuevo espacio de trabajo. */
  origin: 'erp' | 'workspace';
  status: BlockerStatus;
  reason: string;
  decider: Role;
  waitingOn?: Role;
  resolution?: string;
  resolvedBy?: Role;
  resolvedAt?: string;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  postalCode: string;
  city: string;
  zone: string;
}

export interface StandardInstruction {
  text: string;
  since: string;
  seenIn: string;
}

export interface CreditProfile {
  limit: number;
  balanceNotDue: number;
  overdue: number;
  oldestOverdueDays: number;
  insurerCoverage: number;
  lastPayment: { date: string; amount: number };
  averageDaysToPay: number;
}

export interface Agreement {
  name: string;
  validUntil: string;
  defaultDiscountPct: number;
  discountsBySku: Record<string, number>;
  freeGoodsPer12: Record<string, number>;
  paymentTermsDays: number;
}

export interface Customer {
  id: string;
  scenarioId?: ScenarioId;
  name: string;
  legalName: string;
  taxId: string;
  company: Company;
  segment: string;
  salesRep: string;
  addresses: Address[];
  standardInstructions: StandardInstruction[];
  agreement: Agreement;
  credit: CreditProfile;
  status: 'active' | 'blocked';
  statusNote?: string;
  contactName?: string;
}

export type ProductKind = 'wine' | 'merch';
export type MerchCategory = 'A' | 'B' | 'C';

export interface Product {
  sku: string;
  name: string;
  kind: ProductKind;
  style?: string;
  vintage?: number | 'Sin añada';
  format?: string;
  unitsPerCase: number;
  listPrice: number;
  /** Coste estándar sintético. `null` = coste no disponible (provoca «Cálculo incompleto»). */
  unitCost: number | null;
  merchCategory?: MerchCategory;
  /** Fecha prevista de la próxima entrada de mercancía (sintética, no confirmada). */
  nextReceipt?: { date: string; quantity: number };
}

export interface LineUncertainty {
  field: 'vintage' | 'format' | 'quantity' | 'product' | 'price';
  note: string;
  confidence: Confidence;
  confirmed: boolean;
}

export interface OrderLine {
  id: string;
  sku: string;
  quantity: number;
  /** Descuento solicitado por el cliente o el comercial. */
  requestedDiscountPct: number;
  /** Descuento según el acuerdo comercial vigente. */
  agreementDiscountPct: number;
  freeUnits: number;
  agreementFreeUnits: number;
  evidenceId?: string;
  uncertainty?: LineUncertainty;
  /** Cantidad pendiente para una entrega posterior (entrega parcial aceptada). */
  backorderQty?: number;
  substitution?: { fromSku: string; fromQuantity: number; acceptedBy: string; acceptedVia: string; acceptedAt: string };
}

export interface ExtractedField {
  key: string;
  label: string;
  value: string;
  confidence: Confidence;
  evidenceId?: string;
  note?: string;
  confirmed: boolean;
}

export interface MessageSegment {
  id?: string;
  text: string;
}

export interface AttachmentRow {
  id?: string;
  cells: string[];
}

export interface Attachment {
  id: string;
  name: string;
  kind: 'pdf_order' | 'photo_note' | 'photo_damage';
  sizeLabel: string;
  title?: string;
  header?: string[];
  rows?: AttachmentRow[];
  handwritten?: MessageSegment[];
  footer?: string;
}

export interface SourceMessage {
  channel: Channel;
  from: string;
  fromAddress: string;
  to?: string;
  subject?: string;
  receivedAt: string;
  segments: MessageSegment[];
  attachments: Attachment[];
}

export interface CaptureMeta {
  draftId: string;
  capturedAt: string;
  customerMatch: string;
  overallConfidence: Confidence;
}

export type ObservationKind = 'standard_repeat' | 'one_off_delivery' | 'commercial' | 'other';

export interface ObservationSegment {
  id: string;
  text: string;
  suggestion: ObservationKind;
  basis: string[];
  classification?: ObservationKind;
  structured?: { address: string; date: string; window: string; contact: string };
}

export interface ObservationConflict {
  id: string;
  /** Solo aplica si el segmento indicado se clasifica como cambio puntual. */
  segmentId: string;
  title: string;
  detail: string;
  options: { id: string; label: string; consequence: string }[];
  chosen?: string;
}

export interface ObservationReview {
  originalNote: string;
  segments: ObservationSegment[];
  conflicts: ObservationConflict[];
}

export type FinanceDecision = 'approved' | 'approved_conditions' | 'rejected';

export interface CreditReview {
  requestedAt?: string;
  requestNote?: string;
  decision?: FinanceDecision;
  decisionNote?: string;
  decidedAt?: string;
  informedAt?: string;
}

export type StockOptionKind = 'partial' | 'vintage' | 'format' | 'later';

export interface StockOption {
  id: string;
  kind: StockOptionKind;
  title: string;
  detail: string;
  /** Línea resultante si se aplica la opción. */
  targetSku: string;
  targetQuantity: number;
  backorderQty?: number;
  newDeliveryDate?: string;
  /** Unidades que el ERP simulado reserva para otro pedido mientras se espera la respuesta del cliente. */
  simulatedCompetingReservation?: number;
}

export interface StockReview {
  lineId: string;
  firstCheckAt: string;
  availableAtFirstCheck: number;
  options: StockOption[];
  selectedOptionId?: string;
  proposalPreparedAt?: string;
  proposalText?: string;
  acceptance?: { optionId: string; by: string; via: string; at: string };
  appliedAt?: string;
  secondCheck?: { at: string; ok: boolean; results: { sku: string; requested: number; available: number; ok: boolean }[] };
}

export type ApprovalStatus = 'auto' | 'pending' | 'requested' | 'approved' | 'rejected';

export interface MerchReview {
  approvals: Record<MerchCategory, ApprovalStatus | 'not_needed'>;
  shortfall?: { lineId: string; requested: number; available: number; decision?: 'split' | 'reduce' | 'wait' };
  budget: { quarterly: number; used: number };
}

export interface DealTerms {
  paymentTermsRequestedDays: number;
  approval: { status: 'not_needed' | 'needed' | 'requested' | 'approved' | 'rejected'; requestedAt?: string; decidedAt?: string; note?: string };
  timeWindowService?: boolean;
}

export interface StructuredDelivery {
  address?: string;
  date?: string;
  window?: string;
  contact?: string;
  carrierNote?: string;
}

export interface Order {
  id: string;
  scenarioId?: ScenarioId;
  company: Company;
  customerId?: string;
  onboardingId?: string;
  customerNameAsWritten?: string;
  channel: Channel;
  stage: OrderStage;
  erpNumber?: string;
  receivedAt: string;
  owner?: string;
  requestedDeliveryDate: string;
  deliveryAddressId?: string;
  /** Zona de transporte cuando el cliente aún no tiene ficha (alta en curso). */
  deliveryZone?: string;
  /** Dirección escrita por el cliente cuando no existe ficha. */
  deliveryAddressText?: string;
  customerReference?: string;
  source?: SourceMessage;
  capture?: CaptureMeta;
  fields: ExtractedField[];
  lines: OrderLine[];
  blockers: Blocker[];
  observation?: ObservationReview;
  credit?: CreditReview;
  stockReview?: StockReview;
  merch?: MerchReview;
  deal: DealTerms;
  structuredDelivery?: StructuredDelivery;
  shipmentId?: string;
  approvedAt?: string;
  releasedAt?: string;
}

export interface TimelineEvent {
  id: string;
  entityId: string;
  at: string;
  actor: Role;
  actorName?: string;
  kind: 'system' | 'decision' | 'action' | 'message' | 'demo';
  text: string;
}

export interface ShipmentException {
  id: string;
  title: string;
  detail: string;
  options: { id: string; label: string }[];
  chosen?: string;
}

export type ShipmentStatus = 'prepared' | 'dispatched' | 'delivered';

export interface Shipment {
  id: string;
  scenarioId?: ScenarioId;
  orderIds: string[];
  customerId: string;
  addressId: string;
  createdAt: string;
  status: ShipmentStatus;
  lines: { orderId: string; sku: string; quantity: number }[];
  instructions: string[];
  exceptions: ShipmentException[];
  carrier: string;
  requestedDate: string;
  confirmedDelivery?: { date: string; window?: string; source: string };
  lastUpdateAt: string;
  carrierUpdateMissing?: boolean;
  dispatchedAt?: string;
  deliveredAt?: string;
  tracking: { token: string; url: string; createdAt: string };
}

export type ClaimType = 'missing' | 'damaged' | 'wrong' | 'other';

export interface Claim {
  id: string;
  scenarioId?: ScenarioId;
  createdAt: string;
  customerId: string;
  orderId: string;
  shipmentId: string;
  channel: Channel;
  type: ClaimType;
  items: { sku: string; quantity: number }[];
  description: string;
  evidence: { name: string; kind: 'photo' | 'note'; sample: boolean }[];
  contact: string;
  owner: string;
  status: 'new' | 'investigating' | 'proposal_pending' | 'resolved';
  nextAction: string;
  warehouseCheck?: { requestedAt: string; result?: string };
  proposals: { id: string; kind: 'credit_note' | 'replacement'; status: 'requested' | 'approved' | 'rejected'; approver: Role; requestedAt: string }[];
}

export interface Enquiry {
  id: string;
  customerId: string;
  orderId: string;
  shipmentId: string;
  channel: Channel;
  receivedAt: string;
  message: SourceMessage;
  owner?: string;
  status: 'open' | 'answered';
  replyDraft: string;
  carrierRequestedAt?: string;
}

export interface OnboardingCustomerData {
  legalName: string;
  tradeName: string;
  taxId: string;
  fiscalAddress: string;
  billingEmail: string;
  paymentMethod: string;
  iban: string;
  deliveryAddress: string;
  deliveryHours: string;
  deliveryContact: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export interface OnboardingSalesData {
  accountOwner: string;
  segment: string;
  priceList: string;
  proposedPaymentTerms: string;
  proposedCreditLimit: string;
  expectedMonthlyVolume: string;
  notes: string;
}

export interface OnboardingInternalData {
  customerPostingGroup: string;
  vatPostingGroup: string;
  channelDimension: string;
  zoneDimension: string;
}

export interface DuplicateCandidate {
  customerId: string;
  name: string;
  taxId: string;
  address: string;
  status: string;
  score: number;
  reasons: string[];
}

export interface OnboardingCase {
  id: string;
  scenarioId?: ScenarioId;
  company: Company;
  prospectName: string;
  owner?: string;
  requestedBy: string;
  createdAt: string;
  linkedOrderId?: string;
  invite?: { token: string; url: string; createdAt: string; expiresAt: string };
  customerData: Partial<OnboardingCustomerData>;
  customerSubmittedAt?: string;
  salesData: Partial<OnboardingSalesData>;
  internal: Partial<OnboardingInternalData>;
  finance: {
    status: 'not_requested' | 'requested' | 'approved' | 'approved_changes' | 'rejected';
    creditLimit?: string;
    paymentTerms?: string;
    note?: string;
    requestedAt?: string;
    decidedAt?: string;
  };
  duplicateCheck?: { checkedAt: string; candidates: DuplicateCandidate[]; decision?: 'different' | 'same'; decisionNote?: string };
  createdCustomerId?: string;
  status: 'draft' | 'waiting_customer' | 'in_review' | 'created' | 'merged';
}

export type ScenarioId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6';

export interface DemoState {
  version: number;
  seededAt: string;
  customers: Record<string, Customer>;
  products: Record<string, Product>;
  stock: Record<string, number>;
  orders: Record<string, Order>;
  shipments: Record<string, Shipment>;
  claims: Record<string, Claim>;
  enquiries: Record<string, Enquiry>;
  onboarding: Record<string, OnboardingCase>;
  events: TimelineEvent[];
  counters: { erp: number; shipment: number; claim: number; customer: number; event: number };
  currentUser: { name: string; role: Role; team: string };
}
