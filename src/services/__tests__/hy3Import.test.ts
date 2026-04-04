jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

import { parseHY3, detectFormat } from '../hy3Import';

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper to build fixed-width HY3 lines
function buildHY3B1(meetName: string, date: string, courseCode: string): string {
  let line = 'B1';
  line += meetName.padEnd(45, ' '); // cols 2-46
  line += date.padEnd(8, ' '); // cols 47-54
  line += courseCode; // col 55
  return line;
}

function buildHY3D0(opts: {
  gender?: string;
  name?: string;
  ussId?: string;
  eventCode?: string;
  time?: string;
  course?: string;
}): string {
  let line = 'D0';
  line += opts.gender || 'M'; // col 2
  line = line.padEnd(8, ' ');
  line += (opts.name || 'Doe, Jane').padEnd(28, ' '); // cols 8-35
  line += (opts.ussId || '').padEnd(14, ' '); // cols 36-49
  line += (opts.eventCode || '1').padEnd(6, ' '); // cols 50-55
  line += (opts.time || '25.50').padEnd(8, ' '); // cols 56-63
  line += opts.course || 'Y'; // col 64
  return line;
}

describe('parseHY3', () => {
  it('parses B1 meet info', () => {
    const content = buildHY3B1('BSPC Winter Invite', '20260115', 'Y');
    const result = parseHY3(content);
    expect(result.meetName).toBe('BSPC Winter Invite');
    expect(result.meetDate).toBe('2026-01-15');
    expect(result.course).toBe('SCY');
  });

  it('parses D0 individual result with numeric event code', () => {
    const b1 = buildHY3B1('Test Meet', '20260315', 'Y');
    const d0 = buildHY3D0({
      gender: 'F',
      name: 'Doe, Jane',
      eventCode: '1',
      time: '26.50',
      course: 'Y',
    });
    const result = parseHY3(`${b1}\n${d0}`);
    expect(result.records).toHaveLength(1);
    const rec = result.records[0];
    expect(rec.firstName).toBe('Jane');
    expect(rec.lastName).toBe('Doe');
    expect(rec.event).toBe('50 Free');
    expect(rec.time).toBe(2650);
    expect(rec.gender).toBe('F');
  });

  it('parses time with minutes', () => {
    const d0 = buildHY3D0({ name: 'Smith, John', eventCode: '4', time: '5:15.20' });
    const result = parseHY3(d0);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].time).toBe(31520); // 5*6000 + 15*100 + 20
    expect(result.records[0].event).toBe('500 Free');
  });

  it('skips NT/DQ/SCR/0.00 entries', () => {
    const d0a = buildHY3D0({ name: 'A, B', time: 'NT      ' });
    const d0b = buildHY3D0({ name: 'C, D', time: 'DQ      ' });
    const d0c = buildHY3D0({ name: 'E, F', time: '0.00    ' });
    const result = parseHY3(`${d0a}\n${d0b}\n${d0c}`);
    expect(result.records).toHaveLength(0);
  });

  it('reports errors for unknown event codes', () => {
    const d0 = buildHY3D0({ name: 'A, B', eventCode: '999   ', time: '25.00' });
    const result = parseHY3(d0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles LCM course code', () => {
    const d0 = buildHY3D0({ name: 'A, B', time: '28.00', course: 'L' });
    const result = parseHY3(d0);
    expect(result.records[0].course).toBe('LCM');
  });

  it('title-cases names', () => {
    const d0 = buildHY3D0({ name: 'DOE, JANE', time: '30.00' });
    const result = parseHY3(d0);
    expect(result.records[0].firstName).toBe('Jane');
    expect(result.records[0].lastName).toBe('Doe');
  });

  it('strips non-alphanumeric from USS IDs', () => {
    const d0 = buildHY3D0({ name: 'A, B', ussId: 'USS-001-ABC ', time: '25.00' });
    const result = parseHY3(d0);
    expect(result.records[0].usaSwimmingId).toBe('USS001ABC');
  });
});

describe('detectFormat', () => {
  it('detects HY3 format by HY3 marker', () => {
    expect(detectFormat('A0;HY3 some header')).toBe('hy3');
  });

  it('detects HY3 format by HY-TEK marker', () => {
    expect(detectFormat('A0 HY-TEK MEET MANAGER')).toBe('hy3');
  });

  it('detects SDIF format by US org code', () => {
    const line = 'A0US' + ' '.repeat(50) + 'extra data';
    expect(detectFormat(line)).toBe('sdif');
  });

  it('defaults to SDIF for unknown format', () => {
    expect(detectFormat('some random content')).toBe('sdif');
  });
});
