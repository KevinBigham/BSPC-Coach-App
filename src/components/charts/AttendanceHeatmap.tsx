import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, spacing } from '../../config/theme';

interface HeatmapDay {
  date: string; // "YYYY-MM-DD"
  count: number;
}

interface AttendanceHeatmapProps {
  data: HeatmapDay[];
  weeks?: number;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getCellColor(count: number): string {
  if (count === 0) return colors.bgSurface;
  if (count === 1) return 'rgba(74, 14, 120, 0.4)';
  if (count === 2) return 'rgba(74, 14, 120, 0.7)';
  return colors.purple;
}

export default function AttendanceHeatmap({
  data,
  weeks = 12,
}: AttendanceHeatmapProps) {
  // Build a map of date -> count
  const countMap: Record<string, number> = {};
  for (const d of data) {
    countMap[d.date] = d.count;
  }

  // Generate grid: 7 rows (days) x N columns (weeks)
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1));
  // Align to Sunday
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const grid: { date: string; count: number }[][] = [];
  const current = new Date(startDate);

  for (let w = 0; w < weeks; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0];
      week.push({ date: dateStr, count: countMap[dateStr] || 0 });
      current.setDate(current.getDate() + 1);
    }
    grid.push(week);
  }

  return (
    <View style={styles.container}>
      {/* Day labels */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.dayLabel}>{i % 2 === 1 ? label : ''}</Text>
        ))}
      </View>
      {/* Grid */}
      <View style={styles.grid}>
        {grid.map((week, wi) => (
          <View key={wi} style={styles.weekColumn}>
            {week.map((day, di) => (
              <View
                key={di}
                style={[
                  styles.cell,
                  { backgroundColor: getCellColor(day.count) },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const CELL_SIZE = 10;
const CELL_GAP = 2;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  dayLabels: {
    marginRight: spacing.xs,
    justifyContent: 'space-around',
  },
  dayLabel: {
    fontFamily: fontFamily.statMono,
    fontSize: 7,
    color: colors.textSecondary,
    height: CELL_SIZE + CELL_GAP,
    lineHeight: CELL_SIZE + CELL_GAP,
  },
  grid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  weekColumn: {
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
});
