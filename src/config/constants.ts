export const GROUPS = [
  'Bronze',
  'Silver',
  'Gold',
  'Advanced',
  'Platinum',
  'Diamond',
] as const;

export type Group = (typeof GROUPS)[number];

export const STROKES = [
  'Freestyle',
  'Backstroke',
  'Breaststroke',
  'Butterfly',
  'IM',
] as const;

export type Stroke = (typeof STROKES)[number];

export const COURSES = ['SCY', 'SCM', 'LCM'] as const;
export type Course = (typeof COURSES)[number];

export const EVENTS = [
  '25 Free', '50 Free', '100 Free', '200 Free', '500 Free', '1000 Free', '1650 Free',
  '25 Back', '50 Back', '100 Back', '200 Back',
  '25 Breast', '50 Breast', '100 Breast', '200 Breast',
  '25 Fly', '50 Fly', '100 Fly', '200 Fly',
  '100 IM', '200 IM', '400 IM',
] as const;

export type SwimEvent = (typeof EVENTS)[number];

export const NOTE_TAGS = [
  'technique',
  'freestyle',
  'backstroke',
  'breaststroke',
  'butterfly',
  'IM',
  'starts',
  'turns',
  'underwaters',
  'breakouts',
  'kick',
  'pull',
  'drill',
  'endurance',
  'speed',
  'race strategy',
  'mental',
  'attendance',
  'general',
] as const;

export type NoteTag = (typeof NOTE_TAGS)[number];

export const SET_CATEGORIES = ['Warmup', 'Pre-Set', 'Main Set', 'Cooldown'] as const;
export type SetCategory = (typeof SET_CATEGORIES)[number];

export const BUILDER_STROKES = [
  'Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'IM',
  'Choice', 'Kick', 'Pull', 'Drill', 'Scull',
] as const;
export type BuilderStroke = (typeof BUILDER_STROKES)[number];

export const COMMON_DISTANCES = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500] as const;

export const COMMON_INTERVALS = ['0:30', '0:35', '0:40', '0:45', '0:50', '1:00', '1:05', '1:10', '1:15', '1:20', '1:30', '1:40', '1:45', '2:00', '2:30', '3:00'] as const;

export const STANDARD_LEVELS = ['B', 'BB', 'A', 'AA', 'AAA', 'AAAA'] as const;
export type StandardLevel = (typeof STANDARD_LEVELS)[number];

export const AGE_GROUPS = ['10&U', '11-12', '13-14', '15-16', '17-18'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const CALENDAR_EVENT_TYPES = ['practice', 'meet', 'team_event', 'fundraiser', 'social'] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const MEET_STATUSES = ['upcoming', 'in_progress', 'completed', 'cancelled'] as const;
export type MeetStatus = (typeof MEET_STATUSES)[number];

export const RELAY_EVENTS = [
  '200 Free Relay',
  '400 Free Relay',
  '800 Free Relay',
  '200 Medley Relay',
  '400 Medley Relay',
] as const;
export type RelayEvent = (typeof RELAY_EVENTS)[number];

export const MEDLEY_RELAY_ORDER = ['Backstroke', 'Breaststroke', 'Butterfly', 'Freestyle'] as const;

export const STANDARD_MEET_EVENTS = [
  { name: '200 Medley Relay', isRelay: true },
  { name: '200 Free', isRelay: false },
  { name: '200 IM', isRelay: false },
  { name: '50 Free', isRelay: false },
  { name: '100 Fly', isRelay: false },
  { name: '100 Free', isRelay: false },
  { name: '500 Free', isRelay: false },
  { name: '200 Free Relay', isRelay: true },
  { name: '100 Back', isRelay: false },
  { name: '100 Breast', isRelay: false },
  { name: '400 Free Relay', isRelay: true },
] as const;

export const AUDIO_KEYWORD_BOOST = [
  'freestyle', 'backstroke', 'butterfly', 'breaststroke',
  'IM', 'medley', 'flip turn', 'open turn', 'streamline',
  'DPS', 'distance per stroke', 'catch', 'pull', 'kick',
  'breakout', 'underwater', 'tempo', 'stroke count', 'splits',
  'drill', 'scull', 'dolphin kick', 'flutter kick',
  'early vertical forearm', 'EVF', 'high elbow', 'body roll',
  'head position', 'breathing', 'bilateral', 'hypoxic',
  'descend', 'negative split', 'best average', 'threshold',
  'sprint', 'warm up', 'cool down', 'main set', 'kick set',
];
