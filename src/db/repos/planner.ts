import type { Sql } from '../driver';
import type { Id, MealPlanEntry, MealSlot } from '../types';
import { newId } from '@/lib/id';

interface Row {
  id: string;
  date: string;
  slot: string;
  recipe_id: string | null;
  text: string;
  servings: number | null;
}

const map = (r: Row): MealPlanEntry => ({
  id: r.id,
  date: r.date,
  slot: r.slot as MealSlot,
  recipeId: r.recipe_id,
  text: r.text,
  servings: r.servings === null ? null : Number(r.servings),
});

/** Entries between two ISO dates, inclusive. */
export async function listMeals(db: Sql, from: string, to: string): Promise<MealPlanEntry[]> {
  const rows = await db.query<Row>(
    `SELECT id, date, slot, recipe_id, text, servings FROM meal_plan
     WHERE date >= ? AND date <= ? ORDER BY date, slot, position`,
    [from, to],
  );
  return rows.map(map);
}

export async function addMeal(db: Sql, entry: Omit<MealPlanEntry, 'id'>): Promise<Id> {
  const id = newId();
  await db.run(
    `INSERT INTO meal_plan (id, date, slot, recipe_id, text, servings, position)
     VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM meal_plan WHERE date = ? AND slot = ?))`,
    [id, entry.date, entry.slot, entry.recipeId, entry.text, entry.servings, entry.date, entry.slot],
  );
  return id;
}

export async function updateMeal(db: Sql, entry: MealPlanEntry): Promise<void> {
  await db.run(
    'UPDATE meal_plan SET date = ?, slot = ?, recipe_id = ?, text = ?, servings = ? WHERE id = ?',
    [entry.date, entry.slot, entry.recipeId, entry.text, entry.servings, entry.id],
  );
}

export async function removeMeal(db: Sql, id: Id): Promise<void> {
  await db.run('DELETE FROM meal_plan WHERE id = ?', [id]);
}

export async function restoreMeal(db: Sql, e: MealPlanEntry): Promise<void> {
  await db.run(
    'INSERT OR REPLACE INTO meal_plan (id, date, slot, recipe_id, text, servings, position) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [e.id, e.date, e.slot, e.recipeId, e.text, e.servings],
  );
}
