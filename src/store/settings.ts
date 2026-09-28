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
    },
  ),
);

/** Resolves once persisted settings have been loaded. */
export function settingsHydrated(): Promise<void> {
  if (useSettings.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useSettings.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}
