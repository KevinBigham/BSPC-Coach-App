// Data layer migrated Firestore -> Supabase (UNIFY/01:video_sessions, Phase F).
// Same behavioral contract; the mock is re-pointed at the Supabase client.
// The BUG #4 media-consent rejection pins are UNCHANGED in substance — only
// the "no write happened" assertion target moved (addDoc -> insert). New
// pins: the kind-discriminated P1-4 junction and the D-F2 pipeline kick.
jest.mock('../../config/supabase', () => {
  const state: {
    selectRows: unknown[];
    count: number;
    onHandler: ((p: unknown) => void) | null;
  } = {
    selectRows: [],
    count: 0,
    onHandler: null,
  };
  const query: Record<string, jest.Mock> & { then: unknown } = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: { id: 'new-session-id' }, error: null })),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: state.selectRows, count: state.count, error: null }).then(
        resolve,
        reject,
      ),
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
  uploadFileToBucket: jest.fn().mockResolvedValue('mocked-path'),
  getSignedFileUrl: jest.fn().mockResolvedValue('https://signed.url/video.mp4'),
}));

jest.mock('../mediaPipeline', () => ({
  requestSessionProcessing: jest.fn().mockResolvedValue(undefined),
}));

import {
  subscribeVideoSessions,
  subscribeVideoDrafts,
  subscribePendingVideoReviewCount,
  createVideoSession,
  updateVideoSession,
  uploadVideo,
  getVideoStatusLabel,
  getVideoStatusColor,
} from '../video';
import { uploadFileToBucket } from '../mediaUpload';
import { requestSessionProcessing } from '../mediaPipeline';
import type { Swimmer } from '../../types/firestore.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __query, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __state.selectRows = [];
  __state.count = 0;
  __state.onHandler = null;
});

const consentedSwimmers: Array<Swimmer & { id: string }> = [
  {
    id: 's1',
    firstName: 'Alice',
    lastName: 'A',
    displayName: 'Alice A',
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    gender: 'F',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-04-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
  {
    id: 's2',
    firstName: 'Bob',
    lastName: 'B',
    displayName: 'Bob B',
    dateOfBirth: new Date('2012-01-01T00:00:00Z'),
    gender: 'M',
    group: 'Gold',
    active: true,
    strengths: [],
    weaknesses: [],
    techniqueFocusAreas: [],
    goals: [],
    parentContacts: [],
    meetSchedule: [],
    mediaConsent: { granted: true, date: new Date('2026-04-01T00:00:00Z') },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdBy: 'coach-1',
  },
];

const assertCreateVideoSessionRequiresRosterContext = () => {
  // @ts-expect-error createVideoSession requires a swimmers roster context argument.
  void createVideoSession('c1', 'Coach K', 120, '2026-04-01', ['s1'], 'Gold');
};
void assertCreateVideoSessionRequiresRosterContext;

const makeSessionRow = (over: Record<string, unknown> = {}) => ({
  id: 'v-1',
  coach_id: 'coach-profile-1',
  storage_path: 'video/c1/2026-06-09/video_1.mp4',
  thumbnail_path: null,
  duration_sec: 240,
  practice_date: '2026-06-09',
  practice_group: 'Gold',
  status: 'review',
  frame_count: null,
  error_message: null,
  created_at: '2026-06-09T18:00:00.000Z',
  updated_at: '2026-06-09T18:05:00.000Z',
  coach: { full_name: 'Coach K' },
  swimmers: [
    { swimmer_id: 'sw-1', kind: 'tagged' },
    { swimmer_id: 'sw-1', kind: 'selected' },
    { swimmer_id: 'sw-2', kind: 'selected' },
  ],
  ...over,
});

describe('subscribeVideoSessions', () => {
  it('queries video_sessions scoped to the coach, newest first, and opens a realtime channel', () => {
    subscribeVideoSessions('coach-1', jest.fn(), 10);
    expect(supabase.from).toHaveBeenCalledWith('video_sessions');
    expect(__query.eq).toHaveBeenCalledWith('coach_id', 'coach-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__query.limit).toHaveBeenCalledWith(10);
    expect(supabase.channel).toHaveBeenCalled();
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps rows: junction kinds split back into tagged/selected arrays, embed serves coachName', async () => {
    __state.selectRows = [makeSessionRow()];
    const cb = jest.fn();
    subscribeVideoSessions('coach-profile-1', cb);
    await flush();
    const session = cb.mock.calls[0][0][0];
    expect(session).toMatchObject({
      id: 'v-1',
      coachId: 'coach-profile-1',
      coachName: 'Coach K',
      taggedSwimmerIds: ['sw-1'],
      selectedSwimmerIds: ['sw-1', 'sw-2'],
      status: 'review',
      practiceDate: '2026-06-09',
    });
  });
});

describe('subscribeVideoDrafts', () => {
  it('queries video_session_drafts for the session (the subcollection is gone)', () => {
    subscribeVideoDrafts('session-1', jest.fn());
    expect(supabase.from).toHaveBeenCalledWith('video_session_drafts');
    expect(__query.eq).toHaveBeenCalledWith('session_id', 'session-1');
    expect(__query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(__channel.subscribe).toHaveBeenCalled();
  });

  it('maps draft rows — swimmerName derived from the swimmers embed, nullables defaulted', async () => {
    __state.selectRows = [
      {
        id: 'd-1',
        session_id: 'session-1',
        swimmer_id: 'sw-1',
        observation: 'Head lifts on breath',
        diagnosis: null,
        drill_recommendation: 'Side-kick with snorkel',
        phase: 'stroke',
        tags: ['technique'],
        confidence: 0.85,
        approved: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-06-09T18:00:00.000Z',
        swimmer: { display_name: 'Alice A' },
      },
    ];
    const cb = jest.fn();
    subscribeVideoDrafts('session-1', cb);
    await flush();
    const draft = cb.mock.calls[0][0][0];
    expect(draft).toMatchObject({
      id: 'd-1',
      swimmerId: 'sw-1',
      swimmerName: 'Alice A',
      observation: 'Head lifts on breath',
      diagnosis: '',
      drillRecommendation: 'Side-kick with snorkel',
      phase: 'stroke',
      tags: ['technique'],
      confidence: 0.85,
      approved: undefined,
    });
  });
});

describe('createVideoSession', () => {
  it('inserts the session row + BOTH junction kinds and returns the id', async () => {
    const id = await createVideoSession(
      'c1',
      'Coach K',
      120,
      '2026-04-01',
      ['s1', 's2'],
      'Gold',
      consentedSwimmers,
    );
    expect(id).toBe('new-session-id');
    expect(supabase.from).toHaveBeenCalledWith('video_sessions');
    expect(supabase.from).toHaveBeenCalledWith('video_session_swimmers');
    expect(__query.insert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        coach_id: 'c1',
        duration_sec: 120,
        practice_date: '2026-04-01',
        practice_group: 'Gold',
        status: 'uploading',
        storage_path: '',
      }),
    );
    expect(__query.insert).toHaveBeenNthCalledWith(2, [
      { session_id: 'new-session-id', swimmer_id: 's1', kind: 'tagged' },
      { session_id: 'new-session-id', swimmer_id: 's2', kind: 'tagged' },
      { session_id: 'new-session-id', swimmer_id: 's1', kind: 'selected' },
      { session_id: 'new-session-id', swimmer_id: 's2', kind: 'selected' },
    ]);
  });

  it('defaults practice_group to null when not provided', async () => {
    await createVideoSession('c1', 'Coach K', 60, '2026-04-02', ['s1'], undefined, [
      consentedSwimmers[0],
    ]);
    expect(__query.insert.mock.calls[0][0].practice_group).toBeNull();
  });

  it('rejects empty selected swimmer ids', async () => {
    await expect(
      createVideoSession('c1', 'Coach K', 60, '2026-04-02', [], undefined, []),
    ).rejects.toThrow(/selected swimmer/i);
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('rejects creation without selected swimmer ids', async () => {
    await expect(
      (createVideoSession as any)('c1', 'Coach K', 60, '2026-04-02', undefined, undefined, []),
    ).rejects.toThrow(/selected swimmer/i);
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('rejects when a tagged swimmer is missing from the roster context', async () => {
    await expect(
      createVideoSession('c1', 'Coach K', 120, '2026-04-01', ['s1', 's-missing'], 'Gold', [
        consentedSwimmers[0],
      ]),
    ).rejects.toThrow(/roster context/i);
    expect(__query.insert).not.toHaveBeenCalled();
  });

  it('rejects when a selected swimmer does not have media consent', async () => {
    await expect(
      createVideoSession('c1', 'Coach K', 120, '2026-04-01', ['s3'], 'Gold', [
        {
          ...consentedSwimmers[0],
          id: 's3',
          displayName: 'Consent Blocked',
          mediaConsent: { granted: false, date: new Date('2026-04-01T00:00:00Z') },
        },
      ]),
    ).rejects.toThrow(/media consent/i);
    expect(__query.insert).not.toHaveBeenCalled();
  });
});

describe('updateVideoSession', () => {
  it('maps camelCase fields to columns and updates by id', async () => {
    await updateVideoSession('s1', { status: 'posted' });
    expect(__query.update).toHaveBeenCalledWith({ status: 'posted' });
    expect(__query.eq).toHaveBeenCalledWith('id', 's1');
  });

  it("kicks the pipeline when the patch flips status to 'uploaded' (D-F2)", async () => {
    await updateVideoSession('s1', { storagePath: 'video/x.mp4', status: 'uploaded' });
    expect(requestSessionProcessing).toHaveBeenCalledWith('video', 's1');
  });

  it('does NOT kick the pipeline on other status writes', async () => {
    await updateVideoSession('s1', { status: 'analyzing' });
    expect(requestSessionProcessing).not.toHaveBeenCalled();
  });
});

describe('uploadVideo', () => {
  it('uploads into media-video under the frozen path layout and resolves with path and url', async () => {
    const result = await uploadVideo('file://video.mp4', 'c1', '2026-04-01');
    expect(uploadFileToBucket).toHaveBeenCalledWith(
      'media-video',
      expect.stringContaining('video/c1/2026-04-01/'),
      'file://video.mp4',
      'video/mp4',
      undefined,
    );
    expect(result.downloadUrl).toBe('https://signed.url/video.mp4');
    expect(result.storagePath).toContain('video/c1/2026-04-01/');
  });
});

describe('getVideoStatusLabel', () => {
  it('returns correct labels for each status', () => {
    expect(getVideoStatusLabel('uploading')).toBe('UPLOADING');
    expect(getVideoStatusLabel('uploaded')).toBe('UPLOADED');
    expect(getVideoStatusLabel('extracting_frames')).toBe('PROCESSING');
    expect(getVideoStatusLabel('analyzing')).toBe('ANALYZING');
    expect(getVideoStatusLabel('review')).toBe('READY FOR REVIEW');
    expect(getVideoStatusLabel('posted')).toBe('POSTED');
    expect(getVideoStatusLabel('failed')).toBe('FAILED');
  });
});

describe('getVideoStatusColor', () => {
  it('returns distinct colors for each status', () => {
    expect(getVideoStatusColor('uploading')).toBe('#7a7a8e');
    expect(getVideoStatusColor('failed')).toBe('#f43f5e');
    expect(getVideoStatusColor('posted')).toBe('#CCB000');
  });
});

describe('validateMediaConsent', () => {
  const { validateMediaConsent } = require('../video');

  const swimmers = [
    {
      id: 's1',
      displayName: 'Alice A',
      active: true,
      mediaConsent: { granted: true, date: new Date() },
    },
    { id: 's2', displayName: 'Bob B', mediaConsent: { granted: false, date: new Date() } },
    { id: 's3', displayName: 'Charlie C' },
    {
      id: 's4',
      displayName: 'Dana D',
      active: true,
      mediaConsent: { granted: true, date: new Date() },
    },
    {
      id: 's5',
      displayName: 'Eli E',
      active: true,
      doNotPhotograph: true,
      mediaConsent: { granted: true, date: new Date() },
    },
  ] as any[];

  it('returns empty array when all tagged swimmers have consent', () => {
    expect(validateMediaConsent(['s1', 's4'], swimmers)).toEqual([]);
  });

  it('returns names of swimmers without consent', () => {
    expect(validateMediaConsent(['s1', 's2', 's3', 's5'], swimmers)).toEqual([
      'Bob B',
      'Charlie C',
      'Eli E',
    ]);
  });

  it('returns empty array for empty tag list', () => {
    expect(validateMediaConsent([], swimmers)).toEqual([]);
  });

  it('ignores IDs not found in swimmers list', () => {
    expect(validateMediaConsent(['s999'], swimmers)).toEqual([]);
  });
});

// Phase J (the ratified D-J1 pendingDrafts rider): the dashboard's pending-
// review count rides this service now — same status='review' count the
// screen used to take from Firestore directly.
describe('subscribePendingVideoReviewCount', () => {
  it('counts review sessions team-wide and opens a realtime channel (the D-J1 rider)', () => {
    const unsub = subscribePendingVideoReviewCount(jest.fn());

    expect(supabase.from).toHaveBeenCalledWith('video_sessions');
    expect(__query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(__query.eq).toHaveBeenCalledWith('status', 'review');
    expect(supabase.channel).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });

  it('emits the count immediately and again on each table change', async () => {
    const cb = jest.fn();
    __state.count = 2;
    subscribePendingVideoReviewCount(cb);
    await flush();
    expect(cb).toHaveBeenCalledWith(2);

    __state.count = 5;
    __state.onHandler?.({});
    await flush();
    expect(cb).toHaveBeenCalledWith(5);
  });
});
