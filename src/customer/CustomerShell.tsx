import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PresenterControls } from '../App';
import { Tag } from '../components/ui';

/** Envoltorio de las vistas que vería el cliente. Siempre marcado como vista previa simulada. */
export function CustomerShell({ children, back, backLabel }: { children: ReactNode; back: () => void; backLabel: string }) {
  return (
    <div className="cust">
      <div className="cust-bar">
        <button className="btn sm" onClick={back}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
        <Tag tone="demo">Vista previa del cliente</Tag>
        <span className="xsmall muted row" style={{ gap: 6 }}>
          <ShieldCheck size={14} /> Acceso mediante enlace seguro simulado · sin inicio de sesión · sin validez real
        </span>
        <span style={{ marginLeft: 'auto' }} className="row" />
        <PresenterControls compact />
      </div>
      <div className="cust-main">
        <div className="cust-brand" style={{ marginBottom: 20 }}>
          <span className="brand-mark">PM</span>
          <span>Atención al Cliente</span>
        </div>
        {children}
      </div>
    </div>
  );
}
