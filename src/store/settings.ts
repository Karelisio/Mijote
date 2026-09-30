import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { DEFAULT_SEED } from '@/theme/palette';

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguagePref = 'system' | 'fr' | 'en';

export interface SettingsState {
  theme: ThemeMode;
  dynamicColor: boolean;
  seedColor: string;
  language: LanguagePref;
  recipeView: 'grid' | 'list';
  magoListName: string;
  keepScreenOn: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

let markHydrated: () => void = () => undefined;
const hydrated = new Promise<void>((resolve) => {
  markHydrated = resolve;
});

const preferencesStorage: StateStorage = {
  getItem: async (name) => (await Preferences.get({ key: name })).value,
  setItem: (name, value) => Preferences.set({ key: name, value }),
  removeItem: (name) => Preferences.remove({ key: name }),
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      dynamicColor: true,
      seedColor: DEFAULT_SEED,
      language: 'system',
      recipeView: 'grid',
      magoListName: '',
      keepScreenOn: true,
      set: (patch) => set(patch),
    }),
    {
      name: 'mijote.settings',
      version: 1,
      storage: createJSONStorage(() => preferencesStorage),
      partialize: ({ set: _set, ...rest }) => rest,
      // Called after loading, successfully or not: zustand never calls onFinishHydration when
      // reading or parsing the stored value fails, which used to leave the app on its splash.
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('settings: stored value unreadable, using defaults', error);
        markHydrated();
      },
    },
  ),
);

/**
 * Resolves once persisted settings have been loaded — or could not be (defaults are kept) — and
 * at the latest after `timeoutMs`, so a storage that never answers cannot block the startup.
 */
export function settingsHydrated(timeoutMs = 3000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([hydrated, timeout]).finally(() => clearTimeout(timer));
}
