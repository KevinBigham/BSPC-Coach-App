import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { getVideoAnalysisPrompt } from '../ai/videoPrompts';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

export const onVideoUploaded = onDocumentUpdated(
  {
    document: 'video_sessions/{sessionId}',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only trigger when status changes to "uploaded"
    if (before.status === after.status || after.status !== 'uploaded') return;

    const sessionId = event.params.sessionId;
    const sessionRef = db.doc(`video_sessions/${sessionId}`);

    try {
      // Step 1: Update status to analyzing
      await sessionRef.update({
        status: 'analyzing',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Step 2: Resolve swimmer names from tagged IDs
      const swimmerNames: string[] = [];
      const taggedIds: string[] = after.taggedSwimmerIds || [];
      for (const swimmerId of taggedIds) {
        const swimmerDoc = await db.doc(`swimmers/${swimmerId}`).get();
        if (swimmerDoc.exists) {
          const data = swimmerDoc.data();
          swimmerNames.push(`${data?.firstName} ${data?.lastName}`);
        }
      }

      // Step 3: Download video from Storage
      const bucket = storage.bucket();
      const file = bucket.file(after.storagePath);
      const [metadata] = await file.getMetadata();
      const fileSize = parseInt(metadata.size as string) || 0;

      // Step 4: Send to Gemini 2.0 Flash for analysis
      const { VertexAI } = await import('@google-cloud/vertexai');
      const vertexAi = new VertexAI({
        project: process.env.GCLOUD_PROJECT || '',
        location: 'us-central1',
      });
      const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = getVideoAnalysisPrompt(swimmerNames, after.group || undefined);

      let result;
      if (fileSize < 20 * 1024 * 1024) {
        // Small video: send inline as base64
        const [videoBuffer] = await file.download();
        const videoBase64 = videoBuffer.toString('base64');
        const mimeType = (metadata.contentType as string) || 'video/mp4';

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ inlineData: { mimeType, data: videoBase64 } }, { text: prompt }],
            },
          ],
        });
      } else {
        // Large video: use GCS file URI
        const gcsUri = `gs://${bucket.name}/${after.storagePath}`;
        const mimeType = (metadata.contentType as string) || 'video/mp4';

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ fileData: { fileUri: gcsUri, mimeType: mimeType } }, { text: prompt }],
            },
          ],
        });
      }

      const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!responseText) {
        await sessionRef.update({
          status: 'failed',
          errorMessage: 'Empty AI response',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // Step 5: Parse JSON response
      // Extract JSON from potential markdown code blocks
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // AI response is an array of observation drafts (shape checked below).
      type AiObservation = {
        swimmerName?: string;
        observation?: string;
        diagnosis?: string;
        drillRecommendation?: string;
        phase?: string;
        tags?: string[];
        confidence?: number;
      };

      let parsedUnknown: unknown;
      try {
        parsedUnknown = JSON.parse(jsonStr);
      } catch {
        // Try to find JSON array in the response
        const arrMatch = responseText.match(/\[[\s\S]*\]/);
        if (arrMatch) {
          parsedUnknown = JSON.parse(arrMatch[0]);
        } else {
          await sessionRef.update({
            status: 'failed',
            errorMessage: 'Could not parse AI response as JSON',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }
      }

      const observations: AiObservation[] = Array.isArray(parsedUnknown)
        ? (parsedUnknown as AiObservation[])
        : [];

      if (observations.length === 0) {
        await sessionRef.update({
          status: 'review',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      // Step 6: Write drafts to subcollection
      // Build swimmer name → ID map for matching
      const nameToId: Record<string, string> = {};
      for (let i = 0; i < swimmerNames.length; i++) {
        nameToId[swimmerNames[i].toLowerCase()] = taggedIds[i];
        // Also index by first name for partial matches
        const firstName = swimmerNames[i].split(' ')[0];
        if (firstName) nameToId[firstName.toLowerCase()] = taggedIds[i];
      }

      const draftsRef = db.collection(`video_sessions/${sessionId}/drafts`);
      const batch = db.batch();

      for (const obs of observations) {
        const swimmerNameLower = (obs.swimmerName || '').toLowerCase();
        const matchedId =
          nameToId[swimmerNameLower] ||
          Object.entries(nameToId).find(
            ([name]) => swimmerNameLower.includes(name) || name.includes(swimmerNameLower),
          )?.[1] ||
          taggedIds[0] || // Default to first tagged swimmer
          '';

        const draftRef = draftsRef.doc();
        batch.set(draftRef, {
          swimmerId: matchedId,
          swimmerName: obs.swimmerName || 'Unknown',
          observation: obs.observation || '',
          diagnosis: obs.diagnosis || '',
          drillRecommendation: obs.drillRecommendation || '',
          phase: obs.phase || 'general',
          tags: obs.tags || ['technique'],
          confidence: typeof obs.confidence === 'number' ? obs.confidence : 0.7,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      // Step 7: Update status to review
      await sessionRef.update({
        status: 'review',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      console.error('Video processing error:', err);
      const errorMessage = err instanceof Error && err.message ? err.message : 'Unknown error';
      await sessionRef.update({
        status: 'failed',
        errorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);
