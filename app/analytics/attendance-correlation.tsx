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
  getAttendanceCorrelation,
  formatDropPercent,
  type AttendanceCorrelation,
} from '../../src/services/analytics';
import BarChart from '../../src/components/charts/BarChart';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function AttendanceCorrelationScreen() {
  const [data, setData] = useState<AttendanceCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [rangeDays, setRangeDays] = useState(90);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getAttendanceCorrelation(group, rangeDays);
    setData(result);
    setLoading(false);
  }, [group, rangeDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Split into quartiles by attendance
  const sorted = [...data].sort((a, b) => b.attendancePercent - a.attendancePercent);
  const topQuarter = sorted.slice(0, Math.ceil(sorted.length / 4));
  const bottomQuarter = sorted.slice(Math.floor((sorted.length * 3) / 4));

  const topAvgDrop =
    topQuarter.length > 0
      ? topQuarter.reduce((s, c) => s + c.timeDropPercent, 0) / topQuarter.length
      : 0;
  const bottomAvgDrop =
    bottomQuarter.length > 0
      ? bottomQuarter.reduce((s, c) => s + c.timeDropPercent, 0) / bottomQuarter.length
      : 0;

  const chartData = [
    { label: 'Top 25%\nAttendance', value: topAvgDrop, color: colors.gold },
    { label: 'Bottom 25%\nAttendance', value: bottomAvgDrop, color: colors.purpleLight },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ATTENDANCE TRENDS',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Group Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, !group && styles.chipActive]}
            onPress={() => setGroup(undefined)}
          >
            <Text style={[styles.chipText, !group && styles.chipTextActive]}>ALL</Text>
          </TouchableOpacity>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, group === g && styles.chipActive]}
              onPress={() => setGroup(g)}
            >
              <Text style={[styles.chipText, group === g && styles.chipTextActive]}>
                {g.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Insight Card */}
            <View style={styles.insightCard}>
              <Text style={styles.pixelLabel}>INSIGHT</Text>
              <Text style={styles.insightText}>
                Swimmers in the top 25% of attendance average{' '}
                <Text style={{ color: colors.gold }}>{formatDropPercent(topAvgDrop)}</Text>{' '}
                improvement vs{' '}
                <Text style={{ color: colors.purpleLight }}>
                  {formatDropPercent(bottomAvgDrop)}
                </Text>{' '}
                for the bottom 25%.
              </Text>
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>AVG IMPROVEMENT BY ATTENDANCE</Text>
              <BarChart data={chartData} height={140} formatValue={(v) => formatDropPercent(v)} />
            </View>

            {/* Swimmer List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SWIMMERS ({data.length})</Text>
              {/* Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { flex: 2 }]}>NAME</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>ATT %</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>PRACTICES</Text>
                <Text style={[styles.headerCell, { flex: 1, textAlign: 'right' }]}>IMPROVE</Text>
              </View>
              {sorted.map((s) => (
                <View key={s.swimmerId} style={styles.row}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.rowName}>{s.swimmerName}</Text>
                    <Text style={styles.rowGroup}>{s.group}</Text>
                  </View>
                  <Text style={[styles.rowStat, { flex: 1, textAlign: 'center' }]}>
                    {s.attendancePercent.toFixed(0)}%
                  </Text>
                  <Text style={[styles.rowStatMono, { flex: 1, textAlign: 'center' }]}>
                    {s.practiceCount}
                  </Text>
                  <Text style={[styles.rowStatGold, { flex: 1, textAlign: 'right' }]}>
                    {s.timeDropPercent > 0 ? formatDropPercent(s.timeDropPercent) : '—'}
                  </Text>
                </View>
              ))}
              {data.length === 0 && <Text style={styles.emptyText}>No data available</Text>}
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
  filterRow: { marginBottom: spacing.xl, flexGrow: 0 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  chipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  chipTextActive: { color: colors.accent },
  insightCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  insightText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
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
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerCell: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.gold,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  rowName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  rowGroup: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  rowStat: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  rowStatMono: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  rowStatGold: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.gold,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});

export default withScreenErrorBoundary(AttendanceCorrelationScreen, 'AttendanceCorrelationScreen');
