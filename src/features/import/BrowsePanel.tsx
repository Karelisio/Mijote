import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { ListItem } from '@/ui/Controls';
import { useT } from '@/i18n';
import { DEFAULT_SITE, RECIPE_SITES, siteHost } from '@/config/recipeSites';

/** Marmiton search up front, other recipe sites below; everything opens in the in-app browser. */
export function BrowsePanel({ onOpen }: { onOpen: (url: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const site = DEFAULT_SITE;
  const search = () => {
    const q = query.trim();
    onOpen(q && site.search ? site.search(q) : site.home);
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <motion.section
        className="browse-hero"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="row" style={{ gap: 12 }}>
          <span className="browse-hero-icon">
            <Icon name="restaurant" size={26} />
          </span>
          <div className="grow">
            <div className="title-large serif">{site.name}</div>
            <div className="body-small muted">{siteHost(site)}</div>
          </div>
        </div>
        <form
          className="searchbar"
          style={{ margin: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('import.searchPlaceholder')}
            enterKeyHint="search"
            aria-label={t('import.searchOn', { site: site.name })}
          />
        </form>
        <Button large icon={query.trim() ? 'search' : 'open_in_new'} onClick={search}>
          {query.trim()
            ? t('import.searchOn', { site: site.name })
            : t('import.openSite', { site: site.name })}
        </Button>
        <p className="body-small muted" style={{ margin: 0 }}>
          {t('import.browseHint')}
        </p>
      </motion.section>

      <div>
        <div className="title-small muted" style={{ padding: '0 4px 4px' }}>
          {t('import.otherSites')}
        </div>
        {RECIPE_SITES.filter((s) => s.id !== site.id).map((s) => (
          <ListItem
            key={s.id}
            icon="public"
            headline={s.name}
            supporting={siteHost(s)}
            onClick={() => onOpen(s.home)}
            trailing={<Icon name="chevron_right" size={20} className="muted" />}
          />
        ))}
      </div>
    </div>
  );
}
