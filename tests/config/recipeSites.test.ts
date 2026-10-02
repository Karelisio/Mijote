import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE, RECIPE_SITES, siteHost } from '@/config/recipeSites';

describe('recipe sites', () => {
  it('opens Marmiton by default with an encoded search', () => {
    expect(DEFAULT_SITE.id).toBe('marmiton');
    expect(DEFAULT_SITE.search?.('tarte aux pommes & crème')).toBe(
      'https://www.marmiton.org/recettes/recherche.aspx?aqt=tarte%20aux%20pommes%20%26%20cr%C3%A8me',
    );
  });

  it('only lists https sites with unique ids', () => {
    expect(new Set(RECIPE_SITES.map((s) => s.id)).size).toBe(RECIPE_SITES.length);
    for (const s of RECIPE_SITES) expect(s.home.startsWith('https://')).toBe(true);
    expect(siteHost(DEFAULT_SITE)).toBe('marmiton.org');
  });
});
