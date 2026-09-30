import { describe, expect, it, vi } from 'vitest';
import { listShopping } from '@/db/repos/shopping';
import { memoryDb } from '../helpers/db';

const dbPromise = memoryDb();
vi.mock('@/store/recipes', () => ({ db: () => dbPromise }));

const { useShopping } = await import('@/features/shopping/store');

describe('shopping store', () => {
  it('counts added lines and saves merged recipe titles', async () => {
    const add = useShopping.getState().addDrafts;
    expect(await add([{ name: 'sel', quantity: null, unit: '', recipeTitle: 'Crêpes' }])).toBe(1);
    // Already on the list without a quantity: nothing new to buy, but the recipe is recorded.
    expect(await add([{ name: 'Sel', quantity: null, unit: '', recipeTitle: 'Quiche' }])).toBe(0);
    expect(await add([{ name: 'farine', quantity: 200, unit: 'g', recipeTitle: 'Quiche' }])).toBe(1);
    const saved = await listShopping(await dbPromise);
    expect(saved.find((i) => i.name === 'sel')?.recipeTitles).toEqual(['Crêpes', 'Quiche']);
    expect(saved).toHaveLength(2);
  });
});
