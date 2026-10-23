import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import { PresenterProvider } from './presenter/PresenterContext';
import { setLatency } from './services/mock';
import { StoreProvider } from './state/store';
import './styles.css';

// ?rapido=1 reduce la latencia simulada (útil para pruebas automáticas).
if (new URLSearchParams(window.location.search).has('rapido')) setLatency(40);

// Señal para el cargador de la vista previa protegida: la app ha arrancado.
(window as unknown as { __CS_BOOTED?: boolean }).__CS_BOOTED = true;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <PresenterProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </PresenterProvider>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
