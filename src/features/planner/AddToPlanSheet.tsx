import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Segmented, Stepper } from '@/ui/Controls';
import { useLang, useT } from '@/i18n';
import type { MealSlot, Recipe } from '@/db/types';
import { addMeal } from '@/db/repos/planner';
import { db } from '@/store/recipes';
import { snackbar } from '@/store/snackbar';
import { addDays, formatDay, toISODate } from '@/lib/dates';

/** Plan one recipe on a day/slot. */
export function AddToPlanSheet({
  open,
  onClose,
  recipe,
  servings,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Pick<Recipe, 'id' | 'title'>;
  servings: number;
}) {
  const t = useT();
  const lang = useLang();
  // "Today" and the proposed meal are computed when the sheet opens (the page may have been open
  // since yesterday).
  const [today, setToday] = useState(() => new Date());
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => toISODate(addDays(today, i))), [today]);
  const [date, setDate] = useState(days[0]!);
  const [slot, setSlot] = useState<MealSlot>(today.getHours() < 14 ? 'lunch' : 'dinner');
  const [n, setN] = useState(servings);
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setToday(now);
    setDate(toISODate(now));
    setSlot(now.getHours() < 14 ? 'lunch' : 'dinner');
    setN(servings);
  }, [open, servings]);

  const label = (iso: string, i: number) =>
    i === 0
      ? t('common.today')
      : i === 1
        ? t('common.tomorrow')
        : formatDay(iso, lang, { weekday: 'short', day: 'numeric' });

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('recipe.addToPlanner')}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            icon="event"
            onClick={() => {
              onClose();
              void db()
                .then((d) => addMeal(d, { date, slot, recipeId: recipe.id, text: '', servings: n }))
                .then(() =>
                  snackbar(
                    `${recipe.title} → ${formatDay(date, lang, { weekday: 'long', day: 'numeric' })}, ${t(`slot.${slot}`).toLowerCase()}`,
                  ),
                );
            }}
          >
            {t('common.add')}
          </Button>
        </>
      }
    >
      <div className="filter-block">
        <div className="title-small muted">{t('planner.date')}</div>
        <div className="chip-row" style={{ padding: 0 }}>
          {days.map((d, i) => (
            <Chip key={d} label={label(d, i)} selected={d === date} onClick={() => setDate(d)} />
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="title-small muted">{t('planner.slot')}</div>
        <Segmented<MealSlot>
          value={slot}
          onChange={setSlot}
          options={[
            { value: 'breakfast', label: t('slot.breakfast') },
            { value: 'lunch', label: t('slot.lunch') },
            { value: 'dinner', label: t('slot.dinner') },
          ]}
        />
      </div>
      <div className="filter-block row" style={{ justifyContent: 'space-between' }}>
        <span className="body-large">{t('planner.servings')}</span>
        <Stepper value={n} onChange={setN} labelMinus="-" labelPlus="+" />
      </div>
    </BottomSheet>
  );
}
