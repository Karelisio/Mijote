import { Capacitor } from '@capacitor/core';
import { createDriver, type DbDriver } from './driver';
import { migrate } from './migrations';
import { getMeta } from './meta';
import { seedOnFirstLaunch } from './seed';

let instance: Promise<DbDriver> | null = null;

async function open(): Promise<DbDriver> {
  if (Capacitor.isNativePlatform()) {
    const { openNativeDb } = await import('./drivers/native');
    return createDriver(await openNativeDb(), 'native');
  }
  const [{ openWasmDb }, persistence] = await Promise.all([
    import('./drivers/wasm'),
    import('./webPersistence'),
  ]);
  const bytes = await persistence.loadImage().catch(() => null);
  return createDriver(await openWasmDb({ bytes, persist: persistence.saveImageDebounced }), 'wasm');
}

async function init(lang: 'fr' | 'en'): Promise<DbDriver> {
  const db = await open();
  await migrate(db);
  if ((await getMeta(db, 'seeded')) === null) {
    // Not fatal: without samples the app still works, and the next launch tries again.
    try {
      const { createSamplePhotos } = await import('./samplePhotos');
      await seedOnFirstLaunch(db, lang, await createSamplePhotos());
    } catch (e) {
      console.error('sample recipes not added', e);
    }
  }
  return db;
}

/**
 * Opens (once), migrates and seeds the database. A failure is kept until `resetDb()`: startup
 * shows a blocking error screen instead of letting every screen retry the whole opening.
 */
export function getDb(lang: 'fr' | 'en' = 'fr'): Promise<DbDriver> {
  instance ??= init(lang);
  return instance;
}

/** Forgets a failed opening so that the next getDb() tries again ("Retry" at startup). */
export function resetDb(): void {
  instance = null;
}
