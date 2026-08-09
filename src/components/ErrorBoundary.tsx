import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>Something went wrong.</h1>
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <strong>{this.state.error?.toString()}</strong>
          </div>
          {this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap', background: '#f3f4f6', padding: '1rem', borderRadius: '8px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>View Stack Trace</summary>
              <code>{this.state.errorInfo.componentStack}</code>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
