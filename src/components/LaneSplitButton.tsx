import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Animated,
} from 'react-native';
import { colors, fontFamily, fontSize, spacing, borderRadius } from '../config/theme';
import { formatSplitDisplay } from '../utils/meetTiming';

interface LaneSplitButtonProps {
  lane: number;
  swimmerName?: string;
  lastSplitTime?: number;
  splitCount: number;
  onPress: () => void;
  disabled?: boolean;
}

export default function LaneSplitButton({
  lane,
  swimmerName,
  lastSplitTime,
  splitCount,
  onPress,
  disabled,
}: LaneSplitButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.85,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
          splitCount > 0 && styles.buttonSplit,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.laneNumber}>{lane}</Text>
        {swimmerName ? (
          <Text style={styles.swimmerName} numberOfLines={1}>
            {swimmerName}
          </Text>
        ) : (
          <Text style={styles.laneLabel}>LANE {lane}</Text>
        )}
        {lastSplitTime !== undefined && (
          <Text style={styles.splitTime}>{formatSplitDisplay(lastSplitTime)}</Text>
        )}
        {splitCount > 0 && (
          <View style={styles.splitBadge}>
            <Text style={styles.splitBadgeText}>{splitCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.purple,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    position: 'relative',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonSplit: {
    backgroundColor: colors.purpleDark,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  laneNumber: {
    fontFamily: fontFamily.stat,
    fontSize: 28,
    color: colors.text,
  },
  laneLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 6,
    letterSpacing: 1,
    color: colors.gold,
    marginTop: 2,
  },
  swimmerName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.text,
    marginTop: 2,
    maxWidth: '100%',
  },
  splitTime: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.gold,
    marginTop: spacing.xs,
  },
  splitBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBadgeText: {
    fontFamily: fontFamily.stat,
    fontSize: 10,
    color: colors.bgDeep,
  },
});
