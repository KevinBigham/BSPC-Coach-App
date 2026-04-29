/**
 * Practice screen data hook — owns the top-level subscriptions for practice
 * plans and group notes. Editor/draft lifecycle state remains in the Zustand
 * practice store and on the screen.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeGroupNotes, type GroupNote } from '../services/groupNotes';
import { subscribePracticePlans } from '../services/practicePlans';
import type { PracticePlan } from '../types/firestore.types';

export type PlanWithId = PracticePlan & { id: string };

export interface PracticeData {
  plans: PlanWithId[];
  groupNotes: (GroupNote & { id: string })[];
  loading: boolean;
}

export function usePracticeData(): PracticeData {
  const { coach } = useAuth();
  const coachId = coach?.uid;
  const [plans, setPlans] = useState<PlanWithId[]>([]);
  const [groupNotes, setGroupNotes] = useState<(GroupNote & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coachId) {
      setPlans([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    return subscribePracticePlans(
      (data) => {
        setPlans(data);
        setLoading(false);
      },
      { coachId, max: 50 },
    );
  }, [coachId]);

  useEffect(
    () =>
      // Keep the current all-groups feed; future group filtering should be a separate behavior slice.
      subscribeGroupNotes(null, setGroupNotes),
    [],
  );

  return { plans, groupNotes, loading };
}
