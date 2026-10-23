import { useState } from 'react';
import { ArrowLeft, Building2, Copy, ExternalLink, History, Link2, TriangleAlert, UserRound, Users } from 'lucide-react';
import { fmtAge, fmtDateTime } from '../domain/format';
import {
  canCreateAccount,
  CUSTOMER_FIELDS,
  GROUP_LABEL,
  INTERNAL_FIELDS,
  isCustomerFieldRequired,
  isValidSpanishTaxIdFormat,
  outstandingDecisions,
  SALES_FIELDS,
  sectionCompleteness,
} from '../domain/onboarding';
import * as ops from '../domain/ops';
import type { OnboardingCase } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { RoleBadge, Timeline } from '../components/common';
import { AsyncButton, Callout, Card, DemoBox, Pill, Progress, ProposedTag, SimTag, Tag, useToast } from '../components/ui';
import { NotFound } from '../App';
import { ONBOARDING_STATUS } from './Altas';

export function OnboardingWorkspace({ id }: { id: string }) {
  const { state } = useStore();
  const c = state.onboarding[id];
  if (!c) return <NotFound />;
  return <Workspace c={c} />;
}

function Workspace({ c }: { c: OnboardingCase }) {
  const { state, apply, begin, services } = useStore();
  const toast = useToast();
  const comp = sectionCompleteness(c);
  const pending = outstandingDecisions(c);
  const st = ONBOARDING_STATUS[c.status];
  const order = c.linkedOrderId ? state.orders[c.linkedOrderId] : undefined;
  const ready = canCreateAccount(c);
  const done = c.status === 'created' || c.status === 'merged';
  const events = state.events.filter((e) => e.entityId === c.id);

  const steps = [
    { l: 'Enlace enviado', ok: !!c.invite },
    { l: 'Datos del cliente', ok: !!c.customerSubmittedAt },
    { l: 'Revisión interna', ok: !!c.duplicateCheck?.decision && comp.internal.missing.length === 0 },
    { l: 'Decisión de Finanzas', ok: ['approved', 'approved_changes', 'rejected'].includes(c.finance.status) },
    { l: 'Cuenta creada', ok: c.status === 'created' },
  ];
  const currentStep = steps.findIndex((s) => !s.ok);

  return (
    <>
      <button className="crumb" onClick={() => navigate('/altas')}>
        <ArrowLeft size={15} /> Altas de clientes
      </button>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="grow" style={{ minWidth: 280 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <h1>{c.prospectName}</h1>
              <Pill tone={st.tone}>{st.label}</Pill>
            </div>
            <div className="ws-meta">
              <span className="strong">{c.id}</span>
              <span>Solicitada por {c.requestedBy}</span>
              <span>{fmtAge(c.createdAt)}</span>
              {order && (
                <button className="btn ghost sm" onClick={() => navigate(`/pedido/${order.id}`)}>
                  Pedido en espera: {order.id}
                </button>
              )}
            </div>
          </div>
          <div className="next-box" data-testid="next-action">
            <div className="grow">
              <div className="k">Siguiente paso</div>
              <div className="v">{done ? (c.status === 'created' ? 'Cuenta creada' : 'Reactivación de cuenta existente') : pending[0]?.text ?? 'Crear la cuenta'}</div>
              <div className="xsmall muted">{done ? 'Sin acciones pendientes en el alta.' : `Decide: ${pending[0]?.owner ?? 'Atención al Cliente'}`}</div>
            </div>
          </div>
        </div>
        <div className="stepper" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {steps.map((s, i) => (
            <div key={s.l} className={`step ${s.ok ? 'done' : i === currentStep ? 'current' : ''}`}>
              <div className="bar" />
              <span className="lbl">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ws-grid" style={{ gridTemplateColumns: 'minmax(0, 8fr) minmax(300px, 4fr)' }}>
        <div className="ws-col">
          <Card title="Enlace de alta para el cliente" icon={<Link2 size={18} />} actions={<SimTag />}>
            {c.invite ? (
              <div className="stack">
                <div className="link-box" data-testid="invite-link">
                  <span>{c.invite.url}</span>
                  <button
                    className="btn sm"
                    onClick={() =>
                      navigator.clipboard?.writeText(c.invite!.url).then(
                        () => toast('Enlace copiado. Es de demostración: solo funciona dentro del prototipo.'),
                        () => toast('No se ha podido copiar.', 'alert'),
                      )
                    }
                  >
                    <Copy size={14} /> Copiar
                  </button>
                  <button className="btn sm primary" onClick={() => navigate(`/cliente/alta/${c.invite!.token}`)} data-testid="open-customer-form">
                    <ExternalLink size={14} /> Ver como cliente
                  </button>
                </div>
                <p className="xsmall muted">
                  Generado {fmtDateTime(c.invite.createdAt)} · caduca {fmtDateTime(c.invite.expiresAt)} (simulado). En producción sería un enlace firmado de un solo uso; aquí no se envía nada al cliente.
                </p>
              </div>
            ) : (
              <div className="stack">
                <p className="small">El cliente recibe un enlace a un formulario sencillo. Solo rellena sus datos: no ve las condiciones comerciales ni la asignación interna.</p>
                <div>
                  <AsyncButton
                    className="btn primary"
                    busyLabel="Generando enlace (simulado)…"
                    testId="generate-invite"
                    onClick={async () => {
                      const act = begin();
                      const l = await services.links.createLink('onboarding', c.id);
                      act((s) => ops.generateInvite(s, c.id, l.token, l.url, l.expiresAt));
                      toast('Enlace de alta generado (simulado). No se ha enviado nada.');
                    }}
                  >
                    Generar enlace de alta
                  </AsyncButton>
                </div>
              </div>
            )}
          </Card>

          {c.duplicateCheck && c.duplicateCheck.candidates.length > 0 && <DuplicateCard c={c} />}

          <div className="split3">
            <OwnerSection title="Aporta el cliente" icon={<UserRound size={16} />} owner="Cliente (formulario)" done={comp.customer.done} total={comp.customer.total}>
              {!c.customerSubmittedAt && <p className="small muted">Pendiente de que el cliente envíe el formulario.</p>}
              {(['legal', 'billing', 'delivery', 'contact'] as const).map((g) => (
                <div key={g} className="stack sm">
                  <h4>{GROUP_LABEL[g]}</h4>
                  <dl className="kv" style={{ gridTemplateColumns: '1fr', gap: 2 }}>
                    {CUSTOMER_FIELDS.filter((f) => f.group === g).map((f) => {
                      const v = c.customerData[f.key];
                      const req = isCustomerFieldRequired(f.key, c.customerData);
                      return (
                        <div key={f.key} style={{ marginBottom: 6 }}>
                          <dt className="xsmall">
                            {f.label}
                            {!req && ' (opcional)'}
                          </dt>
                          <dd className="small">
                            {v ? v : <span className="muted">{req ? 'Pendiente' : '—'}</span>}
                            {f.key === 'taxId' && v && (isValidSpanishTaxIdFormat(v) ? <Tag tone="ok">Formato válido</Tag> : <Tag tone="warn">Revisar formato</Tag>)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
              {c.customerData.taxId && <p className="xsmall muted">Solo se valida el formato del NIF. La comprobación real con la AEAT requiere integración.</p>}
            </OwnerSection>

            <OwnerSection title="Aporta el comercial" icon={<Users size={16} />} owner={`Comercial — ${c.salesData.accountOwner ?? '—'}`} done={comp.sales.done} total={comp.sales.total}>
              <p className="xsmall muted">Propiedad de la cuenta y condiciones propuestas. Son propuestas: las decide Finanzas y Dirección comercial.</p>
              {SALES_FIELDS.map((f) => (
                <div key={f.key} className="field">
                  <label className="label" htmlFor={`sales-${f.key}`}>
                    {f.label}
                    {!f.required && ' (opcional)'}
                  </label>
                  <input id={`sales-${f.key}`} className="input" disabled={done} value={c.salesData[f.key] ?? ''} onChange={(e) => apply((s) => ops.updateSalesData(s, c.id, f.key, e.target.value))} />
                </div>
              ))}
            </OwnerSection>

            <OwnerSection title="Asigna el equipo interno" icon={<Building2 size={16} />} owner="Administración / Finanzas" done={comp.internal.done + (['approved', 'approved_changes', 'rejected'].includes(c.finance.status) ? 1 : 0)} total={comp.internal.total + 1}>
              <p className="xsmall muted">Dimensiones contables (valores de ejemplo) y decisión de Finanzas. El cliente y el comercial no los ven.</p>
              {INTERNAL_FIELDS.map((f) => (
                <div key={f.key} className="field">
                  <label className="label" htmlFor={`int-${f.key}`}>
                    {f.label}
                  </label>
                  <select id={`int-${f.key}`} className="select" disabled={done} value={c.internal[f.key] ?? ''} onChange={(e) => apply((s) => ops.updateInternal(s, c.id, f.key, e.target.value))}>
                    <option value="">Sin asignar</option>
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  {!c.internal[f.key] && !done && (
                    <button className="btn ghost sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => apply((s) => ops.updateInternal(s, c.id, f.key, f.suggestion))}>
                      Usar sugerencia: {f.suggestion}
                    </button>
                  )}
                </div>
              ))}
              <FinanceBox c={c} />
            </OwnerSection>
          </div>

          {c.status === 'created' ? (
            <Callout tone="ok" title={`Cuenta ${c.createdCustomerId} creada en el ERP (simulado)`}>
              Se ha vinculado al pedido {c.linkedOrderId}, que ya puede revisarse y enviarse al ERP.{' '}
              {order && (
                <button className="btn sm primary" onClick={() => navigate(`/pedido/${order.id}`)} style={{ marginLeft: 6 }}>
                  Ir al pedido {order.id}
                </button>
              )}
            </Callout>
          ) : c.status === 'merged' ? (
            <Callout tone="neutral" title="Se gestionará como reactivación de una cuenta existente">
              {c.duplicateCheck?.decisionNote} La reactivación requiere decisión de Finanzas y queda fuera del alcance del prototipo.
            </Callout>
          ) : (
            <div className="card card-body row wrap" style={{ justifyContent: 'space-between' }}>
              <div className="small">
                {ready
                  ? c.finance.status === 'rejected'
                    ? 'Todo completo. La cuenta se creará sin crédito: los pedidos requerirán pago anticipado.'
                    : 'Todo completo y decidido. Puedes crear la cuenta.'
                  : 'La cuenta se crea cuando los datos están completos, el posible duplicado está decidido y Finanzas ha decidido.'}
              </div>
              <AsyncButton
                className="btn primary lg"
                disabled={!ready}
                busyLabel="Creando cuenta en el ERP (simulado)…"
                testId="create-account"
                onClick={async () => {
                  const act = begin();
                  const r = await services.erp.createCustomer(c.id);
                  act((s) => ops.createAccount(s, c.id, r.customerId));
                  toast(`Cuenta ${r.customerId} creada (simulado). El pedido ${c.linkedOrderId} queda desbloqueado.`);
                }}
              >
                Crear cuenta en el ERP
              </AsyncButton>
            </div>
          )}
        </div>

        <div className="ws-col">
          <Card title="Qué falta y quién decide" icon={<TriangleAlert size={18} />}>
            {pending.length ? (
              <ul className="plain small stack sm" data-testid="outstanding">
                {pending.map((p) => (
                  <li key={p.text}>
                    {p.text} — <strong>{p.owner}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small">Nada pendiente.</p>
            )}
          </Card>
          <Card title="Historial" icon={<History size={18} />} actions={<SimTag />}>
            <Timeline events={events} />
          </Card>
        </div>
      </div>
    </>
  );
}

function OwnerSection({ title, icon, owner, done, total, children }: { title: string; icon: React.ReactNode; owner: string; done: number; total: number; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head" style={{ display: 'block' }}>
        <div className="row" style={{ gap: 8 }}>
          {icon}
          <h2 style={{ fontSize: '1rem' }}>{title}</h2>
        </div>
        <div className="xsmall muted" style={{ margin: '4px 0 8px' }}>
          Responsable: {owner}
        </div>
        <Progress value={done} total={total} />
      </div>
      <div className="card-body stack">{children}</div>
    </section>
  );
}

function DuplicateCard({ c }: { c: OnboardingCase }) {
  const { apply } = useStore();
  const [note, setNote] = useState('CIF distinto y la cuenta antigua comunicó el cese de actividad en 2023.');
  const d = c.duplicateCheck!;
  const cand = d.candidates[0];
  return (
    <section className="card" style={{ borderColor: 'var(--warn-border)' }} data-testid="duplicate-warning">
      <div className="card-head" style={{ background: 'var(--warn-bg)' }}>
        <TriangleAlert size={18} color="var(--warn)" />
        <h2>Posible cliente duplicado</h2>
        <div className="actions">
          <ProposedTag>Comprobación propuesta</ProposedTag>
          {d.decision ? <Pill tone="ok">Decidido</Pill> : <Pill tone="warn">Pendiente de decidir</Pill>}
        </div>
      </div>
      <div className="card-body stack">
        <div className="split2">
          <div className="role-box small">
            <div className="xsmall muted strong">ALTA NUEVA</div>
            <div className="strong">{c.customerData.legalName}</div>
            <div>{c.customerData.tradeName}</div>
            <div>NIF {c.customerData.taxId}</div>
            <div>{c.customerData.deliveryAddress}</div>
          </div>
          <div className="role-box small">
            <div className="xsmall muted strong">CUENTA EXISTENTE {cand.customerId}</div>
            <div className="strong">{cand.name}</div>
            <div>NIF {cand.taxId}</div>
            <div>{cand.address}</div>
            <div style={{ color: 'var(--warn)' }}>{cand.status}</div>
          </div>
        </div>
        <div className="small">
          <strong>Coincidencias ({cand.score} / 100):</strong> {cand.reasons.join(' · ')}
        </div>
        {d.decision ? (
          <Callout tone="ok" title={d.decision === 'different' ? 'No es el mismo cliente: se continúa el alta' : 'Es el mismo cliente'}>
            {d.decisionNote}
          </Callout>
        ) : (
          <>
            <div className="field">
              <label className="label" htmlFor="dup-note">
                Motivo de la decisión
              </label>
              <input id="dup-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="row wrap">
              <button className="btn primary" disabled={!note.trim()} onClick={() => apply((s) => ops.decideDuplicate(s, c.id, 'different', note))} data-testid="dup-different">
                Es otra empresa: continuar el alta
              </button>
              <button className="btn" disabled={!note.trim()} onClick={() => apply((s) => ops.decideDuplicate(s, c.id, 'same', note))}>
                Es el mismo cliente: gestionar como reactivación
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FinanceBox({ c }: { c: OnboardingCase }) {
  const { apply, begin, services } = useStore();
  const f = c.finance;
  return (
    <div className="role-box stack sm" data-testid="onboarding-finance">
      <div className="row between wrap">
        <strong className="small">Decisión de Finanzas</strong>
        <RoleBadge role="finance" />
      </div>
      {f.status === 'not_requested' && (
        <>
          <p className="xsmall muted">
            Propuesta del comercial: {c.salesData.proposedCreditLimit ?? '—'} · {c.salesData.proposedPaymentTerms ?? '—'}
          </p>
          <AsyncButton
            className="btn sm primary"
            disabled={!c.customerSubmittedAt}
            busyLabel="Enviando (simulado)…"
            testId="request-onboarding-finance"
            onClick={async () => {
              const act = begin();
              await services.approvals.requestApproval({ entityId: c.id, topic: 'onboarding_credit', approver: 'finance', note: 'Alta de cliente' });
              act((s) => ops.requestOnboardingFinance(s, c.id));
            }}
          >
            Solicitar decisión a Finanzas
          </AsyncButton>
          {!c.customerSubmittedAt && <span className="xsmall muted">Disponible cuando el cliente envíe sus datos.</span>}
        </>
      )}
      {f.status === 'requested' && (
        <DemoBox title="simula la decisión de Finanzas">
          <div className="stack sm">
            <button className="btn demo sm" data-testid="onboarding-finance-approve" onClick={() => apply((s) => ops.onboardingFinanceDecision(s, c.id, 'approved'))}>
              Aprueba la propuesta
            </button>
            <button className="btn demo sm" onClick={() => apply((s) => ops.onboardingFinanceDecision(s, c.id, 'approved_changes'))}>
              Aprueba con límite reducido
            </button>
            <button className="btn demo sm" onClick={() => apply((s) => ops.onboardingFinanceDecision(s, c.id, 'rejected'))}>
              Sin crédito: solo pago anticipado
            </button>
          </div>
        </DemoBox>
      )}
      {['approved', 'approved_changes', 'rejected'].includes(f.status) && (
        <div className="small">
          <Pill tone={f.status === 'rejected' ? 'warn' : 'ok'}>{f.status === 'rejected' ? 'Sin crédito: pago anticipado' : 'Aprobado'}</Pill>
          <div style={{ marginTop: 6 }}>
            Límite: <strong>{f.creditLimit}</strong> · {f.paymentTerms}
          </div>
          <div className="xsmall muted">{f.note}</div>
        </div>
      )}
    </div>
  );
}
