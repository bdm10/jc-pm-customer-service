# Integración: qué está simulado y qué haría falta

El prototipo **no se conecta con ningún sistema**. Todas las llamadas pasan por las interfaces de
`src/services/types.ts` y se resuelven con implementaciones locales y deterministas en `src/services/mock/`
(con una latencia artificial de ~0,6–1 s para que se vea el estado «Consultando…»). Sustituir una simulación
por un servicio aprobado no debería requerir cambios en las pantallas: basta con otra implementación de la
interfaz en `src/state/store.tsx`.

## Interfaces

| Interfaz | Métodos | Simulación actual | Para producción |
| --- | --- | --- | --- |
| `OrderCaptureFeed` | `listPendingDrafts`, `reportOutcome` | Los borradores vienen precargados en los datos de demo; `reportOutcome` solo deja un evento en el historial. | Contrato con la capa de captura de Toni (abajo) y canal de retorno de correcciones. |
| `ErpGateway` | `createSalesOrder`, `releaseOrder`, `createCustomer` | Numeración local (PV-26-…, C-…), comprobaciones de crédito, stock, merchandising y cliente sobre los datos sintéticos. | Servicio aprobado de Navision para pedidos, bloqueos, liberación, clientes y dimensiones; permisos por rol. |
| `InventoryService` | `checkAvailability` | Existencias fijas en memoria; el escenario 4 simula una reserva de otro pedido. | Disponibilidad en tiempo real y fechas de entrada de Compras. |
| `ApprovalService` | `requestApproval` | Devuelve un identificador; las decisiones se toman con **controles de demo**. | Flujo de aprobación (Finanzas, Dirección comercial, Trade Marketing, Logística) con notificación y trazabilidad. |
| `WarehouseService` | `proposeShipment`, `confirmShipment` | Agrupación por cliente, dirección y fecha; excepciones de franja, cita previa, parciales y faltas. | Envíos de almacén de Navision (paso 3), reglas reales de agrupación y rutas. |
| `SecureLinkService` | `createLink` | Token aleatorio y dominio `.invalid`; sin firma ni caducidad real. | Enlaces firmados de un solo uso, caducidad, registro de accesos y RGPD. |
| `CustomerDirectory` | `findDuplicates` | Comparación simple de NIF, nombre (bigramas) y dirección. | Búsqueda en el maestro de clientes y, si procede, servicios de validación de NIF. |
| `MessagingService` | `prepareDraft` | Prepara un borrador; **nunca envía**. | Email / WhatsApp corporativo aprobado, plantillas, consentimiento. |

Además, fuera de interfaces:

- **Transportista:** expedición, silencio y confirmación de franja se simulan con controles de demo.
- **Persistencia:** `localStorage` del navegador (estado de demo y comentarios por separado).
- **Usuarios y permisos:** no implementados. No hay inicio de sesión ni control de acceso, y así se indica.

## Contrato propuesto con la capa de captura (Toni)

Este espacio de trabajo **no lee buzones ni WhatsApp**: consume borradores ya estructurados. Propuesta de
contrato mínimo (ver `CapturedOrderDraft` en `src/services/types.ts`):

```jsonc
{
  "draftId": "CAP-7731",
  "capturedAt": "2026-10-19T09:12:00Z",
  "channel": "email",                       // email | whatsapp | …
  "source": {                               // evidencia: mensaje original y adjuntos
    "from": "compras@cliente.example",
    "subject": "Pedido semana",
    "segments": [                            // texto con marcas de evidencia
      { "text": "Os paso el pedido para " },
      { "id": "ev-addr", "text": "el local de siempre" }
    ],
    "attachments": [ { "id": "att-1", "name": "Pedido.pdf", "kind": "pdf_order" } ]
  },
  "customerCandidate": { "customerId": "C-10233", "confidence": "alta", "reason": "Remitente registrado" },
  "fields": [
    { "key": "deliveryDate", "label": "Fecha de entrega", "value": "jueves 22/10",
      "confidence": "media", "evidenceId": "ev-date", "note": "«para el jueves» sin fecha exacta" }
  ],
  "lines": [
    { "sku": "P-3001", "quantity": 12, "evidenceId": "ev-l3",
      "uncertainty": { "field": "vintage", "confidence": "media", "note": "No indica añada" } }
  ]
}
```

Puntos a acordar con Toni:

1. Nivel de confianza por dato y por línea, con el fragmento de evidencia.
2. Qué hace la capa de captura con las correcciones (`reportOutcome`: aprobado / rechazado / nº de correcciones).
3. Identificación de cliente y dirección (¿quién resuelve «el local de siempre»?).
4. Cómo se marca un remitente que no es cliente (dispara el alta de cliente).

## Qué no se debe asumir

- Que las reglas o umbrales mostrados son la política real de PM: son provisionales.
- Que las fechas «confirmadas» del prototipo vienen de un transportista: son simuladas.
- Que el enlace de alta o de seguimiento es seguro: no lo es.
