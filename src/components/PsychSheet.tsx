import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../config/theme';
import type { PsychSheetEntry } from '../types/meet.types';

interface PsychSheetProps {
  psychSheet: PsychSheetEntry[];
  meetName: string;
}

export default function PsychSheet({ psychSheet, meetName }: PsychSheetProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.meetName}>{meetName.toUpperCase()}</Text>
      <Text style={styles.subtitle}>PSYCH SHEET</Text>

      {psychSheet.map((event, ei) => (
        <View key={ei} style={styles.eventBlock}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventNumber}>#{event.eventNumber}</Text>
            <Text style={styles.eventName}>{event.eventName}</Text>
            <Text style={styles.eventGender}>{event.gender === 'M' ? 'BOYS' : 'GIRLS'}</Text>
          </View>

          {/* Column Headers */}
          <View style={styles.entryRow}>
            <Text style={[styles.rankCol, styles.colHeader]}>#</Text>
            <Text style={[styles.nameCol, styles.colHeader]}>NAME</Text>
            <Text style={[styles.groupCol, styles.colHeader]}>GRP</Text>
            <Text style={[styles.ageCol, styles.colHeader]}>AGE</Text>
            <Text style={[styles.timeCol, styles.colHeader]}>SEED</Text>
          </View>

          {event.entries.map((entry, ri) => (
            <View key={ri} style={[styles.entryRow, ri % 2 === 0 && styles.entryRowAlt]}>
              <Text style={styles.rankCol}>{ri + 1}</Text>
              <Text style={styles.nameCol} numberOfLines={1}>{entry.swimmerName}</Text>
              <Text style={[styles.groupCol, { color: groupColors[entry.group] || colors.textSecondary }]}>
                {entry.group}
              </Text>
              <Text style={styles.ageCol}>{entry.age}</Text>
              <Text style={styles.timeCol}>{entry.seedTimeDisplay}</Text>
            </View>
          ))}

          {event.entries.length === 0 && (
            <Text style={styles.noEntries}>No entries</Text>
          )}
        </View>
      ))}

      {psychSheet.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No entries to display</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  meetName: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.text, letterSpacing: 2, textAlign: 'center' },
  subtitle: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 2, textAlign: 'center', marginBottom: spacing.xl },
  // Event Block
  eventBlock: { backgroundColor: colors.bgDeep, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.bgSurface, gap: spacing.sm },
  eventNumber: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary, width: 30 },
  eventName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text, flex: 1 },
  eventGender: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.accent, letterSpacing: 1 },
  // Entry Row
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  entryRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  colHeader: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  rankCol: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary, width: 24 },
  nameCol: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text, flex: 1, marginRight: spacing.sm },
  groupCol: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, width: 50, textAlign: 'center' },
  ageCol: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary, width: 30, textAlign: 'center' },
  timeCol: { fontFamily: fontFamily.statMono, fontSize: fontSize.sm, color: colors.accent, width: 60, textAlign: 'right' },
  noEntries: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, padding: spacing.md, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyText: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
});
