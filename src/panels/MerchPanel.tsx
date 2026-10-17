import { Megaphone } from 'lucide-react';
import { ROLE_LABEL } from '../domain/labels';
import { fmtEUR0 } from '../domain/format';
import * as ops from '../domain/ops';
import type { MerchCategory, Order } from '../domain/types';
import { useStore } from '../state/store';
import { AsyncButton, Callout, Card, DemoBox, ErpTag, Pill, ProvisionalTag, Tag, useToast } from '../components/ui';

const statusPill = (v: string) => {
  switch (v) {
    case 'auto':
      return <Pill tone="ok">Automática (provisional)</Pill>;
    case 'approved':
      return <Pill tone="ok">Aprobado</Pill>;
    case 'rejected':
      return <Pill tone="alert">Rechazado</Pill>;
    case 'requested':
      return <Pill tone="neutral">Solicitado</Pill>;
    case 'pending':
      return <Pill tone="warn">Por solicitar</Pill>;
    default:
      return <Pill tone="neutral">No aplica</Pill>;
  }
};

export function MerchPanel({ o }: { o: Order }) {
  const { state, apply, begin, services } = useStore();
  const toast = useToast();
  const m = o.merch;
  const b = o.blockers.find((x) => x.type === 'merchandising');
  if (!m || !b) return null;
  const resolved = b.status === 'resolved';
  const merchLines = o.lines.filter((l) => state.products[l.sku]?.kind === 'merch');
  const value = merchLines.reduce((acc, l) => acc + (state.products[l.sku].unitCost ?? 0) * l.quantity, 0);
  const remaining = m.budget.quarterly - m.budget.used - (resolved ? 0 : value);
  const cats = (['A', 'B', 'C'] as MerchCategory[]).filter((k) => merchLines.some((l) => state.products[l.sku].merchCategory === k) || m.approvals[k] === 'rejected');
  const anyPending = cats.some((k) => m.approvals[k] === 'pending');
  const anyRequested = cats.some((k) => m.approvals[k] === 'requested');
  const canResolve = !anyPending && !anyRequested && (!m.shortfall || !!m.shortfall.decision);
  const shortLine = m.shortfall ? o.lines.find((l) => l.id === m.shortfall!.lineId) : undefined;

  return (
    <Card id="panel-merchandising" title="Material promocional (merchandising)" icon={<Megaphone size={18} />} actions={<ErpTag />}>
      <div className="stack lg">
        <Callout tone="warn" title="Categorías y reglas provisionales">
          Las categorías A/B/C, los límites y quién aprueba son una propuesta para discutir con PM. No reflejan una política aprobada.
        </Callout>

        <div className="table-wrap">
          <table className="t" data-testid="merch-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Categoría</th>
                <th className="num">Cantidad</th>
                <th className="num">Disponible</th>
                <th className="num">Valor</th>
                <th>Regla (provisional)</th>
                <th>Aprobación</th>
              </tr>
            </thead>
            <tbody>
              {merchLines.map((l) => {
                const p = state.products[l.sku];
                const cat = p.merchCategory!;
                const rule = ops.MERCH_RULES[cat];
                const avail = state.stock[l.sku] ?? 0;
                const short = m.shortfall?.lineId === l.id;
                return (
                  <tr key={l.id} className={short && !m.shortfall?.decision ? 'review' : ''}>
                    <td className="strong">{p.name}</td>
                    <td>
                      <Tag>{cat}</Tag> <span className="small">{rule.label}</span>
                    </td>
                    <td className="num">
                      {l.quantity}
                      {l.backorderQty ? <div className="xsmall muted">+{l.backorderQty} después</div> : null}
                    </td>
                    <td className="num">{short ? m.shortfall!.available : avail}</td>
                    <td className="num">{fmtEUR0((p.unitCost ?? 0) * l.quantity)}</td>
                    <td className="small">
                      {rule.rule}
                      {rule.approver && <div className="xsmall muted">Aprueba: {ROLE_LABEL[rule.approver]}</div>}
                    </td>
                    <td>{statusPill(m.approvals[cat])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="role-box small">
          <div className="row between wrap">
            <span>
              <strong>Presupuesto trimestral de material del comercial</strong> <span className="muted">(sintético)</span>
            </span>
            <ProvisionalTag />
          </div>
          <div className="row wrap" style={{ gap: 18, marginTop: 6 }}>
            <span>Total {fmtEUR0(m.budget.quarterly)}</span>
            <span>Usado {fmtEUR0(m.budget.used)}</span>
            {!resolved && <span>Este pedido {fmtEUR0(value)}</span>}
            <span className={remaining < 0 ? 'strong' : ''} style={{ color: remaining < 0 ? 'var(--alert)' : undefined }}>
              Quedaría {fmtEUR0(remaining)}
            </span>
          </div>
        </div>

        {m.shortfall && shortLine && (
          <div className="stack sm">
            <h3>Disponibilidad: {state.products[shortLine.sku].name}</h3>
            <p className="small">
              Se piden {m.shortfall.requested} y hay {m.shortfall.available}. Elige cómo seguir:
            </p>
            {(
              [
                ['split', `Enviar ${m.shortfall.available} ahora y ${m.shortfall.requested - m.shortfall.available} cuando haya stock`, 'Segunda entrega solo de este material.'],
                ['reduce', `Reducir a ${m.shortfall.available}`, 'Se informa al comercial.'],
                ['wait', `Esperar a tener los ${m.shortfall.requested}`, 'El material queda pendiente; el vino puede salir antes si el comercial lo acepta.'],
              ] as const
            ).map(([id, label, help]) => (
              <label key={id} className={`choice ${m.shortfall?.decision === id ? 'selected' : ''} ${resolved ? 'disabled' : ''}`}>
                <input type="radio" name="shortfall" disabled={resolved} checked={m.shortfall?.decision === id} onChange={() => apply((s) => ops.decideShortfall(s, o.id, id))} />
                <div>
                  <div className="strong">{label}</div>
                  <div className="small muted">{help}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {!resolved && (
          <div className="stack">
            {anyPending && (
              <div>
                <AsyncButton
                  className="btn primary"
                  busyLabel="Enviando solicitudes (simulado)…"
                  testId="request-merch"
                  onClick={async () => {
                    const act = begin();
                    for (const k of cats) {
                      const approver = ops.MERCH_RULES[k].approver;
                      if (m.approvals[k] === 'pending' && approver) await services.approvals.requestApproval({ entityId: o.id, topic: 'merchandising', approver, note: `Material categoría ${k}` });
                    }
                    act((s) => ops.requestMerchApprovals(s, o.id));
                    toast('Solicitudes de aprobación enviadas (simulado).');
                  }}
                >
                  Solicitar aprobaciones
                </AsyncButton>
              </div>
            )}
            {anyRequested && (
              <DemoBox title="simula las decisiones de los aprobadores">
                <div className="stack sm">
                  {cats
                    .filter((k) => m.approvals[k] === 'requested')
                    .map((k) => {
                      const who = ROLE_LABEL[ops.MERCH_RULES[k].approver!];
                      return (
                        <div key={k} className="row wrap">
                          <span className="small grow">
                            Categoría {k} · {who}
                          </span>
                          <button className="btn demo sm" data-testid={`merch-approve-${k}`} onClick={() => apply((s) => ops.merchDecision(s, o.id, k, true))}>
                            Aprueba
                          </button>
                          <button className="btn demo sm" onClick={() => apply((s) => ops.merchDecision(s, o.id, k, false))}>
                            Rechaza
                          </button>
                        </div>
                      );
                    })}
                </div>
              </DemoBox>
            )}
            <div>
              <button
                className="btn primary"
                disabled={!canResolve || b.status === 'waiting' && b.waitingOn === 'logistics'}
                data-testid="resolve-merch"
                onClick={() => {
                  apply((s) => ops.resolveMerch(s, o.id));
                  toast('Bloqueo de merchandising resuelto. Ya puedes liberar el pedido.');
                }}
              >
                Resolver bloqueo de merchandising
              </button>
              {!canResolve && <div className="xsmall muted" style={{ marginTop: 6 }}>Falta decidir la disponibilidad y tener todas las aprobaciones.</div>}
            </div>
          </div>
        )}
        {b.status === 'waiting' && b.waitingOn === 'logistics' && (
          <div className="stack sm">
            <Callout tone="neutral" title="Esperando material">
              Las aprobaciones están registradas, pero se decidió esperar a tener todo el material. El pedido sigue retenido.
            </Callout>
            <DemoBox title="simula la llegada del material">
              <button className="btn demo" onClick={() => apply((s) => ops.simulateMerchReceipt(s, o.id))}>
                Llega el material pendiente
              </button>
            </DemoBox>
          </div>
        )}
        {resolved && <Callout tone="ok" title="Merchandising resuelto">{b.resolution}</Callout>}
      </div>
    </Card>
  );
}
