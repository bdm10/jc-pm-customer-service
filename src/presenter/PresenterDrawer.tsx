import { useState } from 'react';
import { CheckCircle2, Circle, Download, MessageSquarePlus, Play, RotateCcw, Trash2, X } from 'lucide-react';
import { GLOBAL_ASSUMPTIONS, GLOBAL_QUESTIONS, SCENARIOS, scenarioById } from '../data/scenarios';
import { feedbackToCsv, feedbackToJson, isFeedbackEmpty, type FeedbackPriority } from '../domain/feedback';
import type { ScenarioId } from '../domain/types';
import { download, useFeedback } from '../state/feedback';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { ConfirmDialog, useToast } from '../components/ui';
import { usePresenter } from './PresenterContext';

export const scenarioTitle = (id: ScenarioId | 'general') => (id === 'general' ? 'General' : `${scenarioById(id)?.number}. ${scenarioById(id)?.title}`);

export function exportFeedback(kind: 'csv' | 'json', entries: ReturnType<typeof useFeedback>['entries']) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  if (kind === 'csv') download(`comentarios-prototipo-${stamp}.csv`, feedbackToCsv(entries, scenarioTitle), 'text/csv;charset=utf-8');
  else download(`comentarios-prototipo-${stamp}.json`, feedbackToJson(entries, scenarioTitle), 'application/json');
}

export function PresenterDrawer() {
  const { open, setOpen, scenarioId, setScenarioId } = usePresenter();
  const { resetScenario } = useStore();
  const [tab, setTab] = useState<'guion' | 'comentarios' | 'supuestos'>('guion');
  const [confirmReset, setConfirmReset] = useState(false);
  const toast = useToast();
  if (!open) return null;
  const sc = scenarioById(scenarioId);

  return (
    <aside className="drawer" aria-label="Modo presentación" data-testid="presenter">
      <div className="drawer-head">
        <div className="row between">
          <div>
            <div className="xsmall muted strong" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Modo presentación
            </div>
            <h2 style={{ marginTop: 2 }}>{sc ? `${sc.number}. ${sc.title}` : 'Elige un escenario'}</h2>
          </div>
          <button className="btn ghost sm" onClick={() => setOpen(false)} aria-label="Cerrar modo presentación">
            <X size={18} />
          </button>
        </div>
        <div className="scen-grid" role="group" aria-label="Escenarios">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className="scen-btn"
              aria-pressed={s.id === scenarioId}
              onClick={() => {
                setScenarioId(s.id);
                navigate(s.route);
              }}
            >
              <b>Escenario {s.number}</b>
              {s.short}
            </button>
          ))}
        </div>
        <div className="tabs" role="tablist">
          {(
            [
              ['guion', 'Guion'],
              ['comentarios', 'Comentarios'],
              ['supuestos', 'Supuestos y preguntas'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="drawer-body">
        {tab === 'guion' && (sc ? <Script id={sc.id} /> : <p className="muted">Selecciona uno de los seis escenarios para ver el guion, los pasos y registrar comentarios.</p>)}
        {tab === 'comentarios' && <FeedbackPanel scenarioId={sc?.id ?? 'general'} />}
        {tab === 'supuestos' && (
          <div className="stack lg">
            {sc && (
              <>
                <section className="stack sm">
                  <h3>Supuestos de este escenario</h3>
                  <ul className="plain small">
                    {sc.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </section>
                <section className="stack sm">
                  <h3>Preguntas para el equipo de PM</h3>
                  <ul className="plain small">
                    {sc.questions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}
            <section className="stack sm">
              <h3>Supuestos generales</h3>
              <ul className="plain small">
                {GLOBAL_ASSUMPTIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
            <section className="stack sm">
              <h3>Preguntas generales</h3>
              <ul className="plain small">
                {GLOBAL_QUESTIONS.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
            <button className="btn sm" onClick={() => navigate('/supuestos')}>
              Abrir la página completa de supuestos
            </button>
          </div>
        )}
      </div>

      {sc && (
        <div className="drawer-foot">
          <button className="btn sm" onClick={() => navigate(sc.route)}>
            <Play size={15} /> Ir al inicio del escenario
          </button>
          <button className="btn sm" onClick={() => setConfirmReset(true)} data-testid="reset-scenario">
            <RotateCcw size={15} /> Reiniciar este escenario
          </button>
        </div>
      )}
      {confirmReset && sc && (
        <ConfirmDialog
          title={`Reiniciar «${sc.title}»`}
          body="Se restauran solo los datos de este escenario. El resto de la demo y los comentarios guardados se conservan."
          confirmLabel="Reiniciar escenario"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            resetScenario(sc.id);
            setConfirmReset(false);
            navigate(sc.route);
            toast(`Escenario ${sc.number} reiniciado.`);
          }}
        />
      )}
    </aside>
  );
}

function Script({ id }: { id: ScenarioId }) {
  const { state } = useStore();
  const sc = scenarioById(id)!;
  const done = sc.steps.filter((s) => s.done(state)).length;
  return (
    <div className="stack lg">
      <div className="note-block">
        <div className="xsmall muted strong">PARA QUÉ LO MOSTRAMOS · {sc.minutes}</div>
        <p>{sc.purpose}</p>
      </div>
      <div className="cmp">
        <div className="tone-neutral" style={{ border: '1px solid var(--neutral-border)' }}>
          <div className="xsmall strong">HOY</div>
          {sc.currentState}
        </div>
        <div className="tone-proposed" style={{ border: '1px solid var(--proposed-border)' }}>
          <div className="xsmall strong">PROPUESTA</div>
          {sc.proposed}
        </div>
      </div>
      <section className="stack sm">
        <div className="row between">
          <h3>Pasos</h3>
          <span className="small muted">
            {done}/{sc.steps.length} hechos
          </span>
        </div>
        <ol className="checklist" data-testid="scenario-steps">
          {sc.steps.map((st) => {
            const ok = st.done(state);
            return (
              <li key={st.label} className={ok ? 'done' : ''} data-done={ok}>
                {ok ? <CheckCircle2 size={18} color="var(--ok)" /> : <Circle size={18} color="var(--border-strong)" />}
                <span className="txt">
                  {st.label}
                  {st.optional && <span className="muted"> (opcional)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="callout tone-brand" style={{ borderColor: '#e6c6d2' }}>
        <div>
          <div className="title">Mensaje clave</div>
          <div style={{ color: 'var(--text-2)' }}>{sc.keyMessage}</div>
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({ scenarioId }: { scenarioId: ScenarioId | 'general' }) {
  const { entries, add, remove } = useFeedback();
  const toast = useToast();
  const empty = { author: '', whatToChange: '', missingStep: '', whoDecides: '', priority: 'Media' as FeedbackPriority };
  const [form, setForm] = useState(empty);
  const mine = entries.filter((e) => e.scenarioId === scenarioId);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack lg" data-testid="feedback-panel">
      <p className="small muted">
        Comentarios para <strong>{scenarioTitle(scenarioId)}</strong>. Se guardan en este navegador y no se borran con «Reset demo».
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (isFeedbackEmpty(form)) {
            toast('Escribe al menos «Qué cambiar», «Paso que falta» o «Quién decide».', 'alert');
            return;
          }
          add({ ...form, scenarioId });
          setForm({ ...empty, author: form.author });
          toast('Comentario guardado.');
        }}
      >
        <div className="field">
          <label className="label" htmlFor="fb-what">
            Qué cambiar
          </label>
          <textarea id="fb-what" className="textarea" value={form.whatToChange} onChange={set('whatToChange')} />
        </div>
        <div className="field">
          <label className="label" htmlFor="fb-missing">
            Paso que falta
          </label>
          <textarea id="fb-missing" className="textarea" style={{ minHeight: 60 }} value={form.missingStep} onChange={set('missingStep')} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label className="label" htmlFor="fb-who">
              Quién decide
            </label>
            <input id="fb-who" className="input" list="roles" value={form.whoDecides} onChange={set('whoDecides')} placeholder="p. ej. Finanzas" />
            <datalist id="roles">
              {['Atención al Cliente', 'Finanzas', 'Comercial', 'Dirección comercial', 'Logística', 'Trade Marketing', 'Tecnología'].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label className="label" htmlFor="fb-prio">
              Prioridad
            </label>
            <select id="fb-prio" className="select" value={form.priority} onChange={set('priority')}>
              <option>Alta</option>
              <option>Media</option>
              <option>Baja</option>
            </select>
          </div>
          <div className="field full">
            <label className="label" htmlFor="fb-author">
              Quién comenta (opcional)
            </label>
            <input id="fb-author" className="input" value={form.author} onChange={set('author')} />
          </div>
        </div>
        <button className="btn primary" type="submit">
          <MessageSquarePlus size={16} /> Guardar comentario
        </button>
      </form>

      <section className="stack sm">
        <h3>Guardados aquí ({mine.length})</h3>
        {mine.length === 0 && <p className="small muted">Todavía no hay comentarios para este escenario.</p>}
        {mine.map((e) => (
          <div key={e.id} className="role-box small stack sm" data-testid="feedback-entry">
            <div className="row between">
              <span className={`tag ${e.priority === 'Alta' ? 'tone-alert' : e.priority === 'Media' ? 'tone-warn' : 'tone-neutral'}`}>Prioridad {e.priority}</span>
              <button className="btn ghost sm" aria-label="Borrar comentario" onClick={() => remove(e.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            {e.whatToChange && (
              <div>
                <b>Qué cambiar:</b> {e.whatToChange}
              </div>
            )}
            {e.missingStep && (
              <div>
                <b>Paso que falta:</b> {e.missingStep}
              </div>
            )}
            {e.whoDecides && (
              <div>
                <b>Quién decide:</b> {e.whoDecides}
              </div>
            )}
            <div className="xsmall muted">
              {new Date(e.createdAt).toLocaleString('es-ES')}
              {e.author && ` · ${e.author}`}
            </div>
          </div>
        ))}
      </section>

      <section className="stack sm">
        <h3>Exportar todos los comentarios ({entries.length})</h3>
        <div className="row wrap">
          <button className="btn sm" disabled={!entries.length} onClick={() => exportFeedback('csv', entries)} data-testid="export-csv">
            <Download size={15} /> CSV (Excel)
          </button>
          <button className="btn sm" disabled={!entries.length} onClick={() => exportFeedback('json', entries)} data-testid="export-json">
            <Download size={15} /> JSON
          </button>
        </div>
      </section>
    </div>
  );
}
