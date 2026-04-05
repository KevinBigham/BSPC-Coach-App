import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Video as VideoIcon } from 'lucide-react-native';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import VideoComparison from '../../src/components/VideoComparison';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';

export default function VideoCompareScreen() {
  const { swimmerId: paramSwimmerId } = useLocalSearchParams<{ swimmerId?: string }>();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [selectedSwimmerId, setSelectedSwimmerId] = useState<string | null>(paramSwimmerId ?? null);

  const selectedSwimmer = swimmers.find((s) => s.id === selectedSwimmerId);

  if (Platform.OS === 'web') {
    return (
      <>
        <Stack.Screen options={{ title: 'COMPARE VIDEO' }} />
        <View style={styles.container}>
          <View style={styles.placeholder}>
            <VideoIcon size={32} color={colors.textSecondary} />
            <Text style={styles.placeholderText}>
              Video comparison is available on the mobile app
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'COMPARE VIDEO' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <VideoIcon size={20} color={colors.gold} style={{ marginBottom: spacing.xs }} />
          <Text style={styles.pixelLabel}>VIDEO ANALYSIS</Text>
          <Text style={styles.heading}>COMPARE TECHNIQUE</Text>
          <Text style={styles.subtext}>
            Compare AI observations across video sessions to track technique progression
          </Text>
        </View>

        {/* Swimmer Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SWIMMER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            <View style={styles.chipRow}>
              {swimmers.map((sw) => {
                const isActive = sw.id === selectedSwimmerId;
                return (
                  <TouchableOpacity
                    key={sw.id}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setSelectedSwimmerId(sw.id ?? null)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {sw.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Comparison Area */}
        <View style={styles.section}>
          {!selectedSwimmerId ? (
            <View style={styles.placeholder}>
              <VideoIcon size={32} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>Select a swimmer to compare video sessions</Text>
            </View>
          ) : (
            <VideoComparison swimmerId={selectedSwimmerId} />
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { marginBottom: spacing.xl },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  heading: {
    fontFamily: fontFamily.heading,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  chipScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: fontFamily.bodyMed,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  placeholder: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  placeholderText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
