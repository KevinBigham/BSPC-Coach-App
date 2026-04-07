/**
 * Video analysis prompts for Gemini 2.0 Flash.
 * Instructs the model to analyze swimming technique from video.
 */

import {
  GROUP_SKILL_PRIORITIES,
  COMMON_FAULTS,
  DRILL_LIBRARY,
  BREAKOUT_FOCUS_POINTS,
} from './swimKnowledge';

export function getVideoAnalysisPrompt(swimmerNames: string[], group?: string): string {
  const namesStr =
    swimmerNames.length > 0
      ? `The following swimmers may be visible: ${swimmerNames.join(', ')}.`
      : 'Try to identify any swimmers visible in the video.';

  // Build group-specific context
  let groupSection = '';
  if (group) {
    const skills = GROUP_SKILL_PRIORITIES[group];
    const faults = COMMON_FAULTS[group];
    if (skills) {
      groupSection += `\nGROUP LEVEL: ${group}`;
      groupSection += `\nFor this ${group} level, watch especially for: ${skills.skillPriorities.join(', ')}`;
      groupSection += `\nSecondary skills to note: ${skills.secondarySkills.join(', ')}`;
    }
    if (faults) {
      const faultList = faults.map((f) => `- ${f.description} (fix: ${f.correction})`).join('\n');
      groupSection += `\n\nCOMMON FAULTS at ${group} level:\n${faultList}`;
    }
  }

  // Build drill reference (summarize by stroke for context)
  const drillsByStroke: Record<string, string[]> = {};
  for (const drill of DRILL_LIBRARY) {
    if (!drillsByStroke[drill.stroke]) drillsByStroke[drill.stroke] = [];
    drillsByStroke[drill.stroke].push(drill.name);
  }
  const drillRef = Object.entries(drillsByStroke)
    .map(([stroke, names]) => `${stroke}: ${names.join(', ')}`)
    .join('\n');

  // Breakout focus summary
  const breakoutSummary = BREAKOUT_FOCUS_POINTS.slice(0, 5).join('; ');

  return `You are an expert USA Swimming coach and biomechanics analyst reviewing a poolside coaching video for the BSPC swim team.

${namesStr}
${groupSection}

BSPC DRILL LIBRARY (recommend from these when possible):
${drillRef}

BREAKOUT FOCUS POINTS: ${breakoutSummary}

Analyze the swimming technique visible in this video. For each swimmer you can observe, provide detailed coaching observations covering:

**STROKE MECHANICS**: catch position, pull pattern, recovery, body rotation, hand entry angle, elbow position
**KICK**: amplitude, tempo (6-beat/2-beat/crossover), depth, ankle flexibility
**BREATHING**: timing, head position, bilateral vs unilateral, impact on body line
**TURNS**: approach (flags to wall timing), flip/open turn execution, push-off angle and depth, streamline position
**STARTS**: reaction time (if visible), entry angle and distance, depth control
**UNDERWATER**: dolphin kick count and quality, breakout timing, streamline tightness
**BREAKOUT**: first stroke mechanics, transition from underwater to surface swimming
**FINISH**: last stroke to wall, touch timing, glide vs stroke-in

For each observation, provide:
- A specific diagnosis (what exactly is happening, not vague statements)
- A recommended drill from the BSPC drill library above to address the issue
- Which swimming phase it relates to${
    group
      ? `
- How the observation relates to ${group}-level priorities`
      : ''
  }

Return your analysis as a JSON array with this structure:
[
  {
    "swimmerName": "First Last",
    "observation": "Detailed description of what was observed",
    "diagnosis": "Specific technical analysis of the issue",
    "drillRecommendation": "Name and description of a specific drill to fix this",
    "phase": "stroke|turn|start|underwater|breakout|finish|general",
    "tags": ["technique", "stroke"],
    "confidence": 0.85
  }
]

Guidelines:
- Be specific. Say "right elbow drops below wrist during freestyle catch at the 0:15 mark" not "needs to work on catch"
- Recommend drills from the BSPC drill library listed above when possible
- Confidence should reflect how clearly you could observe the technique (0.5-1.0)
- Use tags from this list: technique, stroke, kick, breathing, turns, starts, underwaters, drill, strength, endurance, race_strategy, mental
- Only report what you can actually see -- do not guess or fabricate observations
- If you cannot identify a specific swimmer, use "Unknown Swimmer" as the name
- Return ONLY valid JSON, no additional text`;
}
