/**
 * Shared meet-import type definitions.
 *
 * Extracted into a leaf module so that the SDIF parser and the shared
 * results-import pipeline can both reference these types without creating
 * a circular import between `sdifImport.ts` and `meetResultsImport.ts`.
 */

import type { Swimmer } from '../types/firestore.types';

type SwimmerWithId = Swimmer & { id: string };

export interface SDIFRecord {
  firstName: string;
  lastName: string;
  usaSwimmingId: string;
  event: string;
  time: number; // hundredths
  timeDisplay: string;
  course: 'SCY' | 'SCM' | 'LCM';
  meetName: string;
  meetDate: string;
  gender: 'M' | 'F';
}

export interface SDIFParseResult {
  meetName: string;
  meetDate: string;
  course: 'SCY' | 'SCM' | 'LCM';
  records: SDIFRecord[];
  errors: string[];
}

export interface MatchResult {
  record: SDIFRecord;
  matchedSwimmer: SwimmerWithId | null;
  confidence: 'exact' | 'name' | 'none';
}

export interface ImportResult {
  imported: number;
  prs: number;
  skipped: number;
  errors: string[];
}
