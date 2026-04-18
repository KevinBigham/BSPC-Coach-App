import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Audio } from 'expo-av';
import { Pause, Play, Mic, StopCircle } from 'lucide-react-native';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { getTodayString } from '../utils/time';
import { formatRelativeTime, toDateSafe, type FirestoreTimestampLike } from '../utils/date';
import {
  subscribeSwimmerVoiceNotes,
  createSwimmerVoiceNote,
  updateSwimmerVoiceNote,
  uploadSwimmerVoiceNote,
  enqueueSwimmerVoiceNoteUpload,
  flushQueuedSwimmerVoiceNotes,
} from '../services/swimmerVoiceNotes';
import type { SwimmerVoiceNote } from '../types/voiceNote';

type RecordingState = 'idle' | 'recording' | 'stopped';
type NativeRecording = {
  stopAndUnloadAsync: () => Promise<unknown>;
  getURI: () => string | null;
};
type VoiceNoteWithId = SwimmerVoiceNote & { id: string };

interface VoiceNoteRecorderProps {
  swimmerId: string;
  coachId: string;
  coachName: string;
}

export default function VoiceNoteRecorder({
  swimmerId,
  coachId,
  coachName,
}: VoiceNoteRecorderProps) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<VoiceNoteWithId[]>([]);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recordingRef = useRef<NativeRecording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return subscribeSwimmerVoiceNotes(swimmerId, setNotes);
  }, [swimmerId]);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);
      if (connected) {
        flushQueuedSwimmerVoiceNotes()
          .then((result) => {
            if (result.processed > 0) {
              showToast('Queued voice notes uploaded', 'success');
            }
          })
          .catch(() => {});
      }
    });
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
  };

  const resetRecorder = () => {
    recordingRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecordingState('idle');
    setDuration(0);
    setUploadProgress(0);
    setIsSaving(false);
  };

  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((value) => value + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecordingWeb = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.start(1000);
    mediaRecorderRef.current = mediaRecorder;
    setRecordingState('recording');
    startTimer();
  };

  const startRecordingNative = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      showToast('Microphone permission is required', 'error');
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
    startTimer();
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        await startRecordingWeb();
      } else {
        await startRecordingNative();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to start recording', 'error');
    }
  };

  const stopRecordingWeb = () => {
    if (!mediaRecorderRef.current) {
      return;
    }

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    setRecordingState('stopped');
  };

  const stopRecordingNative = async () => {
    if (!recordingRef.current) {
      return;
    }

    await recordingRef.current.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setRecordingState('stopped');
  };

  const stopRecording = async () => {
    try {
      stopTimer();
      if (Platform.OS === 'web') {
        stopRecordingWeb();
      } else {
        await stopRecordingNative();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to stop recording', 'error');
    }
  };

  const resolveRecordingUri = () => {
    if (Platform.OS === 'web') {
      if (audioChunksRef.current.length === 0) {
        return null;
      }
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      return URL.createObjectURL(blob);
    }

    return recordingRef.current?.getURI() || null;
  };

  const handleSave = async () => {
    const uri = resolveRecordingUri();
    if (!uri) {
      showToast('Record a voice note first', 'error');
      return;
    }

    setIsSaving(true);

    const practiceDate = getTodayString();

    try {
      const noteId = await createSwimmerVoiceNote({
        swimmerId,
        coachId,
        coachName,
        durationSec: duration,
        practiceDate,
      });

      if (!isOnline) {
        await enqueueSwimmerVoiceNoteUpload({
          noteId,
          swimmerId,
          coachId,
          practiceDate,
          uri,
        });
        showToast('Voice note queued for upload', 'success');
        resetRecorder();
        return;
      }

      const { storagePath } = await uploadSwimmerVoiceNote(
        uri,
        swimmerId,
        practiceDate,
        noteId,
        (percent) => setUploadProgress(percent / 100),
      );

      await updateSwimmerVoiceNote(swimmerId, noteId, { storagePath });
      showToast('Voice note saved', 'success');
      resetRecorder();
    } catch (error) {
      setIsSaving(false);
      showToast(error instanceof Error ? error.message : 'Unable to save voice note', 'error');
    }
  };

  const handleDiscard = () => {
    stopTimer();
    resetRecorder();
  };

  const togglePlayback = async (note: VoiceNoteWithId) => {
    if (!note.storagePath) {
      return;
    }

    if (playingId === note.id && soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    try {
      const downloadUrl = await getDownloadURL(ref(storage, note.storagePath));
      const { sound } = await Audio.Sound.createAsync(
        { uri: downloadUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded || !status.didJustFinish) {
            return;
          }
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlayingId(null);
        },
      );

      soundRef.current = sound;
      setPlayingId(note.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to play voice note', 'error');
    }
  };

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>OFFLINE - voice notes will upload later</Text>
        </View>
      )}

      <View style={styles.recorderCard}>
        <Text style={styles.cardTitle}>VOICE NOTES</Text>
        <Text style={styles.cardSubtitle}>Record quick swimmer-specific observations inline.</Text>

        <View style={styles.timerRow}>
          <Text style={styles.timerText}>{formatDuration(duration)}</Text>
          {recordingState === 'recording' && <View style={styles.recordingDot} />}
        </View>

        {recordingState === 'idle' && (
          <TouchableOpacity style={styles.recordButton} onPress={() => void startRecording()}>
            <Mic size={24} color={colors.text} strokeWidth={2.5} />
            <Text style={styles.recordButtonText}>RECORD</Text>
          </TouchableOpacity>
        )}

        {recordingState === 'recording' && (
          <TouchableOpacity style={styles.stopButton} onPress={() => void stopRecording()}>
            <StopCircle size={24} color={colors.text} strokeWidth={2.5} />
            <Text style={styles.recordButtonText}>STOP</Text>
          </TouchableOpacity>
        )}

        {recordingState === 'stopped' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.bgDeep} />
              ) : (
                <Text style={styles.saveButtonText}>SAVE VOICE NOTE</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardButton} onPress={handleDiscard}>
              <Text style={styles.discardButtonText}>DISCARD</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSaving && uploadProgress > 0 && uploadProgress < 1 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
          </View>
        )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>PAST VOICE NOTES</Text>
        <Text style={styles.listCount}>{notes.length}</Text>
      </View>

      {notes.length === 0 ? (
        <Text style={styles.emptyText}>No voice notes yet.</Text>
      ) : (
        notes.map((note) => {
          const createdAt = toDateSafe(note.createdAt as FirestoreTimestampLike);
          const isQueued = !note.storagePath;
          return (
            <View key={note.id} style={styles.noteCard}>
              <TouchableOpacity
                style={[styles.playButton, isQueued && styles.playButtonDisabled]}
                onPress={() => void togglePlayback(note)}
                disabled={isQueued}
              >
                {playingId === note.id ? (
                  <Pause size={18} color={colors.bgDeep} strokeWidth={2.5} />
                ) : (
                  <Play size={18} color={colors.bgDeep} strokeWidth={2.5} />
                )}
              </TouchableOpacity>
              <View style={styles.noteInfo}>
                <Text style={styles.noteDuration}>{formatDuration(note.durationSec)}</Text>
                <Text style={styles.noteDate}>
                  {createdAt ? formatRelativeTime(createdAt) : 'Pending sync'}
                </Text>
              </View>
              <View style={[styles.statusBadge, isQueued && styles.queuedBadge]}>
                <Text style={[styles.statusText, isQueued && styles.queuedText]}>
                  {isQueued ? 'QUEUED' : 'READY'}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  offlineBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  offlineBannerText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.error,
    letterSpacing: 1,
  },
  recorderCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
  },
  cardSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  timerText: {
    fontFamily: fontFamily.stat,
    fontSize: 48,
    color: colors.gold,
  },
  recordingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.error,
  },
  recordButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stopButton: {
    backgroundColor: colors.bgBase,
    borderRadius: borderRadius.full,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: colors.text,
  },
  recordButtonText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  actionRow: {
    gap: spacing.sm,
  },
  saveButton: {
    backgroundColor: colors.gold,
    borderRadius: borderRadius.md,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
  discardButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  discardButtonText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  progressWrap: {
    gap: spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgBase,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  progressText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
  },
  listCount: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.accent,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  noteCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonDisabled: {
    backgroundColor: colors.border,
  },
  noteInfo: {
    flex: 1,
    gap: 2,
  },
  noteDuration: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  noteDate: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  queuedBadge: {
    borderColor: colors.warning,
  },
  statusText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.success,
  },
  queuedText: {
    color: colors.warning,
  },
});
