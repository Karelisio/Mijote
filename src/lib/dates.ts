/** Local-date helpers (meal planning works on calendar days, not instants). */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (r.getDay() + 6) % 7;
  return addDays(r, -day);
}

export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
}

export function formatDay(iso: string, lang: 'fr' | 'en', opts: Intl.DateTimeFormatOptions): string {
  return fromISODate(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', opts);
}
