/**
 * BSPC Swimming Knowledge Base
 *
 * Centralizes swim coaching knowledge used by AI prompts throughout the app.
 * Provides drill libraries, group-level expectations, common faults,
 * interval references, glossary, and team philosophy.
 */

// ---------------------------------------------------------------------------
// Drill Library
// ---------------------------------------------------------------------------

export interface DrillEntry {
  name: string;
  stroke: string;
  description: string;
  focusPoints: string[];
  equipment: string[];
}

export const DRILL_LIBRARY: DrillEntry[] = [
  // Freestyle
  {
    name: 'Catch-Up Drill',
    stroke: 'freestyle',
    description: 'One arm stays extended until the other completes a full stroke and touches it.',
    focusPoints: ['front-end catch', 'full extension', 'rotation'],
    equipment: [],
  },
  {
    name: 'Fingertip Drag',
    stroke: 'freestyle',
    description: 'Drag fingertips along the water surface during recovery.',
    focusPoints: ['high elbow recovery', 'relaxed hand'],
    equipment: [],
  },
  {
    name: 'Fist Drill',
    stroke: 'freestyle',
    description: 'Swim with closed fists to develop forearm feel.',
    focusPoints: ['forearm catch', 'hand awareness'],
    equipment: [],
  },
  {
    name: '6-Kick Switch',
    stroke: 'freestyle',
    description: 'Six kicks on one side, then switch to the other with a full stroke.',
    focusPoints: ['body rotation', 'balance', 'kick timing'],
    equipment: ['kickboard optional'],
  },
  {
    name: 'Sculling',
    stroke: 'freestyle',
    description: 'In-sweep/out-sweep hand patterns while floating.',
    focusPoints: ['hand pitch', 'feel for the water'],
    equipment: [],
  },
  {
    name: 'Single-Arm Freestyle',
    stroke: 'freestyle',
    description: 'Swim freestyle using one arm only, other arm extended or at side.',
    focusPoints: ['catch', 'pull-through', 'rotation'],
    equipment: [],
  },
  {
    name: 'Tarzan Drill',
    stroke: 'freestyle',
    description: 'Swim freestyle with head up, eyes forward.',
    focusPoints: ['high elbow catch', 'hip drive', 'core engagement'],
    equipment: [],
  },
  {
    name: 'Distance Per Stroke',
    stroke: 'freestyle',
    description: 'Minimize stroke count per length while maintaining speed.',
    focusPoints: ['efficiency', 'glide', 'full extension'],
    equipment: [],
  },

  // Backstroke
  {
    name: 'Spinner Drill',
    stroke: 'backstroke',
    description: 'Alternate 6 strokes backstroke, 6 strokes freestyle without stopping.',
    focusPoints: ['rotation', 'transitions'],
    equipment: [],
  },
  {
    name: 'Cup Drill',
    stroke: 'backstroke',
    description: 'Balance a cup of water on the forehead while swimming backstroke.',
    focusPoints: ['head stability', 'smooth rotation'],
    equipment: ['cup'],
  },
  {
    name: 'Double-Arm Backstroke',
    stroke: 'backstroke',
    description: 'Pull both arms simultaneously while on back.',
    focusPoints: ['kick tempo', 'core engagement', 'undulation'],
    equipment: [],
  },
  {
    name: 'Backstroke Kick with Rotation',
    stroke: 'backstroke',
    description: 'Kick on back with arms at sides, rotating shoulders side to side.',
    focusPoints: ['kick from hips', 'rotation timing'],
    equipment: [],
  },

  // Breaststroke
  {
    name: 'Pull-Kick-Glide',
    stroke: 'breaststroke',
    description: 'Separate pull, kick, and glide into three distinct phases.',
    focusPoints: ['timing', 'streamline', 'glide distance'],
    equipment: [],
  },
  {
    name: '2-Kick 1-Pull',
    stroke: 'breaststroke',
    description: 'Two breaststroke kicks for every one pull.',
    focusPoints: ['kick power', 'streamline position'],
    equipment: [],
  },
  {
    name: 'Breaststroke with Dolphin Kick',
    stroke: 'breaststroke',
    description: 'Replace breaststroke kick with dolphin kick.',
    focusPoints: ['pull timing', 'body undulation'],
    equipment: [],
  },
  {
    name: 'Vertical Breaststroke Kick',
    stroke: 'breaststroke',
    description: 'Kick breaststroke vertically in deep water.',
    focusPoints: ['narrow kick', 'ankle flexibility', 'power'],
    equipment: [],
  },

  // Butterfly
  {
    name: 'Single-Arm Fly',
    stroke: 'butterfly',
    description: 'One arm strokes butterfly while the other stays extended.',
    focusPoints: ['timing', 'entry position', 'kick coordination'],
    equipment: [],
  },
  {
    name: '3-3-3 Fly Drill',
    stroke: 'butterfly',
    description: '3 right arm, 3 left arm, 3 full strokes butterfly.',
    focusPoints: ['catch', 'symmetry', 'breathing timing'],
    equipment: [],
  },
  {
    name: 'Vertical Dolphin Kick',
    stroke: 'butterfly',
    description: 'Dolphin kick vertically in deep water, arms crossed.',
    focusPoints: ['core undulation', 'ankle snap', 'kick from hips'],
    equipment: [],
  },
  {
    name: 'Underwater Dolphin Kick',
    stroke: 'butterfly',
    description: 'Streamline push-off and dolphin kick underwater as far as possible.',
    focusPoints: ['streamline tightness', 'kick amplitude', 'core engagement'],
    equipment: [],
  },

  // Kick
  {
    name: 'Vertical Kick',
    stroke: 'kick',
    description: 'Kick in place vertically in deep water.',
    focusPoints: ['kick from hips', 'ankle flexibility', 'tempo'],
    equipment: [],
  },
  {
    name: 'Board Kick',
    stroke: 'kick',
    description: 'Kick with a kickboard for any stroke.',
    focusPoints: ['kick consistency', 'body position'],
    equipment: ['kickboard'],
  },
  {
    name: 'Streamline Kick on Back',
    stroke: 'kick',
    description: 'Kick on back with arms in streamline above head.',
    focusPoints: ['core stability', 'hip position', 'kick depth'],
    equipment: [],
  },

  // Turns & Underwaters
  {
    name: 'Flip Turn Series',
    stroke: 'turns',
    description: 'Progressive flip turn practice from standing to swimming into wall.',
    focusPoints: ['approach speed', 'tuck timing', 'push-off depth'],
    equipment: [],
  },
  {
    name: 'Open Turn Drill',
    stroke: 'turns',
    description: 'Practice touch-and-go open turns for IM and breaststroke.',
    focusPoints: ['two-hand touch', 'quick rotation', 'streamline push-off'],
    equipment: [],
  },
  {
    name: 'Breakout Drill',
    stroke: 'underwaters',
    description: 'Push off wall, dolphin kick to 15m, breakout into stroke.',
    focusPoints: ['streamline', 'kick count', 'breakout timing'],
    equipment: [],
  },
];

// ---------------------------------------------------------------------------
// Group Skill Priorities
// ---------------------------------------------------------------------------

export interface GroupSkills {
  skillPriorities: string[];
  secondarySkills: string[];
}

export const GROUP_SKILL_PRIORITIES: Record<string, GroupSkills> = {
  Silver: {
    skillPriorities: [
      'body position',
      'basic stroke mechanics',
      'breathing patterns',
      'streamline position',
      'flutter kick from hips',
    ],
    secondarySkills: [
      'flip turns introduction',
      'backstroke flags awareness',
      'distance per stroke',
    ],
  },
  Gold: {
    skillPriorities: [
      'stroke efficiency',
      'turns & push-offs',
      'breathing bilateral',
      'kick timing',
      'start mechanics',
    ],
    secondarySkills: [
      'race strategy basics',
      'IM transitions',
      'underwaters to 10m',
      'threshold pacing',
    ],
  },
  Advanced: {
    skillPriorities: [
      'race-pace training',
      'underwaters to 12-15m',
      'breakout consistency',
      'negative splitting',
      'stroke count targets',
    ],
    secondarySkills: [
      'mental race prep',
      'relay exchanges',
      'advanced periodization',
      'lactate tolerance',
    ],
  },
  Diamond: {
    skillPriorities: [
      'race strategy execution',
      'underwaters to 15m',
      'tempo control',
      'pace clock independence',
      'championship taper',
    ],
    secondarySkills: [
      'video self-analysis',
      'race modeling',
      'advanced starts',
      'psychological preparation',
    ],
  },
  Platinum: {
    skillPriorities: [
      'elite stroke refinement',
      'race modeling',
      'underwaters to 15m+',
      'advanced pacing',
      'championship preparation',
    ],
    secondarySkills: [
      'leadership & mentoring',
      'periodization awareness',
      'competition mindset',
      'self-coaching skills',
    ],
  },
};

// ---------------------------------------------------------------------------
// Common Faults by Group
// ---------------------------------------------------------------------------

export interface FaultEntry {
  description: string;
  correction: string;
  relatedDrills: string[];
}

export const COMMON_FAULTS: Record<string, FaultEntry[]> = {
  Silver: [
    {
      description: 'Head lifting to breathe instead of rotating',
      correction: 'Emphasize chin to shoulder, one goggle in the water',
      relatedDrills: ['6-Kick Switch', 'Single-Arm Freestyle'],
    },
    {
      description: 'Flat body position with no rotation',
      correction: 'Teach hip-driven rotation with kick drills on side',
      relatedDrills: ['6-Kick Switch', 'Catch-Up Drill'],
    },
    {
      description: 'Knee-driven kick instead of hip-driven',
      correction: 'Vertical kick and board kick with straight-leg emphasis',
      relatedDrills: ['Vertical Kick', 'Board Kick'],
    },
    {
      description: 'Wide hand entry crossing midline or too wide',
      correction: 'Fingertip drag to feel recovery path',
      relatedDrills: ['Fingertip Drag', 'Catch-Up Drill'],
    },
    {
      description: 'No streamline off walls',
      correction: 'Push-off drills with streamline holds for distance',
      relatedDrills: ['Breakout Drill'],
    },
  ],
  Gold: [
    {
      description: 'Dropped elbow during catch phase',
      correction: 'Fist drill and sculling to build forearm awareness',
      relatedDrills: ['Fist Drill', 'Sculling'],
    },
    {
      description: 'Incomplete flip turns (standing up before pushing off)',
      correction: 'Flip turn series with progressive approach speeds',
      relatedDrills: ['Flip Turn Series'],
    },
    {
      description: 'No underwater dolphin kicks off walls',
      correction: 'Breakout drill with kick count targets (3-5 kicks)',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick'],
    },
    {
      description: 'Breathing every stroke in freestyle',
      correction: 'Pattern breathing sets (every 3 or 5)',
      relatedDrills: ['Distance Per Stroke', 'Catch-Up Drill'],
    },
    {
      description: 'Breaststroke kick with knees too wide',
      correction: 'Vertical breaststroke kick with narrow knee focus',
      relatedDrills: ['Vertical Breaststroke Kick', 'Pull-Kick-Glide'],
    },
  ],
  Advanced: [
    {
      description: 'Weak underwaters past 10m mark',
      correction: 'Targeted UDK sets with distance markers',
      relatedDrills: ['Underwater Dolphin Kick', 'Breakout Drill'],
    },
    {
      description: 'Inconsistent breakout stroke timing',
      correction: 'Breakout drill with first-stroke focus',
      relatedDrills: ['Breakout Drill'],
    },
    {
      description: 'Poor negative split execution',
      correction: 'Descend sets with pace clock targets',
      relatedDrills: ['Distance Per Stroke'],
    },
    {
      description: 'Butterfly falling apart on second 50',
      correction: 'Single-arm fly and 3-3-3 for endurance',
      relatedDrills: ['Single-Arm Fly', '3-3-3 Fly Drill'],
    },
    {
      description: 'Slow IM transitions',
      correction: 'Transition-specific drills focusing on wall work',
      relatedDrills: ['Open Turn Drill', 'Flip Turn Series'],
    },
  ],
  Diamond: [
    {
      description: 'Over-gliding on breaststroke at race pace',
      correction: 'Tempo trainer sets, race-pace pull-kick combos',
      relatedDrills: ['Pull-Kick-Glide', '2-Kick 1-Pull'],
    },
    {
      description: 'Losing speed into turns (deceleration zone)',
      correction: 'Turn-specific sets with split timing',
      relatedDrills: ['Flip Turn Series'],
    },
    {
      description: 'Breakout above 15m inconsistently',
      correction: 'Targeted 15m breakout sets with accountability',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick'],
    },
    {
      description: 'Start entry too shallow',
      correction: 'Start progressions focusing on entry angle and depth',
      relatedDrills: [],
    },
    {
      description: 'Lack of pace awareness without clock',
      correction: 'Blind swim sets with pace prediction',
      relatedDrills: ['Distance Per Stroke'],
    },
  ],
  Platinum: [
    {
      description: 'Championship race execution falling apart',
      correction: 'Race modeling with split targets and visualization',
      relatedDrills: [],
    },
    {
      description: 'Technique breakdown under fatigue',
      correction: 'Back-half technique focus sets',
      relatedDrills: ['Distance Per Stroke', 'Single-Arm Freestyle'],
    },
    {
      description: 'Relay exchange timing inconsistencies',
      correction: 'Relay start practice with timing feedback',
      relatedDrills: [],
    },
    {
      description: 'Over-training signs in taper',
      correction: 'Recovery protocol with reduced volume and race-pace sprints',
      relatedDrills: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Interval Reference by Group (per 100 yards, common send-off intervals)
// ---------------------------------------------------------------------------

export const INTERVAL_REFERENCE: Record<string, Record<string, string>> = {
  Silver: {
    'Freestyle easy': '2:30',
    'Freestyle moderate': '2:15',
    'Backstroke easy': '2:45',
    'Kick 50s': '1:15',
    'IM 100': '3:00',
  },
  Gold: {
    'Freestyle easy': '2:00',
    'Freestyle moderate': '1:45',
    'Freestyle fast': '1:30',
    'Backstroke easy': '2:15',
    'Breaststroke easy': '2:15',
    'Kick 100s': '2:30',
    'IM 100': '2:30',
  },
  Advanced: {
    'Freestyle easy': '1:30',
    'Freestyle moderate': '1:20',
    'Freestyle fast': '1:10',
    'Backstroke moderate': '1:35',
    'Breaststroke moderate': '1:40',
    'Butterfly moderate': '1:35',
    'Kick 100s': '2:00',
    'IM 100': '1:45',
  },
  Diamond: {
    'Freestyle easy': '1:20',
    'Freestyle moderate': '1:10',
    'Freestyle fast': '1:05',
    'Backstroke moderate': '1:25',
    'Breaststroke moderate': '1:30',
    'Butterfly moderate': '1:20',
    'Kick 100s': '1:45',
    'IM 100': '1:30',
  },
  Platinum: {
    'Freestyle easy': '1:15',
    'Freestyle moderate': '1:05',
    'Freestyle fast': '1:00',
    'Backstroke moderate': '1:20',
    'Breaststroke moderate': '1:25',
    'Butterfly moderate': '1:15',
    'Kick 100s': '1:40',
    'IM 100': '1:25',
  },
};

// ---------------------------------------------------------------------------
// Swimming Glossary
// ---------------------------------------------------------------------------

export const SWIMMING_GLOSSARY: { term: string; definition: string }[] = [
  {
    term: 'DPS',
    definition: 'Distance Per Stroke -- maximizing distance traveled per stroke cycle',
  },
  { term: 'UDK', definition: 'Underwater Dolphin Kick' },
  {
    term: 'IM',
    definition: 'Individual Medley -- butterfly, backstroke, breaststroke, freestyle in order',
  },
  { term: 'SCY', definition: 'Short Course Yards (25-yard pool)' },
  { term: 'LCM', definition: 'Long Course Meters (50-meter pool)' },
  { term: 'SCM', definition: 'Short Course Meters (25-meter pool)' },
  { term: 'Descend', definition: 'Each repeat faster than the previous one' },
  { term: 'Negative split', definition: 'Second half of a swim faster than the first half' },
  {
    term: 'Threshold',
    definition: 'Training intensity at or near lactate threshold, sustainable hard effort',
  },
  { term: 'Send-off', definition: 'The interval time on which swimmers leave the wall' },
  {
    term: 'Breakout',
    definition: 'The transition from underwater to surface swimming after a turn or start',
  },
  {
    term: 'Streamline',
    definition: 'Body position with arms extended overhead, hands stacked, biceps behind ears',
  },
  { term: 'Pull', definition: 'Swimming with a pull buoy between the legs (no kick)' },
  { term: 'Kick', definition: 'Leg-only swimming, often with a kickboard' },
  {
    term: 'Drill',
    definition: 'A modified swimming exercise focusing on a specific technique element',
  },
  { term: 'Build', definition: 'Gradually increase speed within a single repeat' },
  { term: 'EZ', definition: 'Easy effort swimming' },
  { term: 'Best Average', definition: 'Hold the fastest sustainable pace across all repeats' },
  { term: 'Pace clock', definition: 'The large clock on the pool deck used for timing intervals' },
  { term: 'Flags', definition: 'Backstroke flags hung 5 yards/meters from each wall' },
  {
    term: 'T-mark',
    definition: 'The T-shaped marking on the pool bottom near the wall for turn judging',
  },
  { term: 'Touch pad', definition: 'Electronic timing pad on the wall at swim meets' },
  { term: 'Taper', definition: 'Reduced training volume before a major competition' },
  {
    term: 'Warm-down',
    definition: 'Easy swimming after a race to aid recovery (also called cool-down)',
  },
  { term: 'Split', definition: 'Time for a portion of a race (e.g., first 50 of a 100)' },
  {
    term: 'Relay exchange',
    definition: 'The take-off of the next relay swimmer as the previous swimmer finishes',
  },
  { term: 'Heat sheet', definition: 'Printed listing of all events and entries at a swim meet' },
  { term: 'Seed time', definition: 'The entry time used to place a swimmer in a heat' },
  { term: 'Goal time', definition: 'Target time a swimmer aims to achieve' },
  {
    term: 'Long axis',
    definition: 'Freestyle and backstroke (rotation around the long axis of the body)',
  },
  {
    term: 'Short axis',
    definition: 'Breaststroke and butterfly (undulation around the short axis)',
  },
  { term: 'Catch', definition: 'The initial phase of the pull where the hand engages the water' },
  {
    term: 'EVF',
    definition:
      'Early Vertical Forearm -- getting the forearm perpendicular to the surface early in the catch',
  },
  {
    term: 'Recovery',
    definition:
      'The phase of the stroke where the arm returns to the starting position above water',
  },
  { term: 'Flip turn', definition: 'A somersault turn used in freestyle and backstroke' },
  { term: 'Open turn', definition: 'A two-hand touch turn used in breaststroke and butterfly' },
];

// ---------------------------------------------------------------------------
// Breakout Focus Points
// ---------------------------------------------------------------------------

export const BREAKOUT_FOCUS_POINTS: string[] = [
  'Maintain streamline tightness through the entire underwater phase',
  'Consistent dolphin kick count off every wall (aim for group-appropriate target)',
  'First stroke after breakout should be aggressive and complete',
  'Head should stay neutral -- do not lift to breathe on first stroke',
  'Breakout at speed -- do not decelerate before surfacing',
  'Stay below the surface until kick speed matches or exceeds surface speed',
  'For backstroke: one arm breakout with strong first pull',
  'For breaststroke: full pullout sequence (pull, kick, streamline)',
  'For butterfly: hands should enter simultaneously on breakout stroke',
  'Target 15-meter mark for Diamond/Platinum, 10-12m for Gold, 8-10m for Silver',
];

// ---------------------------------------------------------------------------
// Team Philosophy
// ---------------------------------------------------------------------------

export const TEAM_PHILOSOPHY: string[] = [
  'Process over outcome -- focus on technique improvement, not just times',
  'Every wall matters -- turns and underwaters are free speed',
  'Race your own race -- internal focus, not looking at competitors',
  'Consistent attendance builds fitness; fitness enables fast swimming',
  'Challenge yourself in practice to build confidence for meets',
  'Support your teammates -- fast teams are built on encouragement',
  'Learn to read the pace clock -- self-awareness is a competitive advantage',
  'Effort is a choice -- talent is developed through deliberate practice',
];
