import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Segmented, Stepper } from '@/ui/Controls';
import { Icon } from '@/ui/Icon';
import { RecipeImage } from '@/ui/RecipeImage';
import { TextField } from '@/ui/TextField';
import { useT } from '@/i18n';
import type { MealSlot } from '@/db/types';
import { addMeal } from '@/db/repos/planner';
import { db, useRecipes } from '@/store/recipes';
import { normalizeText } from '@/config/units';

export function AddMealSheet({
  target,
  onClose,
  onAdded,
}: {
  target: { date: string; slot: MealSlot } | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const summaries = useRecipes((s) => s.summaries);
  const [slot, setSlot] = useState<MealSlot>('dinner');
  const [query, setQuery] = useState('');
  const [free, setFree] = useState('');
  const [servings, setServings] = useState(2);

  useEffect(() => {
    if (!target) return;
    setSlot(target.slot);
    setQuery('');
    setFree('');
  }, [target]);

  const list = useMemo(() => {
    const q = normalizeText(query);
    const sorted = [...summaries].sort(
      (a, b) => Number(b.favorite) - Number(a.favorite) || (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0),
    );
    return q ? sorted.filter((r) => normalizeText(r.title).includes(q)) : sorted;
  }, [summaries, query]);

  const add = async (recipeId: string | null, text: string, n: number | null) => {
    if (!target) return;
    await addMeal(await db(), { date: target.date, slot, recipeId, text, servings: n });
    onClose();
    onAdded();
  };

  return (
    <BottomSheet open={!!target} onClose={onClose} title={t('planner.addMeal')}>
      <div className="pad col" style={{ gap: 12 }}>
        <Segmented<MealSlot>
          value={slot}
          onChange={setSlot}
          options={[
            { value: 'breakfast', label: t('slot.breakfast') },
            { value: 'lunch', label: t('slot.lunch') },
            { value: 'dinner', label: t('slot.dinner') },
          ]}
        />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="body-large">{t('planner.servings')}</span>
          <Stepper value={servings} onChange={setServings} />
        </div>
        <label className="searchbar" style={{ margin: 0 }}>
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('planner.pickRecipe')}
            aria-label={t('planner.pickRecipe')}
          />
        </label>
      </div>
      <div className="pick-list">
        {list.map((r) => (
          <button
            key={r.id}
            type="button"
            className="pick-item ripple"
            onClick={() => void add(r.id, '', servings)}
          >
            <RecipeImage path={r.photo} category={r.category} alt="" iconSize={20} className="meal-thumb" />
            <span className="grow ellipsis" style={{ textAlign: 'left' }}>
              {r.title}
            </span>
            {r.favorite && <Icon name="favorite" fill size={18} className="primary-text" />}
          </button>
        ))}
      </div>
      <form
        className="pad col"
        style={{ gap: 8, paddingTop: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (free.trim()) void add(null, free.trim(), null);
        }}
      >
        <div className="title-small muted">{t('planner.freeText')}</div>
        <div className="row">
          <TextField
            className="grow"
            value={free}
            onChange={setFree}
            placeholder={t('planner.freeTextPlaceholder')}
          />
          <Button type="submit" variant="tonal" disabled={!free.trim()}>
            {t('common.add')}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
