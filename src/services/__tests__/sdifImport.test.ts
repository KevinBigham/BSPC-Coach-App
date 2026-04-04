jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { parseSDIF, matchSwimmers } from '../sdifImport';

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper to build a fixed-width SDIF line
function buildB1Line(meetName: string, date: string, courseCode: string): string {
  let line = 'B1';
  line = line.padEnd(11, ' ');
  line += meetName.padEnd(30, ' '); // cols 11-40
  line += date.padEnd(8, ' '); // cols 41-48
  line = line.padEnd(52, ' ');
  line += courseCode; // col 52
  return line;
}

function buildD0Line(opts: {
  ussId?: string;
  name?: string;
  gender?: string;
  distance?: string;
  stroke?: string;
  time?: string;
  course?: string;
}): string {
  let line = 'D0';
  line = line.padEnd(10, ' ');
  line += (opts.ussId || '').padEnd(14, ' '); // cols 10-23
  line += (opts.name || '').padEnd(28, ' '); // cols 24-51
  line += (opts.gender || 'M').padEnd(1, ' '); // col 52
  line = line.padEnd(56, ' ');
  line += (opts.distance || '0050').padEnd(4, ' '); // cols 56-59
  line += (opts.stroke || 'A').padEnd(1, ' '); // col 60
  line = line.padEnd(62, ' ');
  line += (opts.time || '25.50').padEnd(8, ' '); // cols 62-69
  line += (opts.course || 'Y').padEnd(1, ' '); // col 70
  return line;
}

describe('parseSDIF', () => {
  it('parses B1 meet info record', () => {
    const content = buildB1Line('BSPC Invitational', '20260315', 'Y');
    const result = parseSDIF(content);
    expect(result.meetName).toBe('BSPC Invitational');
    expect(result.meetDate).toBe('2026-03-15');
    expect(result.course).toBe('SCY');
  });

  it('parses D0 individual result record', () => {
    const b1 = buildB1Line('Test Meet', '20260315', 'Y');
    const d0 = buildD0Line({
      ussId: 'USS001',
      name: 'Doe, Jane',
      gender: 'F',
      distance: '0100',
      stroke: 'A',
      time: '55.30',
      course: 'Y',
    });
    const result = parseSDIF(`${b1}\n${d0}`);
    expect(result.records).toHaveLength(1);
    const rec = result.records[0];
    expect(rec.firstName).toBe('Jane');
    expect(rec.lastName).toBe('Doe');
    expect(rec.event).toBe('100 Free');
    expect(rec.time).toBe(5530);
    expect(rec.timeDisplay).toBe('55.30');
    expect(rec.course).toBe('SCY');
    expect(rec.gender).toBe('F');
  });

  it('parses time with minutes', () => {
    const d0 = buildD0Line({
      name: 'Smith, John',
      distance: '0200',
      stroke: 'E',
      time: '2:15.40',
    });
    const result = parseSDIF(d0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].time).toBe(13540); // 2*6000 + 15*100 + 40
    expect(result.records[0].event).toBe('200 IM');
  });

  it('skips NT/DQ/SCR entries', () => {
    const d0NT = buildD0Line({ name: 'A, B', time: 'NT      ' });
    const d0DQ = buildD0Line({ name: 'C, D', time: 'DQ      ' });
    const result = parseSDIF(`${d0NT}\n${d0DQ}`);
    expect(result.records).toHaveLength(0);
  });

  it('reports errors for unknown event codes', () => {
    const d0 = buildD0Line({ name: 'A, B', distance: '0050', stroke: 'Z', time: '25.00' });
    const result = parseSDIF(d0);
    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles course codes: SCM and LCM', () => {
    const d0scm = buildD0Line({ name: 'A, B', time: '25.00', course: 'S' });
    const d0lcm = buildD0Line({ name: 'C, D', time: '26.00', course: 'L' });
    const result = parseSDIF(`${d0scm}\n${d0lcm}`);
    expect(result.records[0].course).toBe('SCM');
    expect(result.records[1].course).toBe('LCM');
  });

  it('title-cases names', () => {
    const d0 = buildD0Line({ name: 'DOE, JANE', time: '30.00' });
    const result = parseSDIF(d0);
    expect(result.records[0].firstName).toBe('Jane');
    expect(result.records[0].lastName).toBe('Doe');
  });
});

describe('matchSwimmers', () => {
  const swimmers = [
    { id: 's1', firstName: 'Jane', lastName: 'Doe', usaSwimmingId: 'USS001' },
    { id: 's2', firstName: 'John', lastName: 'Smith', usaSwimmingId: '' },
  ] as any[];

  it('matches by exact USA Swimming ID', () => {
    const records = [{ usaSwimmingId: 'USS001', firstName: 'Jane', lastName: 'Doe' }] as any[];
    const results = matchSwimmers(records, swimmers);
    expect(results[0].confidence).toBe('exact');
    expect(results[0].matchedSwimmer?.id).toBe('s1');
  });

  it('matches by name when no USS ID', () => {
    const records = [{ usaSwimmingId: '', firstName: 'John', lastName: 'Smith' }] as any[];
    const results = matchSwimmers(records, swimmers);
    expect(results[0].confidence).toBe('name');
    expect(results[0].matchedSwimmer?.id).toBe('s2');
  });

  it('returns none confidence for unmatched swimmers', () => {
    const records = [{ usaSwimmingId: '', firstName: 'Unknown', lastName: 'Person' }] as any[];
    const results = matchSwimmers(records, swimmers);
    expect(results[0].confidence).toBe('none');
    expect(results[0].matchedSwimmer).toBeNull();
  });
});
