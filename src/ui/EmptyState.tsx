import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Illustration, type IllustrationName } from './Illustrations';

interface Props {
  illustration: IllustrationName;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ illustration, title, body, action, compact }: Props) {
  return (
    <motion.div
      className={`empty${compact ? ' compact' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
    >
      <motion.div
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
      >
        <Illustration name={illustration} />
      </motion.div>
      <div className="empty-text">
        <h2 className="empty-title">{title}</h2>
        {body && <p className="empty-body">{body}</p>}
        {action}
      </div>
    </motion.div>
  );
}
