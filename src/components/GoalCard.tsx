import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../config/theme';
import { standardColors, standardBgColors, standardBorderColors } from '../config/standardColors';
import { formatTime, getStandard, getAchievedStandard, getTimeToCut } from '../data/timeStandards';
import StandardBadge from './StandardBadge';
import type { SwimmerGoal, StandardLevel } from '../types/firestore.types';
import type { Course } from '../config/constants';

interface GoalCardProps {
  goal: SwimmerGoal & { id: string };
  gender: 'M' | 'F';
  ageGroup: '10&U' | '11-12' | '13-14' | '15-16' | '17-18';
  onPress?: () => void;
}

export default function GoalCard({ goal, gender, ageGroup, onPress }: GoalCardProps) {
  const targetTime = goal.targetTime || (goal.targetStandard
    ? getStandard(goal.course, gender, ageGroup, goal.event, goal.targetStandard)
    : null);

  const currentTime = goal.currentTime;
  const timeToCut = targetTime && currentTime ? currentTime - targetTime : null;
  const progress = targetTime && currentTime
    ? Math.min(1, Math.max(0, 1 - (timeToCut! / currentTime)))
    : 0;

  const currentStandard = currentTime
    ? getAchievedStandard(goal.course, gender, ageGroup, goal.event, currentTime)
    : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.event}>{goal.event}</Text>
          <Text style={styles.course}>{goal.course}</Text>
        </View>
        {goal.achieved && (
          <View style={styles.achievedBadge}>
            <Text style={styles.achievedText}>ACHIEVED</Text>
          </View>
        )}
        {currentStandard && <StandardBadge level={currentStandard} />}
      </View>

      <View style={styles.timesRow}>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>CURRENT</Text>
          <Text style={styles.timeValue}>
            {currentTime ? formatTime(currentTime) : '—'}
          </Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>
            {goal.targetStandard ? `TARGET (${goal.targetStandard})` : 'TARGET'}
          </Text>
          <Text style={[styles.timeValue, styles.targetTime]}>
            {targetTime ? formatTime(targetTime) : goal.targetTimeDisplay || '—'}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      {targetTime && currentTime && !goal.achieved && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {timeToCut && timeToCut > 0
              ? `${formatTime(timeToCut)} to cut`
              : 'Target achieved!'}
          </Text>
        </View>
      )}

      {goal.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{goal.notes}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgDeep,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  event: { fontFamily: fontFamily.bodySemi, fontSize: fontSize.md, color: colors.text },
  course: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1 },
  achievedBadge: {
    backgroundColor: 'rgba(204, 176, 0, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  achievedText: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.gold, letterSpacing: 1 },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  timeCol: { alignItems: 'center' },
  timeLabel: { fontFamily: fontFamily.pixel, fontSize: fontSize.pixel, color: colors.textSecondary, letterSpacing: 1, marginBottom: 4 },
  timeValue: { fontFamily: fontFamily.stat, fontSize: fontSize.xl, color: colors.text },
  targetTime: { color: colors.gold },
  arrow: { fontFamily: fontFamily.heading, fontSize: fontSize.xxl, color: colors.textSecondary },
  progressContainer: { marginBottom: spacing.xs },
  progressTrack: {
    height: 6,
    backgroundColor: colors.purple,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  progressText: { fontFamily: fontFamily.statMono, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  notes: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
});
