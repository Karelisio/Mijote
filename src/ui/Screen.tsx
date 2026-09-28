import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { IconButton } from './Button';
import { useT } from '@/i18n';

const scrollMemory = new Map<string, number>();

interface Props {
  title: string;
  /** Large collapsing headline (top-level screens). */
  large?: boolean;
  back?: boolean | (() => void);
  actions?: ReactNode;
  withNav?: boolean;
  /** Render prop receiving whether the FAB should be extended. */
  fab?: (extended: boolean) => ReactNode;
  /** Remember and restore scroll position under this key. */
  scrollKey?: string;
  /** Hero content drawn under a transparent app bar (detail screens). */
  hero?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
  className?: string;
}

export function Screen({
  title,
  large,
  back,
  actions,
  withNav,
  fab,
  scrollKey,
  hero,
  children,
  bottom,
  className,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [extended, setExtended] = useState(true);
  const [heroPassed, setHeroPassed] = useState(!hero);
  const last = useRef(0);
  const { scrollY } = useScroll({ container: ref });
  const titleScale = useTransform(scrollY, [0, 80], [1, 0.9]);
  const titleOpacity = useTransform(scrollY, [0, 60], [1, 0]);

  useLayoutEffect(() => {
    if (scrollKey && ref.current) ref.current.scrollTop = scrollMemory.get(scrollKey) ?? 0;
  }, [scrollKey]);

  const hasHero = !!hero;
  useEffect(() => {
    const el = ref.current;
    setHeroPassed(!hasHero || (!!el && el.scrollTop > el.clientWidth * 0.62 - 64));
  }, [hasHero]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (scrollKey) scrollMemory.set(scrollKey, y);
      setScrolled(y > (large ? 56 : 2));
      if (hero) setHeroPassed(y > el.clientWidth * 0.62 - 64);
      if (Math.abs(y - last.current) > 8) {
        setExtended(y < last.current || y < 16);
        last.current = y;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollKey, large, hero]);

  const onBack = typeof back === 'function' ? back : () => navigate(-1);
  const barCls = [
    'appbar',
    hero && !heroPassed ? 'transparent over-hero' : '',
    scrolled && (!hero || heroPassed) ? 'scrolled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`screen${withNav ? ' with-nav' : ''}${className ? ` ${className}` : ''}`}>
      <header
        className={barCls}
        style={hero ? { position: 'absolute', left: 0, right: 0, top: 0 } : undefined}
      >
        <div className="appbar-row">
          {back ? (
            <IconButton icon="arrow_back" label={t('common.back')} onClick={onBack} />
          ) : (
            <span style={{ width: 4 }} />
          )}
          <h1
            className="appbar-title"
            style={{
              opacity: (large && !scrolled) || (hero && !heroPassed) ? 0 : 1,
              margin: 0,
              fontWeight: 400,
            }}
          >
            {title}
          </h1>
          <div className="appbar-actions">{actions}</div>
        </div>
      </header>
      <div className="screen-scroll" ref={ref}>
        {hero}
        {large && (
          <motion.div className="large-title" style={{ scale: titleScale, opacity: titleOpacity }}>
            {title}
          </motion.div>
        )}
        {children}
      </div>
      {bottom}
      {fab?.(extended)}
    </div>
  );
}
