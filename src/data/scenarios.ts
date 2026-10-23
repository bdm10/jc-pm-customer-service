// Guiones de las seis demostraciones guiadas: notas del presentador, pasos, supuestos y preguntas.

import { atLeast } from '../domain/orders';
import type { DemoState, ScenarioId } from '../domain/types';

export interface ScenarioStep {
  label: string;
  optional?: boolean;
  done: (s: DemoState) => boolean;
}

export interface Scenario {
  id: ScenarioId;
  number: number;
  title: string;
  short: string;
  route: string;
  minutes: string;
  purpose: string;
  currentState: string;
  proposed: string;
  keyMessage: string;
  steps: ScenarioStep[];
  assumptions: string[];
  questions: string[];
  /** Existencias que el escenario modifica y que se restauran al reiniciarlo. */
  stockSkus: string[];
  /** Clientes que el escenario puede modificar y que se restauran al reiniciarlo. */
  customerIds: string[];
}

const o = (s: DemoState, id: string) => s.orders[id];
const blockerResolved = (s: DemoState, id: string, type: string) => !!o(s, id)?.blockers.find((b) => b.type === type && b.status === 'resolved');

export const SCENARIOS: Scenario[] = [
  {
    id: 's1',
    number: 1,
    title: 'Pedido limpio desde email',
    short: 'Pedido limpio',
    route: '/pedido/REQ-1042',
    minutes: '3 min',
    purpose:
      'Mostrar cómo la salida de la capa de captura de Toni llega como borrador estructurado, cómo se revisa con la evidencia a la vista y qué pasa después: ERP, liberación y envío de almacén.',
    currentState: 'Hoy un agente lee el email y teclea el pedido en Navision («Manual orders · Agent capture»).',
    proposed: 'La capa de captura prepara el borrador; Atención al Cliente solo revisa lo dudoso y aprueba. El envío de almacén se prepara desde el mismo espacio.',
    keyMessage: 'Aprobar no es entregar: se ven por separado «borrador», «aprobado», «confirmado en ERP», «envío preparado», «expedido» y «entregado».',
    steps: [
      { label: 'Revisar los 3 datos dudosos (dirección, fecha y añada) con el email al lado', done: (s) => o(s, 'REQ-1042')?.fields.every((f) => f.confirmed) && !!o(s, 'REQ-1042')?.lines.every((l) => !l.uncertainty || l.uncertainty.confirmed) },
      { label: 'Aprobar y enviar al ERP', done: (s) => atLeast(o(s, 'REQ-1042'), 'approved') },
      { label: 'Ver la confirmación del ERP y la liberación automática', done: (s) => atLeast(o(s, 'REQ-1042'), 'released') },
      { label: 'Preparar el envío de almacén: agrupación, cantidades y la excepción de franja', done: (s) => atLeast(o(s, 'REQ-1042'), 'shipment_prepared') },
      { label: 'Simular la expedición y abrir la vista de seguimiento del cliente', optional: true, done: (s) => atLeast(o(s, 'REQ-1042'), 'dispatched') },
      { label: 'Simular la entrega y «Reportar un problema» como cliente', optional: true, done: (s) => Object.values(s.claims).some((c) => c.scenarioId === 's1') },
    ],
    assumptions: [
      'La capa de captura entrega un borrador con evidencia por dato y nivel de confianza (contrato propuesto en docs/INTEGRACION.md).',
      'Un borrador revisado entra al ERP con instrucciones en campos estructurados, por lo que no dispara el bloqueo de «Observaciones».',
      'En PM el envío de almacén lo prepara Atención al Cliente; en JC, Logística (según los diagramas actuales).',
      'Se agrupan en un envío los pedidos liberados del mismo cliente, misma dirección y misma fecha.',
    ],
    questions: [
      '¿Qué datos debe revisar siempre una persona, aunque la confianza sea alta?',
      '¿Quién corrige un borrador mal capturado: Atención al Cliente o la capa de captura?',
      '¿Qué reglas de agrupación de envíos usáis hoy (cliente, ruta, fecha, almacén)?',
      '¿Qué información de seguimiento tenemos realmente del transportista y con qué frecuencia?',
    ],
    stockSkus: [],
    customerIds: ['C-10233'],
  },
  {
    id: 's2',
    number: 2,
    title: 'Bloqueo por observaciones',
    short: 'Observaciones',
    route: '/pedido/PV-26-018690',
    minutes: '2 min',
    purpose:
      'Separar una instrucción habitual repetida de un cambio puntual real dentro de la misma nota, y resolver el bloqueo con campos estructurados y no por palabras clave.',
    currentState: 'Cualquier texto en «Observaciones» retiene el pedido. Alguien lo lee y lo libera a mano.',
    proposed: 'El espacio compara cada parte de la nota con la ficha y el historial, sugiere una clasificación y pide confirmarla. Los cambios puntuales se guardan como datos de entrega del pedido.',
    keyMessage: 'Nada se descarta en silencio: la nota original se conserva y cada parte queda clasificada por una persona.',
    steps: [
      { label: 'Clasificar las dos partes de la nota (habitual vs. puntual)', done: (s) => !!o(s, 'PV-26-018690')?.observation?.segments.every((x) => x.classification) },
      { label: 'Completar los campos estructurados del cambio puntual', done: (s) => !!o(s, 'PV-26-018690')?.observation?.segments.find((x) => x.classification === 'one_off_delivery')?.structured?.address },
      { label: 'Revisar los conflictos de dirección y franja horaria', done: (s) => !!o(s, 'PV-26-018690')?.observation?.conflicts.every((c) => c.chosen) },
      { label: 'Resolver el bloqueo y liberar el pedido', done: (s) => blockerResolved(s, 'PV-26-018690', 'observations') },
    ],
    assumptions: [
      'La sugerencia combina comparación con la ficha del cliente y con los últimos pedidos; nunca libera sola.',
      'Un cambio puntual de dirección no modifica la ficha del cliente.',
      'El recargo por franja garantizada (25 €) es sintético.',
    ],
    questions: [
      '¿Qué tipos de observaciones aparecen más a menudo? ¿Hay una lista que podamos usar como categorías?',
      '¿Quién puede convertir una instrucción repetida en instrucción permanente de la ficha?',
      '¿Se puede pedir a los comerciales que usen campos de entrega en lugar de texto libre en Vendor App?',
    ],
    stockSkus: [],
    customerIds: ['C-10871'],
  },
  {
    id: 's3',
    number: 3,
    title: 'Bloqueo por crédito',
    short: 'Crédito',
    route: '/pedido/PV-26-018655',
    minutes: '2–3 min',
    purpose:
      'Mostrar el motivo del bloqueo con datos de crédito sintéticos, preparar la solicitud a Finanzas y dejar claro quién decide. Incluye una excepción comercial para demostrar que aprobarla no libera el crédito.',
    currentState: 'El pedido queda retenido por crédito; Atención al Cliente consulta a Finanzas por email o teléfono.',
    proposed: 'La solicitud a Finanzas sale del espacio con el contexto ya preparado; la decisión queda registrada en el historial del pedido.',
    keyMessage: 'Atención al Cliente no puede anular un bloqueo de crédito, y una aprobación comercial tampoco.',
    steps: [
      { label: 'Revisar motivo y datos de crédito; solicitar la revisión a Finanzas', done: (s) => !!o(s, 'PV-26-018655')?.credit?.requestedAt },
      { label: 'Enviar la excepción comercial (descuento, sin cargo, plazo) a aprobación', done: (s) => ['requested', 'approved', 'rejected'].includes(o(s, 'PV-26-018655')?.deal.approval.status) },
      { label: 'Simular la aprobación comercial: el crédito sigue bloqueado', done: (s) => ['approved', 'rejected'].includes(o(s, 'PV-26-018655')?.deal.approval.status) },
      { label: 'Simular la decisión de Finanzas (control de demo)', done: (s) => !!o(s, 'PV-26-018655')?.credit?.decision },
      { label: 'Liberar el pedido si Finanzas lo aprueba', optional: true, done: (s) => atLeast(o(s, 'PV-26-018655'), 'released') },
    ],
    assumptions: [
      'Los datos de crédito (límite, saldo, vencidos, cobertura del seguro) son sintéticos.',
      'La regla de quién aprueba excepciones comerciales es ilustrativa y provisional.',
      'El coste financiero del plazo de pago usa un tipo anual sintético del 4 %.',
    ],
    questions: [
      '¿Qué información pide Finanzas para decidir un bloqueo de crédito?',
      '¿Existe un plazo de respuesta acordado con Finanzas?',
      '¿Quién comunica al cliente un rechazo: Atención al Cliente o el comercial?',
      '¿Qué umbrales de margen y descuento usa hoy Dirección comercial?',
    ],
    stockSkus: [],
    customerIds: ['C-11402'],
  },
  {
    id: 's4',
    number: 4,
    title: 'Producto sin stock',
    short: 'Sin stock',
    route: '/pedido/PV-26-018671',
    minutes: '2–3 min',
    purpose:
      'Mostrar el vino, la añada y el formato exactos que faltan, presentar alternativas como propuestas y exigir aceptación explícita antes de sustituir. Repetir la comprobación de disponibilidad antes de liberar.',
    currentState: 'El pedido queda retenido por falta de stock; las alternativas se negocian por teléfono o email sin registro estructurado.',
    proposed: 'Las alternativas se calculan con stock real, se registra quién las acepta y por qué canal, y se comprueba de nuevo la disponibilidad.',
    keyMessage: 'Ninguna sustitución de vino o añada sin aceptación explícita del cliente, y nada se libera sin volver a comprobar stock.',
    steps: [
      { label: 'Elegir una propuesta (parcial, añada, formato o fecha posterior)', done: (s) => !!o(s, 'PV-26-018671')?.stockReview?.selectedOptionId },
      { label: 'Preparar la propuesta para el cliente', done: (s) => !!o(s, 'PV-26-018671')?.stockReview?.proposalPreparedAt },
      { label: 'Registrar la aceptación explícita del cliente', done: (s) => !!o(s, 'PV-26-018671')?.stockReview?.acceptance },
      { label: 'Aplicar el cambio y hacer la segunda comprobación de disponibilidad', done: (s) => !!o(s, 'PV-26-018671')?.stockReview?.secondCheck?.ok },
      { label: 'Liberar el pedido', done: (s) => atLeast(o(s, 'PV-26-018671'), 'released') },
    ],
    assumptions: [
      'Las existencias y la fecha de la próxima entrada son sintéticas; la fecha de Compras no está confirmada.',
      'El coste estándar de la añada 2019 no está cargado a propósito para mostrar «Cálculo incompleto».',
      'Mientras se espera al cliente, el ERP simulado reserva unidades para otro pedido: por eso hay que volver a comprobar.',
    ],
    questions: [
      '¿Qué sustituciones se pueden proponer sin consultar al comercial?',
      '¿Hay clientes o canales que nunca aceptan cambio de añada?',
      '¿Se reserva stock mientras se espera la respuesta del cliente?',
    ],
    stockSkus: ['P-2002', 'P-2003', 'P-2004'],
    customerIds: ['C-10655'],
  },
  {
    id: 's5',
    number: 5,
    title: 'Solicitud de merchandising',
    short: 'Merchandising',
    route: '/pedido/PV-26-018662',
    minutes: '2 min',
    purpose:
      'Mostrar un pedido con material promocional: disponibilidad, categorías, presupuesto y aprobaciones. Las categorías y reglas son provisionales y deben definirlas en PM.',
    currentState: 'El pedido queda retenido por merchandising y se gestiona fuera del ERP.',
    proposed: 'El material se revisa por categoría, con su disponibilidad y con la aprobación que corresponda según reglas acordadas.',
    keyMessage: 'Las reglas de categorías y aprobaciones que se ven aquí son una propuesta para discutir, no una definición.',
    steps: [
      { label: 'Decidir qué hacer con el expositor sin stock suficiente', done: (s) => !!o(s, 'PV-26-018662')?.merch?.shortfall?.decision || !o(s, 'PV-26-018662')?.merch?.shortfall },
      { label: 'Solicitar las aprobaciones (reglas provisionales)', done: (s) => !Object.values(o(s, 'PV-26-018662')?.merch?.approvals ?? {}).includes('pending') },
      { label: 'Simular las decisiones de jefe/a de ventas y Trade Marketing', done: (s) => !Object.values(o(s, 'PV-26-018662')?.merch?.approvals ?? {}).some((v) => v === 'pending' || v === 'requested') },
      { label: 'Resolver el bloqueo de merchandising', done: (s) => blockerResolved(s, 'PV-26-018662', 'merchandising') },
    ],
    assumptions: [
      'Categorías A/B/C, límites de 100 € y 300 € y aprobadores: provisionales, pendientes de PM.',
      'El presupuesto trimestral de material por comercial es sintético.',
      'El material promocional se descuenta en la contribución, no en el margen bruto.',
    ],
    questions: [
      '¿Qué categorías de material existen y quién las aprueba hoy?',
      '¿El material tiene presupuesto por comercial, por cliente o por campaña?',
      '¿El material sale del mismo almacén y en el mismo envío que el vino?',
    ],
    stockSkus: [],
    customerIds: ['C-12018'],
  },
  {
    id: 's6',
    number: 6,
    title: 'Alta de cliente nuevo',
    short: 'Cliente nuevo',
    route: '/alta/ALTA-0042',
    minutes: '3 min',
    purpose:
      'Mostrar un enlace de alta sencillo y la vista del cliente, separando qué aporta el cliente, qué aporta el comercial y qué asigna internamente Administración y Finanzas. Incluye un aviso de posible duplicado.',
    currentState: 'El pedido de un cliente nuevo queda retenido; los datos llegan por email en distintos formatos y se teclean a mano.',
    proposed: 'El cliente rellena un formulario vía enlace; el espacio comprueba duplicados, muestra lo que falta y quién decide, y crea la cuenta con las dimensiones contables.',
    keyMessage: 'Cada dato tiene un dueño: cliente, comercial o equipo interno. La cuenta solo se crea cuando todo está completo y Finanzas ha decidido.',
    steps: [
      { label: 'Generar el enlace de alta', done: (s) => !!s.onboarding['ALTA-0042']?.invite },
      { label: 'Rellenar y enviar el formulario como cliente (vista previa)', done: (s) => !!s.onboarding['ALTA-0042']?.customerSubmittedAt },
      { label: 'Revisar el posible duplicado', done: (s) => !!s.onboarding['ALTA-0042']?.duplicateCheck?.decision },
      { label: 'Asignar dimensiones contables y simular la decisión de Finanzas', done: (s) => ['approved', 'approved_changes', 'rejected'].includes(s.onboarding['ALTA-0042']?.finance.status) },
      { label: 'Crear la cuenta (simulado) y desbloquear el pedido de WhatsApp', done: (s) => s.onboarding['ALTA-0042']?.status === 'created' },
    ],
    assumptions: [
      'La detección de duplicados compara NIF, nombre y dirección con un algoritmo simple; en producción usaría el maestro de clientes.',
      'El enlace de alta es simulado: no hay token firmado, caducidad real ni verificación de identidad.',
      'El NIF solo se valida en formato; la validación real (AEAT, registros) requiere integración.',
      'Los grupos contables y dimensiones son ejemplos; los valores reales los define Administración.',
    ],
    questions: [
      '¿Qué datos son obligatorios hoy para crear un cliente en Navision?',
      '¿Quién asigna grupos contables y dimensiones: Atención al Cliente o Administración?',
      '¿Puede un pedido prepararse mientras el alta está en curso?',
      '¿Qué hacemos con cuentas inactivas que reaparecen con otro NIF?',
    ],
    stockSkus: [],
    customerIds: ['C-10482'],
  },
];

export const scenarioById = (id: string | undefined) => SCENARIOS.find((s) => s.id === id);

export const GLOBAL_ASSUMPTIONS: string[] = [
  'Todo es sintético: clientes, personas, productos, precios, costes, créditos y existencias.',
  'No hay conexión con Navision, Vendor App, EDI, Mi PM, email, WhatsApp, almacén ni transportistas: cada integración es una simulación local detrás de una interfaz.',
  'La capa de captura de pedidos (en desarrollo por Toni) se representa solo por su salida: borradores estructurados con evidencia y confianza. Este prototipo no ingiere mensajes.',
  'Los diagramas actuales de JC y PM se usan como referencia del estado actual, no como especificación completa.',
  'Umbrales de margen, descuento y reglas de aprobación: ilustrativos y provisionales.',
  'No hay autenticación real. El usuario de demo es «Ana Ruiz, Atención al Cliente PM».',
  'Las fechas se generan relativas al momento de reinicio de la demo.',
];

export const GLOBAL_QUESTIONS: string[] = [
  '¿Qué volumen diario de pedidos retenidos tiene cada motivo de bloqueo?',
  '¿Qué decisiones puede tomar Atención al Cliente sin escalar?',
  '¿Qué roles deben tener acceso a este espacio (Finanzas, comerciales, Logística)?',
  '¿Las solicitudes a otros roles deberían llegar por email, Teams o dentro del propio espacio?',
  '¿Qué indicadores querríais ver después (tiempo hasta liberar, retenciones por motivo)?',
  '¿Qué cambia en JC frente a PM además del responsable del envío de almacén?',
];
