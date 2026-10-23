import { useMemo, useState } from 'react';
import { ChevronRight, Search, UserPlus } from 'lucide-react';
import { CHANNEL_LABEL } from '../domain/labels';
import { fmtAge } from '../domain/format';
import { buildQueue, type QueueItem, type QueueKind } from '../domain/queue';
import * as ops from '../domain/ops';
import type { Channel } from '../domain/types';
import { usePresenter } from '../presenter/PresenterContext';
import { scenarioById } from '../data/scenarios';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel } from '../components/common';
import { Disclosure, Pill, Tag } from '../components/ui';

const TYPE_FILTERS: { id: 'all' | QueueKind | 'orders'; label: string; match: (k: QueueKind) => boolean }[] = [
  { id: 'all', label: 'Todo', match: () => true },
  { id: 'draft', label: 'Pedidos nuevos', match: (k) => k === 'draft' },
  { id: 'blocked', label: 'Retenidos en ERP', match: (k) => k === 'blocked' },
  { id: 'order', label: 'Envíos por preparar', match: (k) => k === 'order' },
  { id: 'onboarding', label: 'Altas', match: (k) => k === 'onboarding' },
  { id: 'claim', label: 'Incidencias', match: (k) => k === 'claim' },
  { id: 'enquiry', label: 'Consultas', match: (k) => k === 'enquiry' },
];

export function Bandeja() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]['id']>('all');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [owner, setOwner] = useState<'all' | 'me' | 'none'>('all');

  const all = useMemo(() => buildQueue(state), [state]);
  const items = all.filter((i) => {
    const f = TYPE_FILTERS.find((t) => t.id === type)!;
    if (!f.match(i.kind)) return false;
    if (channel !== 'all' && i.channel !== channel) return false;
    if (owner === 'me' && i.owner !== state.currentUser.name) return false;
    if (owner === 'none' && i.owner) return false;
    if (q.trim() && !i.search.includes(q.trim().toLowerCase()) && !i.customer.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });
  const you = items.filter((i) => i.needs === 'you');
  const others = items.filter((i) => i.needs === 'others');
  const none = items.filter((i) => i.needs === 'none');
  const channels = Array.from(new Set(all.map((i) => i.channel)));
  const count = (k: (typeof TYPE_FILTERS)[number]) => all.filter((i) => k.match(i.kind)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bandeja</h1>
          <p>Lo que necesita atención, ordenado por prioridad. Cada fila indica por qué está aquí, quién debe decidir y cuál es el siguiente paso.</p>
        </div>
        <div className="row wrap">
          <Pill tone="warn">{all.filter((i) => i.needs === 'you').length} requieren tu acción</Pill>
          <Pill tone="neutral">{all.filter((i) => i.needs === 'others').length} esperando a otros</Pill>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="filters">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Buscar cliente, pedido o producto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" data-testid="queue-search" />
          </div>
          <select className="select" style={{ width: 'auto' }} value={channel} onChange={(e) => setChannel(e.target.value as Channel | 'all')} aria-label="Canal">
            <option value="all">Todos los canales</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 'auto' }} value={owner} onChange={(e) => setOwner(e.target.value as 'all' | 'me' | 'none')} aria-label="Responsable">
            <option value="all">Cualquier responsable</option>
            <option value="me">Asignados a mí</option>
            <option value="none">Sin asignar</option>
          </select>
        </div>
        <div className="filters" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="chips" role="group" aria-label="Tipo de solicitud">
            {TYPE_FILTERS.map((t) => (
              <button key={t.id} className="chip" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                {t.label} <span className="muted">{count(t)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <QueueSection title="Requiere tu acción" items={you} empty="Nada pendiente de tu parte con estos filtros." />
      <QueueSection title="Esperando a otros" items={others} empty="Nada esperando a otros roles con estos filtros." />
      {none.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <Disclosure summary={`Sin acciones pendientes (${none.length})`}>
            <QueueList items={none} />
          </Disclosure>
        </div>
      )}
    </>
  );
}

function QueueSection({ title, items, empty }: { title: string; items: QueueItem[]; empty: string }) {
  return (
    <>
      <div className="section-title">
        <h2>{title}</h2>
        <span className="count">{items.length}</span>
      </div>
      {items.length ? <QueueList items={items} /> : <div className="card empty">{empty}</div>}
    </>
  );
}

function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <div className="card queue" data-testid="queue">
      <div className="qhead" aria-hidden>
        <span>Prioridad</span>
        <span>Cliente y solicitud</span>
        <span>Canal · antigüedad</span>
        <span>Responsable</span>
        <span>Estado</span>
        <span>Bloqueos · quién decide</span>
        <span />
      </div>
      {items.map((i) => (
        <QueueRow key={i.id} item={i} />
      ))}
    </div>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const { apply } = useStore();
  const { open } = usePresenter();
  const sc = scenarioById(item.scenarioId);
  const assignable = item.kind !== 'onboarding';
  return (
    <div
      className={`qrow prio-${item.priority.level}`}
      role="link"
      tabIndex={0}
      data-testid={`queue-row-${item.id}`}
      onClick={() => navigate(item.route)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(item.route);
      }}
    >
      <div className="prio">
        <span className={`lvl lvl-${item.priority.level}`}>{item.priority.level}</span>
        <span className="why">{item.priority.reason}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="qcustomer">{item.customer}</div>
        <div className="qsub">
          {item.requestType} · {item.id}
          {item.company === 'JC' && (
            <>
              {' '}
              · <Tag>JC</Tag>
            </>
          )}
          {open && sc && (
            <>
              {' '}
              <Tag tone="brand">Escenario {sc.number}</Tag>
            </>
          )}
        </div>
      </div>
      <div className="small">
        <ChannelLabel channel={item.channel} />
        <div className="qsub">{fmtAge(item.receivedAt)}</div>
      </div>
      <div className="small">
        {item.owner ?? <span className="muted">Sin asignar</span>}
        {!item.owner && assignable && (
          <div>
            <button
              className="btn ghost sm"
              style={{ paddingLeft: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                apply((s) => ops.assignToMe(s, item.kind === 'claim' ? 'claim' : item.kind === 'enquiry' ? 'enquiry' : 'order', item.id));
              }}
            >
              <UserPlus size={14} /> Asignarme
            </button>
          </div>
        )}
      </div>
      <div>
        <Pill tone={item.statusTone}>{item.status}</Pill>
      </div>
      <div className="qblockers">
        {item.blockers.length === 0 && <span className="qnext">{item.nextAction}</span>}
        {item.blockers.map((b, i) => (
          <div key={i} className="row wrap" style={{ gap: 6 }}>
            <Pill tone={b.tone}>{b.label}</Pill>
            <span className="xsmall muted">Decide: {b.who}</span>
          </div>
        ))}
        {item.blockers.length > 0 && <span className="qnext">→ {item.nextAction}</span>}
      </div>
      <div className="qcol-arrow" aria-hidden>
        <ChevronRight size={18} color="var(--text-3)" />
      </div>
    </div>
  );
}
