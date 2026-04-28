/**
 * Media consent helpers — COPPA/SafeSport compliance for youth athletes.
 *
 * Before tagging a swimmer in video or audio AI analysis, verify they have
 * active media consent on file. Swimmers without consent should not appear
 * in video tagging pickers and should be excluded from AI observation extraction.
 */

import type { Swimmer, MediaConsent } from '../types/firestore.types';
import { toDateSafe } from './date';

type MediaEligibilityReason =
  | 'missing_consent'
  | 'do_not_photograph'
  | 'inactive'
  | 'expired_consent';

type MediaEligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: MediaEligibilityReason };

type MediaEligibleSwimmer = Pick<Swimmer, 'mediaConsent' | 'active' | 'doNotPhotograph'>;

function isConsentExpired(consent: MediaConsent): boolean {
  const expiresAt = toDateSafe(consent.expiresAt);
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

export function canTagOrUploadMedia(
  swimmer: Partial<MediaEligibleSwimmer>,
): MediaEligibilityResult {
  if (swimmer.doNotPhotograph === true) {
    return { allowed: false, reason: 'do_not_photograph' };
  }
  if (swimmer.active === false) {
    return { allowed: false, reason: 'inactive' };
  }
  if (swimmer.mediaConsent?.granted !== true) {
    return { allowed: false, reason: 'missing_consent' };
  }
  if (isConsentExpired(swimmer.mediaConsent)) {
    return { allowed: false, reason: 'expired_consent' };
  }
  return { allowed: true };
}

/** Check whether a swimmer has active (granted) media consent */
export function hasMediaConsent(swimmer: Partial<MediaEligibleSwimmer>): boolean {
  return canTagOrUploadMedia(swimmer).allowed;
}

/**
 * Service-layer COPPA gate for a single swimmer.
 *
 * Throws when the swimmer fails `canTagOrUploadMedia`. Use this at any
 * service boundary that commits a tagging decision to Firestore (e.g.,
 * approving an AI/video draft, creating a video session). The error
 * message names the swimmer and the eligibility reason so callers can
 * surface a precise message to the coach.
 */
export function assertCanTagSwimmer(
  swimmer: Partial<MediaEligibleSwimmer> & { displayName?: string },
): void {
  const result = canTagOrUploadMedia(swimmer);
  if (!result.allowed) {
    const name = swimmer.displayName ?? '<unknown swimmer>';
    throw new Error(`Cannot tag ${name}: media consent ${result.reason}`);
  }
}

/**
 * Multi-swimmer COPPA gate. Throws once with a comma-separated list of
 * blocked names so the coach sees every offender, not just the first.
 *
 * Unknown IDs (no matching swimmer in the supplied roster) are silently
 * skipped — same semantics as `validateMediaConsent` in `services/video.ts`.
 * Callers that need to enforce roster membership should pair this with a
 * separate roster-validation step.
 */
export function assertCanTagSwimmers<
  T extends Partial<MediaEligibleSwimmer> & { id?: string; displayName: string },
>(taggedIds: string[], swimmers: T[]): void {
  const blocked: T[] = [];
  for (const id of taggedIds) {
    const swimmer = swimmers.find((s) => s.id === id);
    if (swimmer && !canTagOrUploadMedia(swimmer).allowed) {
      blocked.push(swimmer);
    }
  }
  if (blocked.length > 0) {
    const names = blocked.map((s) => s.displayName).join(', ');
    throw new Error(`Cannot tag swimmers without media consent: ${names}`);
  }
}

/**
 * Filter a list of swimmers to only those with active media consent.
 * Use this to populate video tagging pickers and AI analysis swimmer lists.
 */
export function filterConsentedSwimmers<T extends Partial<MediaEligibleSwimmer>>(
  swimmers: T[],
): T[] {
  return swimmers.filter(hasMediaConsent);
}

/**
 * Get swimmers who are NOT consented — useful for showing a warning
 * when a coach tries to tag non-consented swimmers.
 */
export function getNonConsentedSwimmers<
  T extends Partial<MediaEligibleSwimmer> & Pick<Swimmer, 'displayName'>,
>(swimmers: T[], taggedIds: string[], allSwimmers: (T & { id?: string })[]): string[] {
  return taggedIds
    .map((id) => allSwimmers.find((s) => s.id === id))
    .filter((s): s is T & { id?: string } => !!s && !hasMediaConsent(s))
    .map((s) => s.displayName);
}

/** Build a MediaConsent object for granting consent */
export function grantConsent(grantedBy: string, notes?: string): MediaConsent {
  return {
    granted: true,
    // FirebaseTimestamp is typed as Date — Firestore serializes to Timestamp at write time.
    date: new Date(),
    grantedBy,
    notes,
  };
}

/** Build a MediaConsent object for revoking consent */
export function revokeConsent(notes?: string): MediaConsent {
  return {
    granted: false,
    date: new Date(),
    notes,
  };
}
