import { GLOBAL_ASSUMPTIONS, GLOBAL_QUESTIONS, SCENARIOS } from '../data/scenarios';
import { MARGIN_ASSUMPTIONS } from '../domain/margin';
import { fmtEUR } from '../domain/format';
import { navigate } from '../state/router';
import { Card, ProposedTag, ProvisionalTag, SimTag, Tag } from '../components/ui';

const PROCESS = [
  { n: '1', t: 'Entrada del pedido', d: 'Vendor App · EDI · Mi PM · Pedidos manuales (captura por agente)', kind: '' },
  { n: '2', t: 'ERP: pedido creado', d: '¿Autorizado? Liberación automática o revisión por Atención al Cliente', kind: '' },
  { n: '3', t: 'Envío de almacén', d: 'PM: Atención al Cliente · JC: Logística', kind: 'cs' },
  { n: '4', t: 'Picking', d: 'Almacén con PDAs', kind: 'lw' },
  { n: '5', t: 'Registro', d: 'Almacén', kind: 'lw' },
  { n: '6', t: 'Albarán de venta', d: 'Ventas', kind: '' },
  { n: '7', t: 'Entrega al cliente', d: 'Transportista', kind: '' },
];

const INTEGRATIONS: { area: string; simulated: string; needs: string }[] = [
  { area: 'Capa de captura (Toni)', simulated: 'Borradores precargados con evidencia y confianza; el resultado de la revisión se «devuelve» como evento.', needs: 'Acordar el contrato del borrador (docs/INTEGRACION.md) y el canal de retorno de correcciones.' },
  { area: 'ERP Navision', simulated: 'Creación de pedidos, numeración, comprobaciones automáticas, liberación y alta de clientes en memoria.', needs: 'API o servicio aprobado de Navision para pedidos, bloqueos, clientes y dimensiones; permisos por rol.' },
  { area: 'Crédito y Finanzas', simulated: 'Datos de crédito sintéticos; la decisión de Finanzas es un control de demo.', needs: 'Lectura de saldos/vencidos/seguro y flujo de aprobación de Finanzas con trazabilidad.' },
  { area: 'Stock y compras', simulated: 'Existencias fijas en memoria y una reserva simulada de otro pedido.', needs: 'Disponibilidad en tiempo real y fechas de entrada de Compras.' },
  { area: 'Aprobaciones', simulated: 'Comercial, Trade Marketing y Finanzas responden con botones de demo.', needs: 'Definir aprobadores reales, canal (Teams/email/en el espacio) y plazos.' },
  { area: 'Almacén y transporte', simulated: 'Propuesta de envío, picking, expedición, silencio del transportista y entrega simulados.', needs: 'Envíos de almacén en Navision y eventos reales del transportista.' },
  { area: 'Enlaces para clientes', simulated: 'URL con dominio .invalid y token aleatorio; sin caducidad real ni verificación.', needs: 'Enlaces firmados de un solo uso, caducidad, protección de datos y registro de accesos.' },
  { area: 'Mensajes a clientes', simulated: 'Se preparan borradores; nunca se envían.', needs: 'Email/WhatsApp corporativo aprobado, plantillas y consentimiento.' },
  { area: 'Usuarios y permisos', simulated: 'Usuario fijo de demo, sin inicio de sesión.', needs: 'Autenticación corporativa y permisos por rol (no implementados).' },
  { area: 'Persistencia', simulated: 'Estado y comentarios en el navegador (localStorage).', needs: 'Base de datos y auditoría en un entorno aprobado.' },
];

export function Supuestos() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Supuestos y preguntas abiertas</h1>
          <p>Qué hemos supuesto para construir el prototipo, qué está simulado y qué necesitamos confirmar con el equipo de Atención al Cliente de PM y con Tecnología.</p>
        </div>
      </div>
      <div className="stack lg">
        <Card title="Proceso actual (referencia: diagramas de JC y PM)" actions={<Tag>Estado actual</Tag>}>
          <div className="stack">
            <div className="process">
              {PROCESS.map((p) => (
                <div key={p.n} className={`pstep ${p.kind}`}>
                  <span className="n">{p.n}</span>
                  <strong>{p.t}</strong>
                  <span className="muted">{p.d}</span>
                </div>
              ))}
            </div>
            <div className="small">
              Motivos de bloqueo actuales: pedido con observaciones · límite de crédito · merchandising · cliente nuevo · sin stock. Los diagramas son una referencia de alto nivel, no una especificación completa.
            </div>
            <div className="role-box small stack sm">
              <div className="row wrap" style={{ gap: 8 }}>
                <strong>Dónde encaja el espacio de trabajo</strong> <ProposedTag />
              </div>
              <ul className="plain">
                <li>Entre los pasos 1 y 2: revisión de borradores de la capa de captura antes de crear el pedido en el ERP (sustituye al tecleo manual).</li>
                <li>En la revisión del paso 2: resolver bloqueos con contexto, responsables claros y trazabilidad.</li>
                <li>En el paso 3 (PM): preparar el envío de almacén con agrupación, cantidades e instrucciones.</li>
                <li>Pasos 4–7: seguimiento, consultas de clientes e incidencias, sin inventar fechas.</li>
                <li>Fuera del flujo de pedido: altas de clientes y comprobador de condiciones y margen.</li>
              </ul>
            </div>
          </div>
        </Card>

        <div className="split2">
          <Card title="Supuestos generales">
            <ul className="plain small">
              {GLOBAL_ASSUMPTIONS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
          <Card title="Preguntas generales para la reunión">
            <ul className="plain small">
              {GLOBAL_QUESTIONS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Qué está simulado y qué requiere integración" actions={<SimTag />}>
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>En el prototipo</th>
                  <th>Para producción haría falta</th>
                </tr>
              </thead>
              <tbody>
                {INTEGRATIONS.map((i) => (
                  <tr key={i.area}>
                    <td className="strong">{i.area}</td>
                    <td className="small">{i.simulated}</td>
                    <td className="small">{i.needs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Umbrales y reglas ilustrativas" actions={<ProvisionalTag />}>
          <ul className="plain small">
            <li>
              Margen bruto: ≥ {MARGIN_ASSUMPTIONS.thresholds.grossMarginPct.ok * 100} % dentro de rango · ≥ {MARGIN_ASSUMPTIONS.thresholds.grossMarginPct.review * 100} % revisar · por debajo requiere aprobación.
            </li>
            <li>
              Contribución después de entrega: ≥ {MARGIN_ASSUMPTIONS.thresholds.contributionPct.ok * 100} % · ≥ {MARGIN_ASSUMPTIONS.thresholds.contributionPct.review * 100} %.
            </li>
            <li>Excepción comercial: hasta {MARGIN_ASSUMPTIONS.thresholds.zoneManagerDiscountPts} puntos de descuento extra la aprueba el/la jefe/a de ventas de zona; el resto, Dirección comercial.</li>
            <li>Coste financiero: {MARGIN_ASSUMPTIONS.annualFinancingRate * 100} % anual. Recargo por franja garantizada: {fmtEUR(MARGIN_ASSUMPTIONS.timeWindowSurcharge)}.</li>
            <li>Merchandising: A consumibles ≤ 100 € automática · B reutilizable ≤ 300 € jefe/a de ventas · C mobiliario siempre Trade Marketing.</li>
            <li>Una aprobación comercial nunca libera un bloqueo de crédito.</li>
          </ul>
        </Card>

        <Card title="Por escenario">
          <div className="stack lg">
            {SCENARIOS.map((s) => (
              <section key={s.id} className="stack sm">
                <div className="row wrap" style={{ gap: 8 }}>
                  <h3>
                    {s.number}. {s.title}
                  </h3>
                  <button className="btn ghost sm" onClick={() => navigate(s.route)}>
                    Abrir
                  </button>
                </div>
                <div className="split2 small">
                  <div>
                    <strong>Supuestos</strong>
                    <ul className="plain">
                      {s.assumptions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Preguntas</strong>
                    <ul className="plain">
                      {s.questions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
