import {
  collection,
  query,
  where,
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
import type { Group } from '../config/constants';
import type { NoteTag } from '../config/constants';
import type { FirebaseTimestamp } from '../types/firestore.types';

export interface GroupNote {
  id?: string;
  content: string;
  tags: NoteTag[];
  group: Group;
  practiceDate: string;
  coachId: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
}

type GroupNoteWithId = GroupNote & { id: string };

export function subscribeGroupNotes(
  group: Group | null,
  callback: (notes: GroupNoteWithId[]) => void,
  max: number = 30,
): Unsubscribe {
  const constraints = group
    ? [where('group', '==', group), orderBy('createdAt', 'desc'), firestoreLimit(max)]
    : [orderBy('createdAt', 'desc'), firestoreLimit(max)];

  const q = query(collection(db, 'group_notes'), ...constraints);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupNoteWithId));
  });
}

export async function addGroupNote(
  content: string,
  tags: NoteTag[],
  group: Group,
  coachId: string,
  coachName: string,
  practiceDate: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, 'group_notes'), {
    content,
    tags,
    group,
    practiceDate,
    coachId,
    coachName,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteGroupNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'group_notes', noteId));
}
