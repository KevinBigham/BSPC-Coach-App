import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily, groupColors } from '../../src/config/theme';
import { NOTE_TAGS, type NoteTag } from '../../src/config/constants';
import type { Swimmer, SwimmerNote, SwimTime } from '../../src/types/firestore.types';

type Tab = 'overview' | 'notes' | 'times';

export default function SwimmerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach } = useAuth();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [notes, setNotes] = useState<(SwimmerNote & { id: string })[]>([]);
  const [times, setTimes] = useState<(SwimTime & { id: string })[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState('');
  const [selectedTags, setSelectedTags] = useState<NoteTag[]>([]);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'swimmers', id), (snap) => {
      if (snap.exists()) {
        setSwimmer({ id: snap.id, ...snap.data() } as Swimmer);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'swimmers', id, 'notes'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SwimmerNote & { id: string }))
      );
    });
    return unsubscribe;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'swimmers', id, 'times'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTimes(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as SwimTime & { id: string }))
      );
    });
    return unsubscribe;
  }, [id]);

  const toggleTag = (tag: NoteTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !id) return;
    setSavingNote(true);
    try {
      await addDoc(collection(db, 'swimmers', id, 'notes'), {
        content: noteText.trim(),
        tags: selectedTags,
        source: 'manual',
        coachId: coach?.uid || '',
        coachName: coach?.displayName || 'Unknown',
        practiceDate: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
      });
      setNoteText('');
      setSelectedTags([]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSavingNote(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!swimmer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Swimmer not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: swimmer.displayName.toUpperCase() }} />
      <View style={styles.container}>
        {/* Scorebug Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {swimmer.firstName[0]}{swimmer.lastName[0]}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{swimmer.displayName.toUpperCase()}</Text>
            <View style={styles.headerMeta}>
              <View style={[styles.groupBadge, { borderColor: groupColors[swimmer.group] || colors.purple, backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                <Text style={[styles.groupBadgeText, { color: groupColors[swimmer.group] || colors.accent }]}>{swimmer.group}</Text>
              </View>
              <Text style={styles.headerGender}>{swimmer.gender === 'M' ? 'Male' : 'Female'}</Text>
              {swimmer.usaSwimmingId && (
                <Text style={styles.headerUsaId}>USA #{swimmer.usaSwimmingId}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(['overview', 'notes', 'times'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overview' ? 'OVERVIEW' : tab === 'notes' ? `NOTES (${notes.length})` : `TIMES (${times.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
          {activeTab === 'overview' && (
            <OverviewTab swimmer={swimmer} noteCount={notes.length} timeCount={times.length} />
          )}
          {activeTab === 'notes' && (
            <NotesTab
              notes={notes}
              noteText={noteText}
              setNoteText={setNoteText}
              selectedTags={selectedTags}
              toggleTag={toggleTag}
              onAddNote={handleAddNote}
              saving={savingNote}
            />
          )}
          {activeTab === 'times' && <TimesTab times={times} />}
        </ScrollView>
      </View>
    </>
  );
}

function OverviewTab({
  swimmer,
  noteCount,
  timeCount,
}: {
  swimmer: Swimmer;
  noteCount: number;
  timeCount: number;
}) {
  return (
    <View style={styles.overviewContainer}>
      <View style={styles.overviewRow}>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatNum}>{noteCount}</Text>
          <Text style={styles.overviewStatLabel}>NOTES</Text>
        </View>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatNum}>{timeCount}</Text>
          <Text style={styles.overviewStatLabel}>TIMES</Text>
        </View>
      </View>

      <View style={styles.overviewCard}>
        <Text style={styles.overviewCardTitle}>GOALS</Text>
        {swimmer.goals?.length > 0 ? (
          swimmer.goals.map((g, i) => (
            <Text key={i} style={styles.listItem}>{g}</Text>
          ))
        ) : (
          <Text style={styles.emptyText}>No goals set yet</Text>
        )}
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { flex: 1 }]}>
          <Text style={styles.overviewCardTitle}>STRENGTHS</Text>
          {swimmer.strengths?.length > 0 ? (
            swimmer.strengths.map((s, i) => (
              <Text key={i} style={styles.listItem}>{s}</Text>
            ))
          ) : (
            <Text style={styles.emptyText}>None yet</Text>
          )}
        </View>
        <View style={[styles.overviewCard, { flex: 1 }]}>
          <Text style={styles.overviewCardTitle}>FOCUS AREAS</Text>
          {swimmer.techniqueFocusAreas?.length > 0 ? (
            swimmer.techniqueFocusAreas.map((t, i) => (
              <Text key={i} style={styles.listItem}>{t}</Text>
            ))
          ) : (
            <Text style={styles.emptyText}>None yet</Text>
          )}
        </View>
      </View>

      {swimmer.parentContacts?.length > 0 && (
        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>PARENT CONTACTS</Text>
          {swimmer.parentContacts.map((pc, i) => (
            <View key={i} style={styles.contactRow}>
              <Text style={styles.contactName}>{pc.name}</Text>
              {pc.phone ? <Text style={styles.contactDetail}>{pc.phone}</Text> : null}
              {pc.email ? <Text style={styles.contactDetail}>{pc.email}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function NotesTab({
  notes,
  noteText,
  setNoteText,
  selectedTags,
  toggleTag,
  onAddNote,
  saving,
}: {
  notes: (SwimmerNote & { id: string })[];
  noteText: string;
  setNoteText: (t: string) => void;
  selectedTags: NoteTag[];
  toggleTag: (tag: NoteTag) => void;
  onAddNote: () => void;
  saving: boolean;
}) {
  return (
    <View>
      <View style={styles.noteForm}>
        <TextInput
          style={styles.noteInput}
          placeholder="Add an observation..."
          placeholderTextColor={colors.textSecondary}
          value={noteText}
          onChangeText={setNoteText}
          multiline
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
          <View style={styles.tagRow}>
            {NOTE_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, selectedTags.includes(tag) && styles.tagActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TouchableOpacity
          style={[styles.addNoteButton, (!noteText.trim() || saving) && styles.addNoteButtonDisabled]}
          onPress={onAddNote}
          disabled={!noteText.trim() || saving}
        >
          <Text style={styles.addNoteButtonText}>{saving ? 'SAVING...' : 'ADD NOTE'}</Text>
        </TouchableOpacity>
      </View>

      {notes.map((note) => (
        <View key={note.id} style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteCoach}>{note.coachName}</Text>
            <Text style={styles.noteDate}>{String(note.practiceDate)}</Text>
          </View>
          <Text style={styles.noteContent}>{note.content}</Text>
          {note.tags?.length > 0 && (
            <View style={styles.noteTagRow}>
              {note.tags.map((tag) => (
                <View key={tag} style={styles.noteTag}>
                  <Text style={styles.noteTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {note.source !== 'manual' && (
            <Text style={styles.noteSource}>
              via {note.source === 'audio_ai' ? 'AUDIO AI' : 'VIDEO AI'}
            </Text>
          )}
        </View>
      ))}

      {notes.length === 0 && (
        <Text style={styles.emptyText}>No notes yet — add the first one above</Text>
      )}
    </View>
  );
}

function TimesTab({ times }: { times: (SwimTime & { id: string })[] }) {
  return (
    <View>
      {times.length === 0 ? (
        <View style={styles.emptyTimesContainer}>
          <Text style={styles.emptyText}>
            No times recorded yet. Times will appear here from manual entry or meet imports.
          </Text>
        </View>
      ) : (
        times.map((time) => (
          <View key={time.id} style={styles.timeRow}>
            <View>
              <Text style={styles.timeEvent}>{time.event}</Text>
              <Text style={styles.timeMeet}>{time.meetName || 'Practice'} {time.course}</Text>
            </View>
            <View style={styles.timeRight}>
              <Text style={[styles.timeValue, time.isPR && styles.timePR]}>
                {time.timeDisplay}
              </Text>
              {time.isPR && (
                <View style={styles.prBadgeContainer}>
                  <Text style={styles.prBadge}>PR</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  errorText: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.error,
  },
  // Header Scorebug
  headerCard: {
    backgroundColor: '#12081f',
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.purple,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    fontFamily: fontFamily.heading,
    color: colors.bgDeep,
    fontSize: fontSize.xl,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  groupBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
  },
  groupBadgeText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
  },
  headerGender: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  headerUsaId: {
    fontFamily: fontFamily.statMono,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accent,
  },
  tabContent: {
    flex: 1,
  },
  tabContentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  // Overview
  overviewContainer: {
    gap: spacing.md,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  overviewStat: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewStatNum: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xxxl,
    color: colors.accent,
  },
  overviewStatLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  overviewCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewCardTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  listItem: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.text,
    paddingVertical: 2,
  },
  contactRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  contactName: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  contactDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Notes
  noteForm: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgBase,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  tagScroll: {
    marginTop: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purpleLight,
  },
  tagText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  tagTextActive: {
    color: colors.text,
  },
  addNoteButton: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addNoteButtonDisabled: {
    opacity: 0.5,
  },
  addNoteButtonText: {
    fontFamily: fontFamily.bodySemi,
    color: colors.text,
    fontSize: fontSize.md,
  },
  noteCard: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  noteCoach: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  noteDate: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  noteContent: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  noteTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  noteTag: {
    backgroundColor: 'rgba(74, 14, 120, 0.3)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  noteTagText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.purpleLight,
  },
  noteSource: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  // Times
  emptyTimesContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeEvent: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  timeMeet: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeRight: {
    alignItems: 'flex-end',
  },
  timeValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  timePR: {
    color: colors.gold,
  },
  prBadgeContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.xs,
    marginTop: 2,
  },
  prBadge: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
  },
});
