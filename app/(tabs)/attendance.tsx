import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
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
import { GROUPS, type Group } from '../../src/config/constants';
import { getTodayString, formatClockTime } from '../../src/utils/time';
import { subscribeSwimmers } from '../../src/services/swimmers';
import {
  subscribeTodayAttendance,
  checkIn,
  checkOut,
  batchCheckIn,
} from '../../src/services/attendance';
import { exportAttendanceCSV, shareCSV } from '../../src/services/export';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { useAttendanceStore } from '../../src/stores/attendanceStore';
import type { Swimmer, AttendanceRecord, AttendanceStatus } from '../../src/types/firestore.types';

type FilterGroup = Group | 'All';

const STATUSES: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'normal', label: 'Normal', color: colors.success },
  { value: 'left_early', label: 'Left Early', color: colors.warning },
  { value: 'excused', label: 'Excused', color: colors.info },
  { value: 'sick', label: 'Sick', color: colors.error },
  { value: 'injured', label: 'Injured', color: colors.error },
];

export default function AttendanceScreen() {
  const { coach } = useAuth();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const todayRecords = useAttendanceStore((s) => s.todayRecords);
  const [selectedGroup, setSelectedGroup] = useState<FilterGroup>('All');
  const [checkoutModal, setCheckoutModal] = useState<{
    swimmer: Swimmer & { id: string };
    recordId: string;
  } | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<AttendanceStatus>('normal');
  const [checkoutNote, setCheckoutNote] = useState('');
  const today = getTodayString();

  const filtered = useMemo(() => {
    if (selectedGroup === 'All') return swimmers;
    return swimmers.filter((s) => s.group === selectedGroup);
  }, [swimmers, selectedGroup]);

  const getRecord = useCallback(
    (swimmerId: string) =>
      todayRecords.find((r) => r.swimmerId === swimmerId && !r.departedAt) ||
      todayRecords.find((r) => r.swimmerId === swimmerId),
    [todayRecords],
  );

  const presentIds = useMemo(() => {
    return new Set(todayRecords.filter((r) => !r.departedAt).map((r) => r.swimmerId));
  }, [todayRecords]);

  const presentCount = useMemo(() => {
    if (selectedGroup === 'All') return presentIds.size;
    return filtered.filter((s) => presentIds.has(s.id)).length;
  }, [presentIds, filtered, selectedGroup]);

  // Swimmers not yet checked in (for batch)
  const uncheckedSwimmers = useMemo(() => {
    const checkedIds = new Set(todayRecords.map((r) => r.swimmerId));
    return filtered.filter((s) => !checkedIds.has(s.id));
  }, [filtered, todayRecords]);

  const handleCheckIn = async (swimmer: Swimmer & { id: string }) => {
    if (!coach) return;
    const record = getRecord(swimmer.id);

    if (!record) {
      await checkIn(swimmer, { uid: coach.uid, displayName: coach.displayName }, today);
    } else if (!record.departedAt) {
      // Show checkout modal
      setCheckoutModal({ swimmer, recordId: record.id! });
      setCheckoutStatus('normal');
      setCheckoutNote('');
    } else {
      // Re-check-in
      await checkIn(swimmer, { uid: coach.uid, displayName: coach.displayName }, today);
    }
  };

  const handleCheckout = async () => {
    if (!checkoutModal) return;
    await checkOut(checkoutModal.recordId, checkoutStatus, checkoutNote.trim() || undefined);
    setCheckoutModal(null);
  };

  const handleBatchCheckIn = () => {
    if (uncheckedSwimmers.length === 0) {
      Alert.alert('All Checked In', 'Everyone in this group is already checked in.');
      return;
    }
    Alert.alert(
      'Batch Check-In',
      `Check in all ${uncheckedSwimmers.length} ${selectedGroup} swimmers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check In All',
          onPress: async () => {
            if (!coach) return;
            await batchCheckIn(
              uncheckedSwimmers,
              { uid: coach.uid, displayName: coach.displayName },
              today,
            );
          },
        },
      ],
    );
  };

  const renderSwimmer = ({ item }: { item: Swimmer & { id: string } }) => {
    const record = getRecord(item.id);
    const isPresent = record && !record.departedAt;
    const hasDeparted = record && record.departedAt;

    return (
      <TouchableOpacity
        style={[
          styles.swimmerRow,
          isPresent && styles.swimmerRowPresent,
          hasDeparted && styles.swimmerRowDeparted,
        ]}
        onPress={() => handleCheckIn(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isPresent
                ? colors.success
                : hasDeparted
                  ? colors.textSecondary
                  : 'transparent',
              borderColor: isPresent
                ? colors.success
                : hasDeparted
                  ? colors.textSecondary
                  : colors.border,
            },
          ]}
        />
        <View style={styles.swimmerInfo}>
          <Text style={styles.swimmerName}>
            {item.firstName} {item.lastName}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.groupLabel,
                { color: groupColors[item.group] || colors.textSecondary },
              ]}
            >
              {item.group}
            </Text>
            {record && (
              <Text style={styles.timeText}>
                {isPresent && record.arrivedAt
                  ? `In ${formatClockTime(record.arrivedAt instanceof Date ? record.arrivedAt : new Date())}`
                  : ''}
                {hasDeparted
                  ? `Departed${record.status && record.status !== 'normal' ? ` (${record.status})` : ''}`
                  : ''}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.tapHint}>
          {isPresent ? 'TAP OUT' : hasDeparted ? 'RE-CHECK' : 'TAP IN'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Scorebug Header */}
      <View style={styles.headerBug}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.headerLabel}>PRACTICE</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.presentCount}>{presentCount}</Text>
          <Text style={styles.presentSep}>/</Text>
          <Text style={styles.totalCount}>{filtered.length}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={async () => {
              try {
                const csv = exportAttendanceCSV(todayRecords);
                await shareCSV('bspc_attendance.csv', csv);
              } catch (err: unknown) {
                Alert.alert('Export Error', err instanceof Error ? err.message : String(err));
              }
            }}
          >
            <Text style={styles.exportBtnText}>EXPORT</Text>
          </TouchableOpacity>
          <Text style={styles.headerLabel}>PRESENT</Text>
        </View>
      </View>

      {/* Group Filter + Batch Button */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['All' as const, ...GROUPS]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item: group }) => {
            const count =
              group === 'All' ? swimmers.length : swimmers.filter((s) => s.group === group).length;
            return (
              <TouchableOpacity
                style={[styles.filterChip, selectedGroup === group && styles.filterChipActive]}
                onPress={() => setSelectedGroup(group)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedGroup === group && styles.filterChipTextActive,
                  ]}
                >
                  {group} ({count})
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        {selectedGroup !== 'All' && uncheckedSwimmers.length > 0 && (
          <TouchableOpacity style={styles.batchBtn} onPress={handleBatchCheckIn}>
            <Text style={styles.batchBtnText}>CHECK IN ALL ({uncheckedSwimmers.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Swimmer List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderSwimmer}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>NO SWIMMERS</Text>
            <Text style={styles.emptySubtitle}>Add swimmers in the Roster tab first</Text>
          </View>
        }
      />

      {/* Checkout Modal */}
      {checkoutModal && (
        <Modal transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>CHECK OUT</Text>
              <Text style={styles.modalSubtitle}>
                {checkoutModal.swimmer.firstName} {checkoutModal.swimmer.lastName}
              </Text>

              <Text style={styles.modalLabel}>STATUS</Text>
              <View style={styles.statusGrid}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.statusChip,
                      checkoutStatus === s.value && {
                        backgroundColor: s.color,
                        borderColor: s.color,
                      },
                    ]}
                    onPress={() => setCheckoutStatus(s.value)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        checkoutStatus === s.value && { color: colors.bgDeep },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={styles.modalInput}
                value={checkoutNote}
                onChangeText={setCheckoutNote}
                placeholder="e.g. Left for dentist appointment"
                placeholderTextColor={colors.textSecondary}
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setCheckoutModal(null)}
                >
                  <Text style={styles.modalCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCheckoutBtn} onPress={handleCheckout}>
                  <Text style={styles.modalCheckoutText}>CHECK OUT</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  // Scorebug Header
  headerBug: {
    backgroundColor: colors.bgDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  headerLeft: { alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
  exportBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  exportBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 1,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'baseline' },
  headerDate: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  headerLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  presentCount: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.success,
    lineHeight: 52,
  },
  presentSep: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  totalCount: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.textSecondary,
    lineHeight: 52,
  },
  // Filters
  filterContainer: {
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  filterChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: { color: colors.text },
  batchBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  batchBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    letterSpacing: 1,
  },
  // List
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  swimmerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swimmerRowPresent: { borderColor: colors.success, backgroundColor: 'rgba(204, 176, 0, 0.06)' },
  swimmerRowDeparted: { opacity: 0.5 },
  statusDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginRight: spacing.md },
  swimmerInfo: { flex: 1 },
  swimmerName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  groupLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  timeText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  tapHint: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
  },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.text },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  // Checkout Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.accent,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  modalLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  statusChipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgBase,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalCancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  modalCheckoutBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  modalCheckoutText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
});
