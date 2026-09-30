import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { App as CapApp } from '@capacitor/app';
import { MijoteNative, isNative } from '@/platform/native';
import { compareVersions, parseRelease, RELEASES_API, type ReleaseInfo } from './releases';

const LAST_CHECK_KEY = 'mijote.update.lastCheck';
const DISMISSED_KEY = 'mijote.update.dismissed';
const AUTO_CHECK_EVERY = 12 * 3600 * 1000;

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'error';

interface UpdateState {
  /** In-app updates exist only in the GitHub APK build on Android. */
  supported: boolean;
  /**
   * Installed version: the native versionName on the device (the JS build may carry another one,
   * e.g. 1.0.0 for a local build, which made every release look like an update).
   */
  installed: string;
  status: UpdateStatus;
  latest: ReleaseInfo | null;
  progress: number;
  error: string | null;
  /** Shows the update dialog. */
  prompt: boolean;
  needsPermission: boolean;
  init: () => Promise<void>;
  check: (opts?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  openPermissionSettings: () => void;
}

export const useUpdate = create<UpdateState>((set, get) => ({
  supported: false,
  installed: __APP_VERSION__,
  status: 'idle',
  latest: null,
  progress: 0,
  error: null,
  prompt: false,
  needsPermission: false,

  init: async () => {
    if (!isNative()) return;
    try {
      set({ installed: (await CapApp.getInfo()).version || __APP_VERSION__ });
    } catch {
      // keep the web build's version
    }
    try {
      const info = await MijoteNative.getBuildInfo();
      if (!info.updatesEnabled) return;
    } catch {
      return;
    }
    set({ supported: true });
    void MijoteNative.addListener('updateProgress', ({ percent }) => set({ progress: percent }));
    // Returning from the "Install unknown apps" screen: resume the pending install.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && get().needsPermission) {
        void MijoteNative.canInstallPackages().then(({ value }) => {
          if (value) {
            set({ needsPermission: false });
            void get().install();
          }
        });
      }
    });
    const last = Number((await Preferences.get({ key: LAST_CHECK_KEY })).value ?? 0);
    if (Date.now() - last > AUTO_CHECK_EVERY) await get().check({ silent: true });
  },

  check: async ({ silent = false } = {}) => {
    if (!get().supported || get().status === 'checking' || get().status === 'downloading') return;
    set({ status: 'checking', error: null });
    try {
      const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const latest = parseRelease(await res.json());
      await Preferences.set({ key: LAST_CHECK_KEY, value: String(Date.now()) });
      if (!latest || compareVersions(latest.version, get().installed) <= 0) {
        set({ status: 'upToDate', latest: null });
        return;
      }
      const dismissed = (await Preferences.get({ key: DISMISSED_KEY })).value;
      set({ status: 'available', latest, prompt: !silent || dismissed !== latest.tag });
    } catch (e) {
      set({ status: silent ? 'idle' : 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  install: async () => {
    const { latest } = get();
    if (!latest) return;
    if (!(await MijoteNative.canInstallPackages()).value) {
      set({ needsPermission: true, prompt: true });
      return;
    }
    if (get().status === 'downloading') return;
    set({ status: 'downloading', progress: 0, error: null, needsPermission: false });
    try {
      await MijoteNative.downloadAndInstallApk({ url: latest.apkUrl, sha256: latest.apkSha256 });
      // The system installer is now on screen; Android restarts the app after install.
      set({ status: 'available', prompt: false });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'busy') return; // the download already running goes on
      if (code === 'install_permission') set({ status: 'available', needsPermission: true, prompt: true });
      else set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  dismiss: () => {
    const tag = get().latest?.tag;
    if (tag) void Preferences.set({ key: DISMISSED_KEY, value: tag });
    set({ prompt: false, needsPermission: false });
  },

  openPermissionSettings: () => void MijoteNative.openInstallPermissionSettings(),
}));
