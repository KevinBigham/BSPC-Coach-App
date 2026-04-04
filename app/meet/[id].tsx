import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import {
  subscribeEntries,
  subscribeRelays,
  deleteMeet,
  updateMeet,
  generatePsychSheet,
  getMeetStatusColor,
  getMeetStatusLabel,
} from '../../src/services/meets';
import { useMeetStore } from '../../src/stores/meetStore';
import { formatTime } from '../../src/data/timeStandards';
import { formatRelayLeg, estimateRelayTime } from '../../src/utils/relay';
import PsychSheet from '../../src/components/PsychSheet';
import type { Meet, MeetEntry, Relay } from '../../src/types/meet.types';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };
type RelayWithId = Relay & { id: string };
type Tab = 'overview' | 'entries' | 'relays' | 'psych_sheet';

export default function MeetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach } = useAuth();
  const [meet, setMeet] = useState<MeetWithId | null>(null);
  const [entries, setEntries] = useState<EntryWithId[]>([]);
  const [relays, setRelays] = useState<RelayWithId[]>([]);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'meets', id), (snap) => {
      if (snap.exists()) setMeet({ id: snap.id, ...snap.data() } as MeetWithId);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeEntries(id, setEntries);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeRelays(id, setRelays);
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Meet', 'Are you sure? All entries and relays will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMeet(id);
          router.back();
        },
      },
    ]);
  };

  if (!meet) return null;

  const statusColor = getMeetStatusColor(meet.status);
  const uniqueSwimmers = new Set(entries.map((e) => e.swimmerId)).size;
  const uniqueEvents = new Set(entries.map((e) => e.eventName)).size;
  const psychSheet = generatePsychSheet(entries);

  const displayDate = new Date(meet.startDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'entries', label: `ENTRIES (${entries.length})` },
    { key: 'relays', label: `RELAYS (${relays.length})` },
    { key: 'psych_sheet', label: 'PSYCH SHEET' },
  ];

  // Group entries by event for the entries tab
  const entriesByEvent: Record<string, EntryWithId[]> = {};
  for (const entry of entries) {
    const key = entry.eventName;
    if (!entriesByEvent[key]) entriesByEvent[key] = [];
    entriesByEvent[key].push(entry);
  }
  // Sort within each event by seed time
  for (const key of Object.keys(entriesByEvent)) {
    entriesByEvent[key].sort((a, b) => (a.seedTime || Infinity) - (b.seedTime || Infinity));
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Overview Tab */}
        {tab === 'overview' && (
          <>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getMeetStatusLabel(meet.status).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.meetName}>{meet.name}</Text>
            <Text style={styles.meetDate}>{displayDate}</Text>

            <View style={styles.infoCard}>
              <InfoRow label="LOCATION" value={meet.location} />
              <InfoRow label="COURSE" value={meet.course} />
              {meet.hostTeam && <InfoRow label="HOST" value={meet.hostTeam} />}
              {meet.sanctionNumber && <InfoRow label="SANCTION" value={meet.sanctionNumber} />}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{uniqueSwimmers}</Text>
                <Text style={styles.statLabel}>SWIMMERS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{entries.length}</Text>
                <Text style={styles.statLabel}>ENTRIES</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{uniqueEvents}</Text>
                <Text style={styles.statLabel}>EVENTS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{relays.length}</Text>
                <Text style={styles.statLabel}>RELAYS</Text>
              </View>
            </View>

            {meet.groups.length > 0 && (
              <View style={styles.groupsRow}>
                {meet.groups.map((g) => (
                  <View key={g} style={[styles.groupChip, { borderColor: groupColors[g] || colors.border }]}>
                    <Text style={[styles.groupChipText, { color: groupColors[g] || colors.textSecondary }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {meet.notes && (
              <View style={styles.notesCard}>
                <Text style={styles.notes}>{meet.notes}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: '/meet/entries', params: { meetId: id } })}
              >
                <Text style={styles.actionBtnText}>MANAGE ENTRIES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: '/meet/relay-builder', params: { meetId: id } })}
              >
                <Text style={styles.actionBtnText}>BUILD RELAYS</Text>
              </TouchableOpacity>
            </View>

            {/* Status Controls */}
            {meet.status === 'upcoming' && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => updateMeet(id!, { status: 'in_progress' })}
              >
                <Text style={styles.startBtnText}>START MEET</Text>
              </TouchableOpacity>
            )}
            {meet.status === 'in_progress' && (
              <View style={{ gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: colors.gold }]}
                  onPress={() => router.push(`/meet/${id}/live`)}
                >
                  <Text style={[styles.startBtnText, { color: colors.bgDeep }]}>LIVE TIMING MODE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.startBtn, { backgroundColor: colors.goldDark }]}
                  onPress={() => updateMeet(id!, { status: 'completed' })}
                >
                  <Text style={styles.startBtnText}>COMPLETE MEET</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => router.push(`/meet-import?meetId=${id}`)}
            >
              <Text style={styles.importBtnText}>IMPORT RESULTS (SDIF / HY3)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>DELETE MEET</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Entries Tab */}
        {tab === 'entries' && (
          <>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => router.push({ pathname: '/meet/entries', params: { meetId: id } })}
            >
              <Text style={styles.manageBtnText}>+ ADD / REMOVE ENTRIES</Text>
            </TouchableOpacity>

            {Object.entries(entriesByEvent).map(([eventName, eventEntries]) => (
              <View key={eventName} style={styles.eventBlock}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventName}>{eventName}</Text>
                  <Text style={styles.eventCount}>{eventEntries.length}</Text>
                </View>
                {eventEntries.map((entry) => (
                  <View key={entry.id} style={styles.entryRow}>
                    <Text style={styles.entryName}>{entry.swimmerName}</Text>
                    <Text style={[styles.entryGroup, { color: groupColors[entry.group] || colors.textSecondary }]}>
                      {entry.group}
                    </Text>
                    <Text style={styles.entrySeed}>
                      {entry.seedTimeDisplay || (entry.seedTime ? formatTime(entry.seedTime) : 'NT')}
                    </Text>
                  </View>
                ))}
              </View>
            ))}

            {entries.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>NO ENTRIES</Text>
                <Text style={styles.emptyText}>Add swimmers to events</Text>
              </View>
            )}
          </>
        )}

        {/* Relays Tab */}
        {tab === 'relays' && (
          <>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => router.push({ pathname: '/meet/relay-builder', params: { meetId: id } })}
            >
              <Text style={styles.manageBtnText}>+ BUILD RELAY</Text>
            </TouchableOpacity>

            {relays.map((relay) => (
              <View key={relay.id} style={styles.relayCard}>
                <View style={styles.relayHeader}>
                  <Text style={styles.relayEvent}>{relay.eventName}</Text>
                  <Text style={styles.relayTeam}>{relay.teamName}</Text>
                </View>
                {relay.legs.map((leg) => (
                  <Text key={leg.order} style={styles.relayLeg}>
                    {formatRelayLeg(leg)}
                  </Text>
                ))}
                <View style={styles.relayFooter}>
                  <Text style={styles.relayEstLabel}>EST. TIME</Text>
                  <Text style={styles.relayEstTime}>
                    {relay.estimatedTimeDisplay || (relay.estimatedTime ? formatTime(relay.estimatedTime) : 'N/A')}
                  </Text>
                </View>
              </View>
            ))}

            {relays.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>NO RELAYS</Text>
                <Text style={styles.emptyText}>Build relay teams</Text>
              </View>
            )}
          </>
        )}

        {/* Psych Sheet Tab */}
        {tab === 'psych_sheet' && (
          <PsychSheet psychSheet={psychSheet} meetName={meet.name} />
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Tabs
  tabBar: { backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border, maxHeight: 48 },
  tabBarContent: { paddingHorizontal: spacing.md, gap: spacing.xs },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  tabTextActive: { color: colors.accent },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  // Overview
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.xs, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: spacing.sm },
  statusText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  meetName: { fontFamily: fontFamily.heading, fontSize: fontSize.xxxl, color: colors.text, letterSpacing: 2 },
  meetDate: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.lg },
  // Info Card
  infoCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  infoValue: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  statLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  // Groups
  groupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  groupChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm },
  // Notes
  notesCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  notes: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  // Actions
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 2, borderColor: colors.purple, alignItems: 'center' },
  actionBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent, letterSpacing: 1 },
  startBtn: { backgroundColor: colors.purple, padding: spacing.lg, borderRadius: borderRadius.md, alignItems: 'center', marginBottom: spacing.md },
  startBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, letterSpacing: 1 },
  importBtn: { padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', marginBottom: spacing.md },
  importBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.gold, letterSpacing: 1 },
  deleteBtn: { padding: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
  deleteBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.error },
  // Entries Tab
  manageBtn: { padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 2, borderColor: colors.purple, borderStyle: 'dashed', alignItems: 'center', marginBottom: spacing.lg },
  manageBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.accent, letterSpacing: 1 },
  eventBlock: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.bgSurface },
  eventName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  eventCount: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  entryName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text, flex: 1 },
  entryGroup: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, width: 60, textAlign: 'center' },
  entrySeed: { fontFamily: fontFamily.statMono, fontSize: fontSize.sm, color: colors.accent, width: 65, textAlign: 'right' },
  // Relays Tab
  relayCard: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  relayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  relayEvent: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  relayTeam: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  relayLeg: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, paddingVertical: 2 },
  relayFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  relayEstLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  relayEstTime: { fontFamily: fontFamily.stat, fontSize: fontSize.xl, color: colors.accent },
  // Empty
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
});
