import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { VertexAI } from '@google-cloud/vertexai';
import { getPracticeGenerationPrompt } from '../ai/practicePrompts';

interface PracticeRequest {
  group: string;
  focus: string;
  targetYardage: number;
  durationMinutes: number;
  meetName?: string;
  notes?: string;
}

export const generatePractice = onCall(
  { maxInstances: 10, timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const data = request.data as PracticeRequest;

    if (!data.group || !data.focus || !data.targetYardage || !data.durationMinutes) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    const prompt = getPracticeGenerationPrompt(data);

    try {
      const vertexAI = new VertexAI({
        project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '',
        location: 'us-central1',
      });

      const model = vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new HttpsError('internal', 'No response from AI model');
      }

      const parsed = JSON.parse(text);

      // Validate structure
      if (!parsed.sets || !Array.isArray(parsed.sets)) {
        throw new HttpsError('internal', 'Invalid practice structure from AI');
      }

      return parsed;
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      console.error('AI practice generation failed:', err);
      const message = err instanceof Error && err.message ? err.message : 'unknown error';
      throw new HttpsError('internal', 'Failed to generate practice: ' + message);
    }
  },
);
