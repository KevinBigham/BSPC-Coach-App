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
