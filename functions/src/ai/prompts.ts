import { GROUP_SKILL_PRIORITIES, COMMON_FAULTS } from './swimKnowledge';

export function getPrompt(transcription: string, swimmerNames: string, group?: string): string {
  // Build group-specific context when available
  let groupContext = '';
  if (group) {
    const skills = GROUP_SKILL_PRIORITIES[group];
    const faults = COMMON_FAULTS[group];
    if (skills) {
      groupContext += `\nGROUP LEVEL: ${group}`;
      groupContext += `\nSKILL PRIORITIES for ${group}: ${skills.skillPriorities.join(', ')}`;
      groupContext += `\nSECONDARY SKILLS: ${skills.secondarySkills.join(', ')}`;
    }
    if (faults) {
      const faultSummary = faults
        .slice(0, 4)
        .map((f) => f.description)
        .join('; ');
      groupContext += `\nCOMMON FAULTS at ${group} level: ${faultSummary}`;
    }
  }

  return `You are an AI assistant for BSPC swim coaches. Analyze the following transcription of a coaching session and extract individual observations about specific swimmers.

KNOWN SWIMMERS ON THE TEAM: ${swimmerNames}
${groupContext}

TRANSCRIPTION:
${transcription}

INSTRUCTIONS:
1. Identify mentions of specific swimmers by name (match against the known swimmers list)
2. Extract coaching observations for each mentioned swimmer
3. Classify severity for each observation:
   - "minor_tweak": Small adjustment, swimmer is mostly correct
   - "needs_work": Noticeable issue that should be addressed in upcoming practices
   - "fundamental_issue": Core mechanic that is significantly wrong and limits progress
4. Assign relevant tags from this list: technique, freestyle, backstroke, breaststroke, butterfly, IM, starts, turns, underwaters, breakouts, kick, pull, drill, endurance, speed, race strategy, mental, attendance, general
   - Prefer specific tags (e.g., "turns" over "technique") when possible
   - Use multiple tags when an observation spans categories (e.g., ["technique", "freestyle", "kick"])${
     group
       ? `
   - Prioritize observations related to ${group}-level skill priorities listed above`
       : ''
   }
5. Rate your confidence (0-1) that the observation is correctly attributed to the right swimmer

Return a JSON array of observations:
[
  {
    "swimmerName": "First Last",
    "observation": "Clear, concise coaching observation",
    "severity": "minor_tweak",
    "tags": ["technique", "freestyle"],
    "confidence": 0.85
  }
]

Only include observations where a specific swimmer is clearly identified. Do not fabricate observations. If no swimmers are mentioned, return an empty array [].`;
}
