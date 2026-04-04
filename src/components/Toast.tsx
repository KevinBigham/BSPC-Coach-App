import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

const TYPE_COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: 'rgba(204, 176, 0, 0.15)', border: colors.gold, text: colors.gold },
  error: { bg: 'rgba(244, 63, 94, 0.15)', border: colors.error, text: colors.error },
  info: { bg: 'rgba(179, 136, 255, 0.15)', border: colors.accent, text: colors.accent },
};

export default function Toast({ message, type, visible, onDismiss, duration = 3000 }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 250 });
      opacity.value = withTiming(1, { duration: 250 });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 250 });
        opacity.value = withDelay(0, withTiming(0, { duration: 250 }));
        setTimeout(() => runOnJS(onDismiss)(), 300);
      }, duration);
    } else {
      translateY.value = -100;
      opacity.value = 0;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const scheme = TYPE_COLORS[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.sm },
        { backgroundColor: scheme.bg, borderColor: scheme.border },
        animStyle,
      ]}
      pointerEvents="none"
    >
      <View style={[styles.bar, { backgroundColor: scheme.border }]} />
      <Text style={[styles.message, { color: scheme.text }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  bar: {
    width: 3,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  message: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    flex: 1,
    marginLeft: spacing.sm,
  },
});
