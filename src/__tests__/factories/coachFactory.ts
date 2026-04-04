import type { Coach } from '../../types/firestore.types';

let counter = 0;

export function buildCoach(overrides: Partial<Coach> = {}): Coach {
  counter++;
  return {
    uid: `coach-${counter}`,
    email: `coach${counter}@test.com`,
    displayName: `Coach ${counter}`,
    role: 'coach',
    groups: ['Gold', 'Silver'],
    notificationPrefs: {
      dailyDigest: true,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    },
    fcmTokens: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildAdmin(overrides: Partial<Coach> = {}): Coach {
  return buildCoach({ role: 'admin', ...overrides });
}

export function resetCoachFactory() {
  counter = 0;
}
