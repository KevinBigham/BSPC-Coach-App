// D-CUT8 (05 §6.2b): the admin screen's staff-administration successor.
// Transport is postgres_changes on profiles + coach_groups; delivery rides
// the existing walls (profiles_select_admin, coach_groups_staff). The
// service does NOT pre-check authority — enforce_profile_self_update is the
// wall (A-STRICT): a guard rejection surfaces through the error path, which
// is pinned below for both writers.
jest.mock('../../config/supabase', () => {
  const state: {
    profileRows: unknown[];
    groupRows: unknown[];
    error: Error | null;
    subscribedTables: string[];
  } = {
    profileRows: [],
    groupRows: [],
    error: null,
    subscribedTables: [],
  };
  const makeQuery = (rowsFor: () => unknown[]) => {
    const query: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => query),
      in: jest.fn(() => query),
      order: jest.fn(() => query),
      eq: jest.fn(() => query),
      update: jest.fn(() => query),
      delete: jest.fn(() => query),
      insert: jest.fn(() => query),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rowsFor(), error: state.error }).then(resolve, reject),
    };
    return query;
  };
  const profilesQuery = makeQuery(() => state.profileRows);
  const groupsQuery = makeQuery(() => state.groupRows);
  const channel = {
    on: jest.fn((_evt: unknown, filter: { table: string }, _handler: (p: unknown) => void) => {
      state.subscribedTables.push(filter.table);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  const supabase = {
    from: jest.fn((table: string) => (table === 'profiles' ? profilesQuery : groupsQuery)),
    channel: jest.fn(() => channel),
    removeChannel: jest.fn(),
  };
  return {
    supabase,
    __state: state,
    __profilesQuery: profilesQuery,
    __groupsQuery: groupsQuery,
    __channel: channel,
  };
});

import { subscribeStaffProfiles, setStaffRole, setStaffGroups } from '../staff';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('../../config/supabase');
const { supabase, __state, __profilesQuery, __groupsQuery, __channel } = mock;

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  __state.profileRows = [];
  __state.groupRows = [];
  __state.error = null;
  __state.subscribedTables = [];
});

describe('subscribeStaffProfiles', () => {
  it('filters to staff roles and maps profiles + coach_groups into the StaffProfile join shape', async () => {
    __state.profileRows = [
      {
        id: 'profile-1',
        user_id: 'auth-user-1',
        email: 'kevin@test.com',
        full_name: 'Kevin Admin',
        role: 'super_admin',
      },
      {
        id: 'profile-2',
        user_id: 'auth-user-2',
        email: 'coach@test.com',
        full_name: 'Casey Coach',
        role: 'coach_admin',
      },
    ];
    __state.groupRows = [
      { profile_id: 'profile-2', practice_group: 'Gold' },
      { profile_id: 'profile-2', practice_group: 'Silver' },
    ];
    const onChange = jest.fn();
    subscribeStaffProfiles(onChange);
    await flush();

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(__profilesQuery.in).toHaveBeenCalledWith('role', ['super_admin', 'coach_admin']);
    expect(supabase.from).toHaveBeenCalledWith('coach_groups');
    expect(onChange).toHaveBeenCalledWith([
      {
        profileId: 'profile-1',
        userId: 'auth-user-1',
        email: 'kevin@test.com',
        displayName: 'Kevin Admin',
        role: 'super_admin',
        groups: [],
      },
      {
        profileId: 'profile-2',
        userId: 'auth-user-2',
        email: 'coach@test.com',
        displayName: 'Casey Coach',
        role: 'coach_admin',
        groups: ['Gold', 'Silver'],
      },
    ]);
  });

  it('subscribes postgres_changes on BOTH tables and returns a synchronous unsubscribe that removes the channel', () => {
    const unsub = subscribeStaffProfiles(jest.fn());
    expect(supabase.channel).toHaveBeenCalled();
    expect(__state.subscribedTables).toEqual(['profiles', 'coach_groups']);
    expect(__channel.subscribe).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
    expect(supabase.removeChannel).toHaveBeenCalledWith(__channel);
  });
});

describe('setStaffRole', () => {
  it('updates exactly the role column on the targeted profile row', async () => {
    await setStaffRole('profile-2', 'super_admin');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(__profilesQuery.update).toHaveBeenCalledWith({ role: 'super_admin' });
    expect(__profilesQuery.eq).toHaveBeenCalledWith('id', 'profile-2');
  });

  it('propagates a guard rejection (enforce_profile_self_update is the wall, A-STRICT — no client pre-check exists to swallow it)', async () => {
    __state.error = new Error('profile role changes are restricted to super_admin');
    await expect(setStaffRole('profile-2', 'super_admin')).rejects.toThrow(
      'profile role changes are restricted to super_admin',
    );
  });
});

describe('setStaffGroups', () => {
  it('reconciles by delete + insert: clears the profile rows then inserts exactly the new set', async () => {
    await setStaffGroups('profile-2', ['Gold', 'Bronze']);
    expect(supabase.from).toHaveBeenCalledWith('coach_groups');
    expect(__groupsQuery.delete).toHaveBeenCalled();
    expect(__groupsQuery.eq).toHaveBeenCalledWith('profile_id', 'profile-2');
    expect(__groupsQuery.insert).toHaveBeenCalledWith([
      { profile_id: 'profile-2', practice_group: 'Gold' },
      { profile_id: 'profile-2', practice_group: 'Bronze' },
    ]);
  });

  it('propagates a database error to the caller', async () => {
    __state.error = new Error('coach_groups boom');
    await expect(setStaffGroups('profile-2', ['Gold'])).rejects.toThrow('coach_groups boom');
  });
});
