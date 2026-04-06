import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db, mockCollectionRef } = createMockFirestore();
const fieldValue = createMockFieldValue();
const mockAdd = jest.fn().mockResolvedValue({ id: 'notif-1' });

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    { FieldValue: fieldValue },
  ),
}));

import { dailyDigest } from '../scheduled/dailyDigest';

describe('dailyDigest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdd.mockClear();
  });

  it('should be defined', () => {
    expect(dailyDigest).toBeDefined();
  });

  it('should create notifications for coaches with dailyDigest enabled', async () => {
    const handler = (dailyDigest as any).__wrapped ?? (dailyDigest as any).run;
    if (!handler) return;

    // attendance query
    const attendanceDocs = [
      createMockDoc('a1', { swimmerId: 's1', practiceDate: '2026-04-06' }),
      createMockDoc('a2', { swimmerId: 's2', practiceDate: '2026-04-06', departedAt: '18:00' }),
    ];

    // notes query
    const notesDocs = [createMockDoc('n1', { text: 'Good practice' })];

    // video_sessions query
    const videoDocs = [createMockDoc('v1', { status: 'review' })];

    // coaches query
    const coachDocs = [
      createMockDoc('coach-1', { notificationPrefs: { dailyDigest: true } }),
      createMockDoc('coach-2', { notificationPrefs: { dailyDigest: false } }),
      createMockDoc('coach-3', { notificationPrefs: {} }),
    ];

    // Setup sequential collection/collectionGroup calls
    let callCount = 0;
    const mockCollWithWhere = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    db.collection.mockImplementation((path: string) => {
      if (path === 'attendance') {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(createMockQuerySnapshot(attendanceDocs)),
          }),
        };
      }
      if (path === 'video_sessions') {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue(createMockQuerySnapshot(videoDocs)),
          }),
        };
      }
      if (path === 'coaches') {
        return {
          get: jest.fn().mockResolvedValue(createMockQuerySnapshot(coachDocs)),
        };
      }
      if (path === 'notifications') {
        return { add: mockAdd };
      }
      return mockCollectionRef;
    });

    db.collectionGroup.mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(createMockQuerySnapshot(notesDocs)),
      }),
    });

    await handler({});

    // Only coach-1 has dailyDigest enabled
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: 'coach-1',
        title: 'Daily Practice Summary',
        type: 'daily_digest',
      }),
    );
  });

  it('should skip coaches without dailyDigest preference', async () => {
    const handler = (dailyDigest as any).__wrapped ?? (dailyDigest as any).run;
    if (!handler) return;

    const coachDocs = [createMockDoc('coach-1', { notificationPrefs: { dailyDigest: false } })];

    db.collection.mockImplementation((path: string) => {
      if (path === 'attendance') {
        return {
          where: jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])) }),
        };
      }
      if (path === 'video_sessions') {
        return {
          where: jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])) }),
        };
      }
      if (path === 'coaches') {
        return { get: jest.fn().mockResolvedValue(createMockQuerySnapshot(coachDocs)) };
      }
      if (path === 'notifications') {
        return { add: mockAdd };
      }
      return mockCollectionRef;
    });

    db.collectionGroup.mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
      }),
    });

    await handler({});

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should include video review count in notification body', async () => {
    const handler = (dailyDigest as any).__wrapped ?? (dailyDigest as any).run;
    if (!handler) return;

    const coachDocs = [createMockDoc('coach-1', { notificationPrefs: { dailyDigest: true } })];

    db.collection.mockImplementation((path: string) => {
      if (path === 'attendance') {
        return {
          where: jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])) }),
        };
      }
      if (path === 'video_sessions') {
        return {
          where: jest
            .fn()
            .mockReturnValue({
              get: jest
                .fn()
                .mockResolvedValue(
                  createMockQuerySnapshot([createMockDoc('v1', {}), createMockDoc('v2', {})]),
                ),
            }),
        };
      }
      if (path === 'coaches') {
        return { get: jest.fn().mockResolvedValue(createMockQuerySnapshot(coachDocs)) };
      }
      if (path === 'notifications') {
        return { add: mockAdd };
      }
      return mockCollectionRef;
    });

    db.collectionGroup.mockReturnValue({
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
      }),
    });

    await handler({});

    // Pluralization: "analyses" for count > 1
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('2 video analyses ready for review'),
      }),
    );
  });
});
