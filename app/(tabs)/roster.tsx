import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import type { Swimmer } from '../../src/types/firestore.types';

export default function RosterScreen() {
  const { isAdmin } = useAuth();
  const [swimmers, setSwimmers] = useState<(Swimmer & { id: string })[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | 'All'>('All');

  useEffect(() => {
    const q = query(
      collection(db, 'swimmers'),
      where('active', '==', true),
      orderBy('lastName')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as (Swimmer & { id: string })[];
      setSwimmers(docs);
    });
    return unsubscribe;
  }, []);

  const filtered = useMemo(() => {
    let result = swimmers;
    if (selectedGroup !== 'All') {
      result = result.filter((s) => s.group === selectedGroup);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [swimmers, selectedGroup, search]);

  const renderSwimmer = ({ item }: { item: Swimmer & { id: string } }) => (
    <TouchableOpacity
      style={styles.swimmerRow}
      onPress={() => router.push(`/swimmer/${item.id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.firstName[0]}{item.lastName[0]}
        </Text>
      </View>
      <View style={styles.swimmerInfo}>
        <Text style={styles.swimmerName}>
          {item.lastName}, {item.firstName}
        </Text>
        <View style={styles.swimmerMeta}>
          <View style={[styles.groupBadge, { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: groupColors[item.group] || colors.textSecondary }]}>
            <Text style={[styles.groupBadgeText, { color: groupColors[item.group] || colors.textSecondary }]}>{item.group}</Text>
          </View>
          {item.usaSwimmingId && (
            <Text style={styles.usaId}>USA #{item.usaSwimmingId}</Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search swimmers..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
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
            style={[
              styles.filterChip,
              selectedGroup === group && styles.filterChipActive,
            ]}
            onPress={() => setSelectedGroup(group)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedGroup === group && styles.filterChipTextActive,
              ]}
            >
              {group} ({group === 'All' ? swimmers.length : swimmers.filter((s) => s.group === group).length})
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
              {swimmers.length === 0 ? 'NO SWIMMERS YET' : 'NO RESULTS'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {swimmers.length === 0
                ? 'Tap + to add your first swimmer'
                : 'Try a different search or filter'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/swimmer/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  searchContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  searchInput: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
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
  filterChipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purpleLight,
  },
  filterChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.text,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
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
  avatarText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: fontSize.lg,
  },
  swimmerInfo: {
    flex: 1,
  },
  swimmerName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
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
  groupBadgeText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
  },
  usaId: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
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
  fabText: {
    color: colors.bgDeep,
    fontSize: 28,
    fontWeight: '400',
    marginTop: -2,
  },
});
