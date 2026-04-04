'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <span className="pixel-label">BSPC</span>
          <h2 className="heading text-4xl mt-2">
            {isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </h2>
          <p className="text-[var(--text-secondary)] mt-2">
            {isSignUp
              ? 'Create an account to view your swimmer\'s progress'
              : 'Sign in to view your swimmer\'s progress'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="pixel-label block mb-2">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="parent@email.com"
              required
            />
          </div>
          <div>
            <label className="pixel-label block mb-2">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-[var(--error)] text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full text-center"
            disabled={loading}
          >
            {loading ? 'LOADING...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[var(--accent)] text-sm hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>

        <div className="card mt-6 text-center" style={{ borderColor: 'var(--gold)', background: 'rgba(255,215,0,0.05)' }}>
          <span className="pixel-label">HAVE AN INVITE CODE?</span>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            Sign in first, then enter your invite code to link your swimmer
          </p>
        </div>
      </div>
    </div>
  );
}
