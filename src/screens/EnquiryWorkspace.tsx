import { ArrowLeft, MessageCircle, Truck } from 'lucide-react';
import { fmtAge, fmtDate, fmtDateTime } from '../domain/format';
import * as ops from '../domain/ops';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { SourcePanel, EvidenceProvider } from '../components/SourcePanel';
import { Callout, Card, Pill, SimTag, useToast } from '../components/ui';
import { ShipmentStatus } from '../panels/ShipmentPanel';
import { NotFound } from '../App';

export function EnquiryWorkspace({ id }: { id: string }) {
  const { state, apply } = useStore();
  const toast = useToast();
  const e = state.enquiries[id];
  if (!e) return <NotFound />;
  const sh = state.shipments[e.shipmentId];
  const customer = state.customers[e.customerId];
  const confirmedReply = sh?.confirmedDelivery?.source.startsWith('Confirmado')
    ? `Hola, gracias por escribirnos. El transportista nos confirma la entrega de tu pedido ${e.orderId} el ${fmtDate(sh.confirmedDelivery.date)}${sh.confirmedDelivery.window ? ` entre las ${sh.confirmedDelivery.window.replace('–', ' y las ')}` : ''}. Puedes seguirlo aquí: [enlace de seguimiento].`
    : undefined;

  return (
    <EvidenceProvider>
      <button className="crumb" onClick={() => navigate('/seguimiento')}>
        <ArrowLeft size={15} /> Seguimiento
      </button>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="grow" style={{ minWidth: 280 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <h1>Consulta de entrega · {customer?.name}</h1>
              {e.status === 'open' ? <Pill tone="warn">Cliente esperando respuesta</Pill> : <Pill tone="ok">Respondida</Pill>}
            </div>
            <div className="ws-meta">
              <span className="strong">{e.id}</span>
              <span>{fmtAge(e.receivedAt)}</span>
              <button className="btn ghost sm" onClick={() => navigate(`/pedido/${e.orderId}`)}>
                Pedido {e.orderId}
              </button>
            </div>
          </div>
          <div className="next-box">
            <div>
              <div className="k">Siguiente paso</div>
              <div className="v">{e.status === 'open' ? 'Responder con el estado real del envío' : 'Sin acciones pendientes'}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="ws-grid">
        <div className="ws-col">
          <Card title="Mensaje del cliente" icon={<MessageCircle size={18} />}>
            <SourcePanel source={e.message} />
          </Card>
        </div>
        <div className="ws-col">
          {sh && (
            <Card title="Estado real del envío" icon={<Truck size={18} />} actions={<SimTag />}>
              <div className="stack lg">
                {sh.carrierUpdateMissing && (
                  <Callout tone="warn" title="Sin actualización del transportista">
                    Última noticia {fmtAge(sh.lastUpdateAt)} ({fmtDateTime(sh.lastUpdateAt)}). No damos una hora estimada que no esté confirmada.
                  </Callout>
                )}
                <ShipmentStatus sh={sh} />
                {sh.status === 'dispatched' && (
                  <div className="stack sm">
                    {!e.carrierRequestedAt ? (
                      <div>
                        <button className="btn" onClick={() => apply((s) => ops.requestCarrierUpdate(s, e.id))} data-testid="ask-carrier">
                          Pedir actualización al transportista
                        </button>
                      </div>
                    ) : (
                      <span className="small muted">Actualización pedida {fmtAge(e.carrierRequestedAt)} (simulado).</span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
          <Card title="Respuesta al cliente" icon={<MessageCircle size={18} />}>
            <div className="stack">
              <textarea className="textarea" style={{ minHeight: 130 }} value={e.replyDraft} disabled={e.status !== 'open'} onChange={(ev) => apply((s) => ops.updateReply(s, e.id, ev.target.value))} aria-label="Borrador de respuesta" />
              {confirmedReply && e.replyDraft !== confirmedReply && e.status === 'open' && (
                <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => apply((s) => ops.updateReply(s, e.id, confirmedReply))}>
                  Usar la información confirmada por el transportista
                </button>
              )}
              <p className="xsmall muted">La respuesta solo usa información confirmada. Si no hay actualización, se dice así en lugar de inventar una hora.</p>
              {e.status === 'open' && (
                <div className="row wrap">
                  <button
                    className="btn primary"
                    onClick={() => {
                      apply((s) => ops.markEnquiryAnswered(s, e.id));
                      toast('Consulta marcada como respondida. No se ha enviado ningún mensaje real.');
                    }}
                    data-testid="answer-enquiry"
                  >
                    Marcar como respondida (no se envía)
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </EvidenceProvider>
  );
}
