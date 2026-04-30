---
name: Security review
about: Request a privacy or security review without disclosing sensitive details
title: "[Security Review]: "
labels: security
assignees: ""
---

## Scope

What area needs review?

- [ ] Firebase Auth
- [ ] Firestore rules
- [ ] Storage rules
- [ ] Cloud Functions callable or trigger
- [ ] Parent portal access
- [ ] Parent invites
- [ ] Notifications or FCM topics
- [ ] Media consent, audio, or video
- [ ] Secrets or environment variables
- [ ] Other

## Concern

Describe the concern at a high level. Do not include exploit details, private records, tokens, invite codes, or identifiable swimmer/family data in a public issue.

## Data Sensitivity

- [ ] No private data involved
- [ ] May involve minors' data
- [ ] May involve family or contact data
- [ ] May involve credentials or deployment secrets
- [ ] Unsure

## Private Disclosure Needed

- [ ] This may require private vulnerability disclosure instead of a public issue.

If this may be exploitable, stop here and use the reporting guidance in `SECURITY.md`.
