import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  getDocs,
  where,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { subscribeSwimmerAttendance } from '../../src/services/attendance';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fontFamily,
  groupColors,
} from '../../src/config/theme';
import { NOTE_TAGS, EVENTS, COURSES, type NoteTag, type Course } from '../../src/config/constants';
import { formatRelativeTime, formatShortDate } from '../../src/utils/date';
import { formatTimeDisplay } from '../../src/utils/time';
import { exportTimesCSV, shareCSV } from '../../src/services/export';
import { exportSwimmerReportDocx } from '../../src/services/docxExport';
import { subscribeGoals } from '../../src/services/goals';
import { getAchievedStandard, calculateAge, getAgeGroup } from '../../src/data/timeStandards';
import StandardBadge from '../../src/components/StandardBadge';
import GoalCard from '../../src/components/GoalCard';
import SwimmerTimeline from '../../src/components/SwimmerTimeline';
import SwimmerVideoClips from '../../src/components/SwimmerVideoClips';
import VideoComparison from '../../src/components/VideoComparison';
import SparkLine from '../../src/components/charts/SparkLine';
import type {
  Swimmer,
  SwimmerNote,
  SwimTime,
  AttendanceRecord,
  AttendanceStatus,
  SwimmerGoal,
} from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type Tab = 'overview' | 'notes' | 'times' | 'attendance' | 'timeline';

const STATUS_COLORS: Record<string, string> = {
  normal: colors.success,
  excused: colors.accent,
  sick: colors.error,
  injured: colors.warning,
  left_early: colors.textSecondary,
};

function SwimmerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach, isAdmin } = useAuth();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [notes, setNotes] = useState<(SwimmerNote & { id: string })[]>([]);
  const [times, setTimes] = useState<(SwimTime & { id: string })[]>([]);
  const [attendance, setAttendance] = useState<(AttendanceRecord & { id: string })[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState('');
  const [selectedTags, setSelectedTags] = useState<NoteTag[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [goals, setGoals] = useState<(SwimmerGoal & { id: string })[]>([]);

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
      limit(50),
    );
    return onSnapshot(q, (snapshot) => {
      setNotes(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SwimmerNote & { id: string }),
      );
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, 'swimmers', id, 'times'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(q, (snapshot) => {
      setTimes(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as SwimTime & { id: string }));
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeSwimmerAttendance(id, setAttendance, 90);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeGoals(id, (g) => setGoals(g as (SwimmerGoal & { id: string })[]));
  }, [id]);

  const toggleTag = (tag: NoteTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
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

  const handleDeleteNote = (noteId: string) => {
    Alert.alert('Delete Note', 'Delete this note permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'swimmers', id!, 'notes', noteId));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleDeleteTime = (timeId: string) => {
    Alert.alert('Delete Time', 'Delete this time permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'swimmers', id!, 'times', timeId));
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
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
          {swimmer.profilePhotoUrl ? (
            <Image source={{ uri: swimmer.profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {swimmer.firstName[0]}
                {swimmer.lastName[0]}
              </Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{swimmer.displayName.toUpperCase()}</Text>
            <View style={styles.headerMeta}>
              <View
                style={[
                  styles.groupBadge,
                  {
                    borderColor: groupColors[swimmer.group] || colors.purple,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.groupBadgeText,
                    { color: groupColors[swimmer.group] || colors.accent },
                  ]}
                >
                  {swimmer.group}
                </Text>
              </View>
              <Text style={styles.headerGender}>{swimmer.gender === 'M' ? 'Male' : 'Female'}</Text>
              {swimmer.usaSwimmingId && (
                <Text style={styles.headerUsaId}>USA #{swimmer.usaSwimmingId}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerButtons}>
            {isAdmin && (
              <TouchableOpacity
                style={styles.medicalBtn}
                onPress={() => router.push(`/swimmer/medical?id=${id}`)}
              >
                <Text style={styles.medicalBtnText}>MED</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() =>
                router.push(
                  `/swimmer/invite-parent?swimmerId=${id}&swimmerName=${encodeURIComponent(`${swimmer.firstName} ${swimmer.lastName}`)}`,
                )
              }
            >
              <Text style={styles.inviteBtnText}>INVITE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/swimmer/edit?id=${id}`)}
            >
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => {
                exportSwimmerReportDocx(swimmer, times, attendance).catch((err) =>
                  Alert.alert('Export Error', err.message),
                );
              }}
            >
              <Text style={styles.inviteBtnText}>REPORT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {(['overview', 'notes', 'times', 'attendance', 'timeline'] as Tab[]).map((tab) => {
            let label = '';
            if (tab === 'overview') label = 'OVERVIEW';
            else if (tab === 'notes') label = `NOTES (${notes.length})`;
            else if (tab === 'times') label = `TIMES (${times.length})`;
            else if (tab === 'timeline') label = 'TIMELINE';
            else label = 'ATTEND';
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab Content */}
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabContentInner}>
          {activeTab === 'overview' && (
            <OverviewTab
              swimmer={swimmer}
              noteCount={notes.length}
              timeCount={times.length}
              times={times}
              attendanceCount={attendance.length}
              goals={goals}
              swimmerId={id!}
            />
          )}
          {activeTab === 'notes' && (
            <NotesTab
              notes={notes}
              noteText={noteText}
              setNoteText={setNoteText}
              selectedTags={selectedTags}
              toggleTag={toggleTag}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              saving={savingNote}
              currentCoachId={coach?.uid || ''}
            />
          )}
          {activeTab === 'times' && (
            <TimesTab
              times={times}
              swimmerId={id!}
              coach={coach}
              onDeleteTime={handleDeleteTime}
              swimmer={swimmer}
            />
          )}
          {activeTab === 'attendance' && <AttendanceTab records={attendance} />}
          {activeTab === 'timeline' && id && (
            <View style={{ gap: spacing.lg }}>
              <SwimmerTimeline swimmerId={id} />
              <SwimmerVideoClips swimmerId={id} />
              <VideoComparison swimmerId={id} />
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  swimmer,
  noteCount,
  timeCount,
  times,
  attendanceCount,
  goals,
  swimmerId,
}: {
  swimmer: Swimmer;
  noteCount: number;
  timeCount: number;
  times: (SwimTime & { id: string })[];
  attendanceCount: number;
  goals: (SwimmerGoal & { id: string })[];
  swimmerId: string;
}) {
  // Compute age group for standards
  const dob =
    swimmer.dateOfBirth instanceof Date
      ? swimmer.dateOfBirth
      : (swimmer.dateOfBirth as any)?.toDate?.() || null;
  const age = dob ? calculateAge(dob) : null;
  const ageGroup = age !== null ? getAgeGroup(age) : null;
  const activeGoals = goals.filter((g) => !g.achieved);

  // Build PR board: group PRs by stroke category
  const prs = times.filter((t) => t.isPR);
  const prsByStroke: Record<string, (SwimTime & { id: string })[]> = {};
  for (const pr of prs) {
    // Extract stroke from event name (e.g., "50 Free" → "Free")
    const parts = pr.event.split(' ');
    const stroke = parts.slice(1).join(' ') || pr.event;
    if (!prsByStroke[stroke]) prsByStroke[stroke] = [];
    prsByStroke[stroke].push(pr);
  }

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
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatNum}>{attendanceCount}</Text>
          <Text style={styles.overviewStatLabel}>PRACTICES</Text>
        </View>
      </View>

      {/* Standards & Goals */}
      {ageGroup && (
        <View style={styles.overviewCard}>
          <View style={styles.goalsSectionHeader}>
            <Text style={styles.overviewCardTitle}>GOALS & STANDARDS</Text>
            <TouchableOpacity
              style={styles.viewStandardsBtn}
              onPress={() => router.push(`/swimmer/standards?id=${swimmerId}`)}
            >
              <Text style={styles.viewStandardsBtnText}>VIEW STANDARDS</Text>
            </TouchableOpacity>
          </View>
          {activeGoals.length > 0 ? (
            activeGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} gender={swimmer.gender} ageGroup={ageGroup} />
            ))
          ) : (
            <Text style={styles.emptyText}>No active goals — set them in Standards</Text>
          )}
        </View>
      )}

      {/* PR Board */}
      {prs.length > 0 && (
        <View style={styles.overviewCard}>
          <Text style={styles.overviewCardTitle}>PERSONAL RECORDS</Text>
          {Object.entries(prsByStroke).map(([stroke, strokePrs]) => (
            <View key={stroke} style={styles.prSection}>
              <Text style={styles.prStrokeLabel}>{stroke.toUpperCase()}</Text>
              {strokePrs
                .sort((a, b) => {
                  const distA = parseInt(a.event) || 0;
                  const distB = parseInt(b.event) || 0;
                  return distA - distB;
                })
                .map((pr) => (
                  <View key={pr.id} style={styles.prRow}>
                    <Text style={styles.prEvent}>{pr.event}</Text>
                    <View style={styles.prTimeContainer}>
                      <Text style={styles.prTime}>{pr.timeDisplay}</Text>
                      <Text style={styles.prCourse}>{pr.course}</Text>
                      <View style={styles.prBadgeSmall}>
                        <Text style={styles.prBadgeSmallText}>PR</Text>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          ))}
        </View>
      )}

      <View style={styles.overviewCard}>
        <Text style={styles.overviewCardTitle}>GOALS</Text>
        {swimmer.goals?.length > 0 ? (
          swimmer.goals.map((g, i) => (
            <Text key={i} style={styles.listItem}>
              • {g}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>No goals set yet — tap EDIT to add</Text>
        )}
      </View>

      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { flex: 1 }]}>
          <Text style={styles.overviewCardTitle}>STRENGTHS</Text>
          {swimmer.strengths?.length > 0 ? (
            swimmer.strengths.map((s, i) => (
              <Text key={i} style={styles.listItem}>
                • {s}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>None yet</Text>
          )}
        </View>
        <View style={[styles.overviewCard, { flex: 1 }]}>
          <Text style={styles.overviewCardTitle}>WEAKNESSES</Text>
          {swimmer.weaknesses?.length > 0 ? (
            swimmer.weaknesses.map((w, i) => (
              <Text key={i} style={styles.listItem}>
                • {w}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>None yet — tap EDIT to add</Text>
          )}
        </View>
      </View>

      <View style={styles.overviewCard}>
        <Text style={styles.overviewCardTitle}>FOCUS AREAS</Text>
        {swimmer.techniqueFocusAreas?.length > 0 ? (
          swimmer.techniqueFocusAreas.map((t, i) => (
            <Text key={i} style={styles.listItem}>
              • {t}
            </Text>
          ))
        ) : (
          <Text style={styles.emptyText}>None yet</Text>
        )}
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

// ────────────────────────────────────────────────────────────────────────────
// Attendance Tab
// ────────────────────────────────────────────────────────────────────────────

function AttendanceTab({ records }: { records: (AttendanceRecord & { id: string })[] }) {
  // Compute stats
  const total = records.length;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const last30 = records.filter((r) => r.practiceDate >= thirtyDaysAgoStr).length;

  // Streak: consecutive days with attendance (by unique practiceDate, most recent first)
  const uniqueDates = [...new Set(records.map((r) => r.practiceDate))].sort().reverse();
  let streak = 0;
  if (uniqueDates.length > 0) {
    // Count consecutive dates from most recent
    streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      // Allow gaps of weekends (up to 3 days apart counts as consecutive)
      if (diffDays <= 3) {
        streak++;
      } else {
        break;
      }
    }
  }

  // Calendar heat grid: last 30 days
  const attendedDates = new Set(records.map((r) => r.practiceDate));
  const calendarDays: { date: string; attended: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    calendarDays.push({ date: dateStr, attended: attendedDates.has(dateStr) });
  }

  return (
    <View style={styles.attendanceContainer}>
      {/* Stats */}
      <View style={styles.overviewRow}>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatNum}>{total}</Text>
          <Text style={styles.overviewStatLabel}>TOTAL</Text>
        </View>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewStatNum}>{last30}</Text>
          <Text style={styles.overviewStatLabel}>LAST 30D</Text>
        </View>
        <View style={styles.overviewStat}>
          <Text style={[styles.overviewStatNum, { color: colors.gold }]}>{streak}</Text>
          <Text style={styles.overviewStatLabel}>STREAK</Text>
        </View>
      </View>

      {/* Calendar Heat Grid */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewCardTitle}>LAST 30 DAYS</Text>
        <View style={styles.heatGrid}>
          {calendarDays.map((day) => (
            <View
              key={day.date}
              style={[
                styles.heatCell,
                { backgroundColor: day.attended ? colors.gold : colors.bgBase },
              ]}
            />
          ))}
        </View>
        <View style={styles.heatLegend}>
          <View style={styles.heatLegendItem}>
            <View style={[styles.heatLegendDot, { backgroundColor: colors.gold }]} />
            <Text style={styles.heatLegendText}>Present</Text>
          </View>
          <View style={styles.heatLegendItem}>
            <View
              style={[
                styles.heatLegendDot,
                { backgroundColor: colors.bgBase, borderWidth: 1, borderColor: colors.border },
              ]}
            />
            <Text style={styles.heatLegendText}>No record</Text>
          </View>
        </View>
      </View>

      {/* Attendance Records */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewCardTitle}>HISTORY</Text>
        {records.length === 0 ? (
          <Text style={styles.emptyText}>No attendance records yet</Text>
        ) : (
          records.map((rec) => {
            const arrivedAt =
              rec.arrivedAt instanceof Date
                ? rec.arrivedAt
                : (rec.arrivedAt as any)?.toDate?.() || null;
            const departedAt =
              rec.departedAt instanceof Date
                ? rec.departedAt
                : (rec.departedAt as any)?.toDate?.() || null;
            const status = rec.status || 'normal';
            const statusColor = STATUS_COLORS[status] || colors.textSecondary;

            return (
              <View key={rec.id} style={styles.attendanceRow}>
                <View style={styles.attendanceDateCol}>
                  <Text style={styles.attendanceDate}>{rec.practiceDate}</Text>
                  {arrivedAt && (
                    <Text style={styles.attendanceTime}>
                      {arrivedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {departedAt
                        ? ` — ${departedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                        : ''}
                    </Text>
                  )}
                </View>
                <View style={styles.attendanceStatusCol}>
                  <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {status === 'left_early' ? 'LEFT EARLY' : status.toUpperCase()}
                    </Text>
                  </View>
                  {rec.note && (
                    <Text style={styles.attendanceNote} numberOfLines={1}>
                      {rec.note}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Notes Tab
// ────────────────────────────────────────────────────────────────────────────

function NotesTab({
  notes,
  noteText,
  setNoteText,
  selectedTags,
  toggleTag,
  onAddNote,
  onDeleteNote,
  saving,
  currentCoachId,
}: {
  notes: (SwimmerNote & { id: string })[];
  noteText: string;
  setNoteText: (t: string) => void;
  selectedTags: NoteTag[];
  toggleTag: (tag: NoteTag) => void;
  onAddNote: () => void;
  onDeleteNote: (id: string) => void;
  saving: boolean;
  currentCoachId: string;
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
          style={[
            styles.addNoteButton,
            (!noteText.trim() || saving) && styles.addNoteButtonDisabled,
          ]}
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
            <View style={styles.noteHeaderRight}>
              <Text style={styles.noteDate}>{String(note.practiceDate)}</Text>
              {note.coachId === currentCoachId && (
                <TouchableOpacity onPress={() => onDeleteNote(note.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
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

// ────────────────────────────────────────────────────────────────────────────
// Times Tab (with Add Time)
// ────────────────────────────────────────────────────────────────────────────

function TimesTab({
  times,
  swimmerId,
  coach,
  onDeleteTime,
  swimmer,
}: {
  times: (SwimTime & { id: string })[];
  swimmerId: string;
  coach: any;
  onDeleteTime: (id: string) => void;
  swimmer: Swimmer;
}) {
  const [showAddTime, setShowAddTime] = useState(false);
  const trendByEvent = useMemo(() => {
    const grouped = new Map<string, number[]>();

    [...times]
      .sort((left, right) => {
        const leftDate = getTimestampValue(left.createdAt);
        const rightDate = getTimestampValue(right.createdAt);
        return leftDate.getTime() - rightDate.getTime();
      })
      .forEach((time) => {
        const key = `${time.event}|${time.course}`;
        const values = grouped.get(key) ?? [];
        values.push(time.time);
        grouped.set(key, values);
      });

    return grouped;
  }, [times]);

  // Compute age group for standard badges
  const dob =
    swimmer.dateOfBirth instanceof Date
      ? swimmer.dateOfBirth
      : (swimmer.dateOfBirth as any)?.toDate?.() || null;
  const age = dob ? calculateAge(dob) : null;
  const ageGroup = age !== null ? getAgeGroup(age) : null;

  return (
    <View>
      <View style={styles.timesHeaderRow}>
        <TouchableOpacity style={styles.addTimeBtn} onPress={() => setShowAddTime(true)}>
          <Text style={styles.addTimeBtnText}>+ ADD TIME</Text>
        </TouchableOpacity>
        {times.length > 0 && (
          <TouchableOpacity
            style={styles.exportTimesBtn}
            onPress={async () => {
              try {
                const csv = exportTimesCSV(times);
                await shareCSV('bspc_times.csv', csv);
              } catch (err: any) {
                Alert.alert('Export Error', err.message);
              }
            }}
          >
            <Text style={styles.exportTimesBtnText}>EXPORT</Text>
          </TouchableOpacity>
        )}
      </View>

      {times.length === 0 ? (
        <View style={styles.emptyTimesContainer}>
          <Text style={styles.emptyText}>
            No times recorded yet. Tap "+ ADD TIME" to enter results.
          </Text>
        </View>
      ) : (
        times.map((time) => (
          <TouchableOpacity
            key={time.id}
            style={styles.timeRow}
            onLongPress={() => onDeleteTime(time.id)}
          >
            <View>
              <View style={styles.timeEventRow}>
                <Text style={styles.timeEvent}>{time.event}</Text>
                <SparkLine
                  data={trendByEvent.get(`${time.event}|${time.course}`) ?? [time.time]}
                  invertTrend
                  width={80}
                  height={24}
                  color={colors.gold}
                />
              </View>
              <Text style={styles.timeMeet}>
                {time.meetName || 'Practice'} {time.course}
              </Text>
            </View>
            <View style={styles.timeRight}>
              <Text style={[styles.timeValue, time.isPR && styles.timePR]}>{time.timeDisplay}</Text>
              {time.isPR && (
                <View style={styles.prBadgeContainer}>
                  <Text style={styles.prBadge}>PR</Text>
                </View>
              )}
              {ageGroup &&
                (() => {
                  const standard = getAchievedStandard(
                    time.course as any,
                    swimmer.gender,
                    ageGroup,
                    time.event,
                    time.time,
                  );
                  return standard ? <StandardBadge level={standard} size="sm" /> : null;
                })()}
            </View>
          </TouchableOpacity>
        ))
      )}

      {times.length > 0 && <Text style={styles.longPressHint}>Long press a time to delete</Text>}

      {showAddTime && (
        <AddTimeModal
          swimmerId={swimmerId}
          coach={coach}
          existingTimes={times}
          onClose={() => setShowAddTime(false)}
        />
      )}
    </View>
  );
}

function getTimestampValue(timestamp: SwimTime['createdAt']): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }

  const maybeTimestamp = timestamp as SwimTime['createdAt'] & { toDate?: () => Date };
  return typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : new Date();
}

// ────────────────────────────────────────────────────────────────────────────
// Add Time Modal
// ────────────────────────────────────────────────────────────────────────────

function AddTimeModal({
  swimmerId,
  coach,
  existingTimes,
  onClose,
}: {
  swimmerId: string;
  coach: any;
  existingTimes: (SwimTime & { id: string })[];
  onClose: () => void;
}) {
  const [event, setEvent] = useState<string>(EVENTS[1]); // default 50 Free
  const [course, setCourse] = useState<Course>('SCY');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [hundredths, setHundredths] = useState('');
  const [meetName, setMeetName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const sec = parseInt(seconds) || 0;
    const hund = parseInt(hundredths) || 0;
    const min = parseInt(minutes) || 0;
    const totalHundredths = min * 6000 + sec * 100 + hund;

    if (totalHundredths <= 0) {
      Alert.alert('Required', 'Enter a valid time');
      return;
    }

    // Format display
    const displayMin = min > 0 ? `${min}:` : '';
    const displaySec = min > 0 ? String(sec).padStart(2, '0') : String(sec);
    const displayHund = String(hund).padStart(2, '0');
    const timeDisplay = `${displayMin}${displaySec}.${displayHund}`;

    // Check if PR (faster = lower hundredths for same event+course)
    const sameTimes = existingTimes.filter((t) => t.event === event && t.course === course);
    const isPR = sameTimes.length === 0 || sameTimes.every((t) => totalHundredths < t.time);

    setSaving(true);
    try {
      await addDoc(collection(db, 'swimmers', swimmerId, 'times'), {
        event,
        course,
        time: totalHundredths,
        timeDisplay,
        isPR,
        meetName: meetName.trim() || null,
        meetDate: null,
        source: 'manual',
        createdAt: serverTimestamp(),
        createdBy: coach?.uid || '',
      });

      // If this is a new PR, un-PR the old ones
      if (isPR && sameTimes.length > 0) {
        const timesRef = collection(db, 'swimmers', swimmerId, 'times');
        const q = query(
          timesRef,
          where('event', '==', event),
          where('course', '==', course),
          where('isPR', '==', true),
        );
        const snap = await getDocs(q);
        const { updateDoc: updateDocFn } = await import('firebase/firestore');
        for (const d of snap.docs) {
          if (d.id !== undefined) {
            await updateDocFn(d.ref, { isPR: false });
          }
        }
      }

      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  };

  return (
    <Modal transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ADD TIME</Text>

            <Text style={styles.modalLabel}>EVENT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {EVENTS.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.chip, event === e && styles.chipActive]}
                    onPress={() => setEvent(e)}
                  >
                    <Text style={[styles.chipText, event === e && styles.chipTextActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.modalLabel}>COURSE</Text>
            <View style={styles.courseRow}>
              {COURSES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.courseChip, course === c && styles.courseChipActive]}
                  onPress={() => setCourse(c)}
                >
                  <Text
                    style={[styles.courseChipText, course === c && styles.courseChipTextActive]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>TIME</Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputGroup}>
                <TextInput
                  style={styles.timeInput}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={2}
                />
                <Text style={styles.timeColon}>:</Text>
              </View>
              <View style={styles.timeInputGroup}>
                <TextInput
                  style={styles.timeInput}
                  value={seconds}
                  onChangeText={setSeconds}
                  keyboardType="number-pad"
                  placeholder="00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={2}
                />
                <Text style={styles.timeColon}>.</Text>
              </View>
              <TextInput
                style={styles.timeInput}
                value={hundredths}
                onChangeText={setHundredths}
                keyboardType="number-pad"
                placeholder="00"
                placeholderTextColor={colors.textSecondary}
                maxLength={2}
              />
            </View>

            <Text style={styles.modalLabel}>MEET NAME</Text>
            <TextInput
              style={styles.modalInput}
              value={meetName}
              onChangeText={setMeetName}
              placeholder="e.g. Winter Champs (optional)"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.modalSaveText}>{saving ? 'SAVING...' : 'SAVE TIME'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  errorText: { fontFamily: fontFamily.heading, fontSize: fontSize.xl, color: colors.error },

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
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.gold,
    marginRight: spacing.lg,
  },
  avatarText: { fontFamily: fontFamily.heading, color: colors.bgDeep, fontSize: fontSize.xl },
  headerInfo: { flex: 1 },
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
  groupBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  headerGender: { fontFamily: fontFamily.body, color: colors.textSecondary, fontSize: fontSize.sm },
  headerUsaId: {
    fontFamily: fontFamily.statMono,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  headerButtons: { flexDirection: 'column', gap: spacing.xs },
  inviteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
  },
  inviteBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.gold,
    letterSpacing: 1,
  },
  editBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  editBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 1,
  },
  medicalBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  medicalBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.error,
    letterSpacing: 1,
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
  tabActive: { borderBottomColor: colors.accent },
  tabText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  tabTextActive: { color: colors.accent },
  tabContent: { flex: 1 },
  tabContentInner: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  // Overview
  overviewContainer: { gap: spacing.md },
  overviewRow: { flexDirection: 'row', gap: spacing.md },
  overviewStat: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  overviewStatNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxxl, color: colors.accent },
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
  contactName: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  contactDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Goals & Standards
  goalsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viewStandardsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  viewStandardsBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.gold,
    letterSpacing: 1,
  },

  // PR Board
  prSection: { marginBottom: spacing.md },
  prStrokeLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  prEvent: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  prTimeContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prTime: { fontFamily: fontFamily.stat, fontSize: fontSize.lg, color: colors.gold },
  prCourse: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  prBadgeSmall: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.xs,
  },
  prBadgeSmallText: { fontFamily: fontFamily.pixel, fontSize: 6, color: colors.gold },

  // Attendance Tab
  attendanceContainer: { gap: spacing.md },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: spacing.sm },
  heatCell: { width: 16, height: 16, borderRadius: 2, borderWidth: 1, borderColor: colors.border },
  heatLegend: { flexDirection: 'row', gap: spacing.lg },
  heatLegendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heatLegendDot: { width: 10, height: 10, borderRadius: 2 },
  heatLegendText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  attendanceDateCol: { flex: 1 },
  attendanceDate: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.text },
  attendanceTime: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  attendanceStatusCol: { alignItems: 'flex-end' },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadgeText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel },
  attendanceNote: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 150,
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
  tagScroll: { marginTop: spacing.sm },
  tagRow: { flexDirection: 'row', gap: spacing.xs },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  tagText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.textSecondary },
  tagTextActive: { color: colors.text },
  addNoteButton: {
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addNoteButtonDisabled: { opacity: 0.5 },
  addNoteButtonText: { fontFamily: fontFamily.bodySemi, color: colors.text, fontSize: fontSize.md },
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
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  noteHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteCoach: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.accent },
  noteDate: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary },
  deleteBtn: { padding: spacing.xs },
  deleteBtnText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.error },
  noteContent: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  noteTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
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
  timesHeaderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  addTimeBtn: {
    flex: 1,
    backgroundColor: colors.purple,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  addTimeBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
    letterSpacing: 1,
  },
  exportTimesBtn: {
    backgroundColor: colors.bgDeep,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  exportTimesBtnText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
    letterSpacing: 1,
  },
  emptyTimesContainer: { paddingVertical: spacing.xxl, alignItems: 'center' },
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
  timeEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeEvent: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  timeMeet: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timeRight: { alignItems: 'flex-end' },
  timeValue: { fontFamily: fontFamily.stat, fontSize: fontSize.xl, color: colors.text },
  timePR: { color: colors.gold },
  prBadgeContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.xs,
    marginTop: 2,
  },
  prBadge: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold },
  longPressHint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  // Add Time Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalScroll: { flex: 1, marginTop: 60 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  modalTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.body,
    color: colors.text,
    backgroundColor: colors.bgBase,
  },

  // Event chips
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

  // Course
  courseRow: { flexDirection: 'row', gap: spacing.sm },
  courseChip: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.bgBase,
  },
  courseChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  courseChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  courseChipTextActive: { color: colors.text },

  // Time input
  timeInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  timeInputGroup: { flexDirection: 'row', alignItems: 'center' },
  timeInput: {
    width: 56,
    height: 56,
    backgroundColor: colors.bgBase,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.gold,
  },
  timeColon: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalCancelBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
  },
  modalSaveText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
});

export default withScreenErrorBoundary(SwimmerProfileScreen, 'SwimmerProfileScreen');
