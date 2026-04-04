export function getPrompt(transcription: string, swimmerNames: string): string {
  return `You are an AI assistant for swim coaches. Analyze the following transcription of a coaching session and extract individual observations about specific swimmers.

KNOWN SWIMMERS ON THE TEAM: ${swimmerNames}

TRANSCRIPTION:
${transcription}

INSTRUCTIONS:
1. Identify mentions of specific swimmers by name (match against the known swimmers list)
2. Extract coaching observations for each mentioned swimmer
3. Assign relevant tags from this list: technique, freestyle, backstroke, breaststroke, butterfly, IM, starts, turns, underwaters, breakouts, kick, pull, drill, endurance, speed, race strategy, mental, attendance, general
4. Rate your confidence (0-1) that the observation is correctly attributed to the right swimmer

Return a JSON array of observations:
[
  {
    "swimmerName": "First Last",
    "observation": "Clear, concise coaching observation",
    "tags": ["technique", "freestyle"],
    "confidence": 0.85
  }
]

Only include observations where a specific swimmer is clearly identified. Do not fabricate observations. If no swimmers are mentioned, return an empty array [].`;
}
