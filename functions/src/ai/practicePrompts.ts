import {
  DRILL_LIBRARY,
  GROUP_SKILL_PRIORITIES,
  COMMON_FAULTS,
  INTERVAL_REFERENCE,
  TEAM_PHILOSOPHY,
  BREAKOUT_FOCUS_POINTS,
} from './swimKnowledge';

/** BSPC yardage ranges by group */
const YARDAGE_RANGES: Record<string, { min: number; max: number }> = {
  Silver: { min: 1500, max: 2200 },
  Gold: { min: 1750, max: 3000 },
  Advanced: { min: 3500, max: 4500 },
  Diamond: { min: 3900, max: 5500 },
  Platinum: { min: 3900, max: 5500 },
};

export function getPracticeGenerationPrompt(params: {
  group: string;
  focus: string;
  targetYardage: number;
  durationMinutes: number;
  meetName?: string;
  notes?: string;
}): string {
  const meetContext = params.meetName
    ? `\nUPCOMING MEET: ${params.meetName} -- adjust the practice to prepare for this meet (more race-pace work, starts, relay exchanges if applicable).`
    : '';

  const notesContext = params.notes ? `\nCOACH NOTES: ${params.notes}` : '';

  // Group-specific context
  const groupSkills = GROUP_SKILL_PRIORITIES[params.group];
  const groupFaults = COMMON_FAULTS[params.group];
  const groupIntervals = INTERVAL_REFERENCE[params.group];
  const yardageRange = YARDAGE_RANGES[params.group];

  let groupSection = '';
  if (groupSkills) {
    groupSection += `\nBSPC SKILL PRIORITIES for ${params.group}: ${groupSkills.skillPriorities.join(', ')}`;
    groupSection += `\nSecondary skills: ${groupSkills.secondarySkills.join(', ')}`;
  }
  if (groupFaults) {
    const faultList = groupFaults
      .slice(0, 3)
      .map((f) => f.description)
      .join('; ');
    groupSection += `\nCommon faults to address: ${faultList}`;
  }
  if (yardageRange) {
    groupSection += `\nBSPC yardage range for ${params.group}: ${yardageRange.min}-${yardageRange.max} yards`;
  }

  // Interval reference
  let intervalSection = '';
  if (groupIntervals) {
    const intervalStr = Object.entries(groupIntervals)
      .map(([desc, time]) => `${desc}: ${time}`)
      .join(', ');
    intervalSection = `\nBSPC INTERVAL REFERENCE for ${params.group}: ${intervalStr}`;
  }

  // Drill names by stroke for reference
  const drillsByStroke: Record<string, string[]> = {};
  for (const drill of DRILL_LIBRARY) {
    if (!drillsByStroke[drill.stroke]) drillsByStroke[drill.stroke] = [];
    drillsByStroke[drill.stroke].push(drill.name);
  }
  const drillRef = Object.entries(drillsByStroke)
    .map(([stroke, names]) => `${stroke}: ${names.join(', ')}`)
    .join('\n');

  // Team philosophy summary
  const philosophyStr = TEAM_PHILOSOPHY.slice(0, 4).join('; ');

  // Breakout focus
  const breakoutStr = BREAKOUT_FOCUS_POINTS.slice(0, 3).join('; ');

  return `You are an expert swim coach AI generating a practice plan for the BSPC (Blue Springs Power Cats) swim team.

GROUP: ${params.group}
FOCUS: ${params.focus}
TARGET YARDAGE: ${params.targetYardage} yards
DURATION: ${params.durationMinutes} minutes${meetContext}${notesContext}
${groupSection}
${intervalSection}

BSPC TEAM PHILOSOPHY: ${philosophyStr}
BREAKOUT EMPHASIS: ${breakoutStr}

BSPC YARDAGE GUIDELINES BY GROUP:
- Silver: 1500-2200 yards, emphasis on technique and fun, shorter sets
- Gold: 1750-3000 yards, developing endurance, introduce threshold concepts
- Advanced: 3500-4500 yards, race-pace training, negative splits, full periodization
- Diamond/Platinum: 3900-5500 yards, championship preparation, advanced periodization

BSPC DRILL LIBRARY (use these drill names in technique sets):
${drillRef}

FOCUS GUIDELINES:
- endurance: Aerobic base, distance sets, descending intervals, threshold work
- speed: Sprint sets, race pace, explosive starts, fast turns
- technique: Drill-heavy sets using drills from the library above, kick focus
- recovery: Easy swimming, pull sets, light kick, varied strokes
- race_prep: Race-pace 50s/100s, starts, relay exchanges, meet simulation
- mixed: Balanced warmup, technique drill, main endurance set, speed work, cooldown

TRAINING PRINCIPLES:
1. Every practice MUST have: Warmup, at least one main set, Cooldown
2. Warmup should be 10-15% of total yardage
3. Cooldown should be 5-10% of total yardage
4. Use intervals from the BSPC interval reference above (adjust as needed for the set intensity)
5. Variety in strokes within a single practice
6. Build difficulty progressively within the main set
7. Include at least one drill from the BSPC drill library in technique-focused practices
8. Every wall matters -- include breakout or underwater focus cues where appropriate

Return a JSON object with this exact structure:
{
  "title": "Descriptive practice title",
  "description": "Brief description of the practice focus",
  "sets": [
    {
      "order": 0,
      "name": "Set Name",
      "category": "Warmup" | "Pre-Set" | "Main Set" | "Cooldown",
      "description": "Optional set description",
      "items": [
        {
          "order": 0,
          "reps": 4,
          "distance": 100,
          "stroke": "Freestyle" | "Backstroke" | "Breaststroke" | "Butterfly" | "IM" | "Choice" | "Kick" | "Pull" | "Drill" | "Scull",
          "interval": "1:30",
          "description": "Optional item note",
          "focusPoints": ["technique cue"]
        }
      ]
    }
  ],
  "totalYardage": 4000,
  "estimatedDuration": 90
}

Return ONLY valid JSON. No markdown, no explanations.`;
}
