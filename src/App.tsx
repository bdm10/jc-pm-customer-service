import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Presentation, RotateCcw } from 'lucide-react';
import { SCENARIOS } from './data/scenarios';
import { buildQueue } from './domain/queue';
import type { DemoState, ScenarioId } from './domain/types';
import { PresenterDrawer } from './presenter/PresenterDrawer';
import { usePresenter } from './presenter/PresenterContext';
import { navigate, useRoute } from './state/router';
import { useStore } from './state/store';
import { ConfirmDialog, useToast } from './components/ui';
import { Bandeja } from './screens/Bandeja';
import { Pedidos } from './screens/Pedidos';
import { OrderWorkspace } from './screens/OrderWorkspace';
import { Altas } from './screens/Altas';
import { OnboardingWorkspace } from './screens/OnboardingWorkspace';
import { Incidencias } from './screens/Incidencias';
import { ClaimWorkspace } from './screens/ClaimWorkspace';
import { Seguimiento } from './screens/Seguimiento';
import { EnquiryWorkspace } from './screens/EnquiryWorkspace';
import { Supuestos } from './screens/Supuestos';
import { CustomerTracking } from './customer/CustomerTracking';
import { ReportProblem } from './customer/ReportProblem';
import { CustomerOnboardingForm } from './customer/CustomerOnboardingForm';

function scenarioForRoute(s: DemoState, parts: string[]): ScenarioId | undefined {
  const [a, b, c] = parts;
  if (a === 'pedido') return s.orders[b]?.scenarioId;
  if (a === 'alta') return s.onboarding[b]?.scenarioId;
  if (a === 'incidencia') return s.claims[b]?.scenarioId;
  if (a === 'cliente' && b === 'seguimiento') return Object.values(s.shipments).find((x) => x.tracking.token === c)?.scenarioId;
  if (a === 'cliente' && b === 'alta') return Object.values(s.onboarding).find((x) => x.invite?.token === c)?.scenarioId;
  return undefined;
}

export function ProtoBanner() {
  return (
    <div className="proto-banner" role="note" data-testid="proto-banner">
      <FlaskConical size={15} />
      <span>Prototipo — datos y acciones simulados</span>
      <span className="sep long">·</span>
      <span className="long">No conecta con Navision, no envía mensajes y no modifica pedidos reales</span>
    </div>
  );
}

export function PresenterControls({ compact = false }: { compact?: boolean }) {
  const { open, setOpen, scenarioId, setScenarioId } = usePresenter();
  const { reset } = useStore();
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  return (
    <>
      {!compact && (
        <select
          className="select scenario-select"
          aria-label="Escenario de demostración"
          value={scenarioId ?? ''}
          data-testid="scenario-select"
          onChange={(e) => {
            const id = e.target.value as ScenarioId;
            const sc = SCENARIOS.find((x) => x.id === id);
            setScenarioId(sc?.id);
            if (sc) navigate(sc.route);
          }}
        >
          <option value="">Escenario de demo…</option>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number}. {s.title}
            </option>
          ))}
        </select>
      )}
      <button className={`btn ${open ? 'primary' : ''}`} onClick={() => setOpen(!open)} aria-pressed={open} data-testid="toggle-presenter">
        <Presentation size={16} /> <span className="btn-label">{compact ? 'Notas' : 'Presentación'}</span>
      </button>
      <button className="btn" onClick={() => setConfirm(true)} data-testid="reset-demo">
        <RotateCcw size={16} /> <span className="btn-label">Reset demo</span>
      </button>
      {confirm && (
        <ConfirmDialog
          title="Reiniciar toda la demo"
          body="Se restauran los datos de partida de los seis escenarios y de la bandeja. Los comentarios guardados se conservan."
          confirmLabel="Reiniciar demo"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            reset();
            setConfirm(false);
            const sc = SCENARIOS.find((x) => x.id === scenarioId);
            navigate(sc ? sc.route : '/bandeja');
            toast('Demo reiniciada. Los comentarios se han conservado.');
          }}
        />
      )}
    </>
  );
}

const NAV = [
  { path: 'bandeja', label: 'Bandeja' },
  { path: 'pedidos', label: 'Pedidos' },
  { path: 'altas', label: 'Altas de clientes' },
  { path: 'incidencias', label: 'Incidencias' },
  { path: 'seguimiento', label: 'Seguimiento' },
];

function Topbar({ section }: { section: string }) {
  const { state } = useStore();
  const counts = useMemo(() => {
    const q = buildQueue(state);
    return {
      bandeja: q.filter((x) => x.needs === 'you').length,
      pedidos: Object.values(state.orders).filter((o) => o.stage === 'erp_confirmed' && o.blockers.some((b) => b.status !== 'resolved')).length,
      altas: Object.values(state.onboarding).filter((c) => c.status !== 'created' && c.status !== 'merged').length,
      incidencias: Object.values(state.claims).filter((c) => c.status !== 'resolved').length,
      seguimiento: Object.values(state.shipments).filter((s) => s.carrierUpdateMissing).length + Object.values(state.enquiries).filter((e) => e.status === 'open').length,
    } as Record<string, number>;
  }, [state]);
  const map: Record<string, string> = { pedido: 'pedidos', alta: 'altas', incidencia: 'incidencias', consulta: 'seguimiento' };
  const active = map[section] ?? section;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-row">
          <a className="brand" href="#/bandeja">
            <span className="brand-mark">CS</span>
            <span>
              <span className="brand-title">Atención al Cliente</span>
              <br />
              <span className="brand-sub">Espacio de trabajo JC · PM</span>
            </span>
          </a>
          <div className="topbar-actions">
            <PresenterControls />
            <span className="user-chip" title="Ana Ruiz · Atención al Cliente PM. Usuario de demostración: no hay autenticación real en el prototipo.">
              <span className="avatar">AR</span>
              <span className="label">Ana Ruiz (demo)</span>
            </span>
          </div>
        </div>
        <nav className="nav" aria-label="Secciones">
          {NAV.map((n) => (
            <a key={n.path} href={`#/${n.path}`} className={active === n.path ? 'active' : ''}>
              {n.label}
              {counts[n.path] > 0 && <span className="count">{counts[n.path]}</span>}
            </a>
          ))}
          <a href="#/supuestos" className={active === 'supuestos' ? 'active' : ''} style={{ marginLeft: 'auto' }}>
            Supuestos y preguntas
          </a>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const parts = useRoute();
  const { state } = useStore();
  const { open, setScenarioId } = usePresenter();
  const [section, id, sub] = parts;

  useEffect(() => {
    const sc = scenarioForRoute(state, parts);
    if (sc) setScenarioId(sc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.join('/')]);

  if (section === 'cliente') {
    let page = <NotFound />;
    if (id === 'seguimiento' && parts[3] === 'problema') page = <ReportProblem token={sub} />;
    else if (id === 'seguimiento') page = <CustomerTracking token={sub} />;
    else if (id === 'alta') page = <CustomerOnboardingForm token={sub} />;
    return (
      <div className={`app ${open ? 'with-drawer' : ''}`}>
        <ProtoBanner />
        {page}
        <PresenterDrawer />
      </div>
    );
  }

  let page;
  switch (section) {
    case undefined:
    case 'bandeja':
      page = <Bandeja />;
      break;
    case 'pedidos':
      page = <Pedidos />;
      break;
    case 'pedido':
      page = <OrderWorkspace id={id} />;
      break;
    case 'altas':
      page = <Altas />;
      break;
    case 'alta':
      page = <OnboardingWorkspace id={id} />;
      break;
    case 'incidencias':
      page = <Incidencias />;
      break;
    case 'incidencia':
      page = <ClaimWorkspace id={id} />;
      break;
    case 'seguimiento':
      page = <Seguimiento />;
      break;
    case 'consulta':
      page = <EnquiryWorkspace id={id} />;
      break;
    case 'supuestos':
      page = <Supuestos />;
      break;
    default:
      page = <NotFound />;
  }

  return (
    <div className={`app ${open ? 'with-drawer' : ''}`}>
      <ProtoBanner />
      <Topbar section={section ?? 'bandeja'} />
      <main className="main">{page}</main>
      <PresenterDrawer />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="main">
      <div className="card card-body stack">
        <h1>No encontrado</h1>
        <p className="muted">Este elemento no existe en los datos de la demo (puede que se haya reiniciado).</p>
        <div>
          <button className="btn" onClick={() => navigate('/bandeja')}>
            Volver a la bandeja
          </button>
        </div>
      </div>
    </div>
  );
}
