import type { Id, RecipeSummary } from '@/db/types';
import type { RecipeFilters, Scope } from '@/store/recipes';

export function totalMinutes(r: Pick<RecipeSummary, 'prepMinutes' | 'cookMinutes'>): number | null {
  if (r.prepMinutes === null && r.cookMinutes === null) return null;
  return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
}

export function activeFilterCount(f: RecipeFilters): number {
  return (
    f.categories.length +
    f.tags.length +
    (f.maxMinutes !== null ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0) +
    (f.favoritesOnly ? 1 : 0)
  );
}

/**
 * Applies scope, filters and (optional) full-text ranking.
 * `searchIds` null = no text query; otherwise results follow its order.
 */
export function filterRecipes(
  all: RecipeSummary[],
  opts: { filters: RecipeFilters; scope: Scope; membership: Map<Id, Set<Id>>; searchIds: Id[] | null },
): RecipeSummary[] {
  const { filters: f, scope, membership, searchIds } = opts;
  const inScope =
    scope === 'all' ? null : scope === 'favorites' ? null : (membership.get(scope) ?? new Set<Id>());
  const favorites = f.favoritesOnly || scope === 'favorites';
  const rank = searchIds ? new Map(searchIds.map((id, i) => [id, i])) : null;

  const out = all.filter((r) => {
    if (rank && !rank.has(r.id)) return false;
    if (inScope && !inScope.has(r.id)) return false;
    if (favorites && !r.favorite) return false;
    if (f.categories.length && !f.categories.includes(r.category)) return false;
    if (f.tags.length && !f.tags.every((t) => r.tags.includes(t))) return false;
    if (f.minRating > 0 && r.rating < f.minRating) return false;
    if (f.maxMinutes !== null) {
      const tm = totalMinutes(r);
      if (tm === null || tm > f.maxMinutes) return false;
    }
    return true;
  });
  if (rank) out.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return out;
}

export function pickRandom<T>(items: T[], rnd = Math.random): T | null {
  if (!items.length) return null;
  return items[Math.floor(rnd() * items.length)] ?? null;
}
