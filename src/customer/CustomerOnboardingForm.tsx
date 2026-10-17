import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CUSTOMER_FIELDS, GROUP_LABEL, isCustomerFieldRequired, isValidSpanishTaxIdFormat, SAMPLE_CUSTOMER_DATA } from '../domain/onboarding';
import * as ops from '../domain/ops';
import type { OnboardingCustomerData } from '../domain/types';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { AsyncButton, Callout, useToast } from '../components/ui';
import { NotFound } from '../App';
import { CustomerShell } from './CustomerShell';

export function CustomerOnboardingForm({ token }: { token: string }) {
  const { state, begin, services } = useStore();
  const toast = useToast();
  const c = Object.values(state.onboarding).find((x) => x.invite?.token === token);
  const [data, setData] = useState<Partial<OnboardingCustomerData>>(() => c?.customerData ?? {});
  const [consent, setConsent] = useState(false);
  if (!c) return <NotFound />;
  const back = () => navigate(`/alta/${c.id}`);
  const missing = CUSTOMER_FIELDS.filter((f) => isCustomerFieldRequired(f.key, data) && !(data[f.key] ?? '').trim());
  const taxBad = !!data.taxId && !isValidSpanishTaxIdFormat(data.taxId);

  if (c.customerSubmittedAt) {
    return (
      <CustomerShell back={back} backLabel="Volver al espacio de trabajo">
        <div className="card card-body stack lg" data-testid="onboarding-submitted">
          <div className="row" style={{ gap: 10 }}>
            <CheckCircle2 size={28} color="var(--ok)" />
            <h1>Gracias, hemos recibido tus datos</h1>
          </div>
          <p>Nuestro equipo los revisará. Te avisaremos cuando tu cuenta esté activa. Si necesitamos algo más, te escribiremos.</p>
          <div>
            <button className="btn primary" onClick={back} data-testid="back-to-onboarding">
              Volver al espacio de trabajo (presentador)
            </button>
          </div>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell back={back} backLabel="Volver al espacio de trabajo">
      <div className="stack lg" data-testid="customer-onboarding-form">
        <div>
          <h1>Alta de cliente</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Hola, {c.prospectName}. Completa tus datos para que podamos activar tu cuenta y servir tu primer pedido.
          </p>
        </div>
        <Callout tone="info" title="Solo te pedimos lo que tú conoces">
          Las condiciones comerciales las acuerdas con tu comercial; no tienes que rellenarlas aquí.
        </Callout>
        <div className="row wrap">
          <button className="btn demo" onClick={() => setData({ ...SAMPLE_CUSTOMER_DATA })} data-testid="fill-sample">
            Rellenar con datos de ejemplo (demo)
          </button>
        </div>
        {(['legal', 'billing', 'delivery', 'contact'] as const).map((g) => (
          <div key={g} className="card card-body stack">
            <h2>{GROUP_LABEL[g]}</h2>
            <div className="form-grid">
              {CUSTOMER_FIELDS.filter((f) => f.group === g).map((f) => {
                const req = isCustomerFieldRequired(f.key, data);
                return (
                  <div key={f.key} className={`field ${f.key.toLowerCase().includes('address') ? 'full' : ''}`}>
                    <label className="label" htmlFor={`cf-${f.key}`}>
                      {f.label}
                      {req ? ' *' : ' (opcional)'}
                    </label>
                    {f.key === 'paymentMethod' ? (
                      <select id={`cf-${f.key}`} className="select" value={data.paymentMethod ?? ''} onChange={(e) => setData({ ...data, paymentMethod: e.target.value })}>
                        <option value="">Elige una opción</option>
                        <option>Domiciliación bancaria (SEPA)</option>
                        <option>Transferencia</option>
                        <option>Pago anticipado</option>
                      </select>
                    ) : (
                      <input id={`cf-${f.key}`} className="input" value={data[f.key] ?? ''} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} />
                    )}
                    {f.key === 'taxId' && taxBad && <span className="xsmall" style={{ color: 'var(--alert)' }}>Revisa el formato (letra y 8 caracteres).</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <label className="choice">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="small">Acepto el tratamiento de mis datos para la gestión de la cuenta. (Texto legal pendiente: no es un consentimiento real.)</span>
        </label>
        <div className="row wrap">
          <AsyncButton
            className="btn primary lg"
            disabled={missing.length > 0 || !consent || taxBad}
            busyLabel="Enviando (simulado)…"
            testId="submit-onboarding"
            onClick={async () => {
              const act = begin();
              const dups = await services.directory.findDuplicates(data);
              act((s) => ops.submitCustomerForm(s, c.id, data, dups));
              toast('Formulario enviado (vista previa). Vuelve al espacio de trabajo para revisarlo.');
            }}
          >
            Enviar mis datos
          </AsyncButton>
          {(missing.length > 0 || !consent) && (
            <span className="small muted">{missing.length ? `Faltan ${missing.length} campos obligatorios.` : 'Falta aceptar el tratamiento de datos.'}</span>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}
