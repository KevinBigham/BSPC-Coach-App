import * as admin from 'firebase-admin';
import { getPrompt } from './prompts';

const db = admin.firestore();

interface ExtractedObservation {
  swimmerName: string;
  observation: string;
  tags: string[];
  confidence: number;
}

export async function extractObservations(
  sessionId: string,
  transcription: string,
  group: string | null
): Promise<void> {
  // Fetch swimmer names for matching
  let swimmerQuery: admin.firestore.Query = db.collection('swimmers').where('active', '==', true);
  if (group) {
    swimmerQuery = swimmerQuery.where('group', '==', group);
  }
  const swimmerSnap = await swimmerQuery.get();
  const swimmers = swimmerSnap.docs.map((d) => ({
    id: d.id,
    firstName: d.data().firstName as string,
    lastName: d.data().lastName as string,
    displayName: d.data().displayName as string,
  }));

  const swimmerNames = swimmers.map((s) => `${s.firstName} ${s.lastName}`).join(', ');

  // Call Gemini for extraction
  const { VertexAI } = await import('@google-cloud/vertexai');
  const vertexAi = new VertexAI({ project: process.env.GCLOUD_PROJECT || '', location: 'us-central1' });
  const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = getPrompt(transcription, swimmerNames);

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

  // Match swimmer names to IDs and create draft docs
  const batch = db.batch();
  const draftsCollection = db.collection(`audio_sessions/${sessionId}/drafts`);

  for (const obs of observations) {
    // Fuzzy match swimmer name
    const matched = swimmers.find((s) => {
      const name = obs.swimmerName.toLowerCase();
      return (
        name === s.displayName.toLowerCase() ||
        name === s.firstName.toLowerCase() ||
        name.includes(s.firstName.toLowerCase()) && name.includes(s.lastName.toLowerCase())
      );
    });

    if (!matched) continue;

    const validTags = [
      'technique', 'freestyle', 'backstroke', 'breaststroke', 'butterfly',
      'IM', 'starts', 'turns', 'underwaters', 'breakouts', 'kick', 'pull',
      'drill', 'endurance', 'speed', 'race strategy', 'mental', 'attendance', 'general',
    ];
    const tags = (obs.tags || []).filter((t: string) => validTags.includes(t));

    const ref = draftsCollection.doc();
    batch.set(ref, {
      swimmerId: matched.id,
      swimmerName: matched.displayName,
      observation: obs.observation,
      tags,
      confidence: Math.min(Math.max(obs.confidence || 0.5, 0), 1),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}
