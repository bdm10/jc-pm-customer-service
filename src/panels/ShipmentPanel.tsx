import { useState } from 'react';
import { Copy, ExternalLink, Truck } from 'lucide-react';
import { fmtAge, fmtDate, fmtDateTime } from '../domain/format';
import * as ops from '../domain/ops';
import type { ShipmentProposal } from '../domain/shipment';
import type { Order, Shipment } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { AsyncButton, Callout, Card, DemoBox, Pill, ProposedTag, SimTag, useToast } from '../components/ui';

export function ShipmentPanel({ o }: { o: Order }) {
  const { state } = useStore();
  const sh = o.shipmentId ? state.shipments[o.shipmentId] : undefined;
  return (
    <Card id="panel-shipment" title="Envío de almacén" icon={<Truck size={18} />} actions={<SimTag />}>
      {sh ? <ShipmentStatus sh={sh} /> : o.company === 'JC' ? <JcNote /> : <Prepare o={o} />}
    </Card>
  );
}

function JcNote() {
  return (
    <Callout tone="info" title="En JC este paso lo hace Logística">
      Según el proceso actual de Juvé &amp; Camps, el envío de almacén (paso 3) lo crea Logística. Atención al Cliente solo lo consulta. En PM lo prepara Atención al Cliente.
    </Callout>
  );
}

function Prepare({ o }: { o: Order }) {
  const { apply, services } = useStore();
  const toast = useToast();
  const [proposal, setProposal] = useState<ShipmentProposal | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const pendingEx = proposal ? proposal.exceptions.filter((e) => !decisions[e.id]) : [];

  if (!proposal) {
    return (
      <div className="stack">
        <p className="small">
          En PM, Atención al Cliente crea el envío de almacén (paso 3 del proceso). <ProposedTag>Propuesta</ProposedTag> El espacio propone la agrupación, comprueba cantidades y reúne las instrucciones de entrega antes de confirmar.
        </p>
        <div>
          <AsyncButton
            className="btn primary"
            busyLabel="Consultando almacén (simulado)…"
            testId="propose-shipment"
            onClick={async () => {
              setProposal(await services.warehouse.proposeShipment(o.id));
              setDecisions({});
            }}
          >
            Preparar envío de almacén
          </AsyncButton>
        </div>
      </div>
    );
  }

  return (
    <div className="stack lg" data-testid="shipment-proposal">
      <div className="stack sm">
        <h3>Agrupación propuesta</h3>
        <p className="small">{proposal.groupingReason}</p>
        <div className="row wrap">
          {proposal.orderIds.map((id) => (
            <Pill key={id} tone={id === o.id ? 'brand' : 'info'}>
              {id}
            </Pill>
          ))}
        </div>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Dirección</dt>
          <dd>{proposal.addressLabel}</dd>
          <dt>Fecha solicitada</dt>
          <dd>{fmtDate(proposal.requestedDate)}</dd>
        </dl>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Producto</th>
              <th className="num">Cantidad</th>
              <th className="num">Disponible</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {proposal.lines.map((l, i) => (
              <tr key={i}>
                <td className="small">{l.orderId}</td>
                <td>{l.label}</td>
                <td className="num">{l.quantity}</td>
                <td className="num">{l.available}</td>
                <td>{l.ok ? <Pill tone="ok">Disponible</Pill> : <Pill tone="alert">Insuficiente</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stack sm">
        <h3>Instrucciones de entrega</h3>
        {proposal.instructions.length ? (
          <ul className="plain small">
            {proposal.instructions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Sin instrucciones especiales.</p>
        )}
      </div>
      {proposal.exceptions.length > 0 && (
        <div className="stack">
          <h3>Excepciones antes de confirmar</h3>
          {proposal.exceptions.map((e) => (
            <div key={e.id} className="role-box stack sm" data-testid={`shipment-exception-${e.id}`}>
              <div className="row between wrap">
                <strong>{e.title}</strong>
                {decisions[e.id] ? <Pill tone="ok">Decidido</Pill> : <Pill tone="warn">Pendiente</Pill>}
              </div>
              <p className="small">{e.detail}</p>
              {e.options.map((op) => (
                <label key={op.id} className={`choice ${decisions[e.id] === op.id ? 'selected' : ''}`}>
                  <input type="radio" name={e.id} checked={decisions[e.id] === op.id} onChange={() => setDecisions({ ...decisions, [e.id]: op.id })} />
                  <span>{op.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="row wrap">
        <AsyncButton
          className="btn primary"
          disabled={pendingEx.length > 0 || proposal.lines.some((l) => !l.ok)}
          busyLabel="Creando envío (simulado)…"
          testId="confirm-shipment"
          onClick={async () => {
            await services.warehouse.confirmShipment(proposal);
            const link = await services.links.createLink('tracking', o.id);
            let id = '';
            apply((s) => {
              id = ops.createShipment(s, proposal, decisions, link.token, link.url);
            });
            toast(`Envío de almacén ${id} preparado (simulado). Pasa a picking.`);
          }}
        >
          Confirmar envío de almacén
        </AsyncButton>
        <button className="btn" onClick={() => setProposal(null)}>
          Cancelar
        </button>
        {pendingEx.length > 0 && <span className="small muted">Decide las {pendingEx.length} excepción(es) pendiente(s) para confirmar.</span>}
      </div>
    </div>
  );
}

export function ShipmentStatus({ sh }: { sh: Shipment }) {
  const { apply } = useStore();
  const toast = useToast();
  const steps = [
    { k: 'prepared', l: 'Envío preparado', at: sh.createdAt },
    { k: 'dispatched', l: 'Expedido', at: sh.dispatchedAt },
    { k: 'delivered', l: 'Entregado', at: sh.deliveredAt },
  ];
  const idx = steps.findIndex((s) => s.k === sh.status);
  return (
    <div className="stack lg" data-testid="shipment-status">
      <div className="row wrap" style={{ gap: 10 }}>
        <strong>{sh.id}</strong>
        <Pill tone={sh.status === 'delivered' ? 'ok' : 'info'}>{steps[idx].l}</Pill>
        {sh.carrierUpdateMissing && <Pill tone="warn">Sin actualización del transportista</Pill>}
        <span className="small muted">{sh.carrier}</span>
      </div>
      <div className="stepper" style={{ gridTemplateColumns: 'repeat(3, 1fr)', border: 'none', padding: 0 }}>
        {steps.map((s, i) => (
          <div key={s.k} className={`step ${i < idx ? 'done' : i === idx ? (sh.status === 'delivered' ? 'done' : 'current') : ''}`}>
            <div className="bar" />
            <span className="lbl">{s.l}</span>
            <span className="sub">{s.at ? fmtDateTime(s.at) : 'Pendiente'}</span>
          </div>
        ))}
      </div>
      <dl className="kv">
        <dt>Fecha solicitada</dt>
        <dd>{fmtDate(sh.requestedDate)}</dd>
        <dt>Entrega confirmada</dt>
        <dd>
          {sh.confirmedDelivery ? `${fmtDate(sh.confirmedDelivery.date)}${sh.confirmedDelivery.window ? ` · ${sh.confirmedDelivery.window}` : ''}` : 'Sin confirmar'}
          {sh.confirmedDelivery && <div className="xsmall muted">{sh.confirmedDelivery.source}</div>}
        </dd>
        <dt>Última actualización</dt>
        <dd>
          {fmtDateTime(sh.lastUpdateAt)} ({fmtAge(sh.lastUpdateAt)})
        </dd>
        <dt>Pedidos</dt>
        <dd>{sh.orderIds.join(' + ')}</dd>
      </dl>
      {sh.instructions.length > 0 && (
        <div className="small">
          <strong>Instrucciones trasladadas:</strong>
          <ul className="plain">
            {sh.instructions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="stack sm">
        <span className="label">Enlace de seguimiento para el cliente (simulado)</span>
        <div className="link-box">
          <span>{sh.tracking.url}</span>
          <button
            className="btn sm"
            onClick={() => {
              navigator.clipboard?.writeText(sh.tracking.url).then(
                () => toast('Enlace copiado. Es un enlace de demostración: no funciona fuera del prototipo.'),
                () => toast('No se ha podido copiar el enlace.', 'alert'),
              );
            }}
          >
            <Copy size={14} /> Copiar
          </button>
          <button className="btn sm primary" onClick={() => navigate(`/cliente/seguimiento/${sh.tracking.token}`)} data-testid="open-tracking">
            <ExternalLink size={14} /> Vista del cliente
          </button>
        </div>
      </div>
      {sh.status !== 'delivered' && (
        <DemoBox title="simula los pasos de almacén y transporte">
          <div className="row wrap">
            {sh.status === 'prepared' && (
              <button className="btn demo" data-testid="sim-dispatch" onClick={() => apply((s) => ops.simulateDispatch(s, sh.id))}>
                Picking, registro y expedición
              </button>
            )}
            {sh.status === 'dispatched' && (
              <>
                {!sh.carrierUpdateMissing && (
                  <button className="btn demo" onClick={() => apply((s) => ops.simulateCarrierSilence(s, sh.id))} data-testid="sim-silence">
                    El transportista deja de informar
                  </button>
                )}
                <button className="btn demo" onClick={() => apply((s) => ops.simulateCarrierUpdate(s, sh.id))}>
                  El transportista confirma franja
                </button>
                <button className="btn demo" data-testid="sim-deliver" onClick={() => apply((s) => ops.simulateDelivered(s, sh.id))}>
                  Entrega confirmada
                </button>
              </>
            )}
          </div>
        </DemoBox>
      )}
    </div>
  );
}
