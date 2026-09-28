import { memo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { RecipeSummary } from '@/db/types';
import { RecipeImage } from '@/ui/RecipeImage';
import { Icon } from '@/ui/Icon';
import { useT } from '@/i18n';
import { formatDuration } from './timerDetect';
import { totalMinutes } from './filter';
import { toggleFavorite } from './actions';

interface Props {
  recipe: RecipeSummary;
  view: 'grid' | 'list';
  index: number;
}

export const RecipeCard = memo(function RecipeCard({ recipe: r, view, index }: Props) {
  const navigate = useNavigate();
  const t = useT();
  const minutes = totalMinutes(r);
  const open = () => navigate(`/recipes/${r.id}`);
  const meta = (
    <div className="recipe-card-meta">
      {minutes !== null && (
        <span className="row" style={{ gap: 4 }}>
          <Icon name="schedule" size={16} />
          {formatDuration(minutes)}
        </span>
      )}
      {r.rating > 0 && (
        <span className="row" style={{ gap: 2 }}>
          <Icon name="star" fill size={16} className="star-on" />
          {r.rating}
        </span>
      )}
      {view === 'list' && <span className="ellipsis">{t(`category.${r.category}`)}</span>}
    </div>
  );
  const fav = (
    <motion.button
      type="button"
      className={`recipe-card-fav${r.favorite ? ' on' : ''}`}
      aria-label={r.favorite ? t('recipe.unfavorite') : t('recipe.favorite')}
      whileTap={{ scale: 1.35 }}
      onClick={(e) => {
        e.stopPropagation();
        void toggleFavorite(r.id, !r.favorite);
      }}
    >
      <Icon name="favorite" fill={r.favorite} size={20} />
    </motion.button>
  );

  return (
    <motion.article
      className={`recipe-card ${view} ripple`}
      onClick={open}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03, ease: [0.2, 0, 0, 1] }}
      whileTap={{ scale: 0.98 }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && open()}
    >
      <motion.div
        layoutId={`photo-${r.id}`}
        className="recipe-card-photo"
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <RecipeImage path={r.photo} category={r.category} alt="" iconSize={view === 'grid' ? 44 : 28} />
      </motion.div>
      <div className="recipe-card-body">
        <h3 className={`recipe-card-title ${view === 'grid' ? 'clamp-2' : 'ellipsis'}`}>{r.title}</h3>
        {meta}
      </div>
      {fav}
    </motion.article>
  );
});
