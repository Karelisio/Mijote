import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  BackupError,
  buildBackupZip,
  collectBackupData,
  openBackupZip,
  parseBackupData,
  readBackupZip,
  restoreBackupData,
} from '@/features/backup/backupData';
import { LATEST_VERSION } from '@/db/migrations';
import { seedSampleRecipes } from '@/db/seed';
import { listRecipeSummaries, searchRecipeIds } from '@/db/repos/recipes';
import { createCollection, setRecipeCollections } from '@/db/repos/collections';
import { addMeal } from '@/db/repos/planner';
import { upsertShoppingItems } from '@/db/repos/shopping';
import { mergeDrafts } from '@/features/shopping/merge';
import { memoryDb } from '../helpers/db';

async function populatedDb() {
  const db = await memoryDb();
  await seedSampleRecipes(db, 'fr');
  const [r] = await listRecipeSummaries(db);
  const cid = await createCollection(db, 'Du dimanche');
  await setRecipeCollections(db, r!.id, [cid]);
  await addMeal(db, { date: '2026-10-01', slot: 'dinner', recipeId: r!.id, text: '', servings: 2 });
  await addMeal(db, { date: '2026-10-02', slot: 'lunch', recipeId: null, text: 'Restes', servings: null });
  await upsertShoppingItems(db, mergeDrafts([{ name: 'citron', quantity: 2, unit: '' }]));
  return db;
}

describe('backup', () => {
  it('round-trips the whole database through a zip archive', async () => {
    const source = await populatedDb();
    const data = await collectBackupData(source, 1000);
    expect(data.recipes).toHaveLength(3);
    data.recipes[0]!.photo = 'images/abc-123.jpg';
    const zip = await buildBackupZip(data, new Map([['images/abc-123.jpg', btoa('fake-jpeg')]]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const { data: read, images } = await readBackupZip(await JSZip.loadAsync(bytes));
    expect(await images.get('images/abc-123.jpg')!()).toBe(btoa('fake-jpeg'));
    // JPEGs are stored as they are, not deflated again.
    expect(zip.file('images/abc-123.jpg')!.options.compression).toBe('STORE');

    const target = await memoryDb();
    await seedSampleRecipes(target, 'en'); // pre-existing data must be replaced
    await restoreBackupData(target, read);
    const after = await collectBackupData(target, 1000);
    expect(after.recipes.map((r) => r.title).sort()).toEqual(data.recipes.map((r) => r.title).sort());
    expect(after.collections[0]).toMatchObject({
      name: 'Du dimanche',
      recipeIds: data.collections[0]!.recipeIds,
    });
    expect(after.mealPlan).toHaveLength(2);
    expect(after.shopping[0]).toMatchObject({ name: 'citron', quantity: 2 });
    // full-text index is rebuilt
    expect(await searchRecipeIds(target, 'quiche')).toHaveLength(1);
    expect(await searchRecipeIds(target, 'crepes')).toHaveLength(1);
  });

  it('drops photos missing from the archive and rejects unsafe paths', async () => {
    const data = await collectBackupData(await populatedDb());
    data.recipes[0]!.photo = 'images/missing.jpg';
    data.recipes[1]!.photo = '../../etc/passwd';
    const zip = await buildBackupZip(data, new Map([['../../etc/passwd', btoa('x')]]));
    const { data: read, images } = await readBackupZip(zip);
    expect(images.size).toBe(0);
    expect(read.recipes[0]!.photo).toBeNull();
    expect(read.recipes[1]!.photo).toBeNull();
  });

  it('drops source links that are not http(s)', async () => {
    const data = await collectBackupData(await populatedDb());
    data.recipes[0]!.sourceUrl = 'javascript:alert(1)';
    data.recipes[1]!.sourceUrl = 'https://www.marmiton.org/x';
    const parsed = parseBackupData(JSON.parse(JSON.stringify(data)));
    expect(parsed.recipes[0]!.sourceUrl).toBeNull();
    expect(parsed.recipes[1]!.sourceUrl).toBe('https://www.marmiton.org/x');
  });

  it('validates foreign files', () => {
    expect(() => parseBackupData({ app: 'Other' })).toThrow();
    expect(() =>
      parseBackupData({
        app: 'Mijote',
        format: 99,
        recipes: [],
        collections: [],
        mealPlan: [],
        shopping: [],
      }),
    ).toThrow();
    expect(() =>
      parseBackupData({
        app: 'Mijote',
        format: 1,
        recipes: [{}],
        collections: [],
        mealPlan: [],
        shopping: [],
      }),
    ).toThrow();
  });
});

describe('backup errors', () => {
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return e instanceof BackupError ? e.code : `other: ${String(e)}`;
    }
    return 'no error';
  };
  const valid = { app: 'Mijote', format: 1, recipes: [], collections: [], mealPlan: [], shopping: [] };

  it('tells a damaged archive from a foreign or newer one', async () => {
    expect(await code(openBackupZip(new Uint8Array([1, 2, 3, 4])))).toBe('corrupted');
    const badJson = new JSZip();
    badJson.file('data.json', '{"app":"Mijote",');
    expect(await code(readBackupZip(badJson))).toBe('corrupted');
    expect(await code(readBackupZip(new JSZip()))).toBe('invalid');
    expect(await code(Promise.resolve().then(() => parseBackupData({ app: 'Other' })))).toBe('invalid');
    expect(await code(Promise.resolve().then(() => parseBackupData({ ...valid, format: 2 })))).toBe('newer');
    expect(
      await code(
        Promise.resolve().then(() => parseBackupData({ ...valid, schemaVersion: LATEST_VERSION + 1 })),
      ),
    ).toBe('newer');
    expect(parseBackupData({ ...valid, schemaVersion: LATEST_VERSION - 1 }).recipes).toEqual([]);
  });
});
