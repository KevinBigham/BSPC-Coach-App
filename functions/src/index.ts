// Phase F: the media pipeline is client-invoked + swept (D-F2). The
// Firestore triggers onAudioUploaded/onVideoUploaded/onDraftReviewed retired
// with the Firestore session docs.
// Phase G: rule evaluation is client-invoked + swept too (D-G1). The
// Firestore attendance trigger (evaluateNotificationRules, dark since C),
// the FCM push sender (onNotificationCreated), and the FCM topic callable
// (manageTopicSubscription) retired — coach notifications are in-app only
// this phase (D-G2), with push a named post-cutover product line item.
// Phase J: the aggregation machinery retired whole (D-J5) — the four
// Firestore triggers (onAttendanceWritten/onTimesWritten/onNotesWritten/
// onVideoSessionWritten, all dark since their sources went write-dead in
// C/D/E/F), the shared dashboardAggregations recompute module, and the
// 4 AM scheduled rebuildAggregations. The Phase J views (00011) compute
// the same aggregates at read time; nothing is scheduled or dispatched.
export { processAudioSession, processVideoSession } from './https/processSession';
export { sweepStuckSessions } from './scheduled/sweepStuckSessions';
export { evaluateAttendanceRules } from './https/evaluateAttendance';
export { sweepAttendanceEvaluations } from './scheduled/sweepAttendanceEvaluations';
export { dailyDigest } from './scheduled/dailyDigest';
export { redeemInvite } from './callable/redeemInvite';
export { getParentPortalDashboard, getParentSwimmerPortalData } from './callable/parentPortal';
export { syncCalendar } from './scheduled/syncCalendar';
