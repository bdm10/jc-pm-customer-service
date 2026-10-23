import { createContext, useContext, useState, type ReactNode } from 'react';
import { Bot, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import { CHANNEL_LABEL } from '../domain/labels';
import { fmtDateTime, fmtTime } from '../domain/format';
import type { Attachment, CaptureMeta, MessageSegment, SourceMessage } from '../domain/types';
import { ChannelIcon } from './common';
import { Pill, ProposedTag, SimTag } from './ui';

// Resalta en el mensaje original el fragmento del que sale cada dato extraído.
const EvidenceCtx = createContext<{ active: string | null; set: (id: string | null) => void }>({ active: null, set: () => {} });

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [active, set] = useState<string | null>(null);
  return <EvidenceCtx.Provider value={{ active, set }}>{children}</EvidenceCtx.Provider>;
}

export const useEvidence = () => useContext(EvidenceCtx);

export function showEvidence(id: string, set: (id: string | null) => void) {
  set(id);
  const el = document.querySelector(`[data-ev="${id}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function Segments({ segments }: { segments: MessageSegment[] }) {
  const { active } = useEvidence();
  return (
    <>
      {segments.map((s, i) =>
        s.id ? (
          <mark key={i} className={`ev ${active === s.id ? 'active' : ''}`} data-ev={s.id}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function AttachmentPreview({ a }: { a: Attachment }) {
  const { active } = useEvidence();
  return (
    <div className="attachment">
      <div className="attachment-head">
        {a.kind === 'pdf_order' ? <FileText size={16} /> : <ImageIcon size={16} />}
        <strong>{a.name}</strong>
        <span className="muted">{a.sizeLabel}</span>
        <span style={{ marginLeft: 'auto' }} className="xsmall muted">
          Vista previa (simulada)
        </span>
      </div>
      {a.kind === 'pdf_order' && (
        <div className="pdf-page">
          <strong>{a.title}</strong>
          <table>
            <thead>
              <tr>
                {a.header?.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.rows?.map((r, i) => (
                <tr key={i} className={r.id && active === r.id ? 'active' : ''}>
                  {r.cells.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="xsmall">{a.footer}</div>
        </div>
      )}
      {a.kind === 'photo_note' && (
        <div className="photo-note" aria-label="Foto de una nota manuscrita (simulada)">
          {a.handwritten?.map((h, i) => (
            <div key={i} className={h.id && active === h.id ? 'active' : ''}>
              {h.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourcePanel({ source, capture }: { source: SourceMessage; capture?: CaptureMeta }) {
  return (
    <div className="stack">
      {capture && (
        <div className="callout tone-proposed" style={{ borderColor: 'var(--proposed-border)' }}>
          <Bot size={18} />
          <div className="stack sm grow">
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="title">Borrador {capture.draftId} de la capa de captura</span>
              <ProposedTag>Integración propuesta</ProposedTag>
              <SimTag />
            </div>
            <div className="small" style={{ color: 'var(--text-2)' }}>
              Preparado a las {fmtTime(capture.capturedAt)}. Identificación del cliente: {capture.customerMatch}. Confianza global:{' '}
              <Pill tone={capture.overallConfidence === 'alta' ? 'ok' : 'warn'} dot={false}>
                {capture.overallConfidence}
              </Pill>
            </div>
            <div className="xsmall muted">Este espacio no lee el buzón ni WhatsApp: recibe la salida de la capa de captura que está construyendo Toni.</div>
          </div>
        </div>
      )}
      <dl className="msg-meta">
        <dt>Canal</dt>
        <dd className="row" style={{ gap: 6 }}>
          <ChannelIcon channel={source.channel} /> {CHANNEL_LABEL[source.channel]}
        </dd>
        <dt>De</dt>
        <dd>
          {source.from} <span className="muted">· {source.fromAddress}</span>
        </dd>
        {source.to && (
          <>
            <dt>Para</dt>
            <dd>{source.to}</dd>
          </>
        )}
        {source.subject && (
          <>
            <dt>Asunto</dt>
            <dd className="strong">{source.subject}</dd>
          </>
        )}
        <dt>Recibido</dt>
        <dd>{fmtDateTime(source.receivedAt)}</dd>
      </dl>
      {source.channel === 'whatsapp' ? (
        <div className="wa">
          {splitBubbles(source.segments).map((b, i) => (
            <div key={i} className="wa-bubble">
              <Segments segments={b} />
              <span className="wa-time">{fmtTime(source.receivedAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="msg-body" data-testid="source-message">
          <Segments segments={source.segments} />
        </div>
      )}
      {source.attachments.length > 0 && (
        <div>
          <div className="row small muted" style={{ gap: 6, marginTop: 4 }}>
            <Paperclip size={14} /> {source.attachments.length} adjunto
          </div>
          {source.attachments.map((a) => (
            <AttachmentPreview key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Los mensajes de WhatsApp se separan en burbujas por los dobles saltos de línea. */
function splitBubbles(segments: MessageSegment[]): MessageSegment[][] {
  const out: MessageSegment[][] = [[]];
  for (const s of segments) {
    if (!s.id && s.text === '\n\n') {
      out.push([]);
      continue;
    }
    out[out.length - 1].push(s);
  }
  return out.filter((b) => b.length);
}
