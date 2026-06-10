// Data layer migrated Firestore -> Supabase (UNIFY/01:import_jobs, Phase H —
// pulled into H by D-H8). Same behavioral contract under the D-H1 walls
// (read = owner or super_admin; writes own; delete super_admin — the
// verbatim Firestore isAdmin()/own rule). storage_path stays a nullable
// vestigial TEXT (RH-13: the only values ever written are the 'manual/...'
// constants; no import FILE has ever existed — absence is parity, D-H2b).
// csvImport + meetResultsImport ride these functions; their jobs-halves
// swap with this file.
import { supabase } from '../config/supabase';
import type { ImportJob } from '../types/firestore.types';

type ImportJobWithId = ImportJob & { id: string };

// Structurally identical to firebase's Unsubscribe (() => void); the data layer
// no longer imports firebase, but the public return type is unchanged.
type Unsubscribe = () => void;

interface JobRow {
  id: string;
  type: ImportJob['type'];
  file_name: string;
  storage_path: string | null;
  status: ImportJob['status'];
  error_message: string | null;
  summary: ImportJob['summary'] | null;
  coach_id: string;
  created_at: string;
  updated_at: string | null;
}

const JOB_SELECT =
  'id, type, file_name, storage_path, status, error_message, summary, coach_id, ' +
  'created_at, updated_at';

const EMPTY_SUMMARY: ImportJob['summary'] = {
  recordsProcessed: 0,
  swimmersCreated: 0,
  swimmersUpdated: 0,
  timesImported: 0,
  errors: [],
};

function rowToJob(row: JobRow): ImportJobWithId {
  return {
    id: row.id,
    type: row.type,
    fileName: row.file_name,
    storagePath: row.storage_path ?? '',
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    summary: row.summary ?? EMPTY_SUMMARY,
    coachId: row.coach_id,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

let channelSeq = 0;

export function subscribeImportJobs(
  coachId: string,
  callback: (jobs: ImportJobWithId[]) => void,
): Unsubscribe {
  let live = true;

  // RH-2: the coachId scope stays a real query param (the D-H1 wall already
  // scopes a coach_admin to own rows; a super_admin sees all — the eq keeps
  // this list the CALLER's, exactly today's query).
  const emit = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('import_jobs')
      .select(JOB_SELECT)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false });
    if (!live || error || !data) return;
    callback((data as unknown as JobRow[]).map(rowToJob));
  };

  void emit(); // immediate first fire, like onSnapshot

  const channel = supabase
    .channel(`import_jobs:${coachId}:${channelSeq++}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'import_jobs', filter: `coach_id=eq.${coachId}` },
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

export async function createImportJob(
  job: Omit<ImportJob, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { data, error } = await supabase
    .from('import_jobs')
    .insert({
      type: job.type,
      file_name: job.fileName,
      storage_path: job.storagePath ?? null, // the vestigial 'manual/...' constants, verbatim
      status: job.status,
      error_message: job.errorMessage ?? null,
      summary: job.summary,
      coach_id: job.coachId, // verbatim from the frozen payload (D-B7/G idiom)
      // created_at is DB-owned; updated_at stays NULL until the first update
      // (canonical nullable column; the house trigger stamps updates)
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateImportJob(jobId: string, updates: Partial<ImportJob>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.fileName !== undefined) patch.file_name = updates.fileName;
  if (updates.storagePath !== undefined) patch.storage_path = updates.storagePath;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.errorMessage !== undefined) patch.error_message = updates.errorMessage;
  if (updates.summary !== undefined) patch.summary = updates.summary;
  if (updates.coachId !== undefined) patch.coach_id = updates.coachId;
  // updated_at is trigger-owned now (the explicit stamp drops)

  const { error } = await supabase.from('import_jobs').update(patch).eq('id', jobId);
  if (error) throw error;
}
