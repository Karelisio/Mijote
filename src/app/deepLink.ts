/** Maps an external deep link (app shortcuts, mijote://…) to an in-app path. */
export function deepLinkToPath(url: string): string | null {
  const m = /^mijote:\/\/(.*)$/.exec(url) ?? /^https?:\/\/[^/]+\/(.*)$/.exec(url);
  if (!m) return null;
  const path = `/${m[1] ?? ''}`.replace(/\/+$/, '') || '/recipes';
  return /^\/(recipes|planner|shopping|settings|import|cook-with)(\/|$|\?)/.test(path) ? path : '/recipes';
}

let launchUrlHandled = false;

/**
 * Path of the deep link the app was launched with, on the first call only: Capacitor returns the
 * same launch URL for the whole process, so handling it again would send the user back to the
 * shortcut screen.
 */
export async function takeLaunchPath(
  getLaunchUrl: () => Promise<{ url: string } | undefined>,
): Promise<string | null> {
  if (launchUrlHandled) return null;
  launchUrlHandled = true;
  const r = await getLaunchUrl();
  return r?.url ? deepLinkToPath(r.url) : null;
}
