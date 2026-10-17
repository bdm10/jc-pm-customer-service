import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { ROLE_LABEL } from '../domain/labels';
import { fmtEUR, fmtPct } from '../domain/format';
import { commercialApprover, computeDeal, findCommercialExceptions, MARGIN_ASSUMPTIONS, rateContribution, rateGross, type DealResult, type Rating } from '../domain/margin';
import * as ops from '../domain/ops';
import { customerOf } from '../domain/orders';
import type { Order } from '../domain/types';
import { useStore } from '../state/store';
import { RoleBadge } from '../components/common';
import { AsyncButton, Callout, Card, DemoBox, Disclosure, Pill, ProposedTag, ProvisionalTag, useToast } from '../components/ui';

const RATING: Record<Rating, { tone: 'ok' | 'warn' | 'alert' | 'neutral'; label: string }> = {
  ok: { tone: 'ok', label: 'Dentro de rango' },
  review: { tone: 'warn', label: 'Revisar' },
  approval: { tone: 'alert', label: 'Requiere aprobación' },
  incomplete: { tone: 'neutral', label: 'Cálculo incompleto' },
};

const netPrice = (list: number, disc: number) => Math.round((list * (1 - disc / 100) + Number.EPSILON) * 100) / 100;
const money = (v: number | null) => (v == null ? '—' : fmtEUR(v === 0 ? 0 : v));
const pctOf = (v: number | null) => (v == null ? '—' : fmtPct(v));

export function DealChecker({ o }: { o: Order }) {
  const { state, apply, services } = useStore();
  const toast = useToast();
  const customer = customerOf(state, o);
  const exceptions = findCommercialExceptions(o, customer, state.products);
  const approval = o.deal.approval;
  const showRequested = exceptions.length > 0 || approval.status === 'approved' || approval.status === 'rejected';
  const agreed = computeDeal(o, customer, state.products, 'agreement');
  const requested = computeDeal(o, customer, state.products, 'requested');
  const approver = commercialApprover(exceptions, requested);
  const primary = approval.status === 'approved' ? requested : showRequested ? requested : agreed;
  const gross = rateGross(primary.grossMarginPct);
  const contrib = rateContribution(primary.contributionPct);
  const commBlocker = o.blockers.find((b) => b.type === 'commercial');
  const creditOpen = o.blockers.some((b) => b.type === 'credit' && b.status !== 'resolved');
  const [note, setNote] = useState('Cliente estratégico con aperturas previstas; el comercial pide mantener condiciones de la campaña anterior.');
  const openByDefault = !!commBlocker || !primary.complete;

  const cols: { key: string; label: string; r: DealResult }[] = showRequested
    ? [
        { key: 'agreement', label: 'Según acuerdo', r: agreed },
        { key: 'requested', label: approval.status === 'approved' ? 'Aprobado (solicitado)' : 'Según solicitud', r: requested },
      ]
    : [{ key: 'order', label: 'Pedido', r: agreed }];

  return (
    <Card
      id="panel-deal"
      title="Condiciones y margen"
      icon={<Calculator size={18} />}
      actions={
        <>
          <ProposedTag>Comprobación propuesta</ProposedTag>
          <ProvisionalTag>Umbrales provisionales</ProvisionalTag>
        </>
      }
    >
      <div className="stack lg">
        <div className="row wrap" style={{ gap: 10 }} data-testid="deal-summary">
          <span className="small">
            Margen bruto: <strong>{pctOf(primary.grossMarginPct)}</strong>
          </span>
          <Pill tone={RATING[gross].tone}>{RATING[gross].label}</Pill>
          <span className="small" style={{ marginLeft: 8 }}>
            Contribución después de entrega: <strong>{pctOf(primary.contributionPct)}</strong>
          </span>
          <Pill tone={RATING[contrib].tone}>{RATING[contrib].label}</Pill>
        </div>

        {!primary.complete && (
          <Callout tone="neutral" title="Cálculo incompleto">
            Faltan datos para calcular {primary.grossComplete ? 'la contribución después de entrega' : 'el margen'}. No se estima con valores inventados.
            <ul className="plain" style={{ marginTop: 6 }}>
              {primary.missing.map((m) => (
                <li key={m.what}>
                  {m.what} — lo aporta <strong>{m.owner}</strong>
                </li>
              ))}
            </ul>
          </Callout>
        )}

        <Disclosure summary="Precios, descuentos, unidades sin cargo y plazo" open={openByDefault}>
          <div className="stack">
            <div className="small muted">
              {customer ? (
                <>
                  Acuerdo: <strong>{customer.agreement.name}</strong> · vigente hasta {customer.agreement.validUntil} · plazo de pago acordado {customer.agreement.paymentTermsDays} días
                </>
              ) : (
                'Cliente sin ficha: se aplica tarifa general hasta completar el alta.'
              )}
            </div>
            <div className="table-wrap">
              <table className="t compact" data-testid="deal-lines">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cant.</th>
                    <th className="num">Tarifa</th>
                    <th className="num">Dto. acuerdo</th>
                    <th className="num">Dto. pedido</th>
                    <th className="num">Dto. aprobado</th>
                    <th className="num">Neto pedido / aprobado</th>
                    <th className="num">Sin cargo acuerdo → pedido</th>
                    <th className="num">Coste unit.</th>
                  </tr>
                </thead>
                <tbody>
                  {o.lines
                    .filter((l) => state.products[l.sku]?.kind === 'wine')
                    .map((l) => {
                      const p = state.products[l.sku];
                      const approvedDisc = approval.status === 'approved' ? l.requestedDiscountPct : l.agreementDiscountPct;
                      const over = l.requestedDiscountPct > l.agreementDiscountPct || l.freeUnits > l.agreementFreeUnits;
                      return (
                        <tr key={l.id} className={over && approval.status !== 'approved' ? 'review' : ''}>
                          <td className="prod">
                            {p.name}
                            <div className="muted xsmall">
                              {String(p.vintage)} · {p.format}
                            </div>
                          </td>
                          <td className="num">{l.quantity}</td>
                          <td className="num">{fmtEUR(p.listPrice)}</td>
                          <td className="num">{l.agreementDiscountPct} %</td>
                          <td className="num">{l.requestedDiscountPct} %</td>
                          <td className="num strong">{approvedDisc} %</td>
                          <td className="num">
                            {fmtEUR(netPrice(p.listPrice, l.requestedDiscountPct))}
                            <div className="strong">{fmtEUR(netPrice(p.listPrice, approvedDisc))}</div>
                          </td>
                          <td className="num">
                            {l.agreementFreeUnits} → {l.freeUnits}
                          </td>
                          <td className="num">{p.unitCost == null ? <span style={{ color: 'var(--alert)' }}>Sin dato</span> : fmtEUR(p.unitCost)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="small">
              Plazo de pago: acordado <strong>{customer?.agreement.paymentTermsDays ?? 30} días</strong> · solicitado <strong>{o.deal.paymentTermsRequestedDays} días</strong>
            </div>
          </div>
        </Disclosure>

        <div className="calc-grid" style={{ ['--cols' as string]: cols.length }} data-testid="deal-calc">
          <div className="h">Concepto</div>
          {cols.map((c) => (
            <div key={c.key} className="h v">
              {c.label}
            </div>
          ))}
          <div className="sep">Margen bruto</div>
          <Row label="Ingresos netos" cols={cols} get={(r) => money(r.revenue)} />
          <Row label="Coste de producto (incl. sin cargo)" cols={cols} get={(r) => money(r.cogs == null ? null : -r.cogs)} />
          <Row label="Margen bruto" cols={cols} get={(r) => `${money(r.grossMargin)} · ${pctOf(r.grossMarginPct)}`} total />
          <Row label="Valoración margen bruto" cols={cols} get={(r) => RATING[rateGross(r.grossMarginPct)].label} />
          <div className="sep">Después de entrega</div>
          <Row label={(r) => `Transporte (${r.cases} cajas)`} cols={cols} get={(r) => money(r.deliveryCost == null ? null : -r.deliveryCost)} />
          <Row label="Franja horaria garantizada" cols={cols} get={(r) => money(-r.timeWindowCost)} />
          <Row label={(r) => `Coste financiero (${r.paymentDays} días)`} cols={cols} get={(r) => money(-r.financingCost)} />
          <Row label="Material promocional" cols={cols} get={(r) => money(r.promoCost == null ? null : -r.promoCost)} />
          <Row label="Contribución después de entrega" cols={cols} get={(r) => (r.contribution == null ? 'Cálculo incompleto' : `${money(r.contribution)} · ${pctOf(r.contributionPct)}`)} total />
          <Row label="Valoración contribución" cols={cols} get={(r) => RATING[rateContribution(r.contributionPct)].label} />
        </div>

        {exceptions.length > 0 && approval.status !== 'approved' && approval.status !== 'rejected' && (
          <div className="stack">
            <h3>Excepción comercial</h3>
            <div className="table-wrap">
              <table className="t" data-testid="exceptions">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Acuerdo</th>
                    <th>Solicitado</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((e, i) => (
                    <tr key={i}>
                      <td>{e.text}</td>
                      <td>{e.agreed}</td>
                      <td className="strong">{e.requested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row wrap small" style={{ gap: 8 }}>
              Decide: <RoleBadge role={approver} /> <ProvisionalTag>Regla provisional</ProvisionalTag>
            </div>
            {creditOpen && (
              <Callout tone="info" title="Aprobar esta excepción no libera el bloqueo de crédito">
                El crédito lo decide Finanzas por separado.
              </Callout>
            )}
            {approval.status === 'needed' && (
              <>
                <div className="field">
                  <label className="label" htmlFor="comm-note">
                    Contexto para {ROLE_LABEL[approver]}
                  </label>
                  <textarea id="comm-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div>
                  <AsyncButton
                    className="btn primary"
                    busyLabel="Enviando a aprobación (simulado)…"
                    testId="request-commercial"
                    onClick={async () => {
                      await services.approvals.requestApproval({ entityId: o.id, topic: 'commercial', approver, note });
                      apply((s) => ops.requestCommercialApproval(s, o.id, approver, note));
                      toast(`Excepción enviada a ${ROLE_LABEL[approver]} (simulado).`);
                    }}
                  >
                    Enviar excepción a aprobación
                  </AsyncButton>
                </div>
              </>
            )}
            {approval.status === 'requested' && (
              <DemoBox title={`simula la decisión de ${ROLE_LABEL[approver]}`}>
                <div className="row wrap">
                  <button className="btn demo" data-testid="commercial-approve" onClick={() => apply((s) => ops.commercialDecision(s, o.id, true))}>
                    Aprueba la excepción
                  </button>
                  <button className="btn demo" onClick={() => apply((s) => ops.commercialDecision(s, o.id, false))}>
                    Rechaza: aplicar acuerdo
                  </button>
                </div>
              </DemoBox>
            )}
          </div>
        )}
        {commBlocker?.status === 'resolved' && (
          <Callout tone="ok" title="Excepción comercial decidida">
            {commBlocker.resolution} {creditOpen && 'El bloqueo de crédito sigue abierto: lo decide Finanzas.'}
          </Callout>
        )}

        <Disclosure summary="Ver supuestos del cálculo (datos sintéticos)">
          <div className="stack small">
            <ul className="plain">
              <li>Ingresos netos = cantidad × (tarifa × (1 − descuento)), con el precio unitario redondeado a céntimos.</li>
              <li>Coste de producto = (cantidad + unidades sin cargo) × coste estándar sintético.</li>
              <li>Margen bruto = ingresos netos − coste de producto.</li>
              <li>
                Transporte = tarifa base de la zona + importe por caja. Zonas con tarifa:{' '}
                {Object.values(MARGIN_ASSUMPTIONS.deliveryTariffs)
                  .map((t) => `${t.label} (${fmtEUR(t.base)} + ${fmtEUR(t.perCase)}/caja)`)
                  .join(', ')}
                . Baleares sin tarifa cargada.
              </li>
              <li>Franja horaria garantizada: {fmtEUR(MARGIN_ASSUMPTIONS.timeWindowSurcharge)} por envío.</li>
              <li>Coste financiero = ingresos netos × {MARGIN_ASSUMPTIONS.annualFinancingRate * 100} % anual × días de plazo / 365.</li>
              <li>Contribución después de entrega = margen bruto − transporte − franja − coste financiero − material promocional.</li>
              <li>
                Umbrales provisionales: margen bruto ≥ {MARGIN_ASSUMPTIONS.thresholds.grossMarginPct.ok * 100} % dentro de rango, ≥ {MARGIN_ASSUMPTIONS.thresholds.grossMarginPct.review * 100} % revisar, menos requiere aprobación.
                Contribución ≥ {MARGIN_ASSUMPTIONS.thresholds.contributionPct.ok * 100} % / ≥ {MARGIN_ASSUMPTIONS.thresholds.contributionPct.review * 100} %.
              </li>
              <li>Si falta un coste o una tarifa se muestra «Cálculo incompleto» y no se estima.</li>
            </ul>
            <p className="xsmall muted">Detalle y casos de prueba en docs/CALCULOS.md.</p>
          </div>
        </Disclosure>
      </div>
    </Card>
  );
}

function Row({ label, cols, get, total }: { label: string | ((r: DealResult) => string); cols: { key: string; r: DealResult }[]; get: (r: DealResult) => string; total?: boolean }) {
  return (
    <>
      <div className={total ? 'tot' : ''}>{typeof label === 'string' ? label : label(cols[cols.length - 1].r)}</div>
      {cols.map((c) => (
        <div key={c.key} className={`v ${total ? 'tot' : ''}`}>
          {get(c.r)}
        </div>
      ))}
    </>
  );
}
