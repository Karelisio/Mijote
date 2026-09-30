import { useState } from 'react';
import { CATEGORY_ICONS, useImageUrl } from './recipeImageUtils';
import type { Category } from '@/db/types';
import { Icon } from './Icon';

/** Photo, or a warm tonal placeholder with the category icon. */
export function RecipeImage({
  path,
  category,
  alt,
  iconSize = 40,
  className,
}: {
  path: string | null;
  category: Category;
  alt: string;
  iconSize?: number;
  className?: string;
}) {
  const url = useImageUrl(path);
  const [loaded, setLoaded] = useState(false);
  // A file missing on disk fails to load: show the placeholder instead of an empty box.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  return (
    <div className={`recipe-img${className ? ` ${className}` : ''}`}>
      {path && url && url !== brokenUrl ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setBrokenUrl(url)}
          className={loaded ? 'loaded' : ''}
        />
      ) : (
        <div className={`recipe-img-placeholder cat-${category}`}>
          <Icon name={CATEGORY_ICONS[category]} size={iconSize} />
        </div>
      )}
    </div>
  );
}
