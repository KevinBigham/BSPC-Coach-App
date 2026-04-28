/**
 * Dashboard data hook — owns every Firestore subscription, derived store
 * state, and chart-shaping computation that the dashboard needs.
 *
 * Extracted from app/(tabs)/index.tsx (790 lines, flagged as a god-screen
 * audit risk in .codex/status.md). The screen imports one hook and reads
 * fields off the returned object instead of orchestrating five useEffects
 * inline. The screen still owns its own UI-only state (uploadProgress,
 * refreshing).
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useSwimmersStore } from '../stores/swimmersStore';
import { useAttendanceStore } from '../stores/attendanceStore';
import {
  subscribeDashboardActivityAggregation,
  subscribeDashboardAttendanceAggregation,
  subscribeDashboardRecentPRsAggregation,
} from '../services/aggregations';
import { subscribeUpcomingMeets } from '../services/meets';
import { getUnreadCount } from '../services/notifications';
import { getTodayString } from '../utils/time';
import type { DashboardActivityItem } from '../types/firestore.types';
import type { Meet } from '../types/meet.types';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Shape the dashboard renders for the recent-PRs row. */
export interface DashboardRecentPRView {
  id: string;
  event: string;
  course: string;
  timeDisplay: string;
  swimmerName?: string;
}

export interface DashboardData {
  totalSwimmers: number;
  swimmerCounts: Record<string, number>;
  todayAttendance: number;
  recentActivity: DashboardActivityItem[];
  recentPRs: DashboardRecentPRView[];
  weekAttendance: Record<string, number>;
  pendingDrafts: number;
  unreadCount: number;
  nextMeet: (Meet & { id: string }) | null;
  sparkData: Array<{ date: string; count: number; dayLabel: string }>;
  today: string;
}

export function useDashboardData(coachUid: string | undefined): DashboardData {
  const storeSwimmers = useSwimmersStore((s) => s.swimmers);
  const todayRecords = useAttendanceStore((s) => s.todayRecords);

  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>([]);
  const [recentPRs, setRecentPRs] = useState<DashboardRecentPRView[]>([]);
  const [weekAttendance, setWeekAttendance] = useState<Record<string, number>>({});
  const [pendingDrafts, setPendingDrafts] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextMeet, setNextMeet] = useState<(Meet & { id: string }) | null>(null);

  const today = getTodayString();

  useEffect(
    () => subscribeUpcomingMeets((meets) => setNextMeet(meets.length > 0 ? meets[0] : null)),
    [],
  );

  useEffect(
    () =>
      subscribeDashboardRecentPRsAggregation((aggregation) => {
        setRecentPRs(
          (aggregation?.items ?? []).map((item) => ({
            id: item.id,
            event: item.event,
            course: item.course,
            timeDisplay: item.timeDisplay,
            swimmerName: item.swimmerName,
          })),
        );
      }),
    [],
  );

  useEffect(
    () =>
      subscribeDashboardAttendanceAggregation((aggregation) => {
        setWeekAttendance(aggregation?.countsByDate ?? {});
      }),
    [],
  );

  useEffect(() => {
    let audioCount = 0;
    let videoCount = 0;
    const update = () => setPendingDrafts(audioCount + videoCount);

    const unsubAudio = onSnapshot(
      query(collection(db, 'audio_sessions'), where('status', '==', 'review')),
      (snap) => {
        audioCount = snap.size;
        update();
      },
    );
    const unsubVideo = onSnapshot(
      query(collection(db, 'video_sessions'), where('status', '==', 'review')),
      (snap) => {
        videoCount = snap.size;
        update();
      },
    );
    return () => {
      unsubAudio();
      unsubVideo();
    };
  }, []);

  useEffect(
    () =>
      subscribeDashboardActivityAggregation((aggregation) => {
        setRecentActivity(aggregation?.items ?? []);
      }),
    [],
  );

  useEffect(() => {
    if (!coachUid) {
      setUnreadCount(0);
      return;
    }
    return getUnreadCount(coachUid, setUnreadCount);
  }, [coachUid]);

  const totalSwimmers = storeSwimmers.length;

  const swimmerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    storeSwimmers.forEach((s) => {
      counts[s.group] = (counts[s.group] || 0) + 1;
    });
    return counts;
  }, [storeSwimmers]);

  const todayAttendance = useMemo(
    () => new Set(todayRecords.filter((r) => !r.departedAt).map((r) => r.swimmerId)).size,
    [todayRecords],
  );

  const sparkData = useMemo(() => {
    const data: { date: string; count: number; dayLabel: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push({
        date: dateStr,
        count: weekAttendance[dateStr] || 0,
        dayLabel: DAY_LABELS[d.getDay()],
      });
    }
    return data;
  }, [weekAttendance]);

  return {
    totalSwimmers,
    swimmerCounts,
    todayAttendance,
    recentActivity,
    recentPRs,
    weekAttendance,
    pendingDrafts,
    unreadCount,
    nextMeet,
    sparkData,
    today,
  };
}
