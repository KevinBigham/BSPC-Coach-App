/**
 * Aggregations service — reads precomputed aggregation docs written by Cloud Functions.
 *
 * Doc paths:
 *   aggregations/attendance_{swimmerId} — attendance stats
 *   aggregations/swimmer_{swimmerId}   — PRs + note counts
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  AttendanceAggregation,
  DashboardActivityAggregation,
  DashboardAttendanceAggregation,
  SwimmerAggregation,
} from '../types/firestore.types';

/** Subscribe to a swimmer's attendance aggregation */
export function subscribeAttendanceAggregation(
  swimmerId: string,
  callback: (agg: AttendanceAggregation | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'aggregations', `attendance_${swimmerId}`),
    (snap) => {
      callback(snap.exists() ? (snap.data() as AttendanceAggregation) : null);
    },
    () => callback(null),
  );
}

/** Subscribe to a swimmer's PR/notes aggregation */
export function subscribeSwimmerAggregation(
  swimmerId: string,
  callback: (agg: SwimmerAggregation | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'aggregations', `swimmer_${swimmerId}`),
    (snap) => {
      callback(snap.exists() ? (snap.data() as SwimmerAggregation) : null);
    },
    () => callback(null),
  );
}

/** Subscribe to dashboard attendance aggregation */
export function subscribeDashboardAttendanceAggregation(
  callback: (agg: DashboardAttendanceAggregation | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'aggregations', 'dashboard_attendance'),
    (snap) => {
      callback(snap.exists() ? (snap.data() as DashboardAttendanceAggregation) : null);
    },
    () => callback(null),
  );
}

/** Subscribe to dashboard activity aggregation */
export function subscribeDashboardActivityAggregation(
  callback: (agg: DashboardActivityAggregation | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'aggregations', 'dashboard_activity'),
    (snap) => {
      callback(snap.exists() ? (snap.data() as DashboardActivityAggregation) : null);
    },
    () => callback(null),
  );
}

/** Get PR count from a SwimmerAggregation */
export function getPRCount(agg: SwimmerAggregation | null): number {
  if (!agg?.prsByEvent) return 0;
  return Object.keys(agg.prsByEvent).length;
}
