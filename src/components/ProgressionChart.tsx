import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';

export interface ProgressionDataPoint {
  date: string; // display label (e.g., "Jan 12")
  time: number; // hundredths of seconds
  eventName: string;
}

interface ProgressionChartProps {
  data: ProgressionDataPoint[];
  title?: string;
}

function formatTime(hundredths: number): string {
  const totalSeconds = hundredths / 100;
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return totalSeconds.toFixed(2);
}

export default function ProgressionChart({ data, title }: ProgressionChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No progression data available</Text>
      </View>
    );
  }

  const times = data.map((d) => d.time);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const range = maxTime - minTime || 1;

  // Determine trend: is the most recent time better (lower) than the earliest?
  const firstTime = data[0].time;
  const lastTime = data[data.length - 1].time;
  const improved = lastTime < firstTime;
  const dropAmount = firstTime - lastTime;

  const BAR_MAX_HEIGHT = 120;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Trend summary */}
      <View style={styles.trendRow}>
        <Text style={[styles.trendLabel, { color: improved ? colors.success : colors.error }]}>
          {improved ? 'IMPROVED' : lastTime === firstTime ? 'NO CHANGE' : 'SLOWER'}
        </Text>
        {dropAmount !== 0 && (
          <Text style={[styles.trendValue, { color: improved ? colors.success : colors.error }]}>
            {improved ? '-' : '+'}
            {formatTime(Math.abs(dropAmount))}
          </Text>
        )}
      </View>

      {/* Bar chart */}
      <View style={styles.chartArea}>
        <View style={styles.barsRow}>
          {data.map((point, idx) => {
            // Invert: lower time = taller bar (better performance)
            const normalized = 1 - (point.time - minTime) / range;
            const barHeight = Math.max(BAR_MAX_HEIGHT * (0.2 + normalized * 0.8), 12);
            const isLast = idx === data.length - 1;
            const isBest = point.time === minTime;

            return (
              <View
                key={`${point.date}-${idx}`}
                style={styles.barColumn}
                testID={`progression-bar-${idx}`}
              >
                <Text style={styles.barTime}>{formatTime(point.time)}</Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isBest
                        ? colors.gold
                        : isLast
                          ? colors.accent
                          : colors.purpleLight,
                    },
                  ]}
                />
                <Text style={styles.barDate} numberOfLines={1}>
                  {point.date}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Best / Latest */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>BEST</Text>
          <Text style={styles.statValue}>{formatTime(minTime)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>LATEST</Text>
          <Text style={styles.statValue}>{formatTime(lastTime)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>ENTRIES</Text>
          <Text style={styles.statValue}>{data.length}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  empty: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  trendLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    letterSpacing: 1,
  },
  trendValue: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
  },
  chartArea: {
    marginBottom: spacing.lg,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: spacing.xs,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 60,
  },
  barTime: {
    fontFamily: fontFamily.statMono,
    fontSize: 8,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  bar: {
    width: '80%',
    borderRadius: borderRadius.sm,
    minHeight: 12,
  },
  barDate: {
    fontFamily: fontFamily.body,
    fontSize: 8,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  statBlock: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  statValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.md,
    color: colors.text,
  },
});
