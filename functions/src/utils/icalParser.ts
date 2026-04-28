/**
 * Minimal RFC-5545 (iCalendar) parser focused on VEVENT components.
 *
 * Scope: enough to ingest the BSPC public calendar (practices, meets, team
 * events). NOT a full RFC-5545 implementation — explicitly does NOT handle:
 *   - RRULE beyond simple WEEKLY frequency with optional UNTIL
 *   - EXDATE / RECURRENCE-ID exceptions
 *   - VTIMEZONE definitions (assumes UTC or floating local time)
 *   - VALARM, VTODO, VFREEBUSY, VJOURNAL components
 *
 * Anything more exotic stays as the raw RRULE in `rawRrule` for the coach to
 * resolve manually. This keeps the parser boring and testable; we'd rather
 * surface a single edit-needed event than silently miscalculate occurrences.
 */

export interface ParsedICalEvent {
  /** Stable iCal UID — used as the Firestore doc id to make ingests idempotent. */
  uid: string;
  /** SUMMARY field. */
  title: string;
  /** DESCRIPTION field, may be empty. */
  description: string;
  /** LOCATION field, may be empty. */
  location: string;
  /** YYYY-MM-DD form of DTSTART. */
  startDate: string;
  /** HH:MM form of DTSTART, or null when the event is all-day (DATE-only). */
  startTime: string | null;
  /** YYYY-MM-DD of DTEND, or null. */
  endDate: string | null;
  /** HH:MM of DTEND, or null when DTEND is absent or DATE-only. */
  endTime: string | null;
  /** Present only when RRULE was simple WEEKLY (with optional UNTIL/BYDAY). */
  recurrence: ParsedRecurrence | null;
  /** Raw RRULE line for any case the parser did not collapse into recurrence. */
  rawRrule: string | null;
}

export interface ParsedRecurrence {
  frequency: 'weekly';
  /** 0=Sun..6=Sat. Single value — multi-day weekly patterns are not modeled. */
  dayOfWeek: number | null;
  /** YYYY-MM-DD. */
  until: string | null;
}

/**
 * Parse an iCalendar feed string into VEVENT records.
 *
 * Returns events in feed order. Folded lines (RFC 5545 §3.1) are unfolded
 * before tokenization. Components other than VEVENT are skipped.
 */
export function parseICal(feed: string): ParsedICalEvent[] {
  const lines = unfoldLines(feed);
  const events: ParsedICalEvent[] = [];

  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      const parsed = buildEvent(current);
      if (parsed) events.push(parsed);
      inEvent = false;
      current = {};
      continue;
    }
    if (!inEvent) continue;

    // Property line is "NAME[;PARAM=VAL...]:VALUE". We collapse params into
    // the key when they affect parsing (e.g., DTSTART;VALUE=DATE).
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);

    const semi = left.indexOf(';');
    const name = (semi === -1 ? left : left.slice(0, semi)).toUpperCase();
    const params = semi === -1 ? '' : left.slice(semi + 1).toUpperCase();

    if (name === 'DTSTART' || name === 'DTEND') {
      // Tag DATE-only fields so buildEvent can drop the time component.
      const isDateOnly = params.includes('VALUE=DATE');
      current[name] = (isDateOnly ? 'D|' : 'T|') + value;
    } else if (name === 'SUMMARY' || name === 'DESCRIPTION' || name === 'LOCATION') {
      current[name] = unescapeText(value);
    } else if (name === 'UID' || name === 'RRULE') {
      current[name] = value;
    }
  }

  return events;
}

function unfoldLines(feed: string): string[] {
  const raw = feed.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    // Continuation lines start with a single space or tab (RFC 5545 §3.1).
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out.filter((l) => l.length > 0);
}

function unescapeText(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function buildEvent(props: Record<string, string>): ParsedICalEvent | null {
  const uid = props.UID;
  const summary = props.SUMMARY;
  const dtstart = props.DTSTART;
  if (!uid || !summary || !dtstart) return null;

  const start = parseDateTime(dtstart);
  if (!start) return null;

  const end = props.DTEND ? parseDateTime(props.DTEND) : null;

  let recurrence: ParsedRecurrence | null = null;
  let rawRrule: string | null = null;
  if (props.RRULE) {
    const parsed = parseSimpleWeeklyRRule(props.RRULE);
    if (parsed) {
      recurrence = parsed;
    } else {
      rawRrule = props.RRULE;
    }
  }

  return {
    uid,
    title: summary,
    description: props.DESCRIPTION ?? '',
    location: props.LOCATION ?? '',
    startDate: start.date,
    startTime: start.time,
    endDate: end?.date ?? null,
    endTime: end?.time ?? null,
    recurrence,
    rawRrule,
  };
}

function parseDateTime(tagged: string): { date: string; time: string | null } | null {
  // tagged form is "D|YYYYMMDD" or "T|YYYYMMDDTHHMMSSZ"-ish.
  const sep = tagged.indexOf('|');
  if (sep === -1) return null;
  const kind = tagged.slice(0, sep);
  const raw = tagged.slice(sep + 1);

  if (kind === 'D') {
    if (!/^\d{8}$/.test(raw)) return null;
    return { date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, time: null };
  }

  // DATETIME forms: 20260501T130000Z, 20260501T130000, or 20260501 (rare bad input).
  const tIdx = raw.indexOf('T');
  if (tIdx === -1) {
    if (!/^\d{8}$/.test(raw)) return null;
    return { date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`, time: null };
  }

  const dPart = raw.slice(0, tIdx);
  const tPart = raw.slice(tIdx + 1).replace(/Z$/, '');
  if (!/^\d{8}$/.test(dPart) || tPart.length < 4) return null;
  const hh = tPart.slice(0, 2);
  const mm = tPart.slice(2, 4);
  return {
    date: `${dPart.slice(0, 4)}-${dPart.slice(4, 6)}-${dPart.slice(6, 8)}`,
    time: `${hh}:${mm}`,
  };
}

function parseSimpleWeeklyRRule(rrule: string): ParsedRecurrence | null {
  // Accepted shapes:
  //   FREQ=WEEKLY
  //   FREQ=WEEKLY;UNTIL=YYYYMMDD
  //   FREQ=WEEKLY;UNTIL=YYYYMMDDTHHMMSSZ
  //   FREQ=WEEKLY;BYDAY=MO            (one weekday only — multi-day not modeled)
  //   FREQ=WEEKLY;BYDAY=MO;UNTIL=YYYYMMDD
  // Any other shape → null (caller falls back to rawRrule).
  const parts = Object.fromEntries(
    rrule.split(';').map((kv) => {
      const eq = kv.indexOf('=');
      return [kv.slice(0, eq).toUpperCase(), kv.slice(eq + 1).toUpperCase()];
    }),
  );

  if (parts.FREQ !== 'WEEKLY') return null;
  // Reject any unsupported parameter so we don't silently misrepresent the rule.
  const supported = new Set(['FREQ', 'UNTIL', 'BYDAY']);
  for (const k of Object.keys(parts)) {
    if (!supported.has(k)) return null;
  }

  let dayOfWeek: number | null = null;
  if (parts.BYDAY) {
    if (parts.BYDAY.includes(',')) return null; // multi-day not modeled
    dayOfWeek = byDayToDow(parts.BYDAY);
    if (dayOfWeek === null) return null;
  }

  let until: string | null = null;
  if (parts.UNTIL) {
    const u = parts.UNTIL;
    const dPart = u.slice(0, 8);
    if (!/^\d{8}$/.test(dPart)) return null;
    until = `${dPart.slice(0, 4)}-${dPart.slice(4, 6)}-${dPart.slice(6, 8)}`;
  }

  return { frequency: 'weekly', dayOfWeek, until };
}

function byDayToDow(byday: string): number | null {
  switch (byday) {
    case 'SU':
      return 0;
    case 'MO':
      return 1;
    case 'TU':
      return 2;
    case 'WE':
      return 3;
    case 'TH':
      return 4;
    case 'FR':
      return 5;
    case 'SA':
      return 6;
    default:
      return null;
  }
}

/**
 * Map a parsed event title to one of the BSPC CalendarEvent types using a
 * conservative case-insensitive substring heuristic. Anything that doesn't
 * match a known keyword falls through to 'practice', which is the most
 * common case on a swim-team calendar.
 */
export function inferEventType(
  title: string,
): 'practice' | 'meet' | 'team_event' | 'fundraiser' | 'social' {
  const t = title.toLowerCase();
  if (/\b(meet|championship|invitational|finals?|trials?)\b/.test(t)) return 'meet';
  if (/\b(fundraiser|fundraising|raffle|auction|swim-?a-?thon)\b/.test(t)) return 'fundraiser';
  if (/\b(social|banquet|cookout|party|potluck|movie|pizza)\b/.test(t)) return 'social';
  if (/\b(meeting|clinic|workshop|orientation|registration)\b/.test(t)) return 'team_event';
  return 'practice';
}
