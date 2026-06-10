// Phase F (D-F2): the AI pipeline is client-invoked over HTTPS — the
// Firestore status-flip triggers died with the Firestore session docs, and
// the scheduled sweeper re-invokes anything that slips through. Both values
// come from app config; the shared secret is deliberately absent from source.
export const PROCESS_FUNCTIONS_BASE_URL = process.env.EXPO_PUBLIC_PROCESS_FUNCTIONS_BASE_URL ?? '';
export const PROCESS_SHARED_SECRET = process.env.EXPO_PUBLIC_PROCESS_SHARED_SECRET ?? '';
