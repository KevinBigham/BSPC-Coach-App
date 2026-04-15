'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthChange, signOut } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  loadParentPortalDashboard,
  redeemParentInvite,
  type ParentProfile,
  type ParentSwimmerSummary,
} from '@/lib/parentPortal';
import type { User } from 'firebase/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [swimmers, setSwimmers] = useState<ParentSwimmerSummary[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState('');
  const [redeemError, setRedeemError] = useState('');

  const loadDashboard = async () => {
    setError('');
    const data = await loadParentPortalDashboard();
    setProfile(data.profile);
    setSwimmers(data.swimmers);
  };

  useEffect(() => {
    return onAuthChange((u) => {
      setUser(u);
      if (!u) {
        router.push('/');
        return;
      }

      loadDashboard()
        .catch((err: unknown) => {
          setError(getErrorMessage(err, 'Unable to load parent dashboard'));
        })
        .finally(() => setLoading(false));
    });
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleRedeem = async () => {
    if (inviteCode.length < 8 || !user) return;
    setRedeeming(true);
    setRedeemError('');
    try {
      await redeemParentInvite(inviteCode);
      setInviteCode('');
      await loadDashboard();
    } catch (err: unknown) {
      setRedeemError(getErrorMessage(err, 'Failed to redeem invite code'));
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <span className="pixel-label">WELCOME</span>
          <h2 className="heading text-3xl mt-1">
            {profile?.displayName || user?.email || 'PARENT'}
          </h2>
        </div>
        <button onClick={handleSignOut} className="btn-secondary text-sm">
          SIGN OUT
        </button>
      </div>

      {error && (
        <div className="card mb-6" style={{ borderColor: 'var(--error)' }}>
          <p className="text-[var(--error)] text-sm">{error}</p>
        </div>
      )}

      {swimmers.length > 0 ? (
        <div className="space-y-4">
          <h3 className="heading text-xl">YOUR SWIMMERS</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {swimmers.map((swimmer) => (
              <Link
                key={swimmer.id}
                href={`/swimmer/${swimmer.id}`}
                className="card hover:border-[var(--accent)] transition-colors cursor-pointer block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold">
                      {swimmer.firstName} {swimmer.lastName}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="pixel-label">{swimmer.group}</span>
                      <span className="text-[var(--text-secondary)] text-sm">
                        {swimmer.gender === 'M' ? 'Male' : 'Female'}
                      </span>
                    </div>
                  </div>
                  <span className="stat-number text-2xl">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <span className="pixel-label">NO SWIMMERS LINKED</span>
          <p className="text-[var(--text-secondary)] mt-4 mb-6">
            Ask your coach for an invite code to link your swimmer
          </p>
        </div>
      )}

      <div className="card mt-6">
        <span className="pixel-label">INVITE CODE</span>
        <p className="text-[var(--text-secondary)] text-sm mt-2 mb-4">
          Enter a coach-provided code to link another swimmer.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none uppercase tracking-wider text-center font-mono"
            placeholder="XXXX-XXXX"
            maxLength={9}
          />
          <button
            className="btn-primary"
            disabled={inviteCode.length < 8 || redeeming}
            onClick={handleRedeem}
          >
            {redeeming ? 'REDEEMING...' : 'REDEEM'}
          </button>
        </div>
        {redeemError && <p className="text-[var(--error)] text-sm mt-3">{redeemError}</p>}
      </div>
    </div>
  );
}
