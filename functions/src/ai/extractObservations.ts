import { supabase } from '../config/supabase';
import { getPrompt, type PromptSwimmer } from './prompts';

interface ExtractedObservation {
  swimmerName: string;
  observation: string;
  tags: string[];
  confidence: number;
}

// Roster reads come from canonical swimmers (Phase B); the drafts write is
// canonical too as of Phase F — one insert into audio_session_drafts (the
// swimmerName denorm drops; it derives through the swimmers embed on read).
interface RosterRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

const ROSTER_SELECT = 'id, first_name, last_name, display_name';

function rowToRosterSwimmer(row: RosterRow) {
  const firstName = row.first_name ?? '';
  const lastName = row.last_name ?? '';
  return {
    id: row.id,
    firstName,
    lastName,
    displayName: row.display_name ?? `${firstName} ${lastName}`.trim(),
  };
}

export async function extractObservations(
  sessionId: string,
  transcription: string,
  group: string | null,
  selectedSwimmerIds?: string[],
): Promise<void> {
  const scopedToSelected = Array.isArray(selectedSwimmerIds) && selectedSwimmerIds.length > 0;

  let swimmers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
  }>;

  if (scopedToSelected) {
    // Missing ids are simply absent from the result, matching the old
    // per-doc exists filter.
    const { data, error } = await supabase
      .from('swimmers')
      .select(ROSTER_SELECT)
      .in('id', selectedSwimmerIds);
    if (error) throw error;
    swimmers = ((data ?? []) as unknown as RosterRow[]).map(rowToRosterSwimmer);
  } else {
    // Fetch swimmer names for legacy sessions that predate selectedSwimmerIds.
    let swimmerQuery = supabase.from('swimmers').select(ROSTER_SELECT).eq('is_active', true);
    if (group) {
      swimmerQuery = swimmerQuery.eq('practice_group', group);
    }
    const { data, error } = await swimmerQuery;
    if (error) throw error;
    swimmers = ((data ?? []) as unknown as RosterRow[]).map(rowToRosterSwimmer);
  }

  const swimmerNames = swimmers.map((s) => `${s.firstName} ${s.lastName}`).join(', ');
  const selectedPromptSwimmers: PromptSwimmer[] | undefined = scopedToSelected
    ? swimmers.map((swimmer) => ({ id: swimmer.id, displayName: swimmer.displayName }))
    : undefined;

  // Call Gemini for extraction
  const { VertexAI } = await import('@google-cloud/vertexai');
  const vertexAi = new VertexAI({
    project: process.env.GCLOUD_PROJECT || '',
    location: 'us-central1',
  });
  const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = getPrompt(transcription, swimmerNames, group || undefined, selectedPromptSwimmers);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  let observations: ExtractedObservation[];
  try {
    observations = JSON.parse(responseText);
  } catch {
    console.error('Failed to parse AI response:', responseText);
    return;
  }

  if (!Array.isArray(observations) || observations.length === 0) return;

  // Match swimmer names to IDs and build canonical draft rows
  const draftRows: Record<string, unknown>[] = [];

  for (const obs of observations) {
    // Fuzzy match swimmer name
    const matched = swimmers.find((s) => {
      const name = obs.swimmerName.toLowerCase();
      return (
        name === s.displayName.toLowerCase() ||
        name === s.firstName.toLowerCase() ||
        (name.includes(s.firstName.toLowerCase()) && name.includes(s.lastName.toLowerCase()))
      );
    });

    if (!matched) continue;

    const validTags = [
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
    ];
    const tags = (obs.tags || []).filter((t: string) => validTags.includes(t));

    draftRows.push({
      session_id: sessionId,
      swimmer_id: matched.id,
      observation: obs.observation,
      tags,
      confidence: Math.min(Math.max(obs.confidence || 0.5, 0), 1),
      // created_at DB-owned; swimmerName derived on read
    });
  }

  if (draftRows.length === 0) return;

  const { error: insertError } = await supabase.from('audio_session_drafts').insert(draftRows);
  if (insertError) throw insertError;
}
