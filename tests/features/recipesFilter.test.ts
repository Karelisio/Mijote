import { describe, expect, it } from 'vitest';
import type { RecipeSummary } from '@/db/types';
import { activeFilterCount, filterRecipes, pickRandom } from '@/features/recipes/filter';
import { frequentIngredients, matchRecipes } from '@/features/recipes/cookWith';
import { EMPTY_FILTERS } from '@/features/recipes/filter';

const base: Omit<RecipeSummary, 'id' | 'title' | 'ingredientNames'> = {
  photo: null,
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  difficulty: 'easy',
  category: 'main',
  tags: [],
  sourceUrl: null,
  rating: 0,
  favorite: false,
  cookedCount: 0,
  lastCookedAt: null,
  createdAt: 0,
  updatedAt: 0,
};

const R = (id: string, extra: Partial<RecipeSummary>): RecipeSummary => ({
  ...base,
  id,
  title: id,
  ingredientNames: [],
  ...extra,
});

const all = [
  R('omelette', {
    ingredientNames: ['oeufs', 'sel', 'beurre'],
    tags: ['rapide'],
    prepMinutes: 5,
    cookMinutes: 5,
  }),
  R('quiche', {
    ingredientNames: ['oeufs', 'farine', 'beurre', 'lardons', 'creme'],
    rating: 4,
    favorite: true,
  }),
  R('tarte', {
    ingredientNames: ['farine', 'beurre', 'pommes', 'sucre'],
    category: 'dessert',
    cookMinutes: 60,
  }),
];

describe('filterRecipes', () => {
  const opts = {
    filters: EMPTY_FILTERS,
    scope: 'all',
    membership: new Map<string, Set<string>>(),
    searchIds: null,
  };

  it('applies category, time, tags, rating and favourites', () => {
    const ids = (f: Partial<typeof EMPTY_FILTERS>) =>
      filterRecipes(all, { ...opts, filters: { ...EMPTY_FILTERS, ...f } }).map((r) => r.id);
    expect(ids({ categories: ['dessert'] })).toEqual(['tarte']);
    expect(ids({ maxMinutes: 30 })).toEqual(['omelette', 'quiche']);
    expect(ids({ tags: ['rapide'] })).toEqual(['omelette']);
    expect(ids({ minRating: 3 })).toEqual(['quiche']);
    expect(ids({ favoritesOnly: true })).toEqual(['quiche']);
    expect(activeFilterCount({ ...EMPTY_FILTERS, tags: ['a', 'b'], minRating: 2 })).toBe(3);
  });

  it('keeps full-text ranking order and collection scope', () => {
    const ranked = filterRecipes(all, { ...opts, searchIds: ['tarte', 'omelette'] }).map((r) => r.id);
    expect(ranked).toEqual(['tarte', 'omelette']);
    const scoped = filterRecipes(all, {
      ...opts,
      scope: 'c1',
      membership: new Map([['c1', new Set(['quiche'])]]),
    });
    expect(scoped.map((r) => r.id)).toEqual(['quiche']);
  });

  it('picks a random recipe', () => {
    expect(pickRandom(all, () => 0.99)?.id).toBe('tarte');
    expect(pickRandom([], Math.random)).toBeNull();
  });
});

describe('matchRecipes', () => {
  it('ranks by coverage, ignoring staples like salt', () => {
    const res = matchRecipes(all, ['Œufs', 'beurre']);
    expect(res[0]).toMatchObject({ have: 2, total: 2, missing: [] });
    expect(res[0]!.recipe.id).toBe('omelette');
    expect(res[1]!.recipe.id).toBe('quiche');
    expect(res[1]!.missing).toEqual(['farine', 'lardons', 'creme']);
    expect(res.map((r) => r.recipe.id)).toContain('tarte');
  });

  it('returns nothing without ingredients', () => {
    expect(matchRecipes(all, [])).toEqual([]);
  });

  it('suggests frequent ingredients', () => {
    expect(frequentIngredients(all, 2)).toEqual(['beurre', 'farine']);
  });

  it('keeps short names such as "ail" and "lait" in the suggestions', () => {
    const recipes = [
      R('aioli', { ingredientNames: ['ail', 'huile', 'lait'] }),
      R('gratin', { ingredientNames: ['ail', 'lait', 'pommes de terre'] }),
    ];
    expect(frequentIngredients(recipes, 2)).toEqual(['ail', 'lait']);
    expect(matchRecipes(recipes, ['lait'])).toHaveLength(2);
  });
});
