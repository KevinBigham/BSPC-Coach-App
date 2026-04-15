import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Swimmer } from '../types/firestore.types';
import { toDateSafe, type FirestoreTimestampLike } from '../utils/date';

type SwimmerWithId = Swimmer & { id: string };

export function useSwimmer(swimmerId: string | undefined): {
  swimmer: SwimmerWithId | null;
  loading: boolean;
} {
  const [swimmer, setSwimmer] = useState<SwimmerWithId | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) {
      setSwimmer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'swimmers', swimmerId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Swimmer;
        // Convert Timestamp to Date for dateOfBirth if needed
        const dateOfBirth =
          toDateSafe(data.dateOfBirth as FirestoreTimestampLike) ?? data.dateOfBirth;
        setSwimmer({ ...data, dateOfBirth, id: snap.id });
      } else {
        setSwimmer(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [swimmerId]);

  return { swimmer, loading };
}
