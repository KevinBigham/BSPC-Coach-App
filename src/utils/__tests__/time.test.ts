import { formatTimeDisplay, parseTimeInput, getTodayString } from '../time';

describe('formatTimeDisplay', () => {
  it('formats time with minutes', () => {
    expect(formatTimeDisplay(6523)).toBe('1:05.23');
  });

  it('formats time without minutes', () => {
    expect(formatTimeDisplay(2543)).toBe('25.43');
  });

  it('formats sub-second time', () => {
    expect(formatTimeDisplay(30)).toBe('0.30');
  });

  it('formats zero', () => {
    expect(formatTimeDisplay(0)).toBe('0.00');
  });

  it('formats large times', () => {
    expect(formatTimeDisplay(30000)).toBe('5:00.00');
  });
});

describe('parseTimeInput', () => {
  it('parses full time input', () => {
    expect(parseTimeInput('1', '05', '23')).toBe(6523);
  });

  it('parses seconds and hundredths only', () => {
    expect(parseTimeInput('0', '25', '43')).toBe(2543);
  });

  it('handles empty strings', () => {
    expect(parseTimeInput('', '', '')).toBe(0);
  });

  it('handles minutes only', () => {
    expect(parseTimeInput('2', '0', '0')).toBe(12000);
  });
});

describe('getTodayString', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = getTodayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
