jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

import {
  generatePracticePlanDoc,
  generateSwimmerReport,
  generateGroupReport,
  GroupReportStats,
} from '../docExport';
import {
  buildSwimmer,
  buildSwimTime,
  buildAttendance,
  resetFactory,
} from '../../__tests__/factories/swimmerFactory';
import {
  buildPracticePlan,
  buildPracticeSet,
  buildPracticeItem,
  resetPracticeFactory,
} from '../../__tests__/factories/practiceFactory';

beforeEach(() => {
  resetFactory();
  resetPracticeFactory();
});

// ---------------------------------------------------------------------------
// generatePracticePlanDoc
// ---------------------------------------------------------------------------

describe('generatePracticePlanDoc', () => {
  it('includes the plan title', () => {
    const plan = buildPracticePlan({ title: 'Monday Distance' });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('MONDAY DISTANCE');
  });

  it('includes coach name and duration', () => {
    const plan = buildPracticePlan({ coachName: 'Coach Kevin', totalDuration: 120 });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Coach: Coach Kevin');
    expect(doc).toContain('Duration: 120 minutes');
  });

  it('includes group and date when provided', () => {
    const plan = buildPracticePlan({ group: 'Gold', date: '2026-04-01' });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Group: Gold');
    expect(doc).toContain('Date:');
  });

  it('includes description when provided', () => {
    const plan = buildPracticePlan({ description: 'Threshold focus day' });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Description: Threshold focus day');
  });

  it('calculates and displays total yardage', () => {
    const plan = buildPracticePlan({
      sets: [
        buildPracticeSet({
          items: [buildPracticeItem({ reps: 4, distance: 100 })],
        }),
        buildPracticeSet({
          items: [buildPracticeItem({ reps: 1, distance: 200 })],
        }),
      ],
    });
    const doc = generatePracticePlanDoc(plan);
    // 4*100 + 1*200 = 600
    expect(doc).toContain('Total Yardage: 600');
  });

  it('formats set items with reps, distance, stroke, and interval', () => {
    const plan = buildPracticePlan({
      sets: [
        buildPracticeSet({
          name: 'Main Set',
          category: 'Main Set',
          items: [
            buildPracticeItem({
              reps: 8,
              distance: 50,
              stroke: 'Freestyle',
              interval: '0:45',
            }),
          ],
        }),
      ],
    });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('8 x 50 Freestyle on 0:45');
  });

  it('includes focus points for items', () => {
    const plan = buildPracticePlan({
      sets: [
        buildPracticeSet({
          items: [
            buildPracticeItem({
              focusPoints: ['high elbow catch', 'bilateral breathing'],
            }),
          ],
        }),
      ],
    });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Focus: high elbow catch, bilateral breathing');
  });

  it('omits reps prefix when reps is 1', () => {
    const plan = buildPracticePlan({
      sets: [
        buildPracticeSet({
          items: [buildPracticeItem({ reps: 1, distance: 400, stroke: 'IM' })],
        }),
      ],
    });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('400 IM');
    expect(doc).not.toContain('1 x 400');
  });

  it('handles a plan with no sets', () => {
    const plan = buildPracticePlan({ sets: [] });
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Total Yardage: 0');
  });

  it('includes the team name footer', () => {
    const plan = buildPracticePlan();
    const doc = generatePracticePlanDoc(plan);
    expect(doc).toContain('Blue Springs Power Cats');
  });
});

// ---------------------------------------------------------------------------
// generateSwimmerReport
// ---------------------------------------------------------------------------

describe('generateSwimmerReport', () => {
  it('includes the swimmer display name in the header', () => {
    const swimmer = buildSwimmer({ displayName: 'Michael Phelps' });
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('SWIMMER REPORT: MICHAEL PHELPS');
  });

  it('includes profile details', () => {
    const swimmer = buildSwimmer({
      firstName: 'Jane',
      lastName: 'Doe',
      group: 'Platinum',
      gender: 'F',
      active: true,
      usaSwimmingId: 'USA-12345',
    });
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('Name: Jane Doe');
    expect(doc).toContain('Group: Platinum');
    expect(doc).toContain('Gender: Female');
    expect(doc).toContain('Status: Active');
    expect(doc).toContain('USA Swimming ID: USA-12345');
  });

  it('shows inactive status', () => {
    const swimmer = buildSwimmer({ active: false });
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('Status: Inactive');
  });

  it('includes strengths, weaknesses, and goals', () => {
    const swimmer = buildSwimmer({
      strengths: ['Underwaters', 'Turns'],
      weaknesses: ['Breathing pattern'],
      goals: ['Break 1:00 in 100 Free'],
    });
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('Strengths:');
    expect(doc).toContain('  - Underwaters');
    expect(doc).toContain('  - Turns');
    expect(doc).toContain('Weaknesses:');
    expect(doc).toContain('  - Breathing pattern');
    expect(doc).toContain('Goals:');
    expect(doc).toContain('  - Break 1:00 in 100 Free');
  });

  it('displays best times grouped by event', () => {
    const swimmer = buildSwimmer();
    const times = [
      buildSwimTime({ event: '100 Free', course: 'SCY', time: 5500, timeDisplay: '55.00' }),
      buildSwimTime({ event: '100 Free', course: 'SCY', time: 5400, timeDisplay: '54.00' }),
      buildSwimTime({ event: '200 Free', course: 'SCY', time: 12000, timeDisplay: '2:00.00' }),
    ];
    const doc = generateSwimmerReport(swimmer, times, []);
    // Best time section should show 54.00 for 100 Free (the faster one)
    expect(doc).toContain('100 Free (SCY): 54.00');
    expect(doc).toContain('200 Free (SCY): 2:00.00');
  });

  it('shows meet name in time entries', () => {
    const swimmer = buildSwimmer();
    const times = [
      buildSwimTime({ event: '50 Free', timeDisplay: '24.50', meetName: 'State Champs' }),
    ];
    const doc = generateSwimmerReport(swimmer, times, []);
    expect(doc).toContain('@ State Champs');
  });

  it('handles empty times gracefully', () => {
    const swimmer = buildSwimmer();
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('No times recorded.');
  });

  it('displays attendance summary with status breakdown', () => {
    const swimmer = buildSwimmer();
    const attendance = [
      buildAttendance({ practiceDate: '2026-04-01', status: 'normal' }),
      buildAttendance({ practiceDate: '2026-04-02', status: 'normal' }),
      buildAttendance({ practiceDate: '2026-04-03', status: 'excused' }),
      buildAttendance({ practiceDate: '2026-03-30', status: 'sick' }),
    ];
    const doc = generateSwimmerReport(swimmer, [], attendance);
    expect(doc).toContain('Total Practices Attended: 4');
    expect(doc).toContain('Normal: 2');
    expect(doc).toContain('Excused: 1');
    expect(doc).toContain('Sick: 1');
  });

  it('handles empty attendance gracefully', () => {
    const swimmer = buildSwimmer();
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('No attendance records.');
  });

  it('includes parent contacts', () => {
    const swimmer = buildSwimmer({
      parentContacts: [
        {
          name: 'Bob Smith',
          relationship: 'Father',
          email: 'bob@test.com',
          phone: '555-1234',
        },
      ],
    });
    const doc = generateSwimmerReport(swimmer, [], []);
    expect(doc).toContain('Bob Smith (Father)');
    expect(doc).toContain('Email: bob@test.com');
    expect(doc).toContain('Phone: 555-1234');
  });

  it('marks PRs in time history', () => {
    const swimmer = buildSwimmer();
    const times = [
      buildSwimTime({ event: '50 Free', timeDisplay: '25.00', isPR: true }),
      buildSwimTime({ event: '50 Free', timeDisplay: '26.00', isPR: false }),
    ];
    const doc = generateSwimmerReport(swimmer, times, []);
    expect(doc).toContain('25.00 [PR]');
    expect(doc).not.toContain('26.00 [PR]');
  });
});

// ---------------------------------------------------------------------------
// generateGroupReport
// ---------------------------------------------------------------------------

describe('generateGroupReport', () => {
  const defaultStats: GroupReportStats = {
    totalPractices: 20,
    averageAttendance: 12.5,
    attendancePercent: 83.3,
  };

  it('includes group name in the header', () => {
    const doc = generateGroupReport('Gold', [], defaultStats);
    expect(doc).toContain('GROUP REPORT: GOLD');
  });

  it('shows swimmer counts', () => {
    const swimmers = [
      buildSwimmer({ active: true }),
      buildSwimmer({ active: true }),
      buildSwimmer({ active: false }),
    ];
    const doc = generateGroupReport('Silver', swimmers, defaultStats);
    expect(doc).toContain('Total Swimmers: 3');
    expect(doc).toContain('Active Swimmers: 2');
    expect(doc).toContain('Inactive Swimmers: 1');
  });

  it('shows attendance stats', () => {
    const doc = generateGroupReport('Gold', [], defaultStats);
    expect(doc).toContain('Total Practices: 20');
    expect(doc).toContain('Average Attendance: 12.5');
    expect(doc).toContain('Attendance Rate: 83.3%');
  });

  it('lists swimmers sorted by last name', () => {
    const swimmers = [
      buildSwimmer({ firstName: 'Zach', lastName: 'Adams' }),
      buildSwimmer({ firstName: 'Alice', lastName: 'Zimmerman' }),
      buildSwimmer({ firstName: 'Bob', lastName: 'Miller' }),
    ];
    const doc = generateGroupReport('Gold', swimmers, defaultStats);
    const adamsIdx = doc.indexOf('Adams, Zach');
    const millerIdx = doc.indexOf('Miller, Bob');
    const zimmermanIdx = doc.indexOf('Zimmerman, Alice');
    expect(adamsIdx).toBeLessThan(millerIdx);
    expect(millerIdx).toBeLessThan(zimmermanIdx);
  });

  it('marks inactive swimmers in the roster', () => {
    const swimmers = [buildSwimmer({ firstName: 'Jake', lastName: 'Brown', active: false })];
    const doc = generateGroupReport('Gold', swimmers, defaultStats);
    expect(doc).toContain('Brown, Jake [Inactive]');
  });

  it('handles empty roster', () => {
    const doc = generateGroupReport('Bronze', [], defaultStats);
    expect(doc).toContain('No swimmers in this group.');
  });

  it('shows gender breakdown', () => {
    const swimmers = [
      buildSwimmer({ gender: 'M' }),
      buildSwimmer({ gender: 'M' }),
      buildSwimmer({ gender: 'F' }),
    ];
    const doc = generateGroupReport('Gold', swimmers, defaultStats);
    expect(doc).toContain('Male: 2');
    expect(doc).toContain('Female: 1');
  });

  it('includes the team name footer', () => {
    const doc = generateGroupReport('Gold', [], defaultStats);
    expect(doc).toContain('Blue Springs Power Cats');
  });
});
