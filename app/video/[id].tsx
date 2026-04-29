import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import {
  subscribeVideoDrafts,
  getVideoStatusLabel,
  getVideoStatusColor,
} from '../../src/services/video';
import {
  approveVideoDraft,
  rejectVideoDraft,
  type VideoDraft,
} from '../../src/services/videoDrafts';
import { useAuth } from '../../src/contexts/AuthContext';
import { useToast } from '../../src/contexts/ToastContext';
import { handleError } from '../../src/utils/errorHandler';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { useVideoStore } from '../../src/stores/videoStore';
import { useSwimmersStore } from '../../src/stores/swimmersStore';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import type { VideoSession } from '../../src/types/firestore.types';

const PHASE_COLORS: Record<string, string> = {
  stroke: colors.accent,
  turn: colors.gold,
  start: colors.purpleLight,
  underwater: '#6366f1',
  breakout: '#22d3ee',
  finish: colors.gold,
  general: colors.textSecondary,
};

function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { coach } = useAuth();
  const { showToast } = useToast();
  const session = useVideoStore((state) => state.selectedSession);
  const setSelectedSession = useVideoStore((state) => state.setSelectedSession);
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const [drafts, setDrafts] = useState<VideoDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    const unsubSession = onSnapshot(doc(db, 'video_sessions', id), (snap) => {
      if (snap.exists()) {
        setSelectedSession({ id: snap.id, ...snap.data() } as VideoSession & { id: string });
      }
      setLoading(false);
    });
    const unsubDrafts = subscribeVideoDrafts(id, (d) => setDrafts(d as VideoDraft[]));
    return () => {
      unsubSession();
      unsubDrafts();
      setSelectedSession(null);
    };
  }, [id, setSelectedSession]);

  const handleApprove = async (draft: VideoDraft) => {
    if (!coach || !id) return;
    setProcessing((prev) => new Set(prev).add(draft.id));
    try {
      const swimmer = swimmers.find((s) => s.id === draft.swimmerId);
      if (!swimmer) {
        throw new Error(`Missing roster context for ${draft.swimmerName}`);
      }
      await approveVideoDraft(id, draft, coach.uid, coach.displayName || 'Coach', swimmer);
      showToast('Observation posted to swimmer profile', 'success');
    } catch (err) {
      handleError(err, 'Approve draft');
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(draft.id);
      return next;
    });
  };

  const handleReject = async (draft: VideoDraft) => {
    if (!coach || !id) return;
    Alert.alert('Discard Draft', 'Discard this AI observation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          setProcessing((prev) => new Set(prev).add(draft.id));
          try {
            await rejectVideoDraft(id, draft.id, coach.uid);
          } catch (err) {
            handleError(err, 'Reject draft');
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Session not found</Text>
      </View>
    );
  }

  const statusColor = getVideoStatusColor(session.status);
  const statusLabel = getVideoStatusLabel(session.status);
  const pendingDrafts = drafts.filter((d) => d.approved === undefined);
  const reviewedDrafts = drafts.filter((d) => d.approved !== undefined);

  return (
    <>
      <Stack.Screen options={{ title: 'VIDEO DETAIL' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Session Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoDate}>{session.practiceDate}</Text>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.infoMeta}>
            {session.taggedSwimmerIds.length} swimmer
            {session.taggedSwimmerIds.length !== 1 ? 's' : ''} tagged
            {session.duration > 0 ? ` | ${session.duration}s` : ''}
            {session.group ? ` | ${session.group}` : ''}
          </Text>
          {session.errorMessage && <Text style={styles.sessionError}>{session.errorMessage}</Text>}
          {session.taggedSwimmerIds.length > 0 && (
            <TouchableOpacity
              style={styles.compareButton}
              onPress={() => router.push(`/video/compare?swimmerId=${session.taggedSwimmerIds[0]}`)}
            >
              <Text style={styles.compareButtonText}>COMPARE TECHNIQUE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Pipeline */}
        <View style={styles.pipeline}>
          {(['uploading', 'analyzing', 'review', 'posted'] as const).map((step, i) => {
            const isActive = session.status === step;
            const isPast =
              [
                'uploading',
                'uploaded',
                'extracting_frames',
                'analyzing',
                'review',
                'posted',
              ].indexOf(session.status) >
              ['uploading', 'analyzing', 'review', 'posted'].indexOf(step);
            const color = isActive ? colors.gold : isPast ? colors.accent : colors.textSecondary;
            return (
              <View key={step} style={styles.pipelineStep}>
                <View style={[styles.pipelineDot, { backgroundColor: color }]} />
                <Text style={[styles.pipelineLabel, { color }]}>{step.toUpperCase()}</Text>
                {i < 3 && (
                  <View
                    style={[
                      styles.pipelineLine,
                      { backgroundColor: isPast ? colors.accent : colors.border },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Analyzing State */}
        {(session.status === 'analyzing' || session.status === 'extracting_frames') && (
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.analyzingText}>AI IS ANALYZING VIDEO</Text>
            <Text style={styles.analyzingSubtext}>
              Examining strokes, turns, starts, and underwater technique...
            </Text>
          </View>
        )}

        {/* Pending Drafts */}
        {pendingDrafts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>OBSERVATIONS ({pendingDrafts.length})</Text>
            {pendingDrafts.map((draft) => {
              const phaseColor = PHASE_COLORS[draft.phase] || colors.textSecondary;
              const isProcessing = processing.has(draft.id);
              return (
                <View key={draft.id} style={styles.draftCard}>
                  <View style={styles.draftHeader}>
                    <Text style={styles.draftSwimmer}>{draft.swimmerName}</Text>
                    <View style={[styles.phaseBadge, { borderColor: phaseColor }]}>
                      <Text style={[styles.phaseText, { color: phaseColor }]}>
                        {draft.phase.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.draftObservation}>{draft.observation}</Text>
                  {draft.diagnosis ? (
                    <View style={styles.draftSection}>
                      <Text style={styles.draftLabel}>DIAGNOSIS</Text>
                      <Text style={styles.draftDetail}>{draft.diagnosis}</Text>
                    </View>
                  ) : null}
                  {draft.drillRecommendation ? (
                    <View style={styles.draftSection}>
                      <Text style={styles.drillLabel}>RECOMMENDED DRILL</Text>
                      <Text style={styles.drillText}>{draft.drillRecommendation}</Text>
                    </View>
                  ) : null}
                  <View style={styles.confidenceRow}>
                    <Text style={styles.confidenceLabel}>
                      CONFIDENCE: {Math.round(draft.confidence * 100)}%
                    </Text>
                  </View>
                  <View style={styles.draftActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleReject(draft)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.rejectBtnText}>DISCARD</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, isProcessing && { opacity: 0.5 }]}
                      onPress={() => handleApprove(draft)}
                      disabled={isProcessing}
                    >
                      <Text style={styles.approveBtnText}>
                        {isProcessing ? 'POSTING...' : 'POST TO PROFILE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Reviewed Drafts */}
        {reviewedDrafts.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
              REVIEWED ({reviewedDrafts.length})
            </Text>
            {reviewedDrafts.map((draft) => (
              <View key={draft.id} style={[styles.draftCard, { opacity: 0.6 }]}>
                <View style={styles.draftHeader}>
                  <Text style={styles.draftSwimmer}>{draft.swimmerName}</Text>
                  <Text
                    style={[
                      styles.reviewedLabel,
                      { color: draft.approved ? colors.gold : colors.error },
                    ]}
                  >
                    {draft.approved ? 'POSTED' : 'DISCARDED'}
                  </Text>
                </View>
                <Text style={styles.draftObservation} numberOfLines={2}>
                  {draft.observation}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Empty state when review but no drafts */}
        {session.status === 'review' && drafts.length === 0 && (
          <Text style={styles.emptyText}>
            No observations generated. The AI may not have detected any swimmers in the video.
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  errorText: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.error },

  // Info Card
  infoCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoDate: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  infoMeta: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  sessionError: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.sm,
  },

  // Pipeline
  pipeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  pipelineStep: { alignItems: 'center', flex: 1 },
  pipelineDot: { width: 12, height: 12, borderRadius: 6, marginBottom: spacing.xs },
  pipelineLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  pipelineLine: { position: 'absolute', top: 5, left: '60%', right: '-60%', height: 2 },

  // Analyzing
  analyzingCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  analyzingText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.gold,
    letterSpacing: 1,
    marginTop: spacing.lg,
  },
  analyzingSubtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  // Draft Card
  draftCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  draftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  draftSwimmer: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.accent,
  },
  phaseBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  phaseText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  draftObservation: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  draftSection: { marginBottom: spacing.sm },
  draftLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  draftDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  drillLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
    marginBottom: 4,
  },
  drillText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.gold,
    lineHeight: 20,
  },
  confidenceRow: { marginBottom: spacing.sm },
  confidenceLabel: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  draftActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  rejectBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  rejectBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  approveBtn: {
    flex: 2,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  approveBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  reviewedLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  compareButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignSelf: 'flex-start',
  },
  compareButtonText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
  },
});

export default withScreenErrorBoundary(VideoDetailScreen, 'VideoDetailScreen');
