import { useState } from 'react';
import { Search } from 'lucide-react';
import { BLOCKER_LABEL, STAGE_LABEL } from '../domain/labels';
import { fmtDate, fmtEUR } from '../domain/format';
import { customerName, openBlockers, orderAmount } from '../domain/orders';
import type { Order } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel } from '../components/common';
import { Pill, Tag } from '../components/ui';

const FILTERS: { id: string; label: string; match: (o: Order) => boolean }[] = [
  { id: 'all', label: 'Todos', match: () => true },
  { id: 'draft', label: 'Borradores', match: (o) => o.stage === 'draft' || o.stage === 'approved' },
  { id: 'blocked', label: 'Retenidos en ERP', match: (o) => o.stage === 'erp_confirmed' && openBlockers(o).length > 0 },
  { id: 'released', label: 'Liberados', match: (o) => o.stage === 'released' },
  { id: 'shipping', label: 'En envío', match: (o) => o.stage === 'shipment_prepared' || o.stage === 'dispatched' },
  { id: 'delivered', label: 'Entregados', match: (o) => o.stage === 'delivered' },
];

export function Pedidos() {
  const { state } = useStore();
  const [f, setF] = useState('all');
  const [company, setCompany] = useState<'all' | 'PM' | 'JC'>('all');
  const [q, setQ] = useState('');
  const orders = Object.values(state.orders)
    .filter((o) => FILTERS.find((x) => x.id === f)!.match(o))
    .filter((o) => company === 'all' || o.company === company)
    .filter((o) => !q.trim() || `${o.id} ${o.erpNumber ?? ''} ${customerName(state, o)}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos</h1>
          <p>Todos los pedidos por fase: borradores de la capa de captura, pedidos en el ERP, retenidos, liberados y en envío.</p>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filters">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Buscar pedido o cliente" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pedidos" />
          </div>
          <select className="select" style={{ width: 'auto' }} value={company} onChange={(e) => setCompany(e.target.value as 'all' | 'PM' | 'JC')} aria-label="Empresa">
            <option value="all">JC y PM</option>
            <option value="PM">Solo PM</option>
            <option value="JC">Solo JC</option>
          </select>
          <div className="chips">
            {FILTERS.map((x) => (
              <button key={x.id} className="chip" aria-pressed={f === x.id} onClick={() => setF(x.id)}>
                {x.label} <span className="muted">{Object.values(state.orders).filter(x.match).length}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Canal</th>
              <th>Fase</th>
              <th>Bloqueos</th>
              <th>Entrega solicitada</th>
              <th className="num">Importe neto</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const open = openBlockers(o);
              return (
                <tr key={o.id} className="clickable" onClick={() => navigate(`/pedido/${o.id}`)}>
                  <td>
                    <div className="strong">{o.erpNumber ?? o.id}</div>
                    <div className="xsmall muted">
                      {o.company}
                      {o.erpNumber && o.erpNumber !== o.id ? ` · borrador ${o.id}` : ''}
                    </div>
                  </td>
                  <td>{customerName(state, o)}</td>
                  <td className="small">
                    <ChannelLabel channel={o.channel} />
                  </td>
                  <td>
                    <Pill tone={o.stage === 'draft' ? 'info' : open.length ? 'warn' : o.stage === 'delivered' ? 'ok' : 'neutral'}>{open.length && o.stage === 'erp_confirmed' ? 'Retenido en ERP' : STAGE_LABEL[o.stage]}</Pill>
                  </td>
                  <td>
                    <div className="row wrap" style={{ gap: 4 }}>
                      {open.map((b) => (
                        <Tag key={b.id} tone={b.status === 'waiting' ? 'neutral' : 'warn'}>
                          {BLOCKER_LABEL[b.type]}
                        </Tag>
                      ))}
                      {!open.length && <span className="muted small">—</span>}
                    </div>
                  </td>
                  <td className="small">{fmtDate(o.requestedDeliveryDate)}</td>
                  <td className="num">{fmtEUR(orderAmount(state, o))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!orders.length && <div className="empty">No hay pedidos con estos filtros.</div>}
      </div>
    </>
  );
}
