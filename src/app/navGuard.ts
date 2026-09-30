/**
 * Navigations the user did not start from the current screen (a share or a deep link received
 * while Mijote is open) go through here, so a screen with unsaved changes can ask first.
 */
type Blocker = (proceed: () => void) => void;

let blocker: Blocker | null = null;

/** Registers the confirmation of a screen with unsaved changes; returns its removal. */
export function setExternalNavBlocker(b: Blocker): () => void {
  blocker = b;
  return () => {
    if (blocker === b) blocker = null;
  };
}

/** Runs `go` now, or once the user agreed to leave a screen with unsaved changes. */
export function guardExternalNavigation(go: () => void): void {
  if (blocker) blocker(go);
  else go();
}
