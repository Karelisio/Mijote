import { describe, expect, it } from 'vitest';
import {
  deleteRecipe,
  getRecipe,
  listAllTags,
  listRecipeSummaries,
  markCooked,
  saveRecipe,
  searchRecipeIds,
} from '@/db/repos/recipes';
import { sampleRecipes, seedOnFirstLaunch, seedSampleRecipes } from '@/db/seed';
import { getMeta } from '@/db/meta';
import { memoryDb } from '../helpers/db';

describe('recipes repository', () => {
  it('round-trips a full recipe with sections', async () => {
    const db = await memoryDb();
    const [, quiche] = sampleRecipes('fr');
    await saveRecipe(db, quiche!);
    const loaded = await getRecipe(db, quiche!.id);
    expect(loaded?.title).toBe('Quiche lorraine');
    expect(loaded?.sections.map((s) => s.name)).toEqual(['Pâte brisée', 'Garniture']);
    expect(loaded?.sections[1]?.items[0]).toMatchObject({ quantity: 200, unit: 'g', name: 'lardons fumés' });
    expect(loaded?.steps).toHaveLength(5);
    expect(loaded?.tags.sort()).toEqual(['classique', 'four']);
  });

  it('updates children on re-save and cleans orphan tags', async () => {
    const db = await memoryDb();
    const [crepes] = sampleRecipes('fr');
    await saveRecipe(db, crepes!);
    await saveRecipe(db, { ...crepes!, tags: ['dessert'], steps: crepes!.steps.slice(0, 1) });
    const loaded = await getRecipe(db, crepes!.id);
    expect(loaded?.steps).toHaveLength(1);
    expect(await listAllTags(db)).toEqual(['dessert']);
  });

  it('searches titles, ingredients and tags ignoring accents', async () => {
    const db = await memoryDb();
    await seedSampleRecipes(db, 'fr');
    const all = await listRecipeSummaries(db);
    const idOf = (t: string) => all.find((r) => r.title.startsWith(t))!.id;
    expect(await searchRecipeIds(db, 'crepe')).toEqual([idOf('Crêpes')]);
    expect(await searchRecipeIds(db, 'coco')).toEqual([idOf('Curry')]);
    expect(await searchRecipeIds(db, 'lard')).toEqual([idOf('Quiche')]);
    expect(await searchRecipeIds(db, 'epice')).toEqual([idOf('Curry')]);
    expect((await searchRecipeIds(db, 'farine')).sort()).toEqual([idOf('Crêpes'), idOf('Quiche')].sort());
    expect(await searchRecipeIds(db, 'farine lardons')).toEqual([idOf('Quiche')]);
  });

  it('matches ligatures both ways ("œufs" / "oeufs", "bœuf" / "boeuf")', async () => {
    const db = await memoryDb();
    const [crepes, quiche] = sampleRecipes('fr');
    await saveRecipe(db, { ...crepes!, title: 'Bœuf bourguignon', tags: ['Cœur de bœuf'] });
    await saveRecipe(db, quiche!); // "œufs" in its ingredients
    const [beef, qid] = [crepes!.id, quiche!.id];
    expect(await searchRecipeIds(db, 'boeuf')).toEqual([beef]);
    expect(await searchRecipeIds(db, 'bœuf')).toEqual([beef]);
    expect(await searchRecipeIds(db, 'BŒUF bourgui')).toEqual([beef]);
    expect(await searchRecipeIds(db, 'coeur')).toEqual([beef]);
    expect((await searchRecipeIds(db, 'œufs')).sort()).toEqual([beef, qid].sort());
    expect((await searchRecipeIds(db, 'oeuf')).sort()).toEqual([beef, qid].sort());
  });

  it('deletes a recipe and its index entry', async () => {
    const db = await memoryDb();
    await seedSampleRecipes(db, 'fr');
    const [first] = await listRecipeSummaries(db);
    await deleteRecipe(db, first!.id);
    expect(await getRecipe(db, first!.id)).toBeNull();
    expect(await listRecipeSummaries(db)).toHaveLength(2);
    const ids = await searchRecipeIds(db, first!.title.split(' ')[0]!);
    expect(ids).not.toContain(first!.id);
  });

  it('counts cooked times', async () => {
    const db = await memoryDb();
    const [r] = sampleRecipes('en');
    await saveRecipe(db, r!);
    await markCooked(db, r!.id, 42);
    await markCooked(db, r!.id, 43);
    const loaded = await getRecipe(db, r!.id);
    expect(loaded?.cookedCount).toBe(2);
    expect(loaded?.lastCookedAt).toBe(43);
  });

  it('seeds the samples once, together with the "seeded" flag', async () => {
    const db = await memoryDb();
    expect(await seedOnFirstLaunch(db, 'fr')).toBe(true);
    expect(await seedOnFirstLaunch(db, 'fr')).toBe(false);
    expect(await listRecipeSummaries(db)).toHaveLength(3);
    expect(await getMeta(db, 'seeded')).not.toBeNull();
  });

  it('leaves neither samples nor flag when seeding fails', async () => {
    const db = await memoryDb();
    await db.execute('DROP TABLE steps'); // the third write of every recipe now fails
    await expect(seedOnFirstLaunch(db, 'fr')).rejects.toThrow();
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes');
    expect(Number(rows[0]!.n)).toBe(0);
    expect(await getMeta(db, 'seeded')).toBeNull();
  });
});
