import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import {
  subscribeVideoSession,
  getVideoStatusLabel,
  getVideoStatusColor,
} from '../../src/services/video';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { useVideoStore } from '../../src/stores/videoStore';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';
import type { VideoSession } from '../../src/types/firestore.types';

// Proposal C (Director Ruling 28/29): AI analysis is disabled in v1. This
// screen retains video retrieval, the terminal uploaded presentation, and
// non-AI metadata — it renders no AI analysis card, no pipeline progress, and
// no draft-results/observation surface.
function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useVideoStore((state) => state.selectedSession);
  const setSelectedSession = useVideoStore((state) => state.setSelectedSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsubSession = subscribeVideoSession(id, (s) => {
      if (s) {
        setSelectedSession(s as VideoSession & { id: string });
      }
      setLoading(false);
    });
    return () => {
      unsubSession();
      setSelectedSession(null);
    };
  }, [id, setSelectedSession]);

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
