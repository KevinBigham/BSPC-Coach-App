import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { subscribePublicWorkouts } from '../../src/services/workoutLibrary';
import { calculateTotalYardage } from '../../src/services/practicePlans';
import type { PracticePlan } from '../../src/types/firestore.types';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

type PublicPlan = PracticePlan & { id: string };

function averageRating(ratings?: Record<string, number>): string {
  const values = Object.values(ratings || {}).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return 'No ratings';
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return `${average.toFixed(1)} avg`;
}

function BrowsePublicWorkoutsScreen() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PublicPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return subscribePublicWorkouts((data) => {
      setPlans(data);
      setLoading(false);
    });
  }, []);

  const handleBack = () => {
    if (selectedPlan) {
      setSelectedPlan(null);
      return;
    }
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ChevronLeft size={20} color={colors.accent} strokeWidth={2} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.pixelLabel}>PUBLIC</Text>
            <Text style={styles.screenTitle}>{selectedPlan ? 'PLAN PREVIEW' : 'PLANS'}</Text>
          </View>
        </View>

        {selectedPlan ? (
          <PlanPreview plan={selectedPlan} />
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <FlatList
            data={plans}
            keyExtractor={(item) => item.id}
            contentContainerStyle={plans.length === 0 ? styles.emptyContent : styles.list}
            renderItem={({ item }) => (
              <PublicPlanCard plan={item} onPress={() => setSelectedPlan(item)} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No public plans yet</Text>
                <Text style={styles.emptyText}>Published templates will appear here.</Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

function PublicPlanCard({ plan, onPress }: { plan: PublicPlan; onPress: () => void }) {
  const yardage = calculateTotalYardage(plan.sets);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{plan.title}</Text>
        {plan.group ? <Text style={styles.groupBadge}>{plan.group}</Text> : null}
      </View>
      {plan.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {plan.description}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{yardage.toLocaleString()} yds</Text>
        <Text style={styles.metaText}>{plan.totalDuration} min</Text>
        <Text style={styles.metaText}>{plan.coachName}</Text>
        <Text style={styles.metaText}>{averageRating(plan.ratings)}</Text>
      </View>
      {plan.tags && plan.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {plan.tags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function PlanPreview({ plan }: { plan: PublicPlan }) {
  const yardage = calculateTotalYardage(plan.sets);

  return (
    <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
      <Text style={styles.previewTitle}>{plan.title}</Text>
      {plan.description ? <Text style={styles.previewDescription}>{plan.description}</Text> : null}
      <View style={styles.previewStats}>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatValue}>{plan.sets.length}</Text>
          <Text style={styles.previewStatLabel}>SETS</Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatValue}>{yardage.toLocaleString()}</Text>
          <Text style={styles.previewStatLabel}>YARDS</Text>
        </View>
        <View style={styles.previewStat}>
          <Text style={styles.previewStatValue}>{plan.totalDuration}</Text>
          <Text style={styles.previewStatLabel}>MIN</Text>
        </View>
      </View>

      {plan.sets.map((set) => (
        <View key={`${set.order}-${set.name}`} style={styles.setCard}>
          <Text style={styles.setTitle}>{set.name}</Text>
          <Text style={styles.setCategory}>{set.category}</Text>
          {set.description ? <Text style={styles.setDescription}>{set.description}</Text> : null}
          {set.items.map((item) => (
            <View key={`${item.order}-${item.stroke}-${item.distance}`} style={styles.itemRow}>
              <Text style={styles.itemMain}>
                {item.reps} x {item.distance} {item.stroke}
              </Text>
              {item.interval ? <Text style={styles.itemInterval}>@ {item.interval}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  backText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  pixelLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
  },
  screenTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: 1,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyState: { alignItems: 'center' },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  groupBadge: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cardDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaText: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  tagChip: {
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  tagText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  previewScroll: { flex: 1 },
  previewContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  previewTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xxxl,
    color: colors.text,
    letterSpacing: 1,
  },
  previewDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  previewStats: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.lg },
  previewStat: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  previewStatValue: {
    fontFamily: fontFamily.stat,
    fontSize: fontSize.xl,
    color: colors.accent,
  },
  previewStatLabel: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    letterSpacing: 1,
  },
  setCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  setTitle: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  setCategory: {
    fontFamily: fontFamily.pixel,
    fontSize: fontSize.pixel,
    color: colors.gold,
    marginTop: 2,
  },
  setDescription: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  itemMain: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.md,
    color: colors.text,
  },
  itemInterval: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.sm,
    color: colors.accent,
    marginTop: 2,
  },
});

export default withScreenErrorBoundary(BrowsePublicWorkoutsScreen, 'BrowsePublicWorkoutsScreen');
