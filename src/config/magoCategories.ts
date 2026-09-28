import type { Aisle } from './aisles';

/**
 * Mijote aisle → Mago item category.
 *
 * Mago lets users manage their own item categories; its default set is
 * "Produits frais", "Laiterie", "Viande", "Pantry" and "Autres". Adjust the
 * right-hand values to match the category names used in your Mago lists —
 * Mago is expected to fall back to its default category for unknown names.
 */
export const MAGO_CATEGORY_BY_AISLE: Record<Aisle, string> = {
  produce: 'Produits frais',
  bakery: 'Produits frais',
  meat: 'Viande',
  fish: 'Viande',
  dairy: 'Laiterie',
  frozen: 'Autres',
  pantry: 'Pantry',
  spices: 'Pantry',
  drinks: 'Autres',
  household: 'Autres',
  other: 'Autres',
};

export const MAGO_DEFAULT_CATEGORY = 'Autres';

/** Deep link handled by Mago's intent-filter (scheme "mago", host "import"). */
export const MAGO_IMPORT_URL = 'mago://import';
export const MAGO_PACKAGE = 'com.karelisio.mago';
