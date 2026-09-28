import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/ui/Icon';
import { detectTimers } from './timerDetect';

/** Renders a step with its detected durations as tappable timer chips. */
export function StepText({
  text,
  onTimer,
}: {
  text: string;
  onTimer: (seconds: number, label: string) => void;
}) {
  const timers = detectTimers(text);
  if (!timers.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  timers.forEach((tm, i) => {
    parts.push(<Fragment key={`t${i}`}>{text.slice(pos, tm.start)}</Fragment>);
    parts.push(
      <motion.button
        key={`b${i}`}
        type="button"
        className="timer-chip ripple"
        whileTap={{ scale: 0.92 }}
        onClick={(e) => {
          e.stopPropagation();
          onTimer(tm.seconds, tm.label);
        }}
      >
        <Icon name="timer" size={16} />
        {tm.label}
      </motion.button>,
    );
    pos = tm.end;
  });
  parts.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{parts}</>;
}
