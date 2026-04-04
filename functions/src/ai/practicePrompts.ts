export function getPracticeGenerationPrompt(params: {
  group: string;
  focus: string;
  targetYardage: number;
  durationMinutes: number;
  meetName?: string;
  notes?: string;
}): string {
  const meetContext = params.meetName
    ? `\nUPCOMING MEET: ${params.meetName} — adjust the practice to prepare for this meet (more race-pace work, starts, relay exchanges if applicable).`
    : '';

  const notesContext = params.notes
    ? `\nCOACH NOTES: ${params.notes}`
    : '';

  return `You are an expert swim coach AI generating a practice plan for a competitive swim team.

GROUP: ${params.group}
FOCUS: ${params.focus}
TARGET YARDAGE: ${params.targetYardage} yards
DURATION: ${params.durationMinutes} minutes${meetContext}${notesContext}

AGE GROUP GUIDELINES:
- Bronze (8-10): Max 2500 yds, shorter intervals, emphasis on technique & fun, sets under 200 each
- Silver (10-12): Max 3500 yds, developing endurance, introduce threshold concepts
- Gold (12-14): Max 5000 yds, balanced training, introduce periodization
- Advanced/Platinum (14-16): Max 6500 yds, full training methodology, race-specific work
- Diamond (16-18): Max 8000 yds, advanced periodization, mental preparation

FOCUS GUIDELINES:
- endurance: Aerobic base, distance sets, descending intervals, threshold work
- speed: Sprint sets, race pace, explosive starts, fast turns
- technique: Drill-heavy, catch-up, fist drill, sculling, single-arm, kick focus
- recovery: Easy swimming, pull sets, light kick, varied strokes
- race_prep: Race-pace 50s/100s, starts, relay exchanges, meet simulation
- mixed: Balanced warmup, technique drill, main endurance set, speed work, cooldown

TRAINING PRINCIPLES:
1. Every practice MUST have: Warmup, at least one main set, Cooldown
2. Warmup should be 10-15% of total yardage
3. Cooldown should be 5-10% of total yardage
4. Use proper intervals (give swimmers adequate rest)
5. Variety in strokes within a single practice
6. Build difficulty progressively within the main set

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
