import { describe, expect, it, vi } from 'vitest';
import { guardExternalNavigation, setExternalNavBlocker } from '@/app/navGuard';

describe('guardExternalNavigation', () => {
  it('navigates at once without unsaved changes', () => {
    const go = vi.fn();
    guardExternalNavigation(go);
    expect(go).toHaveBeenCalledOnce();
  });

  it('lets a screen with unsaved changes ask first', () => {
    let pending: (() => void) | null = null;
    const remove = setExternalNavBlocker((proceed) => {
      pending = proceed;
    });
    const go = vi.fn();
    guardExternalNavigation(go);
    expect(go).not.toHaveBeenCalled();
    pending!();
    expect(go).toHaveBeenCalledOnce();
    remove();
    guardExternalNavigation(go);
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('keeps the latest screen registered when an older one goes away', () => {
    const first = setExternalNavBlocker(() => undefined);
    const ask = vi.fn();
    setExternalNavBlocker(ask);
    first();
    guardExternalNavigation(() => undefined);
    expect(ask).toHaveBeenCalledOnce();
  });
});
