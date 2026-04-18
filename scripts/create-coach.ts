/**
 * One-time script to bootstrap a coach account.
 * Creates a Firebase Auth user, then creates the matching /coaches/{uid} doc
 * with role: 'admin'. Run interactively; password is never logged or sent
 * anywhere except Firebase.
 *
 * Usage: npx tsx scripts/create-coach.ts
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { config } from 'dotenv';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const email = (await rl.question('Email: ')).trim();
  const displayName = (await rl.question('Display name (e.g. Kevin Bigham): ')).trim();
  const password = (await rl.question('Password (min 6 chars, will not echo): ')).trim();
  rl.close();

  if (!email || !password || !displayName) {
    console.error('All fields are required.');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log('\nCreating Firebase Auth user...');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  console.log(`Auth user created: ${uid}`);

  console.log('Creating /coaches/' + uid + ' doc with role: admin...');
  await setDoc(doc(db, 'coaches', uid), {
    uid,
    email,
    displayName,
    role: 'admin',
    groups: ['Bronze', 'Silver', 'Gold', 'Advanced', 'Platinum', 'Diamond'],
    notificationPrefs: {
      dailyDigest: true,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    },
    fcmTokens: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('\n✓ Coach account ready.');
  console.log(`  Email:    ${email}`);
  console.log('  Password: <the one you just typed>');
  console.log(`  Role:     admin`);
  console.log(
    '\nSign in to the app with those creds. You can change the password later via Forgot Password.',
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
