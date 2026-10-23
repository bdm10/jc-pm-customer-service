import type { ReactNode } from 'react';
import {
  Bot,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  FlaskConical,
  Globe,
  Mail,
  MessageCircle,
  MousePointerClick,
  Network,
  Smartphone,
  UserCheck,
  Users,
} from 'lucide-react';
import { CHANNEL_LABEL, ROLE_LABEL, STAGE_HELP, STAGE_LABEL, STAGE_ORDER } from '../domain/labels';
import { fmtDateTime } from '../domain/format';
import { isEnteredDirectlyInErp, stageIndex } from '../domain/orders';
import type { Channel, Order, Role, TimelineEvent } from '../domain/types';

export function ChannelIcon({ channel, size = 16 }: { channel: Channel; size?: number }) {
  const map: Record<Channel, ReactNode> = {
    email: <Mail size={size} />,
    whatsapp: <MessageCircle size={size} />,
    vendor: <Smartphone size={size} />,
    edi: <Network size={size} />,
    mipm: <Globe size={size} />,
    tracking_page: <MousePointerClick size={size} />,
    sales_request: <Users size={size} />,
  };
  return <>{map[channel]}</>;
}

export function ChannelLabel({ channel }: { channel: Channel }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <ChannelIcon channel={channel} /> {CHANNEL_LABEL[channel]}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const tone = role === 'finance' ? 'tone-info' : role === 'cs' ? 'tone-brand' : role === 'customer' ? 'tone-ok' : 'tone-neutral';
  return (
    <span className={`tag ${tone}`}>
      <UserCheck size={12} /> {ROLE_LABEL[role]}
    </span>
  );
}

export function StageStepper({ order }: { order: Order }) {
  const idx = stageIndex(order.stage);
  const direct = isEnteredDirectlyInErp(order);
  return (
    <div className="stepper" aria-label="Fases del pedido">
      {STAGE_ORDER.map((s, i) => {
        const na = direct && (s === 'draft' || s === 'approved');
        const blocked = s === 'erp_confirmed' && order.stage === 'erp_confirmed' && order.blockers.some((b) => b.status !== 'resolved');
        const cls = na ? 'na' : i < idx ? 'done' : i === idx ? 'current' : '';
        return (
          <div key={s} className={`step ${cls}`} title={STAGE_HELP[s]}>
            <div className="bar" />
            <span className="lbl">{STAGE_LABEL[s]}</span>
            <span className="sub">{na ? `No aplica: entró por ${CHANNEL_LABEL[order.channel]}` : blocked ? 'Retenido' : i === idx ? 'Fase actual' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

const actorIcon = (e: TimelineEvent) => {
  if (e.kind === 'demo') return <FlaskConical size={14} />;
  if (e.actor === 'capture') return <Bot size={14} />;
  if (e.actor === 'erp' || e.actor === 'system') return <Building2 size={14} />;
  if (e.kind === 'message') return <FileText size={14} />;
  if (e.kind === 'decision') return <CheckCircle2 size={14} />;
  return <Circle size={14} />;
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at) || Number(b.id.slice(1)) - Number(a.id.slice(1)));
  if (!sorted.length) return <p className="muted small">Sin actividad todavía.</p>;
  return (
    <ul className="timeline" data-testid="timeline">
      {sorted.map((e) => (
        <li key={e.id}>
          <span className={`tl-icon ${e.kind}`}>{actorIcon(e)}</span>
          <div>
            <div className="tl-text">{e.text}</div>
            <div className="tl-meta">
              {fmtDateTime(e.at)} · {e.actorName ?? ROLE_LABEL[e.actor]}
              {(e.actor === 'erp' || e.actor === 'capture' || e.kind === 'demo' || e.actorName?.includes('simulado')) && ' · simulado'}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
