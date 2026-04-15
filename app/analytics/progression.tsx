import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { TrendingDown } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { EVENTS } from '../../src/config/constants';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { subscribeTimes } from '../../src/services/times';
import { formatShortDate } from '../../src/utils/date';
import ProgressionChart, { type ProgressionDataPoint } from '../../src/components/ProgressionChart';
import type { SwimTime } from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type TimeWithId = SwimTime & { id: string };

function ProgressionScreen() {
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

  const progressionData: ProgressionDataPoint[] = useMemo(() => {
    const toDate = (ts: unknown): Date => {
      if (ts && typeof ts === 'object' && 'toDate' in ts)
        return (ts as { toDate: () => Date }).toDate();
      if (ts instanceof Date) return ts;
      return new Date(0);
    };

    return allTimes
      .filter((t) => t.event === selectedEvent)
      .sort((a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime())
      .map((t) => ({
        date: formatShortDate(toDate(t.createdAt)),
        time: t.time,
        eventName: t.event,
      }));
  }, [allTimes, selectedEvent]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TrendingDown size={20} color={colors.gold} style={{ marginBottom: spacing.xs }} />
        <Text style={styles.pixelLabel}>PERFORMANCE</Text>
        <Text style={styles.heading}>PR PROGRESSION</Text>
        <Text style={styles.subtext}>
          Track how times have changed over the season for each swimmer and event
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
            <TrendingDown size={32} color={colors.textSecondary} />
            <Text style={styles.placeholderText}>
              Select a swimmer to view their time progression
            </Text>
          </View>
        ) : progressionData.length === 0 ? (
          <View style={styles.placeholder}>
            <TrendingDown size={32} color={colors.textSecondary} />
            <Text style={styles.placeholderText}>
              No times found for {selectedSwimmer?.displayName ?? 'this swimmer'} in {selectedEvent}
            </Text>
          </View>
        ) : (
          <ProgressionChart
            data={progressionData}
            title={`${selectedSwimmer?.displayName} - ${selectedEvent}`}
          />
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

export default withScreenErrorBoundary(ProgressionScreen, 'ProgressionScreen');
