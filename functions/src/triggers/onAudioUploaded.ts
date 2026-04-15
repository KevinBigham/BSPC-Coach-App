import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { extractObservations } from '../ai/extractObservations';
import { SWIMMING_GLOSSARY, DRILL_LIBRARY } from '../ai/swimKnowledge';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

export const onAudioUploaded = onDocumentUpdated('audio_sessions/{sessionId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) return;

  // Only trigger when status changes to "uploaded"
  if (before.status === after.status || after.status !== 'uploaded') return;

  const sessionId = event.params.sessionId;
  const sessionRef = db.doc(`audio_sessions/${sessionId}`);

  try {
    // Step 1: Update status to transcribing
    await sessionRef.update({
      status: 'transcribing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Step 2: Download audio from Storage
    const bucket = storage.bucket();
    const file = bucket.file(after.storagePath);
    const [audioBuffer] = await file.download();

    // Step 3: Transcribe with Gemini
    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertexAi = new VertexAI({
      project: process.env.GCLOUD_PROJECT || '',
      location: 'us-central1',
    });
    const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const audioBase64 = audioBuffer.toString('base64');

    // Build swimming-aware transcription prompt
    const glossaryStr = SWIMMING_GLOSSARY.slice(0, 20)
      .map((g) => `${g.term}: ${g.definition}`)
      .join('; ');
    const drillNames = DRILL_LIBRARY.map((d) => d.name).join(', ');

    const transcriptionPrompt = `Transcribe this swim coaching audio recording accurately.

CONTEXT: This is a poolside coaching session. Expect background noise including pool echoes, whistle blows, splashing water, and multiple overlapping conversations. Focus on the coach's primary voice.

SWIMMING VOCABULARY — these terms may appear:
${glossaryStr}

COMMON COACHING ABBREVIATIONS: DPS, UDK, IM, EVF, EZ, SCY, LCM, SCM, PR (personal record), AA (All-American), AG (age group), USS (USA Swimming)

DRILL NAMES the coach may reference: ${drillNames}

INSTRUCTIONS:
- Capture all swimmer names mentioned (first names, last names, or nicknames)
- Preserve stroke names (freestyle, backstroke, breaststroke, butterfly, IM)
- Note specific distances (50, 100, 200, etc.) and intervals (e.g., "on the 1:30")
- Include coaching cues and technique corrections verbatim
- Mark unclear segments with [inaudible] rather than guessing
- Return the full transcription text as a single string`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/mp4', data: audioBase64 } },
            { text: transcriptionPrompt },
          ],
        },
      ],
    });

    const transcription = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!transcription) {
      await sessionRef.update({
        status: 'failed',
        errorMessage: 'Empty transcription',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Step 4: Save transcription and move to extracting
    await sessionRef.update({
      transcription,
      status: 'extracting',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Step 5: Extract observations
    await extractObservations(sessionId, transcription, after.group || null);

    // Step 6: Update to review
    await sessionRef.update({
      status: 'review',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err: unknown) {
    console.error('Audio processing error:', err);
    const errorMessage = err instanceof Error && err.message ? err.message : 'Unknown error';
    await sessionRef.update({
      status: 'failed',
      errorMessage,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
});
