import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { RatingStars, Switch } from '@/ui/Controls';
import { useT } from '@/i18n';
import { CATEGORIES } from '@/db/types';
import { EMPTY_FILTERS, useRecipes, type RecipeFilters } from '@/store/recipes';
import { filterRecipes } from './filter';

const TIMES = [15, 30, 45, 60, 90];

export function FiltersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { filters, setFilters, summaries, scope, membership } = useRecipes();
  const [draft, setDraft] = useState<RecipeFilters>(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of summaries) for (const tag of r.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
  }, [summaries]);

  const preview = filterRecipes(summaries, { filters: draft, scope, membership, searchIds: null }).length;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('recipes.filters')}
      actions={
        <>
          <Button variant="text" onClick={() => setDraft(EMPTY_FILTERS)}>
            {t('common.reset')}
          </Button>
          <Button
            onClick={() => {
              setFilters(draft);
              onClose();
            }}
          >
            {t('recipes.showResults', { count: preview })}
          </Button>
        </>
      }
    >
      <div className="filter-block">
        <div className="title-small muted">{t('recipes.categories')}</div>
        <div className="chip-wrap">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(`category.${c}`)}
              selected={draft.categories.includes(c)}
              onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })}
            />
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="title-small muted">{t('recipes.maxTime')}</div>
        <div className="chip-wrap">
          <Chip
            label={t('recipes.anyTime')}
            selected={draft.maxMinutes === null}
            onClick={() => setDraft({ ...draft, maxMinutes: null })}
          />
          {TIMES.map((m) => (
            <Chip
              key={m}
              label={`≤ ${m} min`}
              selected={draft.maxMinutes === m}
              onClick={() => setDraft({ ...draft, maxMinutes: m })}
            />
          ))}
        </div>
      </div>
      {allTags.length > 0 && (
        <div className="filter-block">
          <div className="title-small muted">{t('recipes.tags')}</div>
          <div className="chip-wrap">
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={`#${tag}`}
                selected={draft.tags.includes(tag)}
                onClick={() => setDraft({ ...draft, tags: toggle(draft.tags, tag) })}
              />
            ))}
          </div>
        </div>
      )}
      <div className="filter-block">
        <div className="title-small muted">{t('recipes.minRating')}</div>
        <RatingStars
          value={draft.minRating}
          label={t('recipes.minRating')}
          size={28}
          onChange={(v) => setDraft({ ...draft, minRating: v })}
        />
      </div>
      <div className="filter-block row" style={{ justifyContent: 'space-between' }}>
        <span className="body-large">{t('recipes.favoritesOnly')}</span>
        <Switch
          checked={draft.favoritesOnly}
          label={t('recipes.favoritesOnly')}
          onChange={(v) => setDraft({ ...draft, favoritesOnly: v })}
        />
      </div>
    </BottomSheet>
  );
}
