import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/ui/Icon';
import { formatClock } from '@/features/recipes/timerDetect';
import { remainingMs, useTimers } from './timers';
import { useNow } from './useTimerTicker';

/** Floating reminder of running timers when outside cooking mode. */
export function ActiveTimersPill({ aboveNav }: { aboveNav: boolean }) {
  const timers = useTimers((s) => s.timers);
  const navigate = useNavigate();
  const now = useNow(500, timers.length > 0);
  const next = [...timers].sort((a, b) => remainingMs(a, now) - remainingMs(b, now))[0];
  return (
    <AnimatePresence>
      {next && (
        <motion.button
          type="button"
          className={`timers-pill ripple${aboveNav ? ' above-nav' : ''}${next.done ? ' done' : ''}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          onClick={() => next.recipeId && navigate(`/recipes/${next.recipeId}/cook`)}
        >
          <Icon name="timer" size={20} fill={next.done} />
          <span className="timers-pill-time">
            {next.done ? '0:00' : formatClock(remainingMs(next, now) / 1000)}
          </span>
          <span className="ellipsis" style={{ maxWidth: 160 }}>
            {next.recipeTitle || next.label}
          </span>
          {timers.length > 1 && <span className="timers-pill-count">+{timers.length - 1}</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
