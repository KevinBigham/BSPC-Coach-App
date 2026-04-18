jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  query: jest.fn((ref: unknown) => ref),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-plan-id' }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  setDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  Timestamp: { fromDate: jest.fn((d: unknown) => d) },
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _progress: unknown, _error: unknown, complete: () => void) =>
      complete(),
    ),
    snapshot: { ref: { path: 'mock/path' } },
  })),
  getDownloadURL: jest.fn().mockResolvedValue('https://mock.url/practice.pdf'),
}));

import {
  subscribePracticePlans,
  addPracticePlan,
  updatePracticePlan,
  deletePracticePlan,
  duplicateAsTemplate,
  calculateSetYardage,
  calculateTotalYardage,
  subscribeTodayPracticePlan,
  subscribePracticePlanPdf,
  createDashboardPracticePlanPdf,
  uploadDashboardPracticePlanPdf,
} from '../practicePlans';

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribePracticePlans', () => {
  it('subscribes to practice_plans collection', () => {
    const mockUnsub = jest.fn();
    firestore.onSnapshot.mockReturnValue(mockUnsub);

    const unsub = subscribePracticePlans(jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'practice_plans');
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(unsub).toBe(mockUnsub);
  });

  it('filters by isTemplate when option provided', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribePracticePlans(jest.fn(), { isTemplate: true });

    expect(firestore.where).toHaveBeenCalledWith('isTemplate', '==', true);
  });

  it('applies limit when option provided', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribePracticePlans(jest.fn(), { max: 10 });

    expect(firestore.limit).toHaveBeenCalledWith(10);
  });

  it('filters by group in-memory from snapshot results', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'p-1', data: () => ({ title: 'Plan A', group: 'varsity' }) },
          { id: 'p-2', data: () => ({ title: 'Plan B', group: 'jv' }) },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribePracticePlans(callback, { group: 'varsity' });

    expect(callback).toHaveBeenCalledWith([{ id: 'p-1', title: 'Plan A', group: 'varsity' }]);
  });

  it('returns all plans when no group filter', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'p-1', data: () => ({ title: 'Plan A', group: 'varsity' }) },
          { id: 'p-2', data: () => ({ title: 'Plan B', group: 'jv' }) },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribePracticePlans(callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'p-1', title: 'Plan A', group: 'varsity' },
      { id: 'p-2', title: 'Plan B', group: 'jv' },
    ]);
  });

  it('filters dashboard pdf documents out of the default subscription', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          { id: 'p-1', data: () => ({ title: 'Plan A', sets: [], isTemplate: false }) },
          {
            id: 'pdf-1',
            data: () => ({
              documentType: 'dashboard_pdf',
              filename: 'practice.pdf',
              date: '2026-04-18',
            }),
          },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribePracticePlans(callback);

    expect(callback).toHaveBeenCalledWith([
      { id: 'p-1', title: 'Plan A', sets: [], isTemplate: false },
    ]);
  });
});

describe('addPracticePlan', () => {
  it('creates plan with coachId and timestamps', async () => {
    const plan = { title: 'Monday AM', sets: [], group: 'varsity' } as any;
    const id = await addPracticePlan(plan, 'coach-1');

    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: 'Monday AM',
        coachId: 'coach-1',
      }),
    );
    expect(id).toBe('new-plan-id');
  });

  it('includes createdAt and updatedAt', async () => {
    await addPracticePlan({ title: 'X' } as any, 'c');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('createdAt');
    expect(calledData).toHaveProperty('updatedAt');
  });
});

describe('updatePracticePlan', () => {
  it('calls updateDoc with correct path and updatedAt', async () => {
    await updatePracticePlan('pp-1', { title: 'Updated' } as any);

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'practice_plans', 'pp-1');
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: 'Updated' }),
    );

    const calledData = firestore.updateDoc.mock.calls[0][1];
    expect(calledData).toHaveProperty('updatedAt');
  });
});

describe('deletePracticePlan', () => {
  it('calls deleteDoc with correct path', async () => {
    await deletePracticePlan('pp-1');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'practice_plans', 'pp-1');
    expect(firestore.deleteDoc).toHaveBeenCalled();
  });
});

describe('duplicateAsTemplate', () => {
  it('creates a copy with (Template) suffix and isTemplate=true', async () => {
    const plan = {
      id: 'pp-1',
      title: 'Monday AM',
      sets: [],
      group: 'varsity',
      isTemplate: false,
      coachId: 'old-coach',
      coachName: 'Old Coach',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    const id = await duplicateAsTemplate(plan, 'coach-2', 'New Coach');

    const calledData = firestore.addDoc.mock.calls[0][1];
    expect(calledData.title).toBe('Monday AM (Template)');
    expect(calledData.isTemplate).toBe(true);
    expect(calledData.coachId).toBe('coach-2');
    expect(calledData.coachName).toBe('New Coach');
    expect(id).toBe('new-plan-id');
  });
});

describe('calculateSetYardage', () => {
  it('sums reps * distance for all items', () => {
    const items = [
      { reps: 4, distance: 100, description: '100 Free' },
      { reps: 8, distance: 50, description: '50 Kick' },
    ] as any;

    expect(calculateSetYardage(items)).toBe(800); // 400 + 400
  });

  it('returns 0 for empty items', () => {
    expect(calculateSetYardage([])).toBe(0);
  });

  it('handles single item', () => {
    const items = [{ reps: 10, distance: 200, description: 'warmup' }] as any;
    expect(calculateSetYardage(items)).toBe(2000);
  });
});

describe('calculateTotalYardage', () => {
  it('sums yardage across all sets', () => {
    const sets = [
      { items: [{ reps: 4, distance: 100, description: 'A' }] },
      { items: [{ reps: 2, distance: 200, description: 'B' }] },
    ] as any;

    expect(calculateTotalYardage(sets)).toBe(800); // 400 + 400
  });

  it('returns 0 for empty sets', () => {
    expect(calculateTotalYardage([])).toBe(0);
  });
});

describe('dashboard practice pdf helpers', () => {
  it('creates a dashboard practice pdf document in practice_plans', async () => {
    const id = await createDashboardPracticePlanPdf({
      coachId: 'coach-1',
      date: '2026-04-18',
      storagePath: 'practice_plans/coach-1/2026-04-18/practice.pdf',
      filename: 'practice.pdf',
      uploadedAt: '2026-04-18T12:00:00.000Z' as any,
      sizeBytes: 1024,
      pageCount: 3,
    });

    expect(id).toBe('new-plan-id');
    expect(firestore.addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        documentType: 'dashboard_pdf',
        coachId: 'coach-1',
        date: '2026-04-18',
        filename: 'practice.pdf',
        sizeBytes: 1024,
        pageCount: 3,
      }),
    );
  });

  it("subscribes to today's dashboard practice plan for a coach", () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribeTodayPracticePlan('coach-1', jest.fn());

    expect(firestore.where).toHaveBeenCalledWith('documentType', '==', 'dashboard_pdf');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.where).toHaveBeenCalledWith('date', '==', '2026-04-18');
  });

  it('returns the most recent dashboard practice plan or null from today subscription', () => {
    firestore.onSnapshot.mockImplementation((_q: unknown, cb: (snap: unknown) => void) => {
      cb({
        docs: [
          {
            id: 'pdf-2',
            data: () => ({
              documentType: 'dashboard_pdf',
              filename: 'practice.pdf',
              date: '2026-04-18',
            }),
          },
        ],
      });
      return jest.fn();
    });

    const callback = jest.fn();
    subscribeTodayPracticePlan('coach-1', callback);

    expect(callback).toHaveBeenCalledWith({
      id: 'pdf-2',
      documentType: 'dashboard_pdf',
      filename: 'practice.pdf',
      date: '2026-04-18',
    });
  });

  it('subscribes to a single dashboard practice pdf document by id', () => {
    firestore.onSnapshot.mockReturnValue(jest.fn());

    subscribePracticePlanPdf('pdf-1', jest.fn());

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'practice_plans', 'pdf-1');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('uploads dashboard pdfs to the coach/date storage path', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ blob: jest.fn().mockResolvedValue(new Blob()) }) as jest.Mock;

    const result = await uploadDashboardPracticePlanPdf(
      'file://practice.pdf',
      'coach-1',
      '2026-04-18',
      'practice.pdf',
    );

    expect(result.storagePath).toBe('practice_plans/coach-1/2026-04-18/practice.pdf');
  });
});
