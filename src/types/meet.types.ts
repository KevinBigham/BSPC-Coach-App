import type { Group, Course } from '../config/constants';
import type { FirebaseTimestamp } from './firestore.types';

export type MeetStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export interface Meet {
  id?: string;
  name: string;
  location: string;
  course: Course;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string;
  status: MeetStatus;
  events: MeetEvent[];
  groups: Group[]; // empty = all groups
  notes?: string;
  sanctionNumber?: string;
  hostTeam?: string;
  coachId: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface MeetEvent {
  number: number;
  name: string; // e.g., "200 Free"
  gender: 'M' | 'F' | 'Mixed';
  ageGroup?: string; // e.g., "13-14"
  isRelay: boolean;
}

export interface MeetEntry {
  id?: string;
  meetId: string;
  swimmerId: string;
  swimmerName: string;
  group: Group;
  gender: 'M' | 'F';
  age: number;
  eventName: string;
  eventNumber: number;
  seedTime?: number; // hundredths
  seedTimeDisplay?: string;
  finalTime?: number;
  finalTimeDisplay?: string;
  place?: number;
  heat?: number;
  lane?: number;
  isPR?: boolean;
  createdAt: FirebaseTimestamp;
}

export interface Relay {
  id?: string;
  meetId: string;
  eventName: string; // e.g., "200 Medley Relay"
  gender: 'M' | 'F' | 'Mixed';
  teamName: string; // e.g., "BSPC A"
  legs: RelayLeg[];
  estimatedTime?: number;
  estimatedTimeDisplay?: string;
  finalTime?: number;
  finalTimeDisplay?: string;
  place?: number;
  createdAt: FirebaseTimestamp;
}

export interface RelayLeg {
  order: number; // 1-4
  swimmerId: string;
  swimmerName: string;
  stroke: string; // For medley: Back, Breast, Fly, Free
  splitTime?: number;
  splitTimeDisplay?: string;
}

export interface PsychSheetEntry {
  eventName: string;
  eventNumber: number;
  gender: 'M' | 'F';
  entries: {
    swimmerName: string;
    group: Group;
    age: number;
    seedTime: number;
    seedTimeDisplay: string;
  }[];
}
