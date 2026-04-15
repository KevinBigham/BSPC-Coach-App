import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import type { SwimmerNote, SwimTime } from '../types/firestore.types';
import { toDateSafe, type FirestoreTimestampLike } from '../utils/date';

type TimelineNote = Pick<SwimmerNote, 'id' | 'content' | 'source' | 'coachName' | 'tags'> & {
  practiceDate?: FirestoreTimestampLike;
};

type TimelineTime = Pick<
  SwimTime,
  'id' | 'event' | 'course' | 'timeDisplay' | 'isPR' | 'meetName' | 'meetDate'
> & {
  createdAt?: FirestoreTimestampLike;
};

interface TimelineItem {
  id: string;
  type: 'note' | 'pr' | 'video' | 'time';
  date: string;
  title: string;
  subtitle?: string;
  detail?: string;
  source?: string;
  color: string;
}

type FilterType = 'all' | 'note' | 'pr' | 'video' | 'time';

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  note: { label: 'NOTE', color: colors.accent },
  pr: { label: 'PR', color: colors.gold },
  video: { label: 'VIDEO', color: '#6366f1' },
  time: { label: 'TIME', color: colors.textSecondary },
};

interface Props {
  swimmerId: string;
}

function formatTimelineDate(value: FirestoreTimestampLike): string {
  if (typeof value === 'string') return value;
  const date = toDateSafe(value);
  return date ? date.toISOString().split('T')[0] : '';
}

export default function SwimmerTimeline({ swimmerId }: Props) {
  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [times, setTimes] = useState<TimelineTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    const unsubNotes = onSnapshot(
      query(
        collection(db, 'swimmers', swimmerId, 'notes'),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
      (snap) => setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimelineNote)),
    );
    const unsubTimes = onSnapshot(
      query(
        collection(db, 'swimmers', swimmerId, 'times'),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
      (snap) => {
        setTimes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimelineTime));
        setLoading(false);
      },
    );
    return () => {
      unsubNotes();
      unsubTimes();
    };
  }, [swimmerId]);

  const items = useMemo(() => {
    const all: TimelineItem[] = [];

    for (const note of notes) {
      const isVideo = note.source === 'video_ai';
      const isAudio = note.source === 'audio_ai';
      all.push({
        id: `note-${note.id}`,
        type: isVideo ? 'video' : 'note',
        date: formatTimelineDate(note.practiceDate),
        title: note.content?.substring(0, 120) || '',
        subtitle: isVideo ? 'AI Video Analysis' : isAudio ? 'AI Audio Note' : note.coachName,
        detail: note.tags?.join(', '),
        source: note.source,
        color: isVideo ? '#6366f1' : colors.accent,
      });
    }

    for (const time of times) {
      all.push({
        id: `time-${time.id}`,
        type: time.isPR ? 'pr' : 'time',
        date: formatTimelineDate(time.meetDate || time.createdAt),
        title: `${time.event} — ${time.timeDisplay}`,
        subtitle: time.meetName || 'Practice',
        detail: time.course,
        color: time.isPR ? colors.gold : colors.textSecondary,
      });
    }

    // Sort by date descending
    all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return all;
  }, [notes, times]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {(['all', 'note', 'pr', 'video', 'time'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'ALL' : TYPE_BADGES[f]?.label || f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>No timeline entries yet</Text>
      ) : (
        filtered.map((item, index) => {
          const badge = TYPE_BADGES[item.type] || TYPE_BADGES.note;
          const showDate = index === 0 || filtered[index - 1]?.date !== item.date;

          return (
            <View key={item.id}>
              {showDate && item.date && <Text style={styles.dateHeader}>{item.date}</Text>}
              <View style={styles.timelineItem}>
                <View style={[styles.dot, { backgroundColor: badge.color }]} />
                <View style={styles.line} />
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <View style={[styles.typeBadge, { borderColor: badge.color }]}>
                      <Text style={[styles.typeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
                  </View>
                  <Text
                    style={[styles.itemTitle, item.type === 'pr' && styles.prTitle]}
                    numberOfLines={3}
                  >
                    {item.title}
                  </Text>
                  {item.detail && <Text style={styles.itemDetail}>{item.detail}</Text>}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  centered: { paddingVertical: spacing.xxl, alignItems: 'center' },

  // Filters
  filterScroll: { marginBottom: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgBase,
  },
  filterChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  filterText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  filterTextActive: { color: colors.text },

  // Date Header
  dateHeader: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: 20,
  },

  // Timeline Item
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: spacing.xs,
    marginBottom: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    left: spacing.xs + 4,
    top: 16,
    bottom: -8,
    width: 2,
    backgroundColor: colors.border,
  },
  itemContent: {
    flex: 1,
    marginLeft: spacing.md,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  typeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, letterSpacing: 1 },
  itemSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  itemTitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  prTitle: { color: colors.gold, fontFamily: fontFamily.stat },
  itemDetail: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});
