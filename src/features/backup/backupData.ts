import JSZip from 'jszip';
import type { DbDriver, Sql } from '@/db/driver';
import type { MealPlanEntry, Recipe, ShoppingItem } from '@/db/types';
import { getRecipe, saveRecipeTx } from '@/db/repos/recipes';
import { listShopping } from '@/db/repos/shopping';
import { getUserVersion, LATEST_VERSION } from '@/db/migrations';
import { safeHttpUrl } from '@/lib/url';

export const BACKUP_FORMAT = 1;

/**
 * Why a backup cannot be restored: an unreadable (damaged) archive, a file that is not a Mijote
 * backup, a backup made by a newer version of Mijote, or no safety copy of the current data.
 */
export type BackupErrorCode = 'corrupted' | 'invalid' | 'newer' | 'safety_failed';

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    cause?: unknown,
  ) {
    super(`backup: ${code}`, { cause });
    this.name = 'BackupError';
  }
}

/** Opens a .zip archive (Blob, bytes or base64 text); a damaged one is a BackupError. */
export async function openBackupZip(data: Blob | Uint8Array | string, base64 = false): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(data, { base64 });
  } catch (e) {
    throw new BackupError('corrupted', e);
  }
}

export interface BackupCollection {
  id: string;
  name: string;
  icon: string;
  position: number;
  createdAt: number;
  recipeIds: string[];
}

export interface BackupData {
  app: 'Mijote';
  format: number;
  schemaVersion: number;
  exportedAt: number;
  recipes: Recipe[];
  collections: BackupCollection[];
  mealPlan: MealPlanEntry[];
  shopping: ShoppingItem[];
}

export async function collectBackupData(db: Sql, now = Date.now()): Promise<BackupData> {
  const ids = await db.query<{ id: string }>('SELECT id FROM recipes ORDER BY created_at');
  const recipes: Recipe[] = [];
  for (const { id } of ids) {
    const r = await getRecipe(db, id);
    if (r) recipes.push(r);
  }
  const cols = await db.query<{
    id: string;
    name: string;
    icon: string;
    position: number;
    created_at: number;
  }>('SELECT id, name, icon, position, created_at FROM collections ORDER BY position');
  const members = await db.query<{ collection_id: string; recipe_id: string }>(
    'SELECT collection_id, recipe_id FROM collection_recipes',
  );
  const meals = await db.query<{
    id: string;
    date: string;
    slot: string;
    recipe_id: string | null;
    text: string;
    servings: number | null;
  }>('SELECT id, date, slot, recipe_id, text, servings FROM meal_plan ORDER BY date');
  return {
    app: 'Mijote',
    format: BACKUP_FORMAT,
    schemaVersion: await getUserVersion(db),
    exportedAt: now,
    recipes,
    collections: cols.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      position: Number(c.position),
      createdAt: Number(c.created_at),
      recipeIds: members.filter((m) => m.collection_id === c.id).map((m) => m.recipe_id),
    })),
    mealPlan: meals.map((m) => ({
      id: m.id,
      date: m.date,
      slot: m.slot as MealPlanEntry['slot'],
      recipeId: m.recipe_id,
      text: m.text,
      servings: m.servings === null ? null : Number(m.servings),
    })),
    shopping: await listShopping(db),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Structural validation of an untrusted backup file. */
export function parseBackupData(raw: unknown): BackupData {
  if (!isObj(raw) || raw.app !== 'Mijote' || typeof raw.format !== 'number') {
    throw new BackupError('invalid');
  }
  // Written by a newer Mijote: its data may not fit this version's database.
  if (raw.format > BACKUP_FORMAT) throw new BackupError('newer');
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > LATEST_VERSION) {
    throw new BackupError('newer');
  }
  for (const key of ['recipes', 'collections', 'mealPlan', 'shopping'] as const) {
    if (!Array.isArray(raw[key])) throw new BackupError('invalid');
  }
  const recipes = raw.recipes as unknown[];
  for (const r of recipes) {
    if (
      !isObj(r) ||
      typeof r.id !== 'string' ||
      typeof r.title !== 'string' ||
      !Array.isArray(r.sections) ||
      !Array.isArray(r.steps)
    ) {
      throw new BackupError('invalid');
    }
  }
  const data = raw as unknown as BackupData;
  // Only http(s) sources: an archive must not bring a javascript: link into the app.
  for (const r of data.recipes) r.sourceUrl = safeHttpUrl(r.sourceUrl);
  return data;
}

/** Replaces the whole database content with the backup (single transaction). */
export function restoreBackupData(db: DbDriver, data: BackupData): Promise<void> {
  return db.transaction(async (tx) => {
    for (const table of [
      'collection_recipes',
      'collections',
      'meal_plan',
      'shopping_items',
      'recipes',
      'tags',
    ]) {
      await tx.run(`DELETE FROM ${table}`);
    }
    const fts = await tx.query<{ value: string }>("SELECT value FROM app_meta WHERE key = 'fts5'");
    if (fts[0]?.value === '1') await tx.run('DELETE FROM recipes_fts');

    for (const r of data.recipes) await saveRecipeTx(tx, r);
    const recipeIds = new Set(data.recipes.map((r) => r.id));
    for (const c of data.collections) {
      await tx.run('INSERT INTO collections (id, name, icon, position, created_at) VALUES (?, ?, ?, ?, ?)', [
        c.id,
        c.name,
        c.icon,
        c.position,
        c.createdAt,
      ]);
      for (const rid of c.recipeIds.filter((x) => recipeIds.has(x))) {
        await tx.run('INSERT INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, ?)', [
          c.id,
          rid,
          c.createdAt,
        ]);
      }
    }
    for (const [i, m] of data.mealPlan.entries()) {
      if (m.recipeId && !recipeIds.has(m.recipeId)) continue;
      await tx.run(
        'INSERT INTO meal_plan (id, date, slot, recipe_id, text, servings, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [m.id, m.date, m.slot, m.recipeId, m.text, m.servings, i],
      );
    }
    for (const s of data.shopping) {
      await tx.run(
        `INSERT INTO shopping_items (id, name, quantity, unit, aisle, note, checked, recipe_titles, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          s.quantity,
          s.unit,
          s.aisle,
          s.note,
          s.checked ? 1 : 0,
          JSON.stringify(s.recipeTitles),
          s.position,
          s.createdAt,
        ],
      );
    }
  });
}

/** images: relative path → base64 content */
export async function buildBackupZip(data: BackupData, images: Map<string, string>): Promise<JSZip> {
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data));
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        app: data.app,
        format: data.format,
        schemaVersion: data.schemaVersion,
        exportedAt: new Date(data.exportedAt).toISOString(),
        recipes: data.recipes.length,
        images: images.size,
      },
      null,
      2,
    ),
  );
  for (const [path, b64] of images) zip.file(path, b64, { base64: true });
  return zip;
}

export async function readBackupZip(zip: JSZip): Promise<{ data: BackupData; images: Map<string, string> }> {
  const file = zip.file('data.json');
  if (!file) throw new BackupError('invalid');
  let raw: unknown;
  try {
    raw = JSON.parse(await file.async('string'));
  } catch (e) {
    throw new BackupError('corrupted', e);
  }
  const data = parseBackupData(raw);
  const images = new Map<string, string>();
  const wanted = new Set(data.recipes.map((r) => r.photo).filter((p): p is string => !!p));
  for (const path of wanted) {
    // Only accept plain image paths inside images/ (no traversal).
    if (!/^images\/[\w-]+\.(jpe?g|png|webp)$/i.test(path)) continue;
    const f = zip.file(path);
    if (f) images.set(path, await f.async('base64'));
  }
  for (const r of data.recipes) if (r.photo && !images.has(r.photo)) r.photo = null;
  return { data, images };
}
