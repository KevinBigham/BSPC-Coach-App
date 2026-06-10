// Data layer migrated Firestore -> Supabase (UNIFY/01:parent_invites,
// Phase I, D-I1). Invites are staff-shared rows (today's isCoach() wall);
// REDEMPTION is not here — it is the server-side redeem_parent_invite RPC
// behind the frozen redeemInvite callable (D-I2; a family user can never
// self-insert a guardianship, D-A). swimmerName/coachName denorms drop and
// derive on read via embeds; the create signature stays frozen, so the two
// name params remain (dead) for compat. The UNIQUE code key is the
// collision backstop Firestore's addDoc never had.
import { supabase } from '../config/supabase';
import type { ParentInvite } from '../types/firestore.types';
import { secureInviteCode } from '../utils/secureRandom';

type ParentInviteWithId = ParentInvite & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface InviteRow {
  id: string;
  code: string;
  swimmer_id: string;
  coach_id: string;
  redeemed: boolean;
  redeemed_by: string | null;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
  swimmer: { first_name: string; last_name: string | null } | null;
  coach: { full_name: string | null } | null;
}

const INVITE_SELECT =
  'id, code, swimmer_id, coach_id, redeemed, redeemed_by, redeemed_at, expires_at, created_at, ' +
  'swimmer:swimmers(first_name, last_name), coach:profiles(full_name)';

function rowToInvite(row: InviteRow): ParentInviteWithId {
  return {
    id: row.id,
    code: row.code,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer
      ? `${row.swimmer.first_name} ${row.swimmer.last_name ?? ''}`.trim()
      : '',
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    redeemed: row.redeemed,
    redeemedBy: row.redeemed_by ?? undefined,
    redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : undefined,
    expiresAt: new Date(row.expires_at),
    createdAt: new Date(row.created_at),
  };
}

function generateCode(): string {
  return secureInviteCode();
}

export async function createParentInvite(
  swimmerId: string,
  _swimmerName: string,
  coachId: string,
  _coachName: string,
): Promise<string> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry (client-computed, verbatim)

  const { error } = await supabase
    .from('parent_invites')
    .insert({
      code,
      swimmer_id: swimmerId,
      coach_id: coachId, // verbatim from the frozen param (D-B7 idiom)
      expires_at: expiresAt.toISOString(),
      // redeemed defaults FALSE; created_at is DB-owned; the name denorms are
      // gone (derived on read) — a UNIQUE code collision surfaces as this throw
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  return code;
}

let channelSeq = 0;

export function subscribeInvitesForSwimmer(
  swimmerId: string,
  callback: (invites: ParentInviteWithId[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('parent_invites')
      .select(INVITE_SELECT)
      .eq('swimmer_id', swimmerId)
      .order('created_at', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as InviteRow[]).map(rowToInvite));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`parent_invites:${swimmerId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'parent_invites',
        filter: `swimmer_id=eq.${swimmerId}`,
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

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('parent_invites')
    .update({ redeemed: true }) // revoke IS "mark redeemed" — today's exact semantics
    .eq('id', inviteId);
  if (error) throw new Error(error.message);
}
