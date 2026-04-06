import { useState, useEffect } from 'react';
import { subscribeSwimmerAttendance } from '../services/attendance';
import type { AttendanceRecord } from '../types/firestore.types';

type AttendanceWithId = AttendanceRecord & { id: string };

export function useSwimmerAttendance(
  swimmerId: string | undefined,
  limit?: number,
): {
  records: AttendanceWithId[];
  loading: boolean;
} {
  const [records, setRecords] = useState<AttendanceWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!swimmerId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeSwimmerAttendance(
      swimmerId,
      (result) => {
        setRecords(result);
        setLoading(false);
      },
      limit,
    );
    return () => unsubscribe();
  }, [swimmerId, limit]);

  return { records, loading };
}
