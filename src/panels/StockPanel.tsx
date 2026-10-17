import { useState } from 'react';
import { PackageX } from 'lucide-react';
import { STOCK_OPTION_LABEL } from '../domain/labels';
import { fmtDateTime } from '../domain/format';
import * as ops from '../domain/ops';
import { customerOf, productLabel } from '../domain/orders';
import type { Order, StockOption } from '../domain/types';
import { useStore } from '../state/store';
import { AsyncButton, Callout, Card, DemoBox, ErpTag, Pill, SimTag, Tag, useToast } from '../components/ui';

function proposalText(o: Order, opt: StockOption, product: string, contact: string): string {
  return `Hola ${contact}:\n\nDel pedido ${o.erpNumber} solo tenemos ${o.stockReview?.availableAtFirstCheck ?? 0} unidades de ${product}. Te proponemos: ${opt.title.toLowerCase()}.\n${opt.detail}\n\n¿Nos confirmas si te parece bien? No haremos ningún cambio hasta tener tu respuesta.`;
}

export function StockPanel({ o }: { o: Order }) {
  const { state, apply, begin, services } = useStore();
  const toast = useToast();
  const r = o.stockReview;
  const b = o.blockers.find((x) => x.type === 'stock');
  const customer = customerOf(state, o);
  const [by, setBy] = useState(customer?.contactName ?? 'Contacto del cliente');
  const [via, setVia] = useState('Teléfono');
  const [text, setText] = useState('');
  if (!r || !b) return null;
  const line = o.lines.find((l) => l.id === r.lineId)!;
  const originalSku = line.substitution?.fromSku ?? line.sku;
  const p = state.products[originalSku];
  const requested = line.substitution?.fromQuantity ?? (line.backorderQty ? line.quantity + line.backorderQty : line.quantity);
  const selected = r.options.find((x) => x.id === r.selectedOptionId);
  const accepted = r.acceptance ? r.options.find((x) => x.id === r.acceptance!.optionId) : undefined;
  const resolved = b.status === 'resolved';
  const contact = (customer?.contactName ?? '').split(' ')[0] || 'equipo';

  return (
    <Card id="panel-stock" title="Producto sin stock suficiente" icon={<PackageX size={18} />} actions={<ErpTag />}>
      <div className="stack lg">
        <div className="facts" data-testid="stock-facts">
          <div className="fact">
            <div className="k">Vino</div>
            <div className="v" style={{ fontSize: '0.98rem' }}>
              {p.name}
            </div>
          </div>
          <div className="fact">
            <div className="k">Añada</div>
            <div className="v">{String(p.vintage)}</div>
          </div>
          <div className="fact">
            <div className="k">Formato</div>
            <div className="v" style={{ fontSize: '0.98rem' }}>
              {p.format}
            </div>
          </div>
          <div className="fact">
            <div className="k">Cantidad pedida</div>
            <div className="v">{requested}</div>
          </div>
          <div className="fact alert">
            <div className="k">Disponible ({fmtDateTime(r.firstCheckAt)})</div>
            <div className="v">{r.availableAtFirstCheck}</div>
          </div>
          <div className="fact">
            <div className="k">Próxima entrada prevista</div>
            <div className="v" style={{ fontSize: '0.92rem' }}>
              {p.nextReceipt ? new Date(p.nextReceipt.date).toLocaleDateString('es-ES') : '—'}
            </div>
            <div className="xsmall">No confirmada</div>
          </div>
        </div>

        <div className="stack">
          <div className="row between wrap">
            <h3>1 · Propuestas para el cliente</h3>
            <span className="small muted">Ninguna se aplica sin aceptación explícita</span>
          </div>
          {r.options.map((opt) => {
            const avail = state.stock[opt.targetSku] ?? 0;
            const isSel = r.selectedOptionId === opt.id;
            const locked = !!r.acceptance;
            return (
              <label key={opt.id} className={`choice ${isSel ? 'selected' : ''} ${locked ? 'disabled' : ''}`} data-testid={`stock-option-${opt.id}`}>
                <input type="radio" name="stock-opt" disabled={locked} checked={isSel} onChange={() => {
                    setText('');
                    apply((s) => ops.selectStockOption(s, o.id, opt.id));
                  }} />
                <div className="stack sm grow">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <Tag tone="info">{STOCK_OPTION_LABEL[opt.kind]}</Tag>
                    <strong>{opt.title}</strong>
                  </div>
                  <span className="small muted">{opt.detail}</span>
                  <span className="row wrap xsmall" style={{ gap: 8 }}>
                    <span>
                      Disponible ahora: <strong>{avail}</strong> de {productLabel(state, opt.targetSku)}
                    </span>
                    {(opt.kind === 'vintage' || opt.kind === 'format') && <Tag tone="warn">Sustitución: requiere aceptación explícita</Tag>}
                    {(opt.kind === 'partial' || opt.kind === 'later') && <Tag tone="neutral">Requiere acuerdo del cliente</Tag>}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        {selected && !r.proposalPreparedAt && (
          <div className="stack">
            <h3>2 · Preparar la propuesta</h3>
            <textarea className="textarea" style={{ minHeight: 150 }} value={text || proposalText(o, selected, productLabel(state, originalSku), contact)} onChange={(e) => setText(e.target.value)} aria-label="Texto de la propuesta" />
            <div className="row wrap">
              <AsyncButton
                className="btn primary"
                busyLabel="Preparando borrador (simulado)…"
                testId="prepare-proposal"
                onClick={async () => {
                  const act = begin();
                  const body = text || proposalText(o, selected, productLabel(state, originalSku), contact);
                  await services.messaging.prepareDraft({ channel: 'email', to: customer?.contactName ?? '', body });
                  act((s) => ops.prepareStockProposal(s, o.id, body));
                  toast('Propuesta preparada. En el prototipo no se envía ningún mensaje.');
                }}
              >
                Guardar propuesta (no se envía)
              </AsyncButton>
              <SimTag />
            </div>
          </div>
        )}

        {r.proposalPreparedAt && !r.acceptance && (
          <div className="stack">
            <h3>3 · Respuesta del cliente</h3>
            <Pill tone="neutral">Esperando al cliente</Pill>
            <DemoBox title="simula la respuesta del cliente">
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="acc-by">
                    Quién acepta
                  </label>
                  <input id="acc-by" className="input" value={by} onChange={(e) => setBy(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="acc-via">
                    Canal
                  </label>
                  <select id="acc-via" className="select" value={via} onChange={(e) => setVia(e.target.value)}>
                    <option>Teléfono</option>
                    <option>Email</option>
                    <option>WhatsApp</option>
                  </select>
                </div>
              </div>
              <div className="row wrap" style={{ marginTop: 12 }}>
                <button
                  className="btn demo"
                  data-testid="record-acceptance"
                  onClick={() => {
                    try {
                      apply((s) => ops.recordStockAcceptance(s, o.id, by, via));
                    } catch (err) {
                      toast((err as Error).message, 'alert');
                    }
                  }}
                >
                  Registrar aceptación explícita
                </button>
                <button
                  className="btn demo"
                  onClick={() => {
                    setText('');
                    apply((s) => ops.selectStockOption(s, o.id, r.selectedOptionId!));
                  }}
                >
                  El cliente prefiere otra opción
                </button>
              </div>
            </DemoBox>
          </div>
        )}

        {r.acceptance && accepted && (
          <div className="stack">
            <Callout tone="ok" title={`Aceptado por ${r.acceptance.by} (${r.acceptance.via})`}>
              {accepted.title} · {fmtDateTime(r.acceptance.at)}
            </Callout>
            <h3>4 · Aplicar el cambio y volver a comprobar</h3>
            <div className="row wrap">
              <button className="btn primary" disabled={!!r.appliedAt} onClick={() => apply((s) => ops.applyStockOption(s, o.id))} data-testid="apply-stock">
                {r.appliedAt ? 'Cambio aplicado' : 'Aplicar el cambio al pedido'}
              </button>
              <AsyncButton
                className="btn primary"
                disabled={!r.appliedAt || resolved}
                busyLabel="Consultando disponibilidad (simulado)…"
                testId="second-check"
                title={!r.appliedAt ? 'Primero aplica el cambio aceptado' : undefined}
                onClick={async () => {
                  const act = begin();
                  const cur = state.orders[o.id];
                  const res = await services.inventory.checkAvailability(cur.lines.filter((l) => state.products[l.sku]?.kind === 'wine').map((l) => ({ sku: l.sku, quantity: l.quantity })));
                  act((s) => ops.applySecondCheck(s, o.id, res));
                  toast(res.every((x) => x.ok) ? 'Segunda comprobación correcta: hay stock.' : 'La segunda comprobación no encuentra stock suficiente.', res.every((x) => x.ok) ? 'info' : 'alert');
                }}
              >
                Segunda comprobación de disponibilidad
              </AsyncButton>
            </div>
          </div>
        )}

        {r.secondCheck && (
          <div className="stack sm" data-testid="second-check-result">
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Necesario</th>
                    <th className="num">Disponible ahora</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {r.secondCheck.results.map((x) => (
                    <tr key={x.sku}>
                      <td>{productLabel(state, x.sku)}</td>
                      <td className="num">{x.requested}</td>
                      <td className="num">{x.available}</td>
                      <td>{x.ok ? <Pill tone="ok">Disponible</Pill> : <Pill tone="alert">Insuficiente</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="xsmall muted">
              Comprobado {fmtDateTime(r.secondCheck.at)}. Entre la primera consulta y ahora el stock puede haber cambiado por otros pedidos.
            </span>
            {!r.secondCheck.ok && (
              <DemoBox title="simula una entrada de mercancía">
                <button className="btn demo" onClick={() => apply((s) => ops.simulateGoodsReceipt(s, o.id, state.orders[o.id].lines.find((l) => l.id === r.lineId)!.sku, 24))}>
                  Entrada de 24 unidades
                </button>
              </DemoBox>
            )}
          </div>
        )}
        {resolved && (
          <Callout tone="ok" title="Bloqueo de stock resuelto">
            {b.resolution} Siguiente paso: liberar el pedido.
          </Callout>
        )}
      </div>
    </Card>
  );
}
