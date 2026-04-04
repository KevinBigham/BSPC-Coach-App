'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange, getParentProfile, signOut, type ParentProfile } from '@/lib/auth';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

interface SwimmerSummary {
  id: string;
  firstName: string;
  lastName: string;
  group: string;
  gender: string;
  active: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [swimmers, setSwimmers] = useState<SwimmerSummary[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');

  useEffect(() => {
    return onAuthChange(async (u) => {
      setUser(u);
      if (!u) {
        router.push('/');
        return;
      }
      const p = await getParentProfile(u.uid);
      setProfile(p);

      if (p && p.linkedSwimmerIds.length > 0) {
        const swimmerData: SwimmerSummary[] = [];
        for (const sid of p.linkedSwimmerIds) {
          const snap = await getDoc(doc(db, 'swimmers', sid));
          if (snap.exists()) {
            swimmerData.push({ id: snap.id, ...snap.data() } as SwimmerSummary);
          }
        }
        setSwimmers(swimmerData);
      }
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleRedeem = async () => {
    if (inviteCode.length < 8 || !user) return;
    setRedeeming(true);
    setRedeemError('');
    try {
      const functions = getFunctions();
      const redeemInvite = httpsCallable(functions, 'redeemInvite');
      const result = await redeemInvite({ code: inviteCode });
      const data = result.data as { success: boolean; swimmerId: string; swimmerName: string };
      if (data.success) {
        // Refresh swimmer list
        const snap = await getDoc(doc(db, 'swimmers', data.swimmerId));
        if (snap.exists()) {
          setSwimmers((prev) => [...prev, { id: snap.id, ...snap.data() } as SwimmerSummary]);
        }
        setInviteCode('');
      }
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to redeem invite code');
    }
    setRedeeming(false);
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
      {/* Header */}
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

      {/* Swimmers */}
      {swimmers.length > 0 ? (
        <div className="space-y-4">
          <h3 className="heading text-xl">YOUR SWIMMERS</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {swimmers.map((swimmer) => (
              <a
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
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <span className="pixel-label">NO SWIMMERS LINKED</span>
          <p className="text-[var(--text-secondary)] mt-4 mb-6">
            Ask your coach for an invite code to link your swimmer
          </p>

          <div className="max-w-sm mx-auto">
            <label className="pixel-label block mb-2 text-left">INVITE CODE</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none uppercase tracking-wider text-center font-mono"
                placeholder="XXXX-XXXX"
                maxLength={9}
              />
              <button className="btn-primary" disabled={inviteCode.length < 8 || redeeming} onClick={handleRedeem}>
                {redeeming ? 'REDEEMING...' : 'REDEEM'}
              </button>
            </div>
            {redeemError && (
              <p className="text-[var(--error)] text-sm mt-3">{redeemError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
