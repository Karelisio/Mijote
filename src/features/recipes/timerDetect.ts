import { normalizeText } from '@/config/units';

export interface DetectedTimer {
  /** Character range in the original text. */
  start: number;
  end: number;
  seconds: number;
  /** Human text as written ("20 min"). */
  label: string;
}

// Matches "20 min", "1 h 30", "1h30", "2 heures", "1 à 2 min", "20-25 minutes", "30 s", "1 hour 15 minutes".
const RE =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:à|a|-|–|to|ou|or)\s*(\d+(?:[.,]\d+)?))?\s*(heures?|hours?|hrs?|h|minutes?|mins?|mn|m(?![a-z])|secondes?|seconds?|secs?|s(?![a-z]))(?:\s*(?:et\s*|and\s*)?(\d{1,2})\s*(?:minutes?|mins?|mn|m(?![a-z]))?)?/gi;

function unitSeconds(u: string): number {
  const n = normalizeText(u);
  if (n.startsWith('h')) return 3600;
  if (n.startsWith('s')) return 1;
  return 60;
}

/** Finds cooking durations in a step so they can become one-tap timers. */
export function detectTimers(text: string): DetectedTimer[] {
  const out: DetectedTimer[] = [];
  for (const m of text.matchAll(RE)) {
    const [full, a, , unit, extraMin] = m;
    if (!a || !unit) continue;
    const idx = m.index ?? 0;
    // Skip things like "180 °C" or "4 personnes": only time units reach here, but avoid "3 s" in "3 sachets".
    const end = idx + full.trimEnd().length;
    if (/[a-zà-ÿ]/i.test(text.charAt(end))) continue;
    // The lower bound of a range is the safest timer ("20 à 25 min" → check at 20).
    let seconds = parseFloat(a.replace(',', '.')) * unitSeconds(unit);
    const isHour = unitSeconds(unit) === 3600;
    if (isHour && extraMin) seconds += parseInt(extraMin, 10) * 60;
    else if (!isHour && extraMin) continue;
    if (seconds < 5 || seconds > 48 * 3600) continue;
    out.push({ start: idx, end, seconds: Math.round(seconds), label: full.trim() });
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
