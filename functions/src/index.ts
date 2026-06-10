// Phase F: the media pipeline is client-invoked + swept (D-F2). The
// Firestore triggers onAudioUploaded/onVideoUploaded/onDraftReviewed retired
// with the Firestore session docs; onVideoSessionWritten remains exported but
// its subject collection no longer receives writes — it goes to Phase J with
// the rest of the aggregation machinery (the D-C1(b)/D-D1 family).
// Phase G: rule evaluation is client-invoked + swept too (D-G1). The
// Firestore attendance trigger (evaluateNotificationRules, dark since C),
// the FCM push sender (onNotificationCreated), and the FCM topic callable
// (manageTopicSubscription) retired — coach notifications are in-app only
// this phase (D-G2), with push a named post-cutover product line item.
export { processAudioSession, processVideoSession } from './https/processSession';
export { sweepStuckSessions } from './scheduled/sweepStuckSessions';
export { evaluateAttendanceRules } from './https/evaluateAttendance';
export { sweepAttendanceEvaluations } from './scheduled/sweepAttendanceEvaluations';
export { dailyDigest } from './scheduled/dailyDigest';
export { redeemInvite } from './callable/redeemInvite';
export { getParentPortalDashboard, getParentSwimmerPortalData } from './callable/parentPortal';
export { onAttendanceWritten } from './triggers/onAttendanceWritten';
export { onTimesWritten } from './triggers/onTimesWritten';
export { onNotesWritten } from './triggers/onNotesWritten';
export { onVideoSessionWritten } from './triggers/onVideoSessionWritten';
export { rebuildAggregations } from './scheduled/rebuildAggregations';
export { syncCalendar } from './scheduled/syncCalendar';
