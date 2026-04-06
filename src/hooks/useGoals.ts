import { useState, useEffect } from 'react';
import { subscribeGoals } from '../services/goals';
import type { SwimmerGoal } from '../types/firestore.types';

type GoalWithId = SwimmerGoal & { id: string };

export function useGoals(swimmerId: string | undefined): {
  goals: GoalWithId[];
  loading: boolean;
} {
  const [goals, setGoals] = useState<GoalWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeGoals(swimmerId, (result) => {
      setGoals(result);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [swimmerId]);

  return { goals, loading };
}
