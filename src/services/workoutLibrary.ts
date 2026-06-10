// Data layer migrated Firestore -> Supabase (UNIFY/01:practice_plans, Phase H).
// The workout library IS practice_plans filtered is_template = TRUE (the dead
// workout_library collection was dropped, SETTLED #5). Same behavioral
// contract under the D-H1 WITHIN-STAFF walls: own-or-public reads, own-only
// writes. RH-2: the coachId filter stays REQUIRED at production call sites —
// RLS is the wall (it would silently scope an unfiltered list to own+public),
// never the caller's scope. D-H6 parity-deny: rating/tagging ANOTHER coach's
// public template stays denied (the wall filters the write to zero rows —
// the feature never functioned; the rate_workout RPC is banked post-cutover).
import { supabase } from '../config/supabase';
import type { PracticePlan } from '../types/firestore.types';
import type { Group } from '../config/constants';

export type WorkoutFocus = 'endurance' | 'speed' | 'technique' | 'recovery' | 'race_prep' | 'mixed';

export const WORKOUT_FOCUSES: { key: WorkoutFocus; label: string }[] = [
  { key: 'endurance', label: 'Endurance' },
  { key: 'speed', label: 'Speed' },
  { key: 'technique', label: 'Technique' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'race_prep', label: 'Race Prep' },
  { key: 'mixed', label: 'Mixed' },
];

export interface WorkoutFilters {
  focus?: WorkoutFocus;
  group?: Group;
  minYardage?: number;
  maxYardage?: number;
  tags?: string[];
  /**
   * Restrict to plans owned by this coach. REQUIRED at production call
   * sites — the D-H1 RLS wall (own OR is_public) would otherwise silently
   * widen the list to own+public rather than rejecting (RH-2: PG filters
   * where Firestore rejected). For public discovery, use
   * subscribePublicWorkouts instead.
   */
  coachId?: string;
}

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

type WorkoutWithId = PracticePlan & { id: string };

interface WorkoutRow {
  id: string;
  title: string;
  description: string | null;
  practice_group: PracticePlan['group'] | null;
  is_template: boolean;
  is_public: boolean;
  template_source_id: string | null;
  plan_date: string | null;
  total_duration_min: number | null;
  tags: string[] | null;
  ratings: Record<string, number> | null;
  sets: PracticePlan['sets'] | null;
  coach_id: string;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
}

const WORKOUT_SELECT =
  'id, title, description, practice_group, is_template, is_public, template_source_id, ' +
  'plan_date, total_duration_min, tags, ratings, sets, coach_id, created_at, updated_at, ' +
  'coach:profiles(full_name)';

function rowToWorkout(row: WorkoutRow): WorkoutWithId {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    group: row.practice_group ?? undefined,
    isTemplate: row.is_template,
    public: row.is_public,
    templateSourceId: row.template_source_id ?? undefined,
    date: row.plan_date ?? undefined,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    totalDuration: row.total_duration_min ?? 0,
    tags: row.tags ?? [],
    ratings: row.ratings ?? {},
    sets: row.sets ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

let channelSeq = 0;

function subscribeWorkoutQuery(
  channelKey: string,
  buildQuery: () => PromiseLike<{ data: unknown; error: unknown }>,
  filters: WorkoutFilters,
  callback: (workouts: WorkoutWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await buildQuery();
    if (!live || error || !data) return;

    let workouts = (data as WorkoutRow[]).map(rowToWorkout);

    // Yardage is a computed field so it cannot be filtered server-side.
    if (filters.minYardage) {
      const min = filters.minYardage;
      workouts = workouts.filter((w) => calculateYardage(w) >= min);
    }
    if (filters.maxYardage) {
      const max = filters.maxYardage;
      workouts = workouts.filter((w) => calculateYardage(w) <= max);
    }

    callback(workouts);
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`practice_plans:${channelKey}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_plans' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export function subscribeWorkouts(
  filters: WorkoutFilters,
  callback: (workouts: WorkoutWithId[]) => void,
): Unsubscribe {
  return subscribeWorkoutQuery(
    'workouts',
    () => {
      let q = supabase.from('practice_plans').select(WORKOUT_SELECT).eq('is_template', true);
      if (filters.coachId) {
        q = q.eq('coach_id', filters.coachId);
      }
      if (filters.group) {
        q = q.eq('practice_group', filters.group);
      }
      return q.order('created_at', { ascending: false });
    },
    filters,
    callback,
  );
}

export function subscribePublicWorkouts(
  callback: (workouts: WorkoutWithId[]) => void,
  filters: WorkoutFilters = {},
): Unsubscribe {
  return subscribeWorkoutQuery(
    'public',
    () => {
      let q = supabase
        .from('practice_plans')
        .select(WORKOUT_SELECT)
        .eq('is_template', true)
        .eq('is_public', true);
      if (filters.group) {
        q = q.eq('practice_group', filters.group);
      }
      if (filters.tags && filters.tags.length > 0) {
        // array-contains-any ≡ array overlap
        q = q.overlaps('tags', filters.tags);
      }
      return q.order('updated_at', { ascending: false });
    },
    filters,
    callback,
  );
}

export async function setPlanPublicStatus(planId: string, isPublic: boolean): Promise<void> {
  // The D-H1 wall enforces owner-only writes for this field; updated_at is
  // trigger-owned now (today's explicit stamp drops, same observable bump).
  const { error } = await supabase
    .from('practice_plans')
    .update({ is_public: isPublic })
    .eq('id', planId);
  if (error) throw error;
}

export async function tagWorkout(workoutId: string, tags: string[]): Promise<void> {
  // Named FYI delta: today's code writes no updatedAt here, but the DB
  // trigger bumps it — a tag edit can reorder subscribePublicWorkouts
  // (updated_at desc). Immaterial and faithful-to-canonical.
  const { error } = await supabase.from('practice_plans').update({ tags }).eq('id', workoutId);
  if (error) throw error;
}

/** Rating is 1-5 stars, stored in a coachId-keyed map so each coach has one vote. */
export async function rateWorkout(
  workoutId: string,
  rating: number,
  coachId: string,
): Promise<void> {
  // Ratings keys stay coach.uid until cutover (the B created_by precedent;
  // backfill remaps). Cross-coach rating stays DENIED (D-H6 parity-deny: the
  // wall lets another coach SEE a public template but the UPDATE touches
  // zero rows — the feature never functioned).
  const { data, error } = await supabase
    .from('practice_plans')
    .select('ratings')
    .eq('id', workoutId)
    .single();
  if (error) throw error;

  const ratings = {
    ...(((data as { ratings: Record<string, number> | null }).ratings ?? {}) as Record<
      string,
      number
    >),
    [coachId]: rating,
  };

  const { error: updateError } = await supabase
    .from('practice_plans')
    .update({ ratings })
    .eq('id', workoutId);
  if (updateError) throw updateError;
}

/**
 * Fetches templates then filters client-side — frozen fetch-then-filter
 * semantics (the searchNotes precedent). Pass `coachId` to scope to the
 * caller's own templates (REQUIRED in production — see WorkoutFilters).
 */
export async function searchWorkouts(
  searchText: string,
  coachId?: string,
): Promise<WorkoutWithId[]> {
  let q = supabase.from('practice_plans').select(WORKOUT_SELECT).eq('is_template', true);
  if (coachId) {
    q = q.eq('coach_id', coachId);
  }
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;

  const lower = searchText.toLowerCase();
  return ((data ?? []) as unknown as WorkoutRow[])
    .map(rowToWorkout)
    .filter(
      (w) =>
        w.title.toLowerCase().includes(lower) ||
        (w.description && w.description.toLowerCase().includes(lower)),
    );
}

function calculateYardage(plan: PracticePlan): number {
  let total = 0;
  for (const set of plan.sets) {
    for (const item of set.items) {
      total += item.reps * item.distance;
    }
  }
  return total;
}
