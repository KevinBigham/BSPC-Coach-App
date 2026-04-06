import { useState, useEffect } from 'react';
import { subscribeTimes } from '../services/times';
import type { SwimTime } from '../types/firestore.types';

type TimeWithId = SwimTime & { id: string };

export function useTimes(
  swimmerId: string | undefined,
  limit?: number,
): {
  times: TimeWithId[];
  loading: boolean;
} {
  const [times, setTimes] = useState<TimeWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) {
      setTimes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeTimes(
      swimmerId,
      (result) => {
        setTimes(result);
        setLoading(false);
      },
      limit,
    );
    return () => unsubscribe();
  }, [swimmerId, limit]);

  return { times, loading };
}
