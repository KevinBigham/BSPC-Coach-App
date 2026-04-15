jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn().mockResolvedValue({ id: 'job-1' }),
  collection: jest.fn((...args: unknown[]) => ({ path: (args as string[]).slice(1).join('/') })),
  doc: jest.fn((...args: unknown[]) => ({
    path: (args as string[]).slice(1).join('/'),
    id: (args as string[])[args.length - 1],
  })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn((ref: unknown) => ref),
  serverTimestamp: jest.fn(() => new Date()),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  where: jest.fn(),
}));

import { createImportJob, subscribeImportJobs, updateImportJob } from '../importJobs';

const firestore = require('firebase/firestore');

describe('importJobs service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to import jobs by coach', () => {
    subscribeImportJobs('coach-1', jest.fn());

    expect(firestore.collection).toHaveBeenCalledWith({}, 'import_jobs');
    expect(firestore.where).toHaveBeenCalledWith('coachId', '==', 'coach-1');
    expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(firestore.onSnapshot).toHaveBeenCalled();
  });

  it('creates an import job with timestamps', async () => {
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
    expect(firestore.addDoc).toHaveBeenCalled();
  });

  it('updates an import job with updatedAt', async () => {
    await updateImportJob('job-1', { status: 'complete' });

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'import_jobs/job-1' }),
      expect.objectContaining({ status: 'complete', updatedAt: expect.any(Date) }),
    );
  });
});
