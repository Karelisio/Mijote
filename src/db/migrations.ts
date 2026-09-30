import type { Sql } from './driver';
import { rebuildFtsIndex } from './repos/recipes';

export interface Migration {
  version: number;
  name: string;
  statements: string[];
  /**
   * Optional statements (e.g. FTS5, which a given SQLite build may lack).
   * A failure is recorded in app_meta instead of aborting the migration.
   */
  optional?: { flag: string; statements: string[] };
  /** Data step run after the statements, in the same transaction. */
  run?: (tx: Sql) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    statements: [
      `CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `CREATE TABLE recipes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        photo TEXT,
        servings INTEGER NOT NULL DEFAULT 4,
        prep_minutes INTEGER,
        cook_minutes INTEGER,
        difficulty TEXT,
        category TEXT NOT NULL DEFAULT 'main',
        source_url TEXT,
        notes TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        cooked_count INTEGER NOT NULL DEFAULT 0,
        last_cooked_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE ingredient_sections (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL
      )`,
      `CREATE TABLE ingredients (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        section_id TEXT REFERENCES ingredient_sections(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        quantity REAL,
        quantity_max REAL,
        unit TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE steps (
        id TEXT PRIMARY KEY,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        text TEXT NOT NULL
      )`,
      `CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE)`,
      `CREATE TABLE recipe_tags (
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (recipe_id, tag_id)
      )`,
      `CREATE TABLE collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'bookmark',
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE collection_recipes (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (collection_id, recipe_id)
      )`,
      `CREATE TABLE meal_plan (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
        text TEXT NOT NULL DEFAULT '',
        servings INTEGER,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE shopping_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        quantity REAL,
        unit TEXT NOT NULL DEFAULT '',
        aisle TEXT NOT NULL DEFAULT 'other',
        note TEXT NOT NULL DEFAULT '',
        checked INTEGER NOT NULL DEFAULT 0,
        recipe_titles TEXT NOT NULL DEFAULT '[]',
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX idx_ingredients_recipe ON ingredients(recipe_id, position)`,
      `CREATE INDEX idx_sections_recipe ON ingredient_sections(recipe_id, position)`,
      `CREATE INDEX idx_steps_recipe ON steps(recipe_id, position)`,
      `CREATE INDEX idx_meal_plan_date ON meal_plan(date)`,
      `CREATE INDEX idx_recipe_tags_tag ON recipe_tags(tag_id)`,
    ],
  },
  {
    version: 2,
    name: 'full_text_search',
    statements: [],
    optional: {
      flag: 'fts5',
      statements: [
        `CREATE VIRTUAL TABLE recipes_fts USING fts5(
          recipe_id UNINDEXED, title, ingredients, tags,
          tokenize = 'unicode61 remove_diacritics 2'
        )`,
      ],
    },
  },
  {
    // The index now stores normalized text ("œufs" → "oeufs"): re-index existing recipes.
    version: 3,
    name: 'fts_normalized_text',
    statements: [],
    run: rebuildFtsIndex,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((m, x) => Math.max(m, x.version), 0);

export async function getUserVersion(db: Sql): Promise<number> {
  const rows = await db.query<{ user_version: number }>('PRAGMA user_version');
  return Number(rows[0]?.user_version ?? 0);
}

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
}

/**
 * Applies pending migrations in order. Each migration runs in its own
 * transaction together with the user_version bump, so a failure leaves the
 * database at the previous consistent version.
 */
export async function migrate(
  db: { transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> } & Sql,
  migrations: Migration[] = MIGRATIONS,
): Promise<MigrationResult> {
  const from = await getUserVersion(db);
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const latest = sorted.at(-1)?.version ?? 0;
  if (from > latest) {
    throw new Error(`Database version ${from} is newer than this app supports (${latest})`);
  }
  const applied: number[] = [];
  for (const m of sorted) {
    if (m.version <= from) continue;
    await db.transaction(async (tx) => {
      for (const s of m.statements) await tx.execute(s);
      if (m.optional) {
        let ok = true;
        for (const s of m.optional.statements) {
          try {
            await tx.execute(s);
          } catch {
            ok = false;
            break;
          }
        }
        await tx.run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
          m.optional.flag,
          ok ? '1' : '0',
        ]);
      }
      if (m.run) await m.run(tx);
      await tx.execute(`PRAGMA user_version = ${m.version}`);
    });
    applied.push(m.version);
  }
  return { from, to: await getUserVersion(db), applied };
}
