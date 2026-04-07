import {
  hasMediaConsent,
  filterConsentedSwimmers,
  getNonConsentedSwimmers,
  grantConsent,
  revokeConsent,
} from '../mediaConsent';

describe('hasMediaConsent', () => {
  it('returns true when consent is granted', () => {
    expect(hasMediaConsent({ mediaConsent: { granted: true, date: new Date() } })).toBe(true);
  });

  it('returns false when consent is revoked', () => {
    expect(hasMediaConsent({ mediaConsent: { granted: false, date: new Date() } })).toBe(false);
  });

  it('returns false when mediaConsent is undefined', () => {
    expect(hasMediaConsent({})).toBe(false);
  });

  it('returns false when mediaConsent is explicitly undefined', () => {
    expect(hasMediaConsent({ mediaConsent: undefined })).toBe(false);
  });
});

describe('filterConsentedSwimmers', () => {
  const swimmers = [
    { id: 's1', displayName: 'Alice', mediaConsent: { granted: true, date: new Date() } },
    { id: 's2', displayName: 'Bob', mediaConsent: { granted: false, date: new Date() } },
    { id: 's3', displayName: 'Charlie' },
    { id: 's4', displayName: 'Dana', mediaConsent: { granted: true, date: new Date() } },
  ];

  it('returns only swimmers with granted consent', () => {
    const result = filterConsentedSwimmers(swimmers as any) as any[];
    expect(result).toHaveLength(2);
    expect(result[0].displayName).toBe('Alice');
    expect(result[1].displayName).toBe('Dana');
  });

  it('returns empty array when none are consented', () => {
    const none = [{ mediaConsent: { granted: false, date: new Date() } }];
    expect(filterConsentedSwimmers(none)).toHaveLength(0);
  });
});

describe('getNonConsentedSwimmers', () => {
  const allSwimmers = [
    { id: 's1', displayName: 'Alice', mediaConsent: { granted: true, date: new Date() } },
    { id: 's2', displayName: 'Bob', mediaConsent: { granted: false, date: new Date() } },
    { id: 's3', displayName: 'Charlie' },
  ] as any[];

  it('returns names of tagged swimmers without consent', () => {
    const names = getNonConsentedSwimmers(allSwimmers, ['s1', 's2', 's3'], allSwimmers);
    expect(names).toEqual(['Bob', 'Charlie']);
  });

  it('returns empty when all tagged swimmers are consented', () => {
    const names = getNonConsentedSwimmers(allSwimmers, ['s1'], allSwimmers);
    expect(names).toEqual([]);
  });

  it('ignores IDs not found in allSwimmers', () => {
    const names = getNonConsentedSwimmers(allSwimmers, ['s999'], allSwimmers);
    expect(names).toEqual([]);
  });
});

describe('grantConsent', () => {
  it('creates a granted consent object', () => {
    const consent = grantConsent('Jane Doe', 'Signed form received');
    expect(consent.granted).toBe(true);
    expect(consent.grantedBy).toBe('Jane Doe');
    expect(consent.notes).toBe('Signed form received');
    expect(consent.date).toBeTruthy();
  });
});

describe('revokeConsent', () => {
  it('creates a revoked consent object', () => {
    const consent = revokeConsent('Parent requested removal via email');
    expect(consent.granted).toBe(false);
    expect(consent.notes).toBe('Parent requested removal via email');
    expect(consent.date).toBeTruthy();
  });
});
