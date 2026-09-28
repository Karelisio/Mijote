import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: IconName;
  danger?: boolean;
  large?: boolean;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'filled',
  icon,
  danger,
  large,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    'ripple',
    `btn-${variant}`,
    icon && 'has-icon',
    danger && 'btn-danger',
    large && 'btn-lg',
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={large ? 24 : 18} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  selected?: boolean;
  fill?: boolean;
  small?: boolean;
  size?: number;
}

export function IconButton({
  icon,
  label,
  variant = 'standard',
  selected,
  fill,
  small,
  size,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const cls = [
    'icon-btn',
    'ripple',
    variant !== 'standard' && `icon-btn-${variant}`,
    selected && 'selected',
    small && 'sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} aria-label={label} title={label} aria-pressed={selected} {...rest}>
      <Icon name={icon} fill={fill ?? selected} size={size} />
    </button>
  );
}
