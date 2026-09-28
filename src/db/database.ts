import { Capacitor } from '@capacitor/core';
import { createDriver, type DbDriver } from './driver';
import { migrate } from './migrations';
import { getMeta, setMeta } from './meta';
import { seedSampleRecipes } from './seed';

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
    const { createSamplePhotos } = await import('./samplePhotos');
    await seedSampleRecipes(db, lang, await createSamplePhotos());
    await setMeta(db, 'seeded', String(Date.now()));
  }
  return db;
}

/** Opens (once), migrates and seeds the database. */
export function getDb(lang: 'fr' | 'en' = 'fr'): Promise<DbDriver> {
  instance ??= init(lang).catch((e: unknown) => {
    instance = null;
    throw e;
  });
  return instance;
}
