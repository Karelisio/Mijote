import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSnackbar } from '@/store/snackbar';

export function SnackbarHost({ aboveNav }: { aboveNav: boolean }) {
  const current = useSnackbar((s) => s.current);
  const dismiss = useSnackbar((s) => s.dismiss);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismiss(false), current.duration);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  return (
    <div className={`snackbar-host${aboveNav ? ' above-nav' : ''}`} aria-live="polite">
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            className="snackbar"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 80) dismiss(false);
            }}
          >
            <span className="grow">{current.text}</span>
            {current.actionLabel && (
              <button type="button" className="btn btn-text ripple" onClick={() => dismiss(true)}>
                {current.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
