import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../config/theme';

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeleton, { width, height, borderRadius, opacity }, style]} />
  );
}

/** Common skeleton patterns for reuse across screens */
export function SkeletonLine({ width = '100%' }: { width?: number | string }) {
  return <Skeleton width={width} height={14} borderRadius={4} style={styles.line} />;
}

export function SkeletonCard() {
  return (
    <Animated.View style={styles.card}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <Animated.View style={styles.cardContent}>
        <SkeletonLine width="60%" />
        <SkeletonLine width="40%" />
      </Animated.View>
    </Animated.View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.bgElevated,
  },
  line: {
    marginVertical: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cardContent: {
    flex: 1,
  },
});
