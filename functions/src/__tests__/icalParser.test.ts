import { parseICal, inferEventType } from '../utils/icalParser';

describe('parseICal', () => {
  it('parses a single timed VEVENT with all common fields', () => {
    const feed = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:practice-001@bspc',
      'SUMMARY:Gold Practice',
      'DESCRIPTION:Main set focus',
      'LOCATION:BSHS Pool',
      'DTSTART:20260501T160000Z',
      'DTEND:20260501T173000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      uid: 'practice-001@bspc',
      title: 'Gold Practice',
      description: 'Main set focus',
      location: 'BSHS Pool',
      startDate: '2026-05-01',
      startTime: '16:00',
      endDate: '2026-05-01',
      endTime: '17:30',
      recurrence: null,
      rawRrule: null,
    });
  });

  it('treats DTSTART;VALUE=DATE as an all-day event with null times', () => {
    const feed = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:meet-001@bspc',
      'SUMMARY:State Meet',
      'DTSTART;VALUE=DATE:20260620',
      'DTEND;VALUE=DATE:20260622',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].startTime).toBeNull();
    expect(events[0].endTime).toBeNull();
    expect(events[0].startDate).toBe('2026-06-20');
    expect(events[0].endDate).toBe('2026-06-22');
  });

  it('collapses simple FREQ=WEEKLY into recurrence metadata', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:weekly-001',
      'SUMMARY:Diamond Practice',
      'DTSTART:20260504T160000Z',
      'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260801',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].recurrence).toEqual({
      frequency: 'weekly',
      dayOfWeek: 1,
      until: '2026-08-01',
    });
    expect(events[0].rawRrule).toBeNull();
  });

  it('multi-day weekly RRULE (BYDAY=MO,WE,FR) falls back to rawRrule', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:multi-001',
      'SUMMARY:MWF Practice',
      'DTSTART:20260504T160000Z',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].recurrence).toBeNull();
    expect(events[0].rawRrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('non-WEEKLY frequency (DAILY) falls back to rawRrule', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:daily-001',
      'SUMMARY:Anything',
      'DTSTART:20260504T160000Z',
      'RRULE:FREQ=DAILY',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].recurrence).toBeNull();
    expect(events[0].rawRrule).toBe('FREQ=DAILY');
  });

  it('unfolds RFC 5545 line continuations (concatenates without inserting a space)', () => {
    // Per RFC 5545 §3.1, folding inserts CRLF + a single SPACE/HTAB; unfolding
    // removes both and joins the segments verbatim. Authors are expected to
    // include any needed spaces in the content before the fold.
    const feed = [
      'BEGIN:VEVENT',
      'UID:fold-001',
      'SUMMARY:Long title that wraps',
      'DESCRIPTION:A long description that wraps because it exceeds the 75-char ',
      ' fold limit.',
      'DTSTART:20260601T120000Z',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].description).toBe(
      'A long description that wraps because it exceeds the 75-char fold limit.',
    );
  });

  it('unescapes \\n \\, \\; and \\\\ in text fields per RFC 5545', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:escape-001',
      'SUMMARY:With escapes',
      String.raw`DESCRIPTION:Line 1\nLine 2\, comma\; semi\\back`,
      'DTSTART:20260601T120000Z',
      'END:VEVENT',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events[0].description).toBe('Line 1\nLine 2, comma; semi\\back');
  });

  it('skips VEVENTs missing UID, SUMMARY, or DTSTART', () => {
    const feed = [
      'BEGIN:VEVENT',
      'UID:incomplete-001',
      'DTSTART:20260601T120000Z',
      'END:VEVENT',
    ].join('\r\n');

    expect(parseICal(feed)).toHaveLength(0);
  });

  it('skips non-VEVENT components (VTODO, VTIMEZONE)', () => {
    const feed = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTIMEZONE',
      'TZID:America/Chicago',
      'END:VTIMEZONE',
      'BEGIN:VTODO',
      'UID:todo-001',
      'SUMMARY:Should be ignored',
      'END:VTODO',
      'BEGIN:VEVENT',
      'UID:event-001',
      'SUMMARY:Real event',
      'DTSTART:20260601T120000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseICal(feed);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('event-001');
  });
});

describe('inferEventType', () => {
  it.each<[string, string]>([
    ['Spring Invitational Meet', 'meet'],
    ['State Championship', 'meet'],
    ['Annual Fundraiser Auction', 'fundraiser'],
    ['Swim-A-Thon', 'fundraiser'],
    ['End-of-Season Banquet', 'social'],
    ['Team Cookout', 'social'],
    ['New Parent Orientation', 'team_event'],
    ['Coach Clinic', 'team_event'],
    ['Gold Practice', 'practice'],
    ['Tuesday Practice', 'practice'],
    ['Random unmatched title', 'practice'],
  ])('"%s" -> %s', (title, expected) => {
    expect(inferEventType(title)).toBe(expected);
  });
});
