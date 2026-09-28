import { create } from 'zustand';
import type { ImportedRecipe } from '@/db/types';

interface PendingImportState {
  /** Text shared from another app, waiting to be analysed. */
  shared: { text: string; subject: string } | null;
  /** Parsed recipe waiting for review. */
  draft: ImportedRecipe | null;
  setShared: (s: { text: string; subject: string } | null) => void;
  setDraft: (d: ImportedRecipe | null) => void;
}

export const usePendingImport = create<PendingImportState>((set) => ({
  shared: null,
  draft: null,
  setShared: (shared) => set({ shared }),
  setDraft: (draft) => set({ draft }),
}));
