import { describe, expect, it } from 'vitest';
import { getUserVersion, LATEST_VERSION, migrate, MIGRATIONS, type Migration } from '@/db/migrations';
import { getMeta } from '@/db/meta';
import { memoryDb } from '../helpers/db';

describe('migrations', () => {
  it('migrates an empty database to the latest version', async () => {
    const db = await memoryDb({ migrated: false });
    expect(await getUserVersion(db)).toBe(0);
    const res = await migrate(db);
    expect(res.from).toBe(0);
    expect(res.to).toBe(LATEST_VERSION);
    expect(res.applied).toEqual(MIGRATIONS.map((m) => m.version));
    const tables = await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const names = tables.map((t) => t.name);
    for (const t of [
      'recipes',
      'ingredients',
      'ingredient_sections',
      'steps',
      'tags',
      'meal_plan',
      'shopping_items',
    ]) {
      expect(names).toContain(t);
    }
    expect(await getMeta(db, 'fts5')).toBe('1');
  });

  it('is idempotent', async () => {
    const db = await memoryDb();
    const res = await migrate(db);
    expect(res.applied).toEqual([]);
    expect(res.to).toBe(LATEST_VERSION);
  });

  it('applies only pending migrations and keeps data', async () => {
    const db = await memoryDb({ migrated: false });
    await migrate(db, MIGRATIONS.slice(0, 1));
    expect(await getUserVersion(db)).toBe(1);
    await db.run("INSERT INTO recipes (id, title, created_at, updated_at) VALUES ('r1', 'Soupe', 1, 1)");
    const extra: Migration = {
      version: LATEST_VERSION + 1,
      name: 'test_add_column',
      statements: ["ALTER TABLE recipes ADD COLUMN season TEXT NOT NULL DEFAULT ''"],
    };
    const res = await migrate(db, [...MIGRATIONS, extra]);
    expect(res.applied).toEqual([...MIGRATIONS.slice(1).map((m) => m.version), extra.version]);
    const rows = await db.query<{ title: string; season: string }>('SELECT title, season FROM recipes');
    expect(rows).toEqual([{ title: 'Soupe', season: '' }]);
  });

  it('rolls back a failing migration atomically', async () => {
    const db = await memoryDb();
    const bad: Migration = {
      version: LATEST_VERSION + 1,
      name: 'bad',
      statements: ['CREATE TABLE should_not_exist (id TEXT)', 'THIS IS NOT SQL'],
    };
    await expect(migrate(db, [...MIGRATIONS, bad])).rejects.toThrow();
    expect(await getUserVersion(db)).toBe(LATEST_VERSION);
    const t = await db.query("SELECT name FROM sqlite_master WHERE name = 'should_not_exist'");
    expect(t).toHaveLength(0);
  });

  it('records a missing optional feature instead of failing', async () => {
    const db = await memoryDb({ migrated: false });
    const m: Migration[] = [
      MIGRATIONS[0]!,
      {
        version: 2,
        name: 'opt',
        statements: [],
        optional: { flag: 'fake', statements: ['CREATE VIRTUAL TABLE x USING nope(a)'] },
      },
    ];
    await migrate(db, m);
    expect(await getMeta(db, 'fake')).toBe('0');
    expect(await getUserVersion(db)).toBe(2);
  });

  it('refuses a database newer than the app', async () => {
    const db = await memoryDb();
    await db.execute(`PRAGMA user_version = ${LATEST_VERSION + 5}`);
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
});
