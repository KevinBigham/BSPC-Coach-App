import { createMockDoc, createMockQuerySnapshot } from '../__mocks__/firebaseAdmin';

const mockParentDocRef = {
  get: jest.fn(),
};

const mockSwimmerDocRefs = new Map<string, { get: jest.Mock; collection: jest.Mock }>();
const mockTimesCollection = {
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

const mockAttendanceQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

function getSwimmerDocRef(id: string) {
  if (!mockSwimmerDocRefs.has(id)) {
    mockSwimmerDocRefs.set(id, {
      get: jest.fn(),
      collection: jest.fn(() => mockTimesCollection),
    });
  }
  return mockSwimmerDocRefs.get(id)!;
}

const mockDb = {
  collection: jest.fn().mockImplementation((path: string) => {
    if (path === 'parents') {
      return { doc: jest.fn(() => mockParentDocRef) };
    }
    if (path === 'swimmers') {
      return { doc: jest.fn((id: string) => getSwimmerDocRef(id)) };
    }
    if (path === 'attendance') {
      return mockAttendanceQuery;
    }
    return { doc: jest.fn() };
  }),
};

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => mockDb),
}));

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
}));

import { getParentPortalDashboard, getParentSwimmerPortalData } from '../callable/parentPortal';

function handlerOf(callable: unknown) {
  return (
    (callable as { __wrapped?: unknown; run?: unknown }).__wrapped ??
    (callable as { run?: unknown }).run
  );
}

function makeRequest(
  data: unknown = {},
  auth: { uid: string; token?: { email?: string } } | null = { uid: 'parent-1' },
) {
  return { data, auth };
}

describe('parent portal callables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSwimmerDocRefs.clear();
    mockParentDocRef.get.mockResolvedValue(
      createMockDoc('parent-1', {
        uid: 'parent-1',
        email: 'parent@example.com',
        displayName: 'Parent',
        linkedSwimmerIds: ['swimmer-1'],
      }),
    );
    getSwimmerDocRef('swimmer-1').get.mockResolvedValue(
      createMockDoc('swimmer-1', {
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        group: 'Gold',
        gender: 'F',
        active: true,
        parentContacts: [{ email: 'private@example.com' }],
        medical: { allergies: ['private'] },
      }),
    );
    mockTimesCollection.get.mockResolvedValue(
      createMockQuerySnapshot([
        createMockDoc('time-1', {
          event: '50 Free',
          course: 'SCY',
          time: 2500,
          timeDisplay: '25.00',
          isPR: true,
          meetName: 'Dual Meet',
        }),
      ]),
    );
    mockAttendanceQuery.get.mockResolvedValue(
      createMockQuerySnapshot([
        createMockDoc('att-1', {
          swimmerId: 'swimmer-1',
          swimmerName: 'Jane Smith',
          group: 'Gold',
          practiceDate: '2026-04-15',
          status: 'normal',
          note: 'private coach note',
        }),
      ]),
    );
  });

  it('rejects unauthenticated parent portal dashboard requests', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({}, null))).rejects.toThrow(/Must be authenticated/i);
  });

  it('returns only sanitized linked swimmer summaries on the dashboard', async () => {
    const handler = handlerOf(getParentPortalDashboard) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest());

    expect(result).toEqual({
      profile: {
        uid: 'parent-1',
        email: 'parent@example.com',
        displayName: 'Parent',
        linkedSwimmerIds: ['swimmer-1'],
      },
      swimmers: [
        {
          id: 'swimmer-1',
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'Jane Smith',
          group: 'Gold',
          gender: 'F',
          active: true,
          profilePhotoUrl: null,
        },
      ],
    });
  });

  it('rejects detail reads for swimmers not linked to the parent', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    await expect(handler(makeRequest({ swimmerId: 'swimmer-2' }))).rejects.toThrow(
      /permission-denied|not linked/i,
    );
  });

  it('returns sanitized detail data without coach/private fields', async () => {
    const handler = handlerOf(getParentSwimmerPortalData) as (request: unknown) => Promise<unknown>;
    const result = await handler(makeRequest({ swimmerId: 'swimmer-1' }));

    expect(result).toEqual({
      swimmer: {
        id: 'swimmer-1',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane Smith',
        group: 'Gold',
        gender: 'F',
        active: true,
        profilePhotoUrl: null,
        strengths: [],
        goals: [],
      },
      times: [
        {
          id: 'time-1',
          event: '50 Free',
          course: 'SCY',
          time: 2500,
          timeDisplay: '25.00',
          isPR: true,
          meetName: 'Dual Meet',
          meetDate: null,
        },
      ],
      attendance: [
        {
          id: 'att-1',
          practiceDate: '2026-04-15',
          status: 'normal',
        },
      ],
      schedule: [],
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
