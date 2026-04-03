import type { Group, Course, NoteTag } from '../config/constants';

// Firebase Timestamp placeholder — will be replaced with actual Firebase Timestamp type
// once @react-native-firebase is installed
export type FirebaseTimestamp = Date;

export type CoachRole = 'admin' | 'coach';

export interface Coach {
  uid: string;
  email: string;
  displayName: string;
  role: CoachRole;
  groups: Group[];
  notificationPrefs: {
    dailyDigest: boolean;
    newNotes: boolean;
    attendanceAlerts: boolean;
    aiDraftsReady: boolean;
  };
  fcmTokens: string[];
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface ParentContact {
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface Swimmer {
  id?: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: FirebaseTimestamp;
  gender: 'M' | 'F';
  group: Group;
  active: boolean;
  usaSwimmingId?: string;
  profilePhotoUrl?: string;
  strengths: string[];
  weaknesses: string[];
  techniqueFocusAreas: string[];
  goals: string[];
  parentContacts: ParentContact[];
  meetSchedule: string[];
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
  createdBy: string;
}

export interface MedicalInfo {
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyNotes: string;
  updatedAt: FirebaseTimestamp;
  updatedBy: string;
}

export interface SwimTime {
  id?: string;
  event: string;
  course: Course;
  time: number; // hundredths of seconds (e.g., 6523 = 1:05.23)
  timeDisplay: string;
  isPR: boolean;
  meetName?: string;
  meetDate?: FirebaseTimestamp;
  source: 'manual' | 'sdif_import';
  createdAt: FirebaseTimestamp;
  createdBy: string;
}

export interface SwimmerNote {
  id?: string;
  content: string;
  tags: NoteTag[];
  source: 'manual' | 'audio_ai' | 'video_ai';
  sourceRefId?: string;
  coachId: string;
  coachName: string;
  practiceDate: FirebaseTimestamp;
  createdAt: FirebaseTimestamp;
}

export interface AttendanceRecord {
  id?: string;
  swimmerId: string;
  swimmerName: string;
  group: Group;
  practiceDate: string; // "YYYY-MM-DD"
  arrivedAt: FirebaseTimestamp;
  departedAt?: FirebaseTimestamp;
  markedBy: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
}

export interface AttendanceAggregation {
  totalPractices: number;
  last30Days: number;
  last90Days: number;
  attendancePercent30: number;
  attendancePercent90: number;
  lastPracticeDate: string;
  updatedAt: FirebaseTimestamp;
}

export interface SwimmerAggregation {
  prsByEvent: Record<string, {
    time: number;
    timeDisplay: string;
    date: FirebaseTimestamp;
  }>;
  noteCount: number;
  lastNoteDate: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface RecentActivityItem {
  type: 'note' | 'attendance' | 'ai_draft' | 'time';
  summary: string;
  coachName: string;
  timestamp: FirebaseTimestamp;
}

export interface DashboardGlobal {
  totalActiveSwimmers: number;
  todayAttendanceCount: number;
  groupCounts: Record<Group, number>;
  recentActivity: RecentActivityItem[];
  updatedAt: FirebaseTimestamp;
}

export type AudioSessionStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'extracting'
  | 'review'
  | 'posted'
  | 'failed';

export interface AudioSession {
  id?: string;
  coachId: string;
  coachName: string;
  storagePath: string;
  duration: number;
  practiceDate: string;
  group?: Group;
  status: AudioSessionStatus;
  transcription?: string;
  errorMessage?: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface AIDraft {
  id?: string;
  swimmerId: string;
  swimmerName: string;
  observation: string;
  tags: NoteTag[];
  confidence: number;
  approved?: boolean;
  reviewedBy?: string;
  reviewedAt?: FirebaseTimestamp;
  postedNoteId?: string;
  createdAt: FirebaseTimestamp;
}

export type VideoSessionStatus =
  | 'uploading'
  | 'uploaded'
  | 'extracting_frames'
  | 'analyzing'
  | 'review'
  | 'posted'
  | 'failed';

export interface VideoSession {
  id?: string;
  coachId: string;
  coachName: string;
  storagePath: string;
  thumbnailPath?: string;
  duration: number;
  practiceDate: string;
  group?: Group;
  taggedSwimmerIds: string[];
  status: VideoSessionStatus;
  frameCount?: number;
  errorMessage?: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface PracticePlanItem {
  order: number;
  reps: number;
  distance: number;
  stroke: string;
  interval?: string;
  description?: string;
  focusPoints: string[];
}

export interface PracticePlanSet {
  order: number;
  name: string;
  description?: string;
  items: PracticePlanItem[];
}

export interface PracticePlan {
  id?: string;
  title: string;
  description?: string;
  group?: Group;
  isTemplate: boolean;
  templateSourceId?: string;
  date?: string;
  coachId: string;
  coachName: string;
  totalDuration: number;
  sets: PracticePlanSet[];
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface Message {
  id?: string;
  content: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  readBy: Record<string, FirebaseTimestamp>;
  createdAt: FirebaseTimestamp;
}

export interface ImportJob {
  id?: string;
  type: 'csv_roster' | 'sdif' | 'cl2';
  fileName: string;
  storagePath: string;
  status: 'processing' | 'complete' | 'failed';
  summary: {
    recordsProcessed: number;
    swimmersCreated: number;
    swimmersUpdated: number;
    timesImported: number;
    errors: string[];
  };
  coachId: string;
  createdAt: FirebaseTimestamp;
}
