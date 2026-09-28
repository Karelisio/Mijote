import { useEffect, useState } from 'react';
import { imageUrl } from '@/platform/images';
import type { Category } from '@/db/types';
import type { IconName } from './Icon';

export const CATEGORY_ICONS: Record<Category, IconName> = {
  starter: 'soup_kitchen',
  main: 'restaurant',
  side: 'skillet',
  dessert: 'cooking',
  breakfast: 'light_mode',
  snack: 'local_fire_department',
  drink: 'volume_up',
  sauce: 'kitchen',
  bread: 'menu_book',
  other: 'restaurant',
};

export function useImageUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path)
      void imageUrl(path)
        .then((u) => alive && setUrl(u))
        .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}
