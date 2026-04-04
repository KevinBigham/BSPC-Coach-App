import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../config/theme';
import { getEventTypeColor, getEventTypeLabel } from '../services/calendar';
import type { CalendarEvent } from '../types/firestore.types';

interface EventCardProps {
  event: CalendarEvent & { id: string };
  onPress: () => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const typeColor = getEventTypeColor(event.type);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={[styles.typeLine, { backgroundColor: typeColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
          <View style={[styles.typeBadge, { borderColor: typeColor }]}>
            <Text style={[styles.typeText, { color: typeColor }]}>
              {getEventTypeLabel(event.type).toUpperCase()}
            </Text>
          </View>
        </View>

        {event.startTime && (
          <Text style={styles.time}>
            {event.startTime}{event.endTime ? ` — ${event.endTime}` : ''}
          </Text>
        )}

        {event.location && (
          <Text style={styles.location} numberOfLines={1}>{event.location}</Text>
        )}

        {event.description && (
          <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
        )}

        {event.groups.length > 0 && (
          <View style={styles.groupsRow}>
            {event.groups.map((g) => (
              <View key={g} style={[styles.groupChip, { borderColor: groupColors[g] || colors.border }]}>
                <Text style={[styles.groupChipText, { color: groupColors[g] || colors.textSecondary }]}>{g}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  typeLine: { width: 4 },
  content: { flex: 1, padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  title: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, flex: 1, marginRight: spacing.sm },
  typeBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  typeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  time: { fontFamily: fontFamily.statMono, fontSize: fontSize.sm, color: colors.accent, marginBottom: spacing.xs },
  location: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  description: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  groupsRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  groupChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  groupChipText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
});
