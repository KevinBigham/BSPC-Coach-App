import {
  evaluateAttendanceStreak,
  evaluateAttendanceStreakCount,
  evaluateMissedPractice,
  evaluateMissedPracticeGap,
  ruleAppliesToSwimmer,
} from '../evaluation';

describe('ruleAppliesToSwimmer', () => {
  it('returns false for disabled rules even when the group matches', () => {
    expect(
      ruleAppliesToSwimmer({ enabled: false, config: { group: 'Gold' } }, { group: 'Gold' }),
    ).toBe(false);
  });

  it('returns true for rules without a group filter', () => {
    expect(ruleAppliesToSwimmer({ enabled: true, config: {} }, { group: undefined })).toBe(true);
    expect(ruleAppliesToSwimmer({ enabled: true }, { group: 'Silver' })).toBe(true);
  });

  it('matches only swimmers in the configured group', () => {
    expect(
      ruleAppliesToSwimmer({ enabled: true, config: { group: 'Gold' } }, { group: 'Gold' }),
    ).toBe(true);
    expect(
      ruleAppliesToSwimmer({ enabled: true, config: { group: 'Gold' } }, { group: 'Silver' }),
    ).toBe(false);
  });

  it('treats a missing swimmer group as a mismatch for group-bound rules', () => {
    expect(
      ruleAppliesToSwimmer({ enabled: true, config: { group: 'Gold' } }, { group: undefined }),
    ).toBe(false);
  });
});

describe('evaluateAttendanceStreakCount', () => {
  it('returns 0 for empty practice windows or history', () => {
    expect(evaluateAttendanceStreakCount([], ['2026-04-10'])).toBe(0);
    expect(evaluateAttendanceStreakCount(['2026-04-10'], [])).toBe(0);
  });

  it('counts consecutive attended practices until the first missed practice', () => {
    expect(
      evaluateAttendanceStreakCount(
        ['2026-04-10', '2026-04-09', '2026-04-07'],
        ['2026-04-10', '2026-04-09', '2026-04-08', '2026-04-07'],
      ),
    ).toBe(2);
  });

  it('returns a count that supports threshold equality checks', () => {
    const streak = evaluateAttendanceStreakCount(
      ['2026-04-10', '2026-04-09', '2026-04-08'],
      ['2026-04-10', '2026-04-09', '2026-04-08', '2026-04-07'],
    );

    expect(streak).toBe(3);
    expect(streak >= 3).toBe(true);
  });

  it('keeps the legacy evaluateAttendanceStreak alias equivalent', () => {
    expect(evaluateAttendanceStreak(['2026-04-10'], ['2026-04-10', '2026-04-09'])).toBe(
      evaluateAttendanceStreakCount(['2026-04-10'], ['2026-04-10', '2026-04-09']),
    );
  });
});

describe('missed practice evaluation', () => {
  it('returns true when the date gap exactly equals the threshold', () => {
    expect(evaluateMissedPracticeGap('2026-04-07', '2026-04-10', 3)).toBe(true);
    expect(evaluateMissedPractice('2026-04-07', '2026-04-10', 3)).toBe(true);
  });

  it('returns false when the gap is below the threshold or threshold is not positive', () => {
    expect(evaluateMissedPracticeGap('2026-04-09', '2026-04-10', 3)).toBe(false);
    expect(evaluateMissedPracticeGap('2026-04-07', '2026-04-10', 0)).toBe(false);
  });

  it('uses trigger-safe no-history semantics for missed-practice gaps', () => {
    expect(evaluateMissedPracticeGap(null, '2026-04-10', 3)).toBe(false);
    expect(evaluateMissedPracticeGap(undefined, '2026-04-10', 3)).toBe(false);
  });

  it('keeps the legacy client helper semantics for no-history checks', () => {
    expect(evaluateMissedPractice(null, '2026-04-10', 3)).toBe(true);
    expect(evaluateMissedPractice(undefined, '2026-04-10', 3)).toBe(true);
  });
});

describe('missed-practice asymmetry (INTENTIONAL)', () => {
  it('keeps no-history client display and notification firing semantics different', () => {
    // Future changes must consciously decide whether to break this invariant.
    expect(evaluateMissedPractice(null, '2026-04-10', 3)).toBe(true);
    expect(evaluateMissedPracticeGap(null, '2026-04-10', 3)).toBe(false);
  });
});
