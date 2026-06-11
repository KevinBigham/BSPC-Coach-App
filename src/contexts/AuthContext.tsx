import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { Coach, CoachRole } from '../types/firestore.types';
import { getNotificationPreferences, unregisterPushToken } from '../services/notifications';
import { logger } from '../utils/logger';

interface AuthState {
  user: User | null;
  coach: Coach | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

// PG truth -> the frozen Coach type (05 §6.2): super_admin renders as the
// app's 'admin', coach_admin as 'coach'. Anything else is not staff.
const STAFF_ROLE_MAP: Record<string, CoachRole> = {
  super_admin: 'admin',
  coach_admin: 'coach',
};

interface StaffProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  account_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Coach resolution (05 §6.2(ii)): profiles (by user_id = session user id) +
 * coach_groups + notification_preferences, mapped into the frozen Coach type.
 * Coach.uid := auth.users.id (the D-C7 identity pin). A profile that is not
 * staff or not approved resolves null — gated provisioning (OD-3) governs all
 * new accounts; the NM-5 auto-create-admin branch is DELETED, not ported.
 */
async function resolveCoach(user: User): Promise<Coach | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, user_id, email, full_name, role, account_status, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const row = profile as StaffProfileRow;
  const role = STAFF_ROLE_MAP[row.role];
  if (!role || row.account_status !== 'approved') return null;

  const { data: groupRows, error: groupsError } = await supabase
    .from('coach_groups')
    .select('practice_group')
    .eq('profile_id', row.id);
  if (groupsError) throw groupsError;

  // Own-row D-CUT7 read: dailyDigest is the one REAL preference key; the
  // reader-less keys keep type-compat true defaults (CALL-2) so no consumer
  // changes shape.
  const prefs = await getNotificationPreferences();

  const { data: tokenRows, error: tokensError } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('is_active', true);
  if (tokensError) throw tokensError;

  return {
    uid: user.id,
    email: row.email,
    displayName: row.full_name,
    role,
    groups: ((groupRows ?? []) as { practice_group: Coach['groups'][number] }[]).map(
      (g) => g.practice_group,
    ),
    notificationPrefs: {
      dailyDigest: prefs.digestEnabled,
      newNotes: true,
      attendanceAlerts: true,
      aiDraftsReady: true,
    },
    fcmTokens: ((tokenRows ?? []) as { expo_push_token: string }[]).map((t) => t.expo_push_token),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    coach: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const handleUser = async (user: User | null) => {
      if (!user) {
        if (active) setState({ user: null, coach: null, loading: false, error: null });
        return;
      }
      try {
        const coach = await resolveCoach(user);
        if (active) {
          setState({
            user,
            coach,
            loading: false,
            error: coach ? null : 'Not a coach account',
          });
        }
      } catch (err: unknown) {
        if (active) {
          setState({
            user,
            coach: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Auth error',
          });
        }
      }
    };

    // Cold-start session restore (the 05 §6.4 named risk): the persisted
    // session resolves via getSession BEFORE any auth event fires.
    void supabase.auth.getSession().then(({ data }) => handleUser(data.session?.user ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // The EXISTING error-message map, re-keyed to supabase error codes —
      // the user-facing strings are part of the frozen surface (05 §6.2(ii)).
      let message = 'Sign in failed';
      const code = 'code' in error ? ((error as { code?: string }).code ?? '') : '';
      const lowerMessage = error.message?.toLowerCase() ?? '';
      if (code === 'invalid_credentials') message = 'Invalid email or password';
      else if (code === 'over_request_rate_limit') message = 'Too many attempts. Try again later';
      else if (lowerMessage.includes('network') || lowerMessage.includes('fetch'))
        message = 'Network error. Check your connection';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw new Error(message);
    }
    // Success: onAuthStateChange drives the state transition.
  };

  const signOut = async () => {
    if (state.coach) {
      try {
        // Own active push_tokens rows (own-row RLS), unregistered EACH via the
        // existing notifications-service export — no new service export rides
        // along (the D-K4 addition freeze).
        const { data: tokenRows, error } = await supabase
          .from('push_tokens')
          .select('expo_push_token')
          .eq('is_active', true);
        if (error) throw error;

        for (const tokenRow of (tokenRows ?? []) as { expo_push_token: string }[]) {
          await unregisterPushToken(state.coach.uid, tokenRow.expo_push_token);
        }
      } catch (error) {
        logger.warn('Push cleanup failed during sign out', {
          error: error instanceof Error ? error.message : String(error),
          coachUid: state.coach.uid,
        });
      }
    }

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        isAdmin: state.coach?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
