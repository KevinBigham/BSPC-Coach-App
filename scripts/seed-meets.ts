/**
 * Seed Firestore with BSPC 2026 Spring & Summer meet schedule.
 *
 * Source: BSPC Spring & Summer 2026 meet schedule (April–August 2026).
 * CSC Spring Classic event list from the official meet packet
 * (MV-26-44, Mizzou Aquatic Center, April 24–25, 2026).
 *
 * Idempotent: upserts by (name, startDate). Existing meets are updated in
 * place; their subcollections (entries, relays, results) are not touched.
 *
 * Usage: npx tsx scripts/seed-meets.ts
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
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

type MeetEvent = {
  number: number;
  name: string;
  gender: 'F' | 'M' | 'Mixed';
  ageGroup?: string;
  isRelay: boolean;
};

function standardSCYEvents(): MeetEvent[] {
  return [
    { number: 1, name: '200 Medley Relay', gender: 'Mixed', isRelay: true },
    { number: 2, name: '200 Free', gender: 'Mixed', isRelay: false },
    { number: 3, name: '200 IM', gender: 'Mixed', isRelay: false },
    { number: 4, name: '50 Free', gender: 'Mixed', isRelay: false },
    { number: 5, name: '100 Fly', gender: 'Mixed', isRelay: false },
    { number: 6, name: '100 Free', gender: 'Mixed', isRelay: false },
    { number: 7, name: '500 Free', gender: 'Mixed', isRelay: false },
    { number: 8, name: '200 Free Relay', gender: 'Mixed', isRelay: true },
    { number: 9, name: '100 Back', gender: 'Mixed', isRelay: false },
    { number: 10, name: '100 Breast', gender: 'Mixed', isRelay: false },
    { number: 11, name: '400 Free Relay', gender: 'Mixed', isRelay: true },
  ];
}

function standardLCMEvents(): MeetEvent[] {
  return [
    { number: 1, name: '200 Medley Relay', gender: 'Mixed', isRelay: true },
    { number: 2, name: '200 Free', gender: 'Mixed', isRelay: false },
    { number: 3, name: '200 IM', gender: 'Mixed', isRelay: false },
    { number: 4, name: '50 Free', gender: 'Mixed', isRelay: false },
    { number: 5, name: '100 Fly', gender: 'Mixed', isRelay: false },
    { number: 6, name: '100 Free', gender: 'Mixed', isRelay: false },
    { number: 7, name: '400 Free', gender: 'Mixed', isRelay: false },
    { number: 8, name: '200 Free Relay', gender: 'Mixed', isRelay: true },
    { number: 9, name: '100 Back', gender: 'Mixed', isRelay: false },
    { number: 10, name: '100 Breast', gender: 'Mixed', isRelay: false },
    { number: 11, name: '200 Back', gender: 'Mixed', isRelay: false },
    { number: 12, name: '200 Breast', gender: 'Mixed', isRelay: false },
    { number: 13, name: '200 Fly', gender: 'Mixed', isRelay: false },
    { number: 14, name: '400 IM', gender: 'Mixed', isRelay: false },
    { number: 15, name: '50 Back', gender: 'Mixed', isRelay: false },
    { number: 16, name: '50 Breast', gender: 'Mixed', isRelay: false },
    { number: 17, name: '50 Fly', gender: 'Mixed', isRelay: false },
    { number: 18, name: '800 Free', gender: 'Mixed', isRelay: false },
    { number: 19, name: '1500 Free', gender: 'Mixed', isRelay: false },
    { number: 20, name: '400 Free Relay', gender: 'Mixed', isRelay: true },
    { number: 21, name: '400 Medley Relay', gender: 'Mixed', isRelay: true },
  ];
}

function intrasquadEvents(): MeetEvent[] {
  return [
    { number: 1, name: '200 Medley Relay', gender: 'Mixed', isRelay: true },
    { number: 2, name: '100 Free', gender: 'Mixed', isRelay: false },
    { number: 3, name: '50 Back', gender: 'Mixed', isRelay: false },
    { number: 4, name: '50 Breast', gender: 'Mixed', isRelay: false },
    { number: 5, name: '50 Fly', gender: 'Mixed', isRelay: false },
    { number: 6, name: '50 Free', gender: 'Mixed', isRelay: false },
    { number: 7, name: '100 IM', gender: 'Mixed', isRelay: false },
    { number: 8, name: '200 Free', gender: 'Mixed', isRelay: false },
    { number: 9, name: '200 Free Relay', gender: 'Mixed', isRelay: true },
  ];
}

/** Official CSC Spring Classic event list (April 24–25, 2026, Mizzou). */
function cscSpringClassicEvents(): MeetEvent[] {
  const events: MeetEvent[] = [];
  let n = 1;

  const push13O = (name: string) => {
    events.push({
      number: n++,
      name: `13 & Over ${name}`,
      gender: 'F',
      ageGroup: '13&O',
      isRelay: false,
    });
    events.push({
      number: n++,
      name: `13 & Over ${name}`,
      gender: 'M',
      ageGroup: '13&O',
      isRelay: false,
    });
  };
  const push12U = (name: string) => {
    events.push({
      number: n++,
      name: `12 & Under ${name}`,
      gender: 'F',
      ageGroup: '12&U',
      isRelay: false,
    });
    events.push({
      number: n++,
      name: `12 & Under ${name}`,
      gender: 'M',
      ageGroup: '12&U',
      isRelay: false,
    });
  };

  // Friday Distance 13 & Over (1–2)
  push13O('800 Free');
  // Friday Evening 13 & Over (3–14)
  for (const e of ['200 Free', '100 Fly', '200 Back', '100 Breast', '50 Free', '400 IM'])
    push13O(e);
  // Saturday AM 13 & Over (15–26)
  for (const e of ['200 IM', '100 Free', '200 Fly', '100 Back', '200 Breast', '400 Free'])
    push13O(e);
  // Saturday PM 12 & Under (27–48)
  for (const e of [
    '200 Free',
    '50 Fly',
    '100 Back',
    '50 Breast',
    '100 Free',
    '200 IM',
    '100 Fly',
    '50 Back',
    '100 Breast',
    '50 Free',
    '400 Free',
  ])
    push12U(e);

  return events;
}

type SeedMeet = {
  name: string;
  location: string;
  course: 'SCY' | 'SCM' | 'LCM';
  startDate: string;
  endDate: string;
  status: 'upcoming';
  events: MeetEvent[];
  groups: string[];
  notes: string;
  hostTeam: string;
};

const MEETS: SeedMeet[] = [
  // Regular Season
  {
    name: 'CSC Spring Classic',
    location: 'Mizzou Aquatic Center — Columbia, MO',
    course: 'LCM',
    startDate: '2026-04-24',
    endDate: '2026-04-25',
    status: 'upcoming',
    events: cscSpringClassicEvents(),
    groups: [],
    notes:
      'Sanction MV-26-44. Friday distance 12:00pm WU / 1:00pm start. Friday evening 3:00pm WU / 4:15pm start. Saturday AM 7:00am WU / 8:15am start. Saturday PM 1:00pm WU / 2:00pm start. 13&O max 3 events/day; 12&U max 4 events/day. Entry deadline 4/8/26 6pm CST. $7/event + $35 facility surcharge. Meet Director: Monica Miner. Meet Referee: Sue Schultz.',
    hostTeam: 'Columbia Swim Club',
  },
  {
    name: 'May Mayhem',
    location: "LSR7 Aquatic Center — Lee's Summit, MO",
    course: 'LCM',
    startDate: '2026-05-02',
    endDate: '2026-05-03',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Regular season LCM invite.',
    hostTeam: 'LSR7',
  },
  {
    name: 'BSPC Spring 2026 Intrasquad',
    location: 'Wildcat Aquatic Center — Blue Springs, MO',
    course: 'SCY',
    startDate: '2026-05-16',
    endDate: '2026-05-16',
    status: 'upcoming',
    events: intrasquadEvents(),
    groups: [],
    notes: '8:45am start time. All groups swim. Intrasquad — fun format.',
    hostTeam: 'Blue Springs Power Cats',
  },
  {
    name: 'Beach Bash',
    location: 'Blaisdell Family Aquatic Center at Gage Park — Topeka, KS',
    course: 'LCM',
    startDate: '2026-06-05',
    endDate: '2026-06-07',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'LCM regular season invite.',
    hostTeam: 'Topeka Swim Association',
  },
  {
    name: 'Show-Me Games',
    location: 'Hickman High School — Columbia, MO',
    course: 'SCY',
    startDate: '2026-06-13',
    endDate: '2026-06-14',
    status: 'upcoming',
    events: standardSCYEvents(),
    groups: [],
    notes: 'SCY regular season invite.',
    hostTeam: 'Show-Me State Games',
  },
  {
    name: 'Air Capital',
    location: 'WSC Pool — Independent School Campus — Wichita, KS',
    course: 'LCM',
    startDate: '2026-06-19',
    endDate: '2026-06-21',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'LCM regular season invite.',
    hostTeam: 'Wichita Swim Club',
  },
  {
    name: 'CNS Summer Invite',
    location: 'The Springs Aquatic Center — Kansas City, MO',
    course: 'LCM',
    startDate: '2026-06-27',
    endDate: '2026-06-28',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'LCM regular season invite.',
    hostTeam: 'CNS',
  },
  {
    name: 'BSPC Summer 2026 Intrasquad',
    location: 'Wildcat Aquatic Center — Blue Springs, MO',
    course: 'SCY',
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    status: 'upcoming',
    events: intrasquadEvents(),
    groups: [],
    notes: '8:45am start time. All groups swim. Season-closing intrasquad.',
    hostTeam: 'Blue Springs Power Cats',
  },

  // Championship Meets
  {
    name: 'Missouri Valley Senior Championships',
    location: 'Capitol Federal Natatorium — Topeka, KS',
    course: 'LCM',
    startDate: '2026-07-09',
    endDate: '2026-07-12',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Must achieve time standard. Championship meet.',
    hostTeam: 'Missouri Valley Swimming',
  },
  {
    name: 'Region VIII Sectional Championships',
    location: 'Mizzou Aquatic Center — Columbia, MO',
    course: 'LCM',
    startDate: '2026-07-15',
    endDate: '2026-07-18',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Must achieve time standard. Sectional championship.',
    hostTeam: 'USA Swimming — Region VIII',
  },
  {
    name: 'Missouri Valley Districts',
    location: 'Capitol Federal Natatorium — Topeka, KS',
    course: 'LCM',
    startDate: '2026-07-17',
    endDate: '2026-07-19',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Must achieve time standard. District championship.',
    hostTeam: 'Missouri Valley Swimming',
  },
  {
    name: 'Missouri Valley Age Group Championships',
    location: 'Shawnee Mission School District Aquatic Center — Lenexa, KS',
    course: 'LCM',
    startDate: '2026-07-23',
    endDate: '2026-07-26',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Must achieve time standard. Age group championship.',
    hostTeam: 'Missouri Valley Swimming',
  },
  {
    name: 'Central Zone Championships',
    location: 'Deaconess Aquatic Center — Evansville, IN',
    course: 'LCM',
    startDate: '2026-07-30',
    endDate: '2026-08-02',
    status: 'upcoming',
    events: standardLCMEvents(),
    groups: [],
    notes: 'Must achieve AAA time standard. Zone championship.',
    hostTeam: 'USA Swimming — Central Zone',
  },
];

function meetKey(name: string, startDate: string): string {
  return `${name.toLowerCase()}|${startDate}`;
}

async function seedMeets() {
  const meetsCol = collection(db, 'meets');
  const existing = await getDocs(meetsCol);
  const existingByKey = new Map<string, string>(); // key → docId
  existing.forEach((d) => {
    const data = d.data();
    if (data.name && data.startDate) {
      existingByKey.set(meetKey(data.name, data.startDate), d.id);
    }
  });
  console.log(`Found ${existingByKey.size} existing meets`);

  const batch = writeBatch(db);
  let created = 0;
  let updated = 0;

  for (const meet of MEETS) {
    const key = meetKey(meet.name, meet.startDate);
    const existingId = existingByKey.get(key);
    const ref = existingId ? doc(meetsCol, existingId) : doc(meetsCol);

    batch.set(
      ref,
      {
        ...meet,
        coachId: COACH_ID,
        coachName: COACH_NAME,
        updatedAt: serverTimestamp(),
        ...(existingId ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    if (existingId) {
      updated++;
      console.log(`  ~ UPDATE ${meet.name} (${meet.startDate}) — ${meet.events.length} events`);
    } else {
      created++;
      console.log(`  + CREATE ${meet.name} (${meet.startDate}) — ${meet.events.length} events`);
    }
  }

  await batch.commit();
  console.log(`\nDone. Created ${created}, updated ${updated}, total ${MEETS.length}.`);
  process.exit(0);
}

seedMeets().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
