import { useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { IconButton } from './Button';
import { useT } from '@/i18n';

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="checkbox-hit ripple"
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked);
      }}
    >
      <span className={`checkbox${checked ? ' on' : ''}`}>
        {checked && (
          <motion.svg viewBox="0 0 24 24" width="14" height="14" initial={false}>
            <motion.path
              d="M4 12.5l5 5L20 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.2 }}
            />
          </motion.svg>
        )}
      </span>
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`segment ripple${o.value === value ? ' selected' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.value === value ? <Icon name="check" size={18} /> : o.icon && <Icon name={o.icon} size={18} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  labelMinus,
  labelPlus,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  labelMinus?: string;
  labelPlus?: string;
  format?: (v: number) => ReactNode;
}) {
  const t = useT();
  return (
    <div className="stepper">
      <IconButton
        icon="remove"
        label={labelMinus ?? t('common.decrease')}
        small
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      />
      <motion.span
        key={value}
        className="stepper-value"
        initial={{ y: -6, opacity: 0.4 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {format ? format(value) : value}
      </motion.span>
      <IconButton
        icon="add"
        label={labelPlus ?? t('common.increase')}
        small
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      />
    </div>
  );
}

export function RatingStars({
  value,
  onChange,
  size = 24,
  label,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  label: string;
}) {
  const stars = useRef<(HTMLButtonElement | null)[]>([]);
  // Radio group: one tab stop (the rating, or the first star), arrows change the rating.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onChange) return;
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, value + delta));
    onChange(next);
    stars.current[next - 1]?.focus();
  };
  return (
    <div
      className="stars"
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? label : `${label} ${value}/5`}
      onKeyDown={onKeyDown}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <motion.button
            key={n}
            ref={(el: HTMLButtonElement | null) => {
              stars.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={n === value}
            tabIndex={n === Math.max(1, value) ? 0 : -1}
            whileTap={{ scale: 1.3 }}
            className={n <= value ? 'on' : ''}
            aria-label={`${n}/5`}
            onClick={() => onChange(n === value ? 0 : n)}
          >
            <Icon name="star" fill={n <= value} size={size} />
          </motion.button>
        ) : (
          <span
            key={n}
            className={n <= value ? 'on' : ''}
            style={{ display: 'inline-flex', color: n <= value ? undefined : 'var(--md-outline-variant)' }}
          >
            <Icon name="star" fill size={size} />
          </span>
        ),
      )}
    </div>
  );
}

export function ListItem({
  icon,
  headline,
  supporting,
  trailing,
  onClick,
}: {
  icon?: IconName;
  headline: ReactNode;
  supporting?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon && (
        <span className="list-item-leading">
          <Icon name={icon} />
        </span>
      )}
      <span className="list-item-text">
        <span className="list-item-headline" style={{ display: 'block' }}>
          {headline}
        </span>
        {supporting && (
          <span className="list-item-supporting" style={{ display: 'block' }}>
            {supporting}
          </span>
        )}
      </span>
      {trailing}
    </>
  );
  const cls = `list-item${supporting ? ' two-line' : ''}`;
  // A div with button semantics, so trailing controls (checkbox, menu) can be real buttons.
  return onClick ? (
    <div
      role="button"
      tabIndex={0}
      className={`${cls} ripple`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {content}
    </div>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function Spinner() {
  return <div className="spinner" role="progressbar" />;
}

export function LinearProgress() {
  return (
    <div className="linear-progress" role="progressbar">
      <div />
    </div>
  );
}
