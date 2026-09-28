import { create } from 'zustand';
import type { Category, Collection, Id, RecipeSummary } from '@/db/types';
import { getDb } from '@/db/database';
import type { DbDriver } from '@/db/driver';
import { listRecipeSummaries } from '@/db/repos/recipes';
import { collectionMembership, listCollections } from '@/db/repos/collections';
import { currentLang } from '@/i18n';

export const db = (): Promise<DbDriver> => getDb(currentLang());

export interface RecipeFilters {
  categories: Category[];
  maxMinutes: number | null;
  tags: string[];
  minRating: number;
  favoritesOnly: boolean;
}

export const EMPTY_FILTERS: RecipeFilters = {
  categories: [],
  maxMinutes: null,
  tags: [],
  minRating: 0,
  favoritesOnly: false,
};

/** 'all' | 'favorites' | collection id */
export type Scope = string;

interface RecipesState {
  loaded: boolean;
  summaries: RecipeSummary[];
  collections: Collection[];
  membership: Map<Id, Set<Id>>;
  query: string;
  filters: RecipeFilters;
  scope: Scope;
  refresh: () => Promise<void>;
  setQuery: (q: string) => void;
  setFilters: (f: RecipeFilters) => void;
  setScope: (s: Scope) => void;
  /** Optimistic local update (favorite/rating) before the DB write completes. */
  patchSummary: (id: Id, patch: Partial<RecipeSummary>) => void;
}

export const useRecipes = create<RecipesState>((set) => ({
  loaded: false,
  summaries: [],
  collections: [],
  membership: new Map(),
  query: '',
  filters: EMPTY_FILTERS,
  scope: 'all',
  refresh: async () => {
    const d = await db();
    const [summaries, collections, membership] = await Promise.all([
      listRecipeSummaries(d),
      listCollections(d),
      collectionMembership(d),
    ]);
    set({ summaries, collections, membership, loaded: true });
  },
  setQuery: (query) => set({ query }),
  setFilters: (filters) => set({ filters }),
  setScope: (scope) => set({ scope }),
  patchSummary: (id, patch) =>
    set((s) => ({ summaries: s.summaries.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
}));

export const refreshRecipes = (): Promise<void> => useRecipes.getState().refresh();
