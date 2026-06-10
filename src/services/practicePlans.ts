// Data layer migrated Firestore -> Supabase (UNIFY/01:practice_plans, Phase H).
// Same behavioral contract under the D-H1 WITHIN-STAFF walls (owner-private +
// the deliberate public-share arm; RLS is the wall, the caller filters stay —
// RH-2). The dashboard-PDF discriminator becomes the canonical document_type
// column and its exclusion moves SERVER-side (document_type IS NULL —
// observable result identical, RH-16); the client-side group filter stays
// client-side (frozen semantics). PDF rows write title := filename (title is
// NOT NULL; the card renders filename — RH-16). PDF FILES live in the private
// practice-plans bucket (D-H2a): today's caps mirrored, owner-segment walls,
// uploads via the Phase F signed-URL helper (onProgress contract preserved).
// The coachName denorm is gone — derived on read through the profiles embed.
import { supabase } from '../config/supabase';
import type { PracticePlan } from '../types/firestore.types';
import type { DashboardPracticePlanPdf } from '../types/practicePlan';
import { getTodayString } from '../utils/time';
import { uploadFileToBucket, getSignedFileUrl } from './mediaUpload';

type PlanWithId = PracticePlan & { id: string };
type DashboardPracticePlanPdfWithId = DashboardPracticePlanPdf & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

const PRACTICE_PLANS_BUCKET = 'practice-plans';

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  practice_group: PracticePlan['group'] | null;
  is_template: boolean;
  is_public: boolean;
  template_source_id: string | null;
  plan_date: string | null;
  total_duration_min: number | null;
  tags: string[] | null;
  ratings: Record<string, number> | null;
  sets: PracticePlan['sets'] | null;
  document_type: string | null;
  storage_path: string | null;
  filename: string | null;
  uploaded_at: string | null;
  size_bytes: number | null;
  page_count: number | null;
  coach_id: string;
  created_at: string;
  updated_at: string;
  coach: { full_name: string } | null;
}

const PLAN_SELECT =
  'id, title, description, practice_group, is_template, is_public, template_source_id, ' +
  'plan_date, total_duration_min, tags, ratings, sets, document_type, storage_path, ' +
  'filename, uploaded_at, size_bytes, page_count, coach_id, created_at, updated_at, ' +
  'coach:profiles(full_name)';

function rowToPlan(row: PlanRow): PlanWithId {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    group: row.practice_group ?? undefined,
    isTemplate: row.is_template,
    public: row.is_public,
    templateSourceId: row.template_source_id ?? undefined,
    date: row.plan_date ?? undefined,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? '',
    totalDuration: row.total_duration_min ?? 0,
    tags: row.tags ?? [],
    ratings: row.ratings ?? {},
    sets: row.sets ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function rowToPdf(row: PlanRow): DashboardPracticePlanPdfWithId {
  return {
    id: row.id,
    documentType: 'dashboard_pdf',
    coachId: row.coach_id,
    date: row.plan_date ?? '',
    storagePath: row.storage_path ?? '',
    filename: row.filename ?? '',
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at) : new Date(0),
    sizeBytes: row.size_bytes ?? 0,
    pageCount: row.page_count ?? undefined,
  };
}

let channelSeq = 0;

export function subscribePracticePlans(
  callback: (plans: PlanWithId[]) => void,
  options?: { isTemplate?: boolean; group?: string; max?: number; coachId?: string },
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    // RH-16: the dashboard-PDF exclusion is the server-side document_type
    // IS NULL filter now (was a client-side discriminator check) —
    // observable result identical.
    let q = supabase.from('practice_plans').select(PLAN_SELECT).is('document_type', null);

    // RH-2: caller filters survive as real query params; the D-H1 RLS wall
    // is the security boundary, never the scope.
    if (options?.isTemplate !== undefined) {
      q = q.eq('is_template', options.isTemplate);
    }
    if (options?.coachId) {
      q = q.eq('coach_id', options.coachId);
    }

    q = q.order('created_at', { ascending: false });

    if (options?.max) {
      q = q.limit(options.max);
    }

    const { data, error } = await q;
    if (!live || error || !data) return;

    let plans = (data as unknown as PlanRow[]).map(rowToPlan);
    // The group filter stays CLIENT-side (frozen semantics, RH-16).
    if (options?.group) {
      plans = plans.filter((p) => p.group === options.group);
    }
    callback(plans);
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`practice_plans:list:${channelSeq++}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_plans' }, () => {
      void emit();
    })
    .subscribe();

  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}

export async function addPracticePlan(
  plan: Omit<PracticePlan, 'id' | 'createdAt' | 'updatedAt'>,
  coachUid: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('practice_plans')
    .insert({
      title: plan.title,
      description: plan.description ?? null,
      practice_group: plan.group ?? null,
      is_template: plan.isTemplate,
      is_public: plan.public ?? false,
      template_source_id: plan.templateSourceId ?? null,
      plan_date: plan.date ?? null,
      total_duration_min: plan.totalDuration ?? null,
      tags: plan.tags ?? [],
      ratings: plan.ratings ?? {},
      sets: plan.sets ?? [],
      coach_id: coachUid, // verbatim from the frozen param (D-B7/G idiom)
      // coachName denorm dropped (derived on read); timestamps are DB-owned
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updatePracticePlan(id: string, data: Partial<PracticePlan>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.group !== undefined) patch.practice_group = data.group;
  if (data.isTemplate !== undefined) patch.is_template = data.isTemplate;
  if (data.public !== undefined) patch.is_public = data.public;
  if (data.templateSourceId !== undefined) patch.template_source_id = data.templateSourceId;
  if (data.date !== undefined) patch.plan_date = data.date;
  if (data.totalDuration !== undefined) patch.total_duration_min = data.totalDuration;
  if (data.tags !== undefined) patch.tags = data.tags;
  if (data.ratings !== undefined) patch.ratings = data.ratings;
  if (data.sets !== undefined) patch.sets = data.sets;
  if (data.coachId !== undefined) patch.coach_id = data.coachId; // the D-H1 wall denies reassign
  // updated_at is trigger-owned now (the explicit stamp drops)

  const { error } = await supabase.from('practice_plans').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePracticePlan(id: string): Promise<void> {
  const { error } = await supabase.from('practice_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function createDashboardPracticePlanPdf(
  plan: Omit<DashboardPracticePlanPdf, 'id' | 'documentType'>,
): Promise<string> {
  const { data, error } = await supabase
    .from('practice_plans')
    .insert({
      // RH-16: title is NOT NULL and PDF rows never had one — title := filename
      // (harmless, visible nowhere; the PDF card renders filename).
      title: plan.filename,
      document_type: 'dashboard_pdf',
      coach_id: plan.coachId,
      plan_date: plan.date,
      storage_path: plan.storagePath,
      filename: plan.filename,
      uploaded_at:
        plan.uploadedAt instanceof Date ? plan.uploadedAt.toISOString() : new Date().toISOString(),
      size_bytes: plan.sizeBytes,
      page_count: plan.pageCount ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function uploadDashboardPracticePlanPdf(
  uri: string,
  coachId: string,
  date: string,
  filename: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string }> {
  // D-H2a: the private practice-plans bucket. The owner uid is the FIRST path
  // segment — the storage wall checks it (is_staff() AND owner segment); the
  // cutover file copy rewrites this segment through the identity map.
  const storagePath = `${coachId}/${date}/${filename}`;
  await uploadFileToBucket(PRACTICE_PLANS_BUCKET, storagePath, uri, 'application/pdf', onProgress);
  // Reads are fresh signed URLs (the F pattern); nothing persists this URL.
  const downloadUrl = await getSignedFileUrl(PRACTICE_PLANS_BUCKET, storagePath, 3600);
  return { storagePath, downloadUrl };
}

export function subscribeTodayPracticePlan(
  coachId: string,
  callback: (plan: DashboardPracticePlanPdfWithId | null) => void,
): Unsubscribe {
  let live = true;

  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('practice_plans')
      .select(PLAN_SELECT)
      .eq('document_type', 'dashboard_pdf')
      .eq('coach_id', coachId)
      .eq('plan_date', getTodayString())
      .order('uploaded_at', { ascending: false });
    if (!live || error || !data) return;

    // Newest uploadedAt wins — same winner the client sort picked.
    const rows = data as unknown as PlanRow[];
    callback(rows.length > 0 ? rowToPdf(rows[0]) : null);
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`practice_plans:today:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'practice_plans',
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

export async function duplicateAsTemplate(
  plan: PlanWithId,
  coachUid: string,
  coachName: string,
): Promise<string> {
  const { id, createdAt, updatedAt, ...rest } = plan;
  void id;
  void createdAt;
  void updatedAt;
  return addPracticePlan(
    { ...rest, title: `${rest.title} (Template)`, isTemplate: true, coachId: coachUid, coachName },
    coachUid,
  );
}

export function calculateSetYardage(items: PracticePlan['sets'][0]['items']): number {
  return items.reduce((sum, item) => sum + item.reps * item.distance, 0);
}

export function calculateTotalYardage(sets: PracticePlan['sets']): number {
  return sets.reduce((sum, set) => sum + calculateSetYardage(set.items), 0);
}
