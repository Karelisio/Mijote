import { describe, expect, it, vi } from 'vitest';

/** Fresh module for each test: the "launch URL handled" flag lives for the whole process. */
async function freshTakeLaunchPath() {
  vi.resetModules();
  return (await import('@/app/deepLink')).takeLaunchPath;
}

describe('takeLaunchPath', () => {
  it('handles a shortcut launch URL only once', async () => {
    const takeLaunchPath = await freshTakeLaunchPath();
    const getLaunchUrl = vi.fn(() => Promise.resolve({ url: 'mijote://shopping' }));
    expect(await takeLaunchPath(getLaunchUrl)).toBe('/shopping');
    // Capacitor keeps returning the launch URL: later navigations must not go back to it.
    expect(await takeLaunchPath(getLaunchUrl)).toBeNull();
    expect(await takeLaunchPath(getLaunchUrl)).toBeNull();
    expect(getLaunchUrl).toHaveBeenCalledTimes(1);
  });

  it('navigates once when effects run twice concurrently (StrictMode)', async () => {
    const takeLaunchPath = await freshTakeLaunchPath();
    const getLaunchUrl = vi.fn(() => Promise.resolve({ url: 'mijote://recipes/new' }));
    const results = await Promise.all([takeLaunchPath(getLaunchUrl), takeLaunchPath(getLaunchUrl)]);
    expect(results).toEqual(['/recipes/new', null]);
  });

  it('returns null for a plain launch', async () => {
    const takeLaunchPath = await freshTakeLaunchPath();
    const getLaunchUrl = vi.fn(() => Promise.resolve(undefined));
    expect(await takeLaunchPath(getLaunchUrl)).toBeNull();
    expect(await takeLaunchPath(getLaunchUrl)).toBeNull();
    expect(getLaunchUrl).toHaveBeenCalledTimes(1);
  });
});
