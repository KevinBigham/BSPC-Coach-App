import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';
import { useAuth } from '../../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../../src/config/theme';
import { deleteEvent, subscribeRSVPs, getEventTypeColor, getEventTypeLabel } from '../../../src/services/calendar';
import type { CalendarEvent, RSVP } from '../../../src/types/firestore.types';

type EventWithId = CalendarEvent & { id: string };
type RSVPWithId = RSVP & { id: string };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach } = useAuth();
  const [event, setEvent] = useState<EventWithId | null>(null);
  const [rsvps, setRsvps] = useState<RSVPWithId[]>([]);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'calendar_events', id), (snap) => {
      if (snap.exists()) setEvent({ id: snap.id, ...snap.data() } as EventWithId);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeRSVPs(id, setRsvps);
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(id);
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  if (!event) return null;

  const typeColor = getEventTypeColor(event.type);
  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;
  const notGoingCount = rsvps.filter((r) => r.status === 'not_going').length;

  const displayDate = new Date(event.startDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Type Badge */}
        <View style={[styles.typeBadge, { borderColor: typeColor }]}>
          <Text style={[styles.typeText, { color: typeColor }]}>
            {getEventTypeLabel(event.type).toUpperCase()}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{event.title}</Text>

        {/* Date & Time */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DATE</Text>
            <Text style={styles.infoValue}>{displayDate}</Text>
          </View>
          {event.startTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>TIME</Text>
              <Text style={styles.infoValue}>
                {event.startTime}{event.endTime ? ` — ${event.endTime}` : ''}
              </Text>
            </View>
          )}
          {event.location && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>LOCATION</Text>
              <Text style={styles.infoValue}>{event.location}</Text>
            </View>
          )}
          {event.coachName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>CREATED BY</Text>
              <Text style={styles.infoValue}>{event.coachName}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.descCard}>
            <Text style={styles.desc}>{event.description}</Text>
          </View>
        )}

        {/* Groups */}
        {event.groups.length > 0 && (
          <View style={styles.groupsSection}>
            <Text style={styles.sectionLabel}>GROUPS</Text>
            <View style={styles.groupsRow}>
              {event.groups.map((g) => (
                <View key={g} style={[styles.groupChip, { borderColor: groupColors[g] || colors.border }]}>
                  <Text style={[styles.groupChipText, { color: groupColors[g] || colors.textSecondary }]}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RSVPs */}
        {rsvps.length > 0 && (
          <View style={styles.rsvpSection}>
            <Text style={styles.sectionLabel}>RESPONSES</Text>
            <View style={styles.rsvpSummary}>
              <View style={styles.rsvpBox}>
                <Text style={[styles.rsvpNum, { color: colors.accent }]}>{goingCount}</Text>
                <Text style={styles.rsvpLabel}>GOING</Text>
              </View>
              <View style={styles.rsvpBox}>
                <Text style={[styles.rsvpNum, { color: colors.gold }]}>{maybeCount}</Text>
                <Text style={styles.rsvpLabel}>MAYBE</Text>
              </View>
              <View style={styles.rsvpBox}>
                <Text style={[styles.rsvpNum, { color: colors.error }]}>{notGoingCount}</Text>
                <Text style={styles.rsvpLabel}>NO</Text>
              </View>
            </View>
            {rsvps.map((rsvp) => (
              <View key={rsvp.id} style={styles.rsvpRow}>
                <Text style={styles.rsvpName}>{rsvp.swimmerName}</Text>
                <Text
                  style={[
                    styles.rsvpStatus,
                    {
                      color: rsvp.status === 'going' ? colors.accent :
                             rsvp.status === 'maybe' ? colors.gold : colors.error,
                    },
                  ]}
                >
                  {rsvp.status.toUpperCase().replace('_', ' ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {coach?.uid === event.coachId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>DELETE EVENT</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: spacing.sm },
  typeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.xxxl, color: colors.text, letterSpacing: 2, marginBottom: spacing.lg },
  // Info Card
  infoCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  infoValue: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  // Description
  descCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  desc: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  // Groups
  groupsSection: { marginBottom: spacing.lg },
  sectionLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1, marginBottom: spacing.sm },
  groupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  groupChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm },
  // RSVP
  rsvpSection: { marginBottom: spacing.xl },
  rsvpSummary: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  rsvpBox: { flex: 1, alignItems: 'center', backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  rsvpNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl },
  rsvpLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  rsvpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rsvpName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  rsvpStatus: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  // Delete
  deleteBtn: { padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error, alignItems: 'center', marginTop: spacing.lg },
  deleteBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.error },
});
