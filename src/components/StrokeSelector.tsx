import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { BUILDER_STROKES, type BuilderStroke } from '../config/constants';

interface StrokeSelectorProps {
  selected: string;
  onSelect: (stroke: string) => void;
}

export default function StrokeSelector({ selected, onSelect }: StrokeSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {BUILDER_STROKES.map((stroke) => (
        <TouchableOpacity
          key={stroke}
          style={[styles.pill, selected === stroke && styles.pillActive]}
          onPress={() => onSelect(stroke)}
        >
          <Text style={[styles.pillText, selected === stroke && styles.pillTextActive]}>
            {stroke}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingVertical: spacing.xs },
  pill: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  pillText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  pillTextActive: { color: colors.text },
});
