import { describe, expect, it } from 'vitest';
import { buildMagoPayload, buildMagoUrl, decodeBase64Url, encodeBase64Url } from '@/features/mago/payload';

describe('base64url', () => {
  it('round-trips UTF-8 text without padding or unsafe chars', () => {
    const s = 'Crème brûlée — œufs ½ 🍳 ??>>';
    const enc = encodeBase64Url(s);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(enc)).toBe(s);
  });
});

describe('buildMagoPayload', () => {
  it('merges duplicates and maps categories and units', () => {
    const p = buildMagoPayload(
      [
        { name: 'Farine', quantity: 250, unit: 'g', recipeTitle: 'Crêpes' },
        { name: 'farine', quantity: 200, unit: 'g', recipeTitle: 'Quiche' },
        { name: 'Lait', quantity: 1, unit: 'tbsp', recipeTitle: 'Crêpes', note: 'entier' },
        { name: 'Poulet', quantity: 600, unit: 'g', recipeTitle: 'Curry' },
        { name: 'Truc', quantity: null, unit: '' },
      ],
      { listName: '  Courses  ', lang: 'fr' },
    );
    expect(p.version).toBe(1);
    expect(p.source).toBe('Mijote');
    expect(p.listName).toBe('Courses');
    expect(p.items).toHaveLength(4);
    expect(p.items[0]).toEqual({
      name: 'Farine',
      quantity: 450,
      unit: 'g',
      category: 'Pantry',
      note: '',
      recipeTitle: 'Crêpes, Quiche',
    });
    expect(p.items[1]).toMatchObject({ unit: 'c. à soupe', category: 'Laiterie', note: 'entier' });
    expect(p.items[2]).toMatchObject({ category: 'Viande' });
    expect(p.items[3]).toMatchObject({ quantity: null, unit: '', category: 'Autres', recipeTitle: '' });
  });

  it('omits an empty list name', () => {
    const p = buildMagoPayload([{ name: 'Sel', quantity: null, unit: '' }], { listName: ' ', lang: 'en' });
    expect('listName' in p).toBe(false);
  });

  it('builds a mago://import deep link that decodes back to the payload', () => {
    const p = buildMagoPayload([{ name: 'Œufs', quantity: 6, unit: '' }], { lang: 'fr' });
    const url = buildMagoUrl(p);
    expect(url.startsWith('mago://import?data=')).toBe(true);
    const data = new URL(url).searchParams.get('data');
    expect(JSON.parse(decodeBase64Url(data!))).toEqual(p);
  });
});
