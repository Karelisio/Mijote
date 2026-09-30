// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  CapacitorHttp: { get: (opts: unknown) => get(opts) },
}));

const { fetchText } = await import('@/import/fetchPage');
const { importFromUrl, asHtml } = await import('@/import');

const RECIPE = {
  '@type': 'Recipe',
  name: 'Soupe',
  recipeIngredient: ['2 carottes'],
  recipeInstructions: 'Cuire.',
};

describe('fetchText on the device', () => {
  afterEach(() => get.mockReset());

  it('passes time limits to the native request', async () => {
    get.mockResolvedValue({ status: 200, data: '<html></html>', headers: {} });
    await fetchText('https://example.com/');
    expect(get.mock.calls[0]![0]).toMatchObject({ connectTimeout: 15_000, readTimeout: 20_000 });
  });

  it('keeps a JSON reply as JSON text', async () => {
    get.mockResolvedValue({ status: 200, data: RECIPE, headers: {} });
    expect(JSON.parse(await fetchText('https://api.example.com/r/1'))).toEqual(RECIPE);
  });

  it('reports a timeout and an abort', async () => {
    get.mockRejectedValue(new Error('SocketTimeoutException: timeout'));
    await expect(fetchText('https://slow.example.com/')).rejects.toThrow('timeout');
    get.mockReturnValue(new Promise(() => undefined));
    const ctrl = new AbortController();
    const p = fetchText('https://slow.example.com/', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('importFromUrl on the device', () => {
  afterEach(() => get.mockReset());
  const page = `<script type="application/ld+json">${JSON.stringify(RECIPE)}</script>`;

  it('tries https first for an http:// link', async () => {
    get.mockResolvedValue({ status: 200, data: page, headers: {} });
    const r = await importFromUrl('http://blog.example.com/soupe');
    expect(get.mock.calls[0]![0]).toMatchObject({ url: 'https://blog.example.com/soupe' });
    expect(r.sourceUrl).toBe('https://blog.example.com/soupe');
  });

  it('explains that a clear-text-only site cannot be loaded', async () => {
    get.mockRejectedValue(new Error('SSLHandshakeException'));
    await expect(importFromUrl('http://old.example.com/soupe')).rejects.toThrow('insecure_http');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reports an http error of the https site as is', async () => {
    get.mockResolvedValue({ status: 404, data: '', headers: {} });
    await expect(importFromUrl('http://blog.example.com/gone')).rejects.toThrow('http_404');
  });

  it('reads a recipe from a JSON reply', async () => {
    get.mockResolvedValue({ status: 200, data: RECIPE, headers: {} });
    const r = await importFromUrl('https://api.example.com/r/1');
    expect(r.title).toBe('Soupe');
    expect(r.steps).toEqual(['Cuire.']);
  });

  it('keeps "</script>" inside JSON from breaking out of the script block', () => {
    const html = asHtml(JSON.stringify({ name: 'a</script><img src=x>' }));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
