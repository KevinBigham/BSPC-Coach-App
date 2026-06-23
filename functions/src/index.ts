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
// Launch export surface (Proposal A — Director Ruling 09): the initial v1
// deploy exports EXACTLY the two scheduled functions below. The eight other
// functions — processAudioSession, processVideoSession, sweepStuckSessions,
// evaluateAttendanceRules, redeemInvite, getParentPortalDashboard,
// getParentSwimmerPortalData, and syncCalendar — remain in the source tree,
// fully built and tested, but are intentionally NOT exported here, so they
// are not provisioned at launch. They return only by an explicit later
// ruling. This export set is pinned by __tests__/launchExportSurface.test.ts.
export { sweepAttendanceEvaluations } from './scheduled/sweepAttendanceEvaluations';
export { dailyDigest } from './scheduled/dailyDigest';
