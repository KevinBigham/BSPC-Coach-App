import { useState, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, spacing, fontSize, fontFamily } from '../config/theme';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected ?? true));
    });
  }, []);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOffline ? 0 : -40,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, slideAnim]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.text}>OFFLINE MODE</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  text: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textInverse,
    letterSpacing: 1,
  },
});
