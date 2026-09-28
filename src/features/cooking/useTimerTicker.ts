import { useEffect, useState } from 'react';
import { chime, useTimers } from './timers';
import { snackbar } from '@/store/snackbar';
import { t } from '@/i18n';

/** Marks elapsed timers as done; chimes if the app is in the foreground. */
export function useTimerTicker(): void {
  useEffect(() => {
    const id = setInterval(() => {
      const { timers, markDone } = useTimers.getState();
      const now = Date.now();
      for (const x of timers) {
        if (!x.done && x.endAt && x.endAt <= now) {
          markDone(x.id);
          if (document.visibilityState === 'visible' && now - x.endAt < 5000) {
            chime();
            snackbar(t('cooking.timerDoneBody', { label: x.label }), { duration: 6000 });
          }
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, []);
}

/** Re-renders every `ms` while `active`. */
export function useNow(ms = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}
