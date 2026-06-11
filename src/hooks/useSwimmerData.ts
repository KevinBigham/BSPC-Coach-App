/**
 * Swimmer profile data hook — owns the top-level profile subscriptions and
 * derived state previously wired directly in app/swimmer/[id].tsx.
 *
 * The screen keeps UI-only state such as active tab, note composer fields, and
 * nested modal state. This hook mirrors the original loading behavior: loading
 * flips false when the swimmer subscription's first emission resolves. Phase K
 * re-pointed the last three direct-Firestore arms onto the PG services; the
 * hook holds ZERO direct Firestore.
 */

import { useEffect, useMemo, useState } from 'react';
import { subscribeSwimmer } from '../services/swimmers';
import { subscribeNotes } from '../services/notes';
import { subscribeTimes } from '../services/times';
import { subscribeSwimmerAttendance } from '../services/attendance';
import { subscribeGoals } from '../services/goals';
import { getTodayString } from '../utils/time';
import type {
  AttendanceRecord,
  Swimmer,
  SwimmerGoal,
  SwimmerNote,
  SwimTime,
} from '../types/firestore.types';

export type SwimmerProfileNote = Omit<SwimmerNote, 'source'> & {
  source: SwimmerNote['source'] | 'voice_inline';
};

interface SwimmerData {
  swimmer: Swimmer | null;
  notes: (SwimmerProfileNote & { id: string })[];
  times: (SwimTime & { id: string })[];
  attendance: (AttendanceRecord & { id: string })[];
  goals: (SwimmerGoal & { id: string })[];
  loading: boolean;
  prCount: number;
  todayAttendance: (AttendanceRecord & { id: string }) | null;
}

export function useSwimmerData(swimmerId: string): SwimmerData {
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [notes, setNotes] = useState<(SwimmerProfileNote & { id: string })[]>([]);
  const [times, setTimes] = useState<(SwimTime & { id: string })[]>([]);
  const [attendance, setAttendance] = useState<(AttendanceRecord & { id: string })[]>([]);
  const [goals, setGoals] = useState<(SwimmerGoal & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) return;
    // Missing row emits null (like snap.exists() === false): swimmer stays
    // null and loading still flips, mirroring the original behavior.
    return subscribeSwimmer(swimmerId, (s) => {
      if (s) setSwimmer(s as Swimmer);
      setLoading(false);
    });
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    // Same order (created_at desc) and bound (50) as the legacy query.
    return subscribeNotes(
      swimmerId,
      (rows) => setNotes(rows as unknown as (SwimmerProfileNote & { id: string })[]),
      50,
    );
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    return subscribeTimes(swimmerId, (rows) => setTimes(rows), 50);
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    return subscribeSwimmerAttendance(swimmerId, setAttendance, 90);
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    return subscribeGoals(swimmerId, (result) => {
      setGoals(result as (SwimmerGoal & { id: string })[]);
    });
  }, [swimmerId]);

  const prCount = useMemo(() => times.filter((time) => time.isPR).length, [times]);

  const todayAttendance = useMemo(() => {
    const today = getTodayString();
    return attendance.find((record) => record.practiceDate === today) || null;
  }, [attendance]);

  return {
    swimmer,
    notes,
    times,
    attendance,
    goals,
    loading,
    prCount,
    todayAttendance,
  };
}
