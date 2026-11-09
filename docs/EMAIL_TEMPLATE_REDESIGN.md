# Royal Enterprises shared transactional email redesign

Implemented 7 November 2026. Reused the existing Gmail transport, OTP service, persistent email jobs, recipient verification, authorization checks, preferences and notification/audit triggers.

## Original logo — unchanged

The header embeds the existing backend/assets/royal-enterprises-emblem.png as an inline CID attachment (cid:royal-logo). This is the existing company emblem artwork also used by the website; no Slice artwork or reference-image “R” logo was introduced. The emblem is proportionally contained with height:auto, without an extra image border/background box. The brand name and tagline remain text for readability when a client hides images.

Both existing asset SHA-256 hashes were checked before/after:

- Emblem PNG: 0d667a6fab069f7eec345e1146a0816c76a4eee1e22f8005be0415931ca2405b
- Full logo JPEG: 22c63c12c3ddded64299640477f34d0148510f41ae1e9d4d9988c244abbc11cf

No logo asset was edited, replaced, regenerated or resized on disk. Outgoing images use CID, never localhost/public storage URLs.

## Shared design and content

- Table-based, inline-styled email card up to 600px, charcoal/black backgrounds, white text and restrained gold accents.
- Outlook conditional-width fallback, explicit background/text colors, system fonts, small-screen styling, touch-sized action buttons and readable plain text.
- Actual recipient name, event heading, explanation, highlighted detail table or six-digit OTP, guidance and branded sign-off/footer.
- OTPs use the real saved challenge expiry, formatted in Asia/Kolkata; code hashing, expiry, attempt limits and cooldown logic remain unchanged.
- Payment details use authorized real receipt context: amount, customer, loan, receipt, received date, mode and receipt-review status. Company settlement is explicitly separate.
- KYC, loan and settlement details are read from the existing authorized source record after notification-target authorization. Missing data is not replaced by invented customer or financial information.
- Consolidated reminders retain existing collection calculations/preferences/deduplication and add available schedule due dates. Compact HTML avoids unnecessary markup overhead for larger reminders.
- Dynamic values are escaped in HTML. No credentials, real OTPs or customer documents are added to logs or attachments.

## Existing emails using the design

- Password reset OTP and account email verification OTP.
- Password-reset/password-change/security confirmations.
- KYC/customer request submission, approval, rejection and correction messages.
- Loan issuance and existing loan status events.
- Customer payment recording and Admin receipt review.
- Company-direct funds review.
- Daily collection/overdue reminders.
- Settlement submission, verification, rejection, dispute and reversal events.
- Existing employee account-request messages and other emails dispatched by the common service.
- The legacy employee password-reset link email now has HTML plus plain-text output through the same template.

No unsupported payment reversal, loan-approval, customer-facing or account-lifecycle trigger was invented. Existing trigger availability, recipients and security rules remain authoritative.

## Public URL setup

The user confirmed there is no public LMS URL yet. Outgoing HTML and text omit local/private/non-HTTPS action links. Operational emails remain useful and direct users to sign in manually. OTP verification/password reset continues without needing a portal link in the email.

The legacy token-link reset endpoint now reports a clear setup error when no public HTTPS origin is configured, instead of emailing an unusable development link. Existing token hashing/expiry/consumption and password validation are preserved for a valid public origin. Its integration tests use an HTTPS test portal and continue exercising the original security behavior.

When deployed, set FRONTEND_URL to the actual public HTTPS frontend origin and restart the backend. Applicable action buttons will then appear using the existing authorized portal paths. No public URL was invented and no .env credential was changed.

## Verification

- Generated eight synthetic HTML/plain-text previews: reset OTP, verification OTP, KYC, payment, overdue reminder, settlement, security action and long-field stress case.
- Browser checks: eight templates at 320, 375, 390, 430, 600 and 1280px (48 checks). No horizontal overflow or missing logo; maximum card width 600px. Original image aspect ratio retained. Action button height exceeded 44px at 320px.
- Visually inspected OTP mobile/desktop, payment mobile, overdue mobile and settlement previews. Browser console had no warnings/errors.
- One controlled non-sensitive message with the redesigned template and original CID emblem was sent only to the previously authorized configured sender mailbox. Gmail SMTP accepted it. Inbox receipt/rendering was not independently verified.
- Added renderer regressions for original-asset integrity, responsive/table markup, exact OTP expiry, escaping, HTML/plain text, private-URL suppression and larger reminder output.
- Retained the existing authorization, OTP, retry, preference, stale-assignment and duplicate-email tests.

Preview screenshots and logs: tmp/email-redesign/.

## Files changed

- backend/src/services/emailTemplate.service.js
- backend/src/services/email.service.js
- backend/src/services/emailWorker.service.js
- backend/src/services/passwordRecovery.service.js
- backend/src/routes/passwordRecovery.routes.js
- backend/tests/unit/emailTemplate.test.js
- backend/tests/integration/emailSystem.integration.test.js
- backend/tests/integration/passwordRecovery.integration.test.js
- docs/EMAIL_TEMPLATE_REDESIGN.md

No frontend application source, company artwork, financial calculations or configured MongoDB customer/loan/payment/settlement records were modified. Browser previews and automated tests used synthetic data; no bulk test emails were sent.

## Email-client limits / manual acceptance

Browser previews do not prove rendering inside Gmail/Outlook/Apple Mail. Check the controlled message in Gmail desktop and Android/iPhone mail apps, with images enabled/disabled and light/dark display. Outlook desktop may render square corners and simplify styles; tables, text and action links have fallbacks. Exact forced dark-mode color inversion remains client-controlled. A valid public HTTPS frontend origin is the remaining setup requirement for email action links.

## Final executed results

- Backend: PASS — 49 suites, 458 tests, with required coverage thresholds.
- Frontend lint: PASS.
- Frontend production build: PASS.
- Syntax checks for all changed backend modules: PASS.
- Gmail controlled test: SMTP_ACCEPTED; inbox receipt/rendering NOT VERIFIED independently.
- Verified local backend restarted to load the new template; health returned OK.

The initial full run had one new regression failing because it ran after the deliberate rate-limit exhaustion test. The setup check was moved before that stress case; no rate limiter, authentication, OTP or test assertion was disabled. The final full run passed.
