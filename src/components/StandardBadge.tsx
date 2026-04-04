import { View, Text, StyleSheet } from 'react-native';
import { fontSize, fontFamily, borderRadius, spacing } from '../config/theme';
import { standardColors, standardBgColors, standardBorderColors } from '../config/standardColors';
import type { StandardLevel } from '../types/firestore.types';

interface StandardBadgeProps {
  level: StandardLevel;
  size?: 'sm' | 'md' | 'lg';
}

export default function StandardBadge({ level, size = 'md' }: StandardBadgeProps) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: standardBgColors[level],
          borderColor: standardBorderColors[level],
          paddingHorizontal: isLarge ? spacing.md : isSmall ? spacing.xs : spacing.sm,
          paddingVertical: isLarge ? spacing.xs : 2,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: standardColors[level],
            fontSize: isLarge ? fontSize.sm : isSmall ? fontSize.pixel : fontSize.xs,
            fontFamily: isLarge ? fontFamily.stat : fontFamily.pixel,
          },
        ]}
      >
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    letterSpacing: 1,
  },
});
