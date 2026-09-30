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

describe('parseRecipeText — metadata stays in the header', () => {
  it('keeps cooking steps that mention a duration or a number of portions', () => {
    const r = parseRecipeText(`Pâtes au beurre
Serves 2
Cook time: 12 minutes

Ingredients
200 g pasta
Instructions
Cook the pasta for 10 minutes.
Cook for 5 min, stirring often.
Cuisson : enfourner 30 min à 180°C.
Couper le gâteau en 8 portions.`);
    expect(r.servings).toBe(2);
    expect(r.cookMinutes).toBe(12);
    expect(r.steps).toEqual([
      'Cook the pasta for 10 minutes.',
      'Cook for 5 min, stirring often.',
      'Cuisson : enfourner 30 min à 180°C.',
      'Couper le gâteau en 8 portions.',
    ]);
  });

  it('does not read metadata from steps, even without a header value', () => {
    const r = parseRecipeText(`Gâteau
Ingrédients
3 œufs
Préparation
Cook for 5 min, stirring often.
Temps de cuisson : 30 min
Couper le gâteau en 8 portions.`);
    expect(r.servings).toBeNull();
    expect(r.cookMinutes).toBeNull();
    expect(r.steps).toHaveLength(3);
  });

  it('never overwrites a value found first', () => {
    const r = parseRecipeText(`Tarte
Pour 6 personnes
Cuisson : 45 min
Temps de cuisson : 50 min
Portions : 8
Ingrédients
4 pommes`);
    expect(r.servings).toBe(6);
    expect(r.cookMinutes).toBe(45);
  });

  it('reads the usual header forms before the first ingredient when there is no heading', () => {
    const r = parseRecipeText(`Salade de tomates
Pour 4 à 6 personnes
Temps de préparation : 15 minutes
Cuisson : 1 h 10
2 tomates
1 oignon rouge
Prep time: 40 min`);
    expect(r.servings).toBe(4);
    expect(r.prepMinutes).toBe(15);
    expect(r.cookMinutes).toBe(70);
    // After the first ingredient, a metadata-looking line is ordinary text.
    expect(r.steps).toEqual(['Prep time: 40 min']);
  });

  it('reads the number of servings that opens the ingredients list', () => {
    const r = parseRecipeText(`Crêpes
Ingrédients
Pour 4 personnes
250 g de farine
Préparation
Couper en 8 portions.`);
    expect(r.servings).toBe(4);
    expect(r.sections).toEqual([{ name: '', lines: ['250 g de farine'] }]);
    expect(r.steps).toEqual(['Couper en 8 portions.']);
  });

  it('only takes a pure duration after the label', () => {
    const r = parseRecipeText(`Pain
Préparation : 20 min + 1 h de repos
Cuisson : 35 minutes environ
Ingrédients
500 g de farine`);
    expect(r.prepMinutes).toBeNull();
    expect(r.cookMinutes).toBe(35);
  });
});

describe('parseRecipeText — ingredient sub-sections', () => {
  it('keeps short ingredient lines without a quantity as ingredients', () => {
    const r = parseRecipeText(`Quiche
Ingrédients
3 œufs
Sel et poivre
20 cl de crème
Huile d olive
1 oignon
Étapes
Mélanger.`);
    expect(r.sections).toEqual([
      { name: '', lines: ['3 œufs', 'Sel et poivre', '20 cl de crème', 'Huile d olive', '1 oignon'] },
    ]);
  });

  it('starts a sub-section on "…:" or "Pour la/le/les …" lines', () => {
    const r = parseRecipeText(`Tarte
Ingrédients
Pour la pâte
250 g de farine
Garniture :
4 pommes
Pour l'assemblage
1 jaune d'œuf
Préparation
Cuire.`);
    expect(r.sections).toEqual([
      { name: 'Pâte', lines: ['250 g de farine'] },
      { name: 'Garniture', lines: ['4 pommes'] },
      { name: 'Assemblage', lines: ["1 jaune d'œuf"] },
    ]);
  });
});

describe('parseRecipeText — numbered steps without headings', () => {
  it('classifies "1. …" lines as steps, not ingredients', () => {
    const r = parseRecipeText(`Salade
2 tomates
1,5 kg de pommes de terre
1. Mélanger les tomates.
2) Servir frais.`);
    expect(r.sections).toEqual([{ name: '', lines: ['2 tomates', '1,5 kg de pommes de terre'] }]);
    expect(r.steps).toEqual(['Mélanger les tomates.', 'Servir frais.']);
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
