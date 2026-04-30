import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  subscribeWorkouts,
  searchWorkouts,
  type WorkoutFilters,
} from '../../src/services/workoutLibrary';
import { calculateTotalYardage } from '../../src/services/practicePlans';
import { usePracticeStore } from '../../src/stores/practiceStore';
import { useAuth } from '../../src/contexts/AuthContext';
import type { PracticePlan } from '../../src/types/firestore.types';
import { colors, spacing, fontSize, borderRadius, fontFamily } from '../../src/config/theme';
import { GROUPS, type Group } from '../../src/config/constants';
import { withScreenErrorBoundary } from '../../src/components/ScreenErrorBoundary';

function WorkoutLibraryScreen() {
  const { coach } = useAuth();
  const coachId = coach?.uid;
  const [workouts, setWorkouts] = useState<(PracticePlan & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterGroup, setFilterGroup] = useState<Group | undefined>(undefined);
  const store = usePracticeStore();

  useEffect(() => {
    if (!coachId) {
      setWorkouts([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const filters: WorkoutFilters = { coachId };
    if (filterGroup) filters.group = filterGroup;

    const unsub = subscribeWorkouts(filters, (data) => {
      setWorkouts(data);
      setLoading(false);
    });
    return unsub;
  }, [filterGroup, coachId]);

  const handleSearch = async () => {
    if (!searchText.trim() || !coachId) return;
    setLoading(true);
    const results = await searchWorkouts(searchText.trim(), coachId);
    setWorkouts(results);
    setLoading(false);
  };

  const handleUseTemplate = (workout: PracticePlan & { id: string }) => {
    store.loadPlan(workout);
    router.push('/practice/builder');
  };

  const filtered = searchText
    ? workouts.filter(
        (w) =>
          w.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (w.description && w.description.toLowerCase().includes(searchText.toLowerCase())),
      )
    : workouts;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'WORKOUT LIBRARY',
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 22, color: colors.text },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Search */}
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          placeholder="Search workouts..."
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
        />

        {/* Group Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, !filterGroup && styles.chipActive]}
            onPress={() => setFilterGroup(undefined)}
          >
            <Text style={[styles.chipText, !filterGroup && styles.chipTextActive]}>ALL</Text>
          </TouchableOpacity>
          {GROUPS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, filterGroup === g && styles.chipActive]}
              onPress={() => setFilterGroup(g)}
            >
              <Text style={[styles.chipText, filterGroup === g && styles.chipTextActive]}>
                {g.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results */}
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>TEMPLATES ({filtered.length})</Text>
            {filtered.map((workout) => {
              const yardage = calculateTotalYardage(workout.sets);
              return (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.workoutCard}
                  onPress={() => handleUseTemplate(workout)}
                >
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutTitle}>{workout.title}</Text>
                    {workout.group && <Text style={styles.workoutGroup}>{workout.group}</Text>}
                  </View>
                  {workout.description && (
                    <Text style={styles.workoutDesc} numberOfLines={2}>
                      {workout.description}
                    </Text>
                  )}
                  <View style={styles.workoutMeta}>
                    <Text style={styles.metaStat}>{yardage.toLocaleString()} yds</Text>
                    <Text style={styles.metaDot}>{'\u00B7'}</Text>
                    <Text style={styles.metaStat}>{workout.sets.length} sets</Text>
                    <Text style={styles.metaDot}>{'\u00B7'}</Text>
                    <Text style={styles.metaStat}>by {workout.coachName}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {filtered.length === 0 && <Text style={styles.emptyText}>No workouts found</Text>}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: 40 },
  searchInput: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  filterRow: { marginBottom: spacing.xl, flexGrow: 0 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
  },
  chipText: {
    fontFamily: fontFamily.bodySemi,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  chipTextActive: { color: colors.accent },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  workoutCard: {
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  workoutTitle: {
    fontFamily: fontFamily.heading,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.text,
    flex: 1,
  },
  workoutGroup: {
    fontFamily: fontFamily.pixel,
    fontSize: 7,
    letterSpacing: 1,
    color: colors.gold,
  },
  workoutDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaStat: {
    fontFamily: fontFamily.statMono,
    fontSize: fontSize.xs,
    color: colors.accent,
  },
  metaDot: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.xxl,
  },
});

export default withScreenErrorBoundary(WorkoutLibraryScreen, 'WorkoutLibraryScreen');
