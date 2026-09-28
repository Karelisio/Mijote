import type { Sql, DbDriver } from '../driver';
import type { Id, ShoppingItem } from '../types';

interface Row {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
  note: string;
  checked: number;
  recipe_titles: string;
  position: number;
  created_at: number;
}

function parseTitles(s: string): string[] {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const map = (r: Row): ShoppingItem => ({
  id: r.id,
  name: r.name,
  quantity: r.quantity === null ? null : Number(r.quantity),
  unit: r.unit,
  aisle: r.aisle,
  note: r.note,
  checked: Number(r.checked) === 1,
  recipeTitles: parseTitles(r.recipe_titles),
  position: Number(r.position),
  createdAt: Number(r.created_at),
});

export async function listShopping(db: Sql): Promise<ShoppingItem[]> {
  const rows = await db.query<Row>('SELECT * FROM shopping_items ORDER BY position, created_at');
  return rows.map(map);
}

async function upsertTx(tx: Sql, i: ShoppingItem): Promise<void> {
  await tx.run(
    `INSERT OR REPLACE INTO shopping_items
       (id, name, quantity, unit, aisle, note, checked, recipe_titles, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      i.id,
      i.name,
      i.quantity,
      i.unit,
      i.aisle,
      i.note,
      i.checked ? 1 : 0,
      JSON.stringify(i.recipeTitles),
      i.position,
      i.createdAt,
    ],
  );
}

/** Replaces the whole list in one transaction (used after merges). */
export function replaceShopping(db: DbDriver, items: ShoppingItem[]): Promise<void> {
  return db.transaction(async (tx) => {
    await tx.run('DELETE FROM shopping_items');
    for (const i of items) await upsertTx(tx, i);
  });
}

export function upsertShoppingItems(db: DbDriver, items: ShoppingItem[]): Promise<void> {
  return db.transaction(async (tx) => {
    for (const i of items) await upsertTx(tx, i);
  });
}

export async function setChecked(db: Sql, id: Id, checked: boolean): Promise<void> {
  await db.run('UPDATE shopping_items SET checked = ? WHERE id = ?', [checked ? 1 : 0, id]);
}

export async function deleteShoppingItems(db: Sql, ids: Id[]): Promise<void> {
  if (!ids.length) return;
  await db.run(`DELETE FROM shopping_items WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
}
