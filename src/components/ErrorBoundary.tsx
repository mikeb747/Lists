import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocal = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
            color: '#1c1b1f',
            background: '#fffbfe',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#eaddff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '16px',
            }}
          >
            📋
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '1.4rem', fontWeight: 700 }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 20px', color: '#49454f', maxWidth: '360px', fontSize: '0.95rem' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading Lists.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: '#6750a4',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={this.handleResetLocal}
              style={{
                background: 'transparent',
                color: '#6750a4',
                border: '1px solid #6750a4',
                borderRadius: '20px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Clear Cache &amp; Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
