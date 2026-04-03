import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS } from '../../src/config/constants';

interface ActivityItem {
  id: string;
  type: 'attendance' | 'note';
  text: string;
  coach: string;
  timestamp: any;
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export default function DashboardScreen() {
  const { coach } = useAuth();
  const [swimmerCounts, setSwimmerCounts] = useState<Record<string, number>>({});
  const [totalSwimmers, setTotalSwimmers] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const today = getTodayString();

  // Swimmers by group
  useEffect(() => {
    const q = query(collection(db, 'swimmers'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const group = doc.data().group as string;
        counts[group] = (counts[group] || 0) + 1;
      });
      setSwimmerCounts(counts);
      setTotalSwimmers(snapshot.size);
    });
    return unsubscribe;
  }, []);

  // Today's attendance count
  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      where('practiceDate', '==', today)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Count unique swimmers present (not departed)
      const present = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.departedAt) present.add(data.swimmerId);
      });
      setTodayAttendance(present.size);
    });
    return unsubscribe;
  }, [today]);

  // Recent attendance activity
  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ActivityItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: 'attendance' as const,
          text: `${data.swimmerName} checked in`,
          coach: data.coachName || 'Coach',
          timestamp: data.createdAt,
        };
      });
      setRecentActivity(items);
    });
    return unsubscribe;
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Welcome Scorebug */}
      <View style={styles.welcomeCard}>
        <View>
          <Text style={styles.welcomeText}>
            {coach?.displayName?.toUpperCase() || 'COACH'}
          </Text>
          <Text style={styles.welcomeSub}>Welcome back</Text>
        </View>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>
            {coach?.role === 'admin' ? 'ADMIN' : 'COACH'}
          </Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalSwimmers}</Text>
          <Text style={styles.statLabel}>SWIMMERS</Text>
        </View>
        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(tabs)/attendance')}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{todayAttendance}</Text>
          <Text style={styles.statLabel}>TODAY</Text>
        </TouchableOpacity>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{Object.keys(swimmerCounts).length}</Text>
          <Text style={styles.statLabel}>GROUPS</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Text style={styles.actionButtonText}>ATTENDANCE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={() => router.push('/messages')}
        >
          <Text style={styles.actionButtonTextSecondary}>COACH CHAT</Text>
        </TouchableOpacity>
      </View>

      {/* Group Breakdown */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>GROUPS</Text>
        {GROUPS.map((group) => (
          <View key={group} style={styles.groupRow}>
            <View style={[styles.groupDot, { backgroundColor: groupColors[group] || colors.text }]} />
            <Text style={styles.groupName}>{group}</Text>
            <Text style={styles.groupCount}>{swimmerCounts[group] || 0}</Text>
          </View>
        ))}
      </View>

      {/* Activity Feed */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        {recentActivity.length > 0 ? (
          <View style={styles.activityFeed}>
            {recentActivity.map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <View style={styles.activityTag}>
                  <Text style={styles.activityTagText}>
                    {item.type === 'attendance' ? 'CHECK-IN' : 'NOTE'}
                  </Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{item.text}</Text>
                  <Text style={styles.activityCoach}>{item.coach}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.activityPlaceholder}>
            <Text style={styles.pixelLabel}>--- GAME FEED ---</Text>
            <Text style={styles.placeholderText}>
              Activity will appear here as coaches take attendance and add notes.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
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
  roleTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
  },
  roleTagText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNumber: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xxxl,
    color: colors.accent,
  },
  statLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: 1,
  },
  actionButtonTextSecondary: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.accent,
    letterSpacing: 1,
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
  groupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  groupName: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
  },
  groupCount: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.md,
    color: colors.accent,
  },
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
    backgroundColor: 'rgba(204, 176, 0, 0.08)',
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  activityTagText: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.success,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  activityCoach: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
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
