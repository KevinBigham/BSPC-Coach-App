jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('expo-file-system', () => ({
  Paths: { cache: '/tmp/cache' },
  File: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    write: jest.fn(),
    uri: 'file:///tmp/cache/test.csv',
  })),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import { exportRosterCSV, exportAttendanceCSV, exportTimesCSV } from '../export';

describe('exportRosterCSV', () => {
  it('generates correct CSV headers', () => {
    const csv = exportRosterCSV([]);
    expect(csv).toContain(
      'First Name,Last Name,Display Name,Group,Gender,Active,USA Swimming ID,Date of Birth',
    );
  });

  it('generates rows for swimmers', () => {
    const swimmers = [
      {
        id: 's1',
        firstName: 'Jane',
        lastName: 'Doe',
        displayName: 'Jane Doe',
        group: 'Gold',
        gender: 'F',
        active: true,
        usaSwimmingId: 'USS001',
        dateOfBirth: '2012-05-15',
      },
    ] as any[];

    const csv = exportRosterCSV(swimmers);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain('Jane');
    expect(lines[1]).toContain('Doe');
    expect(lines[1]).toContain('Gold');
    expect(lines[1]).toContain('Yes');
  });

  it('marks inactive swimmers as No', () => {
    const swimmers = [
      {
        id: 's1',
        firstName: 'A',
        lastName: 'B',
        displayName: 'A B',
        group: 'Silver',
        gender: 'M',
        active: false,
        usaSwimmingId: '',
        dateOfBirth: '',
      },
    ] as any[];
    const csv = exportRosterCSV(swimmers);
    expect(csv).toContain('No');
  });

  it('escapes commas in field values', () => {
    const swimmers = [
      {
        id: 's1',
        firstName: 'Jane, Jr.',
        lastName: 'Doe',
        displayName: 'Jane, Jr. Doe',
        group: 'Gold',
        gender: 'F',
        active: true,
        usaSwimmingId: '',
        dateOfBirth: '',
      },
    ] as any[];
    const csv = exportRosterCSV(swimmers);
    // The name with comma should be quoted
    expect(csv).toContain('"Jane, Jr."');
  });
});

describe('exportAttendanceCSV', () => {
  it('generates correct CSV headers', () => {
    const csv = exportAttendanceCSV([]);
    expect(csv).toContain('Swimmer,Group,Date,Arrived,Departed,Status,Note,Coach');
  });

  it('generates rows for attendance records', () => {
    const records = [
      {
        id: 'a1',
        swimmerName: 'Jane Doe',
        group: 'Gold',
        practiceDate: '2026-04-01',
        arrivedAt: new Date('2026-04-01T15:00:00'),
        departedAt: null,
        status: 'normal',
        note: '',
        coachName: 'Coach K',
      },
    ] as any[];

    const csv = exportAttendanceCSV(records);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Jane Doe');
    expect(lines[1]).toContain('2026-04-01');
  });
});

describe('exportTimesCSV', () => {
  it('generates correct CSV headers', () => {
    const csv = exportTimesCSV([]);
    expect(csv).toContain('Event,Course,Time,Display,PR,Meet,Source,Date');
  });

  it('generates rows for swim times', () => {
    const times = [
      {
        id: 't1',
        event: '100 Free',
        course: 'SCY',
        time: 5500,
        timeDisplay: '55.00',
        isPR: true,
        meetName: 'Regionals',
        source: 'manual',
        createdAt: new Date('2026-03-15'),
      },
    ] as any[];

    const csv = exportTimesCSV(times);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('100 Free');
    expect(lines[1]).toContain('SCY');
    expect(lines[1]).toContain('Yes');
    expect(lines[1]).toContain('Regionals');
  });

  it('marks non-PR times as No', () => {
    const times = [
      {
        id: 't1',
        event: '50 Free',
        course: 'SCY',
        time: 3000,
        timeDisplay: '30.00',
        isPR: false,
        meetName: '',
        source: 'manual',
        createdAt: new Date(),
      },
    ] as any[];
    const csv = exportTimesCSV(times);
    expect(csv).toContain('No');
  });
});
