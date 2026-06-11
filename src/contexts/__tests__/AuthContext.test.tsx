// Auth provider swapped Firebase -> Supabase (05 §6.2, the CUT-4+ swap).
// The suite TRANSFORMS in place: the one pre-swap test ("cleans up push
// subscriptions before sign out") is PRESERVED with its mocks re-pointed to
// the supabase idiom; the new pins cover the role map, the not-a-coach
// resolution, and cold-start session restore (the 05 §6.4 named risk).
const mockSupabaseSignOut = jest.fn().mockResolvedValue({ error: null });

jest.mock('../../config/supabase', () => {
  const state: {
    session: { user: { id: string; email?: string } } | null;
    profileRow: Record<string, unknown> | null;
    groupRows: unknown[];
    tokenRows: unknown[];
    authCallback: ((event: string, session: unknown) => void) | null;
  } = {
    session: null,
    profileRow: null,
    groupRows: [],
    tokenRows: [],
    authCallback: null,
  };
  const profilesQuery = {
    select: jest.fn(() => profilesQuery),
    eq: jest.fn(() => profilesQuery),
    maybeSingle: jest.fn(() => Promise.resolve({ data: state.profileRow, error: null })),
  };
  const makeListQuery = (rowsFor: () => unknown[]) => {
    const query: Record<string, jest.Mock> & { then: unknown } = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: rowsFor(), error: null }).then(resolve, reject),
    };
    return query;
  };
  const groupsQuery = makeListQuery(() => state.groupRows);
  const tokensQuery = makeListQuery(() => state.tokenRows);
  const supabase = {
    from: jest.fn((table: string) =>
      table === 'profiles' ? profilesQuery : table === 'coach_groups' ? groupsQuery : tokensQuery,
    ),
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: state.session }, error: null })),
      onAuthStateChange: jest.fn((callback: (event: string, session: unknown) => void) => {
        state.authCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signOut: (...args: unknown[]) => mockSupabaseSignOut(...args),
    },
  };
  return { supabase, __state: state };
});

const mockUnregisterPushToken = jest.fn().mockResolvedValue(undefined);
const mockGetNotificationPreferences = jest
  .fn()
  .mockResolvedValue({ pushEnabled: true, digestEnabled: true });

// Sign-out cleanup is token-row removal via the EXISTING service export; the
// D-CUT7 getter feeds the one real preference key (dailyDigest).
jest.mock('../../services/notifications', () => ({
  unregisterPushToken: (...args: unknown[]) => mockUnregisterPushToken(...args),
  getNotificationPreferences: (...args: unknown[]) => mockGetNotificationPreferences(...args),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __state } = require('../../config/supabase');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function TestConsumer() {
  const { loading, user, coach, error, signOut } = useAuth();

  if (loading) {
    return <Text>LOADING</Text>;
  }

  return (
    <>
      <Text>{`user:${user?.id ?? 'none'}`}</Text>
      <Text>{`role:${coach?.role ?? 'none'}`}</Text>
      <Text>{`uid:${coach?.uid ?? 'none'}`}</Text>
      <Text>{`digest:${coach ? String(coach.notificationPrefs.dailyDigest) : 'none'}`}</Text>
      <Text>{`groups:${coach ? coach.groups.join(',') : 'none'}`}</Text>
      <Text>{`error:${error ?? 'none'}`}</Text>
      <TouchableOpacity onPress={() => void signOut()}>
        <Text>TRIGGER SIGN OUT</Text>
      </TouchableOpacity>
    </>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationPreferences.mockResolvedValue({ pushEnabled: true, digestEnabled: true });
    __state.session = { user: { id: 'coach-1', email: 'coach@test.com' } };
    __state.profileRow = {
      id: 'profile-1',
      user_id: 'coach-1',
      email: 'coach@test.com',
      full_name: 'Coach One',
      role: 'coach_admin',
      account_status: 'approved',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    __state.groupRows = [{ practice_group: 'Gold' }];
    __state.tokenRows = [{ expo_push_token: 'ExponentPushToken[mock]' }];
    __state.authCallback = null;
  });

  it('cleans up push subscriptions before sign out', async () => {
    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.press(await findByText('TRIGGER SIGN OUT'));

    await waitFor(() => {
      expect(mockUnregisterPushToken).toHaveBeenCalledWith('coach-1', 'ExponentPushToken[mock]');
      expect(mockSupabaseSignOut).toHaveBeenCalled();
    });
  });

  it('maps a super_admin profile into the frozen Coach shape: role admin, uid := auth user id', async () => {
    __state.profileRow = { ...__state.profileRow!, role: 'super_admin' };

    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(await findByText('role:admin')).toBeTruthy();
    expect(await findByText('uid:coach-1')).toBeTruthy();
  });

  it('maps coach_admin to coach and resolves groups + the REAL digest preference through the D-CUT7 getter', async () => {
    mockGetNotificationPreferences.mockResolvedValue({ pushEnabled: true, digestEnabled: false });

    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(await findByText('role:coach')).toBeTruthy();
    expect(await findByText('groups:Gold')).toBeTruthy();
    expect(await findByText('digest:false')).toBeTruthy();
  });

  it('a non-staff or non-approved profile resolves coach=null with the not-a-coach error path (NM-5 auto-create is DELETED, not ported)', async () => {
    __state.profileRow = { ...__state.profileRow!, role: 'family' };

    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(await findByText('role:none')).toBeTruthy();
    expect(await findByText('error:Not a coach account')).toBeTruthy();
    expect(await findByText('user:coach-1')).toBeTruthy();
  });

  it('cold start restores the persisted session via getSession before any auth event fires (the 05 §6.4 named risk)', async () => {
    const { findByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // No onAuthStateChange event is ever fired in this test: the rendered
    // state below is driven entirely by the getSession() restore path.
    expect(await findByText('user:coach-1')).toBeTruthy();
    expect(await findByText('role:coach')).toBeTruthy();
    expect(__state.authCallback).not.toBeNull();
  });
});
