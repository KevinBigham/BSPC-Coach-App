// Data layer migrated Firestore -> Supabase (UNIFY/01:practice_plans, Phase H).
// Same behavioral contract; the mock is re-pointed at the Supabase client.
// New pins: the server-side PDF exclusion (document_type IS NULL, RH-16),
// title := filename on PDF rows (RH-16), the D-H2a bucket upload via the F
// helper, RH-2 filter discipline, the coachName denorm drop, and
// trigger-owned updated_at.
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    delete: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-plan-id' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, error: null }).then(resolve, reject),
  };
  const channel = {
    on: jest.fn((_evt: unknown, _filter: unknown, handler: (p: unknown) => void) => {
      state.onHandler = handler;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn(() => query),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return { supabase, __state: state, __query: query, __channel: channel };
});

jest.mock('../mediaUpload', () => ({
  uploadFileToBucket: jest.fn().mockResolvedValue('coach-1/2026-04-18/practice.pdf'),
  getSignedFileUrl: jest.fn().mockResolvedValue('https://signed.url/practice.pdf'),
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
  createDashboardPracticePlanPdf,
  uploadDashboardPracticePlanPdf,
} from '../practicePlans';
import { uploadFileToBucket, getSignedFileUrl } from '../mediaUpload';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;
const mockedUpload = jest.mocked(uploadFileToBucket);
const mockedSignedUrl = jest.mocked(getSignedFileUrl);

const flush = () => new Promise((resolve) => setImmediate(resolve));

const makePlanRow = (over: Record<string, unknown> = {}) => ({
  id: 'p-1',
  title: 'Plan A',
  description: null,
  practice_group: 'Gold',
  is_template: false,
  is_public: false,
  template_source_id: null,
  plan_date: null,
  total_duration_min: 90,
  tags: [],
  ratings: {},
  sets: [],
  document_type: null,
  storage_path: null,
  filename: null,
  uploaded_at: null,
  size_bytes: null,
  page_count: null,
  coach_id: 'coach-profile-1',
  created_at: '2026-04-01T12:00:00.000Z',
  updated_at: '2026-04-01T12:00:00.000Z',
  coach: { full_name: 'Coach K' },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.onHandler = null;
});

describe('subscribePracticePlans', () => {
  it('queries practice_plans newest first with the SERVER-SIDE pdf exclusion (RH-16)', () => {
    const unsub = subscribePracticePlans(jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('practice_plans');
    expect(__query.is).toHaveBeenCalledWith('document_type', null);
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('filters by isTemplate when option provided', () => {
    subscribePracticePlans(jest.fn(), { isTemplate: true });

    expect(__query.eq).toHaveBeenCalledWith('is_template', true);
  });

  it('keeps the owner coachId filter as a REAL query param (RH-2: RLS is the wall, not the scope)', () => {
    subscribePracticePlans(jest.fn(), { coachId: 'coach-1' });

    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
  });

  it('applies limit when option provided', () => {
    subscribePracticePlans(jest.fn(), { max: 10 });

    expect(__query.limit).toHaveBeenCalledWith(10);
  });

  it('filters by group CLIENT-side (frozen semantics)', async () => {
    __state.selectRows = [
      makePlanRow({ id: 'p-1', title: 'Plan A', practice_group: 'varsity' }),
      makePlanRow({ id: 'p-2', title: 'Plan B', practice_group: 'jv' }),
    ];
    const callback = jest.fn();
    subscribePracticePlans(callback, { group: 'varsity' });
    await flush();

    const plans = callback.mock.calls[0][0];
    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual(expect.objectContaining({ id: 'p-1', group: 'varsity' }));
  });

  it('returns all plans when no group filter, deriving coachName from the embed', async () => {
    expect(makePlanRow()).not.toHaveProperty('coachName');
    __state.selectRows = [
      makePlanRow({ id: 'p-1', title: 'Plan A' }),
      makePlanRow({ id: 'p-2', title: 'Plan B' }),
    ];
    const callback = jest.fn();
    subscribePracticePlans(callback);
    await flush();

    const plans = callback.mock.calls[0][0];
    expect(plans).toHaveLength(2);
    expect(plans[0]).toEqual(
      expect.objectContaining({ id: 'p-1', title: 'Plan A', coachName: 'Coach K' }),
    );
  });

  it('re-emits on realtime change and stops after unsubscribe', async () => {
    __state.selectRows = [makePlanRow()];
    const cb = jest.fn();
    const unsub = subscribePracticePlans(cb);
    await flush();
    expect(cb).toHaveBeenCalledTimes(1);
    __state.onHandler?.({ eventType: 'INSERT' });
    await flush();
    expect(cb).toHaveBeenCalledTimes(2);
    cb.mockClear();
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
    __state.onHandler?.({ eventType: 'UPDATE' });
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('addPracticePlan', () => {
  it('inserts the mapped row with coach_id taken VERBATIM from the frozen param (D-B7/G idiom)', async () => {
    const plan = { title: 'Monday AM', sets: [], group: 'varsity', isTemplate: false } as never;
    const id = await addPracticePlan(plan, 'coach-1');

    expect(supabase.from).toHaveBeenCalledWith('practice_plans');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Monday AM',
        practice_group: 'varsity',
        is_template: false,
        coach_id: 'coach-1',
      }),
    );
    expect(id).toBe('new-plan-id');
  });

  it('never persists the coachName denorm or DB-owned timestamps', async () => {
    await addPracticePlan({ title: 'X', sets: [], isTemplate: false } as never, 'c');

    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('coachName');
    expect(payload).not.toHaveProperty('coach_name');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('updatePracticePlan', () => {
  it('updates only the provided fields, mapped to columns — no explicit stamp (trigger-owned)', async () => {
    await updatePracticePlan('pp-1', { title: 'Updated', public: true } as never);

    expect(__query.update).toHaveBeenCalledWith({ title: 'Updated', is_public: true });
    expect(__query.eq).toHaveBeenCalledWith('id', 'pp-1');
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });
});

describe('deletePracticePlan', () => {
  it('deletes the row by id', async () => {
    await deletePracticePlan('pp-1');

    expect(supabase.from).toHaveBeenCalledWith('practice_plans');
    expect(__query.delete).toHaveBeenCalled();
    expect(__query.eq).toHaveBeenCalledWith('id', 'pp-1');
  });
});

describe('duplicateAsTemplate', () => {
  it('creates a copy with (Template) suffix, isTemplate=true, owned by the duplicating coach', async () => {
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
    } as never;

    const id = await duplicateAsTemplate(plan, 'coach-2', 'New Coach');

    const payload = __query.insert.mock.calls[0][0];
    expect(payload.title).toBe('Monday AM (Template)');
    expect(payload.is_template).toBe(true);
    expect(payload.coach_id).toBe('coach-2');
    expect(payload).not.toHaveProperty('coach_name'); // denorm derived on read
    expect(id).toBe('new-plan-id');
  });
});

describe('calculateSetYardage', () => {
  it('sums reps * distance for all items', () => {
    const items = [
      { reps: 4, distance: 100, description: '100 Free' },
      { reps: 8, distance: 50, description: '50 Kick' },
    ] as never;

    expect(calculateSetYardage(items)).toBe(800); // 400 + 400
  });

  it('returns 0 for empty items', () => {
    expect(calculateSetYardage([])).toBe(0);
  });

  it('handles single item', () => {
    const items = [{ reps: 10, distance: 200, description: 'warmup' }] as never;
    expect(calculateSetYardage(items)).toBe(2000);
  });
});

describe('calculateTotalYardage', () => {
  it('sums yardage across all sets', () => {
    const sets = [
      { items: [{ reps: 4, distance: 100, description: 'A' }] },
      { items: [{ reps: 2, distance: 200, description: 'B' }] },
    ] as never;

    expect(calculateTotalYardage(sets)).toBe(800); // 400 + 400
  });

  it('returns 0 for empty sets', () => {
    expect(calculateTotalYardage([])).toBe(0);
  });
});

describe('dashboard practice pdf helpers', () => {
  it('creates a pdf row with title := filename (RH-16: title NOT NULL, PDF rows had none)', async () => {
    const id = await createDashboardPracticePlanPdf({
      coachId: 'coach-1',
      date: '2026-04-18',
      storagePath: 'coach-1/2026-04-18/practice.pdf',
      filename: 'practice.pdf',
      uploadedAt: new Date('2026-04-18T12:00:00.000Z'),
      sizeBytes: 1024,
      pageCount: 3,
    });

    expect(id).toBe('new-plan-id');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'practice.pdf', // the RH-16 synthesis
        document_type: 'dashboard_pdf',
        coach_id: 'coach-1',
        plan_date: '2026-04-18',
        filename: 'practice.pdf',
        size_bytes: 1024,
        page_count: 3,
      }),
    );
  });

  it("subscribes to today's dashboard pdf: document_type + coach + plan_date, newest upload first", () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    try {
      subscribeTodayPracticePlan('coach-1', jest.fn());

      expect(__query.eq).toHaveBeenCalledWith('document_type', 'dashboard_pdf');
      expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
      expect(__query.eq).toHaveBeenCalledWith('plan_date', '2026-04-18');
      expect(__query.order).toHaveBeenCalledWith('uploaded_at', { ascending: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns the most recent pdf (server-ordered winner) or null', async () => {
    __state.selectRows = [
      makePlanRow({
        id: 'pdf-2',
        title: 'practice.pdf',
        document_type: 'dashboard_pdf',
        filename: 'practice.pdf',
        plan_date: '2026-04-18',
        storage_path: 'coach-1/2026-04-18/practice.pdf',
        uploaded_at: '2026-04-18T11:00:00.000Z',
        size_bytes: 1024,
        page_count: 3,
      }),
    ];
    const callback = jest.fn();
    subscribeTodayPracticePlan('coach-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pdf-2',
        documentType: 'dashboard_pdf',
        filename: 'practice.pdf',
        date: '2026-04-18',
        storagePath: 'coach-1/2026-04-18/practice.pdf',
        sizeBytes: 1024,
        pageCount: 3,
      }),
    );
  });

  it('emits null when no pdf exists today', async () => {
    __state.selectRows = [];
    const callback = jest.fn();
    subscribeTodayPracticePlan('coach-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith(null);
  });

  it('uploads pdfs to the practice-plans bucket under the OWNER segment via the F helper (D-H2a)', async () => {
    const onProgress = jest.fn();
    const result = await uploadDashboardPracticePlanPdf(
      'file://practice.pdf',
      'coach-1',
      '2026-04-18',
      'practice.pdf',
      onProgress,
    );

    expect(mockedUpload).toHaveBeenCalledWith(
      'practice-plans',
      'coach-1/2026-04-18/practice.pdf', // owner uid is the FIRST segment (the wall checks it)
      'file://practice.pdf',
      'application/pdf',
      onProgress,
    );
    expect(mockedSignedUrl).toHaveBeenCalledWith(
      'practice-plans',
      'coach-1/2026-04-18/practice.pdf',
      3600,
    );
    expect(result).toEqual({
      storagePath: 'coach-1/2026-04-18/practice.pdf',
      downloadUrl: 'https://signed.url/practice.pdf',
    });
  });
});
