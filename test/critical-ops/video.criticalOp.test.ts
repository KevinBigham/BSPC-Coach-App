// Phase F: re-pointed at canonical video_sessions (Supabase). The BUG #4
// media-consent enforcement pins are UNCHANGED in substance — every rejection
// still proves NO write happened; only the assertion target moved
// (addDoc -> insert). New pin: the kind-discriminated P1-4 junction write.
jest.mock('../../src/config/supabase', () => {
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'sess-VID-fixture' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  const supabase = { from: jest.fn(() => query) };
  return { supabase, __query: query };
});

jest.mock('../../src/services/mediaPipeline', () => ({
  requestSessionProcessing: jest.fn().mockResolvedValue(undefined),
}));

import {
  createVideoSession,
  updateVideoSession,
  validateMediaConsent,
} from '../../src/services/video';
import { requestSessionProcessing } from '../../src/services/mediaPipeline';
import { buildSwimmer, buildMediaConsent } from '../fixtures/coach';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../src/config/supabase');
const { __query } = mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('video.createVideoSession (critical op)', () => {
  it('happy path: writes the session and the kind-discriminated junction for the tagged swimmers', async () => {
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
    expect(__query.insert.mock.calls[0][0]).toMatchObject({
      coach_id: 'coach-001',
      practice_group: 'Gold',
      status: 'uploading',
    });
    const junctionRows = __query.insert.mock.calls[1][0];
    expect(
      junctionRows
        .filter((r: { kind: string }) => r.kind === 'tagged')
        .map((r: { swimmer_id: string }) => r.swimmer_id),
    ).toEqual(taggedIds);
    expect(
      junctionRows
        .filter((r: { kind: string }) => r.kind === 'selected')
        .map((r: { swimmer_id: string }) => r.swimmer_id),
    ).toEqual(taggedIds);
  });

  it('edge: empty selected list is rejected before any write', async () => {
    await expect(
      createVideoSession('coach-001', 'Coach One', 30, '2026-04-28', [], undefined, []),
    ).rejects.toThrow(/selected swimmer/i);
    expect(__query.insert).not.toHaveBeenCalled();
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
    expect(__query.insert).not.toHaveBeenCalled();
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
    expect(__query.insert).not.toHaveBeenCalled();
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
    expect(__query.insert).not.toHaveBeenCalled();
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
  it('happy path: status transitions write through; timestamps are DB-owned; uploaded kicks the pipeline once', async () => {
    await updateVideoSession('sess-VID-001', { status: 'posted' });
    expect(__query.update).toHaveBeenCalledWith({ status: 'posted' });
    expect(__query.eq).toHaveBeenCalledWith('id', 'sess-VID-001');
    expect(requestSessionProcessing).not.toHaveBeenCalled();

    await updateVideoSession('sess-VID-001', { status: 'uploaded' });
    expect(requestSessionProcessing).toHaveBeenCalledTimes(1);
    expect(requestSessionProcessing).toHaveBeenCalledWith('video', 'sess-VID-001');
  });
});
