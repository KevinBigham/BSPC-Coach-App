import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { COMMON_DISTANCES } from '../config/constants';
import type { PracticePlanItem } from '../types/firestore.types';
import StrokeSelector from './StrokeSelector';
import IntervalPicker from './IntervalPicker';

interface SetItemRowProps {
  item: PracticePlanItem;
  index: number;
  onUpdate: (data: Partial<PracticePlanItem>) => void;
  onDelete: () => void;
}

export default function SetItemRow({ item, index, onUpdate, onDelete }: SetItemRowProps) {
  const [editing, setEditing] = useState(false);
  const yardage = item.reps * item.distance;

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={() => setEditing(true)} onLongPress={onDelete}>
        <Text style={styles.index}>{index + 1}</Text>
        <View style={styles.main}>
          <Text style={styles.summary}>
            {item.reps > 1 ? `${item.reps}×` : ''}{item.distance} {item.stroke}
            {item.interval ? ` @ ${item.interval}` : ''}
          </Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
          ) : null}
        </View>
        <Text style={styles.yardage}>{yardage}</Text>
      </TouchableOpacity>

      {editing && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>EDIT ITEM</Text>

              {/* Reps × Distance */}
              <View style={styles.repsDistRow}>
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>REPS</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => onUpdate({ reps: Math.max(1, item.reps - 1) })}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{item.reps}</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => onUpdate({ reps: item.reps + 1 })}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.times}>×</Text>

                <View style={[styles.fieldCol, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>DISTANCE</Text>
                  <View style={styles.distRow}>
                    {COMMON_DISTANCES.slice(0, 6).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.distChip, item.distance === d && styles.distChipActive]}
                        onPress={() => onUpdate({ distance: d })}
                      >
                        <Text style={[styles.distChipText, item.distance === d && styles.distChipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.distRow}>
                    {COMMON_DISTANCES.slice(6).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.distChip, item.distance === d && styles.distChipActive]}
                        onPress={() => onUpdate({ distance: d })}
                      >
                        <Text style={[styles.distChipText, item.distance === d && styles.distChipTextActive]}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Stroke */}
              <Text style={styles.fieldLabel}>STROKE</Text>
              <StrokeSelector selected={item.stroke} onSelect={(stroke) => onUpdate({ stroke })} />

              {/* Interval */}
              <Text style={styles.fieldLabel}>INTERVAL</Text>
              <IntervalPicker value={item.interval || ''} onChange={(interval) => onUpdate({ interval })} />

              {/* Description */}
              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={styles.notesInput}
                value={item.description || ''}
                onChangeText={(description) => onUpdate({ description })}
                placeholder="e.g., Build by 25"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Yardage display */}
              <View style={styles.yardageBar}>
                <Text style={styles.yardageLabel}>YARDAGE</Text>
                <Text style={styles.yardageValue}>{item.reps * item.distance}</Text>
              </View>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => { onDelete(); setEditing(false); }}>
                  <Text style={styles.deleteBtnText}>DELETE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.doneBtnText}>DONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  index: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary, width: 20 },
  main: { flex: 1 },
  summary: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  desc: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  yardage: { fontFamily: fontFamily.statMono, fontSize: fontSize.sm, color: colors.accent, marginLeft: spacing.sm },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.bgElevated, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.xl, paddingBottom: spacing.xxxl },
  modalTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.text, letterSpacing: 1, marginBottom: spacing.lg },
  fieldLabel: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.xs },
  // Reps × Distance
  repsDistRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  fieldCol: { alignItems: 'center' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.accent },
  stepValue: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.text, minWidth: 30, textAlign: 'center' },
  times: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.textSecondary, marginTop: 24 },
  distRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  distChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.xs, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  distChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  distChipText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  distChipTextActive: { color: colors.text },
  // Notes
  notesInput: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, fontFamily: fontFamily.body, color: colors.text, borderWidth: 1, borderColor: colors.border },
  // Yardage
  yardageBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgDeep, borderRadius: borderRadius.sm, padding: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  yardageLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  yardageValue: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  // Actions
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  deleteBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
  deleteBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.error },
  doneBtn: { flex: 2, padding: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.purple, alignItems: 'center' },
  doneBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
});
