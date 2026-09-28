import type { Sql } from '../driver';
import type { Collection, Id } from '../types';
import { newId } from '@/lib/id';

export async function listCollections(db: Sql): Promise<Collection[]> {
  const rows = await db.query<{ id: string; name: string; icon: string; created_at: number; n: number }>(
    `SELECT c.id, c.name, c.icon, c.created_at, COUNT(cr.recipe_id) AS n
     FROM collections c LEFT JOIN collection_recipes cr ON cr.collection_id = c.id
     GROUP BY c.id ORDER BY c.position, c.created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    recipeCount: Number(r.n),
    createdAt: Number(r.created_at),
  }));
}

export async function createCollection(db: Sql, name: string, icon = 'bookmark'): Promise<Id> {
  const id = newId();
  await db.run(
    `INSERT INTO collections (id, name, icon, position, created_at)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM collections), ?)`,
    [id, name.trim(), icon, Date.now()],
  );
  return id;
}

export async function renameCollection(db: Sql, id: Id, name: string): Promise<void> {
  await db.run('UPDATE collections SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteCollection(db: Sql, id: Id): Promise<void> {
  await db.run('DELETE FROM collections WHERE id = ?', [id]);
}

export async function setRecipeCollections(db: Sql, recipeId: Id, collectionIds: Id[]): Promise<void> {
  await db.run('DELETE FROM collection_recipes WHERE recipe_id = ?', [recipeId]);
  for (const cid of collectionIds) {
    await db.run(
      'INSERT OR IGNORE INTO collection_recipes (collection_id, recipe_id, added_at) VALUES (?, ?, ?)',
      [cid, recipeId, Date.now()],
    );
  }
}

export async function collectionIdsForRecipe(db: Sql, recipeId: Id): Promise<Id[]> {
  const rows = await db.query<{ collection_id: string }>(
    'SELECT collection_id FROM collection_recipes WHERE recipe_id = ?',
    [recipeId],
  );
  return rows.map((r) => r.collection_id);
}

/** Map collectionId → recipe ids, for client-side filtering. */
export async function collectionMembership(db: Sql): Promise<Map<Id, Set<Id>>> {
  const rows = await db.query<{ collection_id: string; recipe_id: string }>(
    'SELECT collection_id, recipe_id FROM collection_recipes',
  );
  const m = new Map<Id, Set<Id>>();
  for (const r of rows) {
    const s = m.get(r.collection_id) ?? new Set<Id>();
    s.add(r.recipe_id);
    m.set(r.collection_id, s);
  }
  return m;
}
