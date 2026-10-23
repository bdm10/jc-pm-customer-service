import { fmtAge } from '../domain/format';
import { outstandingDecisions, sectionCompleteness } from '../domain/onboarding';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { Pill, Progress } from '../components/ui';

export const ONBOARDING_STATUS: Record<string, { label: string; tone: 'info' | 'neutral' | 'ok' | 'warn' }> = {
  draft: { label: 'Sin enlace enviado', tone: 'warn' },
  waiting_customer: { label: 'Esperando al cliente', tone: 'neutral' },
  in_review: { label: 'En revisión', tone: 'info' },
  created: { label: 'Cuenta creada', tone: 'ok' },
  merged: { label: 'Reactivación de cuenta existente', tone: 'neutral' },
};

export function Altas() {
  const { state } = useStore();
  const cases = Object.values(state.onboarding).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Altas de clientes</h1>
          <p>Cada alta separa lo que aporta el cliente, lo que aporta el comercial y lo que asignan internamente Administración y Finanzas.</p>
        </div>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Alta</th>
              <th>Cliente</th>
              <th>Solicitada por</th>
              <th>Estado</th>
              <th style={{ minWidth: 160 }}>Datos completos</th>
              <th>Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const comp = sectionCompleteness(c);
              const pending = outstandingDecisions(c);
              const st = ONBOARDING_STATUS[c.status];
              return (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/alta/${c.id}`)} data-testid={`onboarding-row-${c.id}`}>
                  <td>
                    <div className="strong">{c.id}</div>
                    <div className="xsmall muted">{fmtAge(c.createdAt)}</div>
                  </td>
                  <td>
                    {c.prospectName}
                    {c.linkedOrderId && <div className="xsmall muted">Pedido en espera: {c.linkedOrderId}</div>}
                  </td>
                  <td className="small">{c.requestedBy}</td>
                  <td>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </td>
                  <td>
                    <Progress value={comp.customer.done + comp.sales.done + comp.internal.done} total={comp.customer.total + comp.sales.total + comp.internal.total} />
                  </td>
                  <td className="small">{pending.length ? `${pending.length} · ${pending[0].text}` : 'Nada'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
