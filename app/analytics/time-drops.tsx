import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  getTimeDrops,
  formatTime,
  formatDropPercent,
  type TimeDrop,
} from '../../src/services/analytics';
import TimeDropChart from '../../src/components/charts/TimeDropChart';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

const RANGE_OPTIONS = [
  { label: '30 DAYS', days: 30 },
  { label: '90 DAYS', days: 90 },
  { label: 'SEASON', days: 365 },
];

function TimeDropsScreen() {
  const [drops, setDrops] = useState<TimeDrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [rangeDays, setRangeDays] = useState(90);

  const loadData = useCallback(async () => {
    setLoading(true);
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - rangeDays);
    const data = await getTimeDrops({
      group,
      rangeStart: rangeStart.toISOString().split('T')[0],
      maxResults: 50,
    });
    setDrops(data);
    setLoading(false);
  }, [group, rangeDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartData = drops.slice(0, 10).map((d) => ({
    label: `${d.swimmerName.split(' ')[0]} - ${d.event}`,
    dropPercent: d.dropPercent,
    dropDisplay: formatDropPercent(d.dropPercent),
  }));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'TIME DROPS',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Group Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !group && styles.filterChipActive]}
            onPress={() => setGroup(undefined)}
          >
            <Text style={[styles.filterChipText, !group && styles.filterChipTextActive]}>ALL</Text>
          </TouchableOpacity>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.filterChip, group === g && styles.filterChipActive]}
              onPress={() => setGroup(g)}
            >
              <Text style={[styles.filterChipText, group === g && styles.filterChipTextActive]}>
                {g.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Range Filter */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.days}
              style={[styles.rangeChip, rangeDays === opt.days && styles.rangeChipActive]}
              onPress={() => setRangeDays(opt.days)}
            >
              <Text
                style={[styles.rangeChipText, rangeDays === opt.days && styles.rangeChipTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>TOP TIME DROPS</Text>
              <TimeDropChart drops={chartData} />
            </View>

            {/* List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ALL DROPS ({drops.length})</Text>
              {drops.map((d, i) => (
                <View key={i} style={styles.dropRow}>
                  <View style={styles.dropInfo}>
                    <Text style={styles.dropName}>{d.swimmerName}</Text>
                    <Text style={styles.dropEvent}>
                      {d.event} ({d.course})
                    </Text>
                  </View>
                  <View style={styles.dropTimes}>
                    <Text style={styles.dropOld}>{formatTime(d.oldTime)}</Text>
                    <Text style={styles.dropArrow}>{'>'}</Text>
                    <Text style={styles.dropNew}>{formatTime(d.newTime)}</Text>
                  </View>
                  <Text style={styles.dropPercent}>{formatDropPercent(d.dropPercent)}</Text>
                </View>
              ))}
              {drops.length === 0 && (
                <Text style={styles.emptyText}>No time drops found for this range</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  filterRow: { marginBottom: spacing.md, flexGrow: 0 },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  filterChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  filterChipTextActive: { color: colors.accent },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  rangeChipActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  rangeChipText: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  rangeChipTextActive: { color: colors.gold },
  chartCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dropInfo: { flex: 1 },
  dropName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  dropEvent: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dropTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.md,
  },
  dropOld: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  dropArrow: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  dropNew: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  dropPercent: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.gold,
    minWidth: 50,
    textAlign: 'right',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});

export default withScreenErrorBoundary(TimeDropsScreen, 'TimeDropsScreen');
