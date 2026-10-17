import { CLAIM_TYPE_LABEL } from '../domain/labels';
import { fmtAge } from '../domain/format';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ChannelLabel } from '../components/common';
import { Pill } from '../components/ui';

export const CLAIM_STATUS: Record<string, { label: string; tone: 'warn' | 'neutral' | 'ok' | 'info' }> = {
  new: { label: 'Nueva', tone: 'warn' },
  investigating: { label: 'En investigación', tone: 'info' },
  proposal_pending: { label: 'Propuesta en aprobación', tone: 'neutral' },
  resolved: { label: 'Cerrada', tone: 'ok' },
};

export function Incidencias() {
  const { state } = useStore();
  const claims = Object.values(state.claims).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Incidencias</h1>
          <p>Faltas, daños y otros problemas de entrega. Cada incidencia tiene responsable, evidencia y siguiente paso. Ningún abono ni reposición se emite automáticamente.</p>
        </div>
      </div>
      <div className="card table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Incidencia</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Canal</th>
              <th>Responsable</th>
              <th>Estado</th>
              <th>Siguiente paso</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/incidencia/${c.id}`)} data-testid={`claim-row-${c.id}`}>
                <td>
                  <div className="strong">{c.id}</div>
                  <div className="xsmall muted">{fmtAge(c.createdAt)}</div>
                </td>
                <td>{state.customers[c.customerId]?.name}</td>
                <td>{CLAIM_TYPE_LABEL[c.type]}</td>
                <td className="small">
                  <ChannelLabel channel={c.channel} />
                </td>
                <td className="small">{c.owner}</td>
                <td>
                  <Pill tone={CLAIM_STATUS[c.status].tone}>{CLAIM_STATUS[c.status].label}</Pill>
                </td>
                <td className="small">{c.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!claims.length && <div className="empty">No hay incidencias.</div>}
      </div>
    </>
  );
}
