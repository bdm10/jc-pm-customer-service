import { ExternalLink } from 'lucide-react';
import { fmtAge, fmtDate } from '../domain/format';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel } from '../components/common';
import { Pill } from '../components/ui';

const SHIP_STATUS = { prepared: 'Envío preparado', dispatched: 'Expedido', delivered: 'Entregado' } as const;

export function Seguimiento() {
  const { state } = useStore();
  const shipments = Object.values(state.shipments).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const enquiries = Object.values(state.enquiries);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Seguimiento</h1>
          <p>Envíos preparados, en tránsito y entregados, con la fecha solicitada separada de la información confirmada. Incluye las consultas de entrega de clientes.</p>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 0 }}>
        <h2>Consultas de entrega</h2>
        <span className="count">{enquiries.filter((e) => e.status === 'open').length} abiertas</span>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Consulta</th>
              <th>Cliente</th>
              <th>Canal</th>
              <th>Pedido</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => navigate(`/consulta/${e.id}`)}>
                <td>
                  <div className="strong">{e.id}</div>
                  <div className="xsmall muted">{fmtAge(e.receivedAt)}</div>
                </td>
                <td>{state.customers[e.customerId]?.name}</td>
                <td className="small">
                  <ChannelLabel channel={e.channel} />
                </td>
                <td className="small">{e.orderId}</td>
                <td>{e.status === 'open' ? <Pill tone="warn">Cliente esperando respuesta</Pill> : <Pill tone="ok">Respondida</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">
        <h2>Envíos</h2>
        <span className="count">{shipments.length}</span>
      </div>
      <div className="card table-wrap">
        <table className="t" data-testid="shipments">
          <thead>
            <tr>
              <th>Envío</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Fecha solicitada</th>
              <th>Entrega confirmada</th>
              <th>Última actualización</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="strong">{s.id}</div>
                  <div className="xsmall muted">{s.orderIds.join(' + ')}</div>
                </td>
                <td>{state.customers[s.customerId]?.name}</td>
                <td>
                  <Pill tone={s.status === 'delivered' ? 'ok' : 'info'}>{SHIP_STATUS[s.status]}</Pill>
                  {s.carrierUpdateMissing && (
                    <div style={{ marginTop: 4 }}>
                      <Pill tone="warn">Sin actualización</Pill>
                    </div>
                  )}
                </td>
                <td className="small">{fmtDate(s.requestedDate)}</td>
                <td className="small">{s.confirmedDelivery ? `${fmtDate(s.confirmedDelivery.date)}${s.confirmedDelivery.window ? ` · ${s.confirmedDelivery.window}` : ''}` : <span className="muted">Sin confirmar</span>}</td>
                <td className="small">{fmtAge(s.lastUpdateAt)}</td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn sm" onClick={() => navigate(`/pedido/${s.orderIds[0]}`)}>
                      Pedido
                    </button>
                    <button className="btn sm" onClick={() => navigate(`/cliente/seguimiento/${s.tracking.token}`)} data-testid={`tracking-${s.id}`}>
                      <ExternalLink size={14} /> Vista del cliente
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
