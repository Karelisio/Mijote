import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useBackHandler } from '@/platform/backStack';
import { Icon, type IconName } from './Icon';
import { IconButton } from './Button';

export interface MenuEntry {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
  hidden?: boolean;
}

interface Props {
  items: MenuEntry[];
  label: string;
  icon?: IconName;
  trigger?: (open: () => void) => ReactNode;
}

export function OverflowMenu({ items, label, icon = 'more_vert', trigger }: Props) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  useBackHandler(open, () => setOpen(false));

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  return (
    <>
      <span ref={anchor} style={{ display: 'inline-flex' }}>
        {trigger ? (
          trigger(() => setOpen(true))
        ) : (
          <IconButton icon={icon} label={label} onClick={() => setOpen(true)} />
        )}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="scrim" style={{ background: 'transparent' }} onClick={() => setOpen(false)} />
              <motion.div
                className="menu"
                role="menu"
                style={{ top: pos.top, right: pos.right }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
              >
                {items
                  .filter((i) => !i.hidden)
                  .map((i) => (
                    <button
                      key={i.label}
                      type="button"
                      role="menuitem"
                      className={`menu-item ripple${i.danger ? ' danger' : ''}`}
                      onClick={() => {
                        setOpen(false);
                        i.onSelect();
                      }}
                    >
                      {i.icon && <Icon name={i.icon} />}
                      {i.label}
                    </button>
                  ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
