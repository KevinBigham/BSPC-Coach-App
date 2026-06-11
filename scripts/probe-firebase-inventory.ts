/**
 * §B0 live-project inventory probe — the I/O SHELL (06 PART B §B0, D-CUT3,
 * condition-first).
 *
 * ============================ HARD STOP ============================
 * Running this script is a Kevin-live OPERATION under 06 PART B's
 * governing rule. It landed as SCAFFOLDING in the staging round, and
 * the staging round never executes it. It connects to the LIVE
 * Firebase project named by the service-account key. Do not run it
 * from an agent session; do not run it without Kevin present.
 * ===================================================================
 *
 * READ-ONLY BY CONSTRUCTION: the only Firebase calls in this file are
 * count()/get() aggregates, listDocuments(), getFiles(), exists() and
 * listUsers(). No write API appears anywhere in its code path.
 *
 * Auth (PART A §6 handling rules): a service-account JSON named by
 * FIREBASE_ADMIN_KEY_PATH (else GOOGLE_APPLICATION_CREDENTIALS) — the
 * seed-tool idiom. The key is a real secret: gitignored, never committed,
 * never printed.
 *
 * Usage (Kevin-live only):
 *   FIREBASE_ADMIN_KEY_PATH=./google-service-account.json npx tsx scripts/probe-firebase-inventory.ts
 *
 * Output: the §B0 report table on stdout — preserve verbatim in
 * UNIFY/NOTES.md as the cutover record (also the D-J7 record). If the
 * project does not exist or a collection is EMPTY, every manifest over it
 * resolves to a NAMED NO-OP in that record (06 §B0).
 *
 * The pure half (census + report shaping) lives in
 * probe-firebase-inventory-report.ts and is unit-tested; this shell is
 * deliberately thin and UNTESTED (no trusted mocks — we do not fake a
 * Firestore).
 *
 * Lifecycle: retires WITH the seed scripts at 06 §B6 step 5.
 */

import { readFileSync } from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import {
  FIRESTORE_CENSUS,
  STORAGE_PREFIXES,
  aggregateStorageSizes,
  buildProbeReport,
  type ProbeCounts,
  type StoragePrefixCount,
} from './probe-firebase-inventory-report';

function initAdmin(): string {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    throw new Error(
      'Set FIREBASE_ADMIN_KEY_PATH to a Firebase Admin service account JSON file (PART A §6 handling rules).',
    );
  }
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  return serviceAccount.project_id;
}

async function countFirestore(): Promise<Record<string, number>> {
  const db = getFirestore();
  const out: Record<string, number> = {};
  for (const entry of FIRESTORE_CENSUS) {
    if (entry.kind === 'collection') {
      const snap = await db.collection(entry.id).count().get();
      out[entry.path] = snap.data().count;
    } else if (entry.kind === 'group') {
      const snap = await db.collectionGroup(entry.id).count().get();
      out[entry.path] = snap.data().count;
    } else {
      // perParent: the two /drafts ids collide across parents — count each
      // parent doc's subcollection and sum (listDocuments reads no doc data).
      const parents = await db.collection(entry.parent).listDocuments();
      let total = 0;
      for (const parentRef of parents) {
        const snap = await parentRef.collection(entry.id).count().get();
        total += snap.data().count;
      }
      out[entry.path] = total;
    }
  }
  return out;
}

async function resolveBucketName(projectId: string): Promise<string | null> {
  // The default-bucket name is a probe-time counted fact: newer projects use
  // <project>.firebasestorage.app, older ones <project>.appspot.com. The env
  // override wins; otherwise the first bucket that exists() is the one.
  const candidates = process.env.BSPC_FIREBASE_STORAGE_BUCKET
    ? [process.env.BSPC_FIREBASE_STORAGE_BUCKET]
    : [`${projectId}.firebasestorage.app`, `${projectId}.appspot.com`];
  for (const name of candidates) {
    const [bucketExists] = await getStorage().bucket(name).exists();
    if (bucketExists) {
      return name;
    }
  }
  return null;
}

async function countStorage(
  bucketName: string | null,
): Promise<Record<string, StoragePrefixCount>> {
  const out: Record<string, StoragePrefixCount> = {};
  for (const prefix of STORAGE_PREFIXES) {
    if (!bucketName) {
      out[prefix] = { objects: 0, bytes: 0 };
      continue;
    }
    const [files] = await getStorage().bucket(bucketName).getFiles({ prefix });
    out[prefix] = aggregateStorageSizes(files.map((file) => Number(file.metadata.size ?? 0)));
  }
  return out;
}

async function countAuthUsers(): Promise<number> {
  let total = 0;
  let pageToken: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    total += page.users.length;
    pageToken = page.pageToken;
  } while (pageToken);
  return total;
}

async function main() {
  const projectId = initAdmin();
  const bucketProbed = await resolveBucketName(projectId);
  const counts: ProbeCounts = {
    projectId,
    bucketProbed,
    firestore: await countFirestore(),
    storage: await countStorage(bucketProbed),
    authUsers: await countAuthUsers(),
  };
  console.log(buildProbeReport(counts, new Date().toISOString()));
}

if (require.main === module) {
  main().catch((error) => {
    // A dead or missing project is a §B0 OUTCOME, not a crash to hide:
    // record it — "every manifest over it resolves to a named no-op".
    console.error(
      '§B0 probe could not complete — if the project does not exist, record per 06 §B0: every manifest resolves to a NAMED NO-OP.',
    );
    console.error(error);
    process.exit(1);
  });
}
