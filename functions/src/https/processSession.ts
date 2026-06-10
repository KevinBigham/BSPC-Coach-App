// Phase F (D-F2): the client-invoke entry points. The Firestore status-flip
// triggers died with the Firestore session docs; the data layer POSTs here
// after flipping a session to 'uploaded', and the scheduled sweeper re-runs
// anything that slips. The shared secret is checked FIRST — these endpoints
// were never client-auth'd Firestore triggers' replacements for end users,
// and post-auth-cutover clients hold no Firebase token to verify (RF-4).
import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { processAudioSessionById, processVideoSessionById } from '../media/pipeline';

function gate(req: Request, res: Response): string | null {
  const secret = process.env.PROCESS_SHARED_SECRET || '';
  if (!secret || req.get('x-process-secret') !== secret) {
    res.status(401).send('unauthorized');
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).send('method not allowed');
    return null;
  }
  const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    res.status(400).send('sessionId required');
    return null;
  }
  return sessionId;
}

export const processAudioSession = onRequest(async (req, res) => {
  const sessionId = gate(req, res);
  if (!sessionId) return;
  await processAudioSessionById(sessionId);
  res.status(200).send('ok');
});

export const processVideoSession = onRequest(
  { timeoutSeconds: 540, memory: '1GiB' },
  async (req, res) => {
    const sessionId = gate(req, res);
    if (!sessionId) return;
    await processVideoSessionById(sessionId);
    res.status(200).send('ok');
  },
);
