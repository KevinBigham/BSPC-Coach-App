# Privacy Policy

**BSPC Coach App**
Last updated: April 4, 2026

## Overview

The BSPC Coach App ("the App") is a swim coaching management tool built by Blue Springs Power Cats. This policy describes how we collect, use, and protect your information.

## Information We Collect

### Account Information
- Email address and display name (required for coach accounts)
- Authentication credentials (managed by Firebase Authentication)

### Swimmer Data
- Names, dates of birth, gender, and group assignments
- Swim times, meet results, and performance records
- Attendance records and practice participation
- Coach-authored notes and observations
- Medical information (entered by coaches, encrypted at rest)

### Parent/Guardian Data
- Contact information (name, email, phone) linked to swimmer profiles
- Parent portal login credentials

### Usage Data
- App interaction data for improving the user experience
- Crash reports and error logs (via structured logging)
- Device information necessary for push notifications (FCM tokens)

### Audio and Video
- Practice audio recordings (for AI-assisted note generation)
- Swim technique videos (for AI-assisted analysis)
- These files are stored in Firebase Cloud Storage and are accessible only to authenticated coaches

## How We Use Your Information

- Manage swimmer rosters, attendance, and performance tracking
- Generate AI-assisted coaching observations and drill recommendations
- Send push notifications for daily digests, AI draft readiness, and custom alerts
- Provide analytics and reporting on team and individual performance
- Enable parent access to their child's swim data via the parent portal

## Data Storage and Security

- All data is stored in Google Firebase (Firestore, Cloud Storage, Authentication)
- Data is encrypted in transit (TLS) and at rest (Google Cloud encryption)
- Access is restricted by Firebase Security Rules to authenticated coaches and linked parents
- Medical information is stored in a separate Firestore subcollection with additional access restrictions

## Data Sharing

We do not sell, trade, or share personal information with third parties except:
- Google Firebase (infrastructure provider, subject to Google's privacy policies)
- Google Vertex AI (for AI-powered coaching features, subject to Google's AI data policies)
- As required by law

## Data Retention

- Account data is retained as long as the account is active
- Swimmer data is retained as long as the swimmer is in the system (active or inactive)
- Audio and video recordings can be deleted by coaches at any time
- Account deletion requests can be made by contacting the team administrator

## Children's Privacy

The App is designed for use by adult coaches and parents. Swimmer data (including data about minors) is entered and managed by authorized coaches and is not directly collected from children.

## Your Rights

You may request to:
- Access your personal data
- Correct inaccurate data
- Delete your account and associated data
- Export your data

Contact us at the email below to exercise these rights.

## Changes to This Policy

We may update this policy periodically. Changes will be posted in the App and on our website.

## Contact

For questions about this privacy policy or data practices:
Blue Springs Power Cats
Email: privacy@bspowercats.com
