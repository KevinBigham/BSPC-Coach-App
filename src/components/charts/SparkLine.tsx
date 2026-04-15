import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../config/theme';

interface SparkLineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** If true, lower values = better (e.g., swim times) */
  invertTrend?: boolean;
}

/**
 * A simple sparkline using View-based dots connected conceptually.
 * Renders a series of dots at proportional heights.
 */
export default function SparkLine({
  data,
  width = 100,
  height = 32,
  color = colors.accent,
  invertTrend = false,
}: SparkLineProps) {
  if (data.length === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pointCount = data.length;
  const lastValue = data[pointCount - 1];
  const lastNormalized = (lastValue - min) / range;
  const lastY = invertTrend ? 1 - lastNormalized : lastNormalized;

  return (
    <View testID="spark-line" style={[styles.container, { width, height }]}>
      {data.map((value, i) => {
        const normalized = (value - min) / range;
        // If inverted (times), lower = better = higher position
        const y = invertTrend ? 1 - normalized : normalized;
        const dotBottom = y * (height - 6);
        const left = pointCount === 1 ? (width - 6) / 2 : (i / (pointCount - 1)) * (width - 6);

        return (
          <View
            key={i}
            testID={`spark-dot-${i}`}
            style={[
              styles.dot,
              {
                left,
                bottom: dotBottom,
                backgroundColor: color,
              },
            ]}
          />
        );
      })}
      {/* Trend line approximation using a thin bar at the average */}
      <View
        style={[
          styles.trendLine,
          {
            backgroundColor: color,
            opacity: 0.2,
            bottom: lastY * (height - 6),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trendLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
});
