import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/ui/Screen';
import { Button, IconButton } from '@/ui/Button';
import { Fab } from '@/ui/Fab';
import { Chip } from '@/ui/Chip';
import { OverflowMenu } from '@/ui/Menu';
import { SwipeToDelete } from '@/ui/SwipeToDelete';
import { RecipeImage } from '@/ui/RecipeImage';
import { EmptyState } from '@/ui/EmptyState';
import { useLang, useT } from '@/i18n';
import type { MealPlanEntry, MealSlot, Recipe } from '@/db/types';
import { listMeals, removeMeal, restoreMeal } from '@/db/repos/planner';
import { getRecipe } from '@/db/repos/recipes';
import { db, useRecipes } from '@/store/recipes';
import { snackbar } from '@/store/snackbar';
import { addDays, formatDay, startOfWeek, toISODate, weekDays } from '@/lib/dates';
import { recipeToDrafts } from '@/features/recipes/actions';
import { useShopping } from '@/features/shopping/store';
import { sendToMago } from '@/features/mago/sendToMago';
import type { ShoppingDraft } from '@/features/shopping/merge';
import { AddMealSheet } from './AddMealSheet';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

let rememberedWeek: Date | null = null;

export default function PlannerPage() {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const summaries = useRecipes((s) => s.summaries);
  const [monday, setMonday] = useState(() => rememberedWeek ?? startOfWeek(new Date()));
  const [meals, setMeals] = useState<MealPlanEntry[]>([]);
  const [addFor, setAddFor] = useState<{ date: string; slot: MealSlot } | null>(null);
  const days = useMemo(() => weekDays(monday), [monday]);
  const today = toISODate(new Date());
  const isCurrentWeek = days.includes(today);

  const load = useCallback(async () => {
    setMeals(await listMeals(await db(), days[0]!, days[6]!));
  }, [days]);

  useEffect(() => {
    rememberedWeek = monday;
    void load();
  }, [monday, load, summaries]);

  const byId = useMemo(() => new Map(summaries.map((s) => [s.id, s])), [summaries]);

  const remove = async (m: MealPlanEntry) => {
    const d = await db();
    await removeMeal(d, m.id);
    setMeals((x) => x.filter((e) => e.id !== m.id));
    snackbar(t('planner.removed'), {
      actionLabel: t('common.undo'),
      onAction: () => void restoreMeal(d, m).then(load),
    });
  };

  const weekDrafts = async (): Promise<ShoppingDraft[]> => {
    const d = await db();
    const cache = new Map<string, Recipe | null>();
    const drafts: ShoppingDraft[] = [];
    for (const m of meals) {
      if (!m.recipeId) continue;
      if (!cache.has(m.recipeId)) cache.set(m.recipeId, await getRecipe(d, m.recipeId));
      const r = cache.get(m.recipeId);
      if (r) drafts.push(...recipeToDrafts(r, m.servings ?? r.servings));
    }
    return drafts;
  };

  const generate = async () => {
    const n = await useShopping.getState().addDrafts(await weekDrafts());
    snackbar(t('planner.generated', { count: n }), {
      actionLabel: n ? t('nav.shopping') : undefined,
      onAction: () => navigate('/shopping'),
    });
  };

  const weekLabel = isCurrentWeek
    ? t('planner.thisWeek')
    : t('planner.weekOf', { date: formatDay(days[0]!, lang, { day: 'numeric', month: 'long' }) });

  return (
    <Screen
      title={t('planner.title')}
      large
      withNav
      scrollKey="planner"
      actions={
        <OverflowMenu
          label={t('common.more')}
          items={[
            {
              label: t('planner.sendToMago'),
              icon: 'send',
              onSelect: () => void weekDrafts().then((d) => sendToMago(d, t('mago.weekList'))),
            },
          ]}
        />
      }
      fab={(extended) =>
        meals.some((m) => m.recipeId) ? (
          <Fab
            icon="shopping_cart"
            label={t('planner.generateList')}
            extended={extended}
            onClick={() => void generate()}
          />
        ) : null
      }
    >
      <div className="week-nav">
        <IconButton
          icon="chevron_left"
          label={t('common.previous')}
          onClick={() => setMonday(addDays(monday, -7))}
        />
        <motion.div
          key={days[0]}
          className="week-label title-medium"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {weekLabel}
        </motion.div>
        <IconButton
          icon="chevron_right"
          label={t('common.next')}
          onClick={() => setMonday(addDays(monday, 7))}
        />
      </div>
      {!isCurrentWeek && (
        <div className="center" style={{ marginBottom: 8 }}>
          <Chip
            label={t('planner.thisWeek')}
            icon="event"
            onClick={() => setMonday(startOfWeek(new Date()))}
          />
        </div>
      )}

      {meals.length === 0 && (
        <EmptyState
          compact
          illustration="calendar"
          title={t('planner.emptyWeekTitle')}
          body={t('planner.emptyWeekBody')}
        />
      )}

      <div className="week">
        {days.map((day, di) => {
          const dayMeals = meals.filter((m) => m.date === day);
          return (
            <motion.section
              key={day}
              className={`day-card${day === today ? ' today' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: di * 0.03, duration: 0.25 }}
            >
              <header className="day-head">
                <div>
                  <div className="day-name">{formatDay(day, lang, { weekday: 'long' })}</div>
                  <div className="label-medium muted">
                    {formatDay(day, lang, { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <IconButton
                  icon="add"
                  label={t('planner.addMeal')}
                  variant="tonal"
                  small
                  onClick={() => setAddFor({ date: day, slot: dayMeals.length ? 'dinner' : 'lunch' })}
                />
              </header>
              {dayMeals.length === 0 ? (
                <div className="body-small muted day-empty">{t('planner.nothing')}</div>
              ) : (
                <AnimatePresence initial={false}>
                  {SLOTS.flatMap((slot) =>
                    dayMeals
                      .filter((m) => m.slot === slot)
                      .map((m) => {
                        const r = m.recipeId ? byId.get(m.recipeId) : undefined;
                        return (
                          <SwipeToDelete
                            key={m.id}
                            label={t('common.delete')}
                            onDelete={() => void remove(m)}
                          >
                            <div
                              className="meal ripple"
                              role={r ? 'button' : undefined}
                              onClick={() => r && navigate(`/recipes/${r.id}`)}
                            >
                              {r ? (
                                <RecipeImage
                                  path={r.photo}
                                  category={r.category}
                                  alt=""
                                  iconSize={20}
                                  className="meal-thumb"
                                />
                              ) : (
                                <span className="meal-thumb meal-free">✎</span>
                              )}
                              <div className="grow" style={{ minWidth: 0 }}>
                                <div className="label-small primary-text">{t(`slot.${slot}`)}</div>
                                <div className="body-large ellipsis">{r?.title ?? m.text}</div>
                              </div>
                              {m.servings && <span className="label-medium muted">×{m.servings}</span>}
                            </div>
                          </SwipeToDelete>
                        );
                      }),
                  )}
                </AnimatePresence>
              )}
            </motion.section>
          );
        })}
      </div>
      {meals.length > 0 && (
        <div className="center" style={{ padding: 16 }}>
          <Button
            variant="tonal"
            icon="send"
            onClick={() => void weekDrafts().then((d) => sendToMago(d, t('mago.weekList')))}
          >
            {t('planner.sendToMago')}
          </Button>
        </div>
      )}
      <AddMealSheet target={addFor} onClose={() => setAddFor(null)} onAdded={() => void load()} />
    </Screen>
  );
}
