jest.mock('../../src/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'coach-001' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
  })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  addDoc: jest.fn().mockResolvedValue({ id: 'sess-VID-fixture' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date('2026-04-28T12:00:00.000Z')),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_s: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) =>
      complete(),
    ),
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.url/video.mp4'),
}));

import {
  createVideoSession,
  updateVideoSession,
  validateMediaConsent,
} from '../../src/services/video';
import { buildSwimmer, buildMediaConsent } from '../fixtures/coach';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('video.createVideoSession (critical op)', () => {
  it('happy path: writes a session with the supplied tagged swimmers', async () => {
    const consented = [1, 2].map((i) =>
      buildSwimmer({
        index: i,
        group: 'Gold',
        overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
      }),
    );
    const taggedIds = consented.map((s) => s.id);

    const id = await createVideoSession(
      'coach-001',
      'Coach One',
      30,
      '2026-04-28',
      taggedIds,
      'Gold',
      consented,
    );

    expect(id).toBe('sess-VID-fixture');
    const payload = firestore.addDoc.mock.calls[0][1];
    expect(payload.taggedSwimmerIds).toEqual(taggedIds);
    expect(payload.status).toBe('uploading');
    expect(payload.group).toBe('Gold');
  });

  it('edge: empty tag list accepts an explicit empty roster', async () => {
    const id = await createVideoSession(
      'coach-001',
      'Coach One',
      30,
      '2026-04-28',
      [],
      undefined,
      [],
    );
    expect(id).toBe('sess-VID-fixture');
    expect(firestore.addDoc).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // BUG #4 — createVideoSession must enforce media consent at the service boundary
  // ---------------------------------------------------------------------------

  it('failure mode (BUG #4): rejects when one tagged swimmer has mediaConsent.granted=false', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const blocked = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });

    await expect(
      createVideoSession(
        'coach-001',
        'Coach One',
        30,
        '2026-04-28',
        [consented.id, blocked.id],
        'Gold',
        [consented, blocked],
      ),
    ).rejects.toThrow(/media consent|cannot tag/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('failure mode (BUG #4): rejects when a tagged swimmer has doNotPhotograph=true', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const blocked = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: {
        doNotPhotograph: true,
        mediaConsent: buildMediaConsent({ granted: true }),
      },
    });

    await expect(
      createVideoSession(
        'coach-001',
        'Coach One',
        30,
        '2026-04-28',
        [consented.id, blocked.id],
        'Gold',
        [consented, blocked],
      ),
    ).rejects.toThrow(/do_not_photograph|cannot tag/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it('failure mode (BUG #4): rejects when a tagged swimmer has expired media consent', async () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const expired = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: true, expired: true }) },
    });

    await expect(
      createVideoSession(
        'coach-001',
        'Coach One',
        30,
        '2026-04-28',
        [consented.id, expired.id],
        'Gold',
        [consented, expired],
      ),
    ).rejects.toThrow(/expired_consent|cannot tag/i);
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });
});

describe('video.validateMediaConsent (critical op)', () => {
  it('happy path: returns empty array when all tagged swimmers have consent', () => {
    const consented = [1, 2].map((i) =>
      buildSwimmer({
        index: i,
        group: 'Gold',
        overrides: {
          active: true,
          mediaConsent: buildMediaConsent({ granted: true }),
        },
      }),
    );
    expect(
      validateMediaConsent(
        consented.map((s) => s.id),
        consented,
      ),
    ).toEqual([]);
  });

  it('edge: returns display names of swimmers without consent', () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { active: true, mediaConsent: buildMediaConsent({ granted: true }) },
    });
    const denied = buildSwimmer({
      index: 2,
      group: 'Gold',
      overrides: { mediaConsent: buildMediaConsent({ granted: false }) },
    });
    const dnp = buildSwimmer({
      index: 3,
      group: 'Gold',
      overrides: {
        active: true,
        doNotPhotograph: true,
        mediaConsent: buildMediaConsent({ granted: true }),
      },
    });

    expect(
      validateMediaConsent([consented.id, denied.id, dnp.id], [consented, denied, dnp]),
    ).toEqual([denied.displayName, dnp.displayName]);
  });

  it('failure-shape: ignores IDs not present in the swimmers list', () => {
    const consented = buildSwimmer({
      index: 1,
      group: 'Gold',
      overrides: { active: true, mediaConsent: buildMediaConsent({ granted: true }) },
    });
    expect(validateMediaConsent(['unknown-id'], [consented])).toEqual([]);
  });
});

describe('video.updateVideoSession (lifecycle)', () => {
  it('happy path: status transitions write through with updatedAt', async () => {
    await updateVideoSession('sess-VID-001', { status: 'posted' });
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'video_sessions/sess-VID-001' }),
      expect.objectContaining({ status: 'posted' }),
    );
    const payload = firestore.updateDoc.mock.calls[0][1];
    expect(payload.updatedAt).toBeDefined();
  });
});
