// Interfaces de integración. En el prototipo TODAS se implementan con simulaciones locales
// (src/services/mock). Cada interfaz marca el punto donde, en producción, se conectaría un
// servicio aprobado. Ver docs/INTEGRACION.md.

import type { ErpCreateResult } from '../domain/ops';
import type { ShipmentProposal } from '../domain/shipment';
import type {
  BlockerType,
  Channel,
  Confidence,
  DuplicateCandidate,
  ExtractedField,
  OnboardingCustomerData,
  Order,
  Role,
  SourceMessage,
} from '../domain/types';

/**
 * Contrato PROPUESTO para la salida de la capa de captura de pedidos que está construyendo Toni.
 * Este espacio de trabajo no lee buzones ni WhatsApp: recibe borradores ya estructurados.
 */
export interface CapturedOrderDraft {
  draftId: string;
  capturedAt: string;
  channel: Channel;
  /** Mensaje original y adjuntos, con marcas de evidencia para cada dato extraído. */
  source: SourceMessage;
  customerCandidate?: { customerId: string; confidence: Confidence; reason: string };
  fields: ExtractedField[];
  lines: { sku: string; quantity: number; evidenceId?: string; uncertainty?: { field: string; note: string; confidence: Confidence } }[];
}

export interface OrderCaptureFeed {
  /** Borradores pendientes de revisión (en el prototipo vienen precargados en los datos de demo). */
  listPendingDrafts(): Promise<CapturedOrderDraft[]>;
  /** Devuelve a la capa de captura el resultado de la revisión, para trazabilidad y mejora. */
  reportOutcome(draftId: string, outcome: 'approved' | 'rejected', corrections: number): Promise<void>;
}

export interface ErpGateway {
  /** Crea el pedido de venta en Navision y devuelve el resultado de las comprobaciones automáticas. */
  createSalesOrder(order: Order): Promise<ErpCreateResult>;
  /** Pide al ERP que libere un pedido ya revisado; el ERP repite sus comprobaciones. */
  releaseOrder(order: Order): Promise<{ ok: boolean; detail: string }>;
  /** Crea la ficha de cliente con las dimensiones contables asignadas. */
  createCustomer(caseId: string): Promise<{ customerId: string }>;
}

export interface InventoryService {
  checkAvailability(lines: { sku: string; quantity: number }[]): Promise<{ sku: string; requested: number; available: number; ok: boolean }[]>;
}

export interface ApprovalService {
  /** Enruta una solicitud de aprobación a un rol (crédito, excepción comercial, merchandising…). */
  requestApproval(input: { entityId: string; topic: BlockerType | 'onboarding_credit' | 'claim'; approver: Role; note: string }): Promise<{ requestId: string }>;
}

export interface WarehouseService {
  proposeShipment(orderId: string): Promise<ShipmentProposal>;
  confirmShipment(proposal: ShipmentProposal): Promise<{ accepted: boolean }>;
}

export interface SecureLinkService {
  /** Enlace firmado de un solo uso para que el cliente acceda sin usuario. En el prototipo NO es seguro. */
  createLink(purpose: 'tracking' | 'onboarding', entityId: string): Promise<{ token: string; url: string; expiresAt: string }>;
}

export interface CustomerDirectory {
  findDuplicates(data: Partial<OnboardingCustomerData>): Promise<DuplicateCandidate[]>;
}

export interface MessagingService {
  /** Prepara un mensaje al cliente. En el prototipo nunca se envía. */
  prepareDraft(input: { channel: Channel; to: string; body: string }): Promise<{ draftId: string; sent: false }>;
}

export interface Services {
  capture: OrderCaptureFeed;
  erp: ErpGateway;
  inventory: InventoryService;
  approvals: ApprovalService;
  warehouse: WarehouseService;
  links: SecureLinkService;
  directory: CustomerDirectory;
  messaging: MessagingService;
}
