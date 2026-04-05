import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../src/contexts/AuthContext';
import {
  subscribeAudioSessions,
  createAudioSession,
  updateAudioSession,
  uploadAudio,
} from '../src/services/audio';
import { getTodayString } from '../src/utils/time';
import { formatRelativeTime } from '../src/utils/date';
import { GROUPS, type Group } from '../src/config/constants';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../src/config/theme';
import type { AudioSession } from '../src/types/firestore.types';
import { enqueueUpload } from '../src/utils/offlineQueue';

type RecordingState = 'idle' | 'recording' | 'stopped';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  uploading: { label: 'UPLOADING', color: colors.accent },
  uploaded: { label: 'UPLOADED', color: colors.success },
  transcribing: { label: 'TRANSCRIBING', color: colors.info },
  extracting: { label: 'EXTRACTING', color: colors.info },
  review: { label: 'REVIEW', color: colors.gold },
  posted: { label: 'POSTED', color: colors.success },
  failed: { label: 'FAILED', color: colors.error },
  queued: { label: 'QUEUED', color: colors.warning },
};

export default function AudioScreen() {
  const { coach } = useAuth();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [sessions, setSessions] = useState<(AudioSession & { id: string })[]>([]);

  const recordingRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
  }, []);

  useEffect(() => {
    if (!coach?.uid) return;
    return subscribeAudioSessions(coach.uid, setSessions);
  }, [coach?.uid]);

  // ── Web recording via MediaRecorder API ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecordingWeb = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(1000); // collect chunks every second
      mediaRecorderRef.current = mediaRecorder;
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Microphone access denied: ${msg}`);
    }
  };

  const stopRecordingWeb = () => {
    if (!mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setRecordingState('stopped');
  };

  // ── Native recording via expo-av ──
  const startRecordingNative = async () => {
    try {
      const { Audio } = await import('expo-av');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to start recording: ${msg}`);
    }
  };

  const stopRecordingNative = async () => {
    if (!recordingRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      setRecordingState('stopped');

      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to stop recording: ${msg}`);
    }
  };

  // ── Platform-dispatched recording controls ──
  const startRecording = Platform.OS === 'web' ? startRecordingWeb : startRecordingNative;
  const stopRecording = Platform.OS === 'web' ? stopRecordingWeb : stopRecordingNative;

  const handleUpload = async () => {
    const isWeb = Platform.OS === 'web';

    // On web, build a blob URI from collected chunks
    if (isWeb && audioChunksRef.current.length === 0) return;
    if (!isWeb && !recordingRef.current) return;
    if (!coach) return;

    let uri: string | null = null;
    if (isWeb) {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      uri = URL.createObjectURL(blob);
    } else {
      uri = recordingRef.current?.getURI() || null;
    }
    if (!uri) return;

    if (!isOnline) {
      const today = getTodayString();
      const sessionId = await createAudioSession(
        coach.uid,
        coach.displayName || 'Unknown',
        duration,
        today,
        selectedGroup || undefined,
      );
      await updateAudioSession(sessionId, { status: 'queued' as any });
      await enqueueUpload({
        type: 'audio',
        uri,
        metadata: { sessionId, coachId: coach.uid, date: today },
      });
      Alert.alert('Queued', 'Recording saved. It will upload when you reconnect.');
      setRecordingState('idle');
      setDuration(0);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const today = getTodayString();

    try {
      // Create session doc first
      const sessionId = await createAudioSession(
        coach.uid,
        coach.displayName || 'Unknown',
        duration,
        today,
        selectedGroup || undefined,
      );

      // Upload audio file
      const { storagePath, downloadUrl } = await uploadAudio(
        uri,
        coach.uid,
        today,
        setUploadProgress,
      );

      // Update session with upload info
      await updateAudioSession(sessionId, {
        storagePath,
        status: 'uploaded',
      } as any);

      // Reset recording state
      recordingRef.current = null;
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      setRecordingState('idle');
      setDuration(0);
      setSelectedGroup(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Upload failed';
      Alert.alert('Upload Failed', msg);
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleDiscard = () => {
    Alert.alert('Discard Recording', 'This recording will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          recordingRef.current = null;
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          setRecordingState('idle');
          setDuration(0);
        },
      },
    ]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Stack.Screen options={{ title: 'AUDIO NOTES' }} />
      <View style={styles.container}>
        {/* Network Banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              OFFLINE — recordings will upload when reconnected
            </Text>
          </View>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Recorder Card */}
          <View style={styles.recorderCard}>
            <Text style={styles.cardTitle}>RECORD</Text>

            {/* Duration Display */}
            <View style={styles.durationRow}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
              {recordingState === 'recording' && <View style={styles.recordingDot} />}
            </View>

            {/* Group Picker */}
            {recordingState !== 'recording' && (
              <View style={styles.groupPicker}>
                <Text style={styles.groupPickerLabel}>GROUP (OPTIONAL)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.groupRow}>
                    <TouchableOpacity
                      style={[styles.groupChip, !selectedGroup && styles.groupChipActive]}
                      onPress={() => setSelectedGroup(null)}
                    >
                      <Text
                        style={[styles.groupChipText, !selectedGroup && styles.groupChipTextActive]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    {GROUPS.map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.groupChip,
                          selectedGroup === g && styles.groupChipActive,
                          selectedGroup === g && { borderColor: groupColors[g] },
                        ]}
                        onPress={() => setSelectedGroup(g)}
                      >
                        <Text
                          style={[
                            styles.groupChipText,
                            selectedGroup === g && { color: groupColors[g] },
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Controls */}
            <View style={styles.controls}>
              {recordingState === 'idle' && (
                <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
                  <View style={styles.recordBtnDot} />
                  <Text style={styles.recordBtnText}>START RECORDING</Text>
                </TouchableOpacity>
              )}

              {recordingState === 'recording' && (
                <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                  <View style={styles.stopBtnSquare} />
                  <Text style={styles.stopBtnText}>STOP</Text>
                </TouchableOpacity>
              )}

              {recordingState === 'stopped' && !isUploading && (
                <>
                  <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
                    <Text style={styles.uploadBtnText}>UPLOAD</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                    <Text style={styles.discardBtnText}>DISCARD</Text>
                  </TouchableOpacity>
                </>
              )}

              {isUploading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                </View>
              )}
            </View>
          </View>

          {/* Sessions List */}
          <View style={styles.sessionsHeader}>
            <Text style={styles.sessionsTitle}>RECENT SESSIONS</Text>
            <Text style={styles.sessionsCount}>{sessions.length}</Text>
          </View>

          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No recordings yet — tap RECORD above</Text>
          ) : (
            sessions.map((session) => {
              const badge = STATUS_BADGE[session.status] || STATUS_BADGE.uploaded;
              const createdAt =
                session.createdAt instanceof Date
                  ? session.createdAt
                  : (session.createdAt as any)?.toDate?.() || new Date();

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <View style={styles.sessionTop}>
                    <View>
                      <Text style={styles.sessionDate}>{session.practiceDate}</Text>
                      <Text style={styles.sessionMeta}>
                        {formatDuration(session.duration)}
                        {session.group ? ` • ${session.group}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { borderColor: badge.color }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sessionCoach}>
                    {session.coachName} • {formatRelativeTime(createdAt)}
                  </Text>
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
  offlineBanner: {
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  offlineBannerText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.text,
    letterSpacing: 1,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  // Recorder Card
  recorderCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  durationText: { fontFamily: fontFamily.stat, fontSize: 48, color: colors.gold },
  recordingDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.error },

  // Group Picker
  groupPicker: { marginBottom: spacing.lg },
  groupPickerLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  groupRow: { flexDirection: 'row', gap: spacing.xs },
  groupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  groupChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  groupChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  groupChipTextActive: { color: colors.text },

  // Controls
  controls: { alignItems: 'center', gap: spacing.md },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  recordBtnDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text },
  recordBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.text,
  },
  stopBtnSquare: { width: 12, height: 12, backgroundColor: colors.error, borderRadius: 2 },
  stopBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  uploadBtn: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    width: '100%',
    alignItems: 'center',
  },
  uploadBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  discardBtn: { paddingVertical: spacing.sm },
  discardBtnText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },

  // Progress
  progressContainer: { width: '100%', alignItems: 'center', gap: spacing.sm },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  progressText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },

  // Sessions
  sessionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionsTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  sessionsCount: { fontFamily: fontFamily.stat, fontSize: fontSize.xl, color: colors.accent },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  sessionCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sessionDate: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  sessionMeta: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  sessionCoach: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
});
