/**
 * Swimmer profile data hook — owns the top-level profile subscriptions and
 * derived state previously wired directly in app/swimmer/[id].tsx.
 *
 * The screen keeps UI-only state such as active tab, note composer fields, and
 * nested modal state. This hook mirrors the original loading behavior: loading
 * flips false when the swimmer document snapshot resolves.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
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
    const unsubscribe = onSnapshot(doc(db, 'swimmers', swimmerId), (snap) => {
      if (snap.exists()) {
        setSwimmer({ id: snap.id, ...snap.data() } as Swimmer);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    const notesQuery = query(
      collection(db, 'swimmers', swimmerId, 'notes'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(notesQuery, (snapshot) => {
      setNotes(
        snapshot.docs.map(
          (note) => ({ id: note.id, ...note.data() }) as SwimmerProfileNote & { id: string },
        ),
      );
    });
  }, [swimmerId]);

  useEffect(() => {
    if (!swimmerId) return;
    const timesQuery = query(
      collection(db, 'swimmers', swimmerId, 'times'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(timesQuery, (snapshot) => {
      setTimes(
        snapshot.docs.map((time) => ({ id: time.id, ...time.data() }) as SwimTime & { id: string }),
      );
    });
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
