import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, FlaskConical, Info, Loader2, Lock, X } from 'lucide-react';
import type { Tone } from '../domain/queue';

export function Pill({ tone = 'neutral', dot = true, children, title }: { tone?: Tone | 'demo' | 'proposed' | 'brand'; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`pill tone-${tone}`} title={title}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  );
}

export function Tag({ tone = 'neutral', children, title }: { tone?: Tone | 'demo' | 'proposed' | 'brand'; children: ReactNode; title?: string }) {
  return (
    <span className={`tag tone-${tone}`} title={title}>
      {children}
    </span>
  );
}

export const SimTag = () => (
  <Tag tone="demo" title="Resultado generado por una simulación local. No se conecta con ningún sistema real.">
    Simulado
  </Tag>
);
export const ProposedTag = ({ children = 'Propuesta futura' }: { children?: ReactNode }) => (
  <Tag tone="proposed" title="Comportamiento propuesto para el nuevo espacio de trabajo; no existe hoy.">
    {children}
  </Tag>
);
export const ProvisionalTag = ({ children = 'Provisional' }: { children?: ReactNode }) => (
  <Tag tone="warn" title="Regla o umbral ilustrativo, pendiente de validar con el equipo.">
    {children}
  </Tag>
);
export const ErpTag = () => (
  <Tag tone="neutral" title="Así funciona hoy en Navision según los diagramas actuales.">
    Bloqueo actual del ERP
  </Tag>
);

export function Card({ id, title, icon, actions, children, tight, className = '' }: { id?: string; title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean; className?: string }) {
  return (
    <section id={id} className={`card ${className}`}>
      {title && (
        <div className="card-head">
          {icon}
          <h2>{title}</h2>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${tight ? 'tight' : ''}`}>{children}</div>
    </section>
  );
}

export function Callout({ tone = 'info', title, children, icon }: { tone?: Tone | 'demo' | 'proposed'; title?: ReactNode; children?: ReactNode; icon?: ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? AlertTriangle : tone === 'alert' ? CircleAlert : Info;
  return (
    <div className={`callout tone-${tone}`} role={tone === 'alert' ? 'alert' : undefined}>
      {icon ?? <Icon size={18} />}
      <div className="stack sm grow">
        {title && <div className="title">{title}</div>}
        {children && <div style={{ color: 'var(--text-2)' }}>{children}</div>}
      </div>
    </div>
  );
}

export function DemoBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="demo-box" data-testid="demo-control">
      <div className="demo-title">
        <FlaskConical size={16} /> Control de demo — {title}
      </div>
      {children}
    </div>
  );
}

/** Botón deshabilitado a propósito para mostrar que una acción pertenece a otro rol. */
export function LockedButton({ children, reason }: { children: ReactNode; reason: string }) {
  return (
    <span className="stack sm" style={{ display: 'inline-flex' }}>
      <button className="btn locked" disabled aria-disabled title={reason}>
        <Lock size={15} /> {children}
      </button>
      <span className="xsmall muted">{reason}</span>
    </span>
  );
}

/** Funcionalidad futura: visible pero claramente marcada y sin acción. */
export function FutureButton({ children }: { children: ReactNode }) {
  return (
    <button className="btn sm locked" disabled title="Funcionalidad futura: no disponible en el prototipo">
      {children} <Tag tone="proposed">Próximamente</Tag>
    </button>
  );
}

export function Disclosure({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="disc" open={open}>
      <summary>
        <ChevronRight size={16} className="chev" /> {summary}
      </summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------- Avisos

interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'alert';
}
const ToastCtx = createContext<(text: string, tone?: 'info' | 'alert') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: 'info' | 'alert' = 'info') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 6000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'alert' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
            <span>{t.text}</span>
            <button aria-label="Cerrar aviso" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Botón que ejecuta una acción asíncrona (servicio simulado) mostrando el estado de espera. */
export function AsyncButton({
  onClick,
  children,
  busyLabel,
  className = 'btn',
  disabled,
  title,
  testId,
}: {
  onClick: () => Promise<void> | void;
  children: ReactNode;
  busyLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  testId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <button
      className={className}
      disabled={disabled || busy}
      title={title}
      data-testid={testId}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await onClick();
        } catch (err) {
          toast(err instanceof Error ? err.message : 'No se ha podido completar la acción', 'alert');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <>
          <Loader2 size={16} className="spin" /> {busyLabel ?? 'Procesando…'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: { title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-labelledby="dlg-title" onClick={onCancel}>
      <div className="modal stack" onClick={(e) => e.stopPropagation()}>
        <h2 id="dlg-title">{title}</h2>
        <div className="muted">{body}</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn primary" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="row" style={{ gap: 10 }}>
      <div className="progress grow" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : '#d6a23a' }} />
      </div>
      <span className="small mono nowrap">
        {value}/{total}
      </span>
    </div>
  );
}

export function flashPanel(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 260;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}
