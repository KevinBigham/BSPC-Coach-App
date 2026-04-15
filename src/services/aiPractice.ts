import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { PracticePlanSet } from '../types/firestore.types';
import type { Group } from '../config/constants';

export interface AIPracticeRequest {
  group: Group;
  focus: 'endurance' | 'speed' | 'technique' | 'recovery' | 'race_prep' | 'mixed';
  targetYardage: number;
  durationMinutes: number;
  meetName?: string;
  meetDate?: string;
  notes?: string;
}

export interface AIPracticeResponse {
  title: string;
  description: string;
  sets: PracticePlanSet[];
  totalYardage: number;
  estimatedDuration: number;
}

export async function generatePractice(request: AIPracticeRequest): Promise<AIPracticeResponse> {
  const fn = httpsCallable<AIPracticeRequest, AIPracticeResponse>(functions, 'generatePractice');
  const result = await fn(request);
  return result.data;
}
