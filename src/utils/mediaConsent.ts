/**
 * Media consent helpers — COPPA/SafeSport compliance for youth athletes.
 *
 * Before tagging a swimmer in video or audio AI analysis, verify they have
 * active media consent on file. Swimmers without consent should not appear
 * in video tagging pickers and should be excluded from AI observation extraction.
 */

import type { Swimmer, MediaConsent } from '../types/firestore.types';

/** Check whether a swimmer has active (granted) media consent */
export function hasMediaConsent(swimmer: Pick<Swimmer, 'mediaConsent'>): boolean {
  return swimmer.mediaConsent?.granted === true;
}

/**
 * Filter a list of swimmers to only those with active media consent.
 * Use this to populate video tagging pickers and AI analysis swimmer lists.
 */
export function filterConsentedSwimmers<T extends Pick<Swimmer, 'mediaConsent'>>(
  swimmers: T[],
): T[] {
  return swimmers.filter(hasMediaConsent);
}

/**
 * Get swimmers who are NOT consented — useful for showing a warning
 * when a coach tries to tag non-consented swimmers.
 */
export function getNonConsentedSwimmers<T extends Pick<Swimmer, 'mediaConsent' | 'displayName'>>(
  swimmers: T[],
  taggedIds: string[],
  allSwimmers: (T & { id?: string })[],
): string[] {
  return taggedIds
    .map((id) => allSwimmers.find((s) => s.id === id))
    .filter((s): s is T & { id?: string } => !!s && !hasMediaConsent(s))
    .map((s) => s.displayName);
}

/** Build a MediaConsent object for granting consent */
export function grantConsent(grantedBy: string, notes?: string): MediaConsent {
  return {
    granted: true,
    date: new Date() as any, // Runtime: Firestore serverTimestamp; typed as Date
    grantedBy,
    notes,
  };
}

/** Build a MediaConsent object for revoking consent */
export function revokeConsent(notes?: string): MediaConsent {
  return {
    granted: false,
    date: new Date() as any,
    notes,
  };
}
