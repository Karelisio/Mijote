import { create } from 'zustand';
import type { Id, ShoppingItem } from '@/db/types';
import { db } from '@/store/recipes';
import {
  deleteShoppingItems,
  listShopping,
  replaceShopping,
  setChecked,
  upsertShoppingItems,
} from '@/db/repos/shopping';
import { mergeShopping, type ShoppingDraft } from './merge';

interface ShoppingState {
  loaded: boolean;
  items: ShoppingItem[];
  load: () => Promise<void>;
  /** Merges drafts into the list; returns how many lines were added or updated. */
  addDrafts: (drafts: ShoppingDraft[]) => Promise<number>;
  toggle: (id: Id) => Promise<void>;
  update: (item: ShoppingItem) => Promise<void>;
  remove: (ids: Id[]) => Promise<ShoppingItem[]>;
  restore: (items: ShoppingItem[]) => Promise<void>;
  clear: () => Promise<ShoppingItem[]>;
}

export const useShopping = create<ShoppingState>((set, get) => ({
  loaded: false,
  items: [],
  load: async () => {
    set({ items: await listShopping(await db()), loaded: true });
  },
  addDrafts: async (drafts) => {
    const before = get().items;
    const after = mergeShopping(before, drafts);
    const changed = after.filter((a) => {
      const b = before.find((x) => x.id === a.id);
      return !b || b.quantity !== a.quantity || b.unit !== a.unit;
    });
    set({ items: after });
    await upsertShoppingItems(await db(), changed);
    return changed.length;
  },
  toggle: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    set({ items: get().items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)) });
    await setChecked(await db(), id, !item.checked);
  },
  update: async (item) => {
    set({ items: get().items.map((i) => (i.id === item.id ? item : i)) });
    await upsertShoppingItems(await db(), [item]);
  },
  remove: async (ids) => {
    const removed = get().items.filter((i) => ids.includes(i.id));
    set({ items: get().items.filter((i) => !ids.includes(i.id)) });
    await deleteShoppingItems(await db(), ids);
    return removed;
  },
  restore: async (items) => {
    const merged = [...get().items.filter((i) => !items.some((r) => r.id === i.id)), ...items].sort(
      (a, b) => a.position - b.position,
    );
    set({ items: merged });
    await upsertShoppingItems(await db(), items);
  },
  clear: async () => {
    const removed = get().items;
    set({ items: [] });
    await replaceShopping(await db(), []);
    return removed;
  },
}));
