/**
 * Seed deterministic convention demo data.
 *
 * Safety belt: this refuses to run unless EXPO_PUBLIC_BSPC_ENV=demo because
 * it deletes and replaces deterministic demo-* documents.
 *
 * Usage:
 *   EXPO_PUBLIC_BSPC_ENV=demo FIREBASE_ADMIN_KEY_PATH=./google-service-account.json npm run seed:demo
 *   EXPO_PUBLIC_BSPC_ENV=demo FIREBASE_ADMIN_KEY_PATH=./google-service-account.json npm run seed:demo:reset
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore, type DocumentData } from 'firebase-admin/firestore';
import type {
  Coach,
  Swimmer,
  AttendanceRecord,
  AIDraft,
  VideoSession,
} from '../src/types/firestore.types';
import type { Meet, MeetEntry } from '../src/types/meet.types';
import type { Group } from '../src/config/constants';

const DEMO_ENV = 'demo';
const DEMO_NOW = new Date('2026-05-06T12:00:00.000Z');
const PRACTICE_START = new Date('2026-04-07T12:00:00.000Z');
const BATCH_LIMIT = 400;
const DEMO_GROUPS: Group[] = [
  'Bronze',
  'Silver',
  'Gold',
  'Advanced',
  'Platinum',
  'Diamond',
  'Masters',
];

type DemoSwimmer = Swimmer & { id: string };
type DemoCoach = Coach & { uid: string };

export interface DemoWrite {
  path: string;
  data: unknown;
}

function pad(index: number): string {
  return String(index).padStart(2, '0');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTimeDisplay(hundredths: number): string {
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const cents = hundredths % 100;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(cents).padStart(2, '0')}`;
}

export function buildDemoCoaches(): DemoCoach[] {
  const groups = [...DEMO_GROUPS];
  return [
    {
      uid: 'demo-coach-alpha',
      email: 'demo.coach.alpha@example.com',
      displayName: 'Demo Coach Alpha',
      role: 'admin',
      groups,
      notificationPrefs: {
        dailyDigest: true,
        newNotes: true,
        attendanceAlerts: true,
        aiDraftsReady: true,
      },
      fcmTokens: [],
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    },
    {
      uid: 'demo-coach-beta',
      email: 'demo.coach.beta@example.com',
      displayName: 'Demo Coach Beta',
      role: 'coach',
      groups,
      notificationPrefs: {
        dailyDigest: true,
        newNotes: true,
        attendanceAlerts: false,
        aiDraftsReady: true,
      },
      fcmTokens: [],
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    },
  ];
}

export function buildDemoSwimmers(): DemoSwimmer[] {
  return Array.from({ length: 30 }, (_, zeroIndex) => {
    const index = zeroIndex + 1;
    const group = DEMO_GROUPS[zeroIndex % DEMO_GROUPS.length];
    const noConsent = index === 7 || index === 22;
    const doNotPhotograph = index === 4 || index === 18;
    const displayName = `BSPC Demo ${pad(index)}`;

    return {
      id: `demo-swimmer-${pad(index)}`,
      firstName: 'BSPC Demo',
      lastName: pad(index),
      displayName,
      dateOfBirth: new Date(`201${index % 8}-01-15T00:00:00.000Z`),
      gender: index % 2 === 0 ? 'F' : 'M',
      group,
      active: true,
      strengths: ['Demo ready attendance history'],
      weaknesses: ['Demo technique focus'],
      techniqueFocusAreas: ['Streamline', 'Catch timing'],
      goals: ['Convention demo improvement goal'],
      parentContacts: [
        {
          name: 'Demo Parent',
          phone: '555-0100',
          email: 'demo.parent@example.com',
          relationship: 'Parent/Guardian',
        },
      ],
      meetSchedule: ['BSPC Demo Invitational 2026'],
      ...(noConsent
        ? {}
        : {
            mediaConsent: {
              granted: true,
              date: new Date('2026-04-01T00:00:00.000Z'),
              grantedBy: 'Demo Parent',
            },
          }),
      ...(doNotPhotograph ? { doNotPhotograph: true } : {}),
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
      createdBy: 'demo-coach-alpha',
    };
  });
}

export function buildDemoAttendance(
  swimmers: DemoSwimmer[],
): Array<AttendanceRecord & { id: string }> {
  const records: Array<AttendanceRecord & { id: string }> = [];
  for (let day = 0; day < 30; day += 1) {
    const practiceDate = dateKey(addDays(PRACTICE_START, day));
    for (const swimmer of swimmers) {
      const swimmerNumber = Number(swimmer.id.slice(-2));
      if ((day + swimmerNumber) % 4 === 0) continue;
      records.push({
        id: `demo-attendance-${practiceDate}-${swimmer.id}`,
        swimmerId: swimmer.id,
        swimmerName: swimmer.displayName,
        group: swimmer.group,
        practiceDate,
        arrivedAt: addDays(PRACTICE_START, day),
        status: 'normal',
        markedBy: 'demo-coach-alpha',
        coachName: 'Demo Coach Alpha',
        createdAt: addDays(PRACTICE_START, day),
      });
    }
  }
  return records;
}

export function buildDemoMeet(): Meet & { id: string } {
  return {
    id: 'demo-meet-invitational-2026',
    name: 'BSPC Demo Invitational 2026',
    location: 'Wildcat Aquatic Center - Blue Springs, MO',
    course: 'SCY',
    startDate: '2026-05-08',
    endDate: '2026-05-08',
    status: 'upcoming',
    events: [
      { number: 1, name: '50 Free', gender: 'Mixed', isRelay: false },
      { number: 2, name: '100 Free', gender: 'Mixed', isRelay: false },
      { number: 3, name: '50 Back', gender: 'Mixed', isRelay: false },
      { number: 4, name: '100 IM', gender: 'Mixed', isRelay: false },
    ],
    groups: [...DEMO_GROUPS],
    notes: 'Convention demo meet seeded by scripts/seed-demo-data.ts.',
    hostTeam: 'Blue Springs Power Cats',
    coachId: 'demo-coach-alpha',
    coachName: 'Demo Coach Alpha',
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  };
}

export function buildDemoEntries(swimmers: DemoSwimmer[]): Array<MeetEntry & { id: string }> {
  return swimmers.slice(0, 8).map((swimmer, zeroIndex) => {
    const index = zeroIndex + 1;
    const eventNumber = (zeroIndex % 4) + 1;
    const eventName = ['50 Free', '100 Free', '50 Back', '100 IM'][eventNumber - 1];
    const seedTime = 2800 + index * 173;
    return {
      id: `demo-entry-${pad(index)}`,
      meetId: 'demo-meet-invitational-2026',
      swimmerId: swimmer.id,
      swimmerName: swimmer.displayName,
      group: swimmer.group,
      gender: swimmer.gender,
      age: 12 + (index % 5),
      eventName,
      eventNumber,
      seedTime,
      seedTimeDisplay: formatTimeDisplay(seedTime),
      finalTime: seedTime - 37,
      finalTimeDisplay: formatTimeDisplay(seedTime - 37),
      place: index,
      heat: Math.ceil(index / 4),
      lane: ((index - 1) % 4) + 2,
      isPR: index % 2 === 0,
      createdAt: DEMO_NOW,
    };
  });
}

export function buildDemoTimes(swimmers: DemoSwimmer[]) {
  return swimmers.slice(0, 8).map((swimmer, zeroIndex) => {
    const index = zeroIndex + 1;
    const time = 2800 + index * 173;
    return {
      swimmerId: swimmer.id,
      id: `demo-time-${pad(index)}`,
      data: {
        event: index % 2 === 0 ? '100 Free' : '50 Free',
        course: 'SCY',
        time,
        timeDisplay: formatTimeDisplay(time),
        isPR: index % 2 === 0,
        meetName: 'BSPC Demo Invitational 2026',
        meetDate: new Date('2026-05-08T12:00:00.000Z'),
        source: 'manual',
        createdAt: DEMO_NOW,
        createdBy: 'demo-coach-alpha',
      },
    };
  });
}

export function buildDemoSessions(swimmers: DemoSwimmer[]) {
  const audioSelected = swimmers.slice(0, 2);
  const videoSelected = swimmers.slice(4, 6);
  const audioDraft: AIDraft & { id: string } = {
    id: 'demo-audio-draft-01',
    swimmerId: audioSelected[0].id,
    swimmerName: audioSelected[0].displayName,
    observation: 'Demo audio draft scoped to pre-selected swimmers only.',
    tags: ['technique', 'freestyle'],
    confidence: 0.91,
    createdAt: DEMO_NOW,
  };
  const videoSession: VideoSession & { id: string } = {
    id: 'demo-video-session-01',
    coachId: 'demo-coach-alpha',
    coachName: 'Demo Coach Alpha',
    storagePath: 'demo/video/demo-session-01.mp4',
    duration: 12,
    practiceDate: '2026-05-06',
    group: undefined,
    taggedSwimmerIds: videoSelected.map((swimmer) => swimmer.id),
    selectedSwimmerIds: videoSelected.map((swimmer) => swimmer.id),
    status: 'review',
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  };

  return {
    audioSession: {
      id: 'demo-audio-session-01',
      coachId: 'demo-coach-alpha',
      coachName: 'Demo Coach Alpha',
      storagePath: 'demo/audio/demo-session-01.m4a',
      duration: 8,
      practiceDate: '2026-05-06',
      group: 'Gold' as Group,
      selectedSwimmerIds: audioSelected.map((swimmer) => swimmer.id),
      status: 'review' as const,
      transcription: 'BSPC Demo 01 and BSPC Demo 02 held streamline through breakout.',
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    },
    audioDraft,
    videoSession,
    videoDraft: {
      id: 'demo-video-draft-01',
      swimmerId: videoSelected[0].id,
      swimmerName: videoSelected[0].displayName,
      observation: 'Demo video draft scoped to selected swimmers.',
      diagnosis: 'Hand entry crosses centerline on breath cycle.',
      drillRecommendation: 'Single-arm freestyle with side balance.',
      phase: 'stroke',
      tags: ['technique'],
      confidence: 0.87,
      createdAt: DEMO_NOW,
    },
  };
}

export function buildDemoWrites(): DemoWrite[] {
  const coaches = buildDemoCoaches();
  const swimmers = buildDemoSwimmers();
  const attendance = buildDemoAttendance(swimmers);
  const meet = buildDemoMeet();
  const entries = buildDemoEntries(swimmers);
  const times = buildDemoTimes(swimmers);
  const sessions = buildDemoSessions(swimmers);

  return [
    ...coaches.map((coach) => ({ path: `coaches/${coach.uid}`, data: coach })),
    {
      path: 'parents/demo-parent',
      data: {
        uid: 'demo-parent',
        email: 'demo.parent@example.com',
        displayName: 'Demo Parent',
        linkedSwimmerIds: ['demo-swimmer-01'],
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      },
    },
    ...swimmers.map((swimmer) => ({ path: `swimmers/${swimmer.id}`, data: swimmer })),
    ...attendance.map((record) => ({ path: `attendance/${record.id}`, data: record })),
    { path: `meets/${meet.id}`, data: meet },
    ...entries.map((entry) => ({
      path: `meets/demo-meet-invitational-2026/entries/${entry.id}`,
      data: entry,
    })),
    ...times.map((time) => ({
      path: `swimmers/${time.swimmerId}/times/${time.id}`,
      data: time.data,
    })),
    { path: `audio_sessions/${sessions.audioSession.id}`, data: sessions.audioSession },
    {
      path: `audio_sessions/${sessions.audioSession.id}/drafts/${sessions.audioDraft.id}`,
      data: sessions.audioDraft,
    },
    { path: `video_sessions/${sessions.videoSession.id}`, data: sessions.videoSession },
    {
      path: `video_sessions/${sessions.videoSession.id}/drafts/${sessions.videoDraft.id}`,
      data: sessions.videoDraft,
    },
    {
      path: 'parent_invites/demo-parent-invite-01',
      data: {
        code: 'DEMO-1234',
        swimmerId: 'demo-swimmer-01',
        swimmerName: 'BSPC Demo 01',
        coachId: 'demo-coach-alpha',
        coachName: 'Demo Coach Alpha',
        redeemed: false,
        expiresAt: new Date('2026-05-15T12:00:00.000Z'),
        createdAt: DEMO_NOW,
      },
    },
  ];
}

export function buildDemoDeletePaths(): string[] {
  return buildDemoWrites().map((write) => write.path);
}

function assertDemoEnvironment(): void {
  if (process.env.EXPO_PUBLIC_BSPC_ENV !== DEMO_ENV) {
    throw new Error('Refusing to seed demo data unless EXPO_PUBLIC_BSPC_ENV=demo.');
  }
}

function initializeAdmin(): Firestore {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    throw new Error('Set FIREBASE_ADMIN_KEY_PATH to a Firebase Admin service account JSON file.');
  }
  const serviceAccount = JSON.parse(readFileSync(resolve(keyPath), 'utf-8'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

async function commitDeletePaths(db: Firestore, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const path of paths.slice(i, i + BATCH_LIMIT)) {
      batch.delete(db.doc(path));
    }
    await batch.commit();
  }
}

async function commitWrites(db: Firestore, writes: DemoWrite[]): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const write of writes.slice(i, i + BATCH_LIMIT)) {
      batch.set(db.doc(write.path), write.data as DocumentData);
    }
    await batch.commit();
  }
}

async function main() {
  assertDemoEnvironment();
  const db = initializeAdmin();
  const writes = buildDemoWrites();

  await commitDeletePaths(db, buildDemoDeletePaths());
  if (process.argv.includes('--delete-only')) {
    console.log(`Deleted ${writes.length} deterministic demo docs.`);
    return;
  }

  await commitWrites(db, writes);
  console.log(`Seeded ${writes.length} deterministic demo docs.`);
  console.log('Demo swimmers: BSPC Demo 01 through BSPC Demo 30');
  console.log('Demo invite code: DEMO-1234');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
