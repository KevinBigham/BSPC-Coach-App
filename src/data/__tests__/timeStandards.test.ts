import {
  getAgeGroup,
  calculateAge,
  getStandard,
  getAchievedStandard,
  getEventStandards,
  getAvailableEvents,
  getTimeToCut,
  formatTime,
} from '../timeStandards';

describe('getAgeGroup', () => {
  it('returns 10&U for age 9', () => {
    expect(getAgeGroup(9)).toBe('10&U');
  });

  it('returns 10&U for age 10', () => {
    expect(getAgeGroup(10)).toBe('10&U');
  });

  it('returns 11-12 for age 11', () => {
    expect(getAgeGroup(11)).toBe('11-12');
  });

  it('returns 11-12 for age 12', () => {
    expect(getAgeGroup(12)).toBe('11-12');
  });

  it('returns 13-14 for age 13', () => {
    expect(getAgeGroup(13)).toBe('13-14');
  });

  it('returns 13-14 for age 14', () => {
    expect(getAgeGroup(14)).toBe('13-14');
  });

  it('returns 15-16 for age 15', () => {
    expect(getAgeGroup(15)).toBe('15-16');
  });

  it('returns 15-16 for age 16', () => {
    expect(getAgeGroup(16)).toBe('15-16');
  });

  it('returns 17-18 for age 17', () => {
    expect(getAgeGroup(17)).toBe('17-18');
  });

  it('returns 17-18 for age 18', () => {
    expect(getAgeGroup(18)).toBe('17-18');
  });

  it('returns 17-18 for age 19 (overflow)', () => {
    expect(getAgeGroup(19)).toBe('17-18');
  });
});

describe('calculateAge', () => {
  it('calculates age from a known DOB', () => {
    // Person born Jan 1, 2010 — on April 6, 2026 they are 16
    const dob = new Date(2010, 0, 1);
    expect(calculateAge(dob)).toBe(16);
  });

  it('handles birthday edge case (birthday not yet reached this year)', () => {
    // Person born Dec 31, 2010 — on April 6, 2026 they are still 15
    const dob = new Date(2010, 11, 31);
    expect(calculateAge(dob)).toBe(15);
  });
});

describe('getStandard', () => {
  it('returns a number for SCY standard', () => {
    const result = getStandard('SCY', 'M', '13-14', '100 Free', 'A');
    expect(result).toEqual(expect.any(Number));
    expect(result).toBeGreaterThan(0);
  });

  it('returns a number for LCM standard (not null)', () => {
    const result = getStandard('LCM', 'M', '13-14', '100 Free', 'A');
    expect(result).toEqual(expect.any(Number));
    expect(result).toBeGreaterThan(0);
  });

  it('returns a number for SCM standard (not null)', () => {
    const result = getStandard('SCM', 'F', '15-16', '200 Free', 'BB');
    expect(result).toEqual(expect.any(Number));
    expect(result).toBeGreaterThan(0);
  });

  it('returns null for an invalid event', () => {
    const result = getStandard('SCY', 'M', '13-14', '800 Free', 'A');
    expect(result).toBeNull();
  });
});

describe('getAchievedStandard', () => {
  it('returns AAAA when time meets AAAA cutoff', () => {
    // Get the AAAA cutoff for M 13-14 100 Free SCY, then use exactly that time
    const aaaa = getStandard('SCY', 'M', '13-14', '100 Free', 'AAAA')!;
    expect(getAchievedStandard('SCY', 'M', '13-14', '100 Free', aaaa)).toBe('AAAA');
  });

  it('returns A when time is between A and AA', () => {
    const a = getStandard('SCY', 'M', '13-14', '100 Free', 'A')!;
    const aa = getStandard('SCY', 'M', '13-14', '100 Free', 'AA')!;
    // Use a time 1 hundredth slower than AA (which is faster than A cutoff)
    const timeBetween = aa + 1;
    expect(timeBetween).toBeLessThanOrEqual(a);
    expect(getAchievedStandard('SCY', 'M', '13-14', '100 Free', timeBetween)).toBe('A');
  });

  it('returns null when time is slower than B standard', () => {
    const b = getStandard('SCY', 'M', '13-14', '100 Free', 'B')!;
    expect(getAchievedStandard('SCY', 'M', '13-14', '100 Free', b + 100)).toBeNull();
  });

  it('works for LCM course', () => {
    const aaaa = getStandard('LCM', 'F', '11-12', '100 Free', 'AAAA')!;
    expect(getAchievedStandard('LCM', 'F', '11-12', '100 Free', aaaa)).toBe('AAAA');
  });
});

describe('getEventStandards', () => {
  it('returns 6-level object for SCY', () => {
    const result = getEventStandards('SCY', 'M', '13-14', '100 Free');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('B');
    expect(result).toHaveProperty('BB');
    expect(result).toHaveProperty('A');
    expect(result).toHaveProperty('AA');
    expect(result).toHaveProperty('AAA');
    expect(result).toHaveProperty('AAAA');
    // B should be slowest (largest number), AAAA fastest (smallest)
    expect(result!.B).toBeGreaterThan(result!.AAAA);
  });

  it('returns 6-level object for LCM', () => {
    const result = getEventStandards('LCM', 'F', '15-16', '200 Free');
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toHaveLength(6);
  });

  it('returns 6-level object for SCM', () => {
    const result = getEventStandards('SCM', 'M', '17-18', '50 Free');
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toHaveLength(6);
  });
});

describe('getAvailableEvents', () => {
  it('SCY includes 500 Free but not 400 Free for 11-12', () => {
    const events = getAvailableEvents('SCY', 'M', '11-12');
    expect(events).toContain('500 Free');
    expect(events).not.toContain('400 Free');
  });

  it('LCM includes 400 Free but not 500 Free for 11-12', () => {
    const events = getAvailableEvents('LCM', 'M', '11-12');
    expect(events).toContain('400 Free');
    expect(events).not.toContain('500 Free');
  });
});

describe('getTimeToCut', () => {
  it('returns positive value when swimmer needs to drop time', () => {
    const standard = getStandard('SCY', 'M', '13-14', '100 Free', 'AA')!;
    const currentTime = standard + 200; // 2 seconds slower
    const result = getTimeToCut('SCY', 'M', '13-14', '100 Free', 'AA', currentTime);
    expect(result).toBe(200);
  });

  it('returns negative value when swimmer already achieved standard', () => {
    const standard = getStandard('SCY', 'M', '13-14', '100 Free', 'AA')!;
    const currentTime = standard - 50; // 0.5 seconds faster
    const result = getTimeToCut('SCY', 'M', '13-14', '100 Free', 'AA', currentTime);
    expect(result).toBe(-50);
  });
});

describe('formatTime', () => {
  it('formats time with minutes correctly', () => {
    expect(formatTime(6523)).toBe('1:05.23');
  });

  it('formats time without minutes correctly', () => {
    expect(formatTime(2599)).toBe('25.99');
  });
});
