import type { Sql } from './driver';

export async function getMeta(db: Sql, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: Sql, key: string, value: string): Promise<void> {
  await db.run('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
}
