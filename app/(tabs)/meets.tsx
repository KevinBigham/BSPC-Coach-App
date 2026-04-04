import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { subscribeMeets, getMeetStatusColor, getMeetStatusLabel } from '../../src/services/meets';
import type { Meet } from '../../src/types/meet.types';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';

type MeetWithId = Meet & { id: string };
type FilterStatus = 'all' | 'upcoming' | 'in_progress' | 'completed';

export default function MeetsTabScreen() {
  const [meets, setMeets] = useState<MeetWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  useEffect(() => {
    const unsub = subscribeMeets((data) => {
      setMeets(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === 'all'
    ? meets
    : meets.filter((m) => m.status === filter);

  const upcomingCount = meets.filter((m) => m.status === 'upcoming').length;
  const inProgressCount = meets.filter((m) => m.status === 'in_progress').length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{meets.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.accent }]}>{upcomingCount}</Text>
            <Text style={styles.statLabel}>UPCOMING</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.gold }]}>{inProgressCount}</Text>
            <Text style={styles.statLabel}>LIVE</Text>
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'upcoming', 'in_progress', 'completed'] as FilterStatus[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'ALL' : f === 'in_progress' ? 'LIVE' : f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {filtered.map((meet) => {
              const statusColor = getMeetStatusColor(meet.status);
              const daysAway = meet.status === 'upcoming'
                ? Math.ceil((new Date(meet.startDate).getTime() - Date.now()) / 86400000)
                : null;

              return (
                <TouchableOpacity
                  key={meet.id}
                  style={styles.meetCard}
                  onPress={() => router.push(`/meet/${meet.id}`)}
                >
                  <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
                  <View style={styles.meetContent}>
                    <View style={styles.meetHeader}>
                      <Text style={styles.meetName}>{meet.name}</Text>
                      <Text style={[styles.statusBadge, { color: statusColor }]}>
                        {getMeetStatusLabel(meet.status)}
                      </Text>
                    </View>
                    <Text style={styles.meetInfo}>
                      {meet.location} | {meet.course} | {meet.startDate}
                    </Text>
                    <View style={styles.meetFooter}>
                      <Text style={styles.meetEvents}>{meet.events.length} events</Text>
                      {daysAway !== null && daysAway >= 0 && (
                        <Text style={styles.daysAway}>
                          {daysAway === 0 ? 'TODAY' : `${daysAway}d away`}
                        </Text>
                      )}
                      {meet.status === 'in_progress' && (
                        <TouchableOpacity
                          style={styles.liveBtn}
                          onPress={() => router.push(`/meet/${meet.id}/live`)}
                        >
                          <Text style={styles.liveBtnText}>LIVE MODE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>NO MEETS</Text>
                <Text style={styles.emptyText}>
                  {filter === 'all' ? 'Create your first meet' : `No ${filter.replace('_', ' ')} meets`}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/meet/new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.text },
  statLabel: { fontFamily: fontFamily.pixel, fontSize: 7, letterSpacing: 1, color: colors.gold, marginTop: 2 },
  filterRow: { marginBottom: spacing.lg, flexGrow: 0 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: 'rgba(179,136,255,0.1)' },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  chipTextActive: { color: colors.accent },
  meetCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  statusBar: { width: 4 },
  meetContent: { flex: 1, padding: spacing.lg },
  meetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  meetName: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: 1, color: colors.text, flex: 1 },
  statusBadge: { fontFamily: fontFamily.pixel, fontSize: 7, letterSpacing: 1 },
  meetInfo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  meetFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meetEvents: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.accent },
  daysAway: { fontFamily: fontFamily.stat, fontSize: fontSize.xs, color: colors.gold },
  liveBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  liveBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.bgDeep, letterSpacing: 1 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, letterSpacing: 2 },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { fontFamily: fontFamily.heading, fontSize: 28, color: colors.text },
});
