/** Maps an external deep link (app shortcuts, mijote://…) to an in-app path. */
export function deepLinkToPath(url: string): string | null {
  const m = /^mijote:\/\/(.*)$/.exec(url) ?? /^https?:\/\/[^/]+\/(.*)$/.exec(url);
  if (!m) return null;
  const path = `/${m[1] ?? ''}`.replace(/\/+$/, '') || '/recipes';
  return /^\/(recipes|planner|shopping|settings|import|cook-with)(\/|$|\?)/.test(path) ? path : '/recipes';
}
