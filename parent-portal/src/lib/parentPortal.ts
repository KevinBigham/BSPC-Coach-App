import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface ParentProfile {
  uid: string;
  email: string;
  displayName: string;
  linkedSwimmerIds: string[];
}

export interface ParentSwimmerSummary {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  group: string;
  gender: string;
  active: boolean;
  profilePhotoUrl: string | null;
}

export interface ParentSwimmerDetail extends ParentSwimmerSummary {
  strengths: string[];
  goals: string[];
}

export interface ParentSwimTime {
  id: string;
  event: string;
  course: string;
  time: number;
  timeDisplay: string;
  isPR: boolean;
  meetName: string | null;
  meetDate: string | null;
}

export interface ParentAttendanceSummary {
  id: string;
  practiceDate: string;
  status: string | null;
}

export interface ParentScheduleEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
}

export interface ParentPortalDashboard {
  profile: ParentProfile;
  swimmers: ParentSwimmerSummary[];
}

export interface ParentSwimmerPortalData {
  swimmer: ParentSwimmerDetail;
  times: ParentSwimTime[];
  attendance: ParentAttendanceSummary[];
  schedule: ParentScheduleEvent[];
}

export interface RedeemInviteResponse {
  success: boolean;
  swimmerId: string;
  swimmerName: string;
}

export async function loadParentPortalDashboard(): Promise<ParentPortalDashboard> {
  const call = httpsCallable<void, ParentPortalDashboard>(functions, 'getParentPortalDashboard');
  const result = await call();
  return result.data;
}

export async function loadParentSwimmerPortalData(
  swimmerId: string,
): Promise<ParentSwimmerPortalData> {
  const call = httpsCallable<{ swimmerId: string }, ParentSwimmerPortalData>(
    functions,
    'getParentSwimmerPortalData',
  );
  const result = await call({ swimmerId });
  return result.data;
}

export async function redeemParentInvite(code: string): Promise<RedeemInviteResponse> {
  const call = httpsCallable<{ code: string }, RedeemInviteResponse>(functions, 'redeemInvite');
  const result = await call({ code });
  return result.data;
}
