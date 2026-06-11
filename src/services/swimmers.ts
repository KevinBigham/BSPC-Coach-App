import { supabase } from '../config/supabase';
import type { Swimmer } from '../types/firestore.types';

type SwimmerWithId = Swimmer & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface SwimmerCoachProfileRow {
  strengths: string[];
  weaknesses: string[];
  technique_focus_areas: string[];
  meet_schedule: string[];
  parent_contacts: Swimmer['parentContacts'];
}

interface SwimmerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  practice_group: string;
  date_of_birth: string | null;
  gender: string | null;
  usa_swimming_id: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
  do_not_photograph: boolean;
  media_consent_granted: boolean;
  media_consent_at: string | null;
  media_consent_expires_at: string | null;
  media_consent_granted_by_name: string | null;
  media_consent_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  coach_profile: SwimmerCoachProfileRow | null;
  goals: { event_name: string }[] | null;
}

// Coach-eyes fields are normalized out of swimmers into the staff-only
// swimmer_coach_profile table; the legacy denormalized goals strings are
// derived on read from the canonical goals table (event_name), never written.
const SWIMMER_SELECT =
  'id, first_name, last_name, display_name, practice_group, date_of_birth, gender, ' +
  'usa_swimming_id, profile_photo_url, is_active, do_not_photograph, ' +
  'media_consent_granted, media_consent_at, media_consent_expires_at, ' +
  'media_consent_granted_by_name, media_consent_notes, created_by, created_at, updated_at, ' +
  'coach_profile:swimmer_coach_profile(strengths, weaknesses, technique_focus_areas, meet_schedule, parent_contacts), ' +
  'goals(event_name)';

function rowToSwimmer(row: SwimmerRow): SwimmerWithId {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name ?? '',
    displayName: row.display_name ?? `${row.first_name} ${row.last_name ?? ''}`.trim(),
    dateOfBirth: (row.date_of_birth
      ? new Date(row.date_of_birth)
      : null) as unknown as Swimmer['dateOfBirth'],
    gender: (row.gender ?? '') as Swimmer['gender'],
    group: row.practice_group as Swimmer['group'],
    active: row.is_active,
    usaSwimmingId: row.usa_swimming_id ?? undefined,
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    strengths: row.coach_profile?.strengths ?? [],
    weaknesses: row.coach_profile?.weaknesses ?? [],
    techniqueFocusAreas: row.coach_profile?.technique_focus_areas ?? [],
    goals: (row.goals ?? []).map((g) => g.event_name),
    parentContacts: row.coach_profile?.parent_contacts ?? [],
    meetSchedule: row.coach_profile?.meet_schedule ?? [],
    mediaConsent:
      row.media_consent_at != null
        ? {
            granted: row.media_consent_granted,
            date: new Date(row.media_consent_at),
            expiresAt: row.media_consent_expires_at
              ? new Date(row.media_consent_expires_at)
              : undefined,
            grantedBy: row.media_consent_granted_by_name ?? undefined,
            notes: row.media_consent_notes ?? undefined,
          }
        : undefined,
    doNotPhotograph: row.do_not_photograph,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by ?? '',
  };
}

function toIsoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

let channelSeq = 0;

export function subscribeSwimmers(
  active: boolean,
  callback: (swimmers: SwimmerWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('swimmers')
      .select(SWIMMER_SELECT)
      .eq('is_active', active)
      .order('last_name');
    if (!live || error || !data) return;
    callback((data as unknown as SwimmerRow[]).map(rowToSwimmer));
  };

  void emit(); // immediate first fire, like onSnapshot

  // Coach-eyes edits land on swimmer_coach_profile, which used to be part of
  // the same Firestore doc — watch both tables so the roster re-emits either way.
  const channel = supabase
    .channel(`swimmers:${active}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'swimmers' }, () => {
      void emit();
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'swimmer_coach_profile' },
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

// Phase K (D-K4 addition #1): the single-swimmer subscription the profile/
// edit/standards/invite-parent doc-reads re-point onto. A narrower projection
// of the same rows subscribeSwimmers already reads — active OR inactive (the
// store holds active rows only, and inactive swimmers are reachable from the
// roster toggle). Missing row emits null, like snap.exists() === false.
export function subscribeSwimmer(
  id: string,
  callback: (swimmer: SwimmerWithId | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('swimmers')
      .select(SWIMMER_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (!live) return;
    if (error || !data) {
      callback(null);
      return;
    }
    callback(rowToSwimmer(data as unknown as SwimmerRow));
  };

  void emit(); // immediate first fire, like onSnapshot

  // Same watch-set as the list subscription (the coach-eyes companion used to
  // be part of the same Firestore doc), narrowed to this row.
  const channel = supabase
    .channel(`swimmers:one:${id}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'swimmers', filter: `id=eq.${id}` },
      () => {
        void emit();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'swimmer_coach_profile',
        filter: `swimmer_id=eq.${id}`,
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

export async function addSwimmer(
  data: Omit<Swimmer, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  coachUid: string,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('swimmers')
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      display_name: data.displayName,
      practice_group: data.group,
      date_of_birth: toIsoDateOrNull(data.dateOfBirth),
      gender: data.gender ?? null,
      usa_swimming_id: data.usaSwimmingId ?? null,
      profile_photo_url: data.profilePhotoUrl ?? null,
      is_active: data.active,
      do_not_photograph: data.doNotPhotograph ?? false,
      media_consent_granted: data.mediaConsent?.granted ?? false,
      media_consent_at: data.mediaConsent ? new Date(data.mediaConsent.date).toISOString() : null,
      media_consent_expires_at: data.mediaConsent?.expiresAt
        ? new Date(data.mediaConsent.expiresAt).toISOString()
        : null,
      media_consent_granted_by_name: data.mediaConsent?.grantedBy ?? null,
      media_consent_notes: data.mediaConsent?.notes ?? null,
      created_by: coachUid,
      // created_at / updated_at owned by the DB (column default + update trigger)
    })
    .select('id')
    .single();
  if (error) throw error;
  const id = (row as { id: string }).id;

  const { error: scpError } = await supabase.from('swimmer_coach_profile').insert({
    swimmer_id: id,
    strengths: data.strengths ?? [],
    weaknesses: data.weaknesses ?? [],
    technique_focus_areas: data.techniqueFocusAreas ?? [],
    meet_schedule: data.meetSchedule ?? [],
    parent_contacts: data.parentContacts ?? [],
  });
  if (scpError) throw scpError;

  return id;
}

export async function updateSwimmer(id: string, data: Partial<Swimmer>): Promise<void> {
  const swimmerPatch: Record<string, unknown> = {};
  if ('firstName' in data) swimmerPatch.first_name = data.firstName;
  if ('lastName' in data) swimmerPatch.last_name = data.lastName;
  if ('displayName' in data) swimmerPatch.display_name = data.displayName;
  if ('group' in data) swimmerPatch.practice_group = data.group;
  if ('dateOfBirth' in data) swimmerPatch.date_of_birth = toIsoDateOrNull(data.dateOfBirth);
  if ('gender' in data) swimmerPatch.gender = data.gender ?? null;
  if ('usaSwimmingId' in data) swimmerPatch.usa_swimming_id = data.usaSwimmingId ?? null;
  if ('profilePhotoUrl' in data) swimmerPatch.profile_photo_url = data.profilePhotoUrl ?? null;
  if ('active' in data) swimmerPatch.is_active = data.active;
  if ('doNotPhotograph' in data) swimmerPatch.do_not_photograph = data.doNotPhotograph ?? false;
  if ('mediaConsent' in data) {
    swimmerPatch.media_consent_granted = data.mediaConsent?.granted ?? false;
    swimmerPatch.media_consent_at = data.mediaConsent
      ? new Date(data.mediaConsent.date).toISOString()
      : null;
    swimmerPatch.media_consent_expires_at = data.mediaConsent?.expiresAt
      ? new Date(data.mediaConsent.expiresAt).toISOString()
      : null;
    swimmerPatch.media_consent_granted_by_name = data.mediaConsent?.grantedBy ?? null;
    swimmerPatch.media_consent_notes = data.mediaConsent?.notes ?? null;
  }
  // 'goals' is the legacy denormalized field — derived on read from the goals
  // table, never written. updated_at is owned by the BEFORE UPDATE trigger.

  const scpPatch: Record<string, unknown> = {};
  if ('strengths' in data) scpPatch.strengths = data.strengths ?? [];
  if ('weaknesses' in data) scpPatch.weaknesses = data.weaknesses ?? [];
  if ('techniqueFocusAreas' in data)
    scpPatch.technique_focus_areas = data.techniqueFocusAreas ?? [];
  if ('meetSchedule' in data) scpPatch.meet_schedule = data.meetSchedule ?? [];
  if ('parentContacts' in data) scpPatch.parent_contacts = data.parentContacts ?? [];

  if (Object.keys(swimmerPatch).length > 0) {
    const { error } = await supabase.from('swimmers').update(swimmerPatch).eq('id', id);
    if (error) throw error;
  }

  if (Object.keys(scpPatch).length > 0) {
    // upsert: BSPC-origin swimmers have no companion row until first coach edit
    const { error } = await supabase
      .from('swimmer_coach_profile')
      .upsert({ swimmer_id: id, ...scpPatch });
    if (error) throw error;
  }
}
