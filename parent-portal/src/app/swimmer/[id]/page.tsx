'use client';

import { useEffect, use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthChange } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  loadParentSwimmerPortalData,
  type ParentAttendanceSummary,
  type ParentSwimmerDetail,
  type ParentSwimTime,
} from '@/lib/parentPortal';

type Tab = 'overview' | 'times' | 'attendance';

function formatTime(hundredths: number): string {
  const mins = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const hs = hundredths % 100;
  if (mins > 0)
    return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
  return `${secs}.${hs.toString().padStart(2, '0')}`;
}

export default function SwimmerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [swimmer, setSwimmer] = useState<ParentSwimmerDetail | null>(null);
  const [times, setTimes] = useState<ParentSwimTime[]>([]);
  const [attendance, setAttendance] = useState<ParentAttendanceSummary[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    return onAuthChange((user) => {
      if (!user) {
        router.push('/');
        return;
      }

      loadParentSwimmerPortalData(id)
        .then((data) => {
          setSwimmer(data.swimmer);
          setTimes(data.times);
          setAttendance(data.attendance);
        })
        .catch((err: unknown) => {
          setError(getErrorMessage(err, 'Unable to load swimmer data'));
        })
        .finally(() => setLoading(false));
    });
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (error || !swimmer) {
    return (
      <div>
        <Link
          href="/dashboard"
          className="text-[var(--accent)] text-sm hover:underline mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <div className="card">
          <span className="pixel-label">ACCESS UNAVAILABLE</span>
          <p className="text-[var(--text-secondary)] mt-3">
            {error || 'This swimmer is not linked to your account.'}
          </p>
        </div>
      </div>
    );
  }

  const prs: Record<string, ParentSwimTime> = {};
  for (const time of times) {
    const key = `${time.event}_${time.course}`;
    if (!prs[key] || time.time < prs[key].time) {
      prs[key] = time;
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
      <Link
        href="/dashboard"
        className="text-[var(--accent)] text-sm hover:underline mb-4 inline-block"
      >
        ← Back to Dashboard
      </Link>

      <div className="mb-6">
        <span className="pixel-label">{swimmer.group}</span>
        <h2 className="heading text-4xl mt-1">
          {swimmer.firstName} {swimmer.lastName}
        </h2>
        <p className="text-[var(--text-secondary)]">
          {swimmer.gender === 'M' ? 'Male' : 'Female'} · {swimmer.active ? 'Active' : 'Inactive'}
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === item.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
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

          {prList.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">PERSONAL RECORDS</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {prList.map((pr) => (
                  <div
                    key={`${pr.event}_${pr.course}`}
                    className="card flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold">{pr.event}</p>
                      <span className="pixel-label">{pr.course}</span>
                    </div>
                    <span className="stat-number text-xl">
                      {pr.timeDisplay || formatTime(pr.time)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {swimmer.strengths.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">STRENGTHS</h3>
              <div className="flex flex-wrap gap-2">
                {swimmer.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="px-3 py-1 rounded text-sm border border-[var(--purple)] text-[var(--accent)]"
                    style={{ background: 'rgba(74,14,120,0.3)' }}
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          )}

          {swimmer.goals.length > 0 && (
            <div>
              <h3 className="heading text-xl mb-3">GOALS</h3>
              <div className="flex flex-wrap gap-2">
                {swimmer.goals.map((goal) => (
                  <span
                    key={goal}
                    className="px-3 py-1 rounded text-sm border border-[var(--gold)]"
                    style={{ color: 'var(--gold)', background: 'rgba(255,215,0,0.1)' }}
                  >
                    {goal}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
              {times.map((time) => (
                <tr key={time.id} className="border-b border-[var(--border-light)]">
                  <td className="py-2 font-semibold text-sm">
                    {time.event}
                    {time.isPR && <span className="ml-2 text-[var(--gold)] text-xs">PR</span>}
                  </td>
                  <td className="py-2 text-center pixel-label">{time.course}</td>
                  <td className="py-2 text-right stat-number">
                    {time.timeDisplay || formatTime(time.time)}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)] text-xs">
                    {time.meetName || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {times.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] py-8">No times recorded</p>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card">
          <div className="grid grid-cols-7 gap-2">
            {attendance.slice(0, 28).map((record) => (
              <div
                key={record.id}
                className="text-center p-2 rounded text-xs"
                style={{
                  backgroundColor:
                    record.status === 'excused' ? 'rgba(255,215,0,0.1)' : 'rgba(74,14,120,0.3)',
                  border: `1px solid ${
                    record.status === 'excused' ? 'var(--gold)' : 'var(--purple)'
                  }`,
                }}
              >
                <p className="font-mono text-[var(--text-secondary)]">
                  {record.practiceDate.split('-').slice(1).join('/')}
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
