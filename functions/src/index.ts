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
//
// Initial v1 launch surface: exactly the two ratified schedulers below.
// Deferred Functions remain in source and tests, but are not exported for
// deployment until a later explicit launch decision.
export { sweepAttendanceEvaluations } from './scheduled/sweepAttendanceEvaluations';
export { dailyDigest } from './scheduled/dailyDigest';
