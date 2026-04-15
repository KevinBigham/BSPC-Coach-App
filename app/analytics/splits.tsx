import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { EVENTS } from '../../src/config/constants';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { subscribeTimes } from '../../src/services/times';
import { formatShortDate, toDateSafe, type FirestoreTimestampLike } from '../../src/utils/date';
import SplitComparisonChart, { type RaceData } from '../../src/components/SplitComparisonChart';
import type { SwimTime } from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type TimeWithId = SwimTime & { id: string };

const MAX_COMPARE = 3;

function SplitComparisonScreen() {
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [selectedSwimmerId, setSelectedSwimmerId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>(EVENTS[1]); // default 50 Free
  const [allTimes, setAllTimes] = useState<TimeWithId[]>([]);

  const selectedSwimmer = swimmers.find((s) => s.id === selectedSwimmerId);

  useEffect(() => {
    if (!selectedSwimmerId) {
      setAllTimes([]);
      return;
    }
    return subscribeTimes(selectedSwimmerId, setAllTimes);
  }, [selectedSwimmerId]);

  const raceData: RaceData[] = useMemo(() => {
    const toDate = (ts: FirestoreTimestampLike): Date => toDateSafe(ts) ?? new Date(0);

    return allTimes
      .filter((t) => t.event === selectedEvent && t.splits && t.splits.length > 0)
      .sort(
        (a, b) =>
          toDate(a.createdAt as FirestoreTimestampLike).getTime() -
          toDate(b.createdAt as FirestoreTimestampLike).getTime(),
      )
      .slice(-MAX_COMPARE)
      .map((t) => ({
        name: t.meetName || formatShortDate(toDate(t.createdAt as FirestoreTimestampLike)),
        splits: t.splits!,
        totalTime: t.time,
      }));
  }, [allTimes, selectedEvent]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Layers size={20} color={colors.gold} style={{ marginBottom: spacing.xs }} />
        <Text style={styles.pixelLabel}>RACE ANALYSIS</Text>
        <Text style={styles.heading}>SPLIT COMPARISON</Text>
        <Text style={styles.subtext}>
          Compare 50-by-50 splits across up to {MAX_COMPARE} races for any swimmer and event
        </Text>
      </View>

      {/* Swimmer Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SWIMMER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {swimmers.map((sw) => {
              const isActive = sw.id === selectedSwimmerId;
              return (
                <TouchableOpacity
                  key={sw.id}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedSwimmerId(sw.id ?? null)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {sw.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Event Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EVENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {EVENTS.map((ev) => {
              const isActive = ev === selectedEvent;
              return (
                <TouchableOpacity
                  key={ev}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => setSelectedEvent(ev)}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{ev}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Chart Area */}
      <View style={styles.section}>
        {!selectedSwimmerId ? (
          <View style={styles.placeholder}>
            <Layers size={32} color={colors.textSecondary} />
            <Text style={styles.placeholderText}>Select a swimmer to view split comparisons</Text>
          </View>
        ) : raceData.length === 0 ? (
          <View style={styles.placeholder}>
            <Layers size={32} color={colors.textSecondary} />
            <Text style={styles.placeholderText}>
              No races with split data found for {selectedSwimmer?.displayName ?? 'this swimmer'} in{' '}
              {selectedEvent}
            </Text>
          </View>
        ) : (
          <SplitComparisonChart races={raceData} />
        )}
      </View>
    </ScrollView>
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
    fontSize: 36,
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  chipScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: fontFamily.bodyMed,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  placeholder: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  placeholderText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default withScreenErrorBoundary(SplitComparisonScreen, 'SplitComparisonScreen');
