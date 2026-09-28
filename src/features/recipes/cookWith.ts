import type { RecipeSummary } from '@/db/types';
import { normalizeText } from '@/config/units';
import { itemKey } from '@/features/shopping/merge';

/** Always-available basics that should not count as "missing". */
const STAPLES = [
  'sel',
  'poivre',
  'eau',
  'huile',
  'huile d olive',
  'sucre',
  'salt',
  'pepper',
  'water',
  'oil',
  'olive oil',
  'sugar',
].map(itemKey);

export interface CookMatch {
  recipe: RecipeSummary;
  have: number;
  total: number;
  missing: string[];
  score: number;
}

function matches(ingredient: string, available: string[]): boolean {
  const key = itemKey(ingredient);
  const words = key.split(' ');
  return available.some((a) => key === a || words.includes(a) || (a.includes(' ') && key.includes(a)));
}

/** Ranks recipes by the share of (non-staple) ingredients already available. */
export function matchRecipes(recipes: RecipeSummary[], availableRaw: string[]): CookMatch[] {
  const available = availableRaw.map(itemKey).filter(Boolean);
  if (!available.length) return [];
  const out: CookMatch[] = [];
  for (const recipe of recipes) {
    const needed = [...new Set(recipe.ingredientNames)].filter((n) => !STAPLES.includes(itemKey(n)));
    if (!needed.length) continue;
    const missing = needed.filter((n) => !matches(n, available));
    const have = needed.length - missing.length;
    if (have === 0) continue;
    // Coverage first, then fewer missing items, then favourites.
    const score = have / needed.length - missing.length * 0.01 + (recipe.favorite ? 0.005 : 0);
    out.push({ recipe, have, total: needed.length, missing, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Most frequent ingredient names across recipes, as suggestions. */
export function frequentIngredients(recipes: RecipeSummary[], limit = 12): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const r of recipes) {
    for (const name of new Set(r.ingredientNames)) {
      const k = itemKey(name);
      if (STAPLES.includes(k) || k.length < 3) continue;
      const e = counts.get(k) ?? { name, n: 0 };
      e.n++;
      counts.set(k, e);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((e) => normalizeText(e.name));
}
