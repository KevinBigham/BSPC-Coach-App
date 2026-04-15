import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { STANDARD_LEVELS, COURSES, type Course } from '../../src/config/constants';
import {
  standardColors,
  standardBgColors,
  standardBorderColors,
} from '../../src/config/standardColors';
import {
  getAgeGroup,
  calculateAge,
  getEventStandards,
  getAchievedStandard,
  getAvailableEvents,
  formatTime,
} from '../../src/data/timeStandards';
import { subscribeGoals, setGoal } from '../../src/services/goals';
import StandardBadge from '../../src/components/StandardBadge';
import GoalCard from '../../src/components/GoalCard';
import type {
  Swimmer,
  SwimTime,
  SwimmerGoal,
  StandardLevel,
} from '../../src/types/firestore.types';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function StandardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { coach } = useAuth();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [times, setTimes] = useState<(SwimTime & { id: string })[]>([]);
  const [goals, setGoals] = useState<(SwimmerGoal & { id: string })[]>([]);
  const [course, setCourse] = useState<Course>('SCY');

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'swimmers', id), (snap) => {
      if (snap.exists()) setSwimmer(snap.data() as Swimmer);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const {
      collection: col,
      query: q,
      orderBy,
      onSnapshot: onSnap,
    } = require('firebase/firestore');
    const timesQuery = q(col(db, 'swimmers', id, 'times'), orderBy('createdAt', 'desc'));
    return onSnap(timesQuery, (snap: any) => {
      setTimes(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeGoals(id, setGoals);
  }, [id]);

  const age = useMemo(() => {
    if (!swimmer?.dateOfBirth) return 14;
    const dob =
      swimmer.dateOfBirth instanceof Date
        ? swimmer.dateOfBirth
        : (swimmer.dateOfBirth as any)?.toDate?.() || new Date();
    return calculateAge(dob);
  }, [swimmer]);

  const ageGroup = getAgeGroup(age);
  const gender = swimmer?.gender || 'M';
  const events = getAvailableEvents(course, gender, ageGroup);

  // Build PR map: event → best time
  const prMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of times) {
      if (t.course !== course) continue;
      if (!map[t.event] || t.time < map[t.event]) {
        map[t.event] = t.time;
      }
    }
    return map;
  }, [times, course]);

  // Count achieved standards
  const standardCounts = useMemo(() => {
    const counts: Record<string, number> = { B: 0, BB: 0, A: 0, AA: 0, AAA: 0, AAAA: 0 };
    for (const event of events) {
      const pr = prMap[event];
      if (!pr) continue;
      const achieved = getAchievedStandard(course, gender, ageGroup, event, pr);
      if (achieved) counts[achieved]++;
    }
    return counts;
  }, [events, prMap, course, gender, ageGroup]);

  const handleSetGoal = (event: string, targetStandard: StandardLevel) => {
    if (!id) return;
    const currentTime = prMap[event] || undefined;
    setGoal(id, {
      event,
      course,
      targetStandard,
      currentTime,
      currentTimeDisplay: currentTime ? formatTime(currentTime) : undefined,
      notes: '',
      achieved: false,
    }).catch((err) => Alert.alert('Error', err.message));
  };

  if (!swimmer) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>
            {swimmer.firstName} {swimmer.lastName}
          </Text>
          <Text style={styles.info}>
            {ageGroup} · {gender === 'M' ? 'Male' : 'Female'} · Age {age}
          </Text>
        </View>

        {/* Course Selector */}
        <View style={styles.courseRow}>
          {COURSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.courseChip, course === c && styles.courseChipActive]}
              onPress={() => setCourse(c)}
            >
              <Text style={[styles.courseChipText, course === c && styles.courseChipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Standard Summary */}
        <View style={styles.summaryRow}>
          {STANDARD_LEVELS.map((level) => (
            <View key={level} style={styles.summaryBox}>
              <Text style={[styles.summaryNum, { color: standardColors[level as StandardLevel] }]}>
                {standardCounts[level] || 0}
              </Text>
              <StandardBadge level={level as StandardLevel} size="sm" />
            </View>
          ))}
        </View>

        {/* Goals */}
        {goals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GOALS</Text>
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} gender={gender} ageGroup={ageGroup} />
            ))}
          </View>
        )}

        {/* Standards Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STANDARDS GRID</Text>

          {/* Column Headers */}
          <View style={styles.gridHeaderRow}>
            <View style={styles.gridEventCol}>
              <Text style={styles.gridHeaderText}>EVENT</Text>
            </View>
            <View style={styles.gridPrCol}>
              <Text style={styles.gridHeaderText}>PR</Text>
            </View>
            {STANDARD_LEVELS.map((level) => (
              <View key={level} style={styles.gridStdCol}>
                <Text
                  style={[styles.gridHeaderText, { color: standardColors[level as StandardLevel] }]}
                >
                  {level}
                </Text>
              </View>
            ))}
          </View>

          {/* Event Rows */}
          {events.map((event) => {
            const standards = getEventStandards(course, gender, ageGroup, event);
            const pr = prMap[event];
            const achieved = pr ? getAchievedStandard(course, gender, ageGroup, event, pr) : null;

            return (
              <View key={event} style={styles.gridRow}>
                <View style={styles.gridEventCol}>
                  <Text style={styles.gridEventText}>{event}</Text>
                </View>
                <View style={styles.gridPrCol}>
                  <Text style={styles.gridPrText}>{pr ? formatTime(pr) : '—'}</Text>
                </View>
                {STANDARD_LEVELS.map((level) => {
                  const stdTime = standards?.[level as StandardLevel];
                  const isAchieved =
                    achieved && STANDARD_LEVELS.indexOf(achieved) >= STANDARD_LEVELS.indexOf(level);

                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.gridStdCol,
                        isAchieved && {
                          backgroundColor: standardBgColors[level as StandardLevel],
                          borderColor: standardBorderColors[level as StandardLevel],
                          borderWidth: 1,
                          borderRadius: borderRadius.xs,
                        },
                      ]}
                      onLongPress={() => handleSetGoal(event, level as StandardLevel)}
                    >
                      <Text
                        style={[
                          styles.gridStdText,
                          isAchieved && { color: standardColors[level as StandardLevel] },
                        ]}
                      >
                        {stdTime ? formatTime(stdTime) : '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>

        <Text style={styles.hint}>Long-press a standard to set it as a goal</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  // Header
  header: { marginBottom: spacing.lg },
  name: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 2,
  },
  info: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.sm, color: colors.textSecondary },
  // Course
  courseRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  courseChip: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  courseChipActive: { backgroundColor: colors.purple, borderColor: colors.purpleLight },
  courseChipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  courseChipTextActive: { color: colors.text },
  // Summary
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryNum: { fontFamily: fontFamily.stat, fontSize: fontSize.xxl, marginBottom: 4 },
  // Section
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  // Grid
  gridHeaderRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  gridEventCol: { width: 80 },
  gridPrCol: { width: 60, alignItems: 'center' },
  gridStdCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  gridHeaderText: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  gridEventText: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.xs, color: colors.text },
  gridPrText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.accent },
  gridStdText: { fontFamily: fontFamily.statMono, fontSize: 8, color: colors.textSecondary },
  // Hint
  hint: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});

export default withScreenErrorBoundary(StandardsScreen, 'StandardsScreen');
