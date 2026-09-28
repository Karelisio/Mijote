import { describe, expect, it } from 'vitest';
import { addQuantities, compatible, itemKey, mergeDrafts, mergeShopping } from '@/features/shopping/merge';
import { guessAisle } from '@/config/aisles';

describe('itemKey', () => {
  it('ignores case, accents, plurals and articles', () => {
    expect(itemKey('Œufs')).toBe(itemKey('oeuf'));
    expect(itemKey('Tomates')).toBe(itemKey('tomate'));
    expect(itemKey("d'oignons")).toBe(itemKey('Oignon'));
    expect(itemKey('Poireaux')).toBe(itemKey('poireau'));
    expect(itemKey('farine (T55)')).toBe(itemKey('Farine'));
  });
});

describe('quantities', () => {
  it('knows which units can be added', () => {
    expect(compatible('g', 'kg')).toBe(true);
    expect(compatible('cl', 'ml')).toBe(true);
    expect(compatible('tbsp', 'cl')).toBe(true);
    expect(compatible('g', 'ml')).toBe(false);
    expect(compatible('', 'g')).toBe(false);
    expect(compatible('clove', 'clove')).toBe(true);
  });
  it('adds with conversion and readable units', () => {
    expect(addQuantities({ quantity: 800, unit: 'g' }, { quantity: 0.5, unit: 'kg' })).toEqual({
      quantity: 1.3,
      unit: 'kg',
    });
    expect(addQuantities({ quantity: 20, unit: 'cl' }, { quantity: 20, unit: 'cl' })).toEqual({
      quantity: 40,
      unit: 'cl',
    });
    expect(addQuantities({ quantity: 50, unit: 'cl' }, { quantity: 600, unit: 'ml' })).toEqual({
      quantity: 1.1,
      unit: 'l',
    });
    expect(addQuantities({ quantity: 1, unit: 'tbsp' }, { quantity: 3, unit: 'tsp' })).toEqual({
      quantity: 2,
      unit: 'tbsp',
    });
    expect(addQuantities({ quantity: null, unit: '' }, { quantity: 2, unit: '' })).toEqual({
      quantity: 2,
      unit: '',
    });
  });
});

describe('mergeShopping', () => {
  it('merges duplicates from several recipes and keeps provenance', () => {
    const list = mergeDrafts([
      { name: 'farine', quantity: 250, unit: 'g', recipeTitle: 'Crêpes' },
      { name: 'Œufs', quantity: 4, unit: '', recipeTitle: 'Crêpes' },
      { name: 'Farine', quantity: 200, unit: 'g', recipeTitle: 'Quiche' },
      { name: 'oeufs', quantity: 3, unit: '', recipeTitle: 'Quiche' },
      { name: 'lait', quantity: 50, unit: 'cl', recipeTitle: 'Crêpes' },
      { name: 'lait', quantity: 20, unit: 'cl', recipeTitle: 'Quiche' },
      { name: 'sel', quantity: 1, unit: 'pinch', recipeTitle: 'Crêpes' },
      { name: 'sel', quantity: null, unit: '', recipeTitle: 'Quiche' },
    ]);
    const by = (n: string) => list.find((i) => itemKey(i.name) === itemKey(n));
    expect(by('farine')).toMatchObject({
      quantity: 450,
      unit: 'g',
      recipeTitles: ['Crêpes', 'Quiche'],
      aisle: 'pantry',
    });
    expect(by('oeuf')).toMatchObject({ quantity: 7, unit: '', aisle: 'dairy' });
    expect(by('lait')).toMatchObject({ quantity: 70, unit: 'cl' });
    // incompatible units stay separate lines
    expect(list.filter((i) => itemKey(i.name) === 'sel')).toHaveLength(2);
    expect(list).toHaveLength(5);
  });

  it('adds to unchecked existing items but not to checked ones', () => {
    const [first] = mergeDrafts([{ name: 'citron', quantity: 1, unit: '' }]);
    const checked = { ...first!, checked: true };
    const r1 = mergeShopping([first!], [{ name: 'Citrons', quantity: 2, unit: '' }]);
    expect(r1).toHaveLength(1);
    expect(r1[0]!.quantity).toBe(3);
    const r2 = mergeShopping([checked], [{ name: 'Citrons', quantity: 2, unit: '' }]);
    expect(r2).toHaveLength(2);
    expect(r2[1]).toMatchObject({ checked: false, quantity: 2 });
  });

  it('does not mutate the existing list', () => {
    const existing = mergeDrafts([{ name: 'riz', quantity: 200, unit: 'g' }]);
    mergeShopping(existing, [{ name: 'riz', quantity: 100, unit: 'g' }]);
    expect(existing[0]!.quantity).toBe(200);
  });
});

describe('guessAisle', () => {
  it('classifies common ingredients', () => {
    expect(guessAisle('Carottes')).toBe('produce');
    expect(guessAisle('lait de coco')).toBe('pantry');
    expect(guessAisle('lait')).toBe('dairy');
    expect(guessAisle('blancs de poulet')).toBe('meat');
    expect(guessAisle('noix de muscade')).toBe('spices');
    expect(guessAisle('saumon fumé')).toBe('fish');
    expect(guessAisle('pâte feuilletée')).toBe('dairy');
    expect(guessAisle('Poivron rouge')).toBe('produce');
    expect(guessAisle('poivre')).toBe('spices');
    expect(guessAisle('truc inconnu')).toBe('other');
  });
});

describe('unit tidying', () => {
  it('promotes large same-unit sums', () => {
    expect(addQuantities({ quantity: 50, unit: 'cl' }, { quantity: 50, unit: 'cl' })).toEqual({
      quantity: 1,
      unit: 'l',
    });
    expect(addQuantities({ quantity: 600, unit: 'g' }, { quantity: 600, unit: 'g' })).toEqual({
      quantity: 1.2,
      unit: 'kg',
    });
  });
});
