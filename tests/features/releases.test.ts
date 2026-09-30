import { describe, expect, it } from 'vitest';
import { cleanNotes, compareVersions, parseRelease, parseVersion } from '@/features/update/releases';

describe('versions', () => {
  it('parses and compares semantic versions', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('1.0.0-beta')).toEqual([1, 0, 0]);
    expect(parseVersion('latest')).toBeNull();
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('v1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0);
    expect(compareVersions('0.9.0', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('nope', '1.0.0')).toBe(0);
  });
});

describe('parseRelease', () => {
  const payload = {
    tag_name: 'v1.1.0',
    html_url: 'https://github.com/Karelisio/Mijote/releases/tag/v1.1.0',
    body: '## Mijote v1.1.0\n\n- feat: in-app updates (abc1234)\n- fix: something (def5678)\n\n**APK** : …',
    draft: false,
    prerelease: false,
    assets: [
      { name: 'mijote-v1.1.0.aab', browser_download_url: 'https://github.com/x.aab', size: 10 },
      { name: 'mijote-v1.1.0.apk', browser_download_url: 'https://github.com/x.apk', size: 5_000_000 },
    ],
  };

  it('picks the APK asset and cleans the notes', () => {
    expect(parseRelease(payload)).toEqual({
      version: '1.1.0',
      tag: 'v1.1.0',
      notes: '- feat: in-app updates\n- fix: something',
      apkUrl: 'https://github.com/x.apk',
      apkSize: 5_000_000,
      htmlUrl: 'https://github.com/Karelisio/Mijote/releases/tag/v1.1.0',
    });
  });

  it('ignores drafts, prereleases, missing APKs and bad tags', () => {
    expect(parseRelease({ ...payload, prerelease: true })).toBeNull();
    expect(parseRelease({ ...payload, draft: true })).toBeNull();
    expect(parseRelease({ ...payload, assets: [payload.assets[0]] })).toBeNull();
    expect(parseRelease({ ...payload, tag_name: 'nightly' })).toBeNull();
    expect(
      parseRelease({
        ...payload,
        assets: [{ name: 'a.apk', browser_download_url: 'http://insecure/a.apk' }],
      }),
    ).toBeNull();
    expect(
      parseRelease({
        ...payload,
        assets: [{ name: 'a.apk', browser_download_url: 'https://github.com.evil.io/a.apk' }],
      }),
    ).toBeNull();
    expect(
      parseRelease({
        ...payload,
        assets: [{ name: 'a.apk', browser_download_url: 'https://evil.io/github.com/a.apk' }],
      }),
    ).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it('keeps at most 12 changelog lines', () => {
    const body = Array.from({ length: 20 }, (_, i) => `- change ${i}`).join('\n');
    expect(cleanNotes(body).split('\n')).toHaveLength(12);
  });
});
