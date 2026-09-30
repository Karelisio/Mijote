import type { DbDriver, Sql } from './driver';
import type { Category, Difficulty, IngredientData, Recipe } from './types';
import { saveRecipeTx } from './repos/recipes';
import { getMeta, setMeta } from './meta';
import { newId } from '@/lib/id';

type I = [quantity: number | null, unit: string, name: string, note?: string];

interface SeedRecipe {
  title: string;
  servings: number;
  prep: number;
  cook: number;
  difficulty: Difficulty;
  category: Category;
  tags: string[];
  notes: string;
  rating: number;
  favorite: boolean;
  sections: { name: string; items: I[] }[];
  steps: string[];
}

const FR: SeedRecipe[] = [
  {
    title: 'Crêpes de la Chandeleur',
    servings: 4,
    prep: 10,
    cook: 20,
    difficulty: 'easy',
    category: 'dessert',
    tags: ['classique', 'goûter', 'végétarien'],
    notes: 'Une cuillère de rhum ou de fleur d’oranger dans la pâte, et c’est encore meilleur.',
    rating: 5,
    favorite: true,
    sections: [
      {
        name: '',
        items: [
          [250, 'g', 'farine'],
          [4, '', 'œufs'],
          [50, 'cl', 'lait', 'demi-écrémé'],
          [50, 'g', 'beurre', 'fondu'],
          [1, 'tbsp', 'sucre'],
          [1, 'pinch', 'sel'],
        ],
      },
    ],
    steps: [
      'Dans un saladier, mélangez la farine, le sucre et le sel. Creusez un puits.',
      'Ajoutez les œufs puis versez le lait petit à petit en fouettant pour éviter les grumeaux.',
      'Incorporez le beurre fondu, puis laissez reposer la pâte 1 h à température ambiante.',
      'Faites chauffer une poêle légèrement beurrée. Versez une petite louche de pâte et faites cuire 1 à 2 min de chaque côté.',
    ],
  },
  {
    title: 'Quiche lorraine',
    servings: 6,
    prep: 25,
    cook: 35,
    difficulty: 'medium',
    category: 'main',
    tags: ['classique', 'four'],
    notes: '',
    rating: 4,
    favorite: false,
    sections: [
      {
        name: 'Pâte brisée',
        items: [
          [200, 'g', 'farine'],
          [100, 'g', 'beurre', 'froid, en dés'],
          [1, 'pinch', 'sel'],
          [5, 'cl', 'eau', 'froide'],
        ],
      },
      {
        name: 'Garniture',
        items: [
          [200, 'g', 'lardons fumés'],
          [3, '', 'œufs'],
          [20, 'cl', 'crème fraîche', 'épaisse'],
          [20, 'cl', 'lait'],
          [1, 'pinch', 'noix de muscade'],
          [null, '', 'poivre'],
        ],
      },
    ],
    steps: [
      'Sablez la farine, le sel et le beurre du bout des doigts, ajoutez l’eau et formez une boule. Réservez 30 min au frais.',
      'Préchauffez le four à 180 °C. Étalez la pâte dans un moule beurré et piquez le fond à la fourchette.',
      'Faites revenir les lardons 5 min à la poêle, puis égouttez-les sur du papier absorbant.',
      'Battez les œufs avec la crème, le lait, la muscade et le poivre. Répartissez les lardons sur la pâte et versez l’appareil.',
      'Enfournez et faites cuire 35 min, jusqu’à ce que la quiche soit bien dorée.',
    ],
  },
  {
    title: 'Curry de poulet au lait de coco',
    servings: 4,
    prep: 15,
    cook: 30,
    difficulty: 'easy',
    category: 'main',
    tags: ['épicé', 'rapide', 'riz'],
    notes: 'Se congèle très bien. Servir avec un riz basmati et un peu de coriandre fraîche.',
    rating: 0,
    favorite: false,
    sections: [
      {
        name: '',
        items: [
          [600, 'g', 'blancs de poulet', 'en morceaux'],
          [40, 'cl', 'lait de coco'],
          [1, '', 'oignon', 'émincé'],
          [2, 'clove', 'ail'],
          [1, 'tbsp', 'gingembre', 'râpé'],
          [2, 'tbsp', 'pâte de curry'],
          [1, 'tbsp', 'huile'],
          [300, 'g', 'riz basmati'],
          [1, 'bunch', 'coriandre'],
        ],
      },
    ],
    steps: [
      'Faites chauffer l’huile dans une cocotte et faites revenir l’oignon 5 min.',
      'Ajoutez l’ail, le gingembre et la pâte de curry, puis faites revenir 1 min en remuant.',
      'Ajoutez le poulet et faites-le dorer 5 min sur toutes les faces.',
      'Versez le lait de coco et laissez mijoter 20 min à feu doux. Pendant ce temps, faites cuire le riz 11 min.',
      'Parsemez de coriandre ciselée et servez bien chaud.',
    ],
  },
];

const EN: SeedRecipe[] = [
  {
    title: 'French crêpes',
    servings: 4,
    prep: 10,
    cook: 20,
    difficulty: 'easy',
    category: 'dessert',
    tags: ['classic', 'snack', 'vegetarian'],
    notes: 'A spoonful of rum or orange blossom water in the batter makes them even better.',
    rating: 5,
    favorite: true,
    sections: [
      {
        name: '',
        items: [
          [250, 'g', 'flour'],
          [4, '', 'eggs'],
          [500, 'ml', 'milk'],
          [50, 'g', 'butter', 'melted'],
          [1, 'tbsp', 'sugar'],
          [1, 'pinch', 'salt'],
        ],
      },
    ],
    steps: [
      'In a bowl, mix the flour, sugar and salt. Make a well in the centre.',
      'Add the eggs, then pour in the milk little by little while whisking to avoid lumps.',
      'Stir in the melted butter and let the batter rest for 1 h at room temperature.',
      'Heat a lightly buttered pan. Pour in a small ladle of batter and cook for 1 to 2 min on each side.',
    ],
  },
  {
    title: 'Quiche Lorraine',
    servings: 6,
    prep: 25,
    cook: 35,
    difficulty: 'medium',
    category: 'main',
    tags: ['classic', 'oven'],
    notes: '',
    rating: 4,
    favorite: false,
    sections: [
      {
        name: 'Shortcrust pastry',
        items: [
          [200, 'g', 'flour'],
          [100, 'g', 'butter', 'cold, diced'],
          [1, 'pinch', 'salt'],
          [50, 'ml', 'water', 'cold'],
        ],
      },
      {
        name: 'Filling',
        items: [
          [200, 'g', 'smoked bacon lardons'],
          [3, '', 'eggs'],
          [200, 'ml', 'crème fraîche'],
          [200, 'ml', 'milk'],
          [1, 'pinch', 'nutmeg'],
          [null, '', 'pepper'],
        ],
      },
    ],
    steps: [
      'Rub the flour, salt and butter together with your fingertips, add the water and form a ball. Chill for 30 min.',
      'Preheat the oven to 180 °C. Roll out the pastry into a buttered tin and prick the base with a fork.',
      'Fry the lardons for 5 min, then drain them on kitchen paper.',
      'Beat the eggs with the cream, milk, nutmeg and pepper. Spread the lardons over the pastry and pour in the filling.',
      'Bake for 35 min, until golden brown.',
    ],
  },
  {
    title: 'Coconut chicken curry',
    servings: 4,
    prep: 15,
    cook: 30,
    difficulty: 'easy',
    category: 'main',
    tags: ['spicy', 'quick', 'rice'],
    notes: 'Freezes very well. Serve with basmati rice and fresh coriander.',
    rating: 0,
    favorite: false,
    sections: [
      {
        name: '',
        items: [
          [600, 'g', 'chicken breasts', 'diced'],
          [400, 'ml', 'coconut milk'],
          [1, '', 'onion', 'sliced'],
          [2, 'clove', 'garlic'],
          [1, 'tbsp', 'ginger', 'grated'],
          [2, 'tbsp', 'curry paste'],
          [1, 'tbsp', 'oil'],
          [300, 'g', 'basmati rice'],
          [1, 'bunch', 'coriander'],
        ],
      },
    ],
    steps: [
      'Heat the oil in a casserole and cook the onion for 5 min.',
      'Add the garlic, ginger and curry paste and stir for 1 min.',
      'Add the chicken and brown it for 5 min on all sides.',
      'Pour in the coconut milk and simmer for 20 min over low heat. Meanwhile, cook the rice for 11 min.',
      'Sprinkle with chopped coriander and serve hot.',
    ],
  },
];

function toRecipe(s: SeedRecipe, now: number): Recipe {
  const item = ([quantity, unit, name, note]: I): IngredientData & { id: string } => ({
    id: newId(),
    quantity,
    quantityMax: null,
    unit,
    name,
    note: note ?? '',
  });
  return {
    id: newId(),
    title: s.title,
    photo: null,
    servings: s.servings,
    prepMinutes: s.prep,
    cookMinutes: s.cook,
    difficulty: s.difficulty,
    category: s.category,
    tags: s.tags,
    sourceUrl: null,
    notes: s.notes,
    rating: s.rating,
    favorite: s.favorite,
    cookedCount: 0,
    lastCookedAt: null,
    createdAt: now,
    updatedAt: now,
    sections: s.sections.map((sec) => ({ id: newId(), name: sec.name, items: sec.items.map(item) })),
    steps: s.steps.map((text) => ({ id: newId(), text })),
  };
}

export function sampleRecipes(lang: 'fr' | 'en', now = Date.now()): Recipe[] {
  return (lang === 'en' ? EN : FR).map((s, i) => toRecipe(s, now - i * 1000));
}

export async function seedSampleRecipesTx(
  tx: Sql,
  lang: 'fr' | 'en',
  photos: (string | null)[] = [],
): Promise<void> {
  const recipes = sampleRecipes(lang).map((r, i) => ({ ...r, photo: photos[i] ?? null }));
  for (const r of recipes) await saveRecipeTx(tx, r);
}

export function seedSampleRecipes(
  db: DbDriver,
  lang: 'fr' | 'en',
  photos: (string | null)[] = [],
): Promise<void> {
  return db.transaction((tx) => seedSampleRecipesTx(tx, lang, photos));
}

/**
 * First launch: the sample recipes and the "seeded" flag are written in one transaction, so an
 * interrupted seeding leaves neither and is simply retried, never duplicated.
 */
export function seedOnFirstLaunch(
  db: DbDriver,
  lang: 'fr' | 'en',
  photos: (string | null)[] = [],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    if ((await getMeta(tx, 'seeded')) !== null) return false;
    await seedSampleRecipesTx(tx, lang, photos);
    await setMeta(tx, 'seeded', String(Date.now()));
    return true;
  });
}
