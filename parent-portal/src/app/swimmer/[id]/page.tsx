'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onAuthChange } from '@/lib/auth';

interface Swimmer {
  firstName: string;
  lastName: string;
  group: string;
  gender: string;
  active: boolean;
  strengths: string[];
  goals: string[];
}

interface SwimTime {
  id: string;
  event: string;
  course: string;
  time: number;
  timeDisplay: string;
  isPR: boolean;
  meetName?: string;
}

interface AttendanceRecord {
  id: string;
  practiceDate: string;
  status?: string;
}

function formatTime(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
  return `${secs}.${hs.toString().padStart(2, '0')}`;
}

export default function SwimmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [times, setTimes] = useState<SwimTime[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tab, setTab] = useState<'overview' | 'times' | 'attendance'>('overview');

  useEffect(() => {
    return onAuthChange((user) => {
      if (!user) router.push('/');
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, 'swimmers', id), (snap) => {
      if (snap.exists()) setSwimmer(snap.data() as Swimmer);
    });
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, 'swimmers', id, 'times'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(q, (snap) => {
      setTimes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SwimTime)));
    });
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      orderBy('practiceDate', 'desc'),
      limit(30),
    );
    return onSnapshot(q, (snap) => {
      setAttendance(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((a: any) => a.swimmerId === id),
      );
    });
  }, [id]);

  if (!swimmer) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  // Build PRs map
  const prs: Record<string, SwimTime> = {};
  for (const t of times) {
    const key = `${t.event}_${t.course}`;
    if (!prs[key] || t.time < prs[key].time) {
      prs[key] = t;
    }
  }
  const prList = Object.values(prs).sort((a, b) => a.event.localeCompare(b.event));

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'times' as const, label: `Times (${times.length})` },
    { key: 'attendance' as const, label: `Attendance (${attendance.length})` },
  ];

  return (
    <div>
      {/* Back */}
      <a href="/dashboard" className="text-[var(--accent)] text-sm hover:underline mb-4 inline-block">
        ← Back to Dashboard
      </a>

      {/* Header */}
      <div className="mb-6">
        <span className="pixel-label">{swimmer.group}</span>
        <h2 className="heading text-4xl mt-1">
          {swimmer.firstName} {swimmer.lastName}
        </h2>
        <p className="text-[var(--text-secondary)]">
          {swimmer.gender === 'M' ? 'Male' : 'Female'} · {swimmer.active ? 'Active' : 'Inactive'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <span className="stat-number text-3xl">{prList.length}</span>
              <p className="pixel-label mt-2">PRs</p>
            </div>
            <div className="card text-center">
              <span className="stat-number text-3xl">{times.length}</span>
              <p className="pixel-label mt-2">TIMES</p>
            </div>
            <div className="card text-center">
              <span className="stat-number text-3xl">{attendance.length}</span>
              <p className="pixel-label mt-2">PRACTICES</p>
            </div>
          </div>

          {/* PRs */}
          {prList.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">PERSONAL RECORDS</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {prList.map((pr) => (
                  <div key={`${pr.event}_${pr.course}`} className="card flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{pr.event}</p>
                      <span className="pixel-label">{pr.course}</span>
                    </div>
                    <span className="stat-number text-xl">{pr.timeDisplay || formatTime(pr.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Goals */}
          {swimmer.strengths.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">STRENGTHS</h3>
              <div className="flex flex-wrap gap-2">
                {swimmer.strengths.map((s, i) => (
                  <span key={i} className="px-3 py-1 rounded text-sm border border-[var(--purple)] text-[var(--accent)]" style={{ background: 'rgba(74,14,120,0.3)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {swimmer.goals.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">GOALS</h3>
              <div className="flex flex-wrap gap-2">
                {swimmer.goals.map((g, i) => (
                  <span key={i} className="px-3 py-1 rounded text-sm border border-[var(--gold)]" style={{ color: 'var(--gold)', background: 'rgba(255,215,0,0.1)' }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Times Tab */}
      {tab === 'times' && (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="text-left py-2 pixel-label">EVENT</th>
                <th className="text-center py-2 pixel-label">COURSE</th>
                <th className="text-right py-2 pixel-label">TIME</th>
                <th className="text-right py-2 pixel-label">MEET</th>
              </tr>
            </thead>
            <tbody>
              {times.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border-light)]">
                  <td className="py-2 font-semibold text-sm">
                    {t.event}
                    {t.isPR && <span className="ml-2 text-[var(--gold)] text-xs">PR</span>}
                  </td>
                  <td className="py-2 text-center pixel-label">{t.course}</td>
                  <td className="py-2 text-right stat-number">{t.timeDisplay || formatTime(t.time)}</td>
                  <td className="py-2 text-right text-[var(--text-secondary)] text-xs">{t.meetName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {times.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] py-8">No times recorded</p>
          )}
        </div>
      )}

      {/* Attendance Tab */}
      {tab === 'attendance' && (
        <div className="card">
          <div className="grid grid-cols-7 gap-2">
            {attendance.slice(0, 28).map((a) => (
              <div
                key={a.id}
                className="text-center p-2 rounded text-xs"
                style={{
                  backgroundColor: a.status === 'excused' ? 'rgba(255,215,0,0.1)' : 'rgba(74,14,120,0.3)',
                  border: `1px solid ${a.status === 'excused' ? 'var(--gold)' : 'var(--purple)'}`,
                }}
              >
                <p className="font-mono text-[var(--text-secondary)]">
                  {a.practiceDate.split('-').slice(1).join('/')}
                </p>
              </div>
            ))}
          </div>
          {attendance.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] py-8">No attendance records</p>
          )}
        </div>
      )}
    </div>
  );
}
