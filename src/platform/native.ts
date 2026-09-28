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
  /** Build flavor ("github" | "play") and whether in-app updates are allowed. */
  getBuildInfo(): Promise<{
    flavor: string;
    versionName: string;
    versionCode: number;
    updatesEnabled: boolean;
  }>;
  canInstallPackages(): Promise<{ value: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  /** Rejects with code "install_permission" when "Install unknown apps" is not allowed. */
  downloadAndInstallApk(options: { url: string }): Promise<void>;
  addListener(event: 'updateProgress', cb: (d: { percent: number }) => void): Promise<PluginListenerHandle>;
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
