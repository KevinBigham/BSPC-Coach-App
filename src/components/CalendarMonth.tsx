import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { DAYS_OF_WEEK } from '../config/constants';
import { getEventTypeColor } from '../services/calendar';
import type { CalendarEvent } from '../types/firestore.types';

interface CalendarMonthProps {
  year: number;
  month: number; // 0-indexed (0=Jan)
  events: (CalendarEvent & { id: string })[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export default function CalendarMonth({
  year,
  month,
  events,
  selectedDate,
  onSelectDate,
}: CalendarMonthProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build event dots map: date → event types
  const eventsByDate: Record<string, Set<string>> = {};
  for (const event of events) {
    if (!eventsByDate[event.startDate]) {
      eventsByDate[event.startDate] = new Set();
    }
    eventsByDate[event.startDate].add(event.type);
  }

  // Build weeks grid
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = Array(firstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <View style={styles.container}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAYS_OF_WEEK.map((day) => (
          <View key={day} style={styles.headerCell}>
            <Text style={styles.headerText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) {
              return <View key={di} style={styles.dayCell} />;
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayEvents = eventsByDate[dateStr];

            return (
              <TouchableOpacity
                key={di}
                style={[styles.dayCell, isToday && styles.todayCell, isSelected && styles.selectedCell]}
                onPress={() => onSelectDate(dateStr)}
              >
                <Text
                  style={[
                    styles.dayText,
                    isToday && styles.todayText,
                    isSelected && styles.selectedText,
                  ]}
                >
                  {day}
                </Text>
                {dayEvents && (
                  <View style={styles.dotsRow}>
                    {Array.from(dayEvents).slice(0, 3).map((type, i) => (
                      <View
                        key={i}
                        style={[styles.dot, { backgroundColor: getEventTypeColor(type as CalendarEvent['type']) }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  headerRow: { flexDirection: 'row', marginBottom: spacing.xs },
  headerCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  headerText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.sm, minHeight: 44 },
  todayCell: { backgroundColor: 'rgba(74, 14, 120, 0.3)' },
  selectedCell: { backgroundColor: colors.purple },
  dayText: { fontFamily: fontFamily.statMono, fontSize: fontSize.sm, color: colors.text },
  todayText: { color: colors.accent },
  selectedText: { color: colors.text },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
