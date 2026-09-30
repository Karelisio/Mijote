import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from '@/platform/native';

/** Whether timers can ring at the exact second (Android 12+ "Alarms & reminders" access). */
export async function canScheduleExactAlarms(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return false;
  }
}

/**
 * Exact-alarm access for the "Allow" prompts: re-checked when the app comes back to the
 * foreground (the user may have changed it in the system settings) and after the system screen
 * opened by `ask()` closes, so the prompt disappears once access is granted.
 * `onGranted` runs when access goes from denied to granted.
 */
export function useExactAlarmAccess(onGranted?: () => void): { denied: boolean; ask: () => void } {
  const [denied, setDenied] = useState(false);
  const deniedRef = useRef(false);
  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  });

  const update = useCallback((granted: boolean) => {
    if (granted && deniedRef.current) onGrantedRef.current?.();
    deniedRef.current = !granted;
    setDenied(!granted);
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    let alive = true;
    const check = () =>
      void LocalNotifications.checkExactNotificationSetting()
        .then((r) => alive && update(r.exact_alarm === 'granted'))
        .catch(() => undefined);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [update]);

  const ask = useCallback(() => {
    // Resolves with the new state when the user comes back from the system screen.
    void LocalNotifications.changeExactNotificationSetting()
      .then((r) => update(r.exact_alarm === 'granted'))
      .catch(() => undefined);
  }, [update]);

  return { denied, ask };
}
