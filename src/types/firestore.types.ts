import type {
  Group,
  Course,
  NoteTag,
  SetCategory,
  StandardLevel,
  CalendarEventType,
} from '../config/constants';

/** Domain alias for a Firestore timestamp — modeled as Date client-side. */
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

/** COPPA/SafeSport media consent status for a minor athlete */
export interface MediaConsent {
  /** Whether parent/guardian has granted verifiable consent for photo/video */
  granted: boolean;
  /** Date consent was granted or revoked */
  date: FirebaseTimestamp;
  /** Name of parent/guardian who provided consent */
  grantedBy?: string;
  /** Optional notes (e.g., "revoked 2026-03-01 via email") */
  notes?: string;
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
  /** COPPA/SafeSport media consent — controls video/photo tagging eligibility */
  mediaConsent?: MediaConsent;
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
  splits?: number[]; // split times in hundredths per 50 (e.g., [3012, 3511])
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

export type AttendanceStatus = 'normal' | 'excused' | 'sick' | 'injured' | 'left_early';

export interface AttendanceRecord {
  id?: string;
  swimmerId: string;
  swimmerName: string;
  group: Group;
  practiceDate: string; // "YYYY-MM-DD"
  arrivedAt: FirebaseTimestamp;
  departedAt?: FirebaseTimestamp;
  status?: AttendanceStatus;
  note?: string;
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
  prsByEvent: Record<
    string,
    {
      time: number;
      timeDisplay: string;
      date: FirebaseTimestamp;
    }
  >;
  noteCount: number;
  lastNoteDate: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface DashboardAttendanceAggregation {
  countsByDate: Record<string, number>;
  updatedAt: FirebaseTimestamp;
}

export interface DashboardActivityItem {
  id: string;
  type: 'attendance' | 'note' | 'time' | 'pr' | 'video';
  text: string;
  coach: string;
  timestamp: FirebaseTimestamp;
}

export interface DashboardActivityAggregation {
  items: DashboardActivityItem[];
  updatedAt: FirebaseTimestamp;
}

export type AudioSessionStatus =
  | 'queued'
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
  | 'queued'
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

export type VideoAnalysisPhase =
  | 'stroke'
  | 'turn'
  | 'start'
  | 'underwater'
  | 'breakout'
  | 'finish'
  | 'general';

export interface VideoAnalysisDraft {
  id?: string;
  swimmerId: string;
  swimmerName: string;
  observation: string;
  diagnosis: string;
  drillRecommendation: string;
  phase: VideoAnalysisPhase;
  tags: NoteTag[];
  confidence: number;
  approved?: boolean;
  reviewedBy?: string;
  reviewedAt?: FirebaseTimestamp;
  createdAt: FirebaseTimestamp;
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
  category: SetCategory;
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

export interface Notification {
  id?: string;
  coachId: string;
  title: string;
  body: string;
  type: 'daily_digest' | 'ai_drafts_ready' | 'standard_achieved' | 'general';
  data?: Record<string, string>;
  read: boolean;
  createdAt: FirebaseTimestamp;
}

export type { StandardLevel };

export interface SwimmerGoal {
  id?: string;
  event: string;
  course: Course;
  targetStandard?: StandardLevel;
  targetTime?: number; // hundredths
  targetTimeDisplay?: string;
  currentTime?: number;
  currentTimeDisplay?: string;
  notes?: string;
  achieved: boolean;
  achievedAt?: FirebaseTimestamp;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export type { CalendarEventType };

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  type: CalendarEventType;
  startDate: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM"
  endDate?: string;
  endTime?: string;
  location?: string;
  groups: Group[]; // empty = all groups
  recurring?: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    dayOfWeek?: number; // 0=Sun, 1=Mon, etc.
    until?: string; // "YYYY-MM-DD"
  };
  coachId: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export type RSVPStatus = 'going' | 'maybe' | 'not_going';

export interface RSVP {
  id?: string;
  eventId: string;
  swimmerId: string;
  swimmerName: string;
  status: RSVPStatus;
  parentName?: string;
  note?: string;
  updatedAt: FirebaseTimestamp;
}

export interface ParentInvite {
  id?: string;
  code: string;
  swimmerId: string;
  swimmerName: string;
  coachId: string;
  coachName: string;
  redeemed: boolean;
  redeemedBy?: string;
  redeemedAt?: FirebaseTimestamp;
  expiresAt: FirebaseTimestamp;
  createdAt: FirebaseTimestamp;
}

// Season Planning types
export type SeasonPhaseType = 'base' | 'build1' | 'build2' | 'peak' | 'taper' | 'race' | 'recovery';

export interface SeasonPhase {
  name: string;
  type: SeasonPhaseType;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  weeklyYardage: number;
  focusAreas: string[];
  notes?: string;
}

export interface WeekPlan {
  id?: string;
  weekNumber: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  phase: SeasonPhaseType;
  targetYardage: number;
  actualYardage?: number;
  practiceCount: number;
  notes?: string;
  practicePlanIds: string[];
}

export interface SeasonPlan {
  id?: string;
  name: string;
  group: Group;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  phases: SeasonPhase[];
  totalWeeks: number;
  coachId: string;
  coachName: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

// Notification Rule types
export type NotificationTrigger =
  | 'attendance_streak'
  | 'missed_practice'
  | 'pr_achieved'
  | 'time_standard_met'
  | 'birthday'
  | 'custom';

export interface NotificationRule {
  id?: string;
  name: string;
  trigger: NotificationTrigger;
  enabled: boolean;
  config: {
    threshold?: number; // e.g., streak count, days missed
    group?: Group;
    message?: string;
  };
  coachId: string;
  createdAt: FirebaseTimestamp;
  updatedAt: FirebaseTimestamp;
}

export interface ImportJob {
  id?: string;
  type: 'csv_roster' | 'sdif' | 'hy3' | 'cl2';
  fileName: string;
  storagePath: string;
  status: 'processing' | 'complete' | 'failed';
  errorMessage?: string;
  summary: {
    recordsProcessed: number;
    swimmersCreated: number;
    swimmersUpdated: number;
    timesImported: number;
    errors: string[];
  };
  coachId: string;
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
}
