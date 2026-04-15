import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { generatePractice, type AIPracticeRequest } from '../../src/services/aiPractice';
import type { PracticePlan } from '../../src/types/firestore.types';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type Focus = AIPracticeRequest['focus'];

const FOCUS_OPTIONS: { key: Focus; label: string; desc: string }[] = [
  { key: 'endurance', label: 'ENDURANCE', desc: 'Aerobic base building' },
  { key: 'speed', label: 'SPEED', desc: 'Sprint & race pace work' },
  { key: 'technique', label: 'TECHNIQUE', desc: 'Drill-heavy, stroke refinement' },
  { key: 'recovery', label: 'RECOVERY', desc: 'Easy, low-intensity' },
  { key: 'race_prep', label: 'RACE PREP', desc: 'Meet simulation, race starts' },
  { key: 'mixed', label: 'MIXED', desc: 'Balanced all-around' },
];

const YARDAGE_PRESETS = [2000, 3000, 4000, 5000, 6000] as const;
const DURATION_PRESETS = [60, 75, 90, 105, 120] as const;

function AIGenerateScreen() {
  const { coach } = useAuth();
  const store = usePracticeStore();
  const [group, setGroup] = useState<Group>(GROUPS[0]);
  const [focus, setFocus] = useState<Focus>('mixed');
  const [targetYardage, setTargetYardage] = useState(4000);
  const [duration, setDuration] = useState(90);
  const [meetName, setMeetName] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!coach) return;
    setGenerating(true);
    try {
      const result = await generatePractice({
        group,
        focus,
        targetYardage,
        durationMinutes: duration,
        meetName: meetName || undefined,
        notes: notes || undefined,
      });

      // Load the AI-generated plan into the practice store as if it were an existing plan
      const fakePlan: PracticePlan = {
        title: result.title,
        description: result.description,
        group,
        isTemplate: false,
        coachId: coach.uid,
        coachName: coach.displayName,
        totalDuration: result.estimatedDuration,
        sets: result.sets,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.loadPlan(fakePlan);
      router.replace('/practice/builder');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not generate practice. Make sure Cloud Functions are deployed.';
      Alert.alert('Generation Failed', message);
    }
    setGenerating(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'AI GENERATE',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.pixelLabel}>AI POWERED</Text>
          <Text style={styles.heading}>GENERATE PRACTICE</Text>
          <Text style={styles.subtext}>
            Tell the AI what you need and it will create a complete practice plan
          </Text>
        </View>

        {/* Group */}
        <Text style={styles.fieldLabel}>GROUP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, group === g && styles.chipActive]}
              onPress={() => setGroup(g)}
            >
              <Text style={[styles.chipText, group === g && styles.chipTextActive]}>
                {g.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Focus */}
        <Text style={styles.fieldLabel}>FOCUS</Text>
        <View style={styles.focusGrid}>
          {FOCUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.focusCard, focus === opt.key && styles.focusCardActive]}
              onPress={() => setFocus(opt.key)}
            >
              <Text style={[styles.focusLabel, focus === opt.key && styles.focusLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.focusDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Yardage */}
        <Text style={styles.fieldLabel}>TARGET YARDAGE</Text>
        <View style={styles.presetRow}>
          {YARDAGE_PRESETS.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.presetChip, targetYardage === y && styles.presetChipActive]}
              onPress={() => setTargetYardage(y)}
            >
              <Text style={[styles.presetText, targetYardage === y && styles.presetTextActive]}>
                {y.toLocaleString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <Text style={styles.fieldLabel}>DURATION (MINUTES)</Text>
        <View style={styles.presetRow}>
          {DURATION_PRESETS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.presetChip, duration === d && styles.presetChipActive]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.presetText, duration === d && styles.presetTextActive]}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Meet */}
        <Text style={styles.fieldLabel}>UPCOMING MEET (OPTIONAL)</Text>
        <TextInput
          style={styles.textInput}
          value={meetName}
          onChangeText={setMeetName}
          placeholder="e.g. Conference Championships"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>ADDITIONAL NOTES</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any specific requests, swimmer needs, etc."
          placeholderTextColor={colors.textSecondary}
          multiline
          numberOfLines={3}
        />

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color={colors.text} size="small" />
              <Text style={styles.generateBtnText}>GENERATING...</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>GENERATE PRACTICE</Text>
          )}
        </TouchableOpacity>
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
    fontSize: 32,
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
  fieldLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.gold,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  chipRow: { flexGrow: 0, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  chipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  chipTextActive: { color: colors.accent },
  focusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  focusCard: {
    width: '48%',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  focusCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
  },
  focusLabel: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.md,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text,
    marginBottom: 2,
  },
  focusLabelActive: { color: colors.gold },
  focusDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  presetText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  presetTextActive: { color: colors.accent },
  textInput: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  generateBtn: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: { opacity: 0.6 },
  generateBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});

export default withScreenErrorBoundary(AIGenerateScreen, 'AIGenerateScreen');
