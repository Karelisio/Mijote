import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  label: string;
  extended?: boolean;
  onClick: () => void;
  noNav?: boolean;
}

export function Fab({ icon, label, extended = true, onClick, noNav }: Props) {
  return (
    <motion.button
      type="button"
      className={`fab ripple${noNav ? ' no-nav' : ''}`}
      onClick={onClick}
      aria-label={label}
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
    >
      <motion.span layout="position" style={{ display: 'inline-flex' }}>
        <Icon name={icon} />
      </motion.span>
      <AnimatePresence initial={false}>
        {extended && (
          <motion.span
            className="fab-label"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
