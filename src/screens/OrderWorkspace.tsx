import { useState } from 'react';
import { ArrowLeft, Check, History, Inbox, ListChecks, Package, Pencil, ShieldCheck, UserPlus } from 'lucide-react';
import { BLOCKER_LABEL, ROLE_LABEL } from '../domain/labels';
import { fmtAge, fmtDate, fmtEUR, relativeDay } from '../domain/format';
import * as ops from '../domain/ops';
import { blockerOwner, blockerStatusText, customerName, customerOf, openBlockers, orderNextAction, pendingReviews, productLabel } from '../domain/orders';
import type { Blocker, Order } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel, RoleBadge, StageStepper, Timeline } from '../components/common';
import { EvidenceProvider, showEvidence, SourcePanel, useEvidence } from '../components/SourcePanel';
import { AsyncButton, Callout, Card, ErpTag, flashPanel, FutureButton, Pill, ProposedTag, SimTag, Tag, useToast } from '../components/ui';
import { NotFound } from '../App';
import { ObservationsPanel } from '../panels/ObservationsPanel';
import { CreditPanel } from '../panels/CreditPanel';
import { StockPanel } from '../panels/StockPanel';
import { MerchPanel } from '../panels/MerchPanel';
import { DealChecker } from '../panels/DealChecker';
import { ShipmentPanel } from '../panels/ShipmentPanel';
import { NewCustomerPanel } from '../panels/NewCustomerPanel';

export function OrderWorkspace({ id }: { id: string }) {
  const { state } = useStore();
  const o = state.orders[id];
  if (!o) return <NotFound />;
  return (
    <EvidenceProvider>
      <Workspace o={o} />
    </EvidenceProvider>
  );
}

function Workspace({ o }: { o: Order }) {
  const { state } = useStore();
  const events = state.events.filter((e) => e.entityId === o.id || (o.shipmentId && e.entityId === o.shipmentId));
  const has = (t: Blocker['type']) => o.blockers.some((b) => b.type === t);
  // En pedidos retenidos, lo primero es el bloqueo; en borradores, los datos extraídos.
  const blockersFirst = o.stage === 'erp_confirmed' && openBlockers(o).some((b) => b.type !== 'commercial');

  return (
    <>
      <button className="crumb" onClick={() => navigate('/bandeja')}>
        <ArrowLeft size={15} /> Bandeja
      </button>
      <Header o={o} />
      <Situation o={o} />
      <div className="ws-grid">
        <div className="ws-col">
          <Card title="Origen" icon={<Inbox size={18} />} actions={<span className="xsmall muted">¿Qué información hay?</span>}>
            {o.source ? <SourcePanel source={o.source} capture={o.capture} /> : <p className="muted">Pedido sin mensaje original asociado (entró por {o.channel.toUpperCase()}).</p>}
          </Card>
          <Card title="Historial de decisiones y eventos" icon={<History size={18} />} actions={<SimTag />}>
            <Timeline events={events} />
          </Card>
        </div>
        <div className="ws-col">
          {!blockersFirst && <OrderData o={o} />}
          {has('new_customer') && <NewCustomerPanel o={o} />}
          {has('observations') && <ObservationsPanel o={o} />}
          {has('stock') && <StockPanel o={o} />}
          {has('merchandising') && <MerchPanel o={o} />}
          {has('credit') && <CreditPanel o={o} />}
          {blockersFirst && <OrderData o={o} />}
          <DealChecker o={o} />
          {['released', 'shipment_prepared', 'dispatched', 'delivered'].includes(o.stage) && <ShipmentPanel o={o} />}
        </div>
      </div>
    </>
  );
}

function Header({ o }: { o: Order }) {
  const { state, apply, services } = useStore();
  const toast = useToast();
  const na = orderNextAction(state, o);
  const customer = customerOf(state, o);

  const approve = async () => {
    const corrections = state.events.filter((e) => e.entityId === o.id && e.text.startsWith('Corrige')).length;
    apply((s) => ops.approveDraft(s, o.id));
    const r = await services.erp.createSalesOrder(state.orders[o.id]);
    apply((s) => ops.applyErpCreate(s, o.id, r));
    if (o.capture) {
      await services.capture.reportOutcome(o.capture.draftId, 'approved', corrections);
      apply((s) => ops.noteCaptureFeedback(s, o.id, corrections));
    }
    toast(r.released ? `ERP (simulado): pedido ${r.erpNumber} creado y liberado automáticamente.` : `ERP (simulado): pedido ${r.erpNumber} creado, pero queda retenido.`);
  };

  const release = async () => {
    const r = await services.erp.releaseOrder(o);
    apply((s) => ops.applyRelease(s, o.id, r.ok, r.detail));
    toast(r.ok ? `ERP (simulado): pedido ${o.erpNumber} liberado. Pasa a preparación de envío.` : r.detail, r.ok ? 'info' : 'alert');
  };

  return (
    <div className="ws-head">
      <div className="card">
        <div className="card-body">
          <div className="ws-title">
            <div className="row wrap" style={{ gap: 8 }}>
              <h1>{customerName(state, o)}</h1>
              <Tag tone={o.company === 'PM' ? 'brand' : 'info'}>{o.company}</Tag>
            </div>
            <div className="ws-meta">
              <span className="strong">{o.erpNumber ?? o.id}</span>
              {o.erpNumber && o.erpNumber !== o.id && <span className="muted">(borrador {o.id})</span>}
              <ChannelLabel channel={o.channel} />
              <span>Recibido {fmtAge(o.receivedAt)}</span>
              <span>
                Entrega solicitada: <strong>{fmtDate(o.requestedDeliveryDate)}</strong> ({relativeDay(o.requestedDeliveryDate)})
              </span>
              <span className="row" style={{ gap: 6 }}>
                Responsable: {o.owner ?? <span className="muted">sin asignar</span>}
                {!o.owner && (
                  <button className="btn ghost sm" onClick={() => apply((s) => ops.assignToMe(s, 'order', o.id))}>
                    <UserPlus size={14} /> Asignarme
                  </button>
                )}
              </span>
              {customer && <span className="muted">Comercial: {customer.salesRep}</span>}
            </div>
          </div>
          <div className="next-box" data-testid="next-action">
            <div className="grow">
              <div className="k">Siguiente paso</div>
              <div className="v">{na.label}</div>
              <div className="xsmall muted">{na.needs === 'others' ? `Decide: ${ROLE_LABEL[na.actor]}` : na.detail}</div>
            </div>
            {na.kind === 'approve' && (
              <AsyncButton className="btn primary lg" onClick={approve} busyLabel="Enviando al ERP (simulado)…" testId="primary-action">
                <Check size={17} /> Aprobar y enviar al ERP
              </AsyncButton>
            )}
            {na.kind === 'release' && (
              <AsyncButton className="btn primary lg" onClick={release} busyLabel="El ERP repite comprobaciones…" testId="primary-action">
                <ShieldCheck size={17} /> Liberar pedido
              </AsyncButton>
            )}
            {na.kind === 'scroll' && na.target && (
              <button className={`btn ${na.needs === 'you' ? 'primary' : ''}`} onClick={() => flashPanel(na.target!)} data-testid="primary-action">
                {na.needs === 'you' ? 'Ir al paso' : 'Ver detalle'}
              </button>
            )}
          </div>
        </div>
        <StageStepper order={o} />
      </div>
    </div>
  );
}

function Situation({ o }: { o: Order }) {
  const all = o.blockers;
  const open = openBlockers(o);
  if (o.stage === 'draft' && !all.length) {
    return (
      <div style={{ marginBottom: 20 }}>
        <Callout tone="info" title="Borrador pendiente de revisión">
          Aún no existe en el ERP. Revisa los datos marcados y aprueba para crearlo. Aprobar no garantiza la entrega: después vienen las comprobaciones del ERP, la preparación y el transporte.
        </Callout>
      </div>
    );
  }
  if (!all.length) return null;
  return (
    <section className="card" style={{ marginBottom: 20 }} aria-label="Por qué está bloqueado">
      <div className="card-head">
        <ListChecks size={18} />
        <h2>{open.length ? (open.length === 1 ? 'Por qué está bloqueado' : `Por qué está bloqueado: ${open.length} motivos`) : 'Bloqueos resueltos'}</h2>
        <div className="actions">
          {open.length > 0 ? <Pill tone="warn">{open.length} abierto(s)</Pill> : <Pill tone="ok">Sin bloqueos abiertos</Pill>}
        </div>
      </div>
      <div className="card-body">
        <div className="blocker-grid">
          {all.map((b) => (
            <BlockerCard key={b.id} b={b} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BlockerCard({ b }: { b: Blocker }) {
  const tone = b.status === 'resolved' ? 'ok' : b.status === 'waiting' ? 'neutral' : 'warn';
  const target = b.type === 'commercial' ? 'panel-deal' : `panel-${b.type}`;
  return (
    <div className={`blocker ${b.status}`} data-testid={`blocker-${b.type}`}>
      <div className="stack sm">
        <div className="row wrap" style={{ gap: 8 }}>
          <strong>{BLOCKER_LABEL[b.type]}</strong>
          {b.origin === 'erp' ? <ErpTag /> : <ProposedTag>Comprobación propuesta</ProposedTag>}
        </div>
        <div className="small">{b.status === 'resolved' ? b.resolution : b.reason}</div>
        <div className="who row wrap" style={{ gap: 6 }}>
          {b.status === 'resolved' ? 'Resolvió:' : 'Decide:'} <RoleBadge role={b.status === 'resolved' ? b.resolvedBy ?? b.decider : blockerOwner(b)} />
        </div>
      </div>
      <div className="stack sm" style={{ alignItems: 'flex-end' }}>
        <Pill tone={tone}>{blockerStatusText(b)}</Pill>
        <button className="btn ghost sm" onClick={() => flashPanel(target)}>
          Ver detalle
        </button>
      </div>
    </div>
  );
}

function OrderData({ o }: { o: Order }) {
  const { state, apply } = useStore();
  const ev = useEvidence();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const customer = customerOf(state, o);
  const address = customer?.addresses.find((a) => a.id === o.deliveryAddressId) ?? customer?.addresses[0];
  const isDraft = o.stage === 'draft';
  const pending = pendingReviews(o);

  const rows: { key: string; label: string; value: string }[] = o.fields.length
    ? []
    : [
        { key: 'customer', label: 'Cliente', value: customer ? `${customer.name} (${customer.id}) · ${customer.segment}` : '—' },
        { key: 'address', label: 'Dirección de entrega', value: address ? `${address.label} — ${address.street}, ${address.postalCode} ${address.city}` : o.deliveryAddressText ?? '—' },
        { key: 'date', label: 'Fecha de entrega solicitada', value: fmtDate(o.requestedDeliveryDate) },
        ...(customer?.standardInstructions.length ? [{ key: 'instr', label: 'Instrucciones habituales (ficha)', value: customer.standardInstructions.map((i) => i.text).join(' ') }] : []),
      ];

  return (
    <Card
      id="panel-datos"
      title={isDraft ? 'Datos extraídos del pedido' : 'Datos del pedido'}
      icon={<Package size={18} />}
      actions={
        isDraft ? (
          pending ? <Pill tone="warn">{pending} por revisar</Pill> : <Pill tone="ok">Todo revisado</Pill>
        ) : (
          <>
            <SimTag />
            <FutureButton>Abrir en Navision</FutureButton>
          </>
        )
      }
    >
      <div className="fields">
        {o.fields.map((f) => {
          const review = f.confidence !== 'alta' && !f.confirmed;
          return (
            <div key={f.key} className={`frow ${review ? 'review' : ''}`} onMouseEnter={() => f.evidenceId && ev.set(f.evidenceId)} onMouseLeave={() => ev.set(null)} data-testid={`field-${f.key}`}>
              <span className="k">{f.label}</span>
              <div>
                {editing === f.key ? (
                  <div className="row">
                    <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Corregir ${f.label}`} autoFocus />
                    <button
                      className="btn sm primary"
                      onClick={() => {
                        apply((s) => ops.editField(s, o.id, f.key, draft));
                        setEditing(null);
                      }}
                    >
                      Guardar
                    </button>
                    <button className="btn sm" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <span className="strong">{f.value}</span>
                )}
              </div>
              <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                {f.confidence === 'alta' || f.confirmed ? (
                  <Pill tone="ok">{f.confirmed && f.confidence !== 'alta' ? 'Confirmado' : 'Confianza alta'}</Pill>
                ) : (
                  <Pill tone="warn">Revisar · confianza {f.confidence}</Pill>
                )}
              </div>
              {(f.note || f.evidenceId || (isDraft && review)) && (
                <div className="note">
                  {f.note}
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    {f.evidenceId && (
                      <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => showEvidence(f.evidenceId!, ev.set)}>
                        Ver en el mensaje
                      </button>
                    )}
                    {isDraft && review && editing !== f.key && (
                      <>
                        <button className="btn sm primary" onClick={() => apply((s) => ops.confirmField(s, o.id, f.key))} data-testid={`confirm-${f.key}`}>
                          <Check size={14} /> Confirmar
                        </button>
                        <button
                          className="btn sm"
                          onClick={() => {
                            setEditing(f.key);
                            setDraft(f.value);
                          }}
                        >
                          <Pencil size={14} /> Corregir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.map((r) => (
          <div key={r.key} className="frow">
            <span className="k">{r.label}</span>
            <span>{r.value}</span>
            <span />
          </div>
        ))}
        {o.structuredDelivery && (o.structuredDelivery.address || o.structuredDelivery.window) && (
          <div className="frow">
            <span className="k">Entrega solo para este pedido</span>
            <span>
              {[o.structuredDelivery.address, o.structuredDelivery.window, o.structuredDelivery.contact].filter(Boolean).join(' · ')}
              <div className="xsmall muted">Campos estructurados desde la revisión de observaciones. La ficha del cliente no cambia.</div>
            </span>
            <Pill tone="info">Puntual</Pill>
          </div>
        )}
      </div>

      <h3 style={{ margin: '20px 0 8px' }}>Productos</h3>
      <div className="table-wrap">
        <table className="t compact" data-testid="lines">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Añada</th>
              <th>Formato</th>
              <th className="num">Cant.</th>
              <th className="num">Tarifa</th>
              <th className="num">Dto.</th>
              <th className="num">Neto</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => {
              const p = state.products[l.sku];
              const review = !!l.uncertainty && !l.uncertainty.confirmed;
              const disc = o.deal.approval.status === 'approved' ? l.requestedDiscountPct : l.agreementDiscountPct;
              return (
                <tr key={l.id} className={review ? 'review' : ''} onMouseEnter={() => l.evidenceId && ev.set(l.evidenceId)} onMouseLeave={() => ev.set(null)}>
                  <td className="prod">
                    <div className="strong">{p.name}</div>
                    <div className="xsmall muted">
                      {l.sku}
                      {p.kind === 'merch' && ` · Material promocional cat. ${p.merchCategory}`}
                    </div>
                    {l.substitution && (
                      <div className="xsmall" style={{ color: 'var(--info)' }}>
                        Sustituye a {productLabel(state, l.substitution.fromSku)} × {l.substitution.fromQuantity}. Aceptado por {l.substitution.acceptedBy} ({l.substitution.acceptedVia}).
                      </div>
                    )}
                    {l.backorderQty ? <div className="xsmall" style={{ color: 'var(--warn)' }}>{l.backorderQty} uds pendientes para una entrega posterior</div> : null}
                    {review && (
                      <div className="stack sm" style={{ marginTop: 6 }}>
                        <span className="xsmall" style={{ color: 'var(--warn)' }}>
                          <strong>Revisar:</strong> {l.uncertainty!.note}
                        </span>
                        {o.stage === 'draft' && (
                          <span className="row" style={{ gap: 6 }}>
                            <button className="btn sm primary" onClick={() => apply((s) => ops.confirmLine(s, o.id, l.id))} data-testid={`confirm-line-${l.id}`}>
                              <Check size={14} /> Confirmar añada {String(p.vintage)}
                            </button>
                            {l.evidenceId && (
                              <button className="btn ghost sm" onClick={() => showEvidence(l.evidenceId!, ev.set)}>
                                Ver en el mensaje
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.vintage ?? '—'}
                    {review && l.uncertainty!.field === 'vintage' && (
                      <div>
                        <Tag tone="warn">Dudoso</Tag>
                      </div>
                    )}
                  </td>
                  <td>{p.format ?? '—'}</td>
                  <td className="num">{l.quantity}</td>
                  <td className="num">{p.kind === 'merch' ? 'Sin cargo' : fmtEUR(p.listPrice)}</td>
                  <td className="num">{p.kind === 'merch' ? '—' : `${disc} %`}</td>
                  <td className="num">{p.kind === 'merch' ? '—' : fmtEUR(l.quantity * Math.round(p.listPrice * (1 - disc / 100) * 100) / 100)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
