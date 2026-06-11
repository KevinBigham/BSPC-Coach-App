/**
 * parent-portal session half — supabase.auth (UNIFY/05 §6.2(vii), the
 * identity-cluster cutover). Lives under test/ (not parent-portal/) because
 * jest.config.js ignores /parent-portal/ test paths; the module under test is
 * plain TS with no Next.js or Firebase imports (the Phase A precedent,
 * parentPortal-auth.test.ts).
 */
const mockSignInWithPassword = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('../parent-portal/src/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { signIn, onAuthChange } from '../parent-portal/src/lib/auth';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('parent-portal session half (supabase.auth)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: 'parent-1' } }, error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'parent-1' } } },
      error: null,
    });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  });

  it('signIn rides signInWithPassword and onAuthChange emits the restored session user through the unchanged consumer contract', async () => {
    await signIn('parent@example.com', 'correct-horse');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'correct-horse',
    });

    const seen: unknown[] = [];
    const unsubscribe = onAuthChange((user) => seen.push(user));
    await flush();
    expect(seen).toEqual([{ id: 'parent-1' }]);
    expect(mockOnAuthStateChange).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');
  });
});
