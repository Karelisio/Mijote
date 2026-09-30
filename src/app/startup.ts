import { settingsHydrated } from '@/store/settings';
import { currentLang } from '@/i18n';
import { getDb } from '@/db/database';
import { listPhotoPaths } from '@/db/repos/recipes';
import { refreshRecipes } from '@/store/recipes';
import { collectOrphanImages } from '@/platform/images';
import { applyPalette, DEFAULT_SEED, paletteFromSeed } from '@/theme/palette';
import { useSettings } from '@/store/settings';

/** Everything that must be ready before the first render. Rejects when the database cannot open. */
export async function startup(): Promise<void> {
  await settingsHydrated();
  // Paint the right palette immediately to avoid a flash before React mounts.
  const s = useSettings.getState();
  const dark =
    s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  try {
    applyPalette(paletteFromSeed(s.seedColor, dark), dark);
  } catch {
    applyPalette(paletteFromSeed(DEFAULT_SEED, dark), dark);
  }
  document.documentElement.lang = currentLang();

  const db = await getDb(currentLang());
  await refreshRecipes();

  // Housekeeping, off the critical path.
  setTimeout(() => {
    void (async () => {
      const { runAutoBackup } = await import('@/features/backup/backup');
      await runAutoBackup().catch(() => undefined);
      await collectOrphanImages(await listPhotoPaths(db)).catch(() => undefined);
    })();
  }, 4000);
}
