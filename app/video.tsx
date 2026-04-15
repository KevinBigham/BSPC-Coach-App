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
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../src/contexts/AuthContext';
import { useSwimmersStore } from '../src/stores/swimmersStore';
import { useVideoStore } from '../src/stores/videoStore';
import {
  createVideoSession,
  uploadVideo,
  updateVideoSession,
  subscribeVideoSessions,
  getVideoStatusLabel,
  getVideoStatusColor,
  validateMediaConsent,
} from '../src/services/video';
import { filterConsentedSwimmers } from '../src/utils/mediaConsent';
import { handleError } from '../src/utils/errorHandler';
import { useToast } from '../src/contexts/ToastContext';
import { enqueueUpload } from '../src/utils/offlineQueue';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import { GROUPS, type Group } from '../src/config/constants';
import { tapMedium, notifySuccess, notifyWarning } from '../src/utils/haptics';
import { withScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';

type UploadState = 'idle' | 'uploading' | 'queued';

function VideoScreen() {
  const { coach } = useAuth();
  const swimmers = useSwimmersStore((s) => s.swimmers);
  const sessions = useVideoStore((state) => state.sessions);
  const setSessions = useVideoStore((state) => state.setSessions);
  const uploadProgress = useVideoStore((state) => state.uploadProgress);
  const setUploadProgress = useVideoStore((state) => state.setUploadProgress);
  const { showToast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>('idle');

  // Swimmer tagging state
  const [selectedSwimmerIds, setSelectedSwimmerIds] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | ''>('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    if (!coach?.uid) return;
    return subscribeVideoSessions(coach.uid, setSessions);
  }, [coach?.uid, setSessions]);

  const pickVideo = async (useCamera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['videos'],
      videoMaxDuration: 300,
      quality: 0.7,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setVideoUri(asset.uri);
    setVideoDuration(Math.round((asset.duration || 0) / 1000));
  };

  const toggleSwimmer = (id: string) => {
    setSelectedSwimmerIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleUpload = async () => {
    if (!videoUri || !coach?.uid) return;
    tapMedium();

    if (selectedSwimmerIds.length === 0) {
      Alert.alert('Tag Swimmers', 'Select at least one swimmer to analyze');
      return;
    }

    // Belt-and-suspenders consent check
    const swimmersWithIds = swimmers.filter((s): s is typeof s & { id: string } => !!s.id);
    const nonConsented = validateMediaConsent(selectedSwimmerIds, swimmersWithIds);
    if (nonConsented.length > 0) {
      notifyWarning();
      Alert.alert(
        'Media Consent Required',
        `The following swimmers do not have media consent on file: ${nonConsented.join(', ')}. Remove them or update their consent in the swimmer edit screen.`,
      );
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);

    let queuedOffline = false;

    try {
      const practiceDate = new Date().toISOString().split('T')[0];
      const sessionId = await createVideoSession(
        coach.uid,
        coach.displayName || 'Coach',
        videoDuration,
        practiceDate,
        selectedSwimmerIds,
        (selectedGroup as Group) || undefined,
      );

      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
        queuedOffline = true;
        await updateVideoSession(sessionId, {
          status: 'queued',
        });
        await enqueueUpload({
          type: 'video',
          uri: videoUri,
          metadata: {
            date: practiceDate,
            sessionId,
            taggedSwimmerIds: selectedSwimmerIds,
          },
        });

        setUploadState('queued');
        setUploadProgress(0);
        notifySuccess();
        showToast('Video queued — it will upload when you reconnect', 'success');
        setVideoUri(null);
        setSelectedSwimmerIds([]);
        setSelectedGroup('');
        setVideoDuration(0);
        return;
      }

      const { storagePath } = await uploadVideo(videoUri, coach.uid, practiceDate, (percent) => {
        setUploadProgress(percent / 100);
      });

      await updateVideoSession(sessionId, {
        storagePath,
        status: 'uploaded',
      });

      setUploadProgress(1);
      notifySuccess();
      showToast('Video uploaded — AI analysis starting', 'success');
      setVideoUri(null);
      setSelectedSwimmerIds([]);
      setSelectedGroup('');
      setVideoDuration(0);
    } catch (err) {
      handleError(err, 'Video upload');
    } finally {
      setUploadState(queuedOffline ? 'queued' : 'idle');
      setUploadProgress(0);
    }
  };

  const consentedSwimmers = filterConsentedSwimmers(swimmers);
  const filteredSwimmers = selectedGroup
    ? consentedSwimmers.filter((s) => s.group === selectedGroup)
    : consentedSwimmers;
  const nonConsentedCount = swimmers.length - consentedSwimmers.length;

  return (
    <>
      <Stack.Screen options={{ title: 'VIDEO ANALYSIS' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Capture Buttons */}
        {!videoUri && uploadState === 'idle' && (
          <View style={styles.captureSection}>
            <Text style={styles.sectionTitle}>CAPTURE VIDEO</Text>
            <View style={styles.captureRow}>
              <TouchableOpacity style={styles.captureBtn} onPress={() => pickVideo(true)}>
                <Text style={styles.captureBtnText}>RECORD VIDEO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureBtn, styles.captureBtnAlt]}
                onPress={() => pickVideo(false)}
              >
                <Text style={styles.captureBtnAltText}>PICK FROM LIBRARY</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Upload Form */}
        {videoUri && uploadState === 'idle' && (
          <View style={styles.uploadSection}>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>VIDEO SELECTED</Text>
              <Text style={styles.previewDuration}>
                {videoDuration > 0 ? `${videoDuration}s` : 'Unknown duration'}
              </Text>
            </View>

            {/* Group Filter */}
            <Text style={styles.fieldLabel}>FILTER BY GROUP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedGroup && styles.chipActive]}
                  onPress={() => setSelectedGroup('')}
                >
                  <Text style={[styles.chipText, !selectedGroup && styles.chipTextActive]}>
                    ALL
                  </Text>
                </TouchableOpacity>
                {GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, selectedGroup === g && styles.chipActive]}
                    onPress={() => setSelectedGroup(g)}
                  >
                    <Text style={[styles.chipText, selectedGroup === g && styles.chipTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Swimmer Tagging */}
            <Text style={styles.fieldLabel}>
              TAG SWIMMERS ({selectedSwimmerIds.length} selected)
            </Text>
            {nonConsentedCount > 0 && (
              <Text style={styles.consentWarning}>
                {nonConsentedCount} swimmer{nonConsentedCount !== 1 ? 's' : ''} hidden — media
                consent, Do Not Photograph, or active status blocks tagging
              </Text>
            )}
            <View style={styles.swimmerGrid}>
              {filteredSwimmers.map((s) => {
                const selected = selectedSwimmerIds.includes(s.id!);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.swimmerChip, selected && styles.swimmerChipActive]}
                    onPress={() => toggleSwimmer(s.id!)}
                  >
                    <Text
                      style={[styles.swimmerChipText, selected && styles.swimmerChipTextActive]}
                    >
                      {s.firstName} {s.lastName[0]}.
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Upload Button */}
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>UPLOAD & ANALYZE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setVideoUri(null);
                setSelectedSwimmerIds([]);
              }}
            >
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upload Progress */}
        {uploadState !== 'idle' && (
          <View style={styles.progressSection}>
            {uploadState === 'uploading' ? (
              <>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.progressText}>
                  UPLOADING... {Math.round(uploadProgress * 100)}%
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]}
                  />
                </View>
              </>
            ) : (
              <Text style={styles.progressText}>QUEUED</Text>
            )}
          </View>
        )}

        {/* Recent Sessions */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>RECENT SESSIONS</Text>
        {sessions.length === 0 ? (
          <Text style={styles.emptyText}>
            No video sessions yet. Record or pick a video to get started.
          </Text>
        ) : (
          sessions.map((session) => {
            const statusColor = getVideoStatusColor(session.status);
            const statusLabel = getVideoStatusLabel(session.status);
            return (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => router.push(`/video/${session.id}`)}
              >
                <View style={[styles.sessionStatusBar, { backgroundColor: statusColor }]} />
                <View style={styles.sessionContent}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionDate}>{session.practiceDate}</Text>
                    <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sessionMeta}>
                    {session.taggedSwimmerIds.length} swimmer
                    {session.taggedSwimmerIds.length !== 1 ? 's' : ''} tagged
                    {session.duration > 0 ? ` | ${session.duration}s` : ''}
                    {session.group ? ` | ${session.group}` : ''}
                  </Text>
                  {session.errorMessage && (
                    <Text style={styles.errorText} numberOfLines={1}>
                      {session.errorMessage}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },

  // Capture
  captureSection: { marginBottom: spacing.xl },
  captureRow: { flexDirection: 'row', gap: spacing.md },
  captureBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  captureBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  captureBtnAlt: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  captureBtnAltText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.accent,
    letterSpacing: 1,
  },

  // Upload Form
  uploadSection: { marginBottom: spacing.xl },
  previewCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  previewLabel: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.gold,
    letterSpacing: 1,
  },
  previewDuration: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  fieldLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  chipRow: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  chipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  chipText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  chipTextActive: { color: colors.text },

  consentWarning: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.warning,
    marginBottom: spacing.sm,
  },
  swimmerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  swimmerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  swimmerChipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.gold,
  },
  swimmerChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  swimmerChipTextActive: { color: colors.gold },

  uploadBtn: {
    backgroundColor: colors.gold,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  uploadBtnText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  cancelBtn: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Progress
  progressSection: { alignItems: 'center', paddingVertical: spacing.xxxl },
  progressText: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.gold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.purple,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },

  // Sessions
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sessionStatusBar: { width: 4 },
  sessionContent: { flex: 1, padding: spacing.lg },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sessionDate: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  sessionMeta: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

export default withScreenErrorBoundary(VideoScreen, 'VideoScreen');
