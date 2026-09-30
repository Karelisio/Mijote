import { normalizeText } from '@/config/units';

export interface DetectedTimer {
  /** Character range in the original text. */
  start: number;
  end: number;
  seconds: number;
  /** Human text as written ("20 min"). */
  label: string;
}

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const HOURS = String.raw`heures?|hours?|hrs?|h`;
const MINUTES = String.raw`minutes?|mins?|mn|m`;
const SECONDS = String.raw`secondes?|seconds?|secs?|s`;
const NOT_A_WORD = String.raw`(?![a-zà-ÿ])`;

// "20 min", "2 heures", "30 s", "1 à 2 min", "20-25 minutes"…
const MAIN_RE = new RegExp(
  String.raw`(${NUM})(?:\s*(?:à|a|-|–|to|ou|or)\s*(${NUM}))?\s*(${HOURS}|${MINUTES}|${SECONDS})${NOT_A_WORD}`,
  'gi',
);
// …and its optional second part right after: "1 h 30", "1h30", "1 hour 15 minutes", "1 min 30 s".
const EXTRA_RE = new RegExp(
  String.raw`\s*(?:(?:et|and)\s*)?(\d{1,2})(?!\d)\s*(${MINUTES}|${SECONDS})?${NOT_A_WORD}`,
  'iy',
);

function unitSeconds(u: string): number {
  const n = normalizeText(u);
  if (n.startsWith('h')) return 3600;
  if (n.startsWith('s')) return 1;
  return 60;
}

/**
 * Seconds added by the second part, or null when it is not part of the duration: a bare number
 * is minutes after hours ("1 h 30") unless it counts or measures something, and seconds after
 * minutes only at the end of a phrase ("1 min 30."), never "5 minutes 2 fois".
 */
function extraSeconds(main: number, n: number, unit: string | undefined, after: string): number | null {
  if (n > 59) return null;
  if (unit) {
    const u = unitSeconds(unit);
    if (main === 3600 && u === 60) return n * 60;
    if (main === 60 && u === 1) return n;
    return null;
  }
  if (main === 3600) {
    return /^\s*(?:°|%|fois\b|x\b|times\b|[kmcd]?[gl]\b|pers)/i.test(after) ? null : n * 60;
  }
  if (main === 60) return /^\s*(?:[.,;:!?)]|$)/.test(after) ? n : null;
  return null;
}

/** Finds cooking durations in a step so they can become one-tap timers. */
export function detectTimers(text: string): DetectedTimer[] {
  const out: DetectedTimer[] = [];
  let lastEnd = 0;
  for (const m of text.matchAll(MAIN_RE)) {
    const [main, a, , unit] = m;
    const idx = m.index ?? 0;
    if (!a || !unit || idx < lastEnd) continue;
    const perUnit = unitSeconds(unit);
    // The lower bound of a range is the safest timer ("20 à 25 min" → check at 20).
    let seconds = parseFloat(a.replace(',', '.')) * perUnit;
    let end = idx + main.length;
    EXTRA_RE.lastIndex = end;
    const x = EXTRA_RE.exec(text);
    if (x?.[1]) {
      const extra = extraSeconds(perUnit, parseInt(x[1], 10), x[2], text.slice(EXTRA_RE.lastIndex));
      if (extra !== null) {
        seconds += extra;
        end = EXTRA_RE.lastIndex;
      }
    }
    if (seconds < 5 || seconds > 48 * 3600) continue;
    lastEnd = end;
    out.push({ start: idx, end, seconds: Math.round(seconds), label: text.slice(idx, end).trim() });
  }
  return out;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
