import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getVideoStatusLabel, getVideoStatusColor } from '../services/video';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import type { VideoSession } from '../types/firestore.types';

type VideoSessionWithId = VideoSession & { id: string };

interface Props {
  swimmerId: string;
}

export default function SwimmerVideoClips({ swimmerId }: Props) {
  const [sessions, setSessions] = useState<VideoSessionWithId[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'video_sessions'),
      where('taggedSwimmerIds', 'array-contains', swimmerId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoSessionWithId)));
    });
  }, [swimmerId]);

  if (sessions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VIDEO CLIPS ({sessions.length})</Text>
      {sessions.map((session) => {
        const statusColor = getVideoStatusColor(session.status);
        const statusLabel = getVideoStatusLabel(session.status);
        return (
          <TouchableOpacity
            key={session.id}
            style={styles.clip}
            onPress={() => router.push(`/video/${session.id}`)}
          >
            <View style={[styles.thumbnail, { borderColor: statusColor }]}>
              <Text style={[styles.thumbnailText, { color: statusColor }]}>
                {session.duration}s
              </Text>
            </View>
            <View style={styles.clipInfo}>
              <Text style={styles.clipDate}>{session.practiceDate}</Text>
              <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
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
  clip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  thumbnail: {
    width: 48,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  thumbnailText: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xs,
  },
  clipInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clipDate: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    letterSpacing: 1,
  },
});
