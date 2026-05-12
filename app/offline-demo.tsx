import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import { Mic, Share2, StopCircle, Trash2, Video } from 'lucide-react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../src/config/theme';
import {
  clearOfflineDemoIndex,
  readSavedDemoMediaIndex,
  saveLocalDemoMedia,
  type OfflineDemoMediaItem,
} from '../src/services/offlineDemoMedia';

type RecordingState = 'idle' | 'recording' | 'stopped';

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatDuration(seconds?: number): string | null {
  if (seconds === undefined) {
    return null;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function groupMediaBySwimmer(items: OfflineDemoMediaItem[]) {
  return items.reduce<Record<string, OfflineDemoMediaItem[]>>((groups, item) => {
    const key = item.swimmerFolderName;
    groups[key] = groups[key] ? [...groups[key], item] : [item];
    return groups;
  }, {});
}

export default function OfflineDemoScreen() {
  const [swimmerName, setSwimmerName] = useState('');
  const [items, setItems] = useState<OfflineDemoMediaItem[]>([]);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [isSavingAudio, setIsSavingAudio] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const groupedItems = useMemo(() => groupMediaBySwimmer(items), [items]);

  const refreshIndex = async () => {
    setItems(await readSavedDemoMediaIndex());
  };

  useEffect(() => {
    refreshIndex().catch(() => {});
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requireSwimmerName = () => {
    const trimmed = swimmerName.trim();
    if (!trimmed) {
      Alert.alert('Swimmer Name Required', 'Enter a swimmer name before saving demo media.');
      return null;
    }
    return trimmed;
  };

  const saveVideoAsset = async (useCamera: boolean) => {
    const name = requireSwimmerName();
    if (!name) {
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          quality: 0.7,
          videoMaxDuration: 300,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          quality: 0.7,
          videoMaxDuration: 300,
        });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    setIsSavingVideo(true);
    try {
      await saveLocalDemoMedia({
        type: 'video',
        swimmerName: name,
        sourceUri: result.assets[0].uri,
        durationSec: result.assets[0].duration
          ? Math.round(result.assets[0].duration / 1000)
          : undefined,
      });
      await refreshIndex();
      Alert.alert('Video Saved', 'Saved locally on this phone for sharing later.');
    } catch (error) {
      Alert.alert(
        'Video Save Failed',
        error instanceof Error ? error.message : 'Unable to save video.',
      );
    } finally {
      setIsSavingVideo(false);
    }
  };

  const startAudioRecording = async () => {
    const name = requireSwimmerName();
    if (!name) {
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted' && !permission.granted) {
        Alert.alert('Microphone Required', 'Microphone access is needed to record audio notes.');
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
      setDuration(0);
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setDuration((value) => value + 1);
      }, 1000);
    } catch (error) {
      Alert.alert(
        'Recording Failed',
        error instanceof Error ? error.message : 'Unable to start recording.',
      );
    }
  };

  const stopAudioRecording = async () => {
    if (!recordingRef.current) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setRecordingState('stopped');
    } catch (error) {
      Alert.alert(
        'Stop Failed',
        error instanceof Error ? error.message : 'Unable to stop recording.',
      );
    }
  };

  const saveAudioRecording = async () => {
    const name = requireSwimmerName();
    const uri = recordingRef.current?.getURI();
    if (!name || !uri) {
      Alert.alert('No Recording', 'Record an audio note before saving.');
      return;
    }

    setIsSavingAudio(true);
    try {
      await saveLocalDemoMedia({
        type: 'audio',
        swimmerName: name,
        sourceUri: uri,
        durationSec: duration,
      });
      recordingRef.current = null;
      setRecordingState('idle');
      setDuration(0);
      await refreshIndex();
      Alert.alert('Audio Saved', 'Saved locally on this phone for sharing later.');
    } catch (error) {
      Alert.alert(
        'Audio Save Failed',
        error instanceof Error ? error.message : 'Unable to save audio.',
      );
    } finally {
      setIsSavingAudio(false);
    }
  };

  const discardAudioRecording = () => {
    recordingRef.current = null;
    setRecordingState('idle');
    setDuration(0);
  };

  const shareItem = async (item: OfflineDemoMediaItem) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing Unavailable', 'This device does not currently support system sharing.');
      return;
    }
    await Sharing.shareAsync(item.uri, {
      dialogTitle: `Share ${item.type} for ${item.swimmerName}`,
    });
  };

  const resetIndex = () => {
    Alert.alert(
      'Reset Demo List',
      'This clears the list in this screen but does not delete media files already saved on the phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset List',
          style: 'destructive',
          onPress: async () => {
            await clearOfflineDemoIndex();
            await refreshIndex();
          },
        },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'OFFLINE PRACTICE DEMO' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>LOCAL ONLY</Text>
          <Text style={styles.noticeText}>
            This demo saves video and audio on this phone. It does not sign in, upload, sync, or
            call Firebase.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SWIMMER</Text>
          <TextInput
            style={styles.input}
            value={swimmerName}
            onChangeText={setSwimmerName}
            placeholder="Enter swimmer name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VIDEO</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryAction, isSavingVideo && styles.disabledAction]}
              onPress={() => saveVideoAsset(true)}
              disabled={isSavingVideo}
            >
              {isSavingVideo ? (
                <ActivityIndicator color={colors.bgDeep} />
              ) : (
                <>
                  <Video color={colors.bgDeep} size={18} />
                  <Text style={styles.primaryActionText}>RECORD</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => saveVideoAsset(false)}
              disabled={isSavingVideo}
            >
              <Text style={styles.secondaryActionText}>PICK VIDEO</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AUDIO NOTE</Text>
          {recordingState === 'idle' && (
            <TouchableOpacity style={styles.primaryActionFull} onPress={startAudioRecording}>
              <Mic color={colors.bgDeep} size={18} />
              <Text style={styles.primaryActionText}>START RECORDING</Text>
            </TouchableOpacity>
          )}
          {recordingState === 'recording' && (
            <TouchableOpacity style={styles.dangerActionFull} onPress={stopAudioRecording}>
              <StopCircle color={colors.text} size={18} />
              <Text style={styles.dangerActionText}>STOP {formatDuration(duration)}</Text>
            </TouchableOpacity>
          )}
          {recordingState === 'stopped' && (
            <View style={styles.actionColumn}>
              <Text style={styles.savedHint}>Ready to save: {formatDuration(duration)}</Text>
              <TouchableOpacity
                style={[styles.primaryActionFull, isSavingAudio && styles.disabledAction]}
                onPress={saveAudioRecording}
                disabled={isSavingAudio}
              >
                {isSavingAudio ? (
                  <ActivityIndicator color={colors.bgDeep} />
                ) : (
                  <>
                    <Mic color={colors.bgDeep} size={18} />
                    <Text style={styles.primaryActionText}>SAVE AUDIO</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionFull} onPress={discardAudioRecording}>
                <Text style={styles.secondaryActionText}>DISCARD</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>SAVED LOCAL FILES</Text>
            {items.length > 0 && (
              <TouchableOpacity style={styles.iconButton} onPress={resetIndex}>
                <Trash2 color={colors.error} size={18} />
              </TouchableOpacity>
            )}
          </View>
          {items.length === 0 ? (
            <Text style={styles.emptyText}>No local demo files saved yet.</Text>
          ) : (
            Object.entries(groupedItems).map(([folderName, swimmerItems]) => (
              <View key={folderName} style={styles.swimmerGroup}>
                <Text style={styles.swimmerTitle}>
                  {swimmerItems[0]?.swimmerName || folderName}
                </Text>
                {swimmerItems.map((item) => {
                  const itemDuration = formatDuration(item.durationSec);
                  return (
                    <View key={item.id} style={styles.mediaItem}>
                      <View style={styles.mediaDetails}>
                        <Text style={styles.mediaTitle}>{item.type.toUpperCase()}</Text>
                        <Text style={styles.mediaMeta}>
                          {item.fileName}
                          {itemDuration ? ` | ${itemDuration}` : ''}
                        </Text>
                        <Text style={styles.mediaMeta}>{formatSavedAt(item.savedAt)}</Text>
                      </View>
                      <TouchableOpacity style={styles.shareButton} onPress={() => shareItem(item)}>
                        <Share2 color={colors.bgDeep} size={18} />
                        <Text style={styles.shareButtonText}>SHARE</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  notice: {
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  noticeTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 24,
    color: colors.accent,
  },
  noticeText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  section: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 24,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgDeep,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionColumn: {
    gap: spacing.md,
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionFull: {
    minHeight: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionText: {
    fontFamily: fontFamily.heading,
    color: colors.bgDeep,
    fontSize: 20,
    letterSpacing: 1,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionFull: {
    minHeight: 48,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontFamily: fontFamily.heading,
    color: colors.accent,
    fontSize: 19,
    letterSpacing: 1,
  },
  dangerActionFull: {
    minHeight: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dangerActionText: {
    fontFamily: fontFamily.heading,
    color: colors.text,
    fontSize: 20,
    letterSpacing: 1,
  },
  disabledAction: {
    opacity: 0.7,
  },
  savedHint: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  swimmerGroup: {
    gap: spacing.sm,
  },
  swimmerTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.gold,
  },
  mediaItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgDeep,
    padding: spacing.md,
    gap: spacing.md,
  },
  mediaDetails: {
    gap: spacing.xs,
  },
  mediaTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    color: colors.text,
  },
  mediaMeta: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  shareButton: {
    minHeight: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareButtonText: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.bgDeep,
    letterSpacing: 1,
  },
});
