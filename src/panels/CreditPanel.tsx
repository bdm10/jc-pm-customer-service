import { useState } from 'react';
import { CreditCard, Lock } from 'lucide-react';
import { fmtDate, fmtEUR0, fmtEUR } from '../domain/format';
import * as ops from '../domain/ops';
import { creditExposure, customerOf } from '../domain/orders';
import type { Order } from '../domain/types';
import { useStore } from '../state/store';
import { RoleBadge } from '../components/common';
import { AsyncButton, Callout, Card, DemoBox, ErpTag, LockedButton, Pill, SimTag, useToast } from '../components/ui';

export function CreditPanel({ o }: { o: Order }) {
  const { state, apply, services } = useStore();
  const toast = useToast();
  const b = o.blockers.find((x) => x.type === 'credit');
  const c = customerOf(state, o);
  const e = creditExposure(state, o);
  const [note, setNote] = useState(() =>
    e
      ? `Pedido semanal habitual de la central. Con este pedido se supera el límite en ${fmtEUR0(e.excess)} y hay ${fmtEUR0(e.overdue)} vencidos desde hace ${e.oldestOverdueDays} días. ¿Se puede liberar o pedimos un pago a cuenta?`
      : '',
  );
  if (!b || !c || !e) return null;
  const cr = o.credit ?? {};
  const resolved = b.status === 'resolved';
  const pct = (v: number) => `${Math.min(100, (v / Math.max(e.after, e.limit)) * 100)}%`;
  const commercialPending = o.blockers.some((x) => x.type === 'commercial' && x.status !== 'resolved');

  return (
    <Card id="panel-credit" title="Bloqueo por límite de crédito" icon={<CreditCard size={18} />} actions={<ErpTag />}>
      <div className="stack lg">
        <Callout tone={resolved ? 'ok' : 'warn'} title={resolved ? 'Crédito resuelto por Finanzas' : 'Por qué está bloqueado'}>
          {resolved ? b.resolution : b.reason}
        </Callout>

        <div className="stack sm">
          <div className="row between">
            <h3>Datos de crédito</h3>
            <span className="xsmall muted">Datos sintéticos · consulta simulada</span>
          </div>
          <div className="facts" data-testid="credit-facts">
            <div className="fact">
              <div className="k">Límite de crédito</div>
              <div className="v">{fmtEUR0(e.limit)}</div>
            </div>
            <div className="fact">
              <div className="k">Saldo pendiente</div>
              <div className="v">{fmtEUR0(e.outstanding)}</div>
            </div>
            <div className={`fact ${e.overdue ? 'warn' : ''}`}>
              <div className="k">Vencido</div>
              <div className="v">{fmtEUR0(e.overdue)}</div>
              {e.overdue > 0 && <div className="xsmall">más antiguo: {e.oldestOverdueDays} días</div>}
            </div>
            <div className="fact">
              <div className="k">Este pedido (IVA incl.)</div>
              <div className="v">{fmtEUR(e.orderTotal)}</div>
            </div>
            <div className={`fact ${e.excess ? 'alert' : ''}`}>
              <div className="k">Exceso sobre el límite</div>
              <div className="v">{fmtEUR(e.excess)}</div>
            </div>
            <div className="fact">
              <div className="k">Cobertura del seguro</div>
              <div className="v">{fmtEUR0(e.insurerCoverage)}</div>
            </div>
            <div className="fact">
              <div className="k">Último pago</div>
              <div className="v">{c.credit.lastPayment.date ? fmtEUR0(c.credit.lastPayment.amount) : '—'}</div>
              {c.credit.lastPayment.date && <div className="xsmall">{fmtDate(c.credit.lastPayment.date)}</div>}
            </div>
            <div className="fact">
              <div className="k">Días medios de cobro</div>
              <div className="v">{c.credit.averageDaysToPay}</div>
            </div>
          </div>
          <div className="stack sm" style={{ marginTop: 6 }} aria-label="Saldo con el pedido frente al límite">
            <div className="meter">
              <span style={{ width: pct(e.outstanding), background: '#c8b38a' }} />
              <span style={{ left: pct(e.outstanding), width: `calc(${pct(e.after)} - ${pct(e.outstanding)})`, background: 'var(--alert)', opacity: 0.55 }} />
              <span className="limit" style={{ left: pct(e.limit) }} />
            </div>
            <div className="row between xsmall muted">
              <span>Saldo pendiente + este pedido = {fmtEUR0(e.after)}</span>
              <span>Límite {fmtEUR0(e.limit)}</span>
            </div>
          </div>
        </div>

        <div className="role-box stack sm">
          <div className="row wrap" style={{ gap: 8 }}>
            <Lock size={16} /> <strong>Quién decide:</strong> <RoleBadge role="finance" />
          </div>
          <div className="split2 small">
            <div>
              <strong>Atención al Cliente puede</strong>
              <ul className="plain">
                <li>Preparar la solicitud con el contexto</li>
                <li>Informar al comercial y al cliente</li>
              </ul>
            </div>
            <div>
              <strong>Atención al Cliente no puede</strong>
              <ul className="plain">
                <li>Liberar o anular un bloqueo de crédito</li>
                <li>Sustituirlo por una aprobación comercial</li>
              </ul>
            </div>
          </div>
          {commercialPending || o.deal.approval.status === 'approved' ? (
            <p className="xsmall muted">
              {o.deal.approval.status === 'approved' ? 'La excepción comercial ya está aprobada, pero eso no cambia este bloqueo.' : 'La excepción comercial de este pedido se aprueba por separado y no libera el crédito.'}
            </p>
          ) : null}
          <div>
            <LockedButton reason="Solo Finanzas puede liberar un bloqueo de crédito.">Liberar bloqueo de crédito</LockedButton>
          </div>
        </div>

        {!cr.requestedAt && (
          <div className="stack">
            <div className="field">
              <label className="label" htmlFor="credit-note">
                Solicitud a Finanzas
              </label>
              <textarea id="credit-note" className="textarea" value={note} onChange={(ev) => setNote(ev.target.value)} />
              <span className="xsmall muted">Se adjunta automáticamente el resumen del pedido, los datos de crédito y el cálculo de margen.</span>
            </div>
            <div>
              <AsyncButton
                className="btn primary"
                busyLabel="Enviando a Finanzas (simulado)…"
                testId="request-finance"
                onClick={async () => {
                  await services.approvals.requestApproval({ entityId: o.id, topic: 'credit', approver: 'finance', note });
                  apply((s) => ops.requestCreditReview(s, o.id, note));
                  toast('Solicitud enviada a Finanzas (simulado). No se ha enviado ningún email real.');
                }}
              >
                Solicitar revisión a Finanzas
              </AsyncButton>
            </div>
          </div>
        )}

        {cr.requestedAt && !cr.decision && (
          <div className="stack">
            <div className="row wrap">
              <Pill tone="neutral">Esperando a Finanzas</Pill>
              <SimTag />
              <span className="small muted">Solicitud: «{cr.requestNote}»</span>
            </div>
            <DemoBox title="simula la decisión de Finanzas (rol distinto de Atención al Cliente)">
              <div className="row wrap">
                <button className="btn demo" data-testid="finance-approve" onClick={() => apply((s) => ops.financeDecision(s, o.id, 'approved', 'Cliente con compromiso de pago esta semana; se libera este pedido.'))}>
                  Finanzas aprueba
                </button>
                <button
                  className="btn demo"
                  onClick={() => apply((s) => ops.financeDecision(s, o.id, 'approved_conditions', `Se libera tras recibir un pago a cuenta de ${fmtEUR0(e.overdue)} (vencido).`))}
                >
                  Aprueba con condiciones
                </button>
                <button className="btn demo" data-testid="finance-reject" onClick={() => apply((s) => ops.financeDecision(s, o.id, 'rejected', 'Vencidos sin plan de pago acordado.'))}>
                  Finanzas rechaza
                </button>
              </div>
            </DemoBox>
          </div>
        )}

        {cr.decision === 'rejected' && (
          <div className="stack">
            <Callout tone="alert" title="Finanzas no libera el pedido">
              {cr.decisionNote} El pedido sigue retenido. Atención al Cliente no puede anular esta decisión.
            </Callout>
            {!cr.informedAt ? (
              <div>
                <button className="btn primary" onClick={() => apply((s) => ops.informCreditRejection(s, o.id))}>
                  Preparar aviso al comercial (no se envía)
                </button>
              </div>
            ) : (
              <Pill tone="neutral">Esperando al comercial: propuesta de pago anticipado</Pill>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
