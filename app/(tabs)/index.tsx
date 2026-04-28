import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { GROUPS } from '../../src/config/constants';
import { getTodayString } from '../../src/utils/time';
import { formatRelativeTime } from '../../src/utils/date';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { useAttendanceStore } from '../../src/stores/attendanceStore';
import { useVideoStore } from '../../src/stores/videoStore';
import {
  subscribeDashboardActivityAggregation,
  subscribeDashboardAttendanceAggregation,
  subscribeDashboardRecentPRsAggregation,
} from '../../src/services/aggregations';
import { subscribeUpcomingMeets } from '../../src/services/meets';
import { getUnreadCount } from '../../src/services/notifications';
import AttendanceHeatmap from '../../src/components/charts/AttendanceHeatmap';
import SparkLine from '../../src/components/charts/SparkLine';
import PracticePdfUploader from '../../src/components/practice-pdf-uploader';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import type { DashboardActivityItem } from '../../src/types/firestore.types';
import type { Meet } from '../../src/types/meet.types';

const ACTIVITY_CONFIG = {
  attendance: { label: 'CHECK-IN', color: colors.success, bgColor: 'rgba(204, 176, 0, 0.08)' },
  note: { label: 'NOTE', color: colors.accent, bgColor: 'rgba(179, 136, 255, 0.08)' },
  time: { label: 'NEW TIME', color: colors.info, bgColor: 'rgba(179, 136, 255, 0.06)' },
  pr: { label: 'PR!', color: colors.gold, bgColor: 'rgba(255, 215, 0, 0.08)' },
  video: { label: 'VIDEO', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.08)' },
} as const;

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function DashboardScreen() {
  const { coach } = useAuth();
  const storeSwimmers = useSwimmersStore((s) => s.swimmers);
  const todayRecords = useAttendanceStore((s) => s.todayRecords);
  const uploadProgress = useVideoStore((state) => state.uploadProgress);
  const [recentActivity, setRecentActivity] = useState<DashboardActivityItem[]>([]);
  const [weekAttendance, setWeekAttendance] = useState<Record<string, number>>({});
  const [pendingDrafts, setPendingDrafts] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [nextMeet, setNextMeet] = useState<(Meet & { id: string }) | null>(null);
  const [recentPRs, setRecentPRs] = useState<
    { id: string; event: string; course: string; timeDisplay: string; swimmerName?: string }[]
  >([]);
  const today = getTodayString();

  const totalSwimmers = storeSwimmers.length;
  const swimmerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    storeSwimmers.forEach((s) => {
      counts[s.group] = (counts[s.group] || 0) + 1;
    });
    return counts;
  }, [storeSwimmers]);
  const todayAttendance = useMemo(() => {
    return new Set(todayRecords.filter((r) => !r.departedAt).map((r) => r.swimmerId)).size;
  }, [todayRecords]);

  // Upcoming meet countdown
  useEffect(() => {
    return subscribeUpcomingMeets((meets) => {
      setNextMeet(meets.length > 0 ? meets[0] : null);
    });
  }, []);

  // Recent PRs feed — read from the server-computed aggregation rather than
  // running a collectionGroup query on every dashboard mount.
  useEffect(() => {
    return subscribeDashboardRecentPRsAggregation((aggregation) => {
      setRecentPRs(
        (aggregation?.items ?? []).map((item) => ({
          id: item.id,
          event: item.event,
          course: item.course,
          timeDisplay: item.timeDisplay,
          swimmerName: item.swimmerName,
        })),
      );
    });
  }, []);

  // 7-day attendance for spark chart
  useEffect(() => {
    return subscribeDashboardAttendanceAggregation((aggregation) => {
      setWeekAttendance(aggregation?.countsByDate ?? {});
    });
  }, []);

  // Pending AI drafts count (audio + video)
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

  // Unified activity feed: attendance + notes + times
  useEffect(() => {
    return subscribeDashboardActivityAggregation((aggregation) => {
      setRecentActivity(aggregation?.items ?? []);
    });
  }, []);

  useEffect(() => {
    if (!coach?.uid) {
      setUnreadCount(0);
      return;
    }

    return getUnreadCount(coach.uid, setUnreadCount);
  }, [coach?.uid]);

  // 7-day spark chart data
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

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {/* Welcome Scorebug */}
      <View style={styles.welcomeCard}>
        <View>
          <Text style={styles.welcomeText}>{coach?.displayName?.toUpperCase() || 'COACH'}</Text>
          <Text style={styles.welcomeSub}>Welcome back</Text>
        </View>
        <View style={styles.welcomeActions}>
          <TouchableOpacity style={styles.bellButton} onPress={() => router.push('/notifications')}>
            <Bell size={18} color={colors.accent} strokeWidth={2} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{coach?.role === 'admin' ? 'ADMIN' : 'COACH'}</Text>
          </View>
        </View>
      </View>

      {uploadProgress > 0 && uploadProgress < 1 && (
        <View style={styles.uploadProgressBanner}>
          <Text style={styles.uploadProgressText}>
            VIDEO UPLOAD {Math.round(uploadProgress * 100)}%
          </Text>
          <Text style={styles.uploadProgressValue}>QUEUED / ACTIVE</Text>
        </View>
      )}

      {/* Pending AI Drafts Banner */}
      {pendingDrafts > 0 && (
        <TouchableOpacity style={styles.draftsBanner} onPress={() => router.push('/ai-review')}>
          <Text style={styles.draftsBannerText}>
            {pendingDrafts} AI DRAFT{pendingDrafts > 1 ? 'S' : ''} READY FOR REVIEW
          </Text>
          <Text style={styles.draftsBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Meet Countdown */}
      {nextMeet &&
        (() => {
          const daysAway = Math.ceil(
            (new Date(nextMeet.startDate).getTime() - Date.now()) / 86400000,
          );
          return (
            <TouchableOpacity
              style={styles.meetCountdown}
              onPress={() => router.push(`/meet/${nextMeet.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.meetCountdownLabel}>NEXT MEET</Text>
                <Text style={styles.meetCountdownName}>{nextMeet.name.toUpperCase()}</Text>
                <Text style={styles.meetCountdownInfo}>
                  {nextMeet.location} | {nextMeet.startDate}
                </Text>
              </View>
              <View style={styles.meetCountdownDays}>
                <Text style={styles.meetCountdownNum}>{daysAway < 0 ? 0 : daysAway}</Text>
                <Text style={styles.meetCountdownUnit}>{daysAway === 1 ? 'DAY' : 'DAYS'}</Text>
              </View>
            </TouchableOpacity>
          );
        })()}

      {/* Recent PRs */}
      {recentPRs.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>RECENT PRs</Text>
          {recentPRs.map((pr) => (
            <View key={pr.id} style={styles.prRow}>
              <Text style={styles.prBadge}>PR</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.prEvent}>
                  {pr.event} ({pr.course})
                </Text>
              </View>
              <Text style={styles.prTime}>{pr.timeDisplay}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Stats */}
      {coach?.uid && <PracticePdfUploader coachId={coach.uid} />}

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/roster')}>
          <Text style={styles.statNumber}>{totalSwimmers}</Text>
          <Text style={styles.statLabel}>SWIMMERS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/attendance')}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{todayAttendance}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </TouchableOpacity>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{Object.keys(swimmerCounts).length}</Text>
          <Text style={styles.statLabel}>GROUPS</Text>
        </View>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Text style={styles.actionBtnText}>ATTENDANCE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/audio')}>
          <Text style={styles.actionBtnText}>RECORD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnAlt]}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.actionBtnTextAlt}>SEARCH</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnAlt]}
          onPress={() => router.push('/messages')}
        >
          <Text style={styles.actionBtnTextAlt}>CHAT</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnAlt]}
          onPress={() => router.push('/calendar')}
        >
          <Text style={styles.actionBtnTextAlt}>CALENDAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGold]}
          onPress={() => router.push('/analytics')}
        >
          <Text style={styles.actionBtnTextGold}>ANALYTICS</Text>
        </TouchableOpacity>
      </View>

      {/* 7-Day Attendance Spark Chart */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>7-DAY ATTENDANCE</Text>
        <View style={styles.sparkLineWrap}>
          <SparkLine
            data={sparkData.map((day) => day.count)}
            width={320}
            height={60}
            color={colors.accent}
          />
        </View>
        <View style={styles.sparkLabelRow}>
          {sparkData.map((day) => (
            <Text
              key={day.date}
              style={[styles.sparkLabel, day.date === today && styles.sparkLabelToday]}
            >
              {day.dayLabel}
            </Text>
          ))}
        </View>
      </View>

      {/* 12-Week Attendance Heatmap */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>12-WEEK HEATMAP</Text>
        <AttendanceHeatmap
          data={Object.entries(weekAttendance).map(([date, count]) => ({ date, count }))}
          weeks={12}
        />
      </View>

      {/* Group Breakdown with Distribution Bars */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>GROUPS</Text>
        {GROUPS.map((group) => {
          const count = swimmerCounts[group] || 0;
          const pct = totalSwimmers > 0 ? (count / totalSwimmers) * 100 : 0;
          return (
            <TouchableOpacity
              key={group}
              style={styles.groupRow}
              onPress={() => router.push(`/(tabs)/roster?group=${group}`)}
            >
              <View
                style={[styles.groupDot, { backgroundColor: groupColors[group] || colors.text }]}
              />
              <Text style={styles.groupName}>{group}</Text>
              <View style={styles.groupBarBg}>
                <View
                  style={[
                    styles.groupBarFill,
                    { width: `${pct}%`, backgroundColor: groupColors[group] || colors.accent },
                  ]}
                />
              </View>
              <Text style={styles.groupCount}>{count}</Text>
              <Text style={styles.groupChevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Activity Feed */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        {recentActivity.length > 0 ? (
          <View style={styles.activityFeed}>
            {recentActivity.map((item) => {
              const config = ACTIVITY_CONFIG[item.type];
              const rawTimestamp = item.timestamp as Date & { toDate?: () => Date };
              const ts =
                typeof rawTimestamp?.toDate === 'function'
                  ? rawTimestamp.toDate()
                  : rawTimestamp instanceof Date
                    ? rawTimestamp
                    : null;
              return (
                <View key={item.id} style={styles.activityItem}>
                  <View
                    style={[
                      styles.activityTag,
                      { backgroundColor: config.bgColor, borderColor: config.color },
                    ]}
                  >
                    <Text style={[styles.activityTagText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText} numberOfLines={1}>
                      {item.text}
                    </Text>
                    <View style={styles.activityMeta}>
                      <Text style={styles.activityCoach}>{item.coach}</Text>
                      {ts && <Text style={styles.activityTime}>{formatRelativeTime(ts)}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.activityPlaceholder}>
            <Text style={styles.pixelLabel}>--- GAME FEED ---</Text>
            <Text style={styles.placeholderText}>
              Activity will appear here as coaches take attendance, add notes, and log times.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },

  // Welcome
  welcomeCard: {
    backgroundColor: 'rgba(74, 14, 120, 0.25)',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.purple,
  },
  welcomeText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 2,
  },
  welcomeSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  welcomeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDeep,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  bellBadgeText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.bgDeep,
  },
  roleTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
  },
  roleTagText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold },

  // Drafts Banner
  draftsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  draftsBannerText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.gold,
    letterSpacing: 1,
  },
  draftsBannerArrow: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.gold },
  uploadProgressBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(179, 136, 255, 0.12)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  uploadProgressText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
    letterSpacing: 1,
  },
  uploadProgressValue: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.accent },
  statLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },

  // Actions Grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionBtnAlt: { backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  actionBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: 1,
  },
  actionBtnTextAlt: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.accent,
    letterSpacing: 1,
  },
  actionBtnGold: { backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.gold },
  actionBtnTextGold: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.gold,
    letterSpacing: 1,
  },

  // Meet Countdown
  meetCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  meetCountdownLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  meetCountdownName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
  },
  meetCountdownInfo: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  meetCountdownDays: { alignItems: 'center', marginLeft: spacing.lg },
  meetCountdownNum: { fontFamily: fontFamily.stat, fontSize: 36, color: colors.gold },
  meetCountdownUnit: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.gold,
  },

  // PR Feed
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  prBadge: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.gold,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  prEvent: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  prTime: { fontFamily: fontFamily.stat, fontSize: fontSize.md, color: colors.gold },

  // Spark Chart
  sparkLineWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sparkLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sparkLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  sparkLabelToday: {
    color: colors.gold,
  },

  // Sections
  sectionCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  groupDot: { width: 12, height: 12, borderRadius: 6, marginRight: spacing.md },
  groupName: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text, width: 80 },
  groupBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.bgBase,
    borderRadius: 3,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  groupBarFill: { height: '100%', borderRadius: 3 },
  groupCount: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.md,
    color: colors.accent,
    width: 30,
    textAlign: 'right',
    marginRight: spacing.sm,
  },
  groupChevron: { fontSize: fontSize.lg, color: colors.textSecondary },

  // Activity Feed
  activityFeed: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  activityTag: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  activityTagText: { fontFamily: fontFamily.pixel, fontSize: 7 },
  activityContent: { flex: 1 },
  activityText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.text },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  activityCoach: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  activityTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },

  // Placeholder
  activityPlaceholder: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  placeholderText: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default withScreenErrorBoundary(DashboardScreen, 'DashboardScreen');
