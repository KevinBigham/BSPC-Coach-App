import { supabase } from '../config/supabase';
import type { Group } from '../config/constants';

// src/services/staff.ts — NEW service (D-CUT8 surface (a), D-K4 addition class)
export interface StaffProfile {
  profileId: string; // profiles.id
  userId: string; // profiles.user_id (= post-swap Coach.uid)
  email: string; // profiles.email
  displayName: string; // profiles.full_name
  role: 'super_admin' | 'coach_admin'; // PG truth; the screen renders its own labels
  groups: Group[]; // coach_groups.practice_group rows
}

interface StaffProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'coach_admin';
}

interface CoachGroupRow {
  profile_id: string;
  practice_group: Group;
}

const STAFF_SELECT = 'id, user_id, email, full_name, role';

let channelSeq = 0;

/**
 * Live list of staff profiles (super_admin + coach_admin) with their assigned
 * groups. Transport is postgres_changes on profiles + coach_groups (publication
 * grown 23 -> 25 by BSPC 00012); event delivery rides the EXISTING walls
 * (profiles_select_admin, coach_groups_staff). The service does NOT pre-check
 * authority — enforce_profile_self_update is the wall (A-STRICT): a guard
 * rejection surfaces through the normal error path.
 */
export function subscribeStaffProfiles(onChange: (staff: StaffProfile[]) => void): () => void {
  let active = true;

  const emit = async (): Promise<void> => {
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select(STAFF_SELECT)
      .in('role', ['super_admin', 'coach_admin'])
      .order('full_name', { ascending: true });
    if (!active || profilesError || !profileRows) return;

    const { data: groupRows, error: groupsError } = await supabase
      .from('coach_groups')
      .select('profile_id, practice_group');
    if (!active || groupsError) return;

    const groupsByProfile = new Map<string, Group[]>();
    for (const row of (groupRows ?? []) as CoachGroupRow[]) {
      const list = groupsByProfile.get(row.profile_id) ?? [];
      list.push(row.practice_group);
      groupsByProfile.set(row.profile_id, list);
    }

    onChange(
      (profileRows as StaffProfileRow[]).map((row) => ({
        profileId: row.id,
        userId: row.user_id,
        email: row.email,
        displayName: row.full_name,
        role: row.role,
        groups: groupsByProfile.get(row.id) ?? [],
      })),
    );
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`staff:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
      void emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'coach_groups' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}

export async function setStaffRole(
  profileId: string,
  role: 'super_admin' | 'coach_admin',
): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) throw error;
}

/** Delete+insert reconciliation of the profile's coach_groups rows (D-CUT8). */
export async function setStaffGroups(profileId: string, groups: Group[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('coach_groups')
    .delete()
    .eq('profile_id', profileId);
  if (deleteError) throw deleteError;

  if (groups.length === 0) return;

  const { error: insertError } = await supabase
    .from('coach_groups')
    .insert(groups.map((group) => ({ profile_id: profileId, practice_group: group })));
  if (insertError) throw insertError;
}
