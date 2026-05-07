import {
  buildDemoAttendance,
  buildDemoCoaches,
  buildDemoDeletePaths,
  buildDemoEntries,
  buildDemoMeet,
  buildDemoSessions,
  buildDemoSwimmers,
  buildDemoWrites,
} from '../seed-demo-data';

describe('seed-demo-data builders', () => {
  it('builds the requested unmistakable demo roster and media consent mix', () => {
    const swimmers = buildDemoSwimmers();

    expect(swimmers).toHaveLength(30);
    expect(swimmers[0].displayName).toBe('BSPC Demo 01');
    expect(swimmers[29].displayName).toBe('BSPC Demo 30');
    expect(new Set(swimmers.map((swimmer) => swimmer.group))).toEqual(
      new Set(['Bronze', 'Silver', 'Gold', 'Advanced', 'Platinum', 'Diamond', 'Masters']),
    );
    expect(swimmers.filter((swimmer) => swimmer.doNotPhotograph === true)).toHaveLength(2);
    expect(swimmers.filter((swimmer) => !swimmer.mediaConsent)).toHaveLength(2);
  });

  it('builds demo coaches, attendance, meet entries, and scoped AI sessions', () => {
    const coaches = buildDemoCoaches();
    const swimmers = buildDemoSwimmers();
    const attendance = buildDemoAttendance(swimmers);
    const meet = buildDemoMeet();
    const entries = buildDemoEntries(swimmers);
    const sessions = buildDemoSessions(swimmers);

    expect(coaches.map((coach) => coach.displayName)).toEqual([
      'Demo Coach Alpha',
      'Demo Coach Beta',
    ]);
    expect(attendance.length).toBeGreaterThanOrEqual(600);
    expect(attendance.every((record) => record.id.startsWith('demo-attendance-'))).toBe(true);
    expect(meet.name).toBe('BSPC Demo Invitational 2026');
    expect(entries).toHaveLength(8);
    expect(sessions.audioSession.selectedSwimmerIds).toEqual([
      'demo-swimmer-01',
      'demo-swimmer-02',
    ]);
    expect(sessions.videoSession.selectedSwimmerIds).toEqual([
      'demo-swimmer-05',
      'demo-swimmer-06',
    ]);
  });

  it('builds idempotent demo-prefixed writes and delete paths only', () => {
    const writes = buildDemoWrites();
    const deletePaths = buildDemoDeletePaths();

    expect(writes.length).toBe(deletePaths.length);
    expect(writes.some((write) => write.path === 'parent_invites/demo-parent-invite-01')).toBe(
      true,
    );
    expect(writes.some((write) => write.path.includes('demo-audio-draft-01'))).toBe(true);
    expect(writes.some((write) => write.path.includes('demo-video-draft-01'))).toBe(true);
    expect(
      deletePaths.every((path) => path.split('/').some((part) => part.startsWith('demo'))),
    ).toBe(true);
  });
});
