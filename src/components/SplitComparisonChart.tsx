import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';

export interface RaceData {
  name: string;
  splits: number[]; // hundredths per split
  totalTime: number; // hundredths
}

interface SplitComparisonChartProps {
  races: RaceData[];
}

const SPLIT_COLORS = [colors.accent, colors.gold, colors.purpleLight];

function formatTime(hundredths: number): string {
  const totalSeconds = hundredths / 100;
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = (totalSeconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return totalSeconds.toFixed(2);
}

export default function SplitComparisonChart({ races }: SplitComparisonChartProps) {
  if (!races || races.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No race data to compare</Text>
      </View>
    );
  }

  const maxSplits = Math.max(...races.map((r) => r.splits.length));
  const maxSplitValue = Math.max(...races.flatMap((r) => r.splits));

  if (maxSplitValue === 0 || maxSplits === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No split data available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        {races.map((race, i) => (
          <View key={race.name} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] }]}
            />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {race.name}
            </Text>
            <Text style={styles.legendTime}>{formatTime(race.totalTime)}</Text>
          </View>
        ))}
      </View>

      {/* Split rows */}
      {Array.from({ length: maxSplits }, (_, splitIdx) => (
        <View key={splitIdx} style={styles.splitRow}>
          <Text style={styles.splitLabel}>Split {splitIdx + 1}</Text>
          <View style={styles.barsContainer}>
            {races.map((race, raceIdx) => {
              const splitVal = race.splits[splitIdx];
              if (splitVal == null) return null;
              const widthPct = (splitVal / maxSplitValue) * 100;
              return (
                <View key={race.name} style={styles.barRow}>
                  <View
                    style={[
                      styles.bar,
                      {
                        width: `${Math.max(widthPct, 5)}%`,
                        backgroundColor: SPLIT_COLORS[raceIdx % SPLIT_COLORS.length],
                      },
                    ]}
                    testID={`split-bar-${splitIdx}-${raceIdx}`}
                  />
                  <Text style={styles.barLabel}>{formatTime(splitVal)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
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
  legend: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
  },
  legendLabel: {
    fontFamily: fontFamily.bodyMed,
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  legendTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  splitRow: {
    marginBottom: spacing.md,
  },
  splitLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  barsContainer: {
    gap: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bar: {
    height: 18,
    borderRadius: borderRadius.sm,
    minWidth: 20,
  },
  barLabel: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.text,
  },
});
