import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SystemBars } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Button, IconButton } from '@/ui/Button';
import { Checkbox, Spinner } from '@/ui/Controls';
import { BottomSheet } from '@/ui/BottomSheet';
import { Icon } from '@/ui/Icon';
import { Illustration } from '@/ui/Illustrations';
import { useLang, useT } from '@/i18n';
import type { Recipe } from '@/db/types';
import { getRecipe } from '@/db/repos/recipes';
import { db } from '@/store/recipes';
import { useSettings } from '@/store/settings';
import { isNative } from '@/platform/native';
import { useBackHandler } from '@/platform/backStack';
import { StepText } from '@/features/recipes/StepText';
import { formatAmount } from '@/features/recipes/format';
import { scaleIngredient } from '@/features/recipes/portions';
import { formatClock } from '@/features/recipes/timerDetect';
import { markRecipeCooked } from '@/features/recipes/actions';
import { remainingMs, rescheduleRunningTimers, useTimers, type Timer } from './timers';
import { useNow } from './useTimerTicker';
import { useExactAlarmAccess } from './exactAlarm';

function useImmersive(keepOn: boolean) {
  useEffect(() => {
    if (!isNative()) return;
    void SystemBars.hide().catch(() => undefined);
    if (keepOn) void KeepAwake.keepAwake().catch(() => undefined);
    return () => {
      void SystemBars.show().catch(() => undefined);
      void KeepAwake.allowSleep().catch(() => undefined);
    };
  }, [keepOn]);
}

function TimerCard({ timer, now }: { timer: Timer; now: number }) {
  const t = useT();
  const { pause, resume, addTime, remove } = useTimers();
  const rem = remainingMs(timer, now);
  const progress = timer.durationSec > 0 ? 1 - rem / (timer.durationSec * 1000) : 1;
  return (
    <motion.div
      layout
      className={`cook-timer${timer.done ? ' done' : ''}${!timer.endAt && !timer.done ? ' paused' : ''}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <div
        className="cook-timer-progress"
        style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
      />
      <div className="cook-timer-row">
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="cook-timer-time">{timer.done ? '0:00' : formatClock(rem / 1000)}</div>
          <div className="label-medium ellipsis">{timer.label}</div>
        </div>
        {!timer.done &&
          (timer.endAt ? (
            <IconButton icon="pause" label="Pause" small onClick={() => pause(timer.id)} />
          ) : (
            <IconButton icon="play_arrow" label="Play" small onClick={() => resume(timer.id)} />
          ))}
        <button type="button" className="cook-timer-plus ripple" onClick={() => addTime(timer.id, 60)}>
          +1
        </button>
        <IconButton icon="close" label={t('common.close')} small onClick={() => remove(timer.id)} />
      </div>
    </motion.div>
  );
}

export default function CookingPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const keepOn = useSettings((s) => s.keepScreenOn);
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [counted, setCounted] = useState(false);
  const allTimers = useTimers((s) => s.timers);
  const startTimer = useTimers((s) => s.start);
  const timers = allTimers.filter((x) => x.recipeId === id);
  const now = useNow(250, timers.length > 0);
  const exactAlarm = useExactAlarmAccess(() => void rescheduleRunningTimers());

  useImmersive(keepOn);
  useBackHandler(true, () => navigate(-1));

  useEffect(() => {
    void db()
      .then((d) => getRecipe(d, id))
      .then(setRecipe);
  }, [id]);

  // Unknown recipe: leave (from an effect, never while rendering).
  useEffect(() => {
    if (recipe === null) navigate('/recipes', { replace: true });
  }, [recipe, navigate]);

  const servings = Number(params.get('servings')) || recipe?.servings || 1;
  const factor = recipe && recipe.servings > 0 ? servings / recipe.servings : 1;
  const steps = useMemo(() => recipe?.steps ?? [], [recipe]);
  const total = steps.length;
  const finished = index >= total;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total, next));
    if (clamped === index) return;
    setDir(clamped > index ? 1 : -1);
    setIndex(clamped);
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  };

  const onSwipe = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -500) go(index + 1);
    else if (info.offset.x > 60 || info.velocity.x > 500) go(index - 1);
  };

  if (recipe === undefined) {
    return (
      <div className="cook-screen center">
        <Spinner />
      </div>
    );
  }
  if (!recipe) return null;

  const toggleIngredient = (iid: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(iid)) n.delete(iid);
      else n.add(iid);
      return n;
    });
  const ingredientCount = recipe.sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="cook-screen">
      <header className="cook-top">
        <IconButton icon="close" label={t('cooking.exit')} onClick={() => navigate(-1)} />
        <div className="grow ellipsis title-medium">{recipe.title}</div>
        <button type="button" className="cook-ing-btn ripple" onClick={() => setIngredientsOpen(true)}>
          <Icon name="checklist" size={20} />
          {checked.size}/{ingredientCount}
        </button>
        <IconButton
          icon="timer"
          label={t('cooking.addTimer')}
          onClick={() =>
            void startTimer({
              label: t('cooking.customTimer'),
              recipeId: recipe.id,
              recipeTitle: recipe.title,
              durationSec: 300,
            })
          }
        />
      </header>

      <div className="cook-progress">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={t('recipe.step', { n: i + 1 })}
            className={`cook-progress-seg${i < index ? ' past' : ''}${i === index ? ' current' : ''}`}
            onClick={() => go(i)}
          />
        ))}
      </div>

      {exactAlarm.denied && timers.length > 0 && (
        <div className="cook-hint">
          <Icon name="notifications" size={20} />
          <span className="grow">{t('cooking.exactAlarmHint')}</span>
          <Button variant="text" onClick={exactAlarm.ask}>
            {t('cooking.allow')}
          </Button>
        </div>
      )}

      <div className="cook-stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            className="cook-step"
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 80, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -80, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            onDragEnd={onSwipe}
          >
            {total === 0 ? (
              <p className="cook-step-text">{t('cooking.noSteps')}</p>
            ) : finished ? (
              <div className="cook-finished">
                <Illustration name="pot" />
                <h2 className="headline-medium serif">{t('cooking.finishedTitle')}</h2>
                <p className="muted">{t('cooking.finishedBody')}</p>
                <Button
                  large
                  icon={counted ? 'check' : 'done_all'}
                  disabled={counted}
                  onClick={() => {
                    setCounted(true);
                    void markRecipeCooked(recipe.id);
                    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
                  }}
                >
                  {t('cooking.markCooked')}
                </Button>
              </div>
            ) : (
              <>
                <div className="cook-step-label">{t('cooking.stepOf', { n: index + 1, total })}</div>
                <p className="cook-step-text selectable">
                  <StepText
                    text={steps[index]!.text}
                    onTimer={(sec, label) =>
                      void startTimer({
                        label,
                        recipeId: recipe.id,
                        recipeTitle: recipe.title,
                        durationSec: sec,
                      })
                    }
                  />
                </p>
                {index === 0 && total > 1 && <p className="cook-swipe-hint">{t('cooking.swipeHint')}</p>}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="cook-timers">
        <AnimatePresence>
          {timers.map((x) => (
            <TimerCard key={x.id} timer={x} now={now} />
          ))}
        </AnimatePresence>
      </div>

      <footer className="cook-nav">
        <Button
          variant="tonal"
          large
          icon="chevron_left"
          onClick={() => go(index - 1)}
          disabled={index === 0}
        >
          {t('common.previous')}
        </Button>
        {finished ? (
          <Button large icon="check" onClick={() => navigate(-1)}>
            {t('common.done')}
          </Button>
        ) : (
          <Button large onClick={() => go(index + 1)}>
            {index === total - 1 ? t('common.done') : t('common.next')}
            <Icon name="chevron_right" />
          </Button>
        )}
      </footer>

      <BottomSheet
        open={ingredientsOpen}
        onClose={() => setIngredientsOpen(false)}
        title={t('cooking.ingredients')}
      >
        {recipe.sections.map((s) => (
          <div key={s.id}>
            {s.name && <div className="ingredient-section-name pad">{s.name}</div>}
            {s.items.map((i) => {
              const on = checked.has(i.id);
              const amount = formatAmount(scaleIngredient(i, factor), lang);
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  className={`cook-ing ripple${on ? ' on' : ''}`}
                  onClick={() => toggleIngredient(i.id)}
                >
                  <Checkbox checked={on} label={i.name} onChange={() => toggleIngredient(i.id)} />
                  <span className="cook-ing-amount">{amount}</span>
                  <span className="grow">{i.name}</span>
                </div>
              );
            })}
          </div>
        ))}
      </BottomSheet>
    </div>
  );
}
