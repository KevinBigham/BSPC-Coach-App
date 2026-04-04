import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { COMMON_INTERVALS } from '../config/constants';

interface IntervalPickerProps {
  value: string;
  onChange: (interval: string) => void;
}

export default function IntervalPicker({ value, onChange }: IntervalPickerProps) {
  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="M:SS"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numbers-and-punctuation"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {COMMON_INTERVALS.map((interval) => (
          <TouchableOpacity
            key={interval}
            style={[styles.preset, value === interval && styles.presetActive]}
            onPress={() => onChange(interval)}
          >
            <Text style={[styles.presetText, value === interval && styles.presetTextActive]}>
              {interval}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.sm, padding: spacing.sm, fontSize: fontSize.md, fontFamily: fontFamily.statMono, color: colors.accent, borderWidth: 1, borderColor: colors.border, textAlign: 'center' },
  presets: { gap: spacing.xs, paddingVertical: spacing.xs },
  preset: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  presetActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  presetText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  presetTextActive: { color: colors.text },
});
