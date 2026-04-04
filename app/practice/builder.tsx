import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, SET_CATEGORIES, type Group, type SetCategory } from '../../src/config/constants';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { addPracticePlan, updatePracticePlan } from '../../src/services/practicePlans';
import SetBlock from '../../src/components/SetBlock';

export default function PracticeBuilderScreen() {
  const { coach } = useAuth();
  const params = useLocalSearchParams<{ planId?: string }>();
  const [saving, setSaving] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const store = usePracticeStore();
  const totalYardage = store.totalYardage();

  const handleSave = async () => {
    if (!coach || !store.title.trim()) {
      Alert.alert('Missing Title', 'Please enter a practice title.');
      return;
    }
    setSaving(true);
    try {
      const planData = store.toPlan(coach.uid, coach.displayName || 'Coach');
      if (params.planId) {
        await updatePracticePlan(params.planId, planData);
      } else {
        await addPracticePlan(planData, coach.uid);
      }
      store.reset();
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const handleAddSet = (category: SetCategory) => {
    store.addSet(category);
    setShowCategoryPicker(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { store.reset(); router.back(); }}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <View style={styles.yardageBug}>
          <Text style={styles.yardageNum}>{totalYardage}</Text>
          <Text style={styles.yardageLabel}>YARDS</Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
            {saving ? 'SAVING...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={store.title}
          onChangeText={store.setTitle}
          placeholder="PRACTICE TITLE"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
        />

        {/* Description */}
        <TextInput
          style={styles.descInput}
          value={store.description}
          onChangeText={store.setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        {/* Group + Template Toggle */}
        <View style={styles.metaRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChips}>
            <TouchableOpacity
              style={[styles.groupChip, !store.group && styles.groupChipActive]}
              onPress={() => store.setGroup(null)}
            >
              <Text style={[styles.groupChipText, !store.group && styles.groupChipTextActive]}>All</Text>
            </TouchableOpacity>
            {GROUPS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.groupChip, store.group === g && styles.groupChipActive]}
                onPress={() => store.setGroup(g)}
              >
                <Text style={[styles.groupChipText, store.group === g && styles.groupChipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, store.isTemplate && styles.toggleBtnActive]}
            onPress={() => store.setIsTemplate(!store.isTemplate)}
          >
            <Text style={[styles.toggleBtnText, store.isTemplate && styles.toggleBtnTextActive]}>
              {store.isTemplate ? 'TEMPLATE ✓' : 'SAVE AS TEMPLATE'}
            </Text>
          </TouchableOpacity>
          {store.canUndo() && (
            <TouchableOpacity style={styles.undoBtn} onPress={store.undo}>
              <Text style={styles.undoBtnText}>UNDO</Text>
            </TouchableOpacity>
          )}
          {store.canRedo() && (
            <TouchableOpacity style={styles.undoBtn} onPress={store.redo}>
              <Text style={styles.undoBtnText}>REDO</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sets */}
        {store.sets.map((set, i) => (
          <SetBlock
            key={i}
            set={set}
            setIndex={i}
            onUpdateName={(name) => store.updateSetName(i, name)}
            onUpdateDescription={(desc) => store.updateSetDescription(i, desc)}
            onAddItem={() => store.addItem(i)}
            onRemoveItem={(itemIndex) => store.removeItem(i, itemIndex)}
            onUpdateItem={(itemIndex, data) => store.updateItem(i, itemIndex, data)}
            onMoveUp={() => i > 0 && store.reorderSets(i, i - 1)}
            onMoveDown={() => i < store.sets.length - 1 && store.reorderSets(i, i + 1)}
            onDelete={() => {
              Alert.alert('Delete Set', `Delete "${set.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => store.removeSet(i) },
              ]);
            }}
            isFirst={i === 0}
            isLast={i === store.sets.length - 1}
          />
        ))}

        {/* Add Set */}
        {showCategoryPicker ? (
          <View style={styles.categoryPicker}>
            <Text style={styles.categoryPickerTitle}>ADD SET</Text>
            {SET_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryOption}
                onPress={() => handleAddSet(cat)}
              >
                <Text style={styles.categoryOptionText}>{cat}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.categoryCancel} onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.categoryCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addSetBtn} onPress={() => setShowCategoryPicker(true)}>
            <Text style={styles.addSetText}>+ ADD SET</Text>
          </TouchableOpacity>
        )}

        {/* Quick Add Buttons */}
        {store.sets.length === 0 && (
          <View style={styles.quickStart}>
            <Text style={styles.quickStartTitle}>QUICK START</Text>
            <Text style={styles.quickStartSub}>Tap to add a standard practice structure</Text>
            <TouchableOpacity
              style={styles.quickStartBtn}
              onPress={() => {
                store.addSet('Warmup');
                store.addSet('Pre-Set');
                store.addSet('Main Set');
                store.addSet('Cooldown');
              }}
            >
              <Text style={styles.quickStartBtnText}>WARMUP → PRE-SET → MAIN → COOLDOWN</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.bgDeep, borderBottomWidth: 2, borderBottomColor: colors.purple },
  cancelText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  yardageBug: { alignItems: 'center' },
  yardageNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  yardageLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  saveText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent, letterSpacing: 1 },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  // Title
  titleInput: { fontFamily: fontFamily.heading, fontSize: 26, color: colors.text, backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, letterSpacing: 1 },
  descInput: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text, backgroundColor: colors.bgDeep, borderRadius: borderRadius.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, minHeight: 44 },
  // Meta
  metaRow: { marginBottom: spacing.sm },
  groupChips: { gap: spacing.xs },
  groupChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  groupChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  groupChipTextActive: { color: colors.text },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  toggleBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  toggleBtnActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  toggleBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  toggleBtnTextActive: { color: colors.text },
  undoBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
  undoBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.accent, letterSpacing: 1 },
  // Add Set
  addSetBtn: { padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.purple, borderStyle: 'dashed', alignItems: 'center', marginBottom: spacing.lg },
  addSetText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.accent, letterSpacing: 1 },
  // Category Picker
  categoryPicker: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  categoryPickerTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, letterSpacing: 1, marginBottom: spacing.md },
  categoryOption: { padding: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.bgSurface, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  categoryOptionText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, textAlign: 'center' },
  categoryCancel: { padding: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  categoryCancelText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  // Quick Start
  quickStart: { alignItems: 'center', paddingVertical: spacing.xxxl },
  quickStartTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, marginBottom: spacing.xs },
  quickStartSub: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  quickStartBtn: { backgroundColor: colors.purple, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  quickStartBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text, letterSpacing: 1 },
});
