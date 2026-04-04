/**
 * Seed Firestore with BSPC Spring 2026 meets.
 * Source: https://www.bspowercats.com/calendar
 *
 * Usage: npx tsx scripts/seed-meets.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { config } from 'dotenv';

config();

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

const COACH_ID = 'seed-script';
const COACH_NAME = 'BSPC Schedule';

// Standard SCY meet events (typical USA Swimming dual/invite)
function standardSCYEvents() {
  return [
    { number: 1, name: '200 Medley Relay', gender: 'Mixed' as const, isRelay: true },
    { number: 2, name: '200 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 3, name: '200 IM', gender: 'Mixed' as const, isRelay: false },
    { number: 4, name: '50 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 5, name: '100 Fly', gender: 'Mixed' as const, isRelay: false },
    { number: 6, name: '100 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 7, name: '500 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 8, name: '200 Free Relay', gender: 'Mixed' as const, isRelay: true },
    { number: 9, name: '100 Back', gender: 'Mixed' as const, isRelay: false },
    { number: 10, name: '100 Breast', gender: 'Mixed' as const, isRelay: false },
    { number: 11, name: '400 Free Relay', gender: 'Mixed' as const, isRelay: true },
  ];
}

// Intrasquad meet — shorter event list, fun format
function intrasquadEvents() {
  return [
    { number: 1, name: '200 Medley Relay', gender: 'Mixed' as const, isRelay: true },
    { number: 2, name: '100 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 3, name: '50 Back', gender: 'Mixed' as const, isRelay: false },
    { number: 4, name: '50 Breast', gender: 'Mixed' as const, isRelay: false },
    { number: 5, name: '50 Fly', gender: 'Mixed' as const, isRelay: false },
    { number: 6, name: '50 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 7, name: '100 IM', gender: 'Mixed' as const, isRelay: false },
    { number: 8, name: '200 Free', gender: 'Mixed' as const, isRelay: false },
    { number: 9, name: '200 Free Relay', gender: 'Mixed' as const, isRelay: true },
  ];
}

const MEETS = [
  {
    name: 'May Mayhem — Local Meet',
    location: 'TBD',
    course: 'SCY',
    startDate: '2026-05-02',
    status: 'upcoming',
    events: standardSCYEvents(),
    groups: [], // all groups
    notes: 'Local meet. No practice this day. Check Commit Swimming for entries.',
    hostTeam: 'Blue Springs Power Cats',
  },
  {
    name: 'BSPC Spring Intrasquad Meet',
    location: 'Blue Springs Aquatic Center',
    course: 'SCY',
    startDate: '2026-05-16',
    status: 'upcoming',
    events: intrasquadEvents(),
    groups: [], // all groups
    notes: 'Spring intrasquad. 8:45 AM warm-up. All groups swim!',
    hostTeam: 'Blue Springs Power Cats',
  },
];

async function seedMeets() {
  const meetsCol = collection(db, 'meets');
  const batch = writeBatch(db);

  for (const meet of MEETS) {
    const ref = doc(meetsCol);
    batch.set(ref, {
      ...meet,
      coachId: COACH_ID,
      coachName: COACH_NAME,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`  + ${meet.name} (${meet.startDate}) — ${meet.events.length} events`);
  }

  await batch.commit();
  console.log(`\nDone! Seeded ${MEETS.length} meets.`);
  process.exit(0);
}

seedMeets().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
