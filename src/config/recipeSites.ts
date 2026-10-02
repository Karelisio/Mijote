/** Recipe websites offered in the in-app browser. Marmiton comes first and is the default. */
export interface RecipeSite {
  id: string;
  name: string;
  home: string;
  /** Search results URL for a query, when the site has a stable search page. */
  search?: (query: string) => string;
}

export const RECIPE_SITES: RecipeSite[] = [
  {
    id: 'marmiton',
    name: 'Marmiton',
    home: 'https://www.marmiton.org/',
    search: (q) => `https://www.marmiton.org/recettes/recherche.aspx?aqt=${encodeURIComponent(q)}`,
  },
  { id: '750g', name: '750g', home: 'https://www.750g.com/' },
  { id: 'cuisineaz', name: 'CuisineAZ', home: 'https://www.cuisineaz.com/' },
  { id: 'cuisineactuelle', name: 'Cuisine Actuelle', home: 'https://www.cuisineactuelle.fr/' },
  { id: 'jdf', name: 'Journal des Femmes Cuisine', home: 'https://cuisine.journaldesfemmes.fr/' },
  { id: 'ptitchef', name: 'Ptitchef', home: 'https://www.ptitchef.com/' },
];

export const DEFAULT_SITE = RECIPE_SITES[0]!;

export function siteHost(site: RecipeSite): string {
  return new URL(site.home).hostname.replace(/^www\./, '');
}
