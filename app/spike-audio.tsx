import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db, storage } from '../src/config/firebase';
import { colors, spacing, fontSize, borderRadius } from '../src/config/theme';

type RecordingState = 'idle' | 'recording' | 'stopped';
type UploadState = 'none' | 'uploading' | 'uploaded' | 'error';

export default function SpikeAudio() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [uploadState, setUploadState] = useState<UploadState>('none');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Audio recording ref — expo-av will be used
  const recordingRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString();
    setLog((prev) => [`[${time}] ${message}`, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);

  const startRecording = async () => {
    try {
      // Dynamically import expo-av to avoid issues if not installed
      const { Audio } = await import('expo-av');

      addLog('Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Microphone access is needed to record audio.');
        addLog('Permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      addLog('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecordingState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      addLog('Recording started (HIGH_QUALITY preset)');
    } catch (error: any) {
      addLog(`Recording error: ${error.message}`);
      Alert.alert('Error', `Failed to start recording: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      addLog('Stopping recording...');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      addLog(`Recording saved: ${uri}`);
      setRecordingState('stopped');

      // Reset audio mode
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error: any) {
      addLog(`Stop error: ${error.message}`);
    }
  };

  const uploadRecording = async () => {
    if (!recordingRef.current) {
      addLog('No recording to upload');
      return;
    }

    const uri = recordingRef.current.getURI();
    if (!uri) {
      addLog('No recording URI found');
      return;
    }

    if (!isOnline) {
      addLog('Cannot upload while offline — queue for later');
      Alert.alert(
        'Offline',
        'Recording saved locally. Upload will be available when you reconnect.'
      );
      return;
    }

    try {
      setUploadState('uploading');
      setUploadProgress(0);
      addLog('Uploading to Cloud Storage...');

      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `spike_audio_${Date.now()}.m4a`;
      const storageRef = ref(storage, `spike_audio/${fileName}`);

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
          if (Math.round(progress) % 25 === 0) {
            addLog(`Upload progress: ${Math.round(progress)}%`);
          }
        },
        (error) => {
          addLog(`Upload error: ${error.message}`);
          setUploadState('error');
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          setDownloadUrl(url);
          setUploadState('uploaded');
          addLog(`Upload complete! URL: ${url.substring(0, 60)}...`);

          // Save session metadata to Firestore
          await addDoc(collection(db, 'spike_audio_sessions'), {
            storagePath: `spike_audio/${fileName}`,
            downloadUrl: url,
            duration,
            status: 'uploaded',
            coachName: 'Spike Tester',
            createdAt: serverTimestamp(),
          });
          addLog('Session metadata saved to Firestore');
        }
      );
    } catch (error: any) {
      addLog(`Upload error: ${error.message}`);
      setUploadState('error');
    }
  };

  const resetRecording = () => {
    recordingRef.current = null;
    setRecordingState('idle');
    setUploadState('none');
    setUploadProgress(0);
    setDuration(0);
    setDownloadUrl(null);
    addLog('Reset — ready for new recording');
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Network Banner */}
      <View style={[styles.banner, { backgroundColor: isOnline ? colors.success : colors.error }]}>
        <Text style={styles.bannerText}>
          {isOnline ? '● Online' : '✈ Offline'}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Recording Controls */}
        <View style={styles.recorderCard}>
          <Text style={styles.cardTitle}>Audio Recorder</Text>
          <Text style={styles.cardDesc}>
            Record poolside audio to test microphone quality and Cloud Storage upload.
          </Text>

          {/* Duration Display */}
          <View style={styles.durationContainer}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            {recordingState === 'recording' && (
              <View style={styles.recordingDot} />
            )}
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {recordingState === 'idle' && (
              <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                <View style={styles.recordDot} />
                <Text style={styles.buttonText}>Start Recording</Text>
              </TouchableOpacity>
            )}

            {recordingState === 'recording' && (
              <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                <View style={styles.stopSquare} />
                <Text style={styles.buttonText}>Stop Recording</Text>
              </TouchableOpacity>
            )}

            {recordingState === 'stopped' && uploadState === 'none' && (
              <View style={styles.postRecordControls}>
                <TouchableOpacity style={styles.uploadButton} onPress={uploadRecording}>
                  <Text style={styles.buttonText}>Upload to Firebase</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetButton} onPress={resetRecording}>
                  <Text style={styles.resetButtonText}>Discard & Reset</Text>
                </TouchableOpacity>
              </View>
            )}

            {uploadState === 'uploading' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
              </View>
            )}

            {uploadState === 'uploaded' && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>Upload successful!</Text>
                <Text style={styles.urlText} numberOfLines={2}>
                  {downloadUrl}
                </Text>
                <TouchableOpacity style={styles.resetButton} onPress={resetRecording}>
                  <Text style={styles.resetButtonText}>Record Another</Text>
                </TouchableOpacity>
              </View>
            )}

            {uploadState === 'error' && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Upload failed</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={uploadRecording}>
                  <Text style={styles.buttonText}>Retry Upload</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Test Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.cardTitle}>Spike Test Checklist</Text>
          <CheckItem label="Record 60 seconds of poolside audio" />
          <CheckItem label="Upload recording to Cloud Storage" />
          <CheckItem label="Verify upload URL is accessible" />
          <CheckItem label="Note ambient noise level and clarity" />
          <CheckItem label="Test recording while phone is in pocket" />
          <CheckItem label="Test with coach speaking from 10+ feet away" />
        </View>

        {/* Event Log */}
        <View style={styles.logCard}>
          <Text style={styles.cardTitle}>Event Log</Text>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logText}>
              {entry}
            </Text>
          ))}
          {log.length === 0 && (
            <Text style={styles.emptyText}>No events yet — start recording</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function CheckItem({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <TouchableOpacity
      style={styles.checkItem}
      onPress={() => setChecked(!checked)}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bannerText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  recorderCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  durationContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  durationText: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  controls: {
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  stopSquare: {
    width: 12,
    height: 12,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  postRecordControls: {
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  uploadButton: {
    backgroundColor: colors.purple,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    width: '100%',
  },
  resetButton: {
    paddingVertical: spacing.sm,
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textDecorationLine: 'underline',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.purple,
    borderRadius: 4,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  successText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.success,
  },
  urlText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: '600',
  },
  checklistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  checkLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  checkLabelDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
    marginTop: 2,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
