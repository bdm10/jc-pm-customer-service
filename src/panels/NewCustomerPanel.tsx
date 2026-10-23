import { UserPlus } from 'lucide-react';
import { outstandingDecisions, sectionCompleteness } from '../domain/onboarding';
import type { Order } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { Callout, Card, Pill, Progress, ProposedTag } from '../components/ui';
import { ONBOARDING_STATUS } from '../screens/Altas';

export function NewCustomerPanel({ o }: { o: Order }) {
  const { state } = useStore();
  const b = o.blockers.find((x) => x.type === 'new_customer');
  const c = o.onboardingId ? state.onboarding[o.onboardingId] : undefined;
  if (!b || !c) return null;
  const comp = sectionCompleteness(c);
  const pending = outstandingDecisions(c);
  const total = comp.customer.total + comp.sales.total + comp.internal.total;
  const done = comp.customer.done + comp.sales.done + comp.internal.done;
  return (
    <Card id="panel-new_customer" title="Cliente nuevo" icon={<UserPlus size={18} />} actions={<ProposedTag>Comprobación propuesta</ProposedTag>}>
      <div className="stack">
        {b.status === 'resolved' ? (
          <Callout tone="ok" title="Cuenta creada">
            {b.resolution} Ya puedes revisar y aprobar el borrador.
          </Callout>
        ) : b.status === 'waiting' ? (
          <Callout tone="neutral" title="Reactivación de una cuenta existente">
            {b.reason}
          </Callout>
        ) : (
          <Callout tone="warn" title="El pedido espera al alta del cliente">
            {b.reason}
          </Callout>
        )}
        <div className="role-box stack sm">
          <div className="row between wrap">
            <strong>
              Alta {c.id} · {c.prospectName}
            </strong>
            <Pill tone={ONBOARDING_STATUS[c.status].tone}>{ONBOARDING_STATUS[c.status].label}</Pill>
          </div>
          <Progress value={done} total={total} />
          {pending.length > 0 && c.status !== 'merged' && c.status !== 'created' && (
            <ul className="plain small">
              {pending.slice(0, 4).map((p) => (
                <li key={p.text}>
                  {p.text} — <strong>{p.owner}</strong>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button className="btn primary" onClick={() => navigate(`/alta/${c.id}`)} data-testid="open-onboarding">
              Abrir el alta {c.id}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
