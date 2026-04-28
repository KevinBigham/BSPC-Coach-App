import { useState, useEffect, useMemo } from 'react';
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
import { Stack } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { useSwimmersStore } from '../src/stores/swimmersStore';
import {
  subscribePendingDrafts,
  approveDraft,
  rejectDraft,
  approveAllDrafts,
  checkAndCompleteSession,
  type DraftWithContext,
} from '../src/services/aiDrafts';
import { NOTE_TAGS, type NoteTag } from '../src/config/constants';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { tapLight, notifySuccess } from '../src/utils/haptics';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import type { Swimmer } from '../src/types/firestore.types';

function AIReviewScreen() {
  const { coach } = useAuth();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [drafts, setDrafts] = useState<DraftWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<NoteTag[]>([]);

  // Indexed lookup so the COPPA backstop on approveDraft / approveAllDrafts
  // can resolve a draft's swimmerId to its current consent state in O(1).
  const swimmersById = useMemo(() => {
    const map = new Map<string, Swimmer>();
    for (const s of swimmers) {
      if (s.id) map.set(s.id, s);
    }
    return map;
  }, [swimmers]);

  useEffect(() => {
    const unsub = subscribePendingDrafts((d) => {
      setDrafts(d);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleApprove = async (draft: DraftWithContext) => {
    if (!coach) return;
    tapLight();
    setProcessing((prev) => new Set(prev).add(draft.id));

    try {
      const content = editingDraft === draft.id ? editContent : undefined;
      const tags = editingDraft === draft.id ? editTags : undefined;
      const swimmer = swimmersById.get(draft.swimmerId);

      await approveDraft(draft.sessionId, draft.id, draft, coach.uid, content, tags, swimmer);
      await checkAndCompleteSession(draft.sessionId);
      notifySuccess();
      setEditingDraft(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(draft.id);
      return next;
    });
  };

  const handleReject = async (draft: DraftWithContext) => {
    if (!coach) return;
    Alert.alert('Reject Draft', 'This AI observation will be discarded.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          tapLight();
          setProcessing((prev) => new Set(prev).add(draft.id));
          try {
            await rejectDraft(draft.sessionId, draft.id, coach.uid);
            await checkAndCompleteSession(draft.sessionId);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : String(err));
          }
          setProcessing((prev) => {
            const next = new Set(prev);
            next.delete(draft.id);
            return next;
          });
        },
      },
    ]);
  };

  const handleApproveAll = async () => {
    if (!coach || drafts.length === 0) return;
    Alert.alert('Approve All', `Post all ${drafts.length} AI observations to swimmer profiles?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve All',
        onPress: async () => {
          setLoading(true);
          try {
            await approveAllDrafts(drafts, coach.uid, coach.displayName || 'Unknown', swimmersById);
            // Check all unique sessions
            const sessionIds = [...new Set(drafts.map((d) => d.sessionId))];
            for (const sid of sessionIds) {
              await checkAndCompleteSession(sid);
            }
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : String(err));
          }
          setLoading(false);
        },
      },
    ]);
  };

  const startEditing = (draft: DraftWithContext) => {
    setEditingDraft(draft.id);
    setEditContent(draft.observation);
    setEditTags(draft.tags as NoteTag[]);
  };

  const toggleEditTag = (tag: NoteTag) => {
    setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'AI DRAFTS' }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerCount}>{drafts.length}</Text>
            <Text style={styles.headerLabel}>PENDING REVIEW</Text>
          </View>
          {drafts.length > 0 && (
            <TouchableOpacity style={styles.approveAllBtn} onPress={handleApproveAll}>
              <Text style={styles.approveAllBtnText}>APPROVE ALL</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {drafts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>ALL CLEAR</Text>
              <Text style={styles.emptyHint}>
                No AI drafts pending review. Record audio during practice to generate AI
                observations.
              </Text>
            </View>
          ) : (
            drafts.map((draft) => {
              const isEditing = editingDraft === draft.id;
              const isProcessing = processing.has(draft.id);

              return (
                <View key={draft.id} style={styles.draftCard}>
                  {/* Swimmer Name */}
                  <Text style={styles.draftSwimmer}>{draft.swimmerName}</Text>

                  {/* Confidence Bar */}
                  <View style={styles.confidenceRow}>
                    <View style={styles.confidenceBar}>
                      <View
                        style={[
                          styles.confidenceFill,
                          {
                            width: `${Math.round(draft.confidence * 100)}%`,
                            backgroundColor:
                              draft.confidence > 0.8
                                ? colors.success
                                : draft.confidence > 0.5
                                  ? colors.warning
                                  : colors.error,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidenceText}>{Math.round(draft.confidence * 100)}%</Text>
                  </View>

                  {/* Observation */}
                  {isEditing ? (
                    <TextInput
                      style={styles.editInput}
                      value={editContent}
                      onChangeText={setEditContent}
                      multiline
                    />
                  ) : (
                    <TouchableOpacity onPress={() => startEditing(draft)}>
                      <Text style={styles.draftObservation}>{draft.observation}</Text>
                      <Text style={styles.tapToEdit}>tap to edit</Text>
                    </TouchableOpacity>
                  )}

                  {/* Tags */}
                  {isEditing ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.tagScroll}
                    >
                      <View style={styles.tagRow}>
                        {NOTE_TAGS.map((tag) => (
                          <TouchableOpacity
                            key={tag}
                            style={[styles.tag, editTags.includes(tag) && styles.tagActive]}
                            onPress={() => toggleEditTag(tag)}
                          >
                            <Text
                              style={[
                                styles.tagText,
                                editTags.includes(tag) && styles.tagTextActive,
                              ]}
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  ) : (
                    draft.tags.length > 0 && (
                      <View style={styles.tagRow}>
                        {draft.tags.map((tag) => (
                          <View key={tag} style={[styles.tag, styles.tagActive]}>
                            <Text style={[styles.tagText, styles.tagTextActive]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )
                  )}

                  {/* Actions */}
                  <View style={styles.draftActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, isProcessing && { opacity: 0.5 }]}
                      onPress={() => handleReject(draft)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.rejectBtnText}>REJECT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, isProcessing && { opacity: 0.5 }]}
                      onPress={() => handleApprove(draft)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.approveBtnText}>
                        {isProcessing ? 'POSTING...' : 'APPROVE'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {draft.sessionGroup && (
                    <Text style={styles.draftGroup}>from {draft.sessionGroup} session</Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCount: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.gold },
  headerLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  approveAllBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  approveAllBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    letterSpacing: 1,
  },

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyTitle: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixelLg,
    color: colors.success,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  emptyHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Draft Card
  draftCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  draftSwimmer: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: { height: '100%', borderRadius: 2 },
  confidenceText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  draftObservation: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  tapToEdit: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.bgBase,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Tags
  tagScroll: { marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: { backgroundColor: 'rgba(74, 14, 120, 0.3)', borderColor: colors.purple },
  tagText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  tagTextActive: { color: colors.purpleLight },

  // Actions
  draftActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  rejectBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  rejectBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.error,
    letterSpacing: 1,
  },
  approveBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  approveBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
    letterSpacing: 1,
  },
  draftGroup: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});

export default withScreenErrorBoundary(AIReviewScreen, 'AIReviewScreen');
