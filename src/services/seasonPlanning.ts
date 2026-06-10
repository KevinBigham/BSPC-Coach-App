// Data layer migrated Firestore -> Supabase (UNIFY/01:season_plans +
// season_plan_weeks, Phase H), landed UNDER the §5.1 data-layer pins (04's
// tests-FIRST mandate). Same behavioral contract: plans stay staff-shared
// (that IS today's wall); weeks live in a real table with
// UNIQUE(season_plan_id, week_number) — a duplicate number Firestore
// silently allowed now fails loudly (RH-10, strictly better); the id-based
// upsertWeekPlan flow is preserved 1:1; weeks carry NO timestamps (the
// app's no-stamp behavior, now canonical). deleteSeasonPlan's client-side
// weeks loop collapses to ONE delete — the DB CASCADE owns the children.
// The coachName denorm is gone — derived on read through the profiles embed.
import { supabase } from '../config/supabase';
import type { SeasonPlan, WeekPlan } from '../types/firestore.types';

type SeasonPlanWithId = SeasonPlan & { id: string };
type WeekPlanWithId = WeekPlan & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface SeasonPlanRow {
  id: string;
  name: string;
  practice_group: SeasonPlan['group'];
  start_date: string;
  end_date: string;
  phases: SeasonPlan['phases'] | null;
  total_weeks: number | null;
  coach_id: string;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
}

interface WeekRow {
  id: string;
  season_plan_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  phase: WeekPlan['phase'];
  target_yardage: number | null;
  actual_yardage: number | null;
  practice_count: number;
  notes: string | null;
  practice_plan_ids: string[] | null;
}

const SEASON_SELECT =
  'id, name, practice_group, start_date, end_date, phases, total_weeks, coach_id, ' +
  'created_at, updated_at, coach:profiles(full_name)';

const WEEK_SELECT =
  'id, season_plan_id, week_number, start_date, end_date, phase, target_yardage, ' +
  'actual_yardage, practice_count, notes, practice_plan_ids';

function rowToSeasonPlan(row: SeasonPlanRow): SeasonPlanWithId {
  return {
    id: row.id,
    name: row.name,
    group: row.practice_group,
    startDate: row.start_date,
    endDate: row.end_date,
    phases: row.phases ?? [],
    totalWeeks: row.total_weeks ?? 0,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToWeek(row: WeekRow): WeekPlanWithId {
  return {
    id: row.id,
    weekNumber: row.week_number,
    startDate: row.start_date,
    endDate: row.end_date,
    phase: row.phase,
    targetYardage: row.target_yardage ?? 0,
    actualYardage: row.actual_yardage ?? undefined,
    practiceCount: row.practice_count,
    notes: row.notes ?? undefined,
    practicePlanIds: row.practice_plan_ids ?? [],
  };
}

function weekToColumns(week: Omit<WeekPlan, 'id'>): Record<string, unknown> {
  return {
    week_number: week.weekNumber,
    start_date: week.startDate,
    end_date: week.endDate,
    phase: week.phase,
    target_yardage: week.targetYardage ?? null,
    actual_yardage: week.actualYardage ?? null,
    practice_count: week.practiceCount,
    notes: week.notes ?? null,
    practice_plan_ids: week.practicePlanIds ?? [],
    // weeks carry NO timestamps — the app's no-stamp behavior, preserved
  };
}

let channelSeq = 0;

export function subscribeSeasonPlans(
  coachId: string,
  callback: (plans: SeasonPlanWithId[]) => void,
): Unsubscribe {
  let live = true;

  // RH-2: the coachId scope stays a real query param (the UI scopes to own;
  // the staff-shared wall does not — exactly today's split).
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('season_plans')
      .select(SEASON_SELECT)
      .eq('coach_id', coachId)
      .order('start_date', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as SeasonPlanRow[]).map(rowToSeasonPlan));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`season_plans:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'season_plans', filter: `coach_id=eq.${coachId}` },
      () => {
        void emit();
      },
    )
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export async function createSeasonPlan(
  plan: Omit<SeasonPlan, 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { data, error } = await supabase
    .from('season_plans')
    .insert({
      name: plan.name,
      practice_group: plan.group,
      start_date: plan.startDate,
      end_date: plan.endDate,
      phases: plan.phases ?? [],
      total_weeks: plan.totalWeeks ?? null,
      coach_id: plan.coachId, // verbatim from the frozen payload (D-B7/G idiom)
      // coachName denorm dropped (derived on read); timestamps are DB-owned
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateSeasonPlan(
  planId: string,
  updates: Partial<Omit<SeasonPlan, 'createdAt'>>,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.group !== undefined) patch.practice_group = updates.group;
  if (updates.startDate !== undefined) patch.start_date = updates.startDate;
  if (updates.endDate !== undefined) patch.end_date = updates.endDate;
  if (updates.phases !== undefined) patch.phases = updates.phases;
  if (updates.totalWeeks !== undefined) patch.total_weeks = updates.totalWeeks;
  if (updates.coachId !== undefined) patch.coach_id = updates.coachId;
  // updated_at is trigger-owned now (the explicit stamp drops)

  const { error } = await supabase.from('season_plans').update(patch).eq('id', planId);
  if (error) throw error;
}

export async function deleteSeasonPlan(planId: string): Promise<void> {
  // RH-10: ONE delete — the DB CASCADE takes every week with it (the
  // client-side weeks loop retires; pgTAP 012 proves the cascade).
  const { error } = await supabase.from('season_plans').delete().eq('id', planId);
  if (error) throw error;
}

export function subscribeWeekPlans(
  planId: string,
  callback: (weeks: WeekPlanWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('season_plan_weeks')
      .select(WEEK_SELECT)
      .eq('season_plan_id', planId)
      .order('week_number', { ascending: true });
    if (!live || error || !data) return;
    callback((data as unknown as WeekRow[]).map(rowToWeek));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`season_plan_weeks:${planId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'season_plan_weeks',
        filter: `season_plan_id=eq.${planId}`,
      },
      () => {
        void emit();
      },
    )
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export async function upsertWeekPlan(planId: string, week: WeekPlan): Promise<string> {
  // ID-BASED, not weekNumber-based — the flow is preserved 1:1. A duplicate
  // week number on the insert path now fails loudly on the UNIQUE key
  // (RH-10, strictly better than Firestore's silent tolerance).
  if (week.id) {
    const { id: weekId, ...data } = week;
    const { error } = await supabase
      .from('season_plan_weeks')
      .update(weekToColumns(data))
      .eq('id', weekId);
    if (error) throw error;
    return weekId;
  }
  const { data, error } = await supabase
    .from('season_plan_weeks')
    .insert({ season_plan_id: planId, ...weekToColumns(week) })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export function calculateSeasonYardage(phases: SeasonPlan['phases']): number {
  return phases.reduce((total, phase) => {
    const startMs = new Date(phase.startDate).getTime();
    const endMs = new Date(phase.endDate).getTime();
    const weeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * 24 * 60 * 60 * 1000)));
    return total + phase.weeklyYardage * weeks;
  }, 0);
}

/** Returns 0-100 % reduction from peak yardage. */
export function calculateTaperProgress(peakYardage: number, currentYardage: number): number {
  if (peakYardage <= 0) return 0;
  const reduction = ((peakYardage - currentYardage) / peakYardage) * 100;
  return Math.round(Math.max(0, Math.min(100, reduction)));
}

export function getCurrentPhase(
  phases: SeasonPlan['phases'],
  date: string = new Date().toISOString().split('T')[0],
): SeasonPlan['phases'][0] | null {
  return phases.find((p) => date >= p.startDate && date <= p.endDate) ?? null;
}

export function generateWeekPlans(phases: SeasonPlan['phases']): Omit<WeekPlan, 'id'>[] {
  const weeks: Omit<WeekPlan, 'id'>[] = [];
  let weekNumber = 1;

  for (const phase of phases) {
    const start = new Date(phase.startDate);
    const end = new Date(phase.endDate);

    const current = new Date(start);
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      weeks.push({
        weekNumber,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        phase: phase.type,
        targetYardage: phase.weeklyYardage,
        practiceCount: 0,
        practicePlanIds: [],
      });

      weekNumber++;
      current.setDate(current.getDate() + 7);
    }
  }

  return weeks;
}
