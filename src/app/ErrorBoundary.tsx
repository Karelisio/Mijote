import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '@/i18n';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ paddingTop: 96 }}>
        <h2 className="empty-title">{t('common.error')}</h2>
        <p className="empty-body selectable">{this.state.error.message}</p>
        <button
          type="button"
          className="btn btn-filled ripple"
          onClick={() => window.location.assign('/recipes')}
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }
}
