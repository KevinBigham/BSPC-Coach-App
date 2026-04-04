import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Plus, Calendar, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSeasonStore } from '../../src/stores/seasonStore';
import { SeasonTimeline } from '../../src/components/SeasonTimeline';
import { getCurrentPhase } from '../../src/services/seasonPlanning';
import { SkeletonList } from '../../src/components/Skeleton';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';

const PHASE_LABELS: Record<string, string> = {
  base: 'Base Training',
  build1: 'Build Phase I',
  build2: 'Build Phase II',
  peak: 'Peak Training',
  taper: 'Taper',
  race: 'Championship',
  recovery: 'Recovery',
};

export default function SeasonIndexScreen() {
  const { user } = useAuth();
  const { plans, loading, subscribePlans, setActivePlan } = useSeasonStore();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;
    const unsub = subscribePlans(user.uid);
    return unsub;
  }, [user]);

  const handlePlanPress = (plan: (typeof plans)[0]) => {
    setActivePlan(plan);
    router.push('/season/plan');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonList count={3} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {plans.length === 0 ? (
          <View style={styles.empty}>
            <Calendar size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Season Plans</Text>
            <Text style={styles.emptyText}>
              Create a periodized season plan to structure training phases and track yardage
              progression.
            </Text>
          </View>
        ) : (
          plans.map((plan) => {
            const currentPhase = getCurrentPhase(plan.phases, today);
            return (
              <TouchableOpacity
                key={plan.id}
                style={styles.card}
                onPress={() => handlePlanPress(plan)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planGroup}>{plan.group}</Text>
                </View>
                <Text style={styles.planDates}>
                  {plan.startDate} to {plan.endDate}
                </Text>
                {currentPhase && (
                  <View style={styles.currentPhase}>
                    <TrendingUp size={14} color={colors.accent} />
                    <Text style={styles.currentPhaseText}>
                      Current: {PHASE_LABELS[currentPhase.type] || currentPhase.name}
                    </Text>
                  </View>
                )}
                <SeasonTimeline phases={plan.phases} currentDate={today} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/season/plan')}>
        <Plus size={24} color={colors.bgBase} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    color: colors.text,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  planGroup: {
    fontFamily: fontFamily.headingMd,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  planDates: {
    fontFamily: fontFamily.statMono,
    fontSize: 12,
    color: colors.textSecondary,
  },
  currentPhase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPhaseText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
