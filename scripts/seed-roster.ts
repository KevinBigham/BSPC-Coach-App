/**
 * Seed Firestore with BSPC roster from scripts/data/bspc-roster-2026.json.
 *
 * Source of truth: scripts/data/bspc-roster-2026.json (extracted from
 * "2025-2026 ROSTER APRIL 2026.xlsx" via scripts/extract-roster.py).
 *
 * Idempotent: upserts by firstName|lastName|dateOfBirth. Existing swimmers
 * are left untouched (their coach-edited fields like goals, strengths,
 * parent contacts, etc. are preserved).
 *
 * Usage: npx tsx scripts/seed-roster.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
  query,
  limit,
} from 'firebase/firestore';
import { config } from 'dotenv';

config();

const GROUPS = ['Bronze', 'Silver', 'Gold', 'Advanced', 'Platinum', 'Diamond'] as const;
type Group = (typeof GROUPS)[number];

interface RosterEntry {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  group: Group;
  dateOfBirth: string | null;
  usaSwimmingRegType: string | null;
  usaSwimmingExpDate: string | null;
}

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function dedupKey(firstName: string, lastName: string, dob: string | null): string {
  return `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${dob ?? ''}`;
}

async function getCoachUid(): Promise<string> {
  const snap = await getDocs(query(collection(db, 'coaches'), limit(10)));
  for (const d of snap.docs) {
    if (d.data().role === 'admin') return d.id;
  }
  if (snap.docs.length > 0) return snap.docs[0].id;
  throw new Error('No coaches found in Firestore. Sign in to the app first.');
}

async function getExistingKeys(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'swimmers'));
  const keys = new Set<string>();
  snap.forEach((d) => {
    const data = d.data();
    keys.add(dedupKey(data.firstName ?? '', data.lastName ?? '', data.dateOfBirth ?? null));
  });
  return keys;
}

async function main() {
  const jsonPath = join(__dirname, 'data', 'bspc-roster-2026.json');
  console.log(`Reading ${jsonPath}`);
  const entries: RosterEntry[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded ${entries.length} swimmers from JSON`);

  const coachUid = await getCoachUid();
  console.log(`Using coach UID: ${coachUid}`);

  const existingKeys = await getExistingKeys();
  console.log(`Found ${existingKeys.size} existing swimmers in Firestore`);

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < entries.length; i += 400) {
    const chunk = entries.slice(i, i + 400);
    const batch = writeBatch(db);

    for (const s of chunk) {
      const key = dedupKey(s.firstName, s.lastName, s.dateOfBirth);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      const ref = doc(collection(db, 'swimmers'));
      batch.set(ref, {
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: `${s.firstName} ${s.lastName}`,
        group: s.group,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        active: true,
        strengths: [],
        weaknesses: [],
        techniqueFocusAreas: [],
        goals: [],
        parentContacts: [],
        meetSchedule: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: coachUid,
      });
      existingKeys.add(key);
      created++;
    }

    try {
      await batch.commit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.error(`  Batch error: ${message}`);
    }
  }

  console.log('\n========== RESULTS ==========');
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) errors.forEach((e) => console.error(`  - ${e}`));
  console.log('=============================');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
