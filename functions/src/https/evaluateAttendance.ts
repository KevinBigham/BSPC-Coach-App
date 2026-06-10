// Phase G (D-G1): the client-invoke entry point for rule evaluation. The
// Firestore attendance trigger died with the Firestore attendance docs (dark
// since Phase C); the attendance data layer POSTs row ids here after a
// check-in/checkout commits, and the scheduled sweeper re-evaluates anything
// that slips. Same shared-secret gate as the media pipeline.
import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { evaluateAttendanceRowIds } from '../notifications/evaluator';

function gate(req: Request, res: Response): string[] | null {
  const secret = process.env.PROCESS_SHARED_SECRET || '';
  if (!secret || req.get('x-process-secret') !== secret) {
    res.status(401).send('unauthorized');
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).send('method not allowed');
    return null;
  }
  const attendanceIds = (req.body as { attendanceIds?: unknown } | undefined)?.attendanceIds;
  if (
    !Array.isArray(attendanceIds) ||
    attendanceIds.length === 0 ||
    !attendanceIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    res.status(400).send('attendanceIds required');
    return null;
  }
  return attendanceIds as string[];
}

export const evaluateAttendanceRules = onRequest(async (req, res) => {
  const attendanceIds = gate(req, res);
  if (!attendanceIds) return;
  await evaluateAttendanceRowIds(attendanceIds);
  res.status(200).send('ok');
});
