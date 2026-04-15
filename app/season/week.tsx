import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Save, ChevronLeft, FileText } from 'lucide-react-native';
import { useSeasonStore } from '../../src/stores/seasonStore';
import type { WeekPlan, SeasonPhaseType } from '../../src/types/firestore.types';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

const PHASE_LABELS: Record<SeasonPhaseType, string> = {
  base: 'Base Training',
  build1: 'Build Phase I',
  build2: 'Build Phase II',
  peak: 'Peak Training',
  taper: 'Taper',
  race: 'Championship',
  recovery: 'Recovery',
};

function WeekDetailScreen() {
  const { weekIndex } = useLocalSearchParams<{ weekIndex: string }>();
  const { activePlan, weeks, upsertWeek } = useSeasonStore();
  const index = parseInt(weekIndex ?? '0');
  const week = weeks[index];

  const [notes, setNotes] = useState(week?.notes ?? '');
  const [actualYardage, setActualYardage] = useState(
    week?.actualYardage ? String(week.actualYardage) : '',
  );

  if (!activePlan || !week) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Week not found</Text>
      </View>
    );
  }

  const handleSave = async () => {
    await upsertWeek(activePlan.id, {
      ...week,
      notes,
      actualYardage: parseInt(actualYardage) || undefined,
    });
    router.back();
  };

  const yardagePercent =
    week.targetYardage > 0 && week.actualYardage
      ? Math.round((week.actualYardage / week.targetYardage) * 100)
      : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.weekTitle}>Week {week.weekNumber}</Text>
          <Text style={styles.phaseTag}>{PHASE_LABELS[week.phase]}</Text>
        </View>

        <Text style={styles.dateRange}>
          {week.startDate} to {week.endDate}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{(week.targetYardage / 1000).toFixed(0)}k</Text>
            <Text style={styles.statLabel}>TARGET</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{week.practiceCount}</Text>
            <Text style={styles.statLabel}>PRACTICES</Text>
          </View>
          {yardagePercent !== null && (
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{yardagePercent}%</Text>
              <Text style={styles.statLabel}>COMPLETED</Text>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Actual Yardage</Text>
          <TextInput
            style={styles.input}
            value={actualYardage}
            onChangeText={setActualYardage}
            keyboardType="numeric"
            placeholder="Enter actual yardage"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholder="Week notes, adjustments, observations..."
            placeholderTextColor={colors.textSecondary}
            textAlignVertical="top"
          />
        </View>

        {week.practicePlanIds.length > 0 && (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>LINKED PRACTICES</Text>
            {week.practicePlanIds.map((id) => (
              <View key={id} style={styles.planLink}>
                <FileText size={14} color={colors.textSecondary} />
                <Text style={styles.planLinkText}>{id}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save size={18} color={colors.bgBase} />
          <Text style={styles.saveText}>Save Week</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
  },
  phaseTag: {
    fontFamily: fontFamily.headingMd,
    fontSize: fontSize.sm,
    color: colors.accent,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  dateRange: {
    fontFamily: fontFamily.statMono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fontFamily.headingMd,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fontFamily.headingMd,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multilineInput: {
    minHeight: 100,
  },
  plansSection: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.md,
    color: colors.text,
  },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.md,
  },
  planLinkText: {
    fontFamily: fontFamily.statMono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 64,
  },
  actionBar: {
    padding: spacing.md,
    backgroundColor: colors.bgDeep,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
  },
  saveText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.bgBase,
  },
});

export default withScreenErrorBoundary(WeekDetailScreen, 'WeekDetailScreen');
