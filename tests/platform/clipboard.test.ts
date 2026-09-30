import { afterEach, describe, expect, it, vi } from 'vitest';

const read = vi.fn<() => Promise<{ value: string; type: string }>>();
let native = true;
vi.mock('@capacitor/clipboard', () => ({ Clipboard: { read: () => read() } }));
vi.mock('@/platform/native', () => ({ isNative: () => native }));

const { readClipboardText } = await import('@/platform/clipboard');

describe('readClipboardText', () => {
  afterEach(() => {
    read.mockReset();
    vi.unstubAllGlobals();
    native = true;
  });

  it('reads through the native plugin on Android', async () => {
    read.mockResolvedValue({ value: 'https://www.marmiton.org/x', type: 'text/plain' });
    expect(await readClipboardText()).toBe('https://www.marmiton.org/x');
  });

  it('tells an empty clipboard from an unreadable one', async () => {
    read.mockRejectedValue(new Error('There is no data on the clipboard'));
    expect(await readClipboardText()).toBe('');
    read.mockRejectedValue(new Error('Unable to read clipboard from the given Context'));
    expect(await readClipboardText()).toBeNull();
  });

  it('uses the web API off-device and reports a refusal', async () => {
    native = false;
    vi.stubGlobal('navigator', { clipboard: { readText: () => Promise.resolve('Soupe') } });
    expect(await readClipboardText()).toBe('Soupe');
    vi.stubGlobal('navigator', {
      clipboard: { readText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    });
    expect(await readClipboardText()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
