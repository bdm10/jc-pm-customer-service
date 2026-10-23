import { Component, type ReactNode } from 'react';

/** Evita una pantalla en blanco en plena reunión: ofrece volver a la bandeja o reiniciar la demo. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="main">
        <div className="card card-body stack" role="alert">
          <h1>Algo no ha ido bien en la demo</h1>
          <p className="muted">Es un prototipo: puedes volver a la bandeja o reiniciar los datos de demostración. Los comentarios guardados se conservan.</p>
          <p className="xsmall muted">{this.state.error.message}</p>
          <div className="row wrap">
            <button
              className="btn"
              onClick={() => {
                window.location.hash = '/bandeja';
                this.setState({ error: null });
              }}
            >
              Volver a la bandeja
            </button>
            <button
              className="btn primary"
              onClick={() => {
                try {
                  localStorage.removeItem('cs-proto/state');
                } catch {
                  /* sin almacenamiento */
                }
                window.location.hash = '/bandeja';
                window.location.reload();
              }}
            >
              Reiniciar la demo
            </button>
          </div>
        </div>
      </div>
    );
  }
}
