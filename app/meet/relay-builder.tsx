import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { RELAY_EVENTS, MEDLEY_RELAY_ORDER } from '../../src/config/constants';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { addRelay, subscribeRelays } from '../../src/services/meets';
import { optimizeFreeRelayOrder, estimateRelayTime, formatRelayLeg } from '../../src/utils/relay';
import { formatTime } from '../../src/data/timeStandards';
import type { Meet, Relay, RelayLeg } from '../../src/types/meet.types';
import type { Swimmer } from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type MeetWithId = Meet & { id: string };

function RelayBuilderScreen() {
  const { meetId } = useLocalSearchParams<{ meetId: string }>();
  const { coach } = useAuth();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [meet, setMeet] = useState<MeetWithId | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>(RELAY_EVENTS[0]);
  const [selectedSwimmers, setSelectedSwimmers] = useState<string[]>([]);
  const [teamName, setTeamName] = useState('BSPC A');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!meetId) return;
    return onSnapshot(doc(db, 'meets', meetId), (snap) => {
      if (snap.exists()) setMeet({ id: snap.id, ...snap.data() } as MeetWithId);
    });
  }, [meetId]);

  const isMedley = selectedEvent.includes('Medley');
  const relayDistance = parseInt(selectedEvent.split(' ')[0]) / 4; // e.g., 200 → 50 per leg

  const toggleSwimmer = (swimmerId: string) => {
    setSelectedSwimmers((prev) => {
      if (prev.includes(swimmerId)) {
        return prev.filter((id) => id !== swimmerId);
      }
      if (prev.length >= 4) {
        Alert.alert('Max 4', 'A relay has exactly 4 swimmers');
        return prev;
      }
      return [...prev, swimmerId];
    });
  };

  const buildLegs = (): RelayLeg[] => {
    if (selectedSwimmers.length !== 4) return [];

    const swimmerData = selectedSwimmers.map((id) => {
      const swimmer = swimmers.find((s) => s.id === id);
      return {
        swimmerId: id,
        swimmerName: swimmer ? `${swimmer.firstName} ${swimmer.lastName}` : 'Unknown',
      };
    });

    if (isMedley) {
      // Assign in medley order: Back, Breast, Fly, Free
      return MEDLEY_RELAY_ORDER.map((stroke, i) => ({
        order: i + 1,
        swimmerId: swimmerData[i].swimmerId,
        swimmerName: swimmerData[i].swimmerName,
        stroke,
      }));
    } else {
      // Free relay — just use selection order
      return swimmerData.map((s, i) => ({
        order: i + 1,
        swimmerId: s.swimmerId,
        swimmerName: s.swimmerName,
        stroke: 'Freestyle',
      }));
    }
  };

  const handleSave = async () => {
    if (!meetId || !coach) return;
    if (selectedSwimmers.length !== 4) {
      Alert.alert('Need 4 Swimmers', 'Select exactly 4 swimmers for the relay');
      return;
    }

    setSaving(true);
    try {
      const legs = buildLegs();
      const estTime = estimateRelayTime(legs);

      await addRelay(meetId, {
        meetId,
        eventName: selectedEvent,
        gender: 'Mixed',
        teamName,
        legs,
        estimatedTime: estTime > 0 ? estTime : undefined,
        estimatedTimeDisplay: estTime > 0 ? formatTime(estTime) : undefined,
      });

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  const relayEvents =
    meet?.events.filter((e) => e.isRelay).map((e) => e.name) || RELAY_EVENTS.map(String);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.title}>RELAY BUILDER</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || selectedSwimmers.length !== 4}>
          <Text
            style={[styles.saveText, (saving || selectedSwimmers.length !== 4) && { opacity: 0.5 }]}
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Event Selector */}
        <Text style={styles.label}>RELAY EVENT</Text>
        <View style={styles.eventRow}>
          {relayEvents.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.eventChip, selectedEvent === e && styles.eventChipActive]}
              onPress={() => {
                setSelectedEvent(e);
                setSelectedSwimmers([]);
              }}
            >
              <Text
                style={[styles.eventChipText, selectedEvent === e && styles.eventChipTextActive]}
              >
                {e}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Team Name */}
        <View style={styles.teamRow}>
          {['BSPC A', 'BSPC B', 'BSPC C'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.teamChip, teamName === t && styles.teamChipActive]}
              onPress={() => setTeamName(t)}
            >
              <Text style={[styles.teamChipText, teamName === t && styles.teamChipTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected Swimmers Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>
            {selectedEvent} — {teamName}
          </Text>
          {buildLegs().map((leg) => (
            <Text key={leg.order} style={styles.previewLeg}>
              {formatRelayLeg(leg)}
            </Text>
          ))}
          {selectedSwimmers.length < 4 && (
            <Text style={styles.previewHint}>
              Select {4 - selectedSwimmers.length} more swimmer
              {4 - selectedSwimmers.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Swimmer List */}
        <Text style={styles.label}>SELECT 4 SWIMMERS</Text>
        {swimmers
          .filter((s) => s.active)
          .sort((a, b) => a.lastName.localeCompare(b.lastName))
          .map((swimmer) => {
            const isSelected = selectedSwimmers.includes(swimmer.id!);
            const selIndex = selectedSwimmers.indexOf(swimmer.id!);

            return (
              <TouchableOpacity
                key={swimmer.id}
                style={[styles.swimmerRow, isSelected && styles.swimmerRowActive]}
                onPress={() => toggleSwimmer(swimmer.id!)}
              >
                <View style={[styles.selBadge, isSelected && styles.selBadgeActive]}>
                  <Text style={[styles.selBadgeText, isSelected && styles.selBadgeTextActive]}>
                    {isSelected ? selIndex + 1 : ''}
                  </Text>
                </View>
                <View style={styles.swimmerInfo}>
                  <Text style={styles.swimmerName}>
                    {swimmer.lastName}, {swimmer.firstName}
                  </Text>
                  <Text
                    style={[
                      styles.swimmerGroup,
                      { color: groupColors[swimmer.group] || colors.textSecondary },
                    ]}
                  >
                    {swimmer.group} · {swimmer.gender}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
  },
  cancelText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  saveText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
    letterSpacing: 1,
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  label: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  // Event
  eventRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  eventChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDeep,
  },
  eventChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  eventChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  eventChipTextActive: { color: colors.bgDeep },
  // Team
  teamRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  teamChip: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
  },
  teamChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  teamChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  teamChipTextActive: { color: colors.text },
  // Preview
  previewCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.gold,
    marginTop: spacing.lg,
  },
  previewTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  previewLeg: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    paddingVertical: 2,
  },
  previewHint: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // Swimmer List
  swimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  swimmerRowActive: { backgroundColor: 'rgba(74, 14, 120, 0.2)' },
  selBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  selBadgeActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  selBadgeText: { fontFamily: fontFamily.stat, fontSize: fontSize.sm, color: colors.text },
  selBadgeTextActive: { color: colors.bgDeep },
  swimmerInfo: { flex: 1 },
  swimmerName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  swimmerGroup: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
});

export default withScreenErrorBoundary(RelayBuilderScreen, 'RelayBuilderScreen');
