import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useBackHandler } from '@/platform/backStack';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { TextField } from './TextField';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  children?: ReactNode;
  actions: ReactNode;
}

export function Dialog({ open, onClose, title, icon, children, actions }: Props) {
  useBackHandler(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="dialog-wrap">
            <motion.div
              className="dialog"
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            >
              {icon && (
                <div className="dialog-icon">
                  <Icon name={icon} />
                </div>
              )}
              <h2 className="dialog-title" style={icon ? { textAlign: 'center' } : undefined}>
                {title}
              </h2>
              {children && <div className="dialog-body">{children}</div>}
              <div className="dialog-actions">{actions}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  icon?: IconName;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog(p: ConfirmProps) {
  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      title={p.title}
      icon={p.icon}
      actions={
        <>
          <Button variant="text" onClick={p.onClose}>
            {p.cancelLabel}
          </Button>
          <Button
            variant="text"
            danger={p.danger}
            onClick={() => {
              p.onClose();
              p.onConfirm();
            }}
          >
            {p.confirmLabel}
          </Button>
        </>
      }
    >
      {p.body}
    </Dialog>
  );
}

interface PromptProps {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  /** Helper text under the field. */
  supporting?: string;
  /** An empty value is a valid answer (e.g. clearing an optional setting). */
  allowEmpty?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function PromptDialog(p: PromptProps) {
  const [value, setValue] = useState(p.initial ?? '');
  useEffect(() => {
    if (p.open) setValue(p.initial ?? '');
  }, [p.open, p.initial]);
  const canSubmit = p.allowEmpty || !!value.trim();
  const submit = () => {
    if (!canSubmit) return;
    p.onClose();
    p.onSubmit(value.trim());
  };
  return (
    <Dialog
      open={p.open}
      onClose={p.onClose}
      title={p.title}
      actions={
        <>
          <Button variant="text" onClick={p.onClose}>
            {p.cancelLabel}
          </Button>
          <Button variant="text" onClick={submit} disabled={!canSubmit}>
            {p.confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField label={p.label} value={value} onChange={setValue} supporting={p.supporting} autoFocus />
      </form>
    </Dialog>
  );
}
