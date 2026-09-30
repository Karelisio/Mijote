import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@/app/App';
import { startup } from '@/app/startup';
import { StartupError } from '@/app/StartupError';
import { resetDb } from '@/db/database';
import { installRipple } from '@/ui/ripple';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import '@/theme/global.css';
import '@/ui/ui.css';
import '@/features/features.css';

installRipple();

const root = createRoot(document.getElementById('root')!);

// The splash stays up (launchAutoHide: false) until the first real screen is painted.
const hideSplash = () =>
  requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined));

function boot(): void {
  void startup()
    .then(
      () =>
        root.render(
          <StrictMode>
            <ErrorBoundary>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <App />
              </BrowserRouter>
            </ErrorBoundary>
          </StrictMode>,
        ),
      (e: unknown) => {
        console.error('startup failed', e);
        root.render(
          <StartupError
            error={e}
            onRetry={() => {
              resetDb();
              boot();
            }}
          />,
        );
      },
    )
    .finally(hideSplash);
}

boot();
