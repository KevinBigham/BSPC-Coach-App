import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import type { Swimmer, AttendanceRecord } from '../../src/types/firestore.types';

type FilterGroup = Group | 'All';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AttendanceScreen() {
  const { coach } = useAuth();
  const [swimmers, setSwimmers] = useState<(Swimmer & { id: string })[]>([]);
  const [todayRecords, setTodayRecords] = useState<(AttendanceRecord & { id: string })[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FilterGroup>('All');
  const today = getTodayString();

  // Listen to active swimmers
  useEffect(() => {
    const q = query(
      collection(db, 'swimmers'),
      where('active', '==', true),
      orderBy('lastName')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSwimmers(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Swimmer & { id: string }))
      );
    });
    return unsubscribe;
  }, []);

  // Listen to today's attendance
  useEffect(() => {
    const q = query(
      collection(db, 'attendance'),
      where('practiceDate', '==', today)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodayRecords(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord & { id: string }))
      );
    });
    return unsubscribe;
  }, [today]);

  const filtered = useMemo(() => {
    if (selectedGroup === 'All') return swimmers;
    return swimmers.filter((s) => s.group === selectedGroup);
  }, [swimmers, selectedGroup]);

  const getRecord = useCallback(
    (swimmerId: string) => todayRecords.find((r) => r.swimmerId === swimmerId),
    [todayRecords]
  );

  const presentCount = useMemo(() => {
    const presentIds = new Set(todayRecords.filter((r) => !r.departedAt).map((r) => r.swimmerId));
    if (selectedGroup === 'All') return presentIds.size;
    return filtered.filter((s) => presentIds.has(s.id)).length;
  }, [todayRecords, filtered, selectedGroup]);

  const totalFiltered = filtered.length;

  const handleCheckIn = async (swimmer: Swimmer & { id: string }) => {
    const existing = getRecord(swimmer.id);

    if (!existing) {
      // Check in
      await addDoc(collection(db, 'attendance'), {
        swimmerId: swimmer.id,
        swimmerName: `${swimmer.firstName} ${swimmer.lastName}`,
        group: swimmer.group,
        practiceDate: today,
        arrivedAt: serverTimestamp(),
        departedAt: null,
        markedBy: coach?.uid || '',
        coachName: coach?.displayName || 'Unknown',
        createdAt: serverTimestamp(),
      });
    } else if (!existing.departedAt) {
      // Check out
      Alert.alert(
        'Check Out',
        `Mark ${swimmer.firstName} as departed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Check Out',
            onPress: async () => {
              await updateDoc(doc(db, 'attendance', existing.id), {
                departedAt: serverTimestamp(),
              });
            },
          },
        ]
      );
    } else {
      // Already departed — re-check-in
      await addDoc(collection(db, 'attendance'), {
        swimmerId: swimmer.id,
        swimmerName: `${swimmer.firstName} ${swimmer.lastName}`,
        group: swimmer.group,
        practiceDate: today,
        arrivedAt: serverTimestamp(),
        departedAt: null,
        markedBy: coach?.uid || '',
        coachName: coach?.displayName || 'Unknown',
        createdAt: serverTimestamp(),
      });
    }
  };

  const renderSwimmer = ({ item }: { item: Swimmer & { id: string } }) => {
    const record = getRecord(item.id);
    const isPresent = record && !record.departedAt;
    const hasDeparted = record && record.departedAt;

    return (
      <TouchableOpacity
        style={[
          styles.swimmerRow,
          isPresent && styles.swimmerRowPresent,
          hasDeparted && styles.swimmerRowDeparted,
        ]}
        onPress={() => handleCheckIn(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, {
          backgroundColor: isPresent ? colors.success : hasDeparted ? colors.textSecondary : 'transparent',
          borderColor: isPresent ? colors.success : hasDeparted ? colors.textSecondary : colors.border,
        }]} />
        <View style={styles.swimmerInfo}>
          <Text style={styles.swimmerName}>
            {item.firstName} {item.lastName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.groupLabel, { color: groupColors[item.group] || colors.textSecondary }]}>
              {item.group}
            </Text>
            {record && (
              <Text style={styles.timeText}>
                {isPresent ? `In ${formatTime(record.arrivedAt instanceof Date ? record.arrivedAt : new Date())}` : ''}
                {hasDeparted ? 'Departed' : ''}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.tapHint}>
          {isPresent ? 'TAP OUT' : hasDeparted ? 'RE-CHECK' : 'TAP IN'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Scorebug Header */}
      <View style={styles.headerBug}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          <Text style={styles.headerLabel}>PRACTICE</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.presentCount}>{presentCount}</Text>
          <Text style={styles.presentSep}>/</Text>
          <Text style={styles.totalCount}>{totalFiltered}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>PRESENT</Text>
        </View>
      </View>

      {/* Group Filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['All' as const, ...GROUPS]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: group }) => {
          const count = group === 'All'
            ? swimmers.length
            : swimmers.filter((s) => s.group === group).length;
          return (
            <TouchableOpacity
              style={[styles.filterChip, selectedGroup === group && styles.filterChipActive]}
              onPress={() => setSelectedGroup(group)}
            >
              <Text style={[styles.filterChipText, selectedGroup === group && styles.filterChipTextActive]}>
                {group} ({count})
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Swimmer List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderSwimmer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO SWIMMERS</Text>
            <Text style={styles.emptySubtitle}>Add swimmers in the Roster tab first</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  // Scorebug Header
  headerBug: {
    backgroundColor: colors.bgDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  headerLeft: {
    alignItems: 'flex-start',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headerDate: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  headerLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  presentCount: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.success,
    lineHeight: 52,
  },
  presentSep: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  totalCount: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.textSecondary,
    lineHeight: 52,
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
  // Swimmer List
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
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
  swimmerRowPresent: {
    borderColor: colors.success,
    backgroundColor: 'rgba(204, 176, 0, 0.06)',
  },
  swimmerRowDeparted: {
    opacity: 0.5,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginRight: spacing.md,
  },
  swimmerInfo: {
    flex: 1,
  },
  swimmerName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  groupLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
  },
  timeText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  tapHint: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
  },
  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
