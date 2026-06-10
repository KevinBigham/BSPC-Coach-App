// Data layer migrated Firestore -> Supabase (UNIFY/01:import_jobs, Phase H —
// pulled into H by D-H8). Same behavioral contract; the mock is re-pointed
// at the Supabase client. New pins: the vestigial storage_path constants
// survive verbatim (RH-13), coach_id rides the frozen payload (G idiom),
// updated_at is trigger-owned (create leaves it NULL — canonical column).
jest.mock('../../config/supabase', () => {
  const state: { selectRows: unknown[]; onHandler: ((p: unknown) => void) | null } = {
    selectRows: [],
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'job-1' }, error: null })),
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

import { createImportJob, subscribeImportJobs, updateImportJob } from '../importJobs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('importJobs service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __state.selectRows = [];
    __state.onHandler = null;
  });

  it('subscribes to import jobs by coach, newest first (RH-2: the eq survives)', () => {
    const unsub = subscribeImportJobs('coach-1', jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('import_jobs');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('maps rows to ImportJobs, vestigial storage_path verbatim, NULL updated_at tolerated', async () => {
    __state.selectRows = [
      {
        id: 'job-1',
        type: 'csv_roster',
        file_name: 'pasted roster',
        storage_path: 'manual/pasted-roster.csv',
        status: 'complete',
        error_message: null,
        summary: {
          recordsProcessed: 10,
          swimmersCreated: 2,
          swimmersUpdated: 8,
          timesImported: 0,
          errors: [],
        },
        coach_id: 'coach-1',
        created_at: '2026-06-10T12:00:00.000Z',
        updated_at: null,
      },
    ];
    const callback = jest.fn();
    subscribeImportJobs('coach-1', callback);
    await flush();

    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'job-1',
        type: 'csv_roster',
        fileName: 'pasted roster',
        storagePath: 'manual/pasted-roster.csv',
        status: 'complete',
        coachId: 'coach-1',
        updatedAt: undefined,
      }),
    ]);
  });

  it('creates an import job with coach_id from the frozen payload — timestamps DB-owned', async () => {
    const jobId = await createImportJob({
      type: 'csv_roster',
      fileName: 'pasted-roster.csv',
      storagePath: 'manual/pasted-roster.csv',
      status: 'processing',
      summary: {
        recordsProcessed: 10,
        swimmersCreated: 0,
        swimmersUpdated: 0,
        timesImported: 0,
        errors: [],
      },
      coachId: 'coach-1',
    });

    expect(jobId).toBe('job-1');
    expect(__query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'csv_roster',
        file_name: 'pasted-roster.csv',
        storage_path: 'manual/pasted-roster.csv', // vestigial constant, verbatim (RH-13)
        status: 'processing',
        coach_id: 'coach-1',
      }),
    );
    const payload = __query.insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('created_at');
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });

  it('updates an import job — updated_at is trigger-owned now (inverted pin)', async () => {
    await updateImportJob('job-1', { status: 'complete' });

    expect(__query.update).toHaveBeenCalledWith({ status: 'complete' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'job-1');
    const payload = __query.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty('updatedAt');
    expect(payload).not.toHaveProperty('updated_at');
  });
});
