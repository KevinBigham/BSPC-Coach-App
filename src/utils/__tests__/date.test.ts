import {
  formatRelativeTime,
  formatShortDate,
  formatDateString,
  daysAgo,
  daysAgoString,
} from '../date';
import { subDays, format } from 'date-fns';

describe('formatRelativeTime', () => {
  it('returns relative time for a date today', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toContain('ago');
  });

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = subDays(new Date(), 1);
    // Set to noon to avoid edge cases around midnight
    yesterday.setHours(12, 0, 0, 0);
    expect(formatRelativeTime(yesterday)).toBe('Yesterday');
  });

  it('returns formatted date for older dates', () => {
    const oldDate = new Date(2024, 2, 15); // Mar 15, 2024
    expect(formatRelativeTime(oldDate)).toBe('Mar 15');
  });

  it('returns formatted date for a week ago', () => {
    const weekAgo = subDays(new Date(), 7);
    const expected = format(weekAgo, 'MMM d');
    expect(formatRelativeTime(weekAgo)).toBe(expected);
  });

  it('returns relative time for a recent date today', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinutesAgo);
    expect(result).toContain('ago');
  });
});

describe('formatShortDate', () => {
  it('formats a date as "EEE, MMM d"', () => {
    const date = new Date(2024, 2, 15); // Friday, Mar 15, 2024
    expect(formatShortDate(date)).toBe('Fri, Mar 15');
  });

  it('formats January 1st correctly', () => {
    const date = new Date(2025, 0, 1); // Wed, Jan 1, 2025
    expect(formatShortDate(date)).toBe('Wed, Jan 1');
  });

  it('formats a date with single-digit day', () => {
    const date = new Date(2024, 5, 3); // Mon, Jun 3, 2024
    expect(formatShortDate(date)).toBe('Mon, Jun 3');
  });
});

describe('formatDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const date = new Date(2024, 2, 15);
    expect(formatDateString(date)).toBe('2024-03-15');
  });

  it('pads month and day with zeros', () => {
    const date = new Date(2024, 0, 5);
    expect(formatDateString(date)).toBe('2024-01-05');
  });

  it('handles December 31', () => {
    const date = new Date(2024, 11, 31);
    expect(formatDateString(date)).toBe('2024-12-31');
  });
});

describe('daysAgo', () => {
  it('returns today for 0 days ago', () => {
    const result = daysAgo(0);
    const today = new Date();
    expect(result.getDate()).toBe(today.getDate());
  });

  it('returns a date in the past for positive N', () => {
    const result = daysAgo(7);
    const expected = subDays(new Date(), 7);
    expect(format(result, 'yyyy-MM-dd')).toBe(format(expected, 'yyyy-MM-dd'));
  });

  it('returns a Date object', () => {
    expect(daysAgo(3)).toBeInstanceOf(Date);
  });
});

describe('daysAgoString', () => {
  it('returns YYYY-MM-DD for 0 days ago', () => {
    const result = daysAgoString(0);
    const expected = format(new Date(), 'yyyy-MM-dd');
    expect(result).toBe(expected);
  });

  it('returns YYYY-MM-DD for 30 days ago', () => {
    const result = daysAgoString(30);
    const expected = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    expect(result).toBe(expected);
  });

  it('matches YYYY-MM-DD format', () => {
    expect(daysAgoString(10)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
