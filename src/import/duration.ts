/** Parsers for recipe durations, returning whole minutes or null when unparseable. */

const ISO_NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const ISO_RE = new RegExp(
  `^P(?:${ISO_NUM}Y)?(?:${ISO_NUM}M)?(?:${ISO_NUM}W)?(?:${ISO_NUM}D)?` +
    `(?:T(?:${ISO_NUM}H)?(?:${ISO_NUM}M)?(?:${ISO_NUM}S)?)?$`,
  'i',
);

/** ISO-8601 duration, e.g. "PT1H20M", "P0DT0H45M", "PT90M", "PT0.5H", "P0Y0M0DT0H20M0.000S". */
export function parseIsoDuration(s: string): number | null {
  const match = ISO_RE.exec(s.trim());
  if (!match) return null;
  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  if (![years, months, weeks, days, hours, minutes, seconds].some(Boolean)) return null;

  const num = (v: string | undefined): number => (v ? parseFloat(v.replace(',', '.')) : 0);
  const totalDays = num(years) * 365 + num(months) * 30 + num(weeks) * 7 + num(days);
  const totalMinutes = totalDays * 24 * 60 + num(hours) * 60 + num(minutes) + num(seconds) / 60;
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return null;
  return Math.round(totalMinutes);
}

const NUMBER = '\\d+(?:[.,]\\d+)?';
// Bare "h"/no-letter-after guards keep "1h20" from requiring a space while not matching inside
// unrelated words ("heures" is caught by the longer alternative first).
const HOUR_RE = new RegExp(`(${NUMBER})\\s*(?:heures?|hours?|hrs?|h)(?![a-z])`);
const MINUTE_RE = new RegExp(`(${NUMBER})\\s*(?:minutes?|mins?|mn)(?![a-z])`);

function toNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

/**
 * Human-readable duration, FR or EN: "1 h 20", "1h20min", "45 min", "1 heure 30 minutes",
 * "2 hours", "20 mn".
 */
export function parseHumanDuration(s: string): number | null {
  const text = s.trim().toLowerCase();
  if (!text) return null;

  const hourMatch = HOUR_RE.exec(text);
  const minuteMatch = MINUTE_RE.exec(text);

  let hours = 0;
  let minutes = 0;
  let found = false;

  if (hourMatch?.[1]) {
    hours = toNumber(hourMatch[1]);
    found = true;
  }

  if (minuteMatch?.[1]) {
    minutes = toNumber(minuteMatch[1]);
    found = true;
  } else if (hourMatch) {
    // "1 h 20" — a trailing bare number after the hour marker, with no unit of its own.
    const rest = text.slice(hourMatch.index + hourMatch[0].length);
    const trailing = /^\s*(\d+)\s*$/.exec(rest);
    if (trailing?.[1]) {
      minutes = parseInt(trailing[1], 10);
      found = true;
    }
  }

  if (found) {
    const total = hours * 60 + minutes;
    return Number.isFinite(total) ? Math.round(total) : null;
  }

  // Bare number with no unit at all: treat as minutes.
  const bare = /^(\d+(?:[.,]\d+)?)$/.exec(text);
  if (bare?.[1]) {
    return Math.round(toNumber(bare[1]));
  }

  return null;
}

/** A duration given as ISO-8601, as text ("20 min", "1 h 30") or as a number of minutes. */
export function parseDuration(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  return parseIsoDuration(v) ?? parseHumanDuration(v);
}
