/** Small flat illustrations for empty states, drawn with theme colors. */
export type IllustrationName = 'pot' | 'basket' | 'calendar' | 'search' | 'fridge' | 'book';

const P = 'var(--md-primary)';
const PC = 'var(--md-primary-container)';
const SC = 'var(--md-secondary-container)';
const T = 'var(--md-tertiary)';
const TC = 'var(--md-tertiary-container)';
const S = 'var(--md-surface-container-highest)';
const O = 'var(--md-on-primary-container)';

export function Illustration({ name }: { name: IllustrationName }) {
  return (
    <svg className="empty-illu" viewBox="0 0 160 160" aria-hidden="true">
      <circle cx="80" cy="84" r="68" fill={S} />
      {name === 'pot' && (
        <g>
          <path
            d="M62 30c-6 8 6 12 0 20M80 24c-6 8 6 12 0 20M98 30c-6 8 6 12 0 20"
            stroke={T}
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            className="steam"
          />
          <rect x="34" y="72" width="16" height="12" rx="6" fill={O} />
          <rect x="110" y="72" width="16" height="12" rx="6" fill={O} />
          <path d="M42 66h76v32c0 14-11 24-24 24H66c-13 0-24-10-24-24z" fill={P} />
          <rect x="38" y="58" width="84" height="12" rx="6" fill={O} />
          <circle cx="80" cy="54" r="6" fill={O} />
        </g>
      )}
      {name === 'basket' && (
        <g>
          <circle cx="66" cy="62" r="14" fill={TC} />
          <circle cx="92" cy="58" r="16" fill={T} />
          <path d="M84 40c4-6 10-8 14-6" stroke={O} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M32 74h96l-10 44c-1 5-5 8-10 8H52c-5 0-9-3-10-8z" fill={P} />
          <rect x="28" y="68" width="104" height="12" rx="6" fill={O} />
          <path d="M60 90v22M80 90v22M100 90v22" stroke={PC} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {name === 'calendar' && (
        <g>
          <rect x="36" y="40" width="88" height="84" rx="14" fill={PC} />
          <path d="M36 54c0-8 6-14 14-14h60c8 0 14 6 14 14v8H36z" fill={P} />
          <rect x="54" y="30" width="8" height="20" rx="4" fill={O} />
          <rect x="98" y="30" width="8" height="20" rx="4" fill={O} />
          <circle cx="60" cy="82" r="7" fill={T} />
          <circle cx="80" cy="82" r="7" fill={SC} />
          <circle cx="100" cy="82" r="7" fill={SC} />
          <circle cx="60" cy="104" r="7" fill={SC} />
          <circle cx="80" cy="104" r="7" fill={T} />
          <circle cx="100" cy="104" r="7" fill={SC} />
        </g>
      )}
      {name === 'search' && (
        <g>
          <circle cx="72" cy="74" r="30" fill={PC} stroke={P} strokeWidth="10" />
          <rect x="94" y="96" width="36" height="14" rx="7" transform="rotate(45 94 96)" fill={O} />
          <path
            d="M60 70c2-8 8-12 14-12"
            stroke="var(--md-surface)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {name === 'fridge' && (
        <g>
          <rect x="48" y="26" width="64" height="104" rx="14" fill={PC} />
          <rect x="48" y="66" width="64" height="6" fill={P} />
          <rect x="58" y="40" width="6" height="16" rx="3" fill={O} />
          <rect x="58" y="80" width="6" height="22" rx="3" fill={O} />
          <circle cx="104" cy="118" r="14" fill={T} />
          <circle cx="42" cy="118" r="10" fill={TC} />
        </g>
      )}
      {name === 'book' && (
        <g>
          <path d="M80 48c-12-8-28-10-44-8v76c16-2 32 0 44 8z" fill={PC} />
          <path d="M80 48c12-8 28-10 44-8v76c-16-2-32 0-44 8z" fill={P} />
          <path d="M80 48v76" stroke={O} strokeWidth="4" />
          <path d="M48 62h20M48 76h22M48 90h18" stroke={P} strokeWidth="4" strokeLinecap="round" />
          <circle cx="104" cy="76" r="10" fill={TC} />
        </g>
      )}
    </svg>
  );
}
