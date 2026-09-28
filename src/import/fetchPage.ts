import { Capacitor, CapacitorHttp } from '@capacitor/core';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/128.0.0.0 Mobile Safari/537.36';

const REQUEST_HEADERS = {
  'User-Agent': MOBILE_USER_AGENT,
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function proxiedUrl(url: string): string {
  return import.meta.env.DEV ? `/__proxy?url=${encodeURIComponent(url)}` : url;
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/** Fetches a URL as text, using native Capacitor HTTP on Android (bypasses CORS), the dev proxy
 * in `vite dev`, or a plain `fetch` otherwise. Throws `Error('http_<status>')` on a non-2xx reply. */
export async function fetchText(url: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: REQUEST_HEADERS, responseType: 'text' });
    if (!isSuccess(res.status)) throw new Error(`http_${res.status}`);
    const data: unknown = res.data;
    return typeof data === 'string' ? data : String(data);
  }

  const res = await fetch(proxiedUrl(url));
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.text();
}

/** Same as `fetchText` but returns a Blob (e.g. for a recipe photo). */
export async function fetchBinary(url: string): Promise<Blob> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url, headers: REQUEST_HEADERS, responseType: 'blob' });
    if (!isSuccess(res.status)) throw new Error(`http_${res.status}`);
    const contentType =
      res.headers['Content-Type'] ?? res.headers['content-type'] ?? 'application/octet-stream';
    const data: unknown = res.data;
    if (data instanceof Blob) return data;
    if (typeof data === 'string') return base64ToBlob(data, contentType);
    throw new Error('http_invalid_response');
  }

  const res = await fetch(proxiedUrl(url));
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
