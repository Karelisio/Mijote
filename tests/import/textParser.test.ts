import { describe, expect, it } from 'vitest';
import { parseRecipeText } from '@/import/textParser';

describe('parseRecipeText', () => {
  it('parses a text with headings, sub-sections and a numbered steps list', () => {
    const text = `Tarte aux pommes
Pour 6 personnes
Préparation : 20 min
Cuisson : 45 min

Ingrédients
Pour la pâte :
- 250 g de farine
- 125 g de beurre
- 1 pincée de sel

Pour la garniture :
- 4 pommes
- 50 g de sucre

Préparation
1. Préparer la pâte et foncer le moule.
2. Disposer les pommes coupées en lamelles.
3. Cuire 45 minutes à 180°C.

Notes
Se déguste tiède.
Regarde cette recette https://www.example.com/tarte via un ami`;

    const r = parseRecipeText(text);

    expect(r.title).toBe('Tarte aux pommes');
    expect(r.servings).toBe(6);
    expect(r.prepMinutes).toBe(20);
    expect(r.cookMinutes).toBe(45);
    expect(r.sourceUrl).toBe('https://www.example.com/tarte');
    expect(r.sections).toHaveLength(2);
    expect(r.sections[0]).toEqual({
      name: 'Pâte',
      lines: ['250 g de farine', '125 g de beurre', '1 pincée de sel'],
    });
    expect(r.sections[1]).toEqual({ name: 'Garniture', lines: ['4 pommes', '50 g de sucre'] });
    expect(r.steps).toEqual([
      'Préparer la pâte et foncer le moule.',
      'Disposer les pommes coupées en lamelles.',
      'Cuire 45 minutes à 180°C.',
    ]);
    expect(r.notes).toBe('Se déguste tiède.');
    expect(r.category).toBeNull();
    expect(r.tags).toEqual([]);
    expect(r.imageUrl).toBeNull();
  });

  it('parses a text with no headings at all (shape-based heuristics)', () => {
    const text = `Salade de tomates
2 tomates
1 oignon rouge
1 c. à soupe d'huile d'olive
Couper les tomates en dés et mélanger avec l'oignon émincé.
Assaisonner avec l'huile d'olive, du sel et du poivre puis servir frais.`;

    const r = parseRecipeText(text);

    expect(r.title).toBe('Salade de tomates');
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]?.name).toBe('');
    expect(r.sections[0]?.lines).toEqual(['2 tomates', '1 oignon rouge', "1 c. à soupe d'huile d'olive"]);
    expect(r.steps).toEqual([
      "Couper les tomates en dés et mélanger avec l'oignon émincé.",
      "Assaisonner avec l'huile d'olive, du sel et du poivre puis servir frais.",
    ]);
  });

  it('parses an English text with "Serves" and "Prep time"', () => {
    const text = `Pancakes
Serves 4
Prep time: 10 minutes
Cook time: 15 minutes

Ingredients
- 200g flour
- 2 eggs
- 300ml milk

Instructions
1. Mix the flour and eggs.
2. Whisk in the milk until smooth.
3. Cook on a hot griddle.`;

    const r = parseRecipeText(text);

    expect(r.title).toBe('Pancakes');
    expect(r.servings).toBe(4);
    expect(r.prepMinutes).toBe(10);
    expect(r.cookMinutes).toBe(15);
    expect(r.sections).toEqual([{ name: '', lines: ['200g flour', '2 eggs', '300ml milk'] }]);
    expect(r.steps).toEqual([
      'Mix the flour and eggs.',
      'Whisk in the milk until smooth.',
      'Cook on a hot griddle.',
    ]);
  });

  it('parses a bare-bones text with just a title and an ingredients heading', () => {
    const text = `Riz cantonais

Ingrédients
- 2 tasses de riz cuit
- 2 œufs
- 100 g de petits pois

Étapes
Faire revenir les œufs battus.
Ajouter le riz et les petits pois, bien mélanger.`;

    const r = parseRecipeText(text);

    expect(r.title).toBe('Riz cantonais');
    expect(r.sections).toEqual([
      { name: '', lines: ['2 tasses de riz cuit', '2 œufs', '100 g de petits pois'] },
    ]);
    expect(r.steps).toEqual([
      'Faire revenir les œufs battus.',
      'Ajouter le riz et les petits pois, bien mélanger.',
    ]);
    expect(r.servings).toBeNull();
    expect(r.prepMinutes).toBeNull();
    expect(r.cookMinutes).toBeNull();
    expect(r.sourceUrl).toBeNull();
  });

  it('extracts "Portions : 6" style metadata', () => {
    const text = `Soupe de potiron
Portions : 6

Ingrédients
- 1 kg de potiron
- 1 oignon

Préparation
Cuire le potiron et l'oignon puis mixer.`;

    const r = parseRecipeText(text);
    expect(r.servings).toBe(6);
  });
});

describe('guessCategoryFromTitle', () => {
  it('guesses common dishes', async () => {
    const { guessCategoryFromTitle } = await import('@/import/category');
    expect(guessCategoryFromTitle('Gâteau au yaourt')).toBe('dessert');
    expect(guessCategoryFromTitle('Velouté de potimarron')).toBe('starter');
    expect(guessCategoryFromTitle('Poulet rôti')).toBeNull();
  });
});
