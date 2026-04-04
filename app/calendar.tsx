import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { useCalendarStore } from '../src/stores/calendarStore';
import { subscribeEvents, getEventTypeColor, getEventTypeLabel } from '../src/services/calendar';
import CalendarMonth from '../src/components/CalendarMonth';
import EventCard from '../src/components/EventCard';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarScreen() {
  const { coach } = useAuth();
  const {
    selectedDate,
    viewMonth,
    events,
    setSelectedDate,
    setEvents,
    navigateMonth,
    goToToday,
  } = useCalendarStore();

  useEffect(() => {
    return subscribeEvents(viewMonth, setEvents);
  }, [viewMonth]);

  const [yearStr, monthStr] = viewMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;

  // Events for selected date
  const dateEvents = selectedDate
    ? events.filter((e) => e.startDate === selectedDate)
    : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pixelLabel}>TEAM</Text>
          <Text style={styles.screenTitle}>CALENDAR</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/calendar/event/new')}>
          <Text style={styles.addBtnText}>+ EVENT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday}>
            <Text style={styles.monthTitle}>{MONTH_NAMES[month]} {year}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <CalendarMonth
          year={year}
          month={month}
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        {/* Selected Date Events */}
        {selectedDate && (
          <View style={styles.dateSection}>
            <View style={styles.dateSectionHeader}>
              <Text style={styles.dateSectionTitle}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.eventCount}>{dateEvents.length} event{dateEvents.length !== 1 ? 's' : ''}</Text>
            </View>

            {dateEvents.length > 0 ? (
              dateEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/calendar/event/${event.id}`)}
                />
              ))
            ) : (
              <View style={styles.noEvents}>
                <Text style={styles.noEventsText}>No events scheduled</Text>
                <TouchableOpacity
                  style={styles.addEventBtn}
                  onPress={() => router.push('/calendar/event/new')}
                >
                  <Text style={styles.addEventBtnText}>+ ADD EVENT</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Upcoming Events Summary */}
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>UPCOMING</Text>
          {events
            .filter((e) => e.startDate >= (selectedDate || viewMonth + '-01'))
            .slice(0, 5)
            .map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/calendar/event/${event.id}`)}
              />
            ))}
          {events.length === 0 && (
            <Text style={styles.emptyText}>No events this month</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12081f',
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  pixelLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1, marginBottom: spacing.xs },
  screenTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xxxl, color: colors.text, letterSpacing: 2 },
  addBtn: { backgroundColor: colors.purple, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  addBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text, letterSpacing: 1 },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  // Month Nav
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  navBtn: { padding: spacing.sm },
  navBtnText: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.accent },
  monthTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.text, letterSpacing: 1 },
  // Date Section
  dateSection: { marginTop: spacing.lg },
  dateSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  dateSectionTitle: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  eventCount: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  noEvents: { alignItems: 'center', paddingVertical: spacing.xl },
  noEventsText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  addEventBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.purple, borderStyle: 'dashed' },
  addEventBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent, letterSpacing: 1 },
  // Upcoming
  upcomingSection: { marginTop: spacing.xl },
  sectionTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, letterSpacing: 1, marginBottom: spacing.sm },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
});
