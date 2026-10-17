import { Check, Clock, PackageCheck, Package, Truck, TriangleAlert } from 'lucide-react';
import { fmtAge, fmtDate, fmtDateTime } from '../domain/format';
import { productLabel } from '../domain/orders';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { Callout } from '../components/ui';
import { NotFound } from '../App';
import { CustomerShell } from './CustomerShell';

export function CustomerTracking({ token }: { token: string }) {
  const { state } = useStore();
  const sh = Object.values(state.shipments).find((s) => s.tracking.token === token);
  if (!sh) return <NotFound />;
  const customer = state.customers[sh.customerId];
  const orders = sh.orderIds.map((id) => state.orders[id]);
  const erpRefs = orders.map((o) => o.erpNumber ?? o.id).join(', ');
  const idx = sh.status === 'prepared' ? 1 : sh.status === 'dispatched' ? 2 : 3;
  const steps = [
    { l: 'Pedido recibido', icon: <Check size={18} />, at: orders[0]?.receivedAt },
    { l: 'En preparación', icon: <Package size={18} />, at: sh.createdAt },
    { l: 'Expedido', icon: <Truck size={18} />, at: sh.dispatchedAt },
    { l: 'Entregado', icon: <PackageCheck size={18} />, at: sh.deliveredAt },
  ];
  const back = () => navigate(`/pedido/${sh.orderIds[0]}`);
  const confirmed = sh.confirmedDelivery && sh.confirmedDelivery.source.startsWith('Confirmado') || sh.status === 'delivered';

  return (
    <CustomerShell back={back} backLabel="Volver al espacio de trabajo">
      <div className="stack lg" data-testid="customer-tracking">
        <div>
          <h1>Seguimiento de tu pedido</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {customer?.name} · Pedido {erpRefs}
          </p>
        </div>

        <div className="card card-body stack lg">
          <div className="track-steps" role="list">
            {steps.map((s, i) => (
              <div key={s.l} role="listitem" className={`track-step ${i < idx || (i === idx && sh.status === 'delivered') ? 'done' : i === idx ? 'current' : ''}`} aria-current={i === idx ? 'step' : undefined}>
                <span className="c">{s.icon}</span>
                <span>{s.l}</span>
                <span className="xsmall muted" style={{ fontWeight: 400 }}>
                  {s.at && i <= idx ? fmtDateTime(s.at) : ''}
                </span>
              </div>
            ))}
          </div>

          {sh.carrierUpdateMissing && sh.status !== 'delivered' && (
            <Callout tone="warn" title="Todavía no tenemos novedades del transportista" icon={<TriangleAlert size={18} />}>
              La última actualización es de hace {fmtAge(sh.lastUpdateAt).replace('hace ', '')}. No mostramos una hora estimada hasta que el transportista la confirme. Te avisaremos en cuanto la tengamos.
            </Callout>
          )}

          <dl className="kv">
            <dt>Fecha que pediste</dt>
            <dd>{fmtDate(sh.requestedDate)}</dd>
            <dt>Entrega confirmada</dt>
            <dd data-testid="confirmed-delivery">
              {sh.status === 'delivered' && sh.deliveredAt
                ? `Entregado el ${fmtDateTime(sh.deliveredAt)}`
                : confirmed && sh.confirmedDelivery
                  ? `${fmtDate(sh.confirmedDelivery.date)}${sh.confirmedDelivery.window ? `, entre las ${sh.confirmedDelivery.window.replace('–', ' y las ')}` : ''}`
                  : 'Pendiente de confirmar por el transportista'}
            </dd>
            <dt>Última actualización</dt>
            <dd className="row" style={{ gap: 6 }}>
              <Clock size={14} /> {fmtDateTime(sh.lastUpdateAt)} ({fmtAge(sh.lastUpdateAt)})
            </dd>
            <dt>Transporte</dt>
            <dd>{sh.carrier}</dd>
          </dl>
        </div>

        <div className="card card-body stack sm">
          <h2>Qué incluye</h2>
          <ul className="plain">
            {sh.lines.map((l, i) => (
              <li key={i}>
                {l.quantity} × {productLabel(state, l.sku)}
              </li>
            ))}
          </ul>
        </div>

        <div className="card card-body row wrap between">
          <div>
            <h2>¿Algo no ha ido bien?</h2>
            <p className="small muted">Si falta algo o ha llegado dañado, cuéntanoslo y lo revisamos.</p>
          </div>
          <button className="btn primary" disabled={sh.status === 'prepared'} onClick={() => navigate(`/cliente/seguimiento/${token}/problema`)} data-testid="report-problem">
            Reportar un problema
          </button>
        </div>
        {sh.status === 'prepared' && <p className="xsmall muted">Podrás reportar un problema cuando el pedido haya salido del almacén.</p>}
      </div>
    </CustomerShell>
  );
}
