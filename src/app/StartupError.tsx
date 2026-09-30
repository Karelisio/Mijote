import { useState } from 'react';
import { t } from '@/i18n';

/** Blocking screen shown when the database cannot be opened: nothing else can work without it. */
export function StartupError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="empty" role="alert" style={{ paddingTop: 96 }}>
      <h2 className="empty-title">{t('startup.errorTitle')}</h2>
      <p className="empty-body">{t('startup.errorBody')}</p>
      {message && <p className="empty-body muted selectable">{message}</p>}
      <button
        type="button"
        className="btn btn-filled ripple"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          onRetry();
        }}
      >
        {t('common.retry')}
      </button>
    </div>
  );
}
