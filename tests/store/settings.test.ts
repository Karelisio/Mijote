import { afterEach, describe, expect, it, vi } from 'vitest';

/** Loads a fresh settings store whose persisted value comes from `get`. */
async function loadSettings(get: () => Promise<{ value: string | null }>) {
  vi.resetModules();
  vi.doMock('@capacitor/preferences', () => ({
    Preferences: { get, set: () => Promise.resolve(), remove: () => Promise.resolve() },
  }));
  return import('@/store/settings');
}

describe('settingsHydrated', () => {
  afterEach(() => {
    vi.doUnmock('@capacitor/preferences');
    vi.restoreAllMocks();
  });

  it('loads the stored settings', async () => {
    const { settingsHydrated, useSettings } = await loadSettings(() =>
      Promise.resolve({ value: JSON.stringify({ state: { theme: 'dark' }, version: 1 }) }),
    );
    await settingsHydrated(60_000);
    expect(useSettings.getState().theme).toBe('dark');
  });

  it('resolves with the defaults when the storage cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { settingsHydrated, useSettings } = await loadSettings(() =>
      Promise.reject(new Error('storage unavailable')),
    );
    // A long timeout: resolving must come from the failed hydration, not from the timer.
    await settingsHydrated(60_000);
    expect(useSettings.getState().theme).toBe('system');
  });

  it('resolves with the defaults when the stored value is not JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { settingsHydrated, useSettings } = await loadSettings(() => Promise.resolve({ value: '{"sta' }));
    await settingsHydrated(60_000);
    expect(useSettings.getState().language).toBe('system');
  });

  it('stops waiting after the timeout when the storage never answers', async () => {
    const { settingsHydrated } = await loadSettings(() => new Promise(() => undefined));
    await expect(settingsHydrated(20)).resolves.toBeUndefined();
  });
});
