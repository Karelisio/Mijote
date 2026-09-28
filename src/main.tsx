import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@/app/App';
import { startup } from '@/app/startup';
import { installRipple } from '@/ui/ripple';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import '@/theme/global.css';
import '@/ui/ui.css';
import '@/features/features.css';

installRipple();

const root = createRoot(document.getElementById('root')!);

void startup()
  .catch((e: unknown) => console.error('startup failed', e))
  .finally(() => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    );
    requestAnimationFrame(() => void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined));
  });
