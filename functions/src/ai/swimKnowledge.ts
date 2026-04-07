/**
 * BSPC Swimming Knowledge Base
 *
 * Centralizes swim coaching knowledge used by AI prompts throughout the app.
 * Provides drill libraries, group-level expectations, common faults,
 * interval references, glossary, breakout focus points, and team philosophy.
 *
 * All data sourced from actual BSPC team documents, workouts, and standards.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Group = 'Bronze' | 'Silver' | 'Gold' | 'Advanced' | 'Platinum' | 'Diamond';

type Stroke =
  | 'freestyle'
  | 'backstroke'
  | 'breaststroke'
  | 'butterfly'
  | 'kick'
  | 'underwater'
  | 'turns'
  | 'starts';

export interface DrillEntry {
  name: string;
  stroke: Stroke;
  description: string;
  focusPoints: string[];
  equipment: string[];
}

export interface GroupSkills {
  entryStandards: string[];
  skillPriorities: string[];
  secondarySkills: string[];
  promotionStandards: string[];
}

export interface FaultEntry {
  description: string;
  correction: string;
  relatedDrills: string[];
}

export interface IntervalSet {
  distances: Record<string, string>;
}

export interface GlossaryEntry {
  term: string;
  abbreviation?: string;
  definition: string;
}

// ---------------------------------------------------------------------------
// Drill Library
// ---------------------------------------------------------------------------

export const DRILL_LIBRARY: DrillEntry[] = [
  // ---- FREESTYLE ----
  {
    name: 'Finger-Tip Drag',
    stroke: 'freestyle',
    description:
      'Drag fingertips along water surface during recovery; focus on high elbow recovery and full arm extension before EVF underwater pull.',
    focusPoints: ['high elbow recovery', 'full arm extension', 'relaxed hand', 'EVF setup'],
    equipment: [],
  },
  {
    name: 'Catch-Up Drill',
    stroke: 'freestyle',
    description:
      'One arm stays extended until the other arm catches up; focuses on full extension and front-quadrant timing.',
    focusPoints: ['full extension', 'front-quadrant timing', 'rotation', 'patience at the front'],
    equipment: [],
  },
  {
    name: 'Single-Arm Drill',
    stroke: 'freestyle',
    description: 'Swim with one arm only (other at side); focus on rotation and arm mechanics.',
    focusPoints: ['rotation', 'catch mechanics', 'pull-through path', 'body position'],
    equipment: [],
  },
  {
    name: 'Single-Arm Kickboard Drill',
    stroke: 'freestyle',
    description:
      'Hold kickboard with one arm, stroke with the other; focus on breath-timing (head turn begins as soon as underwater pull begins).',
    focusPoints: ['breath timing', 'head turn initiation', 'pull timing', 'body line'],
    equipment: ['kickboard'],
  },
  {
    name: '3-Pull 6-Kick-Switch',
    stroke: 'freestyle',
    description:
      '3 strokes then 6 flutter kicks on side; focus on "surfing" position and keeping opposite-side arm up/straight until breath complete.',
    focusPoints: ['surfing position', 'balance on side', 'arm extension', 'kick consistency'],
    equipment: [],
  },
  {
    name: '2-Pull 6-Kick-Switch',
    stroke: 'freestyle',
    description:
      'Same concept as 3-Pull 6-Kick-Switch but with fewer pulls; more time in side position.',
    focusPoints: ['extended side balance', 'rotation timing', 'core stability'],
    equipment: [],
  },
  {
    name: 'Wiffle Ball Drag',
    stroke: 'freestyle',
    description:
      'Drag wiffle balls during freestyle; focus on entering shoulder-width and reaching full extension.',
    focusPoints: ['shoulder-width entry', 'full extension', 'resistance awareness'],
    equipment: ['wiffle balls'],
  },
  {
    name: 'April Showers w/ Wiffle Ball',
    stroke: 'freestyle',
    description: 'Focus on finishing the pull (pushing water past hip) while holding wiffle balls.',
    focusPoints: ['finishing the pull', 'pushing past hip', 'full stroke completion'],
    equipment: ['wiffle balls'],
  },
  {
    name: 'Closed Fist Drill',
    stroke: 'freestyle',
    description:
      'Swim freestyle with closed fists; emphasizes forearm as paddle, develops feel for the water.',
    focusPoints: ['forearm as paddle', 'feel for the water', 'catch awareness', 'EVF'],
    equipment: [],
  },
  {
    name: 'Underwater Freestyle Recovery Drill',
    stroke: 'freestyle',
    description:
      'Recover hand underwater instead of over; eliminates shoulder issues, focuses on pull mechanics.',
    focusPoints: ['pull mechanics', 'shoulder-friendly recovery', 'underwater path'],
    equipment: [],
  },
  {
    name: 'Superman Drill',
    stroke: 'freestyle',
    description:
      'Arms extended forward, kick with face down, breathe by lifting chin; body position awareness.',
    focusPoints: ['body position', 'horizontal alignment', 'kick-driven propulsion'],
    equipment: [],
  },
  {
    name: 'Distance Per Stroke',
    stroke: 'freestyle',
    description: 'Minimize stroke count per length while maintaining speed.',
    focusPoints: ['efficiency', 'glide', 'full extension', 'stroke count awareness'],
    equipment: [],
  },
  {
    name: 'Tarzan Drill',
    stroke: 'freestyle',
    description: 'Swim freestyle with head up, eyes forward.',
    focusPoints: ['high elbow catch', 'hip drive', 'core engagement', 'water polo stroke'],
    equipment: [],
  },

  // ---- BACKSTROKE ----
  {
    name: 'Reverse Finger-Tip Drag',
    stroke: 'backstroke',
    description: 'Focus on starting "hook" in underwater pull ASAP (immediate sharp elbow-bend).',
    focusPoints: ['immediate elbow-bend', 'sharp hook entry', 'pull initiation'],
    equipment: [],
  },
  {
    name: 'Mid-Air Catch-Up',
    stroke: 'backstroke',
    description: 'Wait for recovering arm to pass vertical before pulling arm enters water.',
    focusPoints: ['timing', 'patience at top', 'continuous kick', 'rotation'],
    equipment: [],
  },
  {
    name: 'Reverse Wiffle Ball Drag / Ball Drill',
    stroke: 'backstroke',
    description:
      'Focus on sharp and strong elbow-bend throughout underwater pull while holding wiffle balls.',
    focusPoints: ['elbow-bend power', 'pull strength', 'resistance training'],
    equipment: ['wiffle balls'],
  },
  {
    name: 'Single-Arm Backstroke',
    stroke: 'backstroke',
    description: 'One arm at side, focus on rotation and pull mechanics.',
    focusPoints: ['rotation', 'pull mechanics', 'shoulder engagement', 'body line'],
    equipment: [],
  },
  {
    name: '6-Kick-Switch on Back',
    stroke: 'backstroke',
    description: 'Flutter kick on back, rotate side-to-side every 6 kicks.',
    focusPoints: ['rotation timing', 'balance on side', 'kick consistency', 'hip rotation'],
    equipment: [],
  },
  {
    name: 'Spinner Drill',
    stroke: 'backstroke',
    description: 'Alternate 6 strokes backstroke, 6 strokes freestyle without stopping.',
    focusPoints: ['rotation transitions', 'continuous swimming', 'body awareness'],
    equipment: [],
  },
  {
    name: 'Cup Drill',
    stroke: 'backstroke',
    description: 'Balance a cup of water on the forehead while swimming backstroke.',
    focusPoints: ['head stability', 'smooth rotation', 'steady body line'],
    equipment: ['cup'],
  },
  {
    name: 'Double-Arm Backstroke',
    stroke: 'backstroke',
    description: 'Pull both arms simultaneously while on back.',
    focusPoints: ['kick tempo', 'core engagement', 'undulation', 'simultaneous pull power'],
    equipment: [],
  },

  // ---- BREASTSTROKE ----
  {
    name: 'Dolphin Kick w/ BR Pull',
    stroke: 'breaststroke',
    description:
      'Use dolphin kick instead of breaststroke kick while doing BR arm pull; focus on getting hips on top of water during arm recovery.',
    focusPoints: ['hips on top of water', 'arm recovery position', 'body undulation'],
    equipment: [],
  },
  {
    name: 'Triple Pullout',
    stroke: 'breaststroke',
    description: '3 full breaststroke pullouts in a row; go at least halfway underwater.',
    focusPoints: ['pullout sequence', 'depth control', 'streamline hold', 'underwater distance'],
    equipment: [],
  },
  {
    name: 'BR Pullout Practice',
    stroke: 'breaststroke',
    description: 'Focus on streamline, dolphin kick, pull, kick, breakout timing.',
    focusPoints: ['streamline to dolphin kick', 'pull timing', 'kick timing', 'breakout'],
    equipment: [],
  },
  {
    name: 'Scull w/ BR Kick',
    stroke: 'breaststroke',
    description: 'Sculling arms with breaststroke kick; timing and feel.',
    focusPoints: ['kick-pull timing', 'feel for the water', 'hand pitch'],
    equipment: [],
  },
  {
    name: '2-Kick 1-Pull',
    stroke: 'breaststroke',
    description: 'Two kicks per arm stroke; emphasizes kick power and streamline hold.',
    focusPoints: ['kick power', 'streamline position', 'glide distance', 'kick efficiency'],
    equipment: [],
  },
  {
    name: 'Pull-Kick-Glide',
    stroke: 'breaststroke',
    description: 'Separate pull, kick, and glide into three distinct phases.',
    focusPoints: ['timing separation', 'streamline', 'glide distance', 'phase awareness'],
    equipment: [],
  },
  {
    name: 'Vertical Breaststroke Kick',
    stroke: 'breaststroke',
    description: 'Kick breaststroke vertically in deep water.',
    focusPoints: ['narrow kick', 'ankle flexibility', 'power', 'knees-in focus'],
    equipment: [],
  },

  // ---- BUTTERFLY ----
  {
    name: 'Flow Drill / Superman Flow',
    stroke: 'butterfly',
    description:
      'Butterfly body undulation without arms (or with arms extended); focus on keeping hips high and near surface. Same "flow" as underwater dolphin kick.',
    focusPoints: ['hips near surface', 'body undulation', 'core-driven movement', 'relaxation'],
    equipment: [],
  },
  {
    name: '2-2-2 Drill',
    stroke: 'butterfly',
    description:
      '2 right arm strokes, 2 left arm strokes, 2 full butterfly strokes; builds timing.',
    focusPoints: ['timing', 'single-arm coordination', 'full stroke integration'],
    equipment: [],
  },
  {
    name: '3-3-3 Drill',
    stroke: 'butterfly',
    description:
      '3 right arm strokes, 3 left arm strokes, 3 full butterfly strokes; builds timing and symmetry.',
    focusPoints: ['catch symmetry', 'breathing timing', 'arm coordination'],
    equipment: [],
  },
  {
    name: '1-1-1 Drill',
    stroke: 'butterfly',
    description: 'Alternating single arms with full strokes: 1 right, 1 left, 1 full.',
    focusPoints: ['quick transitions', 'timing consistency', 'rhythm'],
    equipment: [],
  },
  {
    name: 'Single-Arm Butterfly',
    stroke: 'butterfly',
    description: 'One arm fly, other arm extended; focus on timing and body position.',
    focusPoints: ['kick timing', 'entry position', 'body position', 'undulation'],
    equipment: [],
  },
  {
    name: 'Scull w/ Dolphin Kick',
    stroke: 'butterfly',
    description: 'Sculling motion with continuous dolphin kick; body undulation.',
    focusPoints: ['body undulation', 'hand pitch', 'core connection', 'kick rhythm'],
    equipment: [],
  },
  {
    name: 'Underwater Butterfly Flow',
    stroke: 'butterfly',
    description: 'Flow drill but fully submerged; develops underwater dolphin motion.',
    focusPoints: ['underwater undulation', 'dolphin kick power', 'breath control'],
    equipment: [],
  },

  // ---- UNDERWATER / KICK ----
  {
    name: 'Underwater Dolphin Kick -- Streamline',
    stroke: 'underwater',
    description: 'Maximum distance/speed underwater in streamline position.',
    focusPoints: ['streamline tightness', 'kick amplitude', 'core engagement', 'speed'],
    equipment: [],
  },
  {
    name: 'Underwater Dolphin Kick -- Superman Arms',
    stroke: 'underwater',
    description: 'Same motion but arms wide like superman; changes body dynamics.',
    focusPoints: ['kick power without streamline assist', 'core-driven kick', 'body awareness'],
    equipment: [],
  },
  {
    name: 'Underwater Dolphin Kick -- Side',
    stroke: 'underwater',
    description: 'On right or left side; focus on equal up-kick and down-kick power.',
    focusPoints: ['equal up-kick and down-kick', 'side balance', 'hip engagement'],
    equipment: [],
  },
  {
    name: 'Dolphin Kick on Back -- Streamline',
    stroke: 'underwater',
    description: 'On back in streamline; focus on consistent tempo.',
    focusPoints: ['consistent tempo', 'core engagement', 'kick from hips', 'streamline hold'],
    equipment: [],
  },
  {
    name: 'Vertical Kick',
    stroke: 'kick',
    description: 'Treading position, kick to stay above water; builds kick power.',
    focusPoints: ['kick from hips', 'ankle flexibility', 'tempo', 'power'],
    equipment: [],
  },
  {
    name: 'Sprint Underwater No-Breather',
    stroke: 'underwater',
    description: 'Full 25 underwater without breathing; builds capacity and underwater speed.',
    focusPoints: ['breath control', 'underwater speed', 'kick consistency', 'mental toughness'],
    equipment: [],
  },
  {
    name: 'Flutter Kick w/ Board',
    stroke: 'kick',
    description: 'Standard kick set with kickboard; any stroke kick variation.',
    focusPoints: ['kick consistency', 'body position', 'kick from hips'],
    equipment: ['kickboard'],
  },
  {
    name: 'Streamline Kick on Back',
    stroke: 'kick',
    description: 'Kick on back with arms in streamline above head.',
    focusPoints: ['core stability', 'hip position', 'kick depth', 'streamline hold'],
    equipment: [],
  },

  // ---- TURNS ----
  {
    name: 'Float-to-Flip',
    stroke: 'turns',
    description:
      'From floating position, execute flip turn; focus on straight arms and tight ball.',
    focusPoints: ['straight arms', 'tight tuck', 'quick rotation'],
    equipment: [],
  },
  {
    name: 'Jump Flip',
    stroke: 'turns',
    description: 'Standing jump in pool into flip turn; focus on small/tight ball.',
    focusPoints: ['tight ball', 'fast rotation', 'body control'],
    equipment: [],
  },
  {
    name: 'Kickboard Flip Drill',
    stroke: 'turns',
    description:
      'Hold 2 kickboards, approach wall, flip turn; keeps arms still to focus on rotation.',
    focusPoints: ['arms-still rotation', 'approach speed', 'tuck mechanics'],
    equipment: ['kickboard'],
  },
  {
    name: 'Pull Buoy Flip Drill',
    stroke: 'turns',
    description: 'Same as kickboard flip drill but with pull buoys.',
    focusPoints: ['rotation mechanics', 'approach timing', 'push-off position'],
    equipment: ['pull buoy'],
  },
  {
    name: 'Midpool Turns Practice',
    stroke: 'turns',
    description: 'Turns from middle of pool, not full-speed approach; focus on mechanics.',
    focusPoints: ['turn mechanics', 'push-off depth', 'streamline position'],
    equipment: [],
  },
  {
    name: 'IM Transition Turns',
    stroke: 'turns',
    description:
      'Practice each IM transition: fly to back (open turn, push off on back), back to breast (open turn w/ 2-hand touch), breast to free.',
    focusPoints: [
      'fly-to-back transition',
      'back-to-breast touch',
      'breast-to-free transition',
      'quick wall time',
    ],
    equipment: [],
  },
  {
    name: 'Flip Turn Series',
    stroke: 'turns',
    description:
      'Progressive flip turn practice from standing to swimming into wall at increasing speeds.',
    focusPoints: ['approach speed', 'tuck timing', 'push-off depth', 'streamline exit'],
    equipment: [],
  },
  {
    name: 'Open Turn Drill',
    stroke: 'turns',
    description: 'Practice touch-and-go open turns for IM and breaststroke/butterfly.',
    focusPoints: ['two-hand touch', 'quick rotation', 'streamline push-off'],
    equipment: [],
  },

  // ---- STARTS ----
  {
    name: 'Track Start Practice',
    stroke: 'starts',
    description: 'Standard competitive start from blocks.',
    focusPoints: ['reaction time', 'entry angle', 'streamline entry', 'depth control'],
    equipment: ['starting blocks'],
  },
  {
    name: 'Backstroke Start Practice',
    stroke: 'starts',
    description: 'Start from wall/ledge; backstroke-specific start mechanics.',
    focusPoints: ['arch position', 'head entry', 'push-off angle', 'underwater transition'],
    equipment: [],
  },
  {
    name: 'Sprint 15 Yards from Blocks',
    stroke: 'starts',
    description: 'Focus on entry angle, depth control, and breakout.',
    focusPoints: ['entry angle', 'depth control', 'breakout speed', 'first strokes'],
    equipment: ['starting blocks'],
  },
  {
    name: 'Block Start to 25 Underwater',
    stroke: 'starts',
    description: 'Start plus maximum underwater distance; combines start and UDK.',
    focusPoints: [
      'entry depth',
      'streamline hold',
      'dolphin kick transition',
      'underwater distance',
    ],
    equipment: ['starting blocks'],
  },
  {
    name: 'Breakout Drill',
    stroke: 'underwater',
    description: 'Push off wall, dolphin kick to target distance, breakout into stroke.',
    focusPoints: ['streamline', 'kick count', 'breakout timing', 'first stroke quality'],
    equipment: [],
  },

  // ---- ADDITIONAL BREASTSTROKE DRILLS (from Silver/Bronze workouts) ----
  {
    name: 'Heel-Tag on Stomach',
    stroke: 'breaststroke',
    description:
      'Kick breaststroke on stomach, focus on bringing heels up to touch backside; builds proper knee bend and foot position.',
    focusPoints: ['proper knee bend', 'heel-to-backside path', 'foot position', 'kick mechanics'],
    equipment: [],
  },
  {
    name: 'Heel-Tag on Back',
    stroke: 'breaststroke',
    description:
      'Same drill on back; easier to see foot position; teaches proper foot flexion for breaststroke kick.',
    focusPoints: ['foot flexion', 'visual feedback on kick', 'knee bend', 'ankle position'],
    equipment: [],
  },
  {
    name: 'Vertical Kick - Breaststroke',
    stroke: 'breaststroke',
    description:
      'Treading water with breaststroke kick only; builds kick power and proper technique.',
    focusPoints: ['kick power', 'narrow knees', 'proper foot turn-out', 'sustained effort'],
    equipment: [],
  },
  {
    name: 'Vertical Kick - Egg Beater',
    stroke: 'breaststroke',
    description:
      'Alternating breaststroke kick (like treading water); develops coordination and kick independence.',
    focusPoints: ['alternating leg coordination', 'kick independence', 'treading endurance'],
    equipment: [],
  },
  {
    name: '2-Kick 1-Pull BR',
    stroke: 'breaststroke',
    description:
      'Two breaststroke kicks per arm pull; emphasizes kick timing and power in breaststroke.',
    focusPoints: ['kick timing', 'kick power', 'streamline between kicks', 'patience'],
    equipment: [],
  },
  {
    name: 'Duck Walk',
    stroke: 'breaststroke',
    description:
      'Out-of-water drill; walk with feet turned out like a duck; teaches proper foot angle for breaststroke kick.',
    focusPoints: ['foot angle awareness', 'turned-out position', 'breaststroke kick setup'],
    equipment: [],
  },
  {
    name: 'Throw the Pull Buoy Behind You Drill',
    stroke: 'breaststroke',
    description:
      'Pull buoy held behind back, thrust it backward with breaststroke pull motion; teaches powerful finish.',
    focusPoints: ['powerful pull finish', 'hand acceleration', 'pull-through completion'],
    equipment: ['pull buoy'],
  },

  // ---- ADDITIONAL GENERAL DRILLS (from Silver/Bronze workouts) ----
  {
    name: 'Floating Flip Drill',
    stroke: 'turns',
    description:
      'From floating position, execute a flip; focus on initiating flip without arm assistance.',
    focusPoints: ['no-arm flip initiation', 'core engagement', 'tuck mechanics', 'body control'],
    equipment: [],
  },
];

// ---------------------------------------------------------------------------
// Group Skill Priorities (from actual BSPC team documents)
// ---------------------------------------------------------------------------

export const GROUP_SKILL_PRIORITIES: Record<string, GroupSkills> = {
  Bronze: {
    entryStandards: ['Can swim 50 Free without stopping', 'Can swim 50 Kick without stopping'],
    skillPriorities: [
      'Confidence and water comfort',
      'Body control',
      'Listening skills',
      'Introduction to all 4 strokes',
      'Streamline position',
    ],
    secondarySkills: ['Basic kicking technique', 'Breathing patterns', 'Pool etiquette and safety'],
    promotionStandards: [
      '100 IM without stopping',
      '200 FR without stopping',
      '100 Kick w/ kickboard without stopping',
      'Good listening skills demonstrated',
    ],
  },
  Silver: {
    entryStandards: [
      '100 Kick w/ board without stopping',
      '100 IM without stopping',
      '200 FR without stopping',
    ],
    skillPriorities: [
      'Legal in all 4 strokes',
      'Turns (flip turns and open turns)',
      'Introduction to underwater dolphin kick',
      'Introduction to interval training',
    ],
    secondarySkills: [
      'Breathing patterns (bilateral)',
      'Streamline off every wall',
      'Body position fundamentals',
      'Basic stroke counting',
    ],
    promotionStandards: [
      'Legal 200 IM without stopping',
      '3x100 IM on 2:30',
      '300 FR without stopping',
      '4x100 FR on 2:00',
      '3x50 Kick on 1:45',
    ],
  },
  Gold: {
    entryStandards: ['3x50 Kick on 1:45', '3x100 IM on 2:30', '4x100 FR on 2:00'],
    skillPriorities: [
      'Underwater dolphin kick',
      'Sprint vs distance freestyle differentiation',
      'Powerful elbow-bend in backstroke pull',
      'Catch and powerful pull in breaststroke and butterfly',
      'Undulation in butterfly and dolphin kick',
    ],
    secondarySkills: [
      'EVF for distance freestyle',
      'Fast/deep pulls in sprint freestyle',
      'Head/body position in backstroke',
      'Kick-timing in butterfly and breaststroke',
    ],
    promotionStandards: ['3x100 Kick on 2:45', '4x100 IM on 2:00', '5x100 FR on 1:40'],
  },
  Advanced: {
    entryStandards: ['3x100 Kick on 2:45', '4x100 IM on 2:00', '5x100 FR on 1:40'],
    skillPriorities: [
      'Underwater dolphin kick',
      'Tempo and power in sprint freestyle',
      'Efficiency and EVF in distance freestyle',
      'Tempo and power with rotation in backstroke and freestyle',
      'Power and speed with undulation in butterfly',
      'Clean recovery and eliminating drag in breaststroke',
    ],
    secondarySkills: ['Excellent starts', 'Excellent turns', 'Excellent finishes'],
    promotionStandards: ['3x150 Kick on 3:30', '3x200 IM on 4:00', '4x200 FR on 3:00'],
  },
  Platinum: {
    entryStandards: ['3x150 Kick on 3:30', '3x200 IM on 4:00', '4x200 FR on 3:00'],
    skillPriorities: [
      'Underwater dolphin kick off every wall',
      'Studying mastery from experts',
      'FR: Breath-timing, kick-timing, rotation',
      'BK: Standing tall, rotation, steady kick, great underwater',
      'BR: Staying on top of water (hips), eliminating drag, squeezing kick, stroke/kick timing, clean recovery, excellent glide',
      'Fly: Kick-timing, throwing head forward early after breath, hips near surface',
    ],
    secondarySkills: [
      'Race modeling and strategy execution',
      'Self-analysis and video review',
      'Leadership and mentoring younger swimmers',
      'Championship preparation and taper awareness',
    ],
    promotionStandards: ['Same standards as Diamond (combined top group)'],
  },
  Diamond: {
    entryStandards: ['3x150 Kick on 3:30', '3x200 IM on 4:00', '4x200 FR on 3:00'],
    skillPriorities: [
      'Underwater dolphin kick off every wall',
      'Studying mastery from experts',
      'FR: Breath-timing, kick-timing, rotation',
      'BK: Standing tall, rotation, steady kick, great underwater',
      'BR: Staying on top of water (hips), eliminating drag, squeezing kick, stroke/kick timing, clean recovery, excellent glide',
      'Fly: Kick-timing, throwing head forward early after breath, hips near surface',
    ],
    secondarySkills: [
      'Race modeling and strategy execution',
      'Self-analysis and video review',
      'Leadership and mentoring younger swimmers',
      'Championship preparation and taper awareness',
    ],
    promotionStandards: ['N/A -- highest training group'],
  },
};

// ---------------------------------------------------------------------------
// Common Faults by Group
// ---------------------------------------------------------------------------

export const COMMON_FAULTS: Record<string, FaultEntry[]> = {
  Bronze: [
    {
      description: 'Breathing too early / lifting head on freestyle',
      correction: 'Teach chin-to-shoulder rotation; one goggle stays in the water during breath',
      relatedDrills: ['Single-Arm Kickboard Drill', '3-Pull 6-Kick-Switch'],
    },
    {
      description: 'No streamline off walls',
      correction:
        'Push-off drills with streamline holds; emphasize arms squeezing ears, hands stacked',
      relatedDrills: ['Breakout Drill', 'Superman Drill'],
    },
    {
      description: 'Dropping elbow on freestyle catch',
      correction:
        'Finger-Tip Drag to establish high elbow pattern; Superman Drill for body position',
      relatedDrills: ['Finger-Tip Drag', 'Superman Drill'],
    },
    {
      description: 'Legs too deep on backstroke',
      correction: 'Hips up cue; kick on back in streamline to feel proper body line',
      relatedDrills: ['Streamline Kick on Back', '6-Kick-Switch on Back'],
    },
    {
      description: 'Illegal breaststroke kick (scissor kick)',
      correction: 'Vertical breaststroke kick with narrow-knees focus; wall kick drills',
      relatedDrills: ['Vertical Breaststroke Kick', 'Scull w/ BR Kick'],
    },
    {
      description: 'No underwater dolphin kick off walls',
      correction: 'Introduce basic UDK from push-off; count kicks (start with 3)',
      relatedDrills: ['Underwater Dolphin Kick -- Streamline', 'Breakout Drill'],
    },
    {
      description: 'Breathing every stroke on freestyle',
      correction: 'Practice breathing every 3 strokes; use games/challenges to build comfort',
      relatedDrills: ['Catch-Up Drill', 'Distance Per Stroke'],
    },
    {
      description: 'Stopping at walls instead of turning',
      correction:
        'Continuous swimming emphasis; practice approach into open turns and basic flip turns',
      relatedDrills: ['Float-to-Flip', 'Open Turn Drill'],
    },
    {
      description: 'Fear of putting face in water',
      correction:
        'Gradual exposure; blowing bubbles at surface, then submerging; games and positive reinforcement',
      relatedDrills: ['Superman Drill'],
    },
    {
      description: 'Unable to float on back',
      correction:
        'Supported back float practice; hips up cue; head back, ears in water; relaxation emphasis',
      relatedDrills: ['Streamline Kick on Back', '6-Kick-Switch on Back'],
    },
    {
      description: 'Cannot maintain body position during kick',
      correction:
        'Kickboard kick sets with body position focus; kick from hips, not knees; core engagement cues',
      relatedDrills: ['Flutter Kick w/ Board', 'Superman Drill'],
    },
    {
      description: 'Inconsistent breathing patterns',
      correction:
        'Establish rhythmic breathing; practice blowing bubbles out underwater, inhale on turn; count-based breathing patterns',
      relatedDrills: ['3-Pull 6-Kick-Switch', 'Catch-Up Drill'],
    },
    {
      description: 'Not listening to coaching cues during sets',
      correction:
        'Short, clear instructions; check for understanding before sending; positive reinforcement when cues are followed',
      relatedDrills: [],
    },
  ],
  Silver: [
    {
      description: 'Head lifting to breathe instead of rotating',
      correction:
        'Emphasize chin to shoulder, one goggle in the water; practice with kick-switch drills',
      relatedDrills: ['3-Pull 6-Kick-Switch', 'Single-Arm Drill'],
    },
    {
      description: 'Flat body position with no rotation',
      correction: 'Teach hip-driven rotation with kick drills on side',
      relatedDrills: ['3-Pull 6-Kick-Switch', '2-Pull 6-Kick-Switch', 'Catch-Up Drill'],
    },
    {
      description: 'Knee-driven kick instead of hip-driven',
      correction: 'Vertical kick and board kick with straight-leg emphasis; kick from hips cue',
      relatedDrills: ['Vertical Kick', 'Flutter Kick w/ Board'],
    },
    {
      description: 'Wide hand entry crossing midline or too wide',
      correction:
        'Finger-Tip Drag to feel recovery path; Wiffle Ball Drag for shoulder-width entry',
      relatedDrills: ['Finger-Tip Drag', 'Wiffle Ball Drag'],
    },
    {
      description: 'No streamline off walls',
      correction: 'Push-off drills with streamline holds for distance; breakout targets',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Illegal turns (wrong touch on BR/Fly, back-to-breast issues)',
      correction: 'Dedicated IM transition turn practice; wall-approach drills',
      relatedDrills: ['IM Transition Turns', 'Open Turn Drill'],
    },
    {
      description: 'Illegal breaststroke kick (scissor kick)',
      correction:
        'Most common DQ for Silver swimmers; vertical breaststroke kick with narrow-knees focus; Heel-Tag drills for proper foot position',
      relatedDrills: ['Vertical Kick - Breaststroke', 'Heel-Tag on Stomach', 'Heel-Tag on Back'],
    },
    {
      description: 'Not going deep enough on push-offs before underwater dolphin kick',
      correction:
        'Push off aiming for depth, not distance; streamline down before kicking out; target at least 1 body-length depth',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Not streamlining before push-off on turns',
      correction: 'Hands into streamline position before feet leave wall; squeeze ears with arms',
      relatedDrills: ['Breakout Drill', 'Flip Turn Series'],
    },
    {
      description: 'Stopping at walls instead of continuous swimming into turns',
      correction:
        'Continuous swimming emphasis; practice approach speed into walls; no grabbing the wall',
      relatedDrills: ['Float-to-Flip', 'Midpool Turns Practice', 'Open Turn Drill'],
    },
    {
      description: 'Breathing every stroke on freestyle sprint',
      correction:
        'Practice breathing every 3 strokes; build up to every 5 on 25s; breathing pattern awareness',
      relatedDrills: ['Catch-Up Drill', 'Distance Per Stroke'],
    },
    {
      description: 'Head movement too large during freestyle breathing',
      correction: 'Chin to shoulder only; one goggle stays in the water; minimize head lift',
      relatedDrills: ['3-Pull 6-Kick-Switch', 'Single-Arm Kickboard Drill'],
    },
  ],
  Gold: [
    {
      description: 'Crossover on freestyle hand entry',
      correction: 'Wiffle Ball Drag for shoulder-width awareness; Finger-Tip Drag for entry path',
      relatedDrills: ['Wiffle Ball Drag', 'Finger-Tip Drag'],
    },
    {
      description: 'Head too high during freestyle breathing',
      correction:
        'Single-Arm Kickboard Drill for breath timing; kick-switch drills for side balance',
      relatedDrills: ['Single-Arm Kickboard Drill', '3-Pull 6-Kick-Switch'],
    },
    {
      description: 'Poor EVF -- dropping elbow below wrist during catch',
      correction: 'Closed Fist Drill to feel forearm as paddle; sculling at catch position',
      relatedDrills: ['Closed Fist Drill', 'Scull w/ Dolphin Kick'],
    },
    {
      description: 'Weak underwater dolphin kick (only 1-2 kicks off wall)',
      correction:
        'Targeted UDK sets with kick-count goals (5+ kicks); streamline and side UDK drills',
      relatedDrills: [
        'Underwater Dolphin Kick -- Streamline',
        'Underwater Dolphin Kick -- Side',
        'Breakout Drill',
      ],
    },
    {
      description: 'Short distance per stroke',
      correction: 'DPS sets with stroke count targets; Catch-Up Drill for full extension',
      relatedDrills: ['Distance Per Stroke', 'Catch-Up Drill'],
    },
    {
      description: 'Poor kick timing in butterfly (missing kick on entry AND push)',
      correction: 'Flow Drill for undulation; 2-2-2 and 3-3-3 for timing; single-arm fly',
      relatedDrills: [
        'Flow Drill / Superman Flow',
        '2-2-2 Drill',
        '3-3-3 Drill',
        'Single-Arm Butterfly',
      ],
    },
    {
      description: 'Breaststroke hips dropping during recovery',
      correction: 'Dolphin Kick w/ BR Pull to feel hips-up position; focus on fast hand recovery',
      relatedDrills: ['Dolphin Kick w/ BR Pull', 'Pull-Kick-Glide'],
    },
    {
      description: 'Not finishing pulls to the hip',
      correction: 'April Showers w/ Wiffle Ball for push-past-hip focus; single-arm drills',
      relatedDrills: ['April Showers w/ Wiffle Ball', 'Single-Arm Drill'],
    },
  ],
  Advanced: [
    {
      description: 'Breath timing off (breathing too late disrupts rotation)',
      correction: 'Single-Arm Kickboard Drill -- head turn begins when underwater pull begins',
      relatedDrills: ['Single-Arm Kickboard Drill', '3-Pull 6-Kick-Switch'],
    },
    {
      description: 'Inconsistent underwater dolphin kick distance',
      correction: 'Targeted UDK sets with distance markers; track kick counts per wall',
      relatedDrills: [
        'Underwater Dolphin Kick -- Streamline',
        'Underwater Dolphin Kick -- Side',
        'Sprint Underwater No-Breather',
      ],
    },
    {
      description: 'Poor breakout timing (surfacing too early or late)',
      correction: 'Breakout Drill with specific distance targets; accelerate UDK into breakout',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Over-rotation in backstroke',
      correction: 'Cup Drill for head stability; 6-Kick-Switch on Back for controlled rotation',
      relatedDrills: ['Cup Drill', '6-Kick-Switch on Back'],
    },
    {
      description: 'Crossover in backstroke pull',
      correction: 'Reverse Wiffle Ball Drag for pull path; Single-Arm Backstroke for pull focus',
      relatedDrills: ['Reverse Wiffle Ball Drag / Ball Drill', 'Single-Arm Backstroke'],
    },
    {
      description: 'Breaststroke drag on recovery (wide/slow hands)',
      correction: 'Focus on clean, fast, narrow hand recovery; Dolphin Kick w/ BR Pull for hips-up',
      relatedDrills: ['Dolphin Kick w/ BR Pull', '2-Kick 1-Pull'],
    },
    {
      description: 'Butterfly arms landing too wide',
      correction:
        'Single-Arm Butterfly for entry focus; 1-1-1 Drill for rhythm; thumbs-first entry cue',
      relatedDrills: ['Single-Arm Butterfly', '1-1-1 Drill'],
    },
    {
      description: 'Not maintaining body position at end of race (head drops, hips sink)',
      correction:
        'Back-half technique focus sets; race-pace 50s with form emphasis on last 15 yards',
      relatedDrills: ['Distance Per Stroke', 'Flow Drill / Superman Flow'],
    },
    {
      description: 'Weak finish (gliding into wall instead of stroking in)',
      correction: 'Finish-specific sets: swim into wall at race pace, no glide last 5 yards',
      relatedDrills: ['Midpool Turns Practice', 'Flip Turn Series'],
    },
    {
      description: 'Slow turns (not enough acceleration into wall)',
      correction:
        'Turn-specific sets with split timing; approach the wall faster than you leave it',
      relatedDrills: ['Flip Turn Series', 'IM Transition Turns'],
    },
  ],
  Platinum: [
    {
      description: 'Breath timing off in freestyle (breathing too late disrupts rotation)',
      correction: 'Race-pace sets with breathing pattern targets; video analysis of breath timing',
      relatedDrills: ['Single-Arm Kickboard Drill', '3-Pull 6-Kick-Switch'],
    },
    {
      description: 'Inconsistent UDK distance across a race (strong first walls, weak later)',
      correction: 'Back-half UDK emphasis sets; maintain kick count on walls 3-4 same as wall 1',
      relatedDrills: ['Sprint Underwater No-Breather', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Poor breakout timing',
      correction:
        'Accelerate UDK until just inches from surface; time breakout so first stroke finishes at surface',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Technique breakdown under fatigue',
      correction: 'Back-half technique focus sets; drill work embedded in main sets',
      relatedDrills: ['Distance Per Stroke', 'Single-Arm Drill'],
    },
    {
      description: 'Championship race execution falling apart (poor pacing or mental errors)',
      correction:
        'Race modeling with split targets and visualization; simulate race conditions in practice',
      relatedDrills: [],
    },
    {
      description: 'Relay exchange timing inconsistencies',
      correction: 'Relay start practice with timing feedback; exchange-specific work',
      relatedDrills: ['Track Start Practice'],
    },
  ],
  Diamond: [
    {
      description: 'Breath timing off in freestyle (breathing too late disrupts rotation)',
      correction: 'Race-pace sets with breathing pattern targets; video analysis of breath timing',
      relatedDrills: ['Single-Arm Kickboard Drill', '3-Pull 6-Kick-Switch'],
    },
    {
      description: 'Inconsistent UDK distance across a race',
      correction: 'Back-half UDK emphasis sets; maintain kick count consistency on every wall',
      relatedDrills: ['Sprint Underwater No-Breather', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Over-gliding on breaststroke at race pace',
      correction: 'Tempo trainer sets; race-pace pull-kick combos with minimal glide',
      relatedDrills: ['Pull-Kick-Glide', '2-Kick 1-Pull'],
    },
    {
      description: 'Losing speed into turns (deceleration zone)',
      correction: 'Turn-specific sets with split timing; accelerate last 5 yards into wall',
      relatedDrills: ['Flip Turn Series', 'Midpool Turns Practice'],
    },
    {
      description: 'Breakout above 15m inconsistently',
      correction: 'Targeted 15m breakout sets with accountability and tracking',
      relatedDrills: ['Breakout Drill', 'Underwater Dolphin Kick -- Streamline'],
    },
    {
      description: 'Start entry too shallow',
      correction: 'Start progressions focusing on entry angle and depth control',
      relatedDrills: ['Track Start Practice', 'Sprint 15 Yards from Blocks'],
    },
    {
      description: 'Lack of pace awareness without clock',
      correction: 'Blind swim sets with pace prediction; internal clock development',
      relatedDrills: ['Distance Per Stroke'],
    },
    {
      description: 'Technique breakdown under fatigue',
      correction: 'Back-half technique focus sets; drill work embedded in main sets',
      relatedDrills: ['Distance Per Stroke', 'Single-Arm Drill'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Interval Reference by Group (actual BSPC workout intervals, 25-yard pool)
// ---------------------------------------------------------------------------

export const INTERVAL_REFERENCE: Record<string, IntervalSet> = {
  Bronze: {
    distances: {
      '25 Free': '0:50-1:00',
      '50 Free': '2:00+',
      '50 Kick': '2:00+',
    },
  },
  Silver: {
    distances: {
      '25 Free': '0:45-1:00',
      '50 Free': '1:40-2:00',
      '100 Free': '2:00-2:30',
      '100 IM': '3:00',
      '50 Kick': '1:45',
    },
  },
  Gold: {
    distances: {
      '25 Free': '0:45',
      '50 Free': '1:10-1:40',
      '75 Free': '1:45-2:20',
      '100 Free': '1:40-2:00',
      '100 IM': '2:30',
      '100 Kick': '2:45',
    },
  },
  Advanced: {
    distances: {
      '25 Free': '0:45-0:50',
      '50 Free': '0:55-1:10',
      '100 Free': '1:30-1:40',
      '150 Free': '2:10-2:20',
      '100 IM': '2:00',
      '100 Kick': '2:45',
      '200 Free': '3:00',
      '200 IM': '4:00',
    },
  },
  Platinum: {
    distances: {
      '50 Free': '0:45-0:55',
      '75 Free': '1:05-1:25',
      '100 Free': '1:05-1:35',
      '125 Free': '2:30',
      '200 Free': '2:30-3:00',
      '200 IM': '4:00',
      '150 Kick': '3:30',
    },
  },
  Diamond: {
    distances: {
      '50 Free': '0:45-0:55',
      '75 Free': '1:05-1:25',
      '100 Free': '1:05-1:35',
      '125 Free': '2:30',
      '200 Free': '2:30-3:00',
      '200 IM': '4:00',
      '150 Kick': '3:30',
    },
  },
};

// ---------------------------------------------------------------------------
// Swimming Glossary
// ---------------------------------------------------------------------------

export const SWIMMING_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Distance Per Stroke',
    abbreviation: 'DPS',
    definition: 'Maximizing distance traveled per stroke cycle; a measure of stroke efficiency',
  },
  {
    term: 'Early Vertical Forearm',
    abbreviation: 'EVF',
    definition:
      'The "catch" position where the forearm gets perpendicular to the surface early in the pull, maximizing propulsion',
  },
  {
    term: 'Underwater Dolphin Kick',
    abbreviation: 'UDK',
    definition:
      'Dolphin kick performed underwater off walls and starts; often called the "5th stroke"',
  },
  {
    term: 'Individual Medley',
    abbreviation: 'IM',
    definition: 'Butterfly, Backstroke, Breaststroke, Freestyle swum in order',
  },
  {
    term: 'Freestyle',
    abbreviation: 'FR',
    definition: 'Front crawl stroke; the fastest competitive stroke',
  },
  {
    term: 'Backstroke',
    abbreviation: 'BK',
    definition: 'Swum on the back with alternating arm pulls and flutter kick',
  },
  {
    term: 'Breaststroke',
    abbreviation: 'BR',
    definition:
      'Simultaneous arm pull and whip kick with specific timing; the most technical stroke',
  },
  {
    term: 'Butterfly',
    abbreviation: 'Fly',
    definition: 'Simultaneous over-water arm recovery with dolphin kick; requires precise timing',
  },
  {
    term: 'Short Course Yards',
    abbreviation: 'SCY',
    definition: '25-yard pool; standard US high school and college course',
  },
  {
    term: 'Long Course Meters',
    abbreviation: 'LCM',
    definition: '50-meter pool; Olympic and international competition course',
  },
  {
    term: 'Short Course Meters',
    abbreviation: 'SCM',
    definition: '25-meter pool; used in international short course competition',
  },
  {
    term: 'Descend',
    definition: 'Each repeat faster than the last; a common training instruction',
  },
  {
    term: 'Negative Split',
    definition: 'Second half of a swim faster than the first half; a race strategy',
  },
  {
    term: 'Build',
    definition: 'Start slow, finish fast within a single swim',
  },
  {
    term: 'Best Average',
    definition: 'Hold the fastest consistent pace across all repeats; no outliers',
  },
  {
    term: 'Threshold',
    definition:
      'Aerobic threshold pace, approximately 85% effort; sustainable hard effort for training',
  },
  {
    term: 'Sprint',
    definition: 'Maximum effort swimming, 95-100% intensity',
  },
  {
    term: 'Pullout',
    definition: 'Breaststroke underwater sequence: streamline, dolphin kick, pull, kick, breakout',
  },
  {
    term: 'Breakout',
    definition: 'Transition from underwater to surface swimming after a turn or start',
  },
  {
    term: 'Flags',
    definition: 'Backstroke flags hung 5 yards from each wall; used for turn timing',
  },
  {
    term: 'Streamline',
    definition:
      'Hands stacked, arms squeezing ears, tight body position; the most hydrodynamic position',
  },
  {
    term: 'Catch',
    definition: 'Initial underwater hand/forearm position at the start of the pull phase',
  },
  {
    term: 'Recovery',
    definition: 'Arm movement above water returning to the entry position',
  },
  {
    term: 'Entry',
    definition: 'Hand entering the water at the front of the stroke',
  },
  {
    term: 'Pull',
    definition:
      'Underwater arm movement generating propulsion; also refers to swimming with a pull buoy (no kick)',
  },
  {
    term: 'Push-off',
    definition: 'Leaving the wall after a turn; quality of push-off affects underwater speed',
  },
  {
    term: 'Flip Turn',
    definition: 'Freestyle/backstroke somersault turn at the wall',
  },
  {
    term: 'Open Turn',
    definition: 'Butterfly/breaststroke two-hand touch turn at the wall',
  },
  {
    term: 'Spin Turn',
    definition: 'Quick open turn variant with minimal wall time',
  },
  {
    term: 'Undulation',
    definition: 'Wave-like body movement in butterfly and dolphin kick; driven by core',
  },
  {
    term: 'Body Roll',
    definition: 'Side-to-side rotation in freestyle and backstroke; driven by hips',
  },
  {
    term: 'High Elbow',
    definition:
      'Elbow positioned above the wrist during catch or recovery; key to efficient freestyle',
  },
  {
    term: 'Send-off',
    definition: 'Interval time (e.g., "on the 1:30" means leave every 1:30)',
  },
  {
    term: 'Wiffle Ball',
    definition:
      'Training tool held in hand to increase resistance and focus on entry/pull mechanics',
  },
  {
    term: 'Pull Buoy',
    definition: 'Foam float placed between legs to isolate upper body during pull sets',
  },
  {
    term: 'Fins',
    definition: 'Swim fins for kick training and speed work; increases ankle flexibility',
  },
  {
    term: 'Kickboard',
    definition: 'Board held in front for kick-only sets; isolates leg propulsion',
  },
  {
    term: 'Scull',
    definition:
      'Small hand movements to feel water pressure; builds hand sensitivity and catch awareness',
  },
  {
    term: 'Pace Clock',
    definition: 'Large clock on pool deck used for timing intervals and tracking send-offs',
  },
  {
    term: 'T-mark',
    definition:
      'T-shaped marking on the pool bottom near the wall for turn judging and orientation',
  },
  {
    term: 'Touch Pad',
    definition: 'Electronic timing pad on the wall at swim meets',
  },
  {
    term: 'Taper',
    definition: 'Reduced training volume before a major competition to peak performance',
  },
  {
    term: 'Warm-down',
    definition: 'Easy swimming after a race to aid recovery; also called cool-down',
  },
  {
    term: 'Split',
    definition: 'Time for a portion of a race (e.g., first 50 of a 100)',
  },
  {
    term: 'Relay Exchange',
    definition: 'The take-off of the next relay swimmer as the previous swimmer finishes',
  },
  {
    term: 'Heat Sheet',
    definition: 'Printed listing of all events and entries at a swim meet',
  },
  {
    term: 'Seed Time',
    definition: 'The entry time used to place a swimmer in a heat',
  },
  {
    term: 'Goal Time',
    definition: 'Target time a swimmer aims to achieve',
  },
  {
    term: 'Long Axis',
    definition: 'Freestyle and backstroke; strokes that rotate around the long axis of the body',
  },
  {
    term: 'Short Axis',
    definition: 'Breaststroke and butterfly; strokes with undulation around the short axis',
  },
  {
    term: 'EZ',
    definition: 'Easy effort swimming',
  },
];

// ---------------------------------------------------------------------------
// Breakout Focus Points (from actual BSPC coaching cues)
// ---------------------------------------------------------------------------

export const BREAKOUT_FOCUS_POINTS: string[] = [
  'Accelerate underwater dolphin kick until just a few inches from surface',
  'Fastest possible transition from dolphin kick to flutter kick (FR and BK)',
  'Begin first strokes (1 arm at a time for FR and BK) just under the water',
  'Time breakout so finishing first stroke right as reaching surface',
  'Do NOT breathe first stroke off the wall',
  'Maintain streamline tightness through the entire underwater phase',
  'Consistent dolphin kick count off every wall (aim for group-appropriate target)',
  'For backstroke: one arm breakout with strong first pull',
  'For breaststroke: full pullout sequence (streamline, dolphin kick, pull, kick, breakout)',
  'For butterfly: hands should enter simultaneously on breakout stroke',
  'Stay below the surface until kick speed matches or exceeds surface speed',
  'Target 15m for Diamond/Platinum, 10-12m for Advanced/Gold, 8-10m for Silver',
];

// ---------------------------------------------------------------------------
// Team Philosophy (from actual BSPC team documents)
// ---------------------------------------------------------------------------

export const TEAM_PHILOSOPHY: string[] = [
  'Always prioritizing skill development over excessive training',
  'Focusing on joy in the pool and while swimming from day 1',
  'Establishing the best possible technique baseline at a young age',
  'Underwater dolphin kick is a priority across all groups',
  'Starts and turns are free speed -- every wall matters',
  'Sprint events for high school preparation',
  '200 stroke, 400 IM, and distance capability for long-term development',
  'Process over outcome -- focus on technique improvement, not just times',
  'Race your own race -- internal focus, not looking at competitors',
  'Consistent attendance builds fitness; fitness enables fast swimming',
  'Challenge yourself in practice to build confidence for meets',
  'Support your teammates -- fast teams are built on encouragement',
  'Learn to read the pace clock -- self-awareness is a competitive advantage',
  'Effort is a choice -- talent is developed through deliberate practice',
];

// ---------------------------------------------------------------------------
// Group Goal Statements (official BSPC group descriptions)
// ---------------------------------------------------------------------------

export const GROUP_GOALS: Record<string, string> = {
  Bronze:
    'The goal of BSPC - Bronze is to create the foundation for future performances and success in the group. The emphasis is on establishing a comfort in the water and begin to build the strokes.',
  Silver:
    'The goal of BSPC - Silver is to ensure swimmers are prepared for competitive swimming. Swimmers will develop legal competitive skills, as well as begin the physical training necessary to race successfully.',
  Gold: "The goal of BSPC - Gold is to continue to develop swimmers' skills, focusing on the details that lead to fast swimming. There is a continued emphasis on training and improving physical capacities.",
  Advanced:
    "The goal of BSPC - Advanced is to further refine swimmers' skills, helping them learn how to put the pieces to create speed. Training continues to emphasize fitness development.",
  'Diamond/Platinum':
    'The goal of BSPC - Diamond/Platinum is to develop mastery of all the skills that lead to speed in every stroke.',
};

// ---------------------------------------------------------------------------
// Turn Coaching Points (step-by-step turn instruction)
// ---------------------------------------------------------------------------

export interface TurnCoachingPoint {
  turnType: string;
  steps: string[];
  commonErrors: string[];
}

export const TURN_COACHING_POINTS: Record<string, TurnCoachingPoint[]> = {
  freestyle: [
    {
      turnType: 'Freestyle Flip Turn',
      steps: [
        'Swim fast into the wall',
        'Get into a small/tight ball during the flip',
        'Keep arms straight and still during the flip',
        'Push off on back in streamline',
        'Push off deep enough to underwater dolphin kick past the flags',
        'Breakout 1 arm at a time when inches from the surface',
      ],
      commonErrors: [
        'Not swimming fast enough into the wall',
        'Balling up too slowly',
        'Arms flailing during the flip',
        'Pushing off too shallow',
        'Not streamlining before push-off',
      ],
    },
  ],
  backstroke: [
    {
      turnType: 'Backstroke Flip Turn',
      steps: [
        'Count strokes from the flags (1 less than finish count)',
        'Cross-over arm turn onto stomach',
        'Execute flip turn',
        'Push off on back in streamline',
        'Push off deep enough for UDK past the flags',
        'Breakout 1 arm at a time',
      ],
      commonErrors: [
        'Miscounting strokes from the flags',
        'Turning over in the wrong direction',
        'Not pushing off on back',
        'Shallow push-off',
      ],
    },
  ],
  breaststroke: [
    {
      turnType: 'Breaststroke Open Turn',
      steps: [
        'Two-hand touch on the wall',
        'Bring 1 hand off the wall (elbow brother phase)',
        'Bring knees to chest and feet to wall quickly',
        'Other hand/arm comes off behind head into streamline',
        'Push off deep enough for BR pullout',
      ],
      commonErrors: [
        'One-hand touch (DQ)',
        'Slow feet to wall',
        'Not streamlining before push-off',
        'Shallow push-off',
      ],
    },
  ],
  butterfly: [
    {
      turnType: 'Butterfly Open Turn',
      steps: [
        'Two-hand touch simultaneously',
        'Quick feet to wall',
        'Push off in streamline',
        'Underwater dolphin kick',
      ],
      commonErrors: [
        'One-hand touch (DQ)',
        'Not touching simultaneously',
        'Slow transition off the wall',
      ],
    },
  ],
  IM: [
    {
      turnType: 'Fly to Back Transition',
      steps: [
        'Open turn with two-hand touch',
        'Push off on back',
        'Stay underwater past the flags with UDK',
      ],
      commonErrors: ['Not pushing off on back', 'Shallow push-off', 'Short underwater phase'],
    },
    {
      turnType: 'Back to Breast Transition',
      steps: ['Open turn with 2-hand touch on back', 'Push off for BR pullout'],
      commonErrors: [
        'Missing 2-hand touch',
        'Not transitioning to pullout',
        'Pushing off too shallow for pullout',
      ],
    },
    {
      turnType: 'Breast to Free Transition',
      steps: ['Touch with 2 hands', 'Transition to flip turn position', 'Push off into freestyle'],
      commonErrors: [
        'One-hand touch (DQ)',
        'Slow transition to freestyle',
        'Not streamlining off wall',
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// BR Pullout Sequence (step-by-step breaststroke pullout)
// ---------------------------------------------------------------------------

export const BR_PULLOUT_SEQUENCE: string[] = [
  'Push off wall in tight streamline',
  'As soon as you feel yourself slowing down, execute 1 dolphin kick',
  'As soon as you feel yourself slowing down after dolphin kick, execute 1 big underwater pull-down (hands pull all the way to hips)',
  'As hands recover forward, execute 1 breaststroke kick',
  'Time the kick so you surface just as hands reach forward streamline position',
  'Begin first stroke immediately upon surfacing',
];

// ---------------------------------------------------------------------------
// Helper: lookup drills by stroke
// ---------------------------------------------------------------------------

export function getDrillsByStroke(stroke: Stroke): DrillEntry[] {
  return DRILL_LIBRARY.filter((d) => d.stroke === stroke);
}

// ---------------------------------------------------------------------------
// Helper: lookup drills by name (partial match)
// ---------------------------------------------------------------------------

export function findDrillByName(name: string): DrillEntry | undefined {
  const lower = name.toLowerCase();
  return DRILL_LIBRARY.find((d) => d.name.toLowerCase().includes(lower));
}

// ---------------------------------------------------------------------------
// Helper: get faults for a group
// ---------------------------------------------------------------------------

export function getFaultsForGroup(group: string): FaultEntry[] {
  return COMMON_FAULTS[group] ?? [];
}

// ---------------------------------------------------------------------------
// Helper: get intervals for a group
// ---------------------------------------------------------------------------

export function getIntervalsForGroup(group: string): IntervalSet {
  return INTERVAL_REFERENCE[group] ?? { distances: {} };
}

// ---------------------------------------------------------------------------
// Helper: get glossary term by name or abbreviation
// ---------------------------------------------------------------------------

export function lookupGlossaryTerm(term: string): GlossaryEntry | undefined {
  const lower = term.toLowerCase();
  return SWIMMING_GLOSSARY.find(
    (g) => g.term.toLowerCase() === lower || g.abbreviation?.toLowerCase() === lower,
  );
}
