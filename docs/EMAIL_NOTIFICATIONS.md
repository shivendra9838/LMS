# Royal Enterprises email notifications

Implementation and verification report — 6 November 2026.

## Implemented

- Shared Nodemailer/Gmail configuration reused from the existing password recovery service. No credentials copied to the frontend, source files, reports, or logs.
- Admin and Employee forgot-password OTP screens. Codes expire after 10 minutes, allow at most five verification attempts, and have a persistent per-account 60-second resend cooldown plus the existing HTTP rate limiter. Only a keyed HMAC is stored; codes are never written to logs. Successful reset consumes the challenge and changes the password/session version atomically, with an audit entry. Existing employee reset links continue working.
- Account email verification in Settings → Preferences → Email notifications. Operational messages require proof of ownership of the current registered email. Changing that email invalidates its previous verification. Recovery/verification codes go only to the active account's registered address and provide that ownership proof.
- Independent preferences for daily collections, overdue reminders, KYC/loan updates, and payment/settlement updates. Security confirmations bypass optional preferences.
- Admin Settings → Preferences → Admin email operations controls category switches, daily reminder time, and unpaid cutoff, in Asia/Kolkata. Employees cannot access this API or edit another account's preferences.
- Consolidated employee reminders read the existing date-aware dashboard/repayment projection. They include customer name, loan numbers, previous overdue, today's remaining unpaid amount and total collectible. No new financial calculation or payment record is introduced. At most one reminder is sent per employee/business day. The cutoff is a one-time fallback when the earlier run had no unpaid dues; it is not a second email after a sent daily reminder. Set the daily reminder time equal to the cutoff if the company wants its one daily message at cutoff.
- Operational delivery follows committed in-app notification/audit events: KYC submission, approval, rejection and correction; customer approval requests/assignment; loan issuance/status changes; customer payment recording and receipt verification; settlement submission, verification, rejection, dispute and reversal; employee account requests. Company-direct funds verification/dispute/reversal emails are explicitly separate from customer receipt review and employee settlement.
- Password reset completion, password change and all-session revocation security emails use committed audit events.
- Shared HTML/plain-text template, original CID-embedded company logo, black/white/gold styling, escaped dynamic text, INR values and authorized portal links. No KYC/private document attachments.
- Persistent outbox with unique event/recipient keys, atomic job claiming, bounded exponential retry for safe transient SMTP failures, delivery status and sanitized failure codes. Recipient activation/ownership and preferences are checked again at dispatch. Existing notifications from before mailbox verification do not trigger a customer-information email backlog.

## Reliability boundaries

SMTP cannot guarantee exactly-once inbox delivery. Stable Message-ID values and unique jobs prevent ordinary duplicates. A crash/timeout after SMTP may have accepted a message is marked UNCERTAIN, rather than blindly resent. Expired sending leases are quarantined the same way. Administrators must check provider evidence before manually retrying an uncertain delivery. Definite permanent SMTP rejection is FAILED; safe connection/4xx failures retry at most five attempts.

OTP messages are sent immediately through the shared transport after the durable hashed challenge is saved. A failed send invalidates the challenge; the user can request another code after cooldown. Plaintext OTPs are not put into the operational outbox, including for retry.

No separate loan-request approval/revision state machine or customer-receipt rejection action exists in the current backend. This change does not invent either financial workflow. Existing loan status updates, KYC rejection, settlement rejection and company-funds disputes are supported. Customer receipt verification remains independent from company funds verification.

## Configuration and controlled delivery

The actual `backend/.env` was inspected using presence checks only. It does not currently contain the required SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM or FRONTEND_URL fields. The current process environment did not provide them either. `backend/.env.email.example` is a template, not active configuration. No credentials were modified.

Fill these fields locally in `backend/.env`, using the existing example:

- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=465 (or 587 with required STARTTLS)
- SMTP_USER=the company sender Gmail address
- SMTP_PASS=the Gmail App Password, entered locally
- SMTP_FROM=Royal Enterprises <the configured sender Gmail address>
- FRONTEND_URL=the trusted website origin (HTTPS in deployment; localhost HTTP is supported locally)

Keep the existing JWT_SECRET persistent; email proof/challenge HMACs are bound to it. Existing MongoDB transaction support is required for OTP reset completion, as it already is for financial workflows.

After configuring SMTP, restart the backend. The user has authorized ONE controlled non-financial test to the configured sender mailbox:

    node backend/scripts/testEmailDelivery.js --send

This script does not connect to MongoDB or modify records. It reports SMTP acceptance without exposing recipient addresses or secrets. Inbox arrival still requires checking the sender mailbox/spam folder manually. It must not be used for bulk tests.

The script was executed during this task and reported NOT_VERIFIED because SMTP configuration is missing. No live test email was sent. Neither Gmail delivery, real OTP delivery, nor rendering inside Gmail/Outlook/real phone mail clients is claimed.

## API additions

- POST /api/v1/auth/employee/otp/request — role ADMIN or EMPLOYEE, registered email; generic asynchronous response.
- POST /api/v1/auth/employee/otp/reset — challenge, six-digit code, matching new passwords.
- GET/PATCH /api/v1/settings/email-preferences — authenticated own-account preferences/status.
- POST /api/v1/settings/email/verify/request — authenticated registered-mailbox verification.
- POST /api/v1/settings/email/verify/confirm — authenticated ownership confirmation.
- GET/PATCH /api/v1/settings/email-operations — Admin only.

The existing /auth/employee/forgot-password and /reset-password endpoints remain available for legacy links. Their names remain unchanged for compatibility; the new OTP request explicitly carries a validated account role.

## Database changes

New collections: EmailJob (delivery metadata, no message bodies/OTPs), EmailControl (activation watermark), EmailChallenge (hashed expiring challenges with TTL index). AccountSettings gains email preferences and current-mailbox verification proof. CompanySettings gains reminder times and category switches. These are additive changes. No migration, reset, financial repair, deletion or sample financial record insertion was performed in the configured database.

## Files changed for this task

Created:
- backend/src/models/EmailJob.js
- backend/src/models/EmailControl.js
- backend/src/models/EmailChallenge.js
- backend/src/services/email.service.js
- backend/src/services/emailWorker.service.js
- backend/src/services/emailTemplate.service.js
- backend/scripts/testEmailDelivery.js
- backend/tests/integration/emailSystem.integration.test.js
- frontend/src/components/EmailPreferences.jsx
- frontend/tests/emailSystem.test.mjs
- docs/EMAIL_NOTIFICATIONS.md

Updated (preserving existing uncommitted work):
- backend/src/models/AccountSettings.js
- backend/src/models/CompanySettings.js
- backend/src/services/passwordRecovery.service.js
- backend/src/routes/passwordRecovery.routes.js
- backend/src/routes/settings.routes.js
- backend/src/server.js
- frontend/src/pages/admin/Login.jsx
- frontend/src/pages/employee/PasswordRecovery.jsx
- frontend/src/pages/shared/Settings.jsx
- frontend/src/App.jsx
- frontend/src/services/api.js

Disposable QA fixture, screenshots and execution logs are under tmp/email-system; the fixture uses isolated MongoMemoryReplSet, synthetic login accounts and a mocked SMTP transport. It creates no financial records. These are verification artifacts, not production application dependencies.

## Verification

- Frontend lint: PASS.
- Production build: PASS.
- Frontend automated tests: 203 PASS.
- Final complete backend run: 46 suites / 421 tests PASS, including 26 email-system regression tests; required coverage gates PASS. An earlier run hit two MongoMemoryServer startup timeouts; all eight affected directory tests passed on rerun and the final complete run passed.
- Browser: Admin and Employee sign-in, own email preference saves, refresh persistence, verification-code request UI, OTP recovery request-to-code/password UI, Admin reminder time update and reload persistence. Admin reminder 10:15 and cutoff 18:00 were confirmed from rendered controls after reload in the disposable environment.
- Responsive browser checks: 320, 375, 390, 430, 768 and 1366 px for Admin/Employee settings, OTP form and email HTML preview; no document horizontal overflow. Mobile email HTML and settings screenshots were visually inspected. No browser console errors were captured. Browser preview is not real mail-client/device testing.
- Configured database ping initially failed inside the network sandbox; the read-only ping passed with normal network access. The updated backend then connected to Atlas and passed HTTP health on port 5000; existing frontend returned HTTP 200 on port 5173. No database access-list/security settings were changed.
- Live SMTP/OTP delivery and real inbox receipt: NOT VERIFIED — active SMTP configuration is missing.

## Manual acceptance steps

1. Configure SMTP locally and restart backend; run the single authorized sender-mailbox test and check inbox/spam.
2. In each portal, open Settings → Preferences → Email notifications, send the verification code and verify the registered address.
3. Choose optional categories; Admin configures reminder times/categories in the same Preferences section.
4. Use a safe test mailbox to exercise Forgot password from either login page. Verify expiration, incorrect-code errors and new-password sign-in; old sessions should be invalid.
5. During normal authorized testing, submit/review KYC, issue/update a loan, record/review a customer receipt and submit/review a settlement. Verify each email links to that exact authorized record and uses the correct payment/settlement wording.
6. Check the consolidated daily reminder against actual outstanding installments, including partial/advance/backdated allocations. Verify no second daily email is sent after restart.
7. Check the template in Android Gmail, iPhone Mail and desktop Gmail. These clients have not been tested here.

QA screenshots: `tmp/email-system/email-template-mobile.png` (browser HTML preview) and `tmp/email-system/admin-email-mobile.png` (Admin controls, before the final removal of employee-only personal reminder switches from Admin preferences).

Additional repository check: the tracked email-related source changes pass Git's normal whitespace check. The repository-wide check still flags line endings in generated frontend/dist/index.html and an existing trailing blank line in frontend/src/pages/employee/Dashboard.jsx; unrelated source content was preserved. These are separate from the passing lint, build and test checks.

## Later verification — separate login portal upgrade, 6 November 2026

Gmail SMTP configuration is now present and validated; the earlier missing-configuration observation above describes the earlier check, not current readiness. The one authorized controlled message to the configured sender mailbox returned SMTP_ACCEPTED (accepted=true). Inbox receipt and a live-account OTP reset remain unverified. Credentials were not changed or exposed.

Admin OTP recovery now uses /api/v1/auth/admin/otp/request and /otp/reset; Employee uses its corresponding /auth/employee paths. The backend fixes the role from the route and ignores a different body.role. Existing employee reset links remain supported. See docs/LOGIN_PORTALS_REDESIGN.md for current role-separation and verification results.
