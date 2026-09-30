// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
// jsdom's global `URL` ignores an explicit file:// base and resolves against `window.location`
// instead, so the fixture path must be built with Node's own URL implementation.
import { URL as NodeUrl } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeHtml } from '@/import/html';
import { extractHeuristics } from '@/import/html/heuristics';

function fixture(name: string): string {
  return readFileSync(new NodeUrl(`../fixtures/${name}`, import.meta.url), 'utf8');
}

describe('parseRecipeHtml — marmiton.html (JSON-LD)', () => {
  const url = 'https://www.marmiton.org/recettes/recette_tarte-tatin_12345.aspx';
  const r = parseRecipeHtml(fixture('marmiton.html'), url);

  it('parses successfully', () => expect(r).not.toBeNull());

  it('decodes HTML entities in the title', () => {
    expect(r?.title).toBe("La tarte Tatin de l'auberge");
  });

  it('extracts servings and durations', () => {
    expect(r?.servings).toBe(4);
    expect(r?.prepMinutes).toBe(20);
    expect(r?.cookMinutes).toBe(45);
  });

  it('extracts ingredients into a single default section', () => {
    expect(r?.sections).toHaveLength(1);
    expect(r?.sections[0]?.name).toBe('');
    expect(r?.sections[0]?.lines).toHaveLength(5);
  });

  it('extracts steps from HowToStep', () => {
    expect(r?.steps).toHaveLength(4);
    expect(r?.steps[0]).toBe('Préparer la pâte sablée et la laisser reposer 30 minutes.');
  });

  it('resolves the image to an absolute URL (first of the array)', () => {
    expect(r?.imageUrl).toBe('https://cdn.marmiton.org/images/tarte-tatin-400.jpg');
  });

  it('extracts tags from the keywords string', () => {
    expect(r?.tags).toEqual(['tarte', 'pomme', 'dessert', 'automne']);
  });

  it('maps the category', () => {
    expect(r?.category).toBe('dessert');
  });

  it('sets sourceUrl to the page URL', () => {
    expect(r?.sourceUrl).toBe(url);
  });
});

describe('parseRecipeHtml — 750g.html (JSON-LD with HowToSection)', () => {
  const url = 'https://www.750g.com/quiche-lorraine-r12345.htm';
  const r = parseRecipeHtml(fixture('750g.html'), url);

  it('parses successfully', () => expect(r).not.toBeNull());

  it('has the right title and servings', () => {
    expect(r?.title).toBe('Quiche lorraine maison');
    expect(r?.servings).toBe(6);
  });

  it('derives prepMinutes from totalTime - cookTime', () => {
    expect(r?.cookMinutes).toBe(35);
    expect(r?.prepMinutes).toBe(15);
  });

  it('extracts 5 ingredients', () => {
    expect(r?.sections[0]?.lines).toHaveLength(5);
  });

  it('flattens HowToSection steps, ignoring section names', () => {
    expect(r?.steps).toHaveLength(5);
    expect(r?.steps[0]).toBe('Étaler la pâte brisée dans un moule.');
    expect(r?.steps[4]).toBe('Verser sur la pâte et cuire 35 minutes à 200°C.');
  });

  it('resolves the ImageObject url', () => {
    expect(r?.imageUrl).toBe('https://images.750g.com/quiche-lorraine.jpg');
  });

  it('combines keywords and recipeCuisine into tags', () => {
    expect(r?.tags).toEqual(['quiche', 'lorraine', 'lardons', 'française']);
  });

  it('maps "Plat principal" to main', () => {
    expect(r?.category).toBe('main');
  });
});

describe('parseRecipeHtml — cuisineaz.html (no JSON-LD, site heuristics)', () => {
  const url = 'https://www.cuisineaz.com/recettes/poulet-basquaise-12345.aspx';
  const r = parseRecipeHtml(fixture('cuisineaz.html'), url);

  it('parses successfully', () => expect(r).not.toBeNull());

  it('gets the title from h1 (no og:title present)', () => {
    expect(r?.title).toBe('Poulet basquaise traditionnel');
  });

  it('has no servings/duration metadata (not present in markup)', () => {
    expect(r?.servings).toBeNull();
    expect(r?.prepMinutes).toBeNull();
    expect(r?.cookMinutes).toBeNull();
  });

  it('extracts ingredients from #ingredients li', () => {
    expect(r?.sections).toHaveLength(1);
    expect(r?.sections[0]?.lines).toHaveLength(5);
  });

  it('extracts steps from #preparation p', () => {
    expect(r?.steps).toHaveLength(3);
  });

  it('resolves the image from og:image', () => {
    expect(r?.imageUrl).toBe('https://static.cuisineaz.com/imgs/poulet-basquaise.jpg');
  });

  it('has no tags or category (heuristics does not set them)', () => {
    expect(r?.tags).toEqual([]);
    expect(r?.category).toBeNull();
  });
});

describe('parseRecipeHtml — microdata.html (schema.org microdata)', () => {
  const url = 'https://www.example-blog.fr/recettes/ratatouille';
  const r = parseRecipeHtml(fixture('microdata.html'), url);

  it('parses successfully', () => expect(r).not.toBeNull());

  it('gets the title from the Recipe scope, not the nested author', () => {
    expect(r?.title).toBe('Ratatouille provençale');
  });

  it('extracts servings and durations from datetime attributes', () => {
    expect(r?.servings).toBe(4);
    expect(r?.prepMinutes).toBe(15);
    expect(r?.cookMinutes).toBe(40);
  });

  it('extracts 4 ingredients', () => {
    expect(r?.sections[0]?.lines).toHaveLength(4);
  });

  it('extracts 3 steps from itemListElement/HowToStep', () => {
    expect(r?.steps).toHaveLength(3);
    expect(r?.steps[2]).toBe('Laisser mijoter 30 minutes à feu doux.');
  });

  it('resolves a relative image src to an absolute URL', () => {
    expect(r?.imageUrl).toBe('https://www.example-blog.fr/images/ratatouille.jpg');
  });

  it('splits keywords into tags', () => {
    expect(r?.tags).toEqual(['légumes', 'été', 'provence']);
  });

  it('maps "Accompagnement" to side', () => {
    expect(r?.category).toBe('side');
  });
});

describe('parseRecipeHtml — generic-blog.html (no structured data)', () => {
  const url = 'https://blog.example.com/recettes/cheesecake-citron';
  const r = parseRecipeHtml(fixture('generic-blog.html'), url);

  it('parses successfully', () => expect(r).not.toBeNull());

  it('gets the title from og:title', () => {
    expect(r?.title).toBe('Cheesecake au citron');
  });

  it('splits ingredients into named sub-sections', () => {
    expect(r?.sections).toHaveLength(2);
    expect(r?.sections.map((s) => s.name)).toEqual(['Pâte', 'Garniture']);
    expect(r?.sections[0]?.lines).toHaveLength(2);
    expect(r?.sections[1]?.lines).toHaveLength(3);
  });

  it('extracts 4 steps from the ordered list', () => {
    expect(r?.steps).toHaveLength(4);
  });

  it('resolves the image from og:image', () => {
    expect(r?.imageUrl).toBe('https://blog.example.com/images/cheesecake.jpg');
  });

  it('has no tags or category', () => {
    expect(r?.tags).toEqual([]);
    expect(r?.category).toBeNull();
  });
});

describe('parseRecipeHtml — no-recipe.html', () => {
  it('returns null for a page with no recipe content', () => {
    const url = 'https://blog.example.com/articles/choisir-couteau';
    expect(parseRecipeHtml(fixture('no-recipe.html'), url)).toBeNull();
  });
});

describe('extractHeuristics — generic blog pages', () => {
  const parse = (body: string) =>
    extractHeuristics(
      new DOMParser().parseFromString(`<html><body>${body}</body></html>`, 'text/html'),
      'https://blog.example.com/recette',
    );

  it('reads each list once and stops at the comments, forms, footer and menus', () => {
    const r = parse(`
      <nav><ul><li>Accueil</li><li>Recettes</li></ul></nav>
      <article>
        <h1>Tarte</h1>
        <p><strong>Temps de préparation : 20 min</strong></p>
        <h2>Ingrédients</h2>
        <ul><li>200 g de farine</li><li>3 œufs</li></ul>
        <h2>Préparation</h2>
        <ol><li><p>Mélanger la farine.</p></li><li><p>Cuire <strong>20 min</strong>.</p></li></ol>
        <p><strong>Ne pas trop cuire.</strong></p>
        <h2>Commentaires</h2>
        <p>Super recette, merci !</p>
        <ul><li>Répondre</li></ul>
      </article>
      <form class="newsletter"><p>Inscrivez-vous</p></form>
      <footer><ul><li>Mentions légales</li></ul></footer>`);
    expect(r?.sections).toEqual([{ name: '', lines: ['200 g de farine', '3 œufs'] }]);
    expect(r?.steps).toEqual(['Mélanger la farine.', 'Cuire 20 min.', 'Ne pas trop cuire.']);
  });

  it('does not take "Temps de préparation" for the steps heading', () => {
    const r = parse(`
      <h2>Ingrédients</h2>
      <ul><li>1 citron</li></ul>
      <h3>Temps de préparation</h3>
      <p>15 minutes</p>
      <h2>Étapes</h2>
      <p>Presser le citron.</p>`);
    expect(r?.sections[0]?.lines).toEqual(['1 citron']);
    expect(r?.steps).toEqual(['Presser le citron.']);
  });

  it('keeps to the main content and ends the steps at the next heading of the same level', () => {
    const r = parse(`
      <div class="sidebar"><h2>Préparation</h2><p>Nos meilleures recettes</p></div>
      <main>
        <article>
          <h3>Ingrédients</h3>
          <p><strong>Pour la sauce :</strong></p>
          <ul><li>2 tomates</li></ul>
          <h3>Préparation</h3>
          <h4>Étape 1</h4>
          <p>Couper les tomates.</p>
          <p>Cuire 10 min.</p>
          <h3>Vous aimerez aussi</h3>
          <ul><li>Gratin de courgettes</li></ul>
          <p>Partagez cette recette !</p>
        </article>
      </main>
      <div class="widget"><ul><li>Archives</li></ul></div>`);
    expect(r?.sections).toEqual([{ name: 'Sauce', lines: ['2 tomates'] }]);
    expect(r?.steps).toEqual(['Couper les tomates.', 'Cuire 10 min.']);
  });

  it('keeps a page-wide form wrapping the whole content', () => {
    const r = parse(`
      <form id="aspnetForm">
        <h2>Ingrédients</h2><ul><li>1 poulet</li></ul>
        <h2>Préparation</h2><ol><li>Rôtir 1 h.</li></ol>
      </form>`);
    expect(r?.sections[0]?.lines).toEqual(['1 poulet']);
    expect(r?.steps).toEqual(['Rôtir 1 h.']);
  });
});

describe('extractJsonLd — durations and instructions', () => {
  const page = (recipe: Record<string, unknown>) =>
    parseRecipeHtml(
      `<html><head><script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Soupe',
        recipeIngredient: ['2 carottes'],
        ...recipe,
      })}</script></head><body></body></html>`,
      'https://example.com/soupe',
    );

  it('reads long ISO forms, text durations and a lone total time', () => {
    expect(page({ prepTime: 'P0Y0M0DT0H20M0.000S', cookTime: 'PT1H' })).toMatchObject({
      prepMinutes: 20,
      cookMinutes: 60,
    });
    expect(page({ prepTime: '20 min', cookTime: '1 h 10' })).toMatchObject({
      prepMinutes: 20,
      cookMinutes: 70,
    });
    expect(page({ totalTime: 'PT45M' })).toMatchObject({ prepMinutes: 45, cookMinutes: null });
  });

  it('splits HTML instructions written on a single line', () => {
    expect(page({ recipeInstructions: '<p>Éplucher.</p><p>Cuire 20 min.</p>' })?.steps).toEqual([
      'Éplucher.',
      'Cuire 20 min.',
    ]);
    expect(page({ recipeInstructions: 'Éplucher.<br>Couper.<br/>Cuire.' })?.steps).toEqual([
      'Éplucher.',
      'Couper.',
      'Cuire.',
    ]);
    expect(page({ recipeInstructions: '<ol><li>Éplucher.</li><li>Cuire.</li></ol>' })?.steps).toEqual([
      'Éplucher.',
      'Cuire.',
    ]);
    expect(
      page({ recipeInstructions: '&lt;p&gt;Éplucher.&lt;/p&gt;&lt;p&gt;Cuire.&lt;/p&gt;' })?.steps,
    ).toEqual(['Éplucher.', 'Cuire.']);
    // One HowToStep stays one step.
    expect(
      page({ recipeInstructions: [{ '@type': 'HowToStep', text: '<p>Éplucher.</p><p>Puis couper.</p>' }] })
        ?.steps,
    ).toEqual(['Éplucher. Puis couper.']);
  });
});
