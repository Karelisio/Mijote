import { useEffect } from 'react';
import { useShopping } from './store';

/** Number of unchecked items (navigation badge). */
export function useShoppingCount(): number {
  const loaded = useShopping((s) => s.loaded);
  const load = useShopping((s) => s.load);
  const count = useShopping((s) => s.items.filter((i) => !i.checked).length);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  return count;
}
