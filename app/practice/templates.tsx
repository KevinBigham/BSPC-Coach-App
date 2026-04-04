import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { subscribePracticePlans, calculateTotalYardage } from '../../src/services/practicePlans';
import { usePracticeStore } from '../../src/stores/practiceStore';
import type { PracticePlan } from '../../src/types/firestore.types';

type PlanWithId = PracticePlan & { id: string };

export default function TemplatesScreen() {
  const { coach } = useAuth();
  const [templates, setTemplates] = useState<PlanWithId[]>([]);
  const [filterGroup, setFilterGroup] = useState<Group | 'All'>('All');
  const store = usePracticeStore();

  useEffect(() => {
    return subscribePracticePlans(setTemplates, { isTemplate: true, max: 50 });
  }, []);

  const filtered = filterGroup === 'All'
    ? templates
    : templates.filter((t) => t.group === filterGroup);

  const handleUseTemplate = (template: PlanWithId) => {
    store.loadPlan(template);
    store.setIsTemplate(false);
    store.setTitle(`${template.title} — ${new Date().toLocaleDateString()}`);
    router.replace('/practice/builder');
  };

  const renderTemplate = ({ item }: { item: PlanWithId }) => {
    const yardage = calculateTotalYardage(item.sets);
    const setCount = item.sets.length;

    return (
      <TouchableOpacity style={styles.card} onPress={() => handleUseTemplate(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.group && (
            <View style={[styles.groupBadge, { borderColor: groupColors[item.group] || colors.textSecondary }]}>
              <Text style={[styles.groupBadgeText, { color: groupColors[item.group] || colors.textSecondary }]}>
                {item.group}
              </Text>
            </View>
          )}
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatNum}>{yardage}</Text>
            <Text style={styles.cardStatLabel}>YARDS</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatNum}>{setCount}</Text>
            <Text style={styles.cardStatLabel}>SETS</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatNum}>
              {item.sets.reduce((sum, s) => sum + s.items.length, 0)}
            </Text>
            <Text style={styles.cardStatLabel}>ITEMS</Text>
          </View>
        </View>
        <View style={styles.cardSetList}>
          {item.sets.map((s, i) => (
            <Text key={i} style={styles.cardSetName} numberOfLines={1}>
              {s.category}: {s.name}
            </Text>
          ))}
        </View>
        <Text style={styles.useHint}>TAP TO USE</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Group Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['All' as const, ...GROUPS]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: group }) => (
          <TouchableOpacity
            style={[styles.filterChip, filterGroup === group && styles.filterChipActive]}
            onPress={() => setFilterGroup(group)}
          >
            <Text style={[styles.filterChipText, filterGroup === group && styles.filterChipTextActive]}>
              {group}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO TEMPLATES</Text>
            <Text style={styles.emptySubtitle}>Save practices as templates to reuse them</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Filter
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  filterChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  filterChipTextActive: { color: colors.text },
  // List
  list: { padding: spacing.lg, paddingBottom: 100 },
  // Card
  card: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  cardTitle: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, flex: 1 },
  groupBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  groupBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  cardDesc: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  cardStats: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  cardStat: { alignItems: 'center' },
  cardStatNum: { fontFamily: fontFamily.stat, fontSize: fontSize.lg, color: colors.accent },
  cardStatLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  cardSetList: { gap: 2 },
  cardSetName: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  useHint: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.accent, letterSpacing: 1, textAlign: 'center', marginTop: spacing.sm },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
});
