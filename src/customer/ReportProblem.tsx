import { useState } from 'react';
import { Camera, CheckCircle2 } from 'lucide-react';
import { CLAIM_TYPE_LABEL } from '../domain/labels';
import * as ops from '../domain/ops';
import { productLabel } from '../domain/orders';
import type { ClaimType } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { Callout, useToast } from '../components/ui';
import { NotFound } from '../App';
import { CustomerShell } from './CustomerShell';

export function ReportProblem({ token }: { token: string }) {
  const { state, apply } = useStore();
  const toast = useToast();
  const sh = Object.values(state.shipments).find((s) => s.tracking.token === token);
  const [type, setType] = useState<ClaimType>('missing');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [desc, setDesc] = useState('');
  const [contact, setContact] = useState('');
  const [files, setFiles] = useState<{ name: string; sample: boolean }[]>([]);
  const [created, setCreated] = useState<string | null>(null);
  if (!sh) return <NotFound />;
  const back = () => navigate(`/cliente/seguimiento/${token}`);
  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([sku, quantity]) => ({ sku, quantity }));
  const lines = Array.from(new Map(sh.lines.map((l) => [l.sku, l])).values());

  if (created) {
    const c = state.claims[created];
    return (
      <CustomerShell back={back} backLabel="Volver al seguimiento">
        <div className="card card-body stack lg" data-testid="claim-created">
          <div className="row" style={{ gap: 10 }}>
            <CheckCircle2 size={28} color="var(--ok)" />
            <h1>Hemos recibido tu aviso</h1>
          </div>
          <p>
            Referencia <strong>{c.id}</strong>. Una persona de Atención al Cliente lo revisará y te contestará en un plazo de 1 día laborable <span className="muted">(plazo provisional)</span>.
          </p>
          <Callout tone="info" title="Qué pasa ahora">
            Revisaremos las fotos y comprobaremos el envío con el almacén. No se emite ningún abono ni reposición de forma automática: te propondremos la solución cuando lo hayamos revisado.
          </Callout>
          <div className="row wrap">
            <button className="btn" onClick={back}>
              Volver al seguimiento
            </button>
            <button className="btn primary" onClick={() => navigate(`/incidencia/${c.id}`)} data-testid="open-claim">
              Ver la incidencia en el espacio de trabajo
            </button>
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell back={back} backLabel="Volver al seguimiento">
      <form
        className="stack lg"
        onSubmit={(e) => {
          e.preventDefault();
          if (!items.length) {
            toast('Indica al menos un producto y la cantidad afectada.', 'alert');
            return;
          }
          let id = '';
          apply((s) => {
            id = ops.createClaim(s, {
              shipmentId: sh.id,
              type,
              items,
              description: desc.trim() || `${CLAIM_TYPE_LABEL[type]} en la entrega.`,
              evidence: files.map((f) => ({ name: f.name, kind: 'photo' as const, sample: f.sample })),
              contact,
            });
          });
          setCreated(id);
        }}
      >
        <div>
          <h1>Reportar un problema</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Envío {sh.id}. Cuéntanos qué ha pasado; tardarás un minuto.
          </p>
        </div>

        <div className="card card-body stack">
          <h2>1 · ¿Qué ha pasado?</h2>
          {(['missing', 'damaged', 'wrong', 'other'] as ClaimType[]).map((t) => (
            <label key={t} className={`choice ${type === t ? 'selected' : ''}`}>
              <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
              <span>{CLAIM_TYPE_LABEL[t]}</span>
            </label>
          ))}
        </div>

        <div className="card card-body stack">
          <h2>2 · ¿Qué productos y cuántas unidades?</h2>
          {lines.map((l) => {
            const q = qty[l.sku] ?? 0;
            const max = sh.lines.filter((x) => x.sku === l.sku).reduce((a, x) => a + x.quantity, 0);
            return (
              <div key={l.sku} className="row between wrap" data-testid={`claim-item-${l.sku}`}>
                <span>
                  {productLabel(state, l.sku)} <span className="muted small">(recibidas {max})</span>
                </span>
                <span className="qty">
                  <button type="button" aria-label="Menos" onClick={() => setQty({ ...qty, [l.sku]: Math.max(0, q - 1) })}>
                    −
                  </button>
                  <span>{q}</span>
                  <button type="button" aria-label="Más" onClick={() => setQty({ ...qty, [l.sku]: Math.min(max, q + 1) })}>
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        <div className="card card-body stack">
          <h2>3 · Fotos (recomendado)</h2>
          <div className="row wrap">
            <label className="btn">
              <Camera size={16} /> Añadir foto
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFiles([...files, { name: f.name, sample: false }]);
                }}
              />
            </label>
            <button type="button" className="btn demo" onClick={() => setFiles([...files, { name: `foto_ejemplo_${files.length + 1}.jpg`, sample: true }])} data-testid="sample-photo">
              Usar foto de ejemplo (demo)
            </button>
          </div>
          {files.length > 0 && (
            <ul className="plain small">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} {f.sample ? '(ejemplo)' : '(solo se guarda el nombre; no se sube nada)'}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-body stack">
          <h2>4 · Detalles y contacto</h2>
          <div className="field">
            <label className="label" htmlFor="desc">
              Descripción
            </label>
            <textarea id="desc" className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="p. ej. Faltan 6 botellas; la caja venía abierta." />
          </div>
          <div className="field">
            <label className="label" htmlFor="contact">
              ¿Con quién hablamos?
            </label>
            <input id="contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nombre y teléfono" />
          </div>
        </div>

        <div className="row wrap">
          <button className="btn primary lg" type="submit" disabled={!items.length} data-testid="submit-claim">
            Enviar aviso
          </button>
          {!items.length && <span className="small muted">Indica al menos un producto afectado.</span>}
        </div>
      </form>
    </CustomerShell>
  );
}
