import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { subscribeEventsForDate, sortEventsChronologically } from '../../src/services/calendar';
import EventCard from '../../src/components/EventCard';
import type { CalendarEvent } from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type EventWithId = CalendarEvent & { id: string };

function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { coach } = useAuth();
  const [events, setEvents] = useState<EventWithId[]>([]);

  useEffect(() => {
    if (!date) return;
    return subscribeEventsForDate(date, setEvents);
  }, [date]);

  const displayDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const sortedEvents = sortEventsChronologically(events);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>◀ BACK TO CALENDAR</Text>
        </TouchableOpacity>
        <Text style={styles.date}>{displayDate}</Text>
        <Text style={styles.eventCount}>
          {sortedEvents.length} event{sortedEvents.length !== 1 ? 's' : ''}
        </Text>

        {sortedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => router.push(`/calendar/event/${event.id}`)}
          />
        ))}

        {sortedEvents.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>NO EVENTS</Text>
            <Text style={styles.emptyText}>Nothing scheduled for this day</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push('/calendar/event/new')}
            >
              <Text style={styles.addBtnText}>+ ADD EVENT</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  backBtn: { paddingVertical: spacing.sm, marginBottom: spacing.md },
  backBtnText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
  },
  date: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  eventCount: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  addBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.purple,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.accent,
    letterSpacing: 1,
  },
});

export default withScreenErrorBoundary(DayDetailScreen, 'DayDetailScreen');
