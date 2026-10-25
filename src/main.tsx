import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@ttqtt/liquid-glass-react/style.css';
import './styles/global.css';
import './styles/appearance.css';
import App from './App';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            height: '100%',
            background: '#0f1218',
            color: '#f4f7ff',
            fontFamily: 'Segoe UI, Microsoft YaHei UI, sans-serif',
            padding: 40,
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', opacity: 0.4 }}>LUMEN</div>
            <h1 style={{ fontSize: 28, margin: '12px 0' }}>界面加载遇到了一点问题</h1>
            <p style={{ color: 'rgba(235,243,255,.55)', lineHeight: 1.7 }}>
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                padding: '10px 16px',
                borderRadius: 10,
                background: '#bdfbf1',
                color: '#08201d',
                fontWeight: 600,
              }}
            >
              重新载入
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
