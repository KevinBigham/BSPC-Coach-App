import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { GROUPS, NOTE_TAGS, type Group, type NoteTag } from '../../src/config/constants';
import { getTodayString } from '../../src/utils/time';
import { formatRelativeTime, toDateSafe, type FirestoreTimestampLike } from '../../src/utils/date';
import { addGroupNote, deleteGroupNote } from '../../src/services/groupNotes';
import {
  deletePracticePlan,
  duplicateAsTemplate,
  calculateTotalYardage,
} from '../../src/services/practicePlans';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { tapLight, notifySuccess } from '../../src/utils/haptics';
import { usePracticeData, type PlanWithId } from '../../src/hooks/usePracticeData';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function PracticeScreen() {
  const { coach } = useAuth();
  const { plans, groupNotes, loading } = usePracticeData();
  const [selectedPlan, setSelectedPlan] = useState<PlanWithId | null>(null);
  // Zustand stays on the screen: it owns builder draft/undo lifecycle, not subscribed list data.
  const store = usePracticeStore();

  const [gnGroup, setGnGroup] = useState<Group>(GROUPS[0]);
  const [gnText, setGnText] = useState('');
  const [gnTags, setGnTags] = useState<NoteTag[]>([]);
  const [gnSaving, setGnSaving] = useState(false);

  const handleAddGroupNote = async () => {
    if (!gnText.trim() || !coach) return;
    setGnSaving(true);
    try {
      await addGroupNote(
        gnText.trim(),
        gnTags,
        gnGroup,
        coach.uid,
        coach.displayName || 'Unknown',
        getTodayString(),
      );
      notifySuccess();
      setGnText('');
      setGnTags([]);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
    setGnSaving(false);
  };

  const handleDeleteGroupNote = (noteId: string) => {
    Alert.alert('Delete Note', 'Delete this group note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          tapLight();
          void deleteGroupNote(noteId);
        },
      },
    ]);
  };

  const handleDelete = (plan: PlanWithId) => {
    Alert.alert('Delete Plan', `Delete "${plan.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePracticePlan(plan.id);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  };

  const handleDuplicate = async (plan: PlanWithId) => {
    try {
      await duplicateAsTemplate(plan, coach?.uid || '', coach?.displayName || 'Coach');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
  };

  const handleEdit = (plan: PlanWithId) => {
    store.loadPlan(plan);
    router.push({ pathname: '/practice/builder', params: { planId: plan.id } });
  };

  const handleCreate = () => {
    store.reset();
    router.push('/practice/builder');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Detail view
  if (selectedPlan) {
    const totalYardage = calculateTotalYardage(selectedPlan.sets);

    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedPlan(null)} style={styles.backButton}>
            <Text style={styles.backText}>← BACK</Text>
          </TouchableOpacity>
          <View style={styles.detailActions}>
            <TouchableOpacity
              onPress={() => {
                setSelectedPlan(null);
                handleEdit(selectedPlan);
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDuplicate(selectedPlan)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>COPY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                handleDelete(selectedPlan);
                setSelectedPlan(null);
              }}
              style={[styles.actionBtn, { borderColor: colors.error }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.error }]}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.detailTitle}>{selectedPlan.title.toUpperCase()}</Text>
          {selectedPlan.description ? (
            <Text style={styles.detailDesc}>{selectedPlan.description}</Text>
          ) : null}

          <View style={styles.detailStatsRow}>
            <View style={styles.detailStatBox}>
              <Text style={styles.detailStatNum}>{selectedPlan.sets.length}</Text>
              <Text style={styles.detailStatLabel}>SETS</Text>
            </View>
            <View style={styles.detailStatBox}>
              <Text style={styles.detailStatNum}>{totalYardage.toLocaleString()}</Text>
              <Text style={styles.detailStatLabel}>YARDS</Text>
            </View>
            {selectedPlan.group && (
              <View style={styles.detailStatBox}>
                <Text
                  style={[
                    styles.detailStatNum,
                    {
                      color: groupColors[selectedPlan.group] || colors.accent,
                      fontSize: fontSize.lg,
                    },
                  ]}
                >
                  {selectedPlan.group}
                </Text>
                <Text style={styles.detailStatLabel}>GROUP</Text>
              </View>
            )}
          </View>

          {selectedPlan.sets.map((set, si) => (
            <View key={si} style={styles.setCard}>
              <View style={styles.setHeader}>
                <Text style={styles.setName}>{set.name.toUpperCase()}</Text>
                {set.category && <Text style={styles.setCategoryLabel}>{set.category}</Text>}
                {set.description ? <Text style={styles.setDesc}>{set.description}</Text> : null}
              </View>
              {set.items.map((item, ii) => {
                const yardage = item.reps * item.distance;
                return (
                  <View key={ii} style={styles.setItem}>
                    <View style={styles.setItemLeft}>
                      <Text style={styles.setItemMain}>
                        {item.reps} × {item.distance} {item.stroke}
                      </Text>
                      {item.interval && (
                        <Text style={styles.setItemInterval}>@ {item.interval}</Text>
                      )}
                      {item.description && (
                        <Text style={styles.setItemDesc}>{item.description}</Text>
                      )}
                    </View>
                    <Text style={styles.setItemYardage}>{yardage}</Text>
                    {item.focusPoints && item.focusPoints.length > 0 && (
                      <View style={styles.focusRow}>
                        {item.focusPoints.map((fp, fi) => (
                          <View key={fi} style={styles.focusBadge}>
                            <Text style={styles.focusText}>{fp}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // List view
  const templates = plans.filter((p) => p.isTemplate);
  const scheduled = plans.filter((p) => !p.isTemplate);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pixelLabel}>PRACTICE</Text>
        <Text style={styles.screenTitle}>PLANS</Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate}>
            <Text style={styles.primaryBtnText}>+ NEW PRACTICE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/practice/templates')}
          >
            <Text style={styles.secondaryBtnText}>TEMPLATES</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.libraryBtn}
            onPress={() => router.push('/practice/library')}
          >
            <Text style={styles.libraryBtnText}>LIBRARY</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.libraryBtn}
            onPress={() => router.push('/practice/browse')}
          >
            <Text style={styles.libraryBtnText}>PUBLIC PLANS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={() => router.push('/practice/ai-generate')}
          >
            <Text style={styles.aiBtnText}>AI GENERATE</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{templates.length}</Text>
            <Text style={styles.statLabel}>TEMPLATES</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{scheduled.length}</Text>
            <Text style={styles.statLabel}>SCHEDULED</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{plans.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
        </View>

        {/* Templates */}
        {templates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TEMPLATES</Text>
            {templates.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onPress={() => setSelectedPlan(plan)} />
            ))}
          </View>
        )}

        {/* Scheduled Plans */}
        {scheduled.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SCHEDULED</Text>
            {scheduled.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onPress={() => setSelectedPlan(plan)} />
            ))}
          </View>
        )}

        {plans.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyPixel}>NO PLANS YET</Text>
            <Text style={styles.emptyText}>
              Create your first practice plan with sets, intervals, and focus points.
            </Text>
          </View>
        )}

        {/* ── Group Notes Section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GROUP NOTES</Text>

          {/* Add Group Note Form */}
          <View style={styles.gnForm}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: spacing.sm }}
            >
              <View style={styles.gnGroupRow}>
                {GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.gnGroupChip,
                      gnGroup === g && {
                        backgroundColor: colors.purple,
                        borderColor: groupColors[g],
                      },
                    ]}
                    onPress={() => setGnGroup(g)}
                  >
                    <Text
                      style={[styles.gnGroupChipText, gnGroup === g && { color: groupColors[g] }]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={styles.gnInput}
              value={gnText}
              onChangeText={setGnText}
              placeholder="Group practice observation..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: spacing.sm }}
            >
              <View style={styles.gnTagRow}>
                {NOTE_TAGS.slice(0, 10).map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.gnTag, gnTags.includes(tag) && styles.gnTagActive]}
                    onPress={() =>
                      setGnTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                      )
                    }
                  >
                    <Text
                      style={[styles.gnTagText, gnTags.includes(tag) && styles.gnTagTextActive]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.gnSaveBtn, (!gnText.trim() || gnSaving) && { opacity: 0.5 }]}
              onPress={handleAddGroupNote}
              disabled={!gnText.trim() || gnSaving}
            >
              <Text style={styles.gnSaveBtnText}>{gnSaving ? 'SAVING...' : 'ADD GROUP NOTE'}</Text>
            </TouchableOpacity>
          </View>

          {/* Group Notes List */}
          {groupNotes.slice(0, 15).map((note) => {
            const createdAt = toDateSafe(note.createdAt as FirestoreTimestampLike) ?? new Date();
            return (
              <TouchableOpacity
                key={note.id}
                style={styles.gnCard}
                onLongPress={() => {
                  if (note.coachId === coach?.uid) handleDeleteGroupNote(note.id);
                }}
              >
                <View style={styles.gnCardHeader}>
                  <View
                    style={[
                      styles.gnCardGroupBadge,
                      { borderColor: groupColors[note.group] || colors.purple },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gnCardGroupText,
                        { color: groupColors[note.group] || colors.accent },
                      ]}
                    >
                      {note.group}
                    </Text>
                  </View>
                  <Text style={styles.gnCardCoach}>{note.coachName}</Text>
                  <Text style={styles.gnCardTime}>{formatRelativeTime(createdAt)}</Text>
                </View>
                <Text style={styles.gnCardContent}>{note.content}</Text>
                {note.tags?.length > 0 && (
                  <View style={styles.gnCardTags}>
                    {note.tags.map((t) => (
                      <View key={t} style={styles.gnCardTag}>
                        <Text style={styles.gnCardTagText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {groupNotes.length === 0 && <Text style={styles.emptyText}>No group notes yet</Text>}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleCreate}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Plan Card (list item)
// ────────────────────────────────────────────────────────────────────────────

function PlanCard({ plan, onPress }: { plan: PlanWithId; onPress: () => void }) {
  const totalYardage = calculateTotalYardage(plan.sets);

  return (
    <TouchableOpacity style={styles.planCard} onPress={onPress}>
      <View style={styles.planCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planTitle}>{plan.title.toUpperCase()}</Text>
          {plan.description ? (
            <Text style={styles.planDesc} numberOfLines={1}>
              {plan.description}
            </Text>
          ) : null}
        </View>
        {plan.group && (
          <View
            style={[
              styles.planGroupBadge,
              { borderColor: groupColors[plan.group] || colors.purple },
            ]}
          >
            <Text
              style={[styles.planGroupText, { color: groupColors[plan.group] || colors.accent }]}
            >
              {plan.group}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.planCardMeta}>
        <Text style={styles.planMetaText}>{plan.sets.length} sets</Text>
        <Text style={styles.planMetaDot}>·</Text>
        <Text style={styles.planMetaText}>{totalYardage.toLocaleString()} yds</Text>
        {plan.date && (
          <>
            <Text style={styles.planMetaDot}>·</Text>
            <Text style={styles.planMetaText}>{plan.date}</Text>
          </>
        )}
        {plan.isTemplate && (
          <View style={styles.templateBadge}>
            <Text style={styles.templateBadgeText}>TEMPLATE</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  scrollArea: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl + 60 },

  // List Header
  header: {
    backgroundColor: '#12081f',
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  screenTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 2,
  },

  // Action Buttons
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  secondaryBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.purple,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.accent,
    letterSpacing: 1,
  },
  libraryBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
  },
  libraryBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    letterSpacing: 1,
  },
  aiBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  aiBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.gold,
    letterSpacing: 1,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  statLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },

  // Section
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  // Plan Card
  planCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  planDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  planGroupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  planGroupText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  planCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  planMetaText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  planMetaDot: { color: colors.textSecondary, fontSize: fontSize.xs },
  templateBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.gold,
    marginLeft: spacing.sm,
  },
  templateBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold },

  // Empty State
  emptyState: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  emptyPixel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.purpleGlow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: { fontFamily: fontFamily.heading, fontSize: 32, color: colors.text, marginTop: -2 },

  // Detail
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.text },
  backButton: { paddingVertical: spacing.xs },
  backText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent },
  detailTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 2,
  },
  detailDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  detailStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailStatBox: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailStatNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, color: colors.accent },
  detailStatLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },

  // Set Card (detail view)
  setCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setHeader: {
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  setName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.gold,
    letterSpacing: 1,
  },
  setCategoryLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  setDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  setItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  setItemLeft: { flex: 1 },
  setItemMain: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  setItemInterval: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 2,
  },
  setItemDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  setItemYardage: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    width: '100%',
  },
  focusBadge: {
    backgroundColor: 'rgba(74,14,120,0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  focusText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.purpleLight },

  // Group Notes
  gnForm: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  gnGroupRow: { flexDirection: 'row', gap: spacing.xs },
  gnGroupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  gnGroupChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  gnInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.bgBase,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  gnTagRow: { flexDirection: 'row', gap: spacing.xs },
  gnTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gnTagActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  gnTagText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  gnTagTextActive: { color: colors.text },
  gnSaveBtn: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  gnSaveBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  gnCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gnCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gnCardGroupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gnCardGroupText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  gnCardCoach: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.accent },
  gnCardTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  gnCardContent: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  gnCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  gnCardTag: {
    backgroundColor: 'rgba(74, 14, 120, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  gnCardTagText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.purpleLight,
  },
});

export default withScreenErrorBoundary(PracticeScreen, 'PracticeScreen');
