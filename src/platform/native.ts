import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface SharedContent {
  text?: string;
  subject?: string;
}

/** Custom Android plugin (android/app/src/main/java/.../MijoteNativePlugin.java). */
interface MijoteNativePlugin {
  /** Android 12+: wallpaper-derived accent used as the Material You seed. */
  getDynamicSeed(): Promise<{ available: boolean; seed?: string }>;
  /** Text shared to the app (ACTION_SEND) that has not been consumed yet. */
  consumePendingShare(): Promise<SharedContent>;
  addListener(event: 'shareReceived', cb: (d: SharedContent) => void): Promise<PluginListenerHandle>;
}

export const MijoteNative = registerPlugin<MijoteNativePlugin>('MijoteNative');

export const isNative = (): boolean => Capacitor.isNativePlatform();

export async function getDynamicSeed(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const r = await MijoteNative.getDynamicSeed();
    return r.available && r.seed ? r.seed : null;
  } catch {
    return null;
  }
}
