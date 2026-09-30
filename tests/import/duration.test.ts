import { describe, expect, it } from 'vitest';
import { parseDuration, parseHumanDuration, parseIsoDuration } from '@/import/duration';

describe('parseIsoDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseIsoDuration('PT1H20M')).toBe(80);
  });

  it('parses a zero-day form', () => {
    expect(parseIsoDuration('P0DT0H45M')).toBe(45);
  });

  it('parses minutes only', () => {
    expect(parseIsoDuration('PT90M')).toBe(90);
  });

  it('parses a fractional hour', () => {
    expect(parseIsoDuration('PT0.5H')).toBe(30);
  });

  it('parses days', () => {
    expect(parseIsoDuration('P1DT2H')).toBe(24 * 60 + 120);
  });

  it('parses the long form with years, months and fractional seconds', () => {
    expect(parseIsoDuration('P0Y0M0DT0H20M0.000S')).toBe(20);
    expect(parseIsoDuration('P0Y0M0DT1H5M')).toBe(65);
    expect(parseIsoDuration('pt45m')).toBe(45);
    expect(parseIsoDuration('P1W')).toBe(7 * 24 * 60);
  });

  it('returns null for invalid input', () => {
    expect(parseIsoDuration('not a duration')).toBeNull();
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration('P')).toBeNull();
  });
});

describe('parseHumanDuration', () => {
  it('parses "1 h 20"', () => {
    expect(parseHumanDuration('1 h 20')).toBe(80);
  });

  it('parses "1h20min"', () => {
    expect(parseHumanDuration('1h20min')).toBe(80);
  });

  it('parses "45 min"', () => {
    expect(parseHumanDuration('45 min')).toBe(45);
  });

  it('parses "1 heure 30 minutes"', () => {
    expect(parseHumanDuration('1 heure 30 minutes')).toBe(90);
  });

  it('parses "2 hours"', () => {
    expect(parseHumanDuration('2 hours')).toBe(120);
  });

  it('parses "20 mn"', () => {
    expect(parseHumanDuration('20 mn')).toBe(20);
  });

  it('parses a bare number as minutes', () => {
    expect(parseHumanDuration('35')).toBe(35);
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseHumanDuration('')).toBeNull();
    expect(parseHumanDuration('quelques minutes')).toBeNull();
  });
});

describe('parseDuration', () => {
  it('accepts ISO, human text and numbers of minutes', () => {
    expect(parseDuration('PT20M')).toBe(20);
    expect(parseDuration('20 min')).toBe(20);
    expect(parseDuration('1 h 30')).toBe(90);
    expect(parseDuration(25)).toBe(25);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration({})).toBeNull();
  });
});
