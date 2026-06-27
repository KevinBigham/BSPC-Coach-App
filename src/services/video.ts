// Data layer migrated Firestore -> Supabase (UNIFY/01:video_sessions, Phase F).
// Same behavioral contract. taggedSwimmerIds/selectedSwimmerIds UUID[] become
// the kind-discriminated video_session_swimmers junction (P1-4; kind='tagged'
// is the consent-gated set, derived back into the arrays on read). Drafts
// live in video_session_drafts (the Firestore subcollection is gone);
// swimmerName/coachName are derived on read. Video FILES live in the
// 'media-video' bucket (D-F1). Proposal C (v1): media AI processing is
// disabled, so updateVideoSession no longer kicks any processing pipeline on
// the flip to 'uploaded'. The BUG #4 media-consent assertions at session
// create are UNCHANGED.
import { supabase } from '../config/supabase';
import type {
  VideoSession,
  VideoSessionStatus,
  VideoAnalysisDraft,
  Swimmer,
} from '../types/firestore.types';
import type { Group, NoteTag } from '../config/constants';
import { canTagOrUploadMedia, assertCanTagSwimmers } from '../utils/mediaConsent';
import { uploadFileToBucket, getSignedFileUrl } from './mediaUpload';

type VideoSessionWithId = VideoSession & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

function assertSelectedSwimmerIds(
  selectedSwimmerIds: unknown,
): asserts selectedSwimmerIds is string[] {
  if (!Array.isArray(selectedSwimmerIds) || selectedSwimmerIds.length === 0) {
    throw new Error('Cannot create video session without selected swimmer ids');
  }
}

interface VideoSessionRow {
  id: string;
  coach_id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  duration_sec: number | null;
  practice_date: string;
  practice_group: Group | null;
  status: VideoSessionStatus;
  frame_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
  swimmers: { swimmer_id: string; kind: 'tagged' | 'selected' }[] | null;
}

const VIDEO_SESSION_SELECT =
  'id, coach_id, storage_path, thumbnail_path, duration_sec, practice_date, practice_group, ' +
  'status, frame_count, error_message, created_at, updated_at, ' +
  'coach:profiles(full_name), swimmers:video_session_swimmers(swimmer_id, kind)';

function rowToVideoSession(row: VideoSessionRow): VideoSessionWithId {
  const swimmers = row.swimmers ?? [];
  return {
    id: row.id,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    storagePath: row.storage_path ?? '',
    thumbnailPath: row.thumbnail_path ?? undefined,
    duration: row.duration_sec ?? 0,
    // practice_date is a calendar STRING end-to-end (the meets lesson)
    practiceDate: row.practice_date,
    group: row.practice_group ?? undefined,
    taggedSwimmerIds: swimmers.filter((s) => s.kind === 'tagged').map((s) => s.swimmer_id),
    selectedSwimmerIds: swimmers.filter((s) => s.kind === 'selected').map((s) => s.swimmer_id),
    status: row.status,
    frameCount: row.frame_count ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

let channelSeq = 0;

export function subscribeVideoSessions(
  coachId: string,
  callback: (sessions: VideoSessionWithId[]) => void,
  max: number = 20,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('video_sessions')
      .select(VIDEO_SESSION_SELECT)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
      .limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as VideoSessionRow[]).map(rowToVideoSession));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`video_sessions:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'video_sessions',
        filter: `coach_id=eq.${coachId}`,
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

// Phase K (D-K4 addition #4): the single-session subscription video/[id]'s
// doc-read re-points onto — the AI pipeline flips this row's status live, so
// a real subscription is required (the coach-scoped list is the wrong axis
// for an arbitrary session by id). Watches both projection sources (the
// session row + its swimmer junction). Missing row emits null, like
// snap.exists() === false.
export function subscribeVideoSession(
  id: string,
  callback: (session: VideoSessionWithId | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('video_sessions')
      .select(VIDEO_SESSION_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (!live) return;
    if (error || !data) {
      callback(null);
      return;
    }
    callback(rowToVideoSession(data as unknown as VideoSessionRow));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`video_sessions:one:${id}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'video_sessions', filter: `id=eq.${id}` },
      () => {
        void emit();
      },
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'video_session_swimmers',
        filter: `session_id=eq.${id}`,
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

// Phase K (D-K4 addition #5): sessions a swimmer is TAGGED in — the
// SwimmerVideoClips/VideoComparison query axis (legacy `taggedSwimmerIds
// array-contains`, now the kind-discriminated P1-4 junction). tag_filter is a
// SECOND embed of the junction used purely as the inner-join filter; the
// unfiltered `swimmers` embed keeps the full tagged/selected arrays intact
// for the mapper (a filtered embed would truncate them). Channel on BOTH
// source tables with re-fetch (the J idiom): a status flip must re-emit and
// the sessions table carries no swimmer axis to filter on.
export function subscribeSwimmerVideoSessions(
  swimmerId: string,
  callback: (sessions: VideoSessionWithId[]) => void,
  opts: { postedOnly?: boolean; max?: number } = {},
): Unsubscribe {
  const { postedOnly = false, max = 10 } = opts;
  let live = true;

  const emit = async (): Promise<void> => {
    let q = supabase
      .from('video_sessions')
      .select(`${VIDEO_SESSION_SELECT}, tag_filter:video_session_swimmers!inner(swimmer_id, kind)`)
      .eq('tag_filter.swimmer_id', swimmerId)
      .eq('tag_filter.kind', 'tagged');
    if (postedOnly) q = q.eq('status', 'posted');
    const { data, error } = await q.order('created_at', { ascending: false }).limit(max);
    if (!live || error || !data) return;
    callback((data as unknown as VideoSessionRow[]).map(rowToVideoSession));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`video_sessions:swimmer:${swimmerId}:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'video_sessions' }, () => {
      void emit();
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'video_session_swimmers',
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

// Phase J (the ratified D-J1 pendingDrafts rider): the dashboard's pending-
// review count — the exact status='review' count the screen used to take
// from Firestore directly; landed in this service so the hook stays out of
// the data layer. Same query shape, no new capability (staff-wide wall).
export function subscribePendingVideoReviewCount(callback: (count: number) => void): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { count, error } = await supabase
      .from('video_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'review');
    if (!live || error || count === null) return;
    callback(count);
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`video_sessions:review:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'video_sessions' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

interface VideoDraftRow {
  id: string;
  session_id: string;
  swimmer_id: string;
  observation: string;
  diagnosis: string | null;
  drill_recommendation: string | null;
  phase: VideoAnalysisDraft['phase'];
  tags: NoteTag[] | null;
  confidence: number | null;
  approved: boolean | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  swimmer: { display_name: string } | null;
}

const VIDEO_DRAFT_SELECT =
  'id, session_id, swimmer_id, observation, diagnosis, drill_recommendation, phase, tags, ' +
  'confidence, approved, reviewed_by, reviewed_at, created_at, swimmer:swimmers(display_name)';

function rowToVideoDraft(row: VideoDraftRow): VideoAnalysisDraft & { id: string } {
  return {
    id: row.id,
    swimmerId: row.swimmer_id,
    swimmerName: row.swimmer?.display_name ?? '',
    observation: row.observation,
    diagnosis: row.diagnosis ?? '',
    drillRecommendation: row.drill_recommendation ?? '',
    phase: row.phase,
    tags: row.tags ?? [],
    confidence: row.confidence ?? 0,
    approved: row.approved ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

export function subscribeVideoDrafts(
  sessionId: string,
  callback: (drafts: (VideoAnalysisDraft & { id: string })[]) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('video_session_drafts')
      .select(VIDEO_DRAFT_SELECT)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as VideoDraftRow[]).map(rowToVideoDraft));
  };

  void emit();

  const channel = supabase
    .channel(`video_session_drafts:${sessionId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'video_session_drafts',
        filter: `session_id=eq.${sessionId}`,
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

/**
 * Validate that all tagged swimmers have media consent on file.
 * Returns the list of swimmer names that lack consent (empty = all clear).
 */
export function validateMediaConsent(
  taggedSwimmerIds: string[],
  swimmers: (Swimmer & { id: string })[],
): string[] {
  return taggedSwimmerIds
    .map((id) => swimmers.find((s) => s.id === id))
    .filter((s): s is Swimmer & { id: string } => !!s && !canTagOrUploadMedia(s).allowed)
    .map((s) => s.displayName);
}

export async function createVideoSession(
  coachId: string,
  coachName: string,
  duration: number,
  practiceDate: string,
  selectedSwimmerIds: string[],
  group: Group | undefined,
  swimmers: Array<Swimmer & { id: string }>,
): Promise<string> {
  assertSelectedSwimmerIds(selectedSwimmerIds);

  // COPPA gate: roster context is mandatory at this service boundary.
  for (const swimmerId of selectedSwimmerIds) {
    if (!swimmers.some((swimmer) => swimmer.id === swimmerId)) {
      throw new Error(
        `Cannot create video session: missing roster context for swimmer ${swimmerId}`,
      );
    }
  }
  assertCanTagSwimmers(selectedSwimmerIds, swimmers);

  void coachName; // denormalized in Firestore; canonical derives it from profiles on read

  const { data, error } = await supabase
    .from('video_sessions')
    .insert({
      coach_id: coachId,
      storage_path: '',
      duration_sec: duration,
      practice_date: practiceDate,
      practice_group: group || null,
      status: 'uploading' satisfies VideoSessionStatus,
    })
    .select('id')
    .single();
  if (error) throw error;
  const sessionId = (data as { id: string }).id;

  // P1-4: both arrays were written identically at create in Firestore; the
  // junction keeps that shape with kind discriminating the consent-gated set.
  const { error: junctionError } = await supabase.from('video_session_swimmers').insert([
    ...selectedSwimmerIds.map((swimmerId) => ({
      session_id: sessionId,
      swimmer_id: swimmerId,
      kind: 'tagged' as const,
    })),
    ...selectedSwimmerIds.map((swimmerId) => ({
      session_id: sessionId,
      swimmer_id: swimmerId,
      kind: 'selected' as const,
    })),
  ]);
  if (junctionError) throw junctionError;

  return sessionId;
}

export async function updateVideoSession(
  sessionId: string,
  data: Partial<VideoSession>,
): Promise<void> {
  // Map only provided fields to columns; updated_at is DB-trigger-owned.
  const patch: Record<string, unknown> = {};
  if ('status' in data) patch.status = data.status;
  if ('storagePath' in data) patch.storage_path = data.storagePath;
  if ('thumbnailPath' in data) patch.thumbnail_path = data.thumbnailPath;
  if ('duration' in data) patch.duration_sec = data.duration;
  if ('practiceDate' in data) patch.practice_date = data.practiceDate;
  if ('group' in data) patch.practice_group = data.group ?? null;
  if ('frameCount' in data) patch.frame_count = data.frameCount;
  if ('errorMessage' in data) patch.error_message = data.errorMessage;

  const { error } = await supabase.from('video_sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
}

export async function uploadVideo(
  uri: string,
  coachId: string,
  date: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const fileName = `video_${Date.now()}.mp4`;
  const storagePath = `video/${coachId}/${date}/${fileName}`;

  await uploadFileToBucket('media-video', storagePath, uri, 'video/mp4', onProgress);
  const downloadUrl = await getSignedFileUrl('media-video', storagePath, 3600);
  return { storagePath, downloadUrl };
}

export function getVideoStatusLabel(status: VideoSessionStatus): string {
  switch (status) {
    case 'queued':
      return 'QUEUED';
    case 'uploading':
      return 'UPLOADING';
    // Proposal C (v1): the AI pipeline statuses are presented as 'uploaded' —
    // the terminal state a coach sees when AI analysis is disabled.
    case 'uploaded':
    case 'extracting_frames':
    case 'analyzing':
    case 'review':
      return 'UPLOADED';
    case 'posted':
      return 'POSTED';
    case 'failed':
      return 'FAILED';
  }
}

export function getVideoStatusColor(status: VideoSessionStatus): string {
  switch (status) {
    case 'queued':
      return '#FFD700';
    case 'uploading':
      return '#7a7a8e';
    // Proposal C (v1): AI pipeline statuses share the 'uploaded' color.
    case 'uploaded':
    case 'extracting_frames':
    case 'analyzing':
    case 'review':
      return '#f5a623';
    case 'posted':
      return '#CCB000';
    case 'failed':
      return '#f43f5e';
  }
}
