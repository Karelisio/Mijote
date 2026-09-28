import { create } from 'zustand';

export interface SnackbarMessage {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the snackbar is dismissed without the action being used. */
  onTimeout?: () => void;
  duration: number;
}

interface SnackbarState {
  current: SnackbarMessage | null;
  show: (m: Omit<SnackbarMessage, 'id' | 'duration'> & { duration?: number }) => void;
  dismiss: (viaAction?: boolean) => void;
}

let seq = 0;

export const useSnackbar = create<SnackbarState>((set, get) => ({
  current: null,
  show: (m) => {
    const prev = get().current;
    prev?.onTimeout?.();
    set({ current: { ...m, id: ++seq, duration: m.duration ?? (m.actionLabel ? 5000 : 3000) } });
  },
  dismiss: (viaAction = false) => {
    const cur = get().current;
    if (!cur) return;
    if (viaAction) cur.onAction?.();
    else cur.onTimeout?.();
    set({ current: null });
  },
}));

export const snackbar = (text: string, opts: Partial<Omit<SnackbarMessage, 'id' | 'text'>> = {}) =>
  useSnackbar.getState().show({ text, ...opts });
