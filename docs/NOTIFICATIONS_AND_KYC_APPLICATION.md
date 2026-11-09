# Live notifications and printable customer applications

## Delivered behavior

- Both portal headers have a persisted notification inbox with unread count, read/unread controls, unread filtering, pagination, mark-all-read, and links to existing authorized pages. Opening a notification refreshes the destination even if that record was already open.
- Live updates use authenticated fetch-based SSE. JWTs stay in Authorization headers, never query strings. Streams recheck JWT expiry, account activity and authVersion, close revoked sessions, send heartbeats and reconnect with backoff. Compression/proxy buffering is disabled for the stream. Each account may have up to five concurrent streams per server process.
- The dispatcher reads committed audit events every two seconds. A persistent activation boundary avoids replaying pre-installation history. A durable processed-event ledger and unique recipient/role/event key support retries and reconnects without duplicate inbox records. The audit anti-join also catches transactions committed out of creation order. Database errors retry without changing financial records.
- Existing events covered: KYC and legacy customer submissions/reviews, loan issuance/status changes, actual payments, settlement submission/verification/rejection/dispute/reversal, and employee account requests/reviews. Current authorized owners receive Employee links; active Admins receive management links. Notification text contains no identity numbers, receiving-account details, document bytes, or review remarks; those remain behind the authorized details view.
- IST daily summaries cover unpaid overdue installments, today's installments and tomorrow's upcoming installments separately. Paid installments are excluded; matured loans with unpaid balances remain eligible. Alerts only read schedules and balances.
- Optional notification panels respect the existing account preference under Settings > Preferences. This does not suppress financial validations or payment confirmations.
- There is no separate loan-request approval model in this LMS. Existing loan issuance/status events are covered; no new financial approval workflow was invented.

## Customer application

Employee: **Customers > Customer KYC > open a saved KYC > Preview Form**, **Download PDF**, or **Print Form**.

Admin: **Customer Approvals > open KYC > View Complete Application Form**. The same view is available from customer KYC details and notification links.

The application is a generated A4 document, rendered with the existing authenticated PDF.js viewer. It uses the original company artwork, ruled labeled fields, the collected customer photo, every field from the current KYC field schema, both customer references, a document manifest, existing declaration text, customer signature and blank office-verification area. Missing values are N/A. References are not relabeled as guarantors or nominees, because those separate relationships are not collected by the existing form.

All pages have 12.7 mm internal margins, page numbers and continuation headings. Long values wrap without truncation; embedded fonts support existing English/Hindi data. The PDF font runtime also fixes a Hindi shaping failure in the original KYC bundle exporter. The populated integration fixture produces four A4 pages, all visually reviewed after generation.

The version selector shows saved submission versions. **View Uploaded Documents** loads the documents belonging to that selected version using the existing secure document endpoint, rather than silently showing replacement files from the current draft. Both portals generate from the same encrypted snapshot. A draft with no snapshot is explicitly labeled as the current saved form.

The existing detailed website form, approval/rejection/correction controls and original reference-form PDF with document attachments remain available. The original exporter is under **Original KYC bundle**; the new application PDF contains the paper form and photo/signature, with full document files available through the secure viewer or original bundle.

## Persistence and authorization

New additive collections:

- `usernotifications`: recipient, role, unique event key, generic title/message, internal route, read state and timestamps.
- `notificationdispatches`: activation boundary and processed audit identifiers, allowing restart recovery.
- `kycsubmissions`: lead/version, encrypted form bytes, immutable document references, submission timestamp and snapshot provenance. Snapshots are inserted within the existing KYC submission transaction. Repeated capture never updates an existing snapshot or its timestamps.

Old approved/pending forms are preserved when entering a new revision or review if needed. Previously lost historical versions cannot be reconstructed. Such legacy snapshots are clearly labeled; no original submission date or missing value is fabricated. No bulk backfill or destructive migration is run.

All KYC endpoints retain existing Admin/Employee authorization, current customer ownership checks, no-store responses and encryption. Historical document access requires a current authorized relationship to that same lead. Public, cross-employee and cross-lead document/application access remains denied. Application exports log the actual requested submission ID/version without recording KYC values.

New endpoints, relative to `/api/v1`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/notifications/inbox?page=1&unread=true` | Own notification page and unread count |
| PATCH | `/notifications/inbox/:id` | Own read/unread state (`unread` boolean) |
| POST | `/notifications/inbox/read-all` | Mark own notifications read |
| GET | `/notifications/stream` | Bearer-authenticated SSE invalidations |
| GET | `/kyc/:id/applications` | Authorized immutable version metadata |
| GET | `/kyc/:id/application/pdf?revision=<snapshotId>` | A4 application for that lead/version |
| GET | `/kyc/:id/application/documents?revision=<snapshotId>` | That version's authorized document metadata |

The existing `/notifications` Admin missed-payment endpoint, `/kyc/:id/pdf`, document endpoints, and financial endpoints remain in place. Settlement links use `?settlement=<id>` to open the existing authorized history/proof view regardless of the currently selected reporting period.

## Changed implementation files

Backend:

- `src/models/UserNotification.js`, `NotificationDispatch.js`, `KycSubmission.js`
- `src/services/inbox.service.js`, `kycApplication.service.js`, `kycApplicationPdf.service.js`
- `src/services/kyc.service.js`, `kycPdf.service.js`, `customerLead.service.js`
- `src/routes/notification.routes.js`, `kyc.routes.js`, `src/app.js`, `src/server.js`
- `assets/royal-enterprises-logo.jpg` (encoding conversion of the existing original artwork)
- `package.json`, `package-lock.json`: PDF font runtime and compatible body-parser security patch within Express's existing dependency range. The install audit reported zero vulnerabilities afterward.
- `tests/integration/inbox.integration.test.js`, `kyc.integration.test.js`

Frontend:

- `src/components/NotificationBell.jsx`, `notification-bell.css`, `KycApplication.jsx`, `KycPdfPreview.jsx`
- `src/layouts/PortalShell.jsx`
- `src/pages/shared/CustomerKyc.jsx`, `DailySettlement.jsx`

No loan calculations, customer/payment/settlement balances or historical financial transactions were changed.

## Verification

- Full backend: 22 suites / 191 tests passed; existing coverage thresholds passed.
- Frontend: 19 existing tests passed; ESLint and production Vite build passed. Build output is isolated under `tmp/notifications-application-final-build` so existing checked-in build artifacts were not overwritten.
- Notification integration: authentication, role scoping, recipient ownership, read/unread, read-all, deduplication, rollback exclusion, late commits, authenticated uncompressed SSE, live invalidations, session revocation, date categories and financial/request deep links.
- Application integration: all submitted revisions encrypted, original values retained after corrections/replacement uploads, stable snapshot timestamps, Admin/Employee equality, cross-lead/cross-employee/public access denial, historical document membership, PDF generation and A4 page sizes.
- Browser on a disposable local replica set: Admin notifications arrived without refresh; read-all/unread controls and KYC navigation worked. Employee revised/submitted a form; an Admin correction arrived live and opened refreshed remarks. Version selection, PDF page navigation, secure document viewing and application download succeeded.
- Forty responsive measurements: both portals, inbox and application preview, each at 320, 375, 390, 430, 480, 768, 1024, 1280, 1440 and 1920 px. No page horizontal overflow. A cramped 320 px version selector was corrected and rechecked.
- Print action invoked the print flow. The system print dialog was not inspectable through automation, so actual printed output is NOT VERIFIED. Physical Android/tablet device testing was not performed.
- All synthetic accounts, KYC forms and financial fixtures were confined to disposable local MongoDB/test replica sets. No synthetic records were written to Atlas. The disposable browser servers were stopped after verification.
- Before implementation, an encrypted backup of 25 collections / 161 documents was created and validated by authenticated decryption, gzip expansion, SHA-256 comparison and BSON decoding. No restore was performed. After activation, comparison confirmed every pre-existing record was byte-identical and none missing; 11 appended audit records were present. No database reset, repair, or deletion was run.

Evidence: `docs/screenshots/notifications-application/` contains isolated-data desktop application and live inbox/mobile screenshots. Test logs, layout measurements and the preservation comparison are under ignored `tmp/financial-audit/`.

## Manual acceptance

1. Open the running LMS at `http://127.0.0.1:5173`, sign into each existing portal, and confirm the bell is visible. If disabled, enable optional panels under Settings > Preferences.
2. Submit your own test KYC in Employee. Keep Admin open and confirm the new notification arrives, then open it.
3. Preview the application in both portals. Compare the version, fields and photo, download the application PDF, and view uploaded documents.
4. Request corrections in Admin. Confirm the Employee alert opens the corrected status and remarks. Submit a revised form and select the earlier version to confirm it has retained its submitted data/documents.
5. Print on A4, inspect margins/page breaks/signature areas, and check photo orientation and Hindi text with your own existing uploads. Test Android file selection, pinch/zoom behavior, browser print/share and download handling on a physical phone.
6. During your normal test workflows, confirm loan/payment/settlement notifications open the corresponding existing authorized details. Notification delivery does not create payments or settle funds.

## Verification refresh - 27 October 2026

The existing implementation was reused, including the later Admin black-and-gold UI adjustments. This pass fixed these reproduced edge cases:

- A valid 500-character multiline field could extend below an A4 page. Long rows now continue across pages with repeated field labels and consistent margins. A 100-line synthetic address was rendered, visually reviewed on all six resulting pages, and text-extracted to confirm all 100 lines remain present.
- A transient database error on an established SSE connection was being labeled as session revocation, preventing automatic recovery. It now sends a reconnect signal. Invalid/expired JWTs and genuinely revoked/inactive accounts still terminate their streams.
- A malformed audit reference could stop the notification delivery batch. Invalid target identifiers are skipped without exposing data or preventing later valid events from being delivered.
- A browser request cancelled while authentication was waiting for MongoDB could still reserve a live-connection slot. Already-aborted/destroyed responses are now rejected before reserving capacity. The five-stream limit and all role/ownership checks remain intact.
- Some preserved legacy forms used approval time as submission time. New captures only use a recorded submission event. Legacy display metadata also requires such evidence; absent evidence is shown as not recorded. Stored legacy rows and their original timestamps are not rewritten.

The existing print rendering was extracted into `frontend/src/utils/printPdfPages.js` without changing its A4 layout. New tests verify that all pages render/decode before the print dialog is invoked and that an image failure cannot silently print an incomplete application. The actual OS printer dialog and physical printed sheets still require manual verification.

Additional/updated files in this pass:

- `backend/src/services/inbox.service.js`
- `backend/src/services/kycApplication.service.js`
- `backend/src/services/kycApplicationPdf.service.js`
- `backend/tests/unit/kycApplicationPdf.test.js`, `inboxStream.test.js`
- `backend/tests/integration/inbox.integration.test.js`, `kyc.integration.test.js`
- `frontend/src/components/KycPdfPreview.jsx`
- `frontend/src/utils/printPdfPages.js`, `frontend/tests/printPdfPages.test.mjs`

Current checks: 196 backend tests across 24 suites, 21 frontend tests, ESLint and the production build passed. Browser verification used a disposable local replica set: Employee revision/submission, live Admin notification, Admin correction, live Employee notification with refreshed remarks, older-version selection, protected photo viewing, PDF download and read/unread controls. Sixteen layout checks covered both portals' inbox/application views at 320, 390, 768 and 1440 px with no horizontal overflow. Screenshots are under `docs/screenshots/notifications-verification-20261027/`.

A new encrypted read-only backup covered 28 collections / 198 documents and passed decryption, checksum and BSON validation. All configured-database records were unchanged in the subsequent byte comparison. No migrations, financial repairs, synthetic Atlas records or database resets were performed. Logs and comparison results are under ignored `tmp/financial-audit/notifications-recheck-*`.
