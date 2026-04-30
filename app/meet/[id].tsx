import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import {
  subscribeEntries,
  deleteMeet,
  updateMeet,
  generatePsychSheet,
  getMeetStatusColor,
  getMeetStatusLabel,
} from '../../src/services/meets';
import PsychSheet from '../../src/components/PsychSheet';
import type { Meet, MeetEntry } from '../../src/types/meet.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };
type Tab = 'overview' | 'psych_sheet';

function MeetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [meet, setMeet] = useState<MeetWithId | null>(null);
  const [entries, setEntries] = useState<EntryWithId[]>([]);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'meets', id), (snap) => {
      if (snap.exists()) setMeet({ id: snap.id, ...snap.data() } as MeetWithId);
    });
  }, [id]);

  // Read-only legacy entries — drives the Psych Sheet tab. New entries cannot
  // be authored in the app since the manage-entries flow was removed.
  useEffect(() => {
    if (!id) return;
    return subscribeEntries(id, setEntries);
  }, [id]);

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete Meet', 'Are you sure? Legacy entries on this meet will be lost.', [
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
    { key: 'psych_sheet', label: 'PSYCH SHEET' },
  ];

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
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
            </View>

            {meet.groups.length > 0 && (
              <View style={styles.groupsRow}>
                {meet.groups.map((g) => (
                  <View
                    key={g}
                    style={[styles.groupChip, { borderColor: groupColors[g] || colors.border }]}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        { color: groupColors[g] || colors.textSecondary },
                      ]}
                    >
                      {g}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {meet.notes && (
              <View style={styles.notesCard}>
                <Text style={styles.notes}>{meet.notes}</Text>
              </View>
            )}

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
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: colors.goldDark }]}
                onPress={() => updateMeet(id!, { status: 'completed' })}
              >
                <Text style={styles.startBtnText}>COMPLETE MEET</Text>
              </TouchableOpacity>
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

        {/* Psych Sheet Tab */}
        {tab === 'psych_sheet' && <PsychSheet psychSheet={psychSheet} meetName={meet.name} />}
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
  tabBar: {
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 48,
  },
  tabBarContent: { paddingHorizontal: spacing.md, gap: spacing.xs },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  tabTextActive: { color: colors.accent },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  // Overview
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: spacing.sm,
  },
  statusText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  meetName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 2,
  },
  meetDate: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  // Info Card
  infoCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  infoValue: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  statLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  // Groups
  groupsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  groupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  groupChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm },
  // Notes
  notesCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  notes: { fontFamily: fontFamily.body, fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  // Status / Import / Delete
  startBtn: {
    backgroundColor: colors.purple,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  startBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  importBtn: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  importBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.gold,
    letterSpacing: 1,
  },
  deleteBtn: {
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  deleteBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.error },
});

export default withScreenErrorBoundary(MeetDetailScreen, 'MeetDetailScreen');
