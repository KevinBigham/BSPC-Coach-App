import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { subscribeLiveEvents, startEvent, type LiveEvent } from '../../../src/services/liveMeet';
import { useLiveMeetStore } from '../../../src/stores/liveMeetStore';
import type { Meet } from '../../../src/types/meet.types';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../../src/config/theme';
import { withScreenErrorBoundary } from '../../../src/components/ScreenErrorBoundary';

function LiveMeetScreen() {
  const { id: meetId } = useLocalSearchParams<{ id: string }>();
  const [meet, setMeet] = useState<Meet | null>(null);
  const [liveEvents, setLiveEvents] = useState<(LiveEvent & { id: string })[]>([]);
  const store = useLiveMeetStore();

  useEffect(() => {
    if (!meetId) return;
    store.setMeetId(meetId);
    return onSnapshot(doc(db, 'meets', meetId), (snap) => {
      if (snap.exists()) setMeet(snap.data() as Meet);
    });
  }, [meetId]);

  useEffect(() => {
    if (!meetId) return;
    return subscribeLiveEvents(meetId, setLiveEvents);
  }, [meetId]);

  const handleStartEvent = async (event: Meet['events'][number]) => {
    if (!meetId) return;
    try {
      const eventId = await startEvent(
        meetId,
        event.name,
        event.number,
        event.gender,
        1, // heat 1
        1, // total heats
      );
      router.push(
        `/meet/${meetId}/timer?eventId=${eventId}&eventName=${encodeURIComponent(event.name)}`,
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start event');
    }
  };

  if (!meet) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading meet...</Text>
      </View>
    );
  }

  const finishedIds = new Set(
    liveEvents.filter((e) => e.status === 'finished').map((e) => e.eventNumber),
  );
  const inProgressEvent = liveEvents.find((e) => e.status === 'in_progress');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'LIVE MODE',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Meet Header */}
        <View style={styles.header}>
          <Text style={styles.pixelLabel}>LIVE MEET</Text>
          <Text style={styles.heading}>{meet.name.toUpperCase()}</Text>
          <Text style={styles.subtext}>
            {meet.location} | {meet.course}
          </Text>
        </View>

        {/* In-Progress Event */}
        {inProgressEvent && (
          <TouchableOpacity
            style={styles.activeEventCard}
            onPress={() =>
              router.push(
                `/meet/${meetId}/timer?eventId=${inProgressEvent.id}&eventName=${encodeURIComponent(inProgressEvent.eventName)}`,
              )
            }
          >
            <Text style={styles.activeLabel}>IN PROGRESS</Text>
            <Text style={styles.activeEventName}>{inProgressEvent.eventName}</Text>
            <Text style={styles.activeHint}>TAP TO RESUME TIMING</Text>
          </TouchableOpacity>
        )}

        {/* Event List */}
        <Text style={styles.sectionTitle}>EVENTS ({meet.events.length})</Text>
        {meet.events.map((event, i) => {
          const isFinished = finishedIds.has(event.number);
          const isActive = inProgressEvent?.eventNumber === event.number;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.eventRow,
                isFinished && styles.eventRowFinished,
                isActive && styles.eventRowActive,
              ]}
              onPress={() => {
                if (isActive) {
                  router.push(
                    `/meet/${meetId}/timer?eventId=${inProgressEvent!.id}&eventName=${encodeURIComponent(event.name)}`,
                  );
                } else if (!isFinished) {
                  handleStartEvent(event);
                }
              }}
              disabled={isFinished && !isActive}
            >
              <View style={styles.eventNumberBadge}>
                <Text style={styles.eventNumberText}>{event.number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventName, isFinished && styles.eventNameFinished]}>
                  {event.name}
                </Text>
                <Text style={styles.eventGender}>{event.gender}</Text>
              </View>
              {isFinished && <Text style={styles.finishedLabel}>DONE</Text>}
              {isActive && <Text style={styles.activeSmallLabel}>LIVE</Text>}
              {!isFinished && !isActive && <Text style={styles.startLabel}>START</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  loadingText: { fontFamily: fontFamily.body, color: colors.textSecondary },
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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtext: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  activeEventCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  activeLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 8,
    letterSpacing: 2,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  activeEventName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  activeHint: {
    fontFamily: fontFamily.pixel,
    fontSize: 6,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  eventRowFinished: { opacity: 0.5 },
  eventRowActive: { borderColor: colors.gold, borderWidth: 2 },
  eventNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventNumberText: { fontFamily: fontFamily.stat, fontSize: fontSize.sm, color: colors.text },
  eventName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  eventNameFinished: { color: colors.textSecondary },
  eventGender: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  finishedLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  activeSmallLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    color: colors.gold,
    letterSpacing: 1,
  },
  startLabel: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent },
});

export default withScreenErrorBoundary(LiveMeetScreen, 'LiveMeetScreen');
