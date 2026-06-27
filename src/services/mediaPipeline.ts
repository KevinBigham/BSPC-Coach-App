// Proposal C (Director Ruling 28/29): media AI processing is disabled in v1.
// The client-invoke chokepoint is retained as an unconditional no-op so call
// sites and the exported signature are unchanged, but no session is ever sent
// for AI processing: no fetch, no configuration read, no logging, no flag.
export async function requestSessionProcessing(
  kind: 'audio' | 'video',
  sessionId: string,
): Promise<void> {
  void kind;
  void sessionId;
}
