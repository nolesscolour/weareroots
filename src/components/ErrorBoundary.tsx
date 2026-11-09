import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** If anything throws while rendering, show a calm fallback instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // no remote logging: keep visitor data on the device
    console.error('Roots crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, background: '#0A0A0A', color: '#F2F2F2', padding: 24, textAlign: 'center' }}>
        <p style={{ margin: 0, fontFamily: "'DotGothic16', monospace", fontSize: 28 }}>Roots is tuning.</p>
        <p style={{ margin: 0, fontSize: 14, color: '#7E7E7E' }}>Something went wrong on our side. Try again.</p>
        <button
          type="button"
          className="btn"
          onClick={() => window.location.reload()}
          style={{ padding: '12px 20px', borderRadius: 12, background: '#F2F2F2', color: '#0A0A0A', fontSize: 13, fontWeight: 700, letterSpacing: '.16em' }}
        >
          RELOAD
        </button>
      </div>
    );
  }
}
