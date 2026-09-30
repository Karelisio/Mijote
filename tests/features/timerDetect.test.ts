import { describe, expect, it } from 'vitest';
import { detectTimers, formatClock, formatDuration } from '@/features/recipes/timerDetect';

const secs = (t: string) => detectTimers(t).map((d) => d.seconds);

describe('detectTimers', () => {
  it('finds minutes, hours and mixed durations', () => {
    expect(secs('Faites cuire 20 min à feu doux.')).toEqual([1200]);
    expect(secs('Laissez reposer 1 h.')).toEqual([3600]);
    expect(secs('Cuire 1 h 30 au four')).toEqual([5400]);
    expect(secs('Cuire 1h30')).toEqual([5400]);
    expect(secs('Laisser mariner 2 heures')).toEqual([7200]);
    expect(secs('Bake for 25 minutes')).toEqual([1500]);
    expect(secs('Simmer for 1 hour 15 minutes')).toEqual([4500]);
    expect(secs('Blanchir 30 secondes')).toEqual([30]);
  });
  it('uses the lower bound of a range', () => {
    expect(secs('cuire 1 à 2 min de chaque côté')).toEqual([60]);
    expect(secs('Enfournez 20-25 minutes')).toEqual([1200]);
  });
  it('finds several timers in one step', () => {
    expect(secs('Faites revenir 5 min puis laissez mijoter 20 min.')).toEqual([300, 1200]);
  });
  it('ignores temperatures, quantities and words starting with a unit letter', () => {
    expect(secs('Préchauffez le four à 180 °C')).toEqual([]);
    expect(secs('Ajoutez 3 sachets de levure')).toEqual([]);
    expect(secs('Pour 4 personnes, 2 mangues')).toEqual([]);
    expect(secs('Ajoutez 2 huîtres')).toEqual([]);
  });
  it('reads "1 min 30 s" and "1 min 30." as 90 seconds', () => {
    expect(secs('Cuire 1 min 30 s')).toEqual([90]);
    expect(secs('Cuire 1 min 30.')).toEqual([90]);
    expect(secs('Cuire 1 heure et 30 minutes')).toEqual([5400]);
    expect(detectTimers('Cuire 1 min 30 s de chaque côté')[0]?.label).toBe('1 min 30 s');
  });
  it('does not glue a count or a temperature to the duration', () => {
    expect(secs('Pétrir 5 minutes 2 fois')).toEqual([300]);
    expect(detectTimers('Pétrir 5 minutes 2 fois')[0]?.label).toBe('5 minutes');
    expect(secs('Enfourner 25 min 180°C')).toEqual([1500]);
    expect(secs('Laisser reposer 2 h 180°C')).toEqual([7200]);
    expect(secs('Laisser lever 1 h 2 fois')).toEqual([3600]);
    expect(secs('Cuire 1 min 30 de chaque côté')).toEqual([60]);
    expect(secs('Cuire 20 min, 180 °C, puis 5 min')).toEqual([1200, 300]);
  });
  it('returns the label as written and its position', () => {
    const [d] = detectTimers('Cuire 20 min.');
    expect(d?.label).toBe('20 min');
    expect('Cuire 20 min.'.slice(d!.start, d!.end)).toBe('20 min');
  });
});

describe('formatting', () => {
  it('formats a countdown', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(0)).toBe('0:00');
  });
  it('formats a duration in minutes', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(80)).toBe('1 h 20');
    expect(formatDuration(120)).toBe('2 h');
  });
});
