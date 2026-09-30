import type { Sql, DbDriver } from '../driver';
import type { Category, Difficulty, Id, Recipe, RecipeSummary } from '../types';
import { normalizeText } from '@/config/units';

interface RecipeRow {
  id: string;
  title: string;
  photo: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: string | null;
  category: string;
  source_url: string | null;
  notes: string;
  rating: number;
  favorite: number;
  cooked_count: number;
  last_cooked_at: number | null;
  created_at: number;
  updated_at: number;
}

const toBase = (r: RecipeRow): Omit<Recipe, 'sections' | 'steps' | 'tags'> => ({
  id: r.id,
  title: r.title,
  photo: r.photo,
  servings: Number(r.servings),
  prepMinutes: r.prep_minutes === null ? null : Number(r.prep_minutes),
  cookMinutes: r.cook_minutes === null ? null : Number(r.cook_minutes),
  difficulty: (r.difficulty as Difficulty | null) ?? null,
  category: r.category as Category,
  sourceUrl: r.source_url,
  notes: r.notes,
  rating: Number(r.rating),
  favorite: Number(r.favorite) === 1,
  cookedCount: Number(r.cooked_count),
  lastCookedAt: r.last_cooked_at === null ? null : Number(r.last_cooked_at),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

async function hasFts(db: Sql): Promise<boolean> {
  const rows = await db.query<{ value: string }>("SELECT value FROM app_meta WHERE key = 'fts5'");
  return rows[0]?.value === '1';
}

export async function listRecipeSummaries(db: Sql): Promise<RecipeSummary[]> {
  const [rows, tagRows, ingRows] = await Promise.all([
    db.query<Omit<RecipeRow, 'notes'>>(
      `SELECT id, title, photo, servings, prep_minutes, cook_minutes, difficulty, category, source_url,
              rating, favorite, cooked_count, last_cooked_at, created_at, updated_at
       FROM recipes ORDER BY updated_at DESC`,
    ),
    db.query<{ recipe_id: string; name: string }>(
      'SELECT rt.recipe_id, t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id ORDER BY t.name',
    ),
    db.query<{ recipe_id: string; name: string }>('SELECT recipe_id, name FROM ingredients'),
  ]);
  const tags = new Map<string, string[]>();
  for (const t of tagRows) tags.set(t.recipe_id, [...(tags.get(t.recipe_id) ?? []), t.name]);
  const ings = new Map<string, string[]>();
  for (const i of ingRows) ings.set(i.recipe_id, [...(ings.get(i.recipe_id) ?? []), normalizeText(i.name)]);
  return rows.map((r) => ({
    ...toBase({ ...r, notes: '' }),
    tags: tags.get(r.id) ?? [],
    ingredientNames: ings.get(r.id) ?? [],
  }));
}

export async function getRecipe(db: Sql, id: Id): Promise<Recipe | null> {
  const [row] = await db.query<RecipeRow>('SELECT * FROM recipes WHERE id = ?', [id]);
  if (!row) return null;
  const [sections, ingredients, steps, tags] = await Promise.all([
    db.query<{ id: string; name: string }>(
      'SELECT id, name FROM ingredient_sections WHERE recipe_id = ? ORDER BY position',
      [id],
    ),
    db.query<{
      id: string;
      section_id: string | null;
      quantity: number | null;
      quantity_max: number | null;
      unit: string;
      name: string;
      note: string;
    }>(
      `SELECT id, section_id, quantity, quantity_max, unit, name, note
       FROM ingredients WHERE recipe_id = ? ORDER BY position`,
      [id],
    ),
    db.query<{ id: string; text: string }>(
      'SELECT id, text FROM steps WHERE recipe_id = ? ORDER BY position',
      [id],
    ),
    db.query<{ name: string }>(
      'SELECT t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.recipe_id = ? ORDER BY t.name',
      [id],
    ),
  ]);
  const secs = sections.map((s) => ({
    id: s.id,
    name: s.name,
    items: [] as Recipe['sections'][number]['items'],
  }));
  if (secs.length === 0) secs.push({ id: `${id}-default`, name: '', items: [] });
  const byId = new Map(secs.map((s) => [s.id, s]));
  for (const i of ingredients) {
    const target = (i.section_id && byId.get(i.section_id)) || secs[0]!;
    target.items.push({
      id: i.id,
      quantity: i.quantity === null ? null : Number(i.quantity),
      quantityMax: i.quantity_max === null ? null : Number(i.quantity_max),
      unit: i.unit,
      name: i.name,
      note: i.note,
    });
  }
  return {
    ...toBase(row),
    tags: tags.map((t) => t.name),
    sections: secs,
    steps: steps.map((s) => ({ id: s.id, text: s.text })),
  };
}

/**
 * The index stores normalizeText() output, like the queries built by buildFtsQuery: the
 * unicode61 tokenizer removes accents but does not decompose ligatures, so raw "œufs" or
 * "bœuf" would never match "oeufs" / "boeuf".
 */
async function insertFtsRow(
  tx: Sql,
  id: Id,
  title: string,
  ingredients: string[],
  tags: string[],
): Promise<void> {
  await tx.run('INSERT INTO recipes_fts (recipe_id, title, ingredients, tags) VALUES (?, ?, ?, ?)', [
    id,
    normalizeText(title),
    ingredients.map(normalizeText).join(' \n '),
    normalizeText(tags.join(' ')),
  ]);
}

async function writeFts(tx: Sql, r: Recipe): Promise<void> {
  if (!(await hasFts(tx))) return;
  await tx.run('DELETE FROM recipes_fts WHERE recipe_id = ?', [r.id]);
  await insertFtsRow(
    tx,
    r.id,
    r.title,
    r.sections.flatMap((s) => s.items.map((i) => i.name)),
    r.tags,
  );
}

/** Re-indexes every recipe (after a change of what the index stores). */
export async function rebuildFtsIndex(tx: Sql): Promise<void> {
  if (!(await hasFts(tx))) return;
  const recipes = await tx.query<{ id: string; title: string }>('SELECT id, title FROM recipes');
  const ingredients = await tx.query<{ recipe_id: string; name: string }>(
    'SELECT recipe_id, name FROM ingredients ORDER BY recipe_id, position',
  );
  const tags = await tx.query<{ recipe_id: string; name: string }>(
    'SELECT rt.recipe_id, t.name FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id',
  );
  const group = (rows: { recipe_id: string; name: string }[]) => {
    const m = new Map<string, string[]>();
    for (const r of rows) m.set(r.recipe_id, [...(m.get(r.recipe_id) ?? []), r.name]);
    return m;
  };
  const ingsBy = group(ingredients);
  const tagsBy = group(tags);
  await tx.run('DELETE FROM recipes_fts');
  for (const r of recipes) {
    await insertFtsRow(tx, r.id, r.title, ingsBy.get(r.id) ?? [], tagsBy.get(r.id) ?? []);
  }
}

/** Inserts or fully replaces a recipe and its children. */
export async function saveRecipeTx(tx: Sql, r: Recipe): Promise<void> {
  await tx.run(
    `INSERT INTO recipes (id, title, photo, servings, prep_minutes, cook_minutes, difficulty, category, source_url,
       notes, rating, favorite, cooked_count, last_cooked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, photo = excluded.photo, servings = excluded.servings,
       prep_minutes = excluded.prep_minutes, cook_minutes = excluded.cook_minutes, difficulty = excluded.difficulty,
       category = excluded.category, source_url = excluded.source_url, notes = excluded.notes,
       rating = excluded.rating, favorite = excluded.favorite, cooked_count = excluded.cooked_count,
       last_cooked_at = excluded.last_cooked_at, updated_at = excluded.updated_at`,
    [
      r.id,
      r.title.trim(),
      r.photo,
      r.servings,
      r.prepMinutes,
      r.cookMinutes,
      r.difficulty,
      r.category,
      r.sourceUrl,
      r.notes,
      r.rating,
      r.favorite ? 1 : 0,
      r.cookedCount,
      r.lastCookedAt,
      r.createdAt,
      r.updatedAt,
    ],
  );
  await tx.run('DELETE FROM ingredients WHERE recipe_id = ?', [r.id]);
  await tx.run('DELETE FROM ingredient_sections WHERE recipe_id = ?', [r.id]);
  await tx.run('DELETE FROM steps WHERE recipe_id = ?', [r.id]);
  await tx.run('DELETE FROM recipe_tags WHERE recipe_id = ?', [r.id]);

  let pos = 0;
  for (const [si, s] of r.sections.entries()) {
    await tx.run('INSERT INTO ingredient_sections (id, recipe_id, name, position) VALUES (?, ?, ?, ?)', [
      s.id,
      r.id,
      s.name.trim(),
      si,
    ]);
    for (const i of s.items) {
      if (!i.name.trim()) continue;
      await tx.run(
        `INSERT INTO ingredients (id, recipe_id, section_id, position, quantity, quantity_max, unit, name, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [i.id, r.id, s.id, pos++, i.quantity, i.quantityMax, i.unit, i.name.trim(), i.note.trim()],
      );
    }
  }
  for (const [pi, st] of r.steps.filter((s) => s.text.trim()).entries()) {
    await tx.run('INSERT INTO steps (id, recipe_id, position, text) VALUES (?, ?, ?, ?)', [
      st.id,
      r.id,
      pi,
      st.text.trim(),
    ]);
  }
  const tags = [...new Set(r.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  for (const t of tags) {
    await tx.run('INSERT OR IGNORE INTO tags (name) VALUES (?)', [t]);
    await tx.run(
      'INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) SELECT ?, id FROM tags WHERE name = ?',
      [r.id, t],
    );
  }
  await tx.run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM recipe_tags)');
  await writeFts(tx, { ...r, tags });
}

export function saveRecipe(db: DbDriver, r: Recipe): Promise<void> {
  return db.transaction((tx) => saveRecipeTx(tx, r));
}

export function deleteRecipe(db: DbDriver, id: Id): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.run('DELETE FROM recipes WHERE id = ?', [id]);
    await tx.run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM recipe_tags)');
    if (await hasFts(tx)) await tx.run('DELETE FROM recipes_fts WHERE recipe_id = ?', [id]);
  });
}

export async function patchRecipe(
  db: Sql,
  id: Id,
  patch: Partial<Pick<Recipe, 'favorite' | 'rating' | 'photo'>>,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.favorite !== undefined) {
    sets.push('favorite = ?');
    values.push(patch.favorite ? 1 : 0);
  }
  if (patch.rating !== undefined) {
    sets.push('rating = ?');
    values.push(patch.rating);
  }
  if (patch.photo !== undefined) {
    sets.push('photo = ?');
    values.push(patch.photo);
  }
  if (!sets.length) return;
  await db.run(`UPDATE recipes SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function markCooked(db: Sql, id: Id, at = Date.now()): Promise<void> {
  await db.run('UPDATE recipes SET cooked_count = cooked_count + 1, last_cooked_at = ? WHERE id = ?', [
    at,
    id,
  ]);
}

/** Builds an FTS5 prefix query from free text: `"pou"* AND "coco"*`. */
export function buildFtsQuery(input: string): string | null {
  const tokens = normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

/** Returns matching recipe ids, best match first. */
export async function searchRecipeIds(db: Sql, input: string): Promise<Id[]> {
  const q = buildFtsQuery(input);
  if (!q) return [];
  if (await hasFts(db)) {
    const rows = await db.query<{ recipe_id: string }>(
      `SELECT recipe_id FROM recipes_fts WHERE recipes_fts MATCH ?
       ORDER BY bm25(recipes_fts, 0, 10.0, 3.0, 5.0)`,
      [q],
    );
    return rows.map((r) => r.recipe_id);
  }
  // Fallback without FTS5: accent-sensitive LIKE on every token.
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const where = tokens
    .map(
      () =>
        `(r.title LIKE ? OR EXISTS (SELECT 1 FROM ingredients i WHERE i.recipe_id = r.id AND i.name LIKE ?)
          OR EXISTS (SELECT 1 FROM recipe_tags rt JOIN tags t ON t.id = rt.tag_id WHERE rt.recipe_id = r.id AND t.name LIKE ?))`,
    )
    .join(' AND ');
  const params = tokens.flatMap((t) => [`%${t}%`, `%${t}%`, `%${t}%`]);
  const rows = await db.query<{ id: string }>(`SELECT r.id FROM recipes r WHERE ${where}`, params);
  return rows.map((r) => r.id);
}

export async function listPhotoPaths(db: Sql): Promise<string[]> {
  const rows = await db.query<{ photo: string }>('SELECT photo FROM recipes WHERE photo IS NOT NULL');
  return rows.map((r) => r.photo);
}
