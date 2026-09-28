import { useEffect, useState } from 'react';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useSettings } from '@/store/settings';
import { getDynamicSeed, isNative } from '@/platform/native';
import { applyPalette, paletteFromSeed } from './palette';

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

/** Applies the Material 3 palette (dynamic or seed) and system bar styles. */
export function useThemeController(): { dynamicAvailable: boolean } {
  const theme = useSettings((s) => s.theme);
  const dynamicColor = useSettings((s) => s.dynamicColor);
  const seedColor = useSettings((s) => s.seedColor);
  const systemDark = useSystemDark();
  const [dynamicSeed, setDynamicSeed] = useState<string | null>(null);

  useEffect(() => {
    void getDynamicSeed().then(setDynamicSeed);
    // The wallpaper may change while the app is in background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void getDynamicSeed().then(setDynamicSeed);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  const seed = dynamicColor && dynamicSeed ? dynamicSeed : seedColor;

  useEffect(() => {
    applyPalette(paletteFromSeed(seed, dark), dark);
    if (isNative()) {
      void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
        () => undefined,
      );
    }
  }, [seed, dark]);

  return { dynamicAvailable: dynamicSeed !== null };
}
