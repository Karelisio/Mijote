import { describe, expect, it } from 'vitest';
import { formatQuantity, roundSmart, scaleIngredient, scaleQuantity } from '@/features/recipes/portions';

describe('roundSmart', () => {
  it('rounds metric amounts to practical steps', () => {
    expect(roundSmart(333.33, 'g')).toBe(330);
    expect(roundSmart(83.3, 'g')).toBe(85);
    expect(roundSmart(6.7, 'g')).toBe(7);
    expect(roundSmart(1666, 'ml')).toBe(1650);
    expect(roundSmart(12.4, 'cl')).toBe(10);
  });
  it('rounds spoons to quarters or thirds', () => {
    expect(roundSmart(1.5, 'tbsp')).toBe(1.5);
    expect(roundSmart(0.66, 'tsp')).toBeCloseTo(2 / 3);
    expect(roundSmart(1.3, 'tbsp')).toBeCloseTo(4 / 3);
    expect(roundSmart(0.1, 'tsp')).toBe(0.25);
  });
  it('rounds countable items to halves then whole numbers', () => {
    expect(roundSmart(2.67, '')).toBe(2.5);
    expect(roundSmart(0.2, '')).toBe(0.5);
    expect(roundSmart(5.33, '')).toBe(5);
    expect(roundSmart(1.4, 'clove')).toBe(1.5);
    expect(roundSmart(4.6, 'clove')).toBe(5);
  });
});

describe('scaling', () => {
  it('keeps quantities untouched at factor 1 and null stays null', () => {
    expect(scaleQuantity(3, 1, '')).toBe(3);
    expect(scaleQuantity(null, 2, 'g')).toBeNull();
  });
  it('scales 4 → 6 servings', () => {
    expect(scaleQuantity(250, 6 / 4, 'g')).toBe(380);
    expect(scaleQuantity(4, 6 / 4, '')).toBe(6);
    expect(scaleQuantity(1, 6 / 4, 'pinch')).toBe(1.5);
  });
  it('switches to kg / l above 1000', () => {
    const r = scaleIngredient({ quantity: 600, quantityMax: null, unit: 'g', name: 'poulet', note: '' }, 2);
    expect(r).toMatchObject({ quantity: 1.2, unit: 'kg' });
    const l = scaleIngredient({ quantity: 50, quantityMax: null, unit: 'cl', name: 'lait', note: '' }, 3);
    expect(l).toMatchObject({ quantity: 1.5, unit: 'l' });
  });
  it('scales ranges', () => {
    const r = scaleIngredient({ quantity: 2, quantityMax: 3, unit: '', name: 'œufs', note: '' }, 2);
    expect(r).toMatchObject({ quantity: 4, quantityMax: 6 });
  });
});

describe('formatQuantity', () => {
  it('uses unicode fractions for non-metric units', () => {
    expect(formatQuantity(1.5, 'fr', 'tbsp')).toBe('1 ½');
    expect(formatQuantity(0.25, 'fr', 'tsp')).toBe('¼');
    expect(formatQuantity(2 / 3, 'en', '')).toBe('⅔');
    expect(formatQuantity(3, 'fr', '')).toBe('3');
  });
  it('uses a decimal comma in French for metric units', () => {
    expect(formatQuantity(1.25, 'fr', 'kg')).toBe('1,25');
    expect(formatQuantity(1.25, 'en', 'kg')).toBe('1.25');
    expect(formatQuantity(250, 'fr', 'g')).toBe('250');
  });
});
