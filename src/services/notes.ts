import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SwimmerNote } from '../types/firestore.types';
import type { NoteTag } from '../config/constants';

type NoteWithId = SwimmerNote & { id: string };

export function subscribeNotes(
  swimmerId: string,
  callback: (notes: NoteWithId[]) => void,
  max: number = 50
): Unsubscribe {
  const q = query(
    collection(db, 'swimmers', swimmerId, 'notes'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(max)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NoteWithId))
    );
  });
}

export async function addNote(
  swimmerId: string,
  content: string,
  tags: NoteTag[],
  coach: { uid: string; displayName: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, 'swimmers', swimmerId, 'notes'), {
    content,
    tags,
    source: 'manual',
    coachId: coach.uid,
    coachName: coach.displayName,
    practiceDate: new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteNote(
  swimmerId: string,
  noteId: string
): Promise<void> {
  await deleteDoc(doc(db, 'swimmers', swimmerId, 'notes', noteId));
}
