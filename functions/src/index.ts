// Phase F: the media pipeline is client-invoked + swept (D-F2). The
// Firestore triggers onAudioUploaded/onVideoUploaded/onDraftReviewed retired
// with the Firestore session docs; onVideoSessionWritten remains exported but
// its subject collection no longer receives writes — it goes to Phase J with
// the rest of the aggregation machinery (the D-C1(b)/D-D1 family).
export { processAudioSession, processVideoSession } from './https/processSession';
export { sweepStuckSessions } from './scheduled/sweepStuckSessions';
export { onNotificationCreated } from './triggers/onNotification';
export { dailyDigest } from './scheduled/dailyDigest';
export { redeemInvite } from './callable/redeemInvite';
export { getParentPortalDashboard, getParentSwimmerPortalData } from './callable/parentPortal';
export { manageTopicSubscription } from './callable/manageTopics';
export { onAttendanceWritten } from './triggers/onAttendanceWritten';
export { onTimesWritten } from './triggers/onTimesWritten';
export { onNotesWritten } from './triggers/onNotesWritten';
export { onVideoSessionWritten } from './triggers/onVideoSessionWritten';
export { evaluateNotificationRules } from './triggers/evaluateNotificationRules';
export { rebuildAggregations } from './scheduled/rebuildAggregations';
export { syncCalendar } from './scheduled/syncCalendar';
