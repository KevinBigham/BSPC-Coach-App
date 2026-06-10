import { supabase } from '../config/supabase';
import type { NotificationRule } from '../types/firestore.types';
import {
  evaluateAttendanceStreakCount,
  evaluateMissedPractice,
  ruleAppliesToSwimmer,
} from '../utils/notificationRules/evaluation';

type NotificationRuleWithId = NotificationRule & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

export { evaluateAttendanceStreakCount, evaluateMissedPractice, ruleAppliesToSwimmer };

interface NotificationRuleRow {
  id: string;
  name: string;
  trigger: NotificationRule['trigger'];
  enabled: boolean;
  config: NotificationRule['config'] | null;
  coach_id: string;
  created_at: string;
  updated_at: string;
}

const RULE_SELECT = 'id, name, trigger, enabled, config, coach_id, created_at, updated_at';

function rowToRule(row: NotificationRuleRow): NotificationRuleWithId {
  return {
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    enabled: row.enabled,
    config: row.config ?? {},
    coachId: row.coach_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  } as NotificationRuleWithId;
}

let channelSeq = 0;

export function subscribeNotificationRules(
  coachId: string,
  callback: (rules: NotificationRuleWithId[]) => void,
): Unsubscribe {
  let active = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('notification_rules')
      .select(RULE_SELECT)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });
    if (!active || error || !data) return;
    callback((data as unknown as NotificationRuleRow[]).map(rowToRule));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`notification_rules:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notification_rules',
        filter: `coach_id=eq.${coachId}`,
      },
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

export async function createNotificationRule(
  rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('notification_rules')
    .insert({
      name: rule.name,
      trigger: rule.trigger,
      enabled: rule.enabled,
      config: rule.config ?? {},
      coach_id: rule.coachId,
      // created_at / updated_at owned by the DB (column default + update trigger)
    })
    .select('id')
    .single();
  if (error) throw error;
  return (row as { id: string }).id;
}

export async function updateNotificationRule(
  ruleId: string,
  updates: Partial<NotificationRule>,
): Promise<void> {
  // Map only provided fields; updated_at is owned by the BEFORE UPDATE
  // trigger, so it is never sent.
  const patch: Record<string, unknown> = {};
  if ('name' in updates) patch.name = updates.name;
  if ('trigger' in updates) patch.trigger = updates.trigger;
  if ('enabled' in updates) patch.enabled = updates.enabled;
  if ('config' in updates) patch.config = updates.config ?? {};

  const { error } = await supabase.from('notification_rules').update(patch).eq('id', ruleId);
  if (error) throw error;
}

export async function deleteNotificationRule(ruleId: string): Promise<void> {
  const { error } = await supabase.from('notification_rules').delete().eq('id', ruleId);
  if (error) throw error;
}
