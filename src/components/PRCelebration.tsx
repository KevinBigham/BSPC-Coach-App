import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { colors, fontFamily, fontSize, spacing } from '../config/theme';
import { formatSplitDisplay } from '../utils/meetTiming';
import { notifyHeavy } from '../utils/haptics';

interface PRCelebrationProps {
  swimmerName: string;
  eventName: string;
  oldTime?: number;
  newTime: number;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONFETTI_COUNT = 24;

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const startX = (index / CONFETTI_COUNT) * SCREEN_WIDTH;
  const isPurple = index % 3 === 0;
  const isGold = index % 3 === 1;
  const color = isPurple ? colors.purple : isGold ? colors.gold : colors.accent;

  useEffect(() => {
    const delay = Math.random() * 400;
    const duration = 2000 + Math.random() * 1500;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT + 50,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: (Math.random() - 0.5) * 120,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        delay: delay + duration * 0.6,
        useNativeDriver: true,
      }),
      Animated.timing(rotation, {
        toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.confetti,
        {
          left: startX,
          backgroundColor: color,
          width: 8 + Math.random() * 6,
          height: 8 + Math.random() * 6,
          borderRadius: Math.random() > 0.5 ? 2 : 0,
          transform: [
            { translateY },
            { translateX },
            {
              rotate: rotation.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
          opacity,
        },
      ]}
    />
  );
}

export default function PRCelebration({
  swimmerName,
  eventName,
  oldTime,
  newTime,
  onDismiss,
}: PRCelebrationProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    notifyHeavy();
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const drop = oldTime ? oldTime - newTime : 0;

  return (
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onDismiss}>
      {/* Confetti */}
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}

      {/* Content */}
      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <Text style={styles.prLabel}>PERSONAL RECORD</Text>
        <Text style={styles.swimmerName}>{swimmerName.toUpperCase()}</Text>
        <Text style={styles.eventName}>{eventName}</Text>

        <View style={styles.timeBox}>
          <Text style={styles.newTime}>{formatSplitDisplay(newTime)}</Text>
        </View>

        {oldTime && drop > 0 && (
          <View style={styles.dropRow}>
            <Text style={styles.oldTime}>{formatSplitDisplay(oldTime)}</Text>
            <Text style={styles.dropArrow}>{' > '}</Text>
            <Text style={styles.dropAmount}>-{formatSplitDisplay(drop)}</Text>
          </View>
        )}

        <Text style={styles.tapHint}>TAP TO DISMISS</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confetti: {
    position: 'absolute',
    top: -20,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  prLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.gold,
    marginBottom: spacing.lg,
  },
  swimmerName: {
    fontFamily: fontFamily.heading,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  eventName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },
  timeBox: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 16,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    marginBottom: spacing.lg,
  },
  newTime: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.gold,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  oldTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  dropArrow: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  dropAmount: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.accent,
  },
  tapHint: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
});
