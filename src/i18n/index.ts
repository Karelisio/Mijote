import { useCallback } from 'react';
import { useSettings, type LanguagePref } from '@/store/settings';
import { fr } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';
type Plural = { one: string; other: string; zero?: string };
type Leaf = string | Plural;
type Tree = { [k: string]: Leaf | Tree };

export type Dict = DeepWiden<typeof fr>;
type DeepWiden<T> = T extends string ? string : { [K in keyof T]: DeepWiden<T[K]> };

type Paths<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type TKey = Paths<Dict>;
export type TVars = Record<string, string | number>;

const DICTS: Record<Lang, Tree> = { fr, en };

export function resolveLang(pref: LanguagePref): Lang {
  if (pref !== 'system') return pref;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : nav.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

function lookup(tree: Tree, key: string): Leaf | undefined {
  let node: Leaf | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = (node as Tree)[part];
  }
  return node as Leaf | undefined;
}

export function translate(lang: Lang, key: TKey, vars?: TVars): string {
  let leaf = lookup(DICTS[lang], key) ?? lookup(DICTS.fr, key);
  if (leaf === undefined) return key;
  if (typeof leaf !== 'string') {
    const n = Number(vars?.count ?? 0);
    leaf =
      n === 0 && leaf.zero !== undefined
        ? leaf.zero
        : n === 1 || (lang === 'fr' && n < 2)
          ? leaf.one
          : leaf.other;
  }
  return vars ? leaf.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : leaf;
}

export function currentLang(): Lang {
  return resolveLang(useSettings.getState().language);
}

/** Non-hook translate using the current language (for services). */
export function t(key: TKey, vars?: TVars): string {
  return translate(currentLang(), key, vars);
}

export function useLang(): Lang {
  return resolveLang(useSettings((s) => s.language));
}

export function useT(): (key: TKey, vars?: TVars) => string {
  const lang = useLang();
  return useCallback((key: TKey, vars?: TVars) => translate(lang, key, vars), [lang]);
}
