import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface Props extends Omit<
  InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>,
  'onChange' | 'value'
> {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  supporting?: string;
  error?: string | null;
  multiline?: boolean;
  rows?: number;
  trailing?: ReactNode;
}

export function TextField({
  label,
  value,
  onChange,
  supporting,
  error,
  multiline,
  rows = 3,
  trailing,
  className,
  ...rest
}: Props) {
  const id = useId();
  const cls = ['field', value !== '' && 'filled', error && 'error', trailing && 'has-trailing', className]
    .filter(Boolean)
    .join(' ');
  const inputCls = `field-input${label ? '' : ' no-label'}`;
  return (
    <div className={cls}>
      {multiline ? (
        <textarea
          id={id}
          className={inputCls}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      ) : (
        <input
          id={id}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
      )}
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      {trailing && <div className="field-trailing">{trailing}</div>}
      {(error || supporting) && <div className="field-supporting">{error || supporting}</div>}
    </div>
  );
}
