import { ICONS, type IconName } from './icons.generated';

export type { IconName };

interface Props {
  name: IconName;
  fill?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, fill = false, size = 24, className, style }: Props) {
  const filled = `${name}_fill` as IconName;
  const d = (fill && filled in ICONS ? ICONS[filled] : ICONS[name]) ?? '';
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      aria-hidden="true"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
