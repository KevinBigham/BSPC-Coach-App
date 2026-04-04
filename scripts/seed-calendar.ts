/**
 * Seed Firestore calendar with BSPC Spring 2026 practice schedule + meet dates.
 * Source: https://www.bspowercats.com/calendar
 *
 * Usage: npx tsx scripts/seed-calendar.ts
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

// ── Season bounds ──────────────────────────────────────────────
const SEASON_START = '2026-03-30';
const SEASON_END = '2026-05-23';

const COACH_ID = 'seed-script';
const COACH_NAME = 'BSPC Schedule';
const LOCATION = 'Swim Pool'; // default — adjust per venue

type Group = 'Bronze' | 'Silver' | 'Gold' | 'Advanced' | 'Platinum' | 'Diamond';

// ── Helper: generate all dates for a day-of-week within a range ─
function datesForDay(dayOfWeek: number, start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T12:00:00');
  const endDate = new Date(end + 'T12:00:00');

  // Advance to first matching day
  while (cur.getDay() !== dayOfWeek && cur <= endDate) {
    cur.setDate(cur.getDate() + 1);
  }

  while (cur <= endDate) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 7);
  }
  return dates;
}

// ── Practice schedule from bspowercats.com ─────────────────────
interface PracticeSlot {
  groups: Group[];
  dayOfWeek: number; // 0=Sun .. 6=Sat
  startTime: string; // "HH:MM" 24h
  endTime: string;
  label?: string; // e.g. "AM" for morning practices
}

const PRACTICE_SLOTS: PracticeSlot[] = [
  // ─── Diamond ───
  { groups: ['Diamond'], dayOfWeek: 1, startTime: '14:45', endTime: '16:45' },
  { groups: ['Diamond'], dayOfWeek: 2, startTime: '14:45', endTime: '16:45' },
  { groups: ['Diamond'], dayOfWeek: 3, startTime: '05:00', endTime: '06:30', label: 'AM' },
  { groups: ['Diamond'], dayOfWeek: 3, startTime: '14:45', endTime: '16:45', label: 'PM' },
  { groups: ['Diamond'], dayOfWeek: 4, startTime: '14:45', endTime: '16:45' },
  { groups: ['Diamond'], dayOfWeek: 5, startTime: '05:00', endTime: '06:30', label: 'AM' },
  { groups: ['Diamond'], dayOfWeek: 5, startTime: '14:45', endTime: '16:45', label: 'PM' },
  { groups: ['Diamond'], dayOfWeek: 6, startTime: '08:00', endTime: '09:30' },

  // ─── Platinum ───
  { groups: ['Platinum'], dayOfWeek: 1, startTime: '18:30', endTime: '20:00' },
  { groups: ['Platinum'], dayOfWeek: 2, startTime: '18:30', endTime: '20:00' },
  { groups: ['Platinum'], dayOfWeek: 3, startTime: '05:00', endTime: '06:30', label: 'AM' },
  { groups: ['Platinum'], dayOfWeek: 3, startTime: '17:15', endTime: '19:00', label: 'PM' },
  { groups: ['Platinum'], dayOfWeek: 4, startTime: '18:30', endTime: '20:00' },
  { groups: ['Platinum'], dayOfWeek: 5, startTime: '05:00', endTime: '06:30', label: 'AM' },
  { groups: ['Platinum'], dayOfWeek: 5, startTime: '17:15', endTime: '18:45', label: 'PM' },
  { groups: ['Platinum'], dayOfWeek: 6, startTime: '08:00', endTime: '09:30' },

  // ─── Advanced ───
  { groups: ['Advanced'], dayOfWeek: 1, startTime: '17:15', endTime: '19:00' },
  { groups: ['Advanced'], dayOfWeek: 3, startTime: '17:15', endTime: '19:00' },
  { groups: ['Advanced'], dayOfWeek: 5, startTime: '17:15', endTime: '18:45' },
  { groups: ['Advanced'], dayOfWeek: 6, startTime: '08:00', endTime: '09:30' },

  // ─── Gold ───
  { groups: ['Gold'], dayOfWeek: 4, startTime: '17:15', endTime: '18:45' },
  { groups: ['Gold'], dayOfWeek: 6, startTime: '09:30', endTime: '11:00' },

  // ─── Silver ───
  { groups: ['Silver'], dayOfWeek: 4, startTime: '17:15', endTime: '18:30' },
  { groups: ['Silver'], dayOfWeek: 6, startTime: '09:30', endTime: '10:45' },

  // ─── Bronze ───
  { groups: ['Bronze'], dayOfWeek: 4, startTime: '18:30', endTime: '19:30' },
  { groups: ['Bronze'], dayOfWeek: 6, startTime: '11:00', endTime: '12:00' },
];

// ── Meet dates ─────────────────────────────────────────────────
interface MeetEvent {
  title: string;
  date: string;
  startTime?: string;
  description: string;
  location: string;
}

const MEETS: MeetEvent[] = [
  {
    title: 'May Mayhem — Local Meet',
    date: '2026-05-02',
    description: 'Local meet. No practice this day.',
    location: 'TBD',
  },
  {
    title: 'BSPC Spring Intrasquad Meet',
    date: '2026-05-16',
    startTime: '08:45',
    description: 'Spring intrasquad meet. 8:45 AM start.',
    location: LOCATION,
  },
];

// ── Seed function ──────────────────────────────────────────────
async function seedCalendar() {
  const eventsCol = collection(db, 'events');
  let totalEvents = 0;

  // Firestore batches max 500 writes each
  let batch = writeBatch(db);
  let batchCount = 0;

  const flushBatch = async () => {
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} events`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  };

  // ── Generate practice events ──
  console.log('Generating practice events...');

  for (const slot of PRACTICE_SLOTS) {
    const dates = datesForDay(slot.dayOfWeek, SEASON_START, SEASON_END);
    const groupLabel = slot.groups.join('/');
    const amPm = slot.label ? ` (${slot.label})` : '';

    for (const date of dates) {
      // Skip May 2 — no practice (May Mayhem meet day)
      if (date === '2026-05-02') continue;

      const ref = doc(eventsCol);
      batch.set(ref, {
        title: `${groupLabel} Practice${amPm}`,
        type: 'practice',
        startDate: date,
        startTime: slot.startTime,
        endDate: date,
        endTime: slot.endTime,
        location: LOCATION,
        groups: slot.groups,
        description: '',
        coachId: COACH_ID,
        coachName: COACH_NAME,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batchCount++;
      totalEvents++;

      if (batchCount >= 490) {
        await flushBatch();
      }
    }
  }

  // ── Generate meet events ──
  console.log('Generating meet events...');

  for (const meet of MEETS) {
    const ref = doc(eventsCol);
    batch.set(ref, {
      title: meet.title,
      type: 'meet',
      startDate: meet.date,
      startTime: meet.startTime || '',
      endDate: meet.date,
      endTime: '',
      location: meet.location,
      groups: [], // all groups
      description: meet.description,
      coachId: COACH_ID,
      coachName: COACH_NAME,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batchCount++;
    totalEvents++;
  }

  await flushBatch();

  console.log(`\nDone! Seeded ${totalEvents} calendar events.`);
  console.log('Season: March 30 – May 23, 2026');
  console.log('Meets: May 2 (May Mayhem), May 16 (Intrasquad)');
  process.exit(0);
}

seedCalendar().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
