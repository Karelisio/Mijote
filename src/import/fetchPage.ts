import { Capacitor, CapacitorHttp } from '@capacitor/core';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/128.0.0.0 Mobile Safari/537.36';

const REQUEST_HEADERS = {
  'User-Agent': MOBILE_USER_AGENT,
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

const CONNECT_TIMEOUT_MS = 15_000;
const READ_TIMEOUT_MS = 20_000;

export interface FetchOptions {
  /** Aborting rejects with an AbortError (a native request cannot be stopped: it is ignored). */
  signal?: AbortSignal;
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function proxiedUrl(url: string): string {
  return import.meta.env.DEV ? `/__proxy?url=${encodeURIComponent(url)}` : url;
}

const abortError = () => new DOMException('Aborted', 'AbortError');

function withAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Browser fetch with a time limit (`Error('timeout')`) and an optional external abort. */
async function webFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, READ_TIMEOUT_MS);
  const forward = () => ctrl.abort();
  signal?.addEventListener('abort', forward, { once: true });
  try {
    return await fetch(proxiedUrl(url), { signal: ctrl.signal });
  } catch (e) {
    if (timedOut) throw new Error('timeout');
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

function isTimeout(e: unknown): boolean {
  return e instanceof Error && /time(?:d\s*)?out|timeout/i.test(e.message);
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** Fetches a URL as text, using native Capacitor HTTP on Android (bypasses CORS), the dev proxy
 * in `vite dev`, or a plain `fetch` otherwise. Throws `Error('http_<status>')` on a non-2xx reply
 * and `Error('timeout')` when the site does not answer in time. */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const res = await withAbort(
      CapacitorHttp.get({
        url,
        headers: REQUEST_HEADERS,
        responseType: 'text',
        connectTimeout: CONNECT_TIMEOUT_MS,
        readTimeout: READ_TIMEOUT_MS,
      }),
      opts.signal,
    ).catch((e: unknown) => {
      throw isTimeout(e) ? new Error('timeout') : e;
    });
    if (!isSuccess(res.status)) throw new Error(`http_${res.status}`);
    const data: unknown = res.data;
    // A JSON reply is handed over already parsed: keep it as JSON text, not "[object Object]".
    return typeof data === 'string' ? data : JSON.stringify(data ?? '');
  }

  const res = await webFetch(url, opts.signal);
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.text();
}

/** Same as `fetchText` but returns a Blob (e.g. for a recipe photo). */
export async function fetchBinary(url: string): Promise<Blob> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: REQUEST_HEADERS,
      responseType: 'blob',
      connectTimeout: CONNECT_TIMEOUT_MS,
      readTimeout: READ_TIMEOUT_MS,
    });
    if (!isSuccess(res.status)) throw new Error(`http_${res.status}`);
    const contentType =
      res.headers['Content-Type'] ?? res.headers['content-type'] ?? 'application/octet-stream';
    const data: unknown = res.data;
    if (data instanceof Blob) return data;
    if (typeof data === 'string') return base64ToBlob(data, contentType);
    throw new Error('http_invalid_response');
  }

  const res = await webFetch(url);
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.blob();
}

const SHARED_TEXT_URL_RE = /https?:\/\/\S+/;
const TRAILING_URL_PUNCT_RE = /[).,;:!?]+$/;

/** Extracts the first http(s) URL from arbitrary shared text ("Regarde cette recette https://... via Marmiton"). */
export function normalizeUrl(input: string): string | null {
  const m = SHARED_TEXT_URL_RE.exec(input);
  if (!m) return null;
  return m[0].replace(TRAILING_URL_PUNCT_RE, '');
}
