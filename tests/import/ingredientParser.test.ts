import { describe, expect, it } from 'vitest';
import { parseIngredientLine } from '@/import/ingredientParser';
import { formatQuantity } from '@/features/recipes/portions';
import { formatUnit } from '@/config/units';

/** "⁄", looks like "/" but is a distinct character. */
const FRACTION_SLASH = '\u2044';

describe('parseIngredientLine', () => {
  it('parses a plain integer with a simple unit', () => {
    expect(parseIngredientLine('200 g de farine')).toEqual({
      quantity: 200,
      quantityMax: null,
      unit: 'g',
      name: 'farine',
      note: '',
    });
  });

  it('parses a quantity glued to the unit', () => {
    expect(parseIngredientLine('200g de farine')).toEqual({
      quantity: 200,
      quantityMax: null,
      unit: 'g',
      name: 'farine',
      note: '',
    });
  });

  it('parses cl glued to the quantity', () => {
    expect(parseIngredientLine('25cl de lait')).toEqual({
      quantity: 25,
      quantityMax: null,
      unit: 'cl',
      name: 'lait',
      note: '',
    });
  });

  it('parses a decimal quantity with a comma', () => {
    expect(parseIngredientLine('1,5 kg de pommes de terre')).toEqual({
      quantity: 1.5,
      quantityMax: null,
      unit: 'kg',
      name: 'pommes de terre',
      note: '',
    });
  });

  it('parses a decimal quantity with a dot', () => {
    const r = parseIngredientLine('0.5 l de lait');
    expect(r.quantity).toBe(0.5);
    expect(r.unit).toBe('l');
    expect(r.name).toBe('lait');
  });

  it('parses a simple fraction', () => {
    expect(parseIngredientLine('1/2 citron')).toEqual({
      quantity: 0.5,
      quantityMax: null,
      unit: '',
      name: 'citron',
      note: '',
    });
  });

  it('parses a mixed number with a fraction', () => {
    const r = parseIngredientLine('1 1/2 tasse de farine');
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe('cup');
    expect(r.name).toBe('farine');
  });

  it('parses a unicode fraction alone', () => {
    const r = parseIngredientLine('½ tasse de sucre');
    expect(r.quantity).toBe(0.5);
    expect(r.unit).toBe('cup');
    expect(r.name).toBe('sucre');
  });

  it('parses a unicode fraction glued to an integer', () => {
    const r = parseIngredientLine('1½ tasses de farine');
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe('cup');
    expect(r.name).toBe('farine');
  });

  it('parses a whole number and a spaced unicode fraction (as displayed)', () => {
    expect(parseIngredientLine('1 ½ c. à soupe de sucre')).toEqual({
      quantity: 1.5,
      quantityMax: null,
      unit: 'tbsp',
      name: 'sucre',
      note: '',
    });
    expect(parseIngredientLine('2 ¼ tasses de lait').quantity).toBe(2.25);
    expect(parseIngredientLine('3\u00a0¾ cups flour').quantity).toBe(3.75);
  });

  it('parses the fraction slash (U+2044) like "/"', () => {
    expect(parseIngredientLine(`1${FRACTION_SLASH}2 citron`)).toEqual({
      quantity: 0.5,
      quantityMax: null,
      unit: '',
      name: 'citron',
      note: '',
    });
    const r = parseIngredientLine(`1 1${FRACTION_SLASH}2 tasse de farine`);
    expect(r.quantity).toBe(1.5);
    expect(r.unit).toBe('cup');
    expect(r.name).toBe('farine');
  });

  it('parses a hyphenated mixed number', () => {
    expect(parseIngredientLine('1-1/2 cups flour')).toEqual({
      quantity: 1.5,
      quantityMax: null,
      unit: 'cup',
      name: 'flour',
      note: '',
    });
    expect(parseIngredientLine(`2-1${FRACTION_SLASH}4 tasses de lait`).quantity).toBe(2.25);
  });

  it('keeps "1-2" a range, not a mixed number', () => {
    const r = parseIngredientLine('1-2 oignons');
    expect(r.quantity).toBe(1);
    expect(r.quantityMax).toBe(2);
    expect(r.name).toBe('oignons');
  });

  it('parses ranges written with spaced unicode fractions (as displayed)', () => {
    const a = parseIngredientLine('1–1 ½ c. à soupe de sucre');
    expect([a.quantity, a.quantityMax, a.unit, a.name]).toEqual([1, 1.5, 'tbsp', 'sucre']);
    const b = parseIngredientLine('1 ½–2 tasses de farine');
    expect([b.quantity, b.quantityMax, b.unit, b.name]).toEqual([1.5, 2, 'cup', 'farine']);
  });

  it('parses ¼ and ¾ and ⅓ and ⅔ and ⅛', () => {
    expect(parseIngredientLine('¼ tasse de lait').quantity).toBe(0.25);
    expect(parseIngredientLine('¾ tasse de lait').quantity).toBe(0.75);
    expect(parseIngredientLine('⅓ tasse de lait').quantity).toBeCloseTo(1 / 3);
    expect(parseIngredientLine('⅔ tasse de lait').quantity).toBeCloseTo(2 / 3);
    expect(parseIngredientLine('⅛ c. à café de sel').quantity).toBe(0.125);
  });

  it('parses a range with "à"', () => {
    const r = parseIngredientLine('2 à 3 œufs');
    expect(r.quantity).toBe(2);
    expect(r.quantityMax).toBe(3);
    expect(r.name).toBe('œufs');
  });

  it('parses a range with a dash', () => {
    const r = parseIngredientLine('2-3 oignons');
    expect(r.quantity).toBe(2);
    expect(r.quantityMax).toBe(3);
    expect(r.name).toBe('oignons');
  });

  it('parses a range with "to"', () => {
    const r = parseIngredientLine('2 to 3 apples');
    expect(r.quantity).toBe(2);
    expect(r.quantityMax).toBe(3);
    expect(r.name).toBe('apples');
  });

  it('parses a range with unaccented "a"', () => {
    const r = parseIngredientLine('2 a 3 carottes');
    expect(r.quantity).toBe(2);
    expect(r.quantityMax).toBe(3);
    expect(r.name).toBe('carottes');
  });

  it('does not mistake "abricots" for a range separator', () => {
    const r = parseIngredientLine('2 abricots');
    expect(r.quantity).toBe(2);
    expect(r.quantityMax).toBeNull();
    expect(r.name).toBe('abricots');
  });

  it('matches "c. à soupe" (accented, dotted)', () => {
    const r = parseIngredientLine('2 c. à soupe de miel');
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('miel');
  });

  it('matches "cuillère à soupe" (full word)', () => {
    const r = parseIngredientLine('1 cuillère à soupe de moutarde');
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('moutarde');
  });

  it('matches "cs" shorthand', () => {
    const r = parseIngredientLine('2 cs de sucre');
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('sucre');
  });

  it('matches "tbsp" (English)', () => {
    const r = parseIngredientLine('2 tbsp sugar');
    expect(r.unit).toBe('tbsp');
    expect(r.name).toBe('sugar');
  });

  it('matches "cac"/"c. à café" (teaspoon)', () => {
    const r = parseIngredientLine('1 c. à café de levure');
    expect(r.unit).toBe('tsp');
    expect(r.name).toBe('levure');
  });

  it('does not let "g" match inside "gousse"', () => {
    const r = parseIngredientLine('3 gousses d’ail');
    expect(r.unit).toBe('clove');
    expect(r.name).toBe('ail');
  });

  it('strips the "de " article after a unit', () => {
    const r = parseIngredientLine('500 g de sucre');
    expect(r.name).toBe('sucre');
  });

  it('strips the "d\'" elision article', () => {
    const r = parseIngredientLine("1 l d'huile d'olive");
    expect(r.unit).toBe('l');
    expect(r.name).toBe("huile d'olive");
  });

  it('strips the "du " article', () => {
    const r = parseIngredientLine('1 pincée du sel');
    expect(r.unit).toBe('pinch');
    expect(r.name).toBe('sel');
  });

  it('strips the "des " article', () => {
    const r = parseIngredientLine('3 tranches des lardons fumés');
    expect(r.unit).toBe('slice');
    expect(r.name).toBe('lardons fumés');
  });

  it('extracts a parenthetical note', () => {
    const r = parseIngredientLine('200 g de farine (tamisée)');
    expect(r.name).toBe('farine');
    expect(r.note).toBe('tamisée');
  });

  it('extracts a note after a comma when quantity is present', () => {
    const r = parseIngredientLine('2 oignons, émincés');
    expect(r.name).toBe('oignons');
    expect(r.note).toBe('émincés');
  });

  it('keeps the whole line as name when there is no quantity (comma kept)', () => {
    const r = parseIngredientLine('sel, poivre');
    expect(r).toEqual({ quantity: null, quantityMax: null, unit: '', name: 'sel, poivre', note: '' });
  });

  it('keeps original case, only trims', () => {
    const r = parseIngredientLine('  200 g de Parmesan râpé  ');
    expect(r.name).toBe('Parmesan râpé');
  });

  it('strips a leading "- " bullet', () => {
    const r = parseIngredientLine('- 2 œufs');
    expect(r.quantity).toBe(2);
    expect(r.name).toBe('œufs');
  });

  it('strips a leading "• " bullet', () => {
    const r = parseIngredientLine('• 100 g de beurre');
    expect(r.quantity).toBe(100);
    expect(r.name).toBe('beurre');
  });

  it('strips a leading "* " bullet', () => {
    const r = parseIngredientLine('* 1 pincée de sel');
    expect(r.unit).toBe('pinch');
    expect(r.name).toBe('sel');
  });

  it('handles a quantity with no unit and no article', () => {
    const r = parseIngredientLine('3 œufs');
    expect(r).toEqual({ quantity: 3, quantityMax: null, unit: '', name: 'œufs', note: '' });
  });

  it('parses "1 cup milk" (English cup)', () => {
    const r = parseIngredientLine('1 cup milk');
    expect(r.unit).toBe('cup');
    expect(r.name).toBe('milk');
  });

  it('parses "3 cloves garlic" (English)', () => {
    const r = parseIngredientLine('3 cloves garlic');
    expect(r.unit).toBe('clove');
    expect(r.name).toBe('garlic');
  });

  it('parses kg with a plural French unit word', () => {
    const r = parseIngredientLine('2 kilos de carottes');
    expect(r.unit).toBe('kg');
    expect(r.name).toBe('carottes');
  });

  it('parses an empty line', () => {
    expect(parseIngredientLine('')).toEqual({
      quantity: null,
      quantityMax: null,
      unit: '',
      name: '',
      note: '',
    });
  });

  it('parses a note with both parentheses and a trailing word', () => {
    const r = parseIngredientLine('2 tomates (bien mûres) pelées');
    expect(r.name).toBe('tomates pelées');
    expect(r.note).toBe('bien mûres');
  });
});

describe('quantity round trip (display → parse)', () => {
  // Re-parsing a displayed line (editor, shopping item sheet) must give the same quantity back.
  const QUANTITIES = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.25, 1.5, 2, 2.5, 3.75, 10];
  const UNITS = ['', 'g', 'ml', 'tsp', 'tbsp', 'cup', 'clove'];
  const CASES = (['fr', 'en'] as const).flatMap((lang) => UNITS.map((unit) => [lang, unit] as const));

  it.each(CASES)('%s, unit "%s"', (lang, unit) => {
    for (const q of QUANTITIES) {
      const label = unit ? formatUnit(unit, q, lang) : '';
      const line = [formatQuantity(q, lang, unit), label, 'sucre'].filter(Boolean).join(' ');
      const r = parseIngredientLine(line);
      expect(Math.abs((r.quantity ?? NaN) - q), line).toBeLessThan(0.02);
      expect(r.quantityMax, line).toBeNull();
      expect(r.unit, line).toBe(unit);
      expect(r.name, line).toBe('sucre');
    }
  });
});

describe('parseIngredientLine — unit words that are the ingredient', () => {
  it('keeps "10 noix" as ten walnuts instead of a unit without name', () => {
    expect(parseIngredientLine('10 noix')).toEqual({
      quantity: 10,
      quantityMax: null,
      unit: '',
      name: 'noix',
      note: '',
    });
    expect(parseIngredientLine('3 gousses')).toMatchObject({ quantity: 3, unit: '', name: 'gousses' });
  });

  it('reads names that start with a unit word', () => {
    expect(parseIngredientLine('1 bouquet garni')).toMatchObject({
      quantity: 1,
      unit: '',
      name: 'bouquet garni',
    });
    expect(parseIngredientLine('2 noix de coco râpées')).toMatchObject({
      unit: '',
      name: 'noix de coco râpées',
    });
    expect(parseIngredientLine('12 noix de Saint-Jacques')).toMatchObject({
      unit: '',
      name: 'noix de Saint-Jacques',
    });
  });

  it('still reads real units', () => {
    expect(parseIngredientLine('1 noix de beurre')).toMatchObject({ unit: 'knob', name: 'beurre' });
    expect(parseIngredientLine('1 bouquet de persil')).toMatchObject({ unit: 'bunch', name: 'persil' });
    expect(parseIngredientLine('2 gousses d’ail')).toMatchObject({ unit: 'clove', name: 'ail' });
  });
});
