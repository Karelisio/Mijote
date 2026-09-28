import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  icon?: IconName;
  trailingIcon?: IconName;
  elevated?: boolean;
}

export function Chip({ label, selected, icon, trailingIcon, elevated, className, ...rest }: Props) {
  const leading = selected && !icon ? 'check' : icon;
  const cls = [
    'chip',
    'ripple',
    selected && 'selected',
    leading && 'has-icon',
    trailingIcon && 'has-trailing',
    elevated && 'elevated',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} aria-pressed={selected} {...rest}>
      {leading && <Icon name={leading} size={18} fill={selected} />}
      {label}
      {trailingIcon && <Icon name={trailingIcon} size={18} />}
    </button>
  );
}
