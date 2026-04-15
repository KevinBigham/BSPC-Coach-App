import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import type { PracticePlanSet, PracticePlanItem } from '../types/firestore.types';
import SetItemRow from './SetItemRow';
import { tapLight } from '../utils/haptics';

const CATEGORY_COLORS: Record<string, string> = {
  Warmup: colors.info,
  'Pre-Set': colors.accent,
  'Main Set': colors.gold,
  Cooldown: colors.purpleLight,
};

interface SetBlockProps {
  set: PracticePlanSet;
  setIndex: number;
  onUpdateName: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemIndex: number) => void;
  onUpdateItem: (itemIndex: number, data: Partial<PracticePlanItem>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function SetBlock({
  set,
  setIndex,
  onUpdateName,
  onUpdateDescription,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst,
  isLast,
}: SetBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const yardage = set.items.reduce((sum, item) => sum + item.reps * item.distance, 0);
  const categoryColor = CATEGORY_COLORS[set.category] || colors.accent;

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed(!collapsed)}
        onLongPress={onDelete}
      >
        <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        <View style={styles.headerInfo}>
          <TextInput
            style={styles.setName}
            value={set.name}
            onChangeText={onUpdateName}
            placeholder="Set name"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.categoryLabel}>{set.category}</Text>
        </View>
        <Text style={styles.yardage}>{yardage}</Text>
        <View style={styles.moveButtons}>
          {!isFirst && (
            <TouchableOpacity style={styles.moveBtn} onPress={onMoveUp}>
              <Text style={styles.moveBtnText}>▲</Text>
            </TouchableOpacity>
          )}
          {!isLast && (
            <TouchableOpacity style={styles.moveBtn} onPress={onMoveDown}>
              <Text style={styles.moveBtnText}>▼</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.chevron}>{collapsed ? '▸' : '▾'}</Text>
      </TouchableOpacity>

      {/* Items */}
      {!collapsed && (
        <View style={styles.itemsContainer}>
          {set.items.map((item, i) => (
            <SetItemRow
              key={i}
              item={item}
              index={i}
              onUpdate={(data) => onUpdateItem(i, data)}
              onDelete={() => {
                tapLight();
                onRemoveItem(i);
              }}
            />
          ))}
          <TouchableOpacity
            style={styles.addItemBtn}
            onPress={() => {
              tapLight();
              onAddItem();
            }}
          >
            <Text style={styles.addItemText}>+ ADD ITEM</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bgSurface,
  },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  headerInfo: { flex: 1 },
  setName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    padding: 0,
  },
  categoryLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  yardage: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.lg,
    color: colors.accent,
    marginHorizontal: spacing.sm,
  },
  moveButtons: { gap: 2 },
  moveBtn: { padding: 2 },
  moveBtnText: { fontSize: 10, color: colors.textSecondary },
  chevron: { fontSize: fontSize.md, color: colors.textSecondary, marginLeft: spacing.xs },
  // Items
  itemsContainer: { borderTopWidth: 1, borderTopColor: colors.border },
  addItemBtn: { padding: spacing.md, alignItems: 'center' },
  addItemText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
    letterSpacing: 1,
  },
});
