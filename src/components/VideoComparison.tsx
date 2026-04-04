import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import type { VideoSession } from '../types/firestore.types';

type VideoSessionWithId = VideoSession & { id: string };

interface Draft {
  id: string;
  observation: string;
  diagnosis: string;
  drillRecommendation: string;
  phase: string;
}

interface Props {
  swimmerId: string;
}

export default function VideoComparison({ swimmerId }: Props) {
  const [sessions, setSessions] = useState<VideoSessionWithId[]>([]);
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);
  const [leftDrafts, setLeftDrafts] = useState<Draft[]>([]);
  const [rightDrafts, setRightDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'video_sessions'),
      where('taggedSwimmerIds', 'array-contains', swimmerId),
      where('status', '==', 'posted'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoSessionWithId));
      setSessions(data);
    });
  }, [swimmerId]);

  // Load drafts for selected sessions
  useEffect(() => {
    if (!sessions[leftIndex]) return;
    const unsub = onSnapshot(
      collection(db, 'video_sessions', sessions[leftIndex].id, 'drafts'),
      (snap) => setLeftDrafts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Draft)))
    );
    return unsub;
  }, [sessions, leftIndex]);

  useEffect(() => {
    if (!sessions[rightIndex]) return;
    const unsub = onSnapshot(
      collection(db, 'video_sessions', sessions[rightIndex].id, 'drafts'),
      (snap) => setRightDrafts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Draft)))
    );
    return unsub;
  }, [sessions, rightIndex]);

  if (sessions.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>VIDEO COMPARISON</Text>
        <Text style={styles.emptyText}>
          Need at least 2 reviewed video sessions to compare technique progression.
        </Text>
      </View>
    );
  }

  const leftSession = sessions[leftIndex];
  const rightSession = sessions[rightIndex];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TECHNIQUE PROGRESSION</Text>

      <View style={styles.comparison}>
        {/* Left (Earlier) */}
        <View style={styles.side}>
          <Text style={styles.sideLabel}>EARLIER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {sessions.map((s, i) => i !== rightIndex && (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.dateChip, leftIndex === i && styles.dateChipActive]}
                  onPress={() => setLeftIndex(i)}
                >
                  <Text style={[styles.dateChipText, leftIndex === i && styles.dateChipTextActive]}>
                    {s.practiceDate}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {leftDrafts.filter((d) => d.observation).map((draft) => (
            <View key={draft.id} style={styles.draftItem}>
              <Text style={styles.draftPhase}>{draft.phase?.toUpperCase()}</Text>
              <Text style={styles.draftText}>{draft.observation}</Text>
              {draft.diagnosis ? <Text style={styles.draftDiagnosis}>{draft.diagnosis}</Text> : null}
            </View>
          ))}
          {leftDrafts.length === 0 && (
            <Text style={styles.noDrafts}>No observations</Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <Text style={styles.arrow}>→</Text>
        </View>

        {/* Right (Later) */}
        <View style={styles.side}>
          <Text style={styles.sideLabel}>LATER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {sessions.map((s, i) => i !== leftIndex && (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.dateChip, rightIndex === i && styles.dateChipActive]}
                  onPress={() => setRightIndex(i)}
                >
                  <Text style={[styles.dateChipText, rightIndex === i && styles.dateChipTextActive]}>
                    {s.practiceDate}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {rightDrafts.filter((d) => d.observation).map((draft) => (
            <View key={draft.id} style={styles.draftItem}>
              <Text style={styles.draftPhase}>{draft.phase?.toUpperCase()}</Text>
              <Text style={styles.draftText}>{draft.observation}</Text>
              {draft.diagnosis ? <Text style={styles.draftDiagnosis}>{draft.diagnosis}</Text> : null}
            </View>
          ))}
          {rightDrafts.length === 0 && (
            <Text style={styles.noDrafts}>No observations</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  comparison: { flexDirection: 'row' },
  side: { flex: 1 },
  sideLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  chipRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  dateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(179, 136, 255, 0.15)' },
  dateChipText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  dateChipTextActive: { color: colors.accent },

  divider: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  arrow: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
  },

  draftItem: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  draftPhase: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  draftText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.text,
    lineHeight: 16,
  },
  draftDiagnosis: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  noDrafts: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    paddingVertical: spacing.md,
  },
});
