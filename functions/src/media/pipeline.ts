// Phase F (D-F2): the AI pipeline cores, ported from the retired Firestore
// document triggers (onAudioUploaded / onVideoUploaded). Sessions/drafts live
// on canonical Postgres; recordings live in Supabase Storage (D-F1). Each
// core gates on status === 'uploaded', which makes it idempotent and safe to
// invoke from BOTH the client kick and the scheduled sweeper — a session
// already in flight (or done) is a no-op.
//
// The >20MB video path keeps Vertex's gs:// requirement satisfied with a
// TRANSIENT Google-storage staging copy (streamed, never buffered whole;
// deleted after analysis). Code-side only — no live file ever moves in F.
import * as admin from 'firebase-admin';
import { supabase } from '../config/supabase';
import { extractObservations } from '../ai/extractObservations';
import { getVideoAnalysisPrompt, type VideoPromptSwimmer } from '../ai/videoPrompts';
import { SWIMMING_GLOSSARY, DRILL_LIBRARY } from '../ai/swimKnowledge';

if (!admin.apps.length) admin.initializeApp();

const INLINE_VIDEO_LIMIT = 20 * 1024 * 1024;

const VALID_TAGS = [
  'technique',
  'freestyle',
  'backstroke',
  'breaststroke',
  'butterfly',
  'IM',
  'starts',
  'turns',
  'underwaters',
  'breakouts',
  'kick',
  'pull',
  'drill',
  'endurance',
  'speed',
  'race strategy',
  'mental',
  'attendance',
  'general',
];

const VALID_PHASES = ['stroke', 'turn', 'start', 'underwater', 'breakout', 'finish', 'general'];

interface AudioSessionRow {
  id: string;
  storage_path: string | null;
  practice_group: string | null;
  status: string;
}

interface VideoSessionRow {
  id: string;
  storage_path: string | null;
  practice_group: string | null;
  status: string;
}

async function setAudioSession(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('audio_sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
}

async function setVideoSession(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('video_sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
}

export async function processAudioSessionById(sessionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('audio_sessions')
    .select('id, storage_path, practice_group, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return; // unknown session: no-op (sweeper-safe)

  const session = data as AudioSessionRow;
  // Idempotency gate: only an 'uploaded' session starts the pipeline.
  if (session.status !== 'uploaded' || !session.storage_path) return;

  try {
    await setAudioSession(sessionId, { status: 'transcribing' });

    // Download the recording from the media-audio bucket (service role).
    const { data: blob, error: dlError } = await supabase.storage
      .from('media-audio')
      .download(session.storage_path);
    if (dlError || !blob) throw dlError ?? new Error('audio download failed');
    const audioBuffer = Buffer.from(await blob.arrayBuffer());

    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertexAi = new VertexAI({
      project: process.env.GCLOUD_PROJECT || '',
      location: 'us-central1',
    });
    const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const audioBase64 = audioBuffer.toString('base64');

    // Build swimming-aware transcription prompt
    const glossaryStr = SWIMMING_GLOSSARY.slice(0, 20)
      .map((g) => `${g.term}: ${g.definition}`)
      .join('; ');
    const drillNames = DRILL_LIBRARY.map((d) => d.name).join(', ');

    const transcriptionPrompt = `Transcribe this swim coaching audio recording accurately.

CONTEXT: This is a poolside coaching session. Expect background noise including pool echoes, whistle blows, splashing water, and multiple overlapping conversations. Focus on the coach's primary voice.

SWIMMING VOCABULARY — these terms may appear:
${glossaryStr}

COMMON COACHING ABBREVIATIONS: DPS, UDK, IM, EVF, EZ, SCY, LCM, SCM, PR (personal record), AA (All-American), AG (age group), USS (USA Swimming)

DRILL NAMES the coach may reference: ${drillNames}

INSTRUCTIONS:
- Capture all swimmer names mentioned (first names, last names, or nicknames)
- Preserve stroke names (freestyle, backstroke, breaststroke, butterfly, IM)
- Note specific distances (50, 100, 200, etc.) and intervals (e.g., "on the 1:30")
- Include coaching cues and technique corrections verbatim
- Mark unclear segments with [inaudible] rather than guessing
- Return the full transcription text as a single string`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/mp4', data: audioBase64 } },
            { text: transcriptionPrompt },
          ],
        },
      ],
    });

    const transcription = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!transcription) {
      await setAudioSession(sessionId, { status: 'failed', error_message: 'Empty transcription' });
      return;
    }

    await setAudioSession(sessionId, { transcription, status: 'extracting' });

    // The selection lives in the P1-4 junction now.
    const { data: junction } = await supabase
      .from('audio_session_swimmers')
      .select('swimmer_id')
      .eq('session_id', sessionId);
    const selectedSwimmerIds = ((junction ?? []) as { swimmer_id: string }[]).map(
      (r) => r.swimmer_id,
    );

    await extractObservations(
      sessionId,
      transcription,
      session.practice_group,
      selectedSwimmerIds.length > 0 ? selectedSwimmerIds : undefined,
    );

    await setAudioSession(sessionId, { status: 'review' });
  } catch (err: unknown) {
    console.error('Audio processing error:', err);
    const errorMessage = err instanceof Error && err.message ? err.message : 'Unknown error';
    await setAudioSession(sessionId, { status: 'failed', error_message: errorMessage }).catch(
      () => undefined,
    );
  }
}

export async function processVideoSessionById(sessionId: string): Promise<void> {
  const { data, error } = await supabase
    .from('video_sessions')
    .select('id, storage_path, practice_group, status')
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) return;

  const session = data as VideoSessionRow;
  if (session.status !== 'uploaded' || !session.storage_path) return;

  try {
    await setVideoSession(sessionId, { status: 'analyzing' });

    // RF-10 closed: swimmer names resolve from canonical Postgres through the
    // kind-discriminated junction ('selected' set, falling back to 'tagged').
    const { data: junctionData, error: junctionError } = await supabase
      .from('video_session_swimmers')
      .select('swimmer_id, kind, swimmer:swimmers(first_name, last_name)')
      .eq('session_id', sessionId);
    if (junctionError) throw junctionError;
    const junction = (junctionData ?? []) as unknown as {
      swimmer_id: string;
      kind: 'tagged' | 'selected';
      swimmer: { first_name: string | null; last_name: string | null } | null;
    }[];
    const pickKind = junction.some((r) => r.kind === 'selected') ? 'selected' : 'tagged';
    const selectedSwimmers: VideoPromptSwimmer[] = junction
      .filter((r) => r.kind === pickKind && r.swimmer)
      .map((r) => ({
        id: r.swimmer_id,
        displayName: `${r.swimmer?.first_name ?? ''} ${r.swimmer?.last_name ?? ''}`.trim(),
      }));

    // Size check via a signed URL HEAD — the file is only pulled whole when
    // it fits the inline path.
    const { data: signed, error: signError } = await supabase.storage
      .from('media-video')
      .createSignedUrl(session.storage_path, 600);
    if (signError || !signed) throw signError ?? new Error('video sign failed');
    const signedUrl = (signed as { signedUrl: string }).signedUrl;

    const head = await fetch(signedUrl, { method: 'HEAD' });
    const fileSize = parseInt(head.headers.get('content-length') || '0', 10) || 0;
    const mimeType = head.headers.get('content-type') || 'video/mp4';

    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertexAi = new VertexAI({
      project: process.env.GCLOUD_PROJECT || '',
      location: 'us-central1',
    });
    const model = vertexAi.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = getVideoAnalysisPrompt(selectedSwimmers, session.practice_group || undefined);

    let result;
    let stagingFile: {
      createWriteStream: (opts: { contentType: string }) => NodeJS.WritableStream;
      delete: () => Promise<unknown>;
    } | null = null;
    try {
      if (fileSize < INLINE_VIDEO_LIMIT) {
        // Small video: pull whole and send inline as base64
        const response = await fetch(signedUrl);
        const videoBuffer = Buffer.from(await response.arrayBuffer());
        const videoBase64 = videoBuffer.toString('base64');

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ inlineData: { mimeType, data: videoBase64 } }, { text: prompt }],
            },
          ],
        });
      } else {
        // Large video: Vertex requires a gs:// URI — stream a TRANSIENT
        // staging copy into Google storage, analyze, then delete it.
        const bucket = admin.storage().bucket();
        stagingFile = bucket.file(`vertex-staging/${sessionId}.mp4`);
        const response = await fetch(signedUrl);
        if (!response.ok || !response.body) throw new Error('video stream failed');
        const { Readable } = await import('node:stream');
        const { pipeline } = await import('node:stream/promises');
        await pipeline(
          Readable.fromWeb(response.body as never),
          stagingFile.createWriteStream({ contentType: mimeType }),
        );
        const gcsUri = `gs://${bucket.name}/vertex-staging/${sessionId}.mp4`;

        result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ fileData: { fileUri: gcsUri, mimeType } }, { text: prompt }],
            },
          ],
        });
      }
    } finally {
      // transient by contract — never outlives the analysis
      if (stagingFile) await stagingFile.delete().catch(() => undefined);
    }

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!responseText) {
      await setVideoSession(sessionId, { status: 'failed', error_message: 'Empty AI response' });
      return;
    }

    // Parse JSON response (extract from potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    type AiObservation = {
      swimmerName?: string;
      observation?: string;
      diagnosis?: string;
      drillRecommendation?: string;
      phase?: string;
      tags?: string[];
      confidence?: number;
    };

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(jsonStr);
    } catch {
      const arrMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        parsedUnknown = JSON.parse(arrMatch[0]);
      } else {
        await setVideoSession(sessionId, {
          status: 'failed',
          error_message: 'Could not parse AI response as JSON',
        });
        return;
      }
    }

    const observations: AiObservation[] = Array.isArray(parsedUnknown)
      ? (parsedUnknown as AiObservation[])
      : [];

    if (observations.length === 0) {
      await setVideoSession(sessionId, { status: 'review' });
      return;
    }

    // Swimmer name -> id map over the selected set (verbatim matching rules).
    const nameToId: Record<string, string> = {};
    for (const swimmer of selectedSwimmers) {
      nameToId[swimmer.displayName.toLowerCase()] = swimmer.id;
      const firstName = swimmer.displayName.split(' ')[0];
      if (firstName) nameToId[firstName.toLowerCase()] = swimmer.id;
    }

    const draftRows: Record<string, unknown>[] = [];
    for (const obs of observations) {
      const swimmerNameLower = (obs.swimmerName || '').toLowerCase();
      const matchedId =
        nameToId[swimmerNameLower] ||
        Object.entries(nameToId).find(
          ([name]) => swimmerNameLower.includes(name) || name.includes(swimmerNameLower),
        )?.[1];

      if (!matchedId) continue;

      // The DB CHECK domains are law now — out-of-domain AI output is
      // coerced the way extractObservations always filtered tags.
      const tags = (obs.tags || []).filter((t) => VALID_TAGS.includes(t));
      const phase = obs.phase && VALID_PHASES.includes(obs.phase) ? obs.phase : 'general';

      draftRows.push({
        session_id: sessionId,
        swimmer_id: matchedId,
        observation: obs.observation || '',
        diagnosis: obs.diagnosis || '',
        drill_recommendation: obs.drillRecommendation || '',
        phase,
        tags: tags.length > 0 ? tags : ['technique'],
        confidence: typeof obs.confidence === 'number' ? obs.confidence : 0.7,
        // swimmerName denorm dropped — derived on read; created_at DB-owned
      });
    }

    if (draftRows.length > 0) {
      const { error: insertError } = await supabase.from('video_session_drafts').insert(draftRows);
      if (insertError) throw insertError;
    }

    await setVideoSession(sessionId, { status: 'review' });
  } catch (err: unknown) {
    console.error('Video processing error:', err);
    const errorMessage = err instanceof Error && err.message ? err.message : 'Unknown error';
    await setVideoSession(sessionId, { status: 'failed', error_message: errorMessage }).catch(
      () => undefined,
    );
  }
}
