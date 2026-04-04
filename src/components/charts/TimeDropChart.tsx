import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing, borderRadius } from '../../config/theme';

interface TimeDropEntry {
  label: string;
  dropPercent: number;
  dropDisplay: string;
}

interface TimeDropChartProps {
  drops: TimeDropEntry[];
  maxBars?: number;
}

export default function TimeDropChart({
  drops,
  maxBars = 8,
}: TimeDropChartProps) {
  const visible = drops.slice(0, maxBars);
  if (visible.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No time drops in this period</Text>
      </View>
    );
  }

  const maxDrop = Math.max(...visible.map((d) => d.dropPercent), 0.1);

  return (
    <View style={styles.container}>
      {visible.map((d, i) => {
        const barWidth = (d.dropPercent / maxDrop) * 100;
        return (
          <View key={i} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{d.label}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { width: `${Math.max(barWidth, 3)}%` },
                ]}
              />
            </View>
            <Text style={styles.value}>{d.dropDisplay}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.xs,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: borderRadius.xs,
  },
  value: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.gold,
    width: 50,
    textAlign: 'right',
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
