import type { Category, Difficulty, ImportedRecipe, IngredientData, Recipe } from '@/db/types';
import { parseIngredientLine } from '@/import/ingredientParser';
import { newId } from '@/lib/id';
import type { Lang } from '@/i18n';
import { formatIngredientLine } from './format';

export interface EditIngredient {
  id: string;
  text: string;
  data: IngredientData;
}

export interface EditSection {
  id: string;
  name: string;
  items: EditIngredient[];
}

export interface EditState {
  title: string;
  photo: string | null;
  servings: number;
  prep: string;
  cook: string;
  difficulty: Difficulty | null;
  category: Category;
  tags: string;
  sourceUrl: string;
  notes: string;
  sections: EditSection[];
  steps: { id: string; text: string }[];
}

export function ingredientFromText(text: string, id = newId()): EditIngredient {
  return { id, text, data: parseIngredientLine(text) };
}

export function emptyState(): EditState {
  return {
    title: '',
    photo: null,
    servings: 4,
    prep: '',
    cook: '',
    difficulty: null,
    category: 'main',
    tags: '',
    sourceUrl: '',
    notes: '',
    sections: [{ id: newId(), name: '', items: [ingredientFromText('')] }],
    steps: [{ id: newId(), text: '' }],
  };
}

export function stateFromRecipe(r: Recipe, lang: Lang): EditState {
  return {
    title: r.title,
    photo: r.photo,
    servings: r.servings,
    prep: r.prepMinutes === null ? '' : String(r.prepMinutes),
    cook: r.cookMinutes === null ? '' : String(r.cookMinutes),
    difficulty: r.difficulty,
    category: r.category,
    tags: r.tags.join(', '),
    sourceUrl: r.sourceUrl ?? '',
    notes: r.notes,
    sections: r.sections.map((s) => ({
      id: s.id,
      name: s.name,
      items: s.items.map((i) => ({ id: i.id, text: formatIngredientLine(i, lang), data: i })),
    })),
    steps: r.steps.length ? r.steps.map((s) => ({ ...s })) : [{ id: newId(), text: '' }],
  };
}

export function stateFromImported(r: ImportedRecipe): EditState {
  const sections = r.sections.length ? r.sections : [{ name: '', lines: [] }];
  return {
    title: r.title,
    photo: null,
    servings: r.servings ?? 4,
    prep: r.prepMinutes === null ? '' : String(r.prepMinutes),
    cook: r.cookMinutes === null ? '' : String(r.cookMinutes),
    difficulty: null,
    category: r.category ?? 'main',
    tags: r.tags.join(', '),
    sourceUrl: r.sourceUrl ?? '',
    notes: r.notes,
    sections: sections.map((s) => ({
      id: newId(),
      name: s.name,
      items: s.lines.length ? s.lines.map((l) => ingredientFromText(l)) : [ingredientFromText('')],
    })),
    steps: r.steps.length ? r.steps.map((text) => ({ id: newId(), text })) : [{ id: newId(), text: '' }],
  };
}

const toMinutes = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function recipeFromState(s: EditState, base: Recipe | null): Recipe {
  const now = Date.now();
  return {
    id: base?.id ?? newId(),
    title: s.title.trim(),
    photo: s.photo,
    servings: Math.max(1, s.servings),
    prepMinutes: toMinutes(s.prep),
    cookMinutes: toMinutes(s.cook),
    difficulty: s.difficulty,
    category: s.category,
    tags: s.tags
      .split(/[,;#]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
    sourceUrl: s.sourceUrl.trim() || null,
    notes: s.notes.trim(),
    rating: base?.rating ?? 0,
    favorite: base?.favorite ?? false,
    cookedCount: base?.cookedCount ?? 0,
    lastCookedAt: base?.lastCookedAt ?? null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    sections: s.sections
      .map((sec) => ({
        id: sec.id,
        name: sec.name.trim(),
        items: sec.items.filter((i) => i.data.name.trim()).map((i) => ({ ...i.data, id: i.id })),
      }))
      .filter((sec, idx) => idx === 0 || sec.items.length > 0 || sec.name),
    steps: s.steps.filter((st) => st.text.trim()).map((st) => ({ id: st.id, text: st.text.trim() })),
  };
}
