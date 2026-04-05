import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { subscribeSwimmers, updateSwimmer } from '../../src/services/swimmers';
import { exportRosterCSV, shareCSV } from '../../src/services/export';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import type { Swimmer } from '../../src/types/firestore.types';

type SortOption = 'az' | 'za' | 'group' | 'newest';
const SORT_LABELS: Record<SortOption, string> = {
  az: 'A-Z',
  za: 'Z-A',
  group: 'Group',
  newest: 'Newest',
};

export default function RosterScreen() {
  const params = useLocalSearchParams<{ group?: string }>();
  const { isAdmin } = useAuth();
  const activeSwimmers = useSwimmersStore((s) => s.swimmers);
  const [inactiveSwimmers, setInactiveSwimmers] = useState<(Swimmer & { id: string })[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | 'All'>(
    params.group && GROUPS.includes(params.group as Group) ? (params.group as Group) : 'All',
  );
  const [sort, setSort] = useState<SortOption>('az');

  useEffect(() => {
    if (showInactive) {
      return subscribeSwimmers(false, setInactiveSwimmers);
    }
  }, [showInactive]);

  const swimmers = showInactive ? inactiveSwimmers : activeSwimmers;

  const filtered = useMemo(() => {
    let result = swimmers;

    if (selectedGroup !== 'All') {
      result = result.filter((s) => s.group === selectedGroup);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.firstName.toLowerCase().includes(q) || s.lastName.toLowerCase().includes(q),
      );
    }

    // Sort
    switch (sort) {
      case 'za':
        result = [...result].sort((a, b) => b.lastName.localeCompare(a.lastName));
        break;
      case 'group':
        result = [...result].sort((a, b) => {
          const gi = GROUPS.indexOf(a.group as any);
          const gj = GROUPS.indexOf(b.group as any);
          return gi - gj || a.lastName.localeCompare(b.lastName);
        });
        break;
      case 'newest':
        result = [...result].sort((a, b) => {
          const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return tb - ta;
        });
        break;
      // 'az' is default from Firestore orderBy
    }

    return result;
  }, [swimmers, selectedGroup, search, sort]);

  const cycleSort = () => {
    const options: SortOption[] = ['az', 'za', 'group', 'newest'];
    const next = options[(options.indexOf(sort) + 1) % options.length];
    setSort(next);
  };

  const handleActivate = (swimmer: Swimmer & { id: string }) => {
    Alert.alert(
      'Activate Swimmer',
      `Move ${swimmer.firstName} ${swimmer.lastName} back to active?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            await updateSwimmer(swimmer.id, { active: true } as any);
          },
        },
      ],
    );
  };

  const renderSwimmer = ({ item }: { item: Swimmer & { id: string } }) => (
    <TouchableOpacity
      style={styles.swimmerRow}
      onPress={() => router.push(`/swimmer/${item.id}`)}
      onLongPress={showInactive ? () => handleActivate(item) : undefined}
    >
      {item.profilePhotoUrl ? (
        <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.firstName[0]}
            {item.lastName[0]}
          </Text>
        </View>
      )}
      <View style={styles.swimmerInfo}>
        <Text style={styles.swimmerName}>
          {item.lastName}, {item.firstName}
        </Text>
        <View style={styles.swimmerMeta}>
          <View
            style={[
              styles.groupBadge,
              {
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderColor: groupColors[item.group] || colors.textSecondary,
              },
            ]}
          >
            <Text
              style={[
                styles.groupBadgeText,
                { color: groupColors[item.group] || colors.textSecondary },
              ]}
            >
              {item.group}
            </Text>
          </View>
          {item.usaSwimmingId && <Text style={styles.usaId}>USA #{item.usaSwimmingId}</Text>}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Count Scorebug */}
      <View style={styles.countHeader}>
        <View>
          <Text style={styles.countNum}>{filtered.length}</Text>
          <Text style={styles.countLabel}>{showInactive ? 'INACTIVE' : 'SWIMMERS'}</Text>
        </View>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={async () => {
            try {
              const csv = exportRosterCSV(swimmers);
              await shareCSV('bspc_roster.csv', csv);
            } catch (err: any) {
              Alert.alert('Export Error', err.message);
            }
          }}
        >
          <Text style={styles.exportBtnText}>EXPORT</Text>
        </TouchableOpacity>
      </View>

      {/* Active/Inactive Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !showInactive && styles.toggleBtnActive]}
          onPress={() => setShowInactive(false)}
        >
          <Text style={[styles.toggleBtnText, !showInactive && styles.toggleBtnTextActive]}>
            Active ({activeSwimmers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, showInactive && styles.toggleBtnActive]}
          onPress={() => setShowInactive(true)}
        >
          <Text style={[styles.toggleBtnText, showInactive && styles.toggleBtnTextActive]}>
            Inactive ({inactiveSwimmers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search + Sort */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search swimmers..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.sortBtn} onPress={cycleSort}>
          <Text style={styles.sortBtnText}>{SORT_LABELS[sort]}</Text>
        </TouchableOpacity>
      </View>

      {/* Group Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['All' as const, ...GROUPS]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: group }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedGroup === group && styles.filterChipActive]}
            onPress={() => setSelectedGroup(group)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedGroup === group && styles.filterChipTextActive,
              ]}
            >
              {group} (
              {group === 'All' ? swimmers.length : swimmers.filter((s) => s.group === group).length}
              )
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Swimmer List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderSwimmer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {swimmers.length === 0
                ? showInactive
                  ? 'NO INACTIVE SWIMMERS'
                  : 'NO SWIMMERS YET'
                : 'NO RESULTS'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {swimmers.length === 0
                ? showInactive
                  ? 'All swimmers are currently active'
                  : 'Tap + to add your first swimmer'
                : 'Try a different search or filter'}
            </Text>
          </View>
        }
      />

      {showInactive && inactiveSwimmers.length > 0 && (
        <View style={styles.hintBar}>
          <Text style={styles.hintText}>Long press a swimmer to re-activate</Text>
        </View>
      )}

      {/* FAB */}
      {!showInactive && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/swimmer/new')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Count Header
  countHeader: {
    backgroundColor: colors.bgDeep,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  exportBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 1,
  },
  countNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  countLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
  },
  // Toggle
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtnActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  toggleBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  toggleBtnTextActive: { color: colors.text },
  // Search
  searchRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgElevated,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtn: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 1,
  },
  // Filters
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  filterChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: { color: colors.text },
  // List
  list: { padding: spacing.lg, paddingBottom: 100 },
  swimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accent,
    marginRight: spacing.md,
  },
  avatarText: { fontFamily: fontFamily.heading, color: colors.text, fontSize: fontSize.lg },
  swimmerInfo: { flex: 1 },
  swimmerName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  swimmerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  groupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  groupBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  usaId: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  chevron: { fontSize: fontSize.xxl, color: colors.textSecondary, marginLeft: spacing.sm },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  // Hint
  hintBar: {
    padding: spacing.sm,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hintText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  fabText: { color: colors.bgDeep, fontSize: 28, fontWeight: '400', marginTop: -2 },
});
