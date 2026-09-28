import { useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Icon } from './Icon';

interface Props {
  onDelete: () => void;
  children: ReactNode;
  label: string;
}

/** Horizontal swipe (either direction) past 40% of the width deletes the row. */
export function SwipeToDelete({ onDelete, children, label }: Props) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const iconScale = useTransform(x, [-120, -40, 0, 40, 120], [1.15, 0.8, 0.6, 0.8, 1.15]);
  return (
    <motion.div className="swipe" layout exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}>
      <div className="swipe-bg" aria-hidden="true">
        <motion.span style={{ scale: iconScale, display: 'inline-flex' }}>
          <Icon name="delete" />
        </motion.span>
        <motion.span style={{ scale: iconScale, display: 'inline-flex' }}>
          <Icon name="delete" />
        </motion.span>
      </div>
      <motion.div
        className="swipe-fg"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragElastic={0.9}
        dragConstraints={{ left: 0, right: 0 }}
        aria-label={label}
        onDragStart={() => {
          dragged.current = true;
        }}
        onClickCapture={(e) => {
          // A swipe must not also open the row.
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onPointerDown={() => {
          dragged.current = false;
        }}
        onDragEnd={(e, info) => {
          const width = (e.target as HTMLElement | null)?.closest('.swipe')?.clientWidth ?? 360;
          if (Math.abs(info.offset.x) > width * 0.4 || Math.abs(info.velocity.x) > 800) {
            void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
            void animate(x, Math.sign(info.offset.x || 1) * width, { duration: 0.18 }).then(onDelete);
          }
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
