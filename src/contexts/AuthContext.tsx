import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { Coach, CoachRole } from '../types/firestore.types';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    coach: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const coachDoc = await getDoc(doc(db, 'coaches', user.uid));
          if (coachDoc.exists()) {
            setState({
              user,
              coach: { uid: user.uid, ...coachDoc.data() } as Coach,
              loading: false,
              error: null,
            });
          } else {
            // First login — create coach profile with default role
            const newCoach: Omit<Coach, 'uid'> = {
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Coach',
              role: 'coach' as CoachRole,
              groups: [],
              notificationPrefs: {
                dailyDigest: true,
                newNotes: true,
                attendanceAlerts: true,
                aiDraftsReady: true,
              },
              fcmTokens: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await setDoc(doc(db, 'coaches', user.uid), {
              ...newCoach,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setState({
              user,
              coach: { uid: user.uid, ...newCoach },
              loading: false,
              error: null,
            });
          }
        } catch (err: unknown) {
          setState({
            user,
            coach: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Auth error',
          });
        }
      } else {
        setState({ user: null, coach: null, loading: false, error: null });
      }
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      let message = 'Sign in failed';
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : '';
      if (code === 'auth/invalid-credential') message = 'Invalid email or password';
      else if (code === 'auth/too-many-requests') message = 'Too many attempts. Try again later';
      else if (code === 'auth/network-request-failed')
        message = 'Network error. Check your connection';
      setState((s) => ({ ...s, loading: false, error: message }));
      throw new Error(message);
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
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
