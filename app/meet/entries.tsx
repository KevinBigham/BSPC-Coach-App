import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { subscribeEntries, addEntriesBatch, removeEntry } from '../../src/services/meets';
import { formatTime, calculateAge } from '../../src/data/timeStandards';
import type { Meet, MeetEntry } from '../../src/types/meet.types';
import type { Swimmer } from '../../src/types/firestore.types';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };

export default function EntriesScreen() {
  const { meetId } = useLocalSearchParams<{ meetId: string }>();
  const { coach } = useAuth();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [meet, setMeet] = useState<MeetWithId | null>(null);
  const [entries, setEntries] = useState<EntryWithId[]>([]);
  const [filterGroup, setFilterGroup] = useState<Group | 'All'>('All');
  const [saving, setSaving] = useState(false);

  // Track local selections: swimmerId_eventName → true/false
  const [selections, setSelections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!meetId) return;
    return onSnapshot(doc(db, 'meets', meetId), (snap) => {
      if (snap.exists()) setMeet({ id: snap.id, ...snap.data() } as MeetWithId);
    });
  }, [meetId]);

  useEffect(() => {
    if (!meetId) return;
    return subscribeEntries(meetId, (data) => {
      setEntries(data);
      // Initialize selections from existing entries
      const sel: Record<string, boolean> = {};
      for (const e of data) {
        sel[`${e.swimmerId}_${e.eventName}`] = true;
      }
      setSelections(sel);
    });
  }, [meetId]);

  const filteredSwimmers = useMemo(() => {
    const filtered = filterGroup === 'All'
      ? swimmers
      : swimmers.filter((s) => s.group === filterGroup);
    return filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [swimmers, filterGroup]);

  const individualEvents = meet?.events.filter((e) => !e.isRelay) || [];

  const toggleSelection = (swimmerId: string, eventName: string) => {
    const key = `${swimmerId}_${eventName}`;
    setSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!meetId || !meet || !coach) return;
    setSaving(true);
    try {
      // Find entries to add and remove
      const existingKeys = new Set(entries.map((e) => `${e.swimmerId}_${e.eventName}`));
      const newKeys = new Set(
        Object.entries(selections)
          .filter(([_, v]) => v)
          .map(([k]) => k),
      );

      // Remove unchecked
      const toRemove = entries.filter((e) => !newKeys.has(`${e.swimmerId}_${e.eventName}`));
      for (const entry of toRemove) {
        await removeEntry(meetId, entry.id);
      }

      // Add newly checked
      const toAdd: Omit<MeetEntry, 'id' | 'createdAt'>[] = [];
      for (const key of newKeys) {
        if (existingKeys.has(key)) continue;
        const [swimmerId, ...eventParts] = key.split('_');
        const eventName = eventParts.join('_');
        const swimmer = swimmers.find((s) => s.id === swimmerId);
        if (!swimmer) continue;

        const dob = swimmer.dateOfBirth instanceof Date
          ? swimmer.dateOfBirth
          : (swimmer.dateOfBirth as any)?.toDate?.() || new Date();
        const age = calculateAge(dob);
        const eventNum = meet.events.find((e) => e.name === eventName)?.number || 0;

        toAdd.push({
          meetId,
          swimmerId,
          swimmerName: `${swimmer.firstName} ${swimmer.lastName}`,
          group: swimmer.group,
          gender: swimmer.gender,
          age,
          eventName,
          eventNumber: eventNum,
        });
      }

      if (toAdd.length > 0) {
        await addEntriesBatch(meetId, toAdd);
      }

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  if (!meet) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ENTRIES</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
            {saving ? 'SAVING...' : 'SAVE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Group Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {['All' as const, ...GROUPS].map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.filterChip, filterGroup === g && styles.filterChipActive]}
            onPress={() => setFilterGroup(g)}
          >
            <Text style={[styles.filterChipText, filterGroup === g && styles.filterChipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Column Headers */}
        <View style={styles.headerRow}>
          <Text style={[styles.swimmerHeader, styles.colHeader]}>SWIMMER</Text>
          {individualEvents.map((e) => (
            <View key={e.name} style={styles.eventHeader}>
              <Text style={styles.colHeader} numberOfLines={2}>{e.name}</Text>
            </View>
          ))}
        </View>

        {/* Swimmer Rows */}
        {filteredSwimmers.map((swimmer) => (
          <View key={swimmer.id} style={styles.swimmerRow}>
            <View style={styles.swimmerInfo}>
              <Text style={styles.swimmerName} numberOfLines={1}>
                {swimmer.lastName}, {swimmer.firstName}
              </Text>
              <Text style={[styles.swimmerGroup, { color: groupColors[swimmer.group] || colors.textSecondary }]}>
                {swimmer.group}
              </Text>
            </View>
            {individualEvents.map((event) => {
              const key = `${swimmer.id}_${event.name}`;
              const isSelected = selections[key] || false;
              return (
                <TouchableOpacity
                  key={event.name}
                  style={[styles.checkbox, isSelected && styles.checkboxActive]}
                  onPress={() => toggleSelection(swimmer.id!, event.name)}
                >
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {filteredSwimmers.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No swimmers in this group</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgBase },
  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.bgDeep, borderBottomWidth: 2, borderBottomColor: colors.purple },
  cancelText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  title: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, letterSpacing: 1 },
  saveText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent, letterSpacing: 1 },
  // Filter
  filterBar: { backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 48 },
  filterContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  filterChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  filterChipTextActive: { color: colors.text },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  // Header Row
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, backgroundColor: colors.bgElevated, borderBottomWidth: 2, borderBottomColor: colors.border },
  swimmerHeader: { width: 120 },
  eventHeader: { width: 50, alignItems: 'center' },
  colHeader: { fontFamily: fontFamily.pixel, fontSize: 6, color: colors.textSecondary, letterSpacing: 1, textAlign: 'center' },
  // Swimmer Row
  swimmerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  swimmerInfo: { width: 120 },
  swimmerName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.text },
  swimmerGroup: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  // Checkbox
  checkbox: { width: 50, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.xs, backgroundColor: colors.bgDeep, marginHorizontal: 0 },
  checkboxActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  checkmark: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  // Empty
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
});
