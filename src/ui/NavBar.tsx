import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NavDest {
  to: string;
  icon: IconName;
  label: string;
  badge?: number;
}

export function NavBar({ items }: { items: NavDest[] }) {
  return (
    <nav className="navbar">
      {items.map((d) => (
        <NavLink
          key={d.to}
          to={d.to}
          replace
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          style={{ textDecoration: 'none' }}
          onClick={() => void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)}
        >
          {({ isActive }) => (
            <>
              <span className="nav-indicator-wrap">
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="nav-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon name={d.icon} fill={isActive} />
                {!!d.badge && <span className="nav-badge">{d.badge > 99 ? '99+' : d.badge}</span>}
              </span>
              {d.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
