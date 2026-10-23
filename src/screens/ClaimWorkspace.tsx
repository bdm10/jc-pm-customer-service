import { ArrowLeft, Camera, ClipboardList, History, Lock } from 'lucide-react';
import { CLAIM_TYPE_LABEL, ROLE_LABEL } from '../domain/labels';
import { fmtAge, fmtDateTime } from '../domain/format';
import * as ops from '../domain/ops';
import { productLabel } from '../domain/orders';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel, RoleBadge, Timeline } from '../components/common';
import { Callout, Card, DemoBox, Pill, SimTag } from '../components/ui';
import { NotFound } from '../App';
import { CLAIM_STATUS } from './Incidencias';

export function ClaimWorkspace({ id }: { id: string }) {
  const { state, apply } = useStore();
  const c = state.claims[id];
  if (!c) return <NotFound />;
  const customer = state.customers[c.customerId];
  const events = state.events.filter((e) => e.entityId === c.id);
  const pendingProposal = c.proposals.find((p) => p.status === 'requested');
  const st = CLAIM_STATUS[c.status];

  return (
    <>
      <button className="crumb" onClick={() => navigate('/incidencias')}>
        <ArrowLeft size={15} /> Incidencias
      </button>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="grow" style={{ minWidth: 280 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <h1>
                {CLAIM_TYPE_LABEL[c.type]} · {customer?.name}
              </h1>
              <Pill tone={st.tone}>{st.label}</Pill>
            </div>
            <div className="ws-meta">
              <span className="strong">{c.id}</span>
              <ChannelLabel channel={c.channel} />
              <span>{fmtAge(c.createdAt)}</span>
              <span>Responsable: {c.owner}</span>
              <button className="btn ghost sm" onClick={() => navigate(`/pedido/${c.orderId}`)}>
                Pedido {c.orderId}
              </button>
            </div>
          </div>
          <div className="next-box" data-testid="next-action">
            <div>
              <div className="k">Siguiente paso</div>
              <div className="v">{c.nextAction}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="ws-grid">
        <div className="ws-col">
          <Card title="Lo que reporta el cliente" icon={<ClipboardList size={18} />}>
            <div className="stack">
              <p>{c.description}</p>
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Unidades afectadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.items.map((i) => (
                      <tr key={i.sku}>
                        <td>{productLabel(state, i.sku)}</td>
                        <td className="num">{i.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="stack sm">
                <h4>Evidencias</h4>
                <div className="row wrap">
                  {c.evidence.length === 0 && <span className="small muted">Sin evidencias adjuntas.</span>}
                  {c.evidence.map((e) => (
                    <div key={e.name} className="photo-sample">
                      <Camera size={20} />
                      <div>{e.name}</div>
                      <div>{e.sample ? '(foto de ejemplo)' : '(archivo local, no se sube)'}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="small muted">Contacto: {c.contact || '—'}</div>
            </div>
          </Card>
          <Card title="Historial" icon={<History size={18} />} actions={<SimTag />}>
            <Timeline events={events} />
          </Card>
        </div>
        <div className="ws-col">
          <Card title="Gestión de la incidencia" icon={<Lock size={18} />}>
            <div className="stack lg">
              <Callout tone="info" title="Sin abonos ni reposiciones automáticas">
                El prototipo no emite abonos ni envía reposiciones. Atención al Cliente propone una solución y la aprueba el rol correspondiente.
              </Callout>
              <div className="stack sm">
                <h3>1 · Comprobar con el almacén</h3>
                {!c.warehouseCheck ? (
                  <div>
                    <button className="btn primary" onClick={() => apply((s) => ops.requestWarehouseCheck(s, c.id))} disabled={c.status === 'resolved'} data-testid="claim-warehouse">
                      Pedir comprobación al almacén
                    </button>
                  </div>
                ) : c.warehouseCheck.result ? (
                  <Callout tone="ok" title="Respuesta del almacén (simulada)">
                    {c.warehouseCheck.result}
                  </Callout>
                ) : (
                  <DemoBox title="simula la respuesta del almacén">
                    <button className="btn demo" onClick={() => apply((s) => ops.simulateWarehouseResult(s, c.id))} data-testid="claim-warehouse-result">
                      El almacén responde
                    </button>
                  </DemoBox>
                )}
              </div>
              <div className="stack sm">
                <h3>2 · Proponer una solución</h3>
                <div className="row wrap">
                  <button className="btn" disabled={!c.warehouseCheck?.result || !!pendingProposal || c.status === 'resolved'} onClick={() => apply((s) => ops.proposeClaimResolution(s, c.id, 'credit_note'))} data-testid="claim-propose-credit">
                    Proponer abono
                  </button>
                  <button className="btn" disabled={!c.warehouseCheck?.result || !!pendingProposal || c.status === 'resolved'} onClick={() => apply((s) => ops.proposeClaimResolution(s, c.id, 'replacement'))}>
                    Proponer reposición
                  </button>
                </div>
                <span className="xsmall muted">
                  Abono → aprueba {ROLE_LABEL.finance}. Reposición → aprueba {ROLE_LABEL.logistics}. Reglas provisionales.
                </span>
                {c.proposals.map((p) => (
                  <div key={p.id} className="row wrap small" style={{ gap: 8 }}>
                    <strong>{p.kind === 'credit_note' ? 'Abono' : 'Reposición'}</strong>
                    <RoleBadge role={p.approver} />
                    <Pill tone={p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'alert' : 'neutral'}>{p.status === 'approved' ? 'Aprobada' : p.status === 'rejected' ? 'Rechazada' : 'En aprobación'}</Pill>
                    <span className="muted">{fmtDateTime(p.requestedAt)}</span>
                  </div>
                ))}
                {pendingProposal && (
                  <DemoBox title={`simula la decisión de ${ROLE_LABEL[pendingProposal.approver]}`}>
                    <div className="row wrap">
                      <button className="btn demo" onClick={() => apply((s) => ops.decideClaimProposal(s, c.id, pendingProposal.id, true))} data-testid="claim-approve">
                        Aprueba
                      </button>
                      <button className="btn demo" onClick={() => apply((s) => ops.decideClaimProposal(s, c.id, pendingProposal.id, false))}>
                        Rechaza
                      </button>
                    </div>
                  </DemoBox>
                )}
              </div>
              <div className="stack sm">
                <h3>3 · Cerrar</h3>
                <div>
                  <button className="btn" disabled={c.status === 'resolved' || !c.proposals.some((p) => p.status === 'approved')} onClick={() => apply((s) => ops.closeClaim(s, c.id))}>
                    Cerrar incidencia
                  </button>
                </div>
                {c.status === 'resolved' && <Pill tone="ok">Cerrada</Pill>}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
