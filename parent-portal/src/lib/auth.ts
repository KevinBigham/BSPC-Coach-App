'use client';

import { createContext, useContext } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface ParentProfile {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

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

export async function getParentProfile(uid: string): Promise<ParentProfile | null> {
  const snap = await getDoc(doc(db, 'parents', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as ParentProfile;
}
