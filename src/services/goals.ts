import { supabase } from '../config/supabase';
import { formatTimeDisplay } from '../utils/time';
import type { SwimmerGoal } from '../types/firestore.types';

type GoalWithId = SwimmerGoal & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface GoalRow {
  id: string;
  swimmer_id: string;
  event_name: string;
  course: SwimmerGoal['course'] | null;
  target_standard: SwimmerGoal['targetStandard'] | null;
  target_time_hundredths: number | null;
  current_time_hundredths: number | null;
  notes: string | null;
  achieved: boolean;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

const GOAL_SELECT =
  'id, swimmer_id, event_name, course, target_standard, target_time_hundredths, current_time_hundredths, notes, achieved, achieved_at, created_at, updated_at';

// Display strings are normalized out of the canonical schema; recompute them on
// read from the stored hundredths (never persisted) per the migration playbook.
function rowToGoal(row: GoalRow): GoalWithId {
  return {
    id: row.id,
    event: row.event_name,
    course: row.course as SwimmerGoal['course'],
    targetStandard: row.target_standard ?? undefined,
    targetTime: row.target_time_hundredths ?? undefined,
    targetTimeDisplay:
      row.target_time_hundredths != null
        ? formatTimeDisplay(row.target_time_hundredths)
        : undefined,
    currentTime: row.current_time_hundredths ?? undefined,
    currentTimeDisplay:
      row.current_time_hundredths != null
        ? formatTimeDisplay(row.current_time_hundredths)
        : undefined,
    notes: row.notes ?? undefined,
    achieved: row.achieved,
    achievedAt: row.achieved_at ? new Date(row.achieved_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

let channelSeq = 0;

export function subscribeGoals(
  swimmerId: string,
  callback: (goals: GoalWithId[]) => void,
): Unsubscribe {
  let active = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('goals')
      .select(GOAL_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false });
    if (!active || error || !data) return;
    callback((data as unknown as GoalRow[]).map(rowToGoal));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`goals:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'goals', filter: `swimmer_id=eq.${swimmerId}` },
      () => {
        void emit();
      },
    )
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function setGoal(
  swimmerId: string,
  data: Omit<SwimmerGoal, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('goals')
    .insert({
      swimmer_id: swimmerId,
      event_name: data.event,
      course: data.course,
      target_standard: data.targetStandard ?? null,
      target_time_hundredths: data.targetTime ?? null,
      current_time_hundredths: data.currentTime ?? null,
      notes: data.notes ?? null,
      achieved: data.achieved ?? false,
      achieved_at: data.achievedAt ? new Date(data.achievedAt).toISOString() : null,
      // created_at / updated_at owned by the DB (column default + update trigger)
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function updateGoal(
  swimmerId: string,
  goalId: string,
  data: Partial<SwimmerGoal>,
): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  // Map only provided fields; drop derived display strings; updated_at is
  // owned by the BEFORE UPDATE trigger, so it is never sent.
  const patch: Record<string, unknown> = {};
  if ('event' in data) patch.event_name = data.event;
  if ('course' in data) patch.course = data.course;
  if ('targetStandard' in data) patch.target_standard = data.targetStandard ?? null;
  if ('targetTime' in data) patch.target_time_hundredths = data.targetTime ?? null;
  if ('currentTime' in data) patch.current_time_hundredths = data.currentTime ?? null;
  if ('notes' in data) patch.notes = data.notes ?? null;
  if ('achieved' in data) patch.achieved = data.achieved;
  if ('achievedAt' in data)
    patch.achieved_at = data.achievedAt ? new Date(data.achievedAt).toISOString() : null;

  const { error } = await supabase.from('goals').update(patch).eq('id', goalId);
  if (error) throw error;
}

export async function deleteGoal(swimmerId: string, goalId: string): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  if (error) throw error;
}

export async function markGoalAchieved(swimmerId: string, goalId: string): Promise<void> {
  void swimmerId; // row addressed by PK; param kept for signature compat
  const { error } = await supabase
    .from('goals')
    .update({ achieved: true, achieved_at: new Date().toISOString() })
    .eq('id', goalId);
  if (error) throw error;
}
