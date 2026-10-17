import { MessageSquareText, Sparkles } from 'lucide-react';
import { OBSERVATION_KIND_HELP, OBSERVATION_KIND_LABEL } from '../domain/labels';
import { fmtDate, fromDateInput, isoDateInput } from '../domain/format';
import * as ops from '../domain/ops';
import { customerOf } from '../domain/orders';
import type { ObservationKind, Order } from '../domain/types';
import { useStore } from '../state/store';
import { showEvidence, useEvidence } from '../components/SourcePanel';
import { AsyncButton, Callout, Card, DemoBox, ErpTag, Pill, ProposedTag, useToast } from '../components/ui';

const KINDS: ObservationKind[] = ['standard_repeat', 'one_off_delivery', 'commercial', 'other'];

export function ObservationsPanel({ o }: { o: Order }) {
  const { state, apply, services } = useStore();
  const ev = useEvidence();
  const toast = useToast();
  const r = o.observation;
  const b = o.blockers.find((x) => x.type === 'observations');
  if (!r || !b) return null;
  const customer = customerOf(state, o);
  const readiness = ops.observationReadiness(o);
  const conflicts = ops.activeConflicts(o);
  const resolved = b.status === 'resolved';

  return (
    <Card id="panel-observations" title="Observaciones del pedido" icon={<MessageSquareText size={18} />} actions={<ErpTag />}>
      <div className="stack lg">
        <div className="stack sm">
          <span className="label">Nota original (se conserva tal cual)</span>
          <blockquote className="msg-body" style={{ margin: 0 }}>
            {r.originalNote}
          </blockquote>
          <p className="small muted">
            Hoy cualquier texto en este campo retiene el pedido. <ProposedTag>Propuesta</ProposedTag> El espacio divide la nota en partes, compara cada una con la ficha del cliente y su historial, y una persona confirma la clasificación.
          </p>
        </div>

        {r.segments.map((sg, i) => {
          const matchesFile = customer?.standardInstructions.find((si) => si.text === sg.text);
          return (
            <div key={sg.id} className="role-box stack" data-testid={`segment-${sg.id}`}>
              <div className="row between wrap">
                <h3>Parte {i + 1}</h3>
                {sg.classification ? <Pill tone={sg.classification === 'other' ? 'warn' : 'ok'}>{OBSERVATION_KIND_LABEL[sg.classification]}</Pill> : <Pill tone="warn">Sin clasificar</Pill>}
              </div>
              <div className="msg-body" style={{ background: '#fff' }}>
                {sg.text}
                <div>
                  <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => showEvidence(`ev-obs${i + 1}`, ev.set)}>
                    Ver en el origen
                  </button>
                </div>
              </div>
              <div className="callout tone-proposed" style={{ borderColor: 'var(--proposed-border)' }}>
                <Sparkles size={18} />
                <div className="stack sm grow">
                  <div className="title">Sugerencia: {OBSERVATION_KIND_LABEL[sg.suggestion]}</div>
                  <ul className="plain small" style={{ color: 'var(--text-2)' }}>
                    {sg.basis.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  {matchesFile && (
                    <div className="small">
                      En la ficha: «{matchesFile.text}» · desde {matchesFile.since} · {matchesFile.seenIn}
                    </div>
                  )}
                  {!sg.classification && !resolved && (
                    <div>
                      <button className="btn sm" onClick={() => apply((s) => ops.classifySegment(s, o.id, sg.id, sg.suggestion))} data-testid={`accept-suggestion-${sg.id}`}>
                        Aceptar sugerencia
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <fieldset className="stack sm" style={{ border: 'none', padding: 0, margin: 0 }} disabled={resolved}>
                <legend className="label">Clasificación (la decide una persona)</legend>
                <div className="choice-grid">
                {KINDS.map((k) => (
                  <label key={k} className={`choice ${sg.classification === k ? 'selected' : ''} ${resolved ? 'disabled' : ''}`}>
                    <input type="radio" name={`cls-${sg.id}`} checked={sg.classification === k} onChange={() => apply((s) => ops.classifySegment(s, o.id, sg.id, k))} />
                    <div>
                      <div className="strong">{OBSERVATION_KIND_LABEL[k]}</div>
                      <div className="small muted">{OBSERVATION_KIND_HELP[k]}</div>
                    </div>
                  </label>
                ))}
                </div>
              </fieldset>
              {sg.classification === 'one_off_delivery' && (
                <div className="stack">
                  <h4>Datos estructurados del cambio puntual</h4>
                  <div className="form-grid">
                    <div className="field full">
                      <label className="label" htmlFor={`addr-${sg.id}`}>
                        Dirección de entrega para este pedido
                      </label>
                      <input id={`addr-${sg.id}`} className="input" disabled={resolved} value={sg.structured?.address ?? ''} onChange={(e) => apply((s) => ops.updateStructured(s, o.id, sg.id, { address: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`date-${sg.id}`}>
                        Fecha
                      </label>
                      <input
                        id={`date-${sg.id}`}
                        type="date"
                        className="input"
                        disabled={resolved}
                        value={sg.structured?.date ? isoDateInput(sg.structured.date) : ''}
                        onChange={(e) => e.target.value && apply((s) => ops.updateStructured(s, o.id, sg.id, { date: fromDateInput(e.target.value) }))}
                      />
                      {sg.structured?.date && <span className="xsmall muted">{fmtDate(sg.structured.date)}</span>}
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`win-${sg.id}`}>
                        Franja horaria
                      </label>
                      <input id={`win-${sg.id}`} className="input" disabled={resolved} value={sg.structured?.window ?? ''} onChange={(e) => apply((s) => ops.updateStructured(s, o.id, sg.id, { window: e.target.value }))} />
                    </div>
                    <div className="field full">
                      <label className="label" htmlFor={`ct-${sg.id}`}>
                        Contacto en destino (opcional)
                      </label>
                      <input id={`ct-${sg.id}`} className="input" disabled={resolved} placeholder="Nombre y teléfono de quien recibe" value={sg.structured?.contact ?? ''} onChange={(e) => apply((s) => ops.updateStructured(s, o.id, sg.id, { contact: e.target.value }))} />
                    </div>
                  </div>
                  <p className="xsmall muted">Aplica solo a este pedido. La ficha del cliente no se modifica.</p>
                </div>
              )}
            </div>
          );
        })}

        {conflicts.length > 0 && (
          <div className="stack">
            <h3>Conflictos a revisar</h3>
            {conflicts.map((c) => (
              <div key={c.id} className="role-box stack sm" data-testid={`conflict-${c.id}`}>
                <div className="row between wrap">
                  <strong>{c.title}</strong>
                  {c.chosen ? <Pill tone="ok">Revisado</Pill> : <Pill tone="warn">Pendiente</Pill>}
                </div>
                <p className="small">{c.detail}</p>
                {c.options.map((op) => (
                  <label key={op.id} className={`choice ${c.chosen === op.id ? 'selected' : ''} ${resolved ? 'disabled' : ''}`}>
                    <input type="radio" disabled={resolved} name={c.id} checked={c.chosen === op.id} onChange={() => apply((s) => ops.chooseConflict(s, o.id, c.id, op.id))} />
                    <div>
                      <div className="strong">{op.label}</div>
                      <div className="small muted">{op.consequence}</div>
                    </div>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {resolved ? (
          <Callout tone="ok" title="Bloqueo de observaciones resuelto">
            {b.resolution}
          </Callout>
        ) : b.status === 'waiting' ? (
          <div className="stack">
            <Callout tone="neutral" title="Esperando respuesta del cliente">
              El pedido sigue retenido hasta confirmar la dirección o la fecha.
            </Callout>
            <DemoBox title="simula la respuesta del cliente">
              <button className="btn demo" onClick={() => apply((s) => ops.simulateCustomerConfirmsObservation(s, o.id))}>
                El cliente confirma el cambio puntual
              </button>
            </DemoBox>
          </div>
        ) : (
          <div className="stack">
            {!readiness.ready && (
              <Callout tone="warn" title="Falta para resolver">
                <ul className="plain">
                  {readiness.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </Callout>
            )}
            <div>
              <AsyncButton
                className="btn primary"
                disabled={!readiness.ready}
                busyLabel="Actualizando el pedido (simulado)…"
                testId="resolve-observations"
                onClick={async () => {
                  await services.approvals.requestApproval({ entityId: o.id, topic: 'observations', approver: 'cs', note: 'Clasificación de observaciones' });
                  apply((s) => ops.resolveObservations(s, o.id));
                  toast(readiness.waitingCustomer ? 'Pendiente de respuesta del cliente.' : 'Observaciones resueltas. Ya puedes liberar el pedido.');
                }}
              >
                {readiness.waitingCustomer ? 'Guardar y consultar al cliente' : 'Resolver bloqueo de observaciones'}
              </AsyncButton>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
