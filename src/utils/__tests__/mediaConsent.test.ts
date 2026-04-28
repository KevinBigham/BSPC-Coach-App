import {
  hasMediaConsent,
  filterConsentedSwimmers,
  getNonConsentedSwimmers,
  canTagOrUploadMedia,
  grantConsent,
  revokeConsent,
  assertCanTagSwimmer,
  assertCanTagSwimmers,
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

  it('returns false when consent has expired', () => {
    expect(
      hasMediaConsent({
        mediaConsent: {
          granted: true,
          date: new Date('2025-01-01'),
          expiresAt: new Date('2025-12-31'),
        },
      }),
    ).toBe(false);
  });
});

describe('canTagOrUploadMedia', () => {
  it('allows active swimmers with current consent and no photo restriction', () => {
    expect(
      canTagOrUploadMedia({
        active: true,
        mediaConsent: { granted: true, date: new Date() },
      }),
    ).toEqual({ allowed: true });
  });

  it('blocks swimmers with missing consent', () => {
    expect(canTagOrUploadMedia({ active: true })).toEqual({
      allowed: false,
      reason: 'missing_consent',
    });
  });

  it('blocks swimmers marked Do Not Photograph before consent checks', () => {
    expect(
      canTagOrUploadMedia({
        active: true,
        doNotPhotograph: true,
        mediaConsent: { granted: true, date: new Date() },
      }),
    ).toEqual({ allowed: false, reason: 'do_not_photograph' });
  });

  it('blocks inactive swimmers', () => {
    expect(
      canTagOrUploadMedia({
        active: false,
        mediaConsent: { granted: true, date: new Date() },
      }),
    ).toEqual({ allowed: false, reason: 'inactive' });
  });

  it('blocks expired consent', () => {
    expect(
      canTagOrUploadMedia({
        active: true,
        mediaConsent: {
          granted: true,
          date: new Date('2025-01-01'),
          expiresAt: new Date('2025-12-31'),
        },
      }),
    ).toEqual({ allowed: false, reason: 'expired_consent' });
  });
});

describe('filterConsentedSwimmers', () => {
  const swimmers = [
    {
      id: 's1',
      displayName: 'Alice',
      active: true,
      mediaConsent: { granted: true, date: new Date() },
    },
    { id: 's2', displayName: 'Bob', mediaConsent: { granted: false, date: new Date() } },
    { id: 's3', displayName: 'Charlie' },
    {
      id: 's4',
      displayName: 'Dana',
      active: true,
      mediaConsent: { granted: true, date: new Date() },
    },
    {
      id: 's5',
      displayName: 'Erin',
      active: true,
      doNotPhotograph: true,
      mediaConsent: { granted: true, date: new Date() },
    },
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
    {
      id: 's1',
      displayName: 'Alice',
      active: true,
      mediaConsent: { granted: true, date: new Date() },
    },
    { id: 's2', displayName: 'Bob', mediaConsent: { granted: false, date: new Date() } },
    { id: 's3', displayName: 'Charlie' },
    {
      id: 's4',
      displayName: 'Dana',
      active: true,
      doNotPhotograph: true,
      mediaConsent: { granted: true, date: new Date() },
    },
  ] as any[];

  it('returns names of tagged swimmers without consent', () => {
    const names = getNonConsentedSwimmers(allSwimmers, ['s1', 's2', 's3', 's4'], allSwimmers);
    expect(names).toEqual(['Bob', 'Charlie', 'Dana']);
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

describe('assertCanTagSwimmer (BUG #4 service-layer COPPA gate)', () => {
  it('does not throw for an active, consented swimmer', () => {
    expect(() =>
      assertCanTagSwimmer({
        active: true,
        displayName: 'Alice',
        mediaConsent: { granted: true, date: new Date() },
      }),
    ).not.toThrow();
  });

  it('throws when consent is missing', () => {
    expect(() => assertCanTagSwimmer({ active: true, displayName: 'Bob' })).toThrow(
      /Bob.*missing_consent/,
    );
  });

  it('throws when do-not-photograph is set even with granted consent', () => {
    expect(() =>
      assertCanTagSwimmer({
        active: true,
        displayName: 'Charlie',
        doNotPhotograph: true,
        mediaConsent: { granted: true, date: new Date() },
      }),
    ).toThrow(/Charlie.*do_not_photograph/);
  });

  it('throws when consent is expired', () => {
    expect(() =>
      assertCanTagSwimmer({
        active: true,
        displayName: 'Dana',
        mediaConsent: {
          granted: true,
          date: new Date('2025-01-01'),
          expiresAt: new Date('2025-12-31'),
        },
      }),
    ).toThrow(/Dana.*expired_consent/);
  });
});

describe('assertCanTagSwimmers (multi-swimmer COPPA gate)', () => {
  const consented = {
    id: 's1',
    displayName: 'Alice',
    active: true,
    mediaConsent: { granted: true, date: new Date() },
  };
  const denied = {
    id: 's2',
    displayName: 'Bob',
    mediaConsent: { granted: false, date: new Date() },
  };
  const dnp = {
    id: 's3',
    displayName: 'Charlie',
    active: true,
    doNotPhotograph: true,
    mediaConsent: { granted: true, date: new Date() },
  };

  it('does not throw when all tagged swimmers are consented', () => {
    expect(() => assertCanTagSwimmers(['s1'], [consented, denied, dnp])).not.toThrow();
  });

  it('throws once with every blocked name joined by commas', () => {
    expect(() => assertCanTagSwimmers(['s1', 's2', 's3'], [consented, denied, dnp])).toThrow(
      /Bob, Charlie/,
    );
  });

  it('skips unknown IDs (no swimmer in roster) silently — matches validateMediaConsent semantics', () => {
    expect(() => assertCanTagSwimmers(['unknown-id'], [consented])).not.toThrow();
  });
});
