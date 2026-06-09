'use client';

import { createContext, useContext } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

// Profile read migrated to canonical profiles + guardianships (UNIFY/05 Phase A,
// Option (b)); the Firebase session functions below stay until the identity-cluster
// cutover. Re-exported so consumers of this module keep their imports unchanged.
export { getParentProfile } from './profile';
export type { ParentProfile } from './profile';

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
