import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { subscribeEntries } from '../services/meets';
import type { Meet, MeetEntry } from '../types/meet.types';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };

export function useMeetDetails(meetId: string | undefined): {
  meet: MeetWithId | null;
  entries: EntryWithId[];
  loading: boolean;
} {
  const [meet, setMeet] = useState<MeetWithId | null>(null);
  const [entries, setEntries] = useState<EntryWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meetId) {
      setMeet(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let meetLoaded = false;
    let entriesLoaded = false;

    const checkDone = () => {
      if (meetLoaded && entriesLoaded) {
        setLoading(false);
      }
    };

    const unsubMeet = onSnapshot(doc(db, 'meets', meetId), (snap) => {
      if (snap.exists()) {
        setMeet({ id: snap.id, ...snap.data() } as MeetWithId);
      } else {
        setMeet(null);
      }
      meetLoaded = true;
      checkDone();
    });

    const unsubEntries = subscribeEntries(meetId, (result) => {
      setEntries(result);
      entriesLoaded = true;
      checkDone();
    });

    return () => {
      unsubMeet();
      unsubEntries();
    };
  }, [meetId]);

  return { meet, entries, loading };
}
