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
import { getGroupProgressReport, formatDropPercent, type GroupProgressReport } from '../../src/services/analytics';
import BarChart from '../../src/components/charts/BarChart';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';

export default function GroupReportScreen() {
  const [reports, setReports] = useState<GroupProgressReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results: GroupProgressReport[] = [];
      for (const g of GROUPS) {
        const report = await getGroupProgressReport(g, 90);
        if (report.swimmerCount > 0) results.push(report);
      }
      setReports(results);
      setLoading(false);
    })();
  }, []);

  const selectedReport = selectedGroup
    ? reports.find((r) => r.group === selectedGroup)
    : null;

  // Comparison chart data
  const comparisonData = reports.map((r) => ({
    label: r.group,
    value: r.avgAttendancePercent,
    color: groupColors[r.group] || colors.accent,
  }));

  const dropData = reports.map((r) => ({
    label: r.group,
    value: r.avgTimeDropPercent,
    color: groupColors[r.group] || colors.gold,
  }));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'GROUP PROGRESS',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Attendance Comparison */}
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>ATTENDANCE BY GROUP</Text>
              <BarChart
                data={comparisonData}
                height={160}
                formatValue={(v) => `${v.toFixed(0)}%`}
              />
            </View>

            {/* Time Drop Comparison */}
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>AVG IMPROVEMENT BY GROUP</Text>
              <BarChart
                data={dropData}
                height={160}
                barColor={colors.gold}
                formatValue={(v) => formatDropPercent(v)}
              />
            </View>

            {/* Group Cards */}
            <Text style={styles.sectionTitle}>GROUP DETAILS</Text>
            {reports.map((report) => (
              <TouchableOpacity
                key={report.group}
                style={[
                  styles.groupCard,
                  selectedGroup === report.group && styles.groupCardActive,
                ]}
                onPress={() => setSelectedGroup(
                  selectedGroup === report.group ? null : report.group as Group,
                )}
              >
                <View style={styles.groupHeader}>
                  <View style={[styles.groupBadge, { backgroundColor: groupColors[report.group] || colors.accent }]}>
                    <Text style={styles.groupBadgeText}>{report.group[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupName}>{report.group.toUpperCase()}</Text>
                    <Text style={styles.groupCount}>{report.swimmerCount} swimmers</Text>
                  </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{report.avgAttendancePercent.toFixed(0)}%</Text>
                    <Text style={styles.statLabel}>ATTENDANCE</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{report.totalTimeDrops}</Text>
                    <Text style={styles.statLabel}>TIME DROPS</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: colors.gold }]}>
                      {formatDropPercent(report.avgTimeDropPercent)}
                    </Text>
                    <Text style={styles.statLabel}>AVG DROP</Text>
                  </View>
                </View>

                {/* Top Droppers (expanded) */}
                {selectedGroup === report.group && report.topDroppers.length > 0 && (
                  <View style={styles.topDroppers}>
                    <Text style={styles.topDropTitle}>TOP IMPROVERS</Text>
                    {report.topDroppers.map((d, i) => (
                      <View key={i} style={styles.dropperRow}>
                        <Text style={styles.dropperRank}>{i + 1}.</Text>
                        <Text style={styles.dropperName}>{d.name}</Text>
                        <Text style={styles.dropperValue}>{formatDropPercent(d.dropPercent)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}

            {reports.length === 0 && (
              <Text style={styles.emptyText}>No group data available</Text>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  chartCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  groupCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  groupCardActive: {
    borderColor: colors.accent,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  groupBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.bgDeep,
  },
  groupName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
  },
  groupCount: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  statValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.lg,
    color: colors.accent,
  },
  statLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 6,
    letterSpacing: 1,
    color: colors.gold,
    marginTop: 2,
  },
  topDroppers: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  topDropTitle: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  dropperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dropperRank: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    width: 24,
  },
  dropperName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  dropperValue: {
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
