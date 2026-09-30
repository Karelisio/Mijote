import { describe, expect, it } from 'vitest';
import { ORPHAN_GRACE_MS, selectOrphanImages } from '@/platform/images';

const NOW = Date.UTC(2026, 8, 30, 12);
const HOUR = 3600 * 1000;

describe('selectOrphanImages', () => {
  it('deletes old images that no recipe references', () => {
    const images = [
      { path: 'images/old.jpg', mtime: NOW - 3 * ORPHAN_GRACE_MS },
      { path: 'images/used.jpg', mtime: NOW - 3 * ORPHAN_GRACE_MS },
    ];
    expect(selectOrphanImages(images, ['images/used.jpg'], NOW)).toEqual(['images/old.jpg']);
  });

  it('keeps recent photos still waiting for their recipe to be saved', () => {
    const images = [
      { path: 'images/just-imported.jpg', mtime: NOW - 5000 },
      { path: 'images/picked-yesterday.jpg', mtime: NOW - 23 * HOUR },
    ];
    expect(selectOrphanImages(images, [], NOW)).toEqual([]);
  });

  it('uses a 24 h grace period', () => {
    expect(ORPHAN_GRACE_MS).toBe(24 * HOUR);
    const at = (mtime: number) => selectOrphanImages([{ path: 'images/a.jpg', mtime }], [], NOW);
    expect(at(NOW - 24 * HOUR)).toEqual([]);
    expect(at(NOW - 24 * HOUR - 1)).toEqual(['images/a.jpg']);
  });

  it('keeps files whose modification time is unknown or in the future', () => {
    const images = [
      { path: 'images/no-mtime.jpg', mtime: 0 },
      { path: 'images/clock-changed.jpg', mtime: NOW + HOUR },
    ];
    expect(selectOrphanImages(images, [], NOW)).toEqual([]);
  });
});
