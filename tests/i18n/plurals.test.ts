import { describe, expect, it } from 'vitest';
import { translate } from '@/i18n';

describe('plural messages', () => {
  it('says when nothing was added to the shopping list', () => {
    expect(translate('fr', 'recipe.addedToShopping', { count: 0 })).toBe(
      'Rien de nouveau à ajouter aux courses',
    );
    expect(translate('fr', 'recipe.addedToShopping', { count: 1 })).toBe('1 article ajouté aux courses');
    expect(translate('fr', 'recipe.addedToShopping', { count: 3 })).toBe('3 articles ajoutés aux courses');
    expect(translate('en', 'recipe.addedToShopping', { count: 0 })).toBe(
      'Nothing new to add to the shopping list',
    );
    expect(translate('en', 'recipe.addedToShopping', { count: 1 })).toBe('1 item added to shopping list');
    expect(translate('en', 'recipe.addedToShopping', { count: 2 })).toBe('2 items added to shopping list');
  });

  it('agrees "personne(s)" and "ingrédient(s)" with the number', () => {
    expect(translate('fr', 'share.servings', { count: 1 })).toBe('Pour 1 personne');
    expect(translate('fr', 'share.servings', { count: 4 })).toBe('Pour 4 personnes');
    expect(translate('en', 'share.servings', { count: 1 })).toBe('Serves 1');
    expect(translate('fr', 'cookWith.matches', { have: 1, count: 1 })).toBe('1/1 ingrédient');
    expect(translate('fr', 'cookWith.matches', { have: 2, count: 3 })).toBe('2/3 ingrédients');
    expect(translate('en', 'cookWith.matches', { have: 0, count: 1 })).toBe('0/1 ingredient');
  });

  it('never prints a fixed "1" for another number', () => {
    expect(translate('fr', 'shopping.cleared', { count: 0 })).toBe('0 article retiré');
    expect(translate('en', 'shopping.cleared', { count: 0 })).toBe('0 items removed');
    expect(translate('fr', 'shopping.remaining', { count: 1 })).toBe('1 article restant');
    expect(translate('fr', 'planner.generated', { count: 0 })).toBe('Aucun ingrédient à ajouter');
  });
});
