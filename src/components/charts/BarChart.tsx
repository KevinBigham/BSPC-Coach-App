import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '../../config/theme';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  barColor?: string;
  showValues?: boolean;
  formatValue?: (v: number) => string;
}

export default function BarChart({
  data,
  height = 160,
  barColor = colors.accent,
  showValues = true,
  formatValue = (v) => v.toFixed(1),
}: BarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.chartArea, { height }]}>
        {data.map((d, i) => {
          const barHeight = (d.value / maxValue) * (height - 24);
          const color = d.color || barColor;
          return (
            <View key={i} style={styles.barColumn}>
              {showValues && (
                <Text style={styles.valueLabel}>{formatValue(d.value)}</Text>
              )}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(barHeight, 2),
                    backgroundColor: color,
                  },
                ]}
              />
              <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    maxWidth: 60,
  },
  bar: {
    width: '60%',
    borderRadius: 4,
    minWidth: 12,
  },
  valueLabel: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.accent,
    marginBottom: 2,
  },
  barLabel: {
    fontFamily: fontFamily.body,
    fontSize: 8,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
