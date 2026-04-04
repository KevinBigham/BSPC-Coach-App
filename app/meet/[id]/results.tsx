import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { subscribeSplits, type Split } from '../../../src/services/liveMeet';
import { useLiveMeetStore } from '../../../src/stores/liveMeetStore';
import { formatSplitDisplay, calculatePlacement, placementSuffix } from '../../../src/utils/meetTiming';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../../src/config/theme';

export default function ResultsScreen() {
  const { id: meetId, eventId, eventName } = useLocalSearchParams<{
    id: string;
    eventId: string;
    eventName: string;
  }>();

  const [splits, setSplits] = useState<(Split & { id: string })[]>([]);
  const store = useLiveMeetStore();

  useEffect(() => {
    if (!meetId || !eventId) return;
    return subscribeSplits(meetId, eventId, setSplits);
  }, [meetId, eventId]);

  // Get final split per lane (highest split number = finish time)
  const finalsByLane: Record<number, Split & { id: string }> = {};
  for (const s of splits) {
    if (!finalsByLane[s.lane] || s.splitNumber > finalsByLane[s.lane].splitNumber) {
      finalsByLane[s.lane] = s;
    }
  }

  const laneTimes: Record<number, number> = {};
  for (const [lane, split] of Object.entries(finalsByLane)) {
    laneTimes[parseInt(lane, 10)] = split.time;
  }

  const placements = calculatePlacement(laneTimes);

  // Sort lanes by placement
  const sortedLanes = Object.entries(finalsByLane)
    .sort((a, b) => a[1].time - b[1].time)
    .map(([lane, split]) => ({
      lane: parseInt(lane, 10),
      split,
      place: placements[parseInt(lane, 10)],
      swimmerName: split.swimmerName || store.laneAssignments[parseInt(lane, 10)]?.swimmerName || `Lane ${lane}`,
    }));

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'RESULTS',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.pixelLabel}>EVENT RESULTS</Text>
          <Text style={styles.heading}>{(eventName || 'Event').toUpperCase()}</Text>
        </View>

        {/* Results */}
        {sortedLanes.map((result) => {
          const isFirst = result.place === 1;
          const isTop3 = result.place <= 3;
          return (
            <View
              key={result.lane}
              style={[
                styles.resultCard,
                isFirst && styles.resultCardFirst,
                isTop3 && !isFirst && styles.resultCardPodium,
              ]}
            >
              <View style={styles.placeSection}>
                <Text
                  style={[
                    styles.placeText,
                    isFirst && styles.placeTextFirst,
                  ]}
                >
                  {placementSuffix(result.place)}
                </Text>
              </View>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{result.swimmerName}</Text>
                <Text style={styles.resultLane}>Lane {result.lane}</Text>
              </View>
              <Text
                style={[
                  styles.resultTime,
                  isFirst && styles.resultTimeFirst,
                ]}
              >
                {formatSplitDisplay(result.split.time)}
              </Text>
            </View>
          );
        })}

        {sortedLanes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No splits recorded for this event</Text>
          </View>
        )}

        {/* Split Detail */}
        {sortedLanes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SPLIT DETAILS</Text>
            {sortedLanes.map((result) => {
              const laneSplits = splits
                .filter((s) => s.lane === result.lane)
                .sort((a, b) => a.splitNumber - b.splitNumber);

              return (
                <View key={result.lane} style={styles.splitCard}>
                  <Text style={styles.splitCardTitle}>
                    {result.swimmerName} (Lane {result.lane})
                  </Text>
                  <View style={styles.splitList}>
                    {laneSplits.map((s, i) => (
                      <View key={s.id} style={styles.splitRow}>
                        <Text style={styles.splitLabel}>Split {i + 1}</Text>
                        <Text style={styles.splitTime}>
                          {formatSplitDisplay(s.time)}
                        </Text>
                        {i > 0 && (
                          <Text style={styles.splitDiff}>
                            (+{formatSplitDisplay(s.time - laneSplits[i - 1].time)})
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Back to Meet */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push(`/meet/${meetId}/live`)}
        >
          <Text style={styles.backBtnText}>BACK TO EVENTS</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  header: { marginBottom: spacing.xl },
  pixelLabel: { fontFamily: fontFamily.pixel, fontSize: 8, letterSpacing: 1, color: colors.gold, marginBottom: spacing.xs },
  heading: { fontFamily: fontFamily.heading, fontSize: 32, fontWeight: '700', letterSpacing: 2, color: colors.text },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  resultCardFirst: {
    borderColor: colors.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
  },
  resultCardPodium: {
    borderColor: colors.purple,
  },
  placeSection: {
    width: 48,
    alignItems: 'center',
  },
  placeText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.accent,
  },
  placeTextFirst: { color: colors.gold },
  resultInfo: { flex: 1 },
  resultName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  resultLane: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  resultTime: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.accent,
  },
  resultTimeFirst: { color: colors.gold },
  emptyState: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  splitCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  splitCardTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  splitList: { gap: spacing.xs },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  splitLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.gold,
    letterSpacing: 1,
    width: 50,
  },
  splitTime: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.sm,
    color: colors.accent,
    width: 70,
  },
  splitDiff: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  backBtn: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  backBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
});
