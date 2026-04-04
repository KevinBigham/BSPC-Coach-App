import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { useLiveMeetStore } from '../../../src/stores/liveMeetStore';
import {
  recordSplit,
  finishEvent,
  subscribeSplits,
  type Split,
} from '../../../src/services/liveMeet';
import LaneSplitButton from '../../../src/components/LaneSplitButton';
import PRCelebration from '../../../src/components/PRCelebration';
import { formatTimerDisplay, formatSplitDisplay, msToHundredths } from '../../../src/utils/meetTiming';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../../src/config/theme';

const LANE_COUNT = 8;

export default function TimerScreen() {
  const { id: meetId, eventId, eventName } = useLocalSearchParams<{
    id: string;
    eventId: string;
    eventName: string;
  }>();

  const store = useLiveMeetStore();
  const [splits, setSplits] = useState<(Split & { id: string })[]>([]);
  const [displayTime, setDisplayTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // PR celebration state
  const [prCelebration, setPRCelebration] = useState<{
    swimmerName: string;
    eventName: string;
    newTime: number;
    oldTime?: number;
  } | null>(null);

  // Subscribe to splits
  useEffect(() => {
    if (!meetId || !eventId) return;
    return subscribeSplits(meetId, eventId, setSplits);
  }, [meetId, eventId]);

  // Timer loop
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      if (startTimeRef.current) {
        const elapsed = msToHundredths(Date.now() - startTimeRef.current);
        setDisplayTime(elapsed);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning]);

  const handleStart = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsRunning(true);
    setDisplayTime(0);
  }, []);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const handleLaneSplit = useCallback(async (lane: number) => {
    if (!isRunning || !meetId || !eventId || !startTimeRef.current) return;

    const time = msToHundredths(Date.now() - startTimeRef.current);
    const laneSplits = splits.filter((s) => s.lane === lane);
    const splitNumber = laneSplits.length + 1;

    const assignment = store.laneAssignments[lane];

    await recordSplit(
      meetId,
      eventId,
      lane,
      time,
      splitNumber,
      assignment?.swimmerId,
      assignment?.swimmerName,
    );
  }, [isRunning, meetId, eventId, splits, store.laneAssignments]);

  const handleFinish = useCallback(async () => {
    if (!meetId || !eventId) return;

    Alert.alert(
      'Finish Event',
      'Stop the timer and finalize this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            handleStop();
            await finishEvent(meetId, eventId);
            router.push(`/meet/${meetId}/results?eventId=${eventId}&eventName=${encodeURIComponent(eventName || '')}`);
          },
        },
      ],
    );
  }, [meetId, eventId, eventName]);

  // Group splits by lane
  const splitsByLane: Record<number, (Split & { id: string })[]> = {};
  for (let i = 1; i <= LANE_COUNT; i++) splitsByLane[i] = [];
  for (const s of splits) {
    if (splitsByLane[s.lane]) splitsByLane[s.lane].push(s);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* PR Celebration Overlay */}
      {prCelebration && (
        <PRCelebration
          swimmerName={prCelebration.swimmerName}
          eventName={prCelebration.eventName}
          newTime={prCelebration.newTime}
          oldTime={prCelebration.oldTime}
          onDismiss={() => setPRCelebration(null)}
        />
      )}

      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backBtn}>BACK</Text>
          </TouchableOpacity>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{eventName || 'Event'}</Text>
          </View>
          <TouchableOpacity onPress={handleFinish}>
            <Text style={styles.finishBtn}>FINISH</Text>
          </TouchableOpacity>
        </View>

        {/* Timer Display */}
        <View style={styles.timerArea}>
          <Text style={styles.timerText}>{formatTimerDisplay(displayTime)}</Text>
          <View style={styles.timerControls}>
            {!isRunning ? (
              <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
                <Text style={styles.startBtnText}>START</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <Text style={styles.stopBtnText}>STOP</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Lane Grid */}
        <ScrollView style={styles.laneArea} contentContainerStyle={styles.laneGrid}>
          {Array.from({ length: LANE_COUNT }, (_, i) => i + 1).map((lane) => {
            const laneSplits = splitsByLane[lane] || [];
            const lastSplit = laneSplits.length > 0
              ? laneSplits.reduce((a, b) => (a.splitNumber > b.splitNumber ? a : b))
              : null;

            return (
              <View key={lane} style={styles.laneCell}>
                <LaneSplitButton
                  lane={lane}
                  swimmerName={store.laneAssignments[lane]?.swimmerName}
                  lastSplitTime={lastSplit?.time}
                  splitCount={laneSplits.length}
                  onPress={() => handleLaneSplit(lane)}
                  disabled={!isRunning}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  eventInfo: { flex: 1, alignItems: 'center' },
  eventName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
  },
  finishBtn: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.error,
  },
  timerArea: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  timerText: {
    fontFamily: fontFamily.stat,
    fontSize: 52,
    color: colors.gold,
    letterSpacing: 2,
  },
  timerControls: {
    marginTop: spacing.md,
  },
  startBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  startBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  stopBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  stopBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  laneArea: {
    flex: 1,
    padding: spacing.md,
  },
  laneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: 40,
  },
  laneCell: {
    width: '23.5%',
  },
});
