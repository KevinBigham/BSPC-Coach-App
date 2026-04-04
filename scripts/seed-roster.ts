/**
 * One-time script to seed Firestore with real BSPC roster from Excel.
 * Usage: npx tsx scripts/seed-roster.ts
 */

import XLSX from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, getDocs, writeBatch, doc, serverTimestamp, limit } from 'firebase/firestore';
import { config } from 'dotenv';

// Load .env for Firebase config
config();

const GROUPS = ['Bronze', 'Silver', 'Gold', 'Advanced', 'Platinum', 'Diamond'] as const;

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

const XLSX_PATH = '/Users/tkevinbigham/Downloads/2025-2026 ROSTER APRIL 2026.xlsx';

interface RosterRow {
  'Last Name'?: string;
  'First Name'?: string;
  'Comp. Category'?: string;
  'Age'?: number;
  'Birthdate'?: string;
  'Practice Group'?: string;
  [key: string]: any;
}

function mapGroup(practiceGroup: string): string | null {
  const pg = practiceGroup.trim().toLowerCase();
  for (const g of GROUPS) {
    if (pg.startsWith(g.toLowerCase())) return g;
  }
  return null;
}

function extractGender(compCategory: string): 'M' | 'F' {
  const trimmed = compCategory.trim();
  if (trimmed.startsWith('M')) return 'M';
  if (trimmed.startsWith('F')) return 'F';
  return 'F'; // fallback
}

async function getCoachUid(): Promise<string> {
  const snap = await getDocs(query(collection(db, 'coaches'), limit(10)));
  // Prefer admin coach
  for (const d of snap.docs) {
    if (d.data().role === 'admin') return d.id;
  }
  // Fallback to first coach
  if (snap.docs.length > 0) return snap.docs[0].id;
  throw new Error('No coaches found in Firestore. Please sign in to the app first.');
}

async function getExistingKeys(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'swimmers'));
  const keys = new Set<string>();
  snap.forEach((d) => {
    const data = d.data();
    keys.add(`${data.firstName?.toLowerCase()}|${data.lastName?.toLowerCase()}|${data.group?.toLowerCase()}`);
  });
  return keys;
}

async function main() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: RosterRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`Parsed ${rows.length} rows from spreadsheet`);

  // Find coach UID
  const coachUid = await getCoachUid();
  console.log(`Using coach UID: ${coachUid}`);

  // Get existing swimmers for duplicate detection
  const existingKeys = await getExistingKeys();
  console.log(`Found ${existingKeys.size} existing swimmers in Firestore`);

  // Split rows at "REMOVED FROM ROSTER" marker
  let inRemovedSection = false;
  const activeRows: { firstName: string; lastName: string; gender: 'M' | 'F'; dateOfBirth: string | null; group: string }[] = [];
  const inactiveRows: typeof activeRows = [];

  for (const row of rows) {
    const lastName = String(row['Last Name'] || '').trim();
    const firstName = String(row['First Name'] || '').trim();
    const practiceGroup = String(row['Practice Group'] || '').trim();

    // Detect "REMOVED FROM ROSTER" section
    if (lastName === 'REMOVED FROM ROSTER' || lastName === 'Estimated for March 1') {
      inRemovedSection = true;
      continue;
    }

    // Skip empty rows and summary rows
    if (!lastName && !firstName) continue;
    if (!lastName || !firstName) continue;

    // Map group
    const group = practiceGroup ? mapGroup(practiceGroup) : null;
    if (!group) {
      // Skip rows without a valid group (summary rows, etc.)
      if (practiceGroup && !['DIAMOND-1', 'DIAMOND-2', 'PLATINUM', 'ADVANCED', 'GOLD', 'SILVER', 'BRONZE'].includes(lastName)) {
        console.warn(`  Skipping "${firstName} ${lastName}": unknown group "${practiceGroup}"`);
      }
      continue;
    }

    const gender = extractGender((row['Comp. Category'] || '').toString());
    const birthdate = row['Birthdate'] ? String(row['Birthdate']).trim() : null;

    const swimmer = { firstName, lastName, gender, dateOfBirth: birthdate || null, group };

    if (inRemovedSection) {
      inactiveRows.push(swimmer);
    } else {
      activeRows.push(swimmer);
    }
  }

  console.log(`\nActive swimmers to import: ${activeRows.length}`);
  console.log(`Inactive (removed) swimmers to import: ${inactiveRows.length}`);

  // Import function
  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  async function importBatch(swimmers: typeof activeRows, active: boolean) {
    for (let i = 0; i < swimmers.length; i += 400) {
      const chunk = swimmers.slice(i, i + 400);
      const batch = writeBatch(db);

      for (const s of chunk) {
        const key = `${s.firstName.toLowerCase()}|${s.lastName.toLowerCase()}|${s.group.toLowerCase()}`;
        if (existingKeys.has(key)) {
          totalSkipped++;
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
          active,
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
        totalCreated++;
      }

      try {
        await batch.commit();
      } catch (err: any) {
        errors.push(err.message);
        console.error(`  Batch error: ${err.message}`);
      }
    }
  }

  console.log('\nImporting active swimmers...');
  await importBatch(activeRows, true);

  console.log('Importing inactive (removed) swimmers...');
  await importBatch(inactiveRows, false);

  console.log('\n========== RESULTS ==========');
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach((e) => console.error(`  - ${e}`));
  }
  console.log('=============================');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
