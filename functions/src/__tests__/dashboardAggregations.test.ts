import {
  createMockFirestore,
  createMockFieldValue,
  createMockDoc,
  createMockQuerySnapshot,
} from '../__mocks__/firebaseAdmin';

const { db, mockDocRef } = createMockFirestore();
const fieldValue = createMockFieldValue();

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => db),
    {
      FieldValue: fieldValue,
    },
  ),
}));

import {
  recomputeDashboardAttendanceAggregation,
  recomputeDashboardActivityAggregation,
  recomputeDashboardRecentPRsAggregation,
} from '../triggers/dashboardAggregations';

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toMillis: () => date.getTime(),
    toDate: () => date,
  };
}

describe('dashboard aggregations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-08T12:00:00Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recomputes dashboard attendance history and excludes records older than 84 days', async () => {
    const where = jest.fn().mockReturnValue({
      get: jest
        .fn()
        .mockResolvedValue(
          createMockQuerySnapshot([
            createMockDoc('a1', { practiceDate: '2026-04-08' }),
            createMockDoc('a2', { practiceDate: '2026-04-08' }),
            createMockDoc('a3', { practiceDate: '2026-03-31' }),
            createMockDoc('a4', { practiceDate: '2026-01-13' }),
          ]),
        ),
    });

    db.collection.mockImplementation((path: string) => {
      if (path === 'attendance') {
        return { where };
      }
      throw new Error(`Unexpected collection path: ${path}`);
    });

    await recomputeDashboardAttendanceAggregation();

    expect(where).toHaveBeenCalledWith('practiceDate', '>=', '2026-01-14');
    expect(db.doc).toHaveBeenCalledWith('aggregations/dashboard_attendance');
    expect(mockDocRef.set).toHaveBeenCalledWith(
      {
        countsByDate: {
          '2026-03-31': 1,
          '2026-04-08': 2,
        },
        updatedAt: 'SERVER_TIMESTAMP',
      },
      { merge: true },
    );
  });

  it('recomputes dashboard activity with preserved text formatting, review-only videos, sorting, and top-15 truncation', async () => {
    const longNote = 'A'.repeat(61);

    const attendanceDocs = Array.from({ length: 8 }, (_, index) =>
      createMockDoc(`att-${index}`, {
        swimmerName: `Swimmer ${index}`,
        coachName: 'Coach Attendance',
        createdAt: makeTimestamp(`2026-04-08T08:0${index}:00Z`),
      }),
    );

    const noteDocs = Array.from({ length: 5 }, (_, index) =>
      createMockDoc(`note-${index}`, {
        content: index === 0 ? longNote : `Note ${index}`,
        coachName: 'Coach Notes',
        createdAt: makeTimestamp(
          `2026-04-08T12:${String(index === 0 ? 59 : index).padStart(2, '0')}:00Z`,
        ),
      }),
    );

    const timeDocs = Array.from({ length: 5 }, (_, index) =>
      createMockDoc(`time-${index}`, {
        event: `${50 + index * 50} Free`,
        course: 'SCY',
        timeDisplay: `:${index}${index}.00`,
        isPR: index === 0,
        meetName: index === 0 ? undefined : `Meet ${index}`,
        createdAt: makeTimestamp(`2026-04-08T14:0${index}:00Z`),
      }),
    );

    const videoDocs = [
      createMockDoc('video-0', {
        coachName: 'Coach Video',
        status: 'review',
        taggedSwimmerIds: ['s1', 's2'],
        createdAt: makeTimestamp('2026-04-08T15:00:00Z'),
      }),
      createMockDoc('video-1', {
        coachName: 'Coach Video',
        status: 'uploaded',
        taggedSwimmerIds: ['s1'],
        createdAt: makeTimestamp('2026-04-08T15:01:00Z'),
      }),
    ];

    db.collection.mockImplementation((path: string) => {
      if (path === 'attendance') {
        return {
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(createMockQuerySnapshot(attendanceDocs)),
            }),
          }),
        };
      }

      if (path === 'video_sessions') {
        return {
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(createMockQuerySnapshot(videoDocs)),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected collection path: ${path}`);
    });

    db.collectionGroup.mockImplementation((path: string) => {
      if (path === 'notes') {
        return {
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(createMockQuerySnapshot(noteDocs)),
            }),
          }),
        };
      }

      if (path === 'times') {
        return {
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue(createMockQuerySnapshot(timeDocs)),
            }),
          }),
        };
      }

      throw new Error(`Unexpected collectionGroup path: ${path}`);
    });

    await recomputeDashboardActivityAggregation();

    expect(db.doc).toHaveBeenCalledWith('aggregations/dashboard_activity');
    const payload = mockDocRef.set.mock.calls[0][0] as {
      items: Array<{ id: string; type: string; text: string; coach: string }>;
      updatedAt: string;
    };

    expect(payload.updatedAt).toBe('SERVER_TIMESTAMP');
    expect(payload.items).toHaveLength(15);
    expect(payload.items[0]).toMatchObject({
      id: 'video-video-0',
      type: 'video',
      text: 'VIDEO READY: 2 swimmers analyzed',
      coach: 'Coach Video',
    });
    expect(payload.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'video-video-1' })]),
    );
    expect(payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'note-note-0',
          type: 'note',
          text: `Note added: "${'A'.repeat(60)}..."`,
          coach: 'Coach Notes',
        }),
        expect.objectContaining({
          id: 'time-time-0',
          type: 'pr',
          text: '50 Free SCY: :00.00 — NEW PR!',
          coach: 'Manual entry',
        }),
        expect.objectContaining({
          id: 'time-time-1',
          type: 'time',
          text: '100 Free SCY: :11.00',
          coach: 'Meet 1',
        }),
        expect.objectContaining({
          id: 'att-att-7',
          type: 'attendance',
          text: 'Swimmer 7 checked in',
          coach: 'Coach Attendance',
        }),
      ]),
    );
  });

  it('recomputes the recent-PRs slice from collectionGroup(times) where isPR=true', async () => {
    const prDocs = [
      {
        id: 't-1',
        ref: { parent: { parent: { id: 'sw-001' } } },
        data: () => ({
          swimmerName: 'Athlete One',
          event: '50 Free',
          course: 'SCY',
          timeDisplay: '24.99',
          meetName: 'Spring Invite',
          isPR: true,
          createdAt: makeTimestamp('2026-04-08T10:00:00Z'),
        }),
      },
      {
        id: 't-2',
        ref: { parent: { parent: { id: 'sw-002' } } },
        data: () => ({
          swimmerName: 'Athlete Two',
          event: '100 Back',
          course: 'SCY',
          timeDisplay: '1:05.10',
          isPR: true,
          createdAt: makeTimestamp('2026-04-08T09:00:00Z'),
        }),
      },
    ];

    db.collectionGroup.mockImplementation((path: string) => {
      if (path !== 'times') throw new Error(`Unexpected collectionGroup path: ${path}`);
      return {
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({ docs: prDocs }),
            }),
          }),
        }),
      };
    });

    await recomputeDashboardRecentPRsAggregation();

    expect(db.doc).toHaveBeenCalledWith('aggregations/dashboard_recent_prs');
    const payload = mockDocRef.set.mock.calls[0][0] as {
      items: Array<{
        id: string;
        swimmerId: string;
        swimmerName: string;
        event: string;
        course: string;
        timeDisplay: string;
        meetName: string | null;
      }>;
      updatedAt: string;
    };
    expect(payload.updatedAt).toBe('SERVER_TIMESTAMP');
    expect(payload.items).toEqual([
      expect.objectContaining({
        id: 't-1',
        swimmerId: 'sw-001',
        swimmerName: 'Athlete One',
        event: '50 Free',
        course: 'SCY',
        timeDisplay: '24.99',
        meetName: 'Spring Invite',
      }),
      expect.objectContaining({
        id: 't-2',
        swimmerId: 'sw-002',
        swimmerName: 'Athlete Two',
        event: '100 Back',
        course: 'SCY',
        timeDisplay: '1:05.10',
        meetName: null,
      }),
    ]);
  });
});
