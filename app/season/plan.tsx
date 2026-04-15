import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Save, Trash2, Plus, ChevronDown } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSeasonStore } from '../../src/stores/seasonStore';
import { SeasonTimeline } from '../../src/components/SeasonTimeline';
import { generateWeekPlans, calculateSeasonYardage } from '../../src/services/seasonPlanning';
import { GROUPS } from '../../src/config/constants';
import type { SeasonPhase, SeasonPhaseType } from '../../src/types/firestore.types';
import type { Group } from '../../src/config/constants';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

const PHASE_TYPES: { value: SeasonPhaseType; label: string }[] = [
  { value: 'base', label: 'Base Training' },
  { value: 'build1', label: 'Build Phase I' },
  { value: 'build2', label: 'Build Phase II' },
  { value: 'peak', label: 'Peak Training' },
  { value: 'taper', label: 'Taper' },
  { value: 'race', label: 'Championship' },
  { value: 'recovery', label: 'Recovery' },
];

const DEFAULT_PHASE: SeasonPhase = {
  name: '',
  type: 'base',
  startDate: '',
  endDate: '',
  weeklyYardage: 0,
  focusAreas: [],
};

function SeasonPlanScreen() {
  const { user } = useAuth();
  const { activePlan, create, update, remove } = useSeasonStore();
  const isEditing = !!activePlan;

  const [name, setName] = useState(activePlan?.name ?? '');
  const [group, setGroup] = useState<Group>(activePlan?.group ?? 'Gold');
  const [startDate, setStartDate] = useState(activePlan?.startDate ?? '');
  const [endDate, setEndDate] = useState(activePlan?.endDate ?? '');
  const [phases, setPhases] = useState<SeasonPhase[]>(activePlan?.phases ?? []);

  const addPhase = () => {
    setPhases([...phases, { ...DEFAULT_PHASE }]);
  };

  const updatePhase = (index: number, updates: Partial<SeasonPhase>) => {
    const updated = [...phases];
    updated[index] = { ...updated[index], ...updates };
    setPhases(updated);
  };

  const removePhase = (index: number) => {
    setPhases(phases.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !name || !startDate || !endDate) return;

    const totalWeeks = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    const plan = {
      name,
      group,
      startDate,
      endDate,
      phases,
      totalWeeks,
      coachId: user.uid,
      coachName: user.displayName || user.email || 'Coach',
    };

    if (isEditing && activePlan) {
      await update(activePlan.id, plan);
    } else {
      await create(plan);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!activePlan) return;
    Alert.alert('Delete Season Plan', `Delete "${activePlan.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove(activePlan.id);
          router.back();
        },
      },
    ]);
  };

  const totalYardage = calculateSeasonYardage(phases);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>
          {isEditing ? 'EDIT SEASON PLAN' : 'NEW SEASON PLAN'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Plan Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. 2026 Short Course Season"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Group</Text>
          <View style={styles.groupRow}>
            {GROUPS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.groupChip, group === g && styles.groupChipActive]}
                onPress={() => setGroup(g)}
              >
                <Text style={[styles.groupChipText, group === g && styles.groupChipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        {phases.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>TIMELINE PREVIEW</Text>
            <SeasonTimeline phases={phases} />
            <Text style={styles.totalYardage}>
              Total season yardage: {(totalYardage / 1000).toFixed(0)}k
            </Text>
          </View>
        )}

        {/* Phases */}
        <View style={styles.phasesSection}>
          <Text style={styles.sectionTitle}>PHASES</Text>
          {phases.map((phase, index) => (
            <View key={index} style={styles.phaseCard}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseNumber}>Phase {index + 1}</Text>
                <TouchableOpacity onPress={() => removePhase(index)}>
                  <Trash2 size={18} color={colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.typeRow}>
                    {PHASE_TYPES.map((pt) => (
                      <TouchableOpacity
                        key={pt.value}
                        style={[styles.typeChip, phase.type === pt.value && styles.typeChipActive]}
                        onPress={() => updatePhase(index, { type: pt.value })}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            phase.type === pt.value && styles.typeChipTextActive,
                          ]}
                        >
                          {pt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>Start</Text>
                  <TextInput
                    style={styles.input}
                    value={phase.startDate}
                    onChangeText={(v) => updatePhase(index, { startDate: v })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.label}>End</Text>
                  <TextInput
                    style={styles.input}
                    value={phase.endDate}
                    onChangeText={(v) => updatePhase(index, { endDate: v })}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Weekly Yardage</Text>
                <TextInput
                  style={styles.input}
                  value={phase.weeklyYardage ? String(phase.weeklyYardage) : ''}
                  onChangeText={(v) => updatePhase(index, { weeklyYardage: parseInt(v) || 0 })}
                  keyboardType="numeric"
                  placeholder="e.g. 25000"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addPhaseButton} onPress={addPhase}>
            <Plus size={18} color={colors.accent} />
            <Text style={styles.addPhaseText}>Add Phase</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 size={18} color={colors.error} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save size={18} color={colors.bgBase} />
          <Text style={styles.saveText}>{isEditing ? 'Update' : 'Create'} Plan</Text>
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
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  groupChipText: {
    fontFamily: fontFamily.headingMd,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  groupChipTextActive: {
    color: colors.bgBase,
  },
  preview: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 8,
  },
  previewLabel: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  totalYardage: {
    fontFamily: fontFamily.statMono,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  phasesSection: {
    gap: spacing.md,
  },
  phaseCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseNumber: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.md,
    color: colors.accent,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeChipText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.bgBase,
  },
  addPhaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  addPhaseText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.md,
    color: colors.accent,
  },
  actionBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bgDeep,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    flex: 1,
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

export default withScreenErrorBoundary(SeasonPlanScreen, 'SeasonPlanScreen');
